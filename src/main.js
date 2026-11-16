import {
  WebGLRenderer, Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, PCFSoftShadowMap, SRGBColorSpace,
  ACESFilmicToneMapping, Vector3,
} from 'three';
import { LEVELS, GENERIC_TAUNTS } from './levels.js';
import { createGame, loadLevel, restartAttempt, step, exportCoopSnapshot, applyCoopSnapshot } from './core/game.js';
import { loadModels } from './render/assets.js';
import { buildWorld } from './render/world.js';
import { createMomo } from './render/momo.js';
import { createConfetti, createDust, createAmbientMotes } from './render/fx.js';
import { createDiorama } from './render/diorama.js';
import { input, bindInput, pollGamepad, clearTouchInput } from './input.js';
import { initAudio, sfx, startMusic, stopMusic, duckMusic, setMuted } from './audio.js';
import { loadSave, saveProgress, recordWin } from './save.js';
import { parseRoomCodeInput } from './net/roomCode.js';
import { createCoopLobby } from './ui/lobby.js';
import { hud } from './ui/hud.js';
import { t, applyI18n } from './i18n.js';
import {
  isFullscreenSupported, isInFullscreen, requestGameFullscreen,
  subscribeFullscreenChange, toggleGameFullscreen,
} from './utils/fullscreen.js';

const FIXED = 1 / 60;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (id) => document.getElementById(id);

applyI18n();
let save = loadSave();
setMuted(save.muted);
hud.muteIcon(save.muted);
hud.fullscreenIcon(isInFullscreen());
if (!isFullscreenSupported()) hud.hideFullscreenBtn();
subscribeFullscreenChange((fs) => hud.fullscreenIcon(fs));

const canvas = $('game');
const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;

const scene = new Scene();
const camera = new PerspectiveCamera(38, 1, 0.1, 200);
const hemi = new HemisphereLight('#ffffff', '#f3c9b5', 1.7);
const sun = new DirectionalLight('#fff6ec', 2.3);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 10, bottom: -6, near: 1, far: 40 });
const rim = new DirectionalLight('#fff2e6', 0.85);
scene.add(hemi, sun, sun.target, rim);

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  hud.portraitHint(innerWidth < innerHeight && innerWidth < 760);
}
addEventListener('resize', resize);
resize();

await document.fonts.ready;
let models;
try {
  models = await loadModels({
    momo: 0.95, mimi: 0.95, darwaza: 1.35, gappu_sign: 1.25, kabootar: 0.7, lollipop_tree: 2.4, cotton_cloud: 1, boulder: 1,
    banana_peel: 0.42, rubber_chicken: 0.75, boxing_glove: 0.75, checkpoint_flag: 1.1,
    gift_box: 0.9, toy_robot: 0.95, cute_ghost: 0.95,
    coop_switch: 0.45, golden_key: 0.28, ticking_bomb: 0.85,
  });
} catch (err) {
  const titleEl = $('loading').querySelector('h1');
  if (titleEl) titleEl.textContent = 'Model load fail — refresh karo 🙏';
  throw err;
}
$('loading').hidden = true;

const qsParams = new URLSearchParams(location.search);
const qsLevel = Number(qsParams.get('level'));
const qsRoom = parseRoomCodeInput(qsParams.get('room'));
const worldIndices = (w) => LEVELS.map((l, i) => ((l.world ?? 1) - 1 === w ? i : -1)).filter((i) => i >= 0);
const lastSoloLevel = LEVELS.reduce((accIdx, l, idx) => (l.coopOnly ? accIdx : idx), 0);
const rawStart = qsLevel ? Math.max(0, Math.min(LEVELS.length - 1, qsLevel - 1)) : Math.min(save.unlocked, lastSoloLevel);
const startLevel = LEVELS[rawStart]?.coopOnly ? lastSoloLevel : rawStart;
if (qsLevel && startLevel > save.unlocked) save = { ...save, unlocked: startLevel };

let game = createGame(LEVELS, startLevel);
let world = buildWorld(scene, game.level, models);
const momo = createMomo(models.momo);
const mimi = createMomo(models.mimi);
mimi.group.visible = false;
const confetti = createConfetti();
const dust = createDust();
const motes = createAmbientMotes();
const diorama = createDiorama(scene, LEVELS, models);
scene.add(momo.group, mimi.group, confetti.mesh, dust.mesh, motes.mesh);
window.__game = game;

let playing = false;
let transitioning = false;
let mapOpen = false;
let mapWorld = (LEVELS[game.levelIndex]?.world ?? 1) - 1;
let mapSelected = game.levelIndex;
let coopRole = null; // null | 'host' | 'guest'
let coopStartIdx = 35;
let prevGuestJump = false;
let guestJumpPending = false;
let lastHudDeaths = -1;
const guestInput = { left: false, right: false, moveX: 0, down: false, jump: false };
let lastSnapTime = 0;
let lastSentSig = '';
let lastGuestSentAt = 0;
let stateSyncTick = 0;
let trauma = 0;
let hitStop = 0;
let fovPunch = 0;
let pendingWinTimer = 0;
let fakeSaveTimer = 0;
let babbleTimer = 0;
const camPos = new Vector3(game.player.x, game.player.y + 2, 14);
const camLook = new Vector3();

const lobby = createCoopLobby(LEVELS, {
  onMatchStart(levelIndex, snap) {
    coopRole = snap?.isHost ? 'host' : 'guest';
    coopStartIdx = LEVELS[levelIndex]?.coopOnly ? 35 : 0;
    guestInput.left = guestInput.right = guestInput.down = guestInput.jump = false;
    guestInput.moveX = 0;
    prevGuestJump = false;
    guestJumpPending = false;
    lastHudDeaths = -1;
    game = createGame(LEVELS, levelIndex, { coop: true });
    window.__game = game;
    mimi.group.visible = true;
    mimi.reset();
    startAt(levelIndex, true);
    if (coopRole === 'host') {
      lobby.session.sendState(exportCoopSnapshot(game));
    }
  },
  onGuestInput(msg) {
    if (coopRole !== 'host') return;
    guestInput.left = !!msg.left;
    guestInput.right = !!msg.right;
    guestInput.moveX = Number.isFinite(Number(msg.moveX)) ? Math.max(-1, Math.min(1, Number(msg.moveX))) : 0;
    guestInput.down = !!msg.down;
    const j = !!msg.jump;
    if (j && !prevGuestJump) guestJumpPending = true;
    prevGuestJump = j;
    guestInput.jump = j;
  },
  onStateSync(snap) {
    if (coopRole !== 'guest' || !game.coop) return;
    const { levelChanged, respawned } = applyCoopSnapshot(game, snap);
    lastSnapTime = time;
    if (levelChanged && !transitioning) {
      rebuildWorld();
      showLevel();
    } else if (respawned && !transitioning) {
      momo.reset();
      mimi.reset();
      hud.doorWait(false);
      world.snap(game);
    }
    if (game.deaths !== lastHudDeaths) {
      lastHudDeaths = game.deaths;
      hud.deaths(game.deaths);
    }
  },
  onEventSync(ev) {
    if (coopRole !== 'guest') return;
    if (ev.type === 'win') {
      if (ev.nextLevel !== undefined && ev.nextLevel !== game.levelIndex && !ev.finished) {
        loadLevel(game, ev.nextLevel);
      } else if (ev.finished) {
        game.finished = true;
      }
    }
    onEvent(ev);
  },
  onRestart() {
    if (coopRole === 'host') handleRestart(true);
  },
  onPeerLeft() {
    if (!playing) return;
    hud.toast('Partner left room!', 1800);
  },
  onClosed() {
    $('menu').hidden = false;
    $('play').focus();
  },
});
window.__coopLobby = lobby;

function clearActionTimers() {
  clearTimeout(pendingWinTimer);
  clearTimeout(fakeSaveTimer);
  clearTimeout(babbleTimer);
  hud.clearPopups();
}

function resetEffects() {
  hitStop = 0;
  trauma = 0;
  fovPunch = 0;
}

function rebuildWorld() {
  world.dispose();
  world = buildWorld(scene, game.level, models);
  momo.reset();
  if (game.coop) {
    mimi.reset();
    mimi.group.visible = !mapOpen;
  } else {
    mimi.group.visible = false;
  }
  hud.doorWait(false);
  if (playing) startMusic(game.level.world ?? 1);
  camPos.set(game.player.x, game.player.y + 2, innerWidth < innerHeight ? 20 : 14);
}

function showLevel() {
  hud.level(game.levelIndex, t(game.level.name), game.level.world ?? 1);
  hud.toast(t('hud.level', { n: game.levelIndex + 1, name: t(game.level.name) }), 1600, 'intro');
}

function startAt(index = game.levelIndex, forceRebuild = false) {
  clearActionTimers();
  resetEffects();
  transitioning = false;
  hud.cancelIris();
  const changed = index !== game.levelIndex || game.finished;
  if (changed) loadLevel(game, index);
  closeMap(false);
  playing = true;
  document.body.classList.add('playing');
  if (changed || forceRebuild) rebuildWorld();
  else {
    momo.reset();
    if (game.coop) {
      mimi.reset();
      mimi.group.visible = true;
    } else mimi.group.visible = false;
    world.snap(game);
  }
  initAudio();
  startMusic(game.level.world ?? 1);
  $('menu').hidden = true;
  $('coop').hidden = true;
  $('end').hidden = true;
  hud.show();
  hud.coopControls(Boolean(coopRole));
  lastHudDeaths = game.deaths;
  hud.deaths(game.deaths);
  showLevel();
}

const ICO_LOCK = '<svg class="ico ico-sm" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const ICO_CHECK = '<svg class="ico ico-sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

function renderMapGrid(focusSelected = false) {
  const grid = $('level-grid');
  grid.innerHTML = '';
  for (const tab of $('world-tabs').querySelectorAll('.tab')) {
    tab.classList.toggle('on', Number(tab.dataset.w) === mapWorld);
  }
  const indices = worldIndices(mapWorld);
  if (!indices.includes(mapSelected) && indices.length) mapSelected = indices[0];
  let focusTarget = null;
  for (const i of indices) {
    const btn = document.createElement('button');
    btn.className = 'lvl-btn';
    if (i === mapSelected) { btn.classList.add('on'); focusTarget = btn; }
    if (save.bestDeaths[i] !== undefined) btn.classList.add('done');
    const locked = !coopRole && i < 30 && i > save.unlocked;
    btn.disabled = locked;

    const top = document.createElement('span');
    if (locked) top.innerHTML = ICO_LOCK;
    else top.textContent = String(i + 1);
    const sub = document.createElement('small');
    const best = save.bestDeaths[i];
    if (best !== undefined) sub.innerHTML = `${ICO_CHECK} ${best}`;
    else sub.textContent = locked ? '—' : (LEVELS[i]?.coopOnly ? '2P' : 'New');
    btn.append(top, sub);

    btn.addEventListener('click', () => {
      mapSelected = i;
      renderMapGrid(true);
    });
    grid.appendChild(btn);
  }
  const sel = LEVELS[mapSelected];
  $('map-selected-title').textContent = sel ? `Level ${mapSelected + 1}: ${t(sel.name)}` : '';
  $('map-play').disabled = !coopRole && mapSelected < 30 && mapSelected > save.unlocked;
  diorama.sync(save, mapSelected, Boolean(coopRole));
  if (focusSelected && focusTarget) focusTarget.focus();
}

function setPlaying(v) {
  playing = v;
  document.body.classList.toggle('playing', v);
  if (!v) clearTouchInput();
}

function leaveCoopToMenu() {
  clearActionTimers();
  resetEffects();
  transitioning = false;
  hud.cancelIris();
  stopMusic();
  setPlaying(false);
  if (coopRole) {
    lobby.session.leave();
    coopRole = null;
  }
  game = createGame(LEVELS, startLevel);
  window.__game = game;
  mimi.group.visible = false;
  rebuildWorld();
  hud.coopControls(false);
  hud.hide();
  $('end').hidden = true;
  $('map').hidden = true;
  $('coop').hidden = true;
  $('menu').hidden = false;
  $('play').focus();
}

function openMap() {
  if (coopRole === 'guest') {
    hud.toast('Host chooses levels in Co-op!', 1300);
    return;
  }
  clearActionTimers();
  resetEffects();
  transitioning = false;
  hud.cancelIris();
  stopMusic();
  mapOpen = true;
  setPlaying(false);
  mapSelected = game.levelIndex;
  mapWorld = (LEVELS[mapSelected]?.world ?? 1) - 1;
  $('menu').hidden = true;
  $('end').hidden = true;
  hud.hide();
  world.root.visible = false;
  momo.group.visible = false;
  mimi.group.visible = false;
  confetti.mesh.visible = false;
  dust.mesh.visible = false;
  motes.mesh.visible = false;
  scene.fog = null;
  diorama.show(true);
  renderMapGrid();
  $('map').hidden = false;
  $('map-play').focus();
}

function closeMap(shouldRebuild = true) {
  if (!mapOpen) return;
  mapOpen = false;
  $('map').hidden = true;
  diorama.show(false);
  world.root.visible = true;
  momo.group.visible = true;
  mimi.group.visible = !!game.coop;
  confetti.mesh.visible = true;
  dust.mesh.visible = true;
  motes.mesh.visible = true;
  if (shouldRebuild) rebuildWorld();
}

$('play').addEventListener('click', () => {
  requestGameFullscreen();
  const resetFromCoop = Boolean(coopRole);
  if (coopRole) {
    lobby.session.leave();
    coopRole = null;
    game = createGame(LEVELS, startLevel);
    window.__game = game;
    mimi.group.visible = false;
  }
  startAt(game.levelIndex, resetFromCoop);
});
$('open-coop').addEventListener('click', () => {
  initAudio();
  requestGameFullscreen();
  $('menu').hidden = true;
  lobby.openCreate(game.level.coopOnly ? game.levelIndex : undefined);
});
$('open-map').addEventListener('click', openMap);
$('end-map').addEventListener('click', openMap);
$('btn-map').addEventListener('click', openMap);
$('btn-leave').addEventListener('click', leaveCoopToMenu);
$('end-leave').addEventListener('click', leaveCoopToMenu);
$('coop-start').addEventListener('click', () => { initAudio(); requestGameFullscreen(); });
$('coop-join-btn').addEventListener('click', () => { initAudio(); requestGameFullscreen(); });
$('map-close').addEventListener('click', () => {
  if (coopRole) {
    lobby.session.leave();
    coopRole = null;
    game = createGame(LEVELS, startLevel);
    window.__game = game;
    mimi.group.visible = false;
  }
  closeMap(true);
  $('menu').hidden = false;
  $('play').focus();
});
$('map-play').addEventListener('click', () => {
  requestGameFullscreen();
  if (!coopRole && LEVELS[mapSelected]?.coopOnly) {
    closeMap(false);
    lobby.openCreate(mapSelected);
    return;
  }
  if (coopRole === 'host') {
    lobby.session.setLevel(mapSelected);
    startAt(mapSelected);
    lobby.session.sendEvent({ type: 'levelSync', nextLevel: mapSelected });
    lobby.session.sendState(exportCoopSnapshot(game));
    return;
  }
  startAt(mapSelected);
});
for (const tab of $('world-tabs').querySelectorAll('.tab')) {
  tab.addEventListener('click', () => {
    mapWorld = Number(tab.dataset.w);
    mapSelected = worldIndices(mapWorld)[0] ?? 0;
    renderMapGrid();
  });
}

function handleRestart(fromRemote = false) {
  if (!playing || transitioning) return;
  if (coopRole === 'guest' && !fromRemote) {
    lobby.session.sendRestart();
    return;
  }
  clearActionTimers();
  resetEffects();
  restartAttempt(game);
  momo.reset();
  if (game.coop) mimi.reset();
  hud.doorWait(false);
  world.snap(game);
  if (coopRole === 'host') {
    lobby.session.sendEvent({ type: 'respawn' });
    lobby.session.sendState(exportCoopSnapshot(game));
  }
}
$('btn-restart').addEventListener('click', handleRestart);
$('btn-fullscreen').addEventListener('click', () => { toggleGameFullscreen(); });
$('btn-mute').addEventListener('click', () => {
  save = { ...save, muted: !save.muted };
  if (!save.muted) initAudio();
  setMuted(save.muted);
  hud.muteIcon(save.muted);
  saveProgress(save);
});

addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyM') {
    if (mapOpen) {
      e.preventDefault();
      startAt(game.levelIndex);
    } else if (playing && !transitioning) {
      e.preventDefault();
      if (coopRole === 'guest') leaveCoopToMenu();
      else openMap();
    }
  }
});

$('again').addEventListener('click', () => {
  requestGameFullscreen();
  clearActionTimers();
  resetEffects();
  if (coopRole === 'host') {
    lobby.session.setLevel(coopStartIdx);
    lobby.session.startMatch(coopStartIdx);
    return;
  }
  if (coopRole === 'guest') return;
  game.deaths = 0;
  game.finished = false;
  loadLevel(game, 0);
  rebuildWorld();
  startAt(0);
});

bindInput(initAudio);
if (qsRoom) {
  $('menu').hidden = true;
  lobby.openJoin(qsRoom);
} else {
  $('menu').hidden = false;
  $('play').focus();
}

function onEvent(e) {
  switch (e.type) {
    case 'levelSync':
      if (e.nextLevel !== undefined) startAt(e.nextLevel);
      break;
    case 'jump': {
      const jp = game.players?.[e.playerIndex ?? 0] ?? game.player;
      sfx.jump();
      dust.burst(jp.x, jp.y, 4, -jp.vx * 0.2);
      break;
    }
    case 'land': {
      const lp = game.players?.[e.playerIndex ?? 0] ?? game.player;
      sfx.land();
      dust.burst(lp.x, lp.y, 6, 0);
      break;
    }
    case 'doorWait': {
      sfx.fakeSave();
      const who = e.playerIndex === 1 ? 'Mimi' : 'Momo';
      hud.doorWait(true, t('coop.doorWait'));
      hud.toast(`${who} door pe hai!`, 1200);
      break;
    }
    case 'doorLocked':
      sfx.locked();
      hud.toast(t('coop.doorLocked'), 1150);
      break;
    case 'key':
      sfx.key();
      confetti.burst(e.x, e.y + 0.35);
      hud.toast(t('coop.keyGot', { left: e.left }), 1150);
      break;
    case 'gateOpen':
      sfx.gateOpen();
      break;
    case 'defused':
      sfx.defused();
      confetti.burst(e.x, e.y + 0.45);
      hud.toast(t('coop.defused'), 1150);
      break;
    case 'boom':
      sfx.boom();
      confetti.burst(e.x, e.y + 0.5);
      break;
    case 'trap':
      if (e.kind === 'bananaPeel') sfx.slip();
      else if (e.kind === 'rubberChicken') sfx.squeak();
      else if (e.kind === 'chompCoin') sfx.chomp();
      else if (e.kind === 'boxingGlove') sfx.punch();
      else if (e.kind === 'crusher') sfx.slam();
      else if (e.kind === 'sneezeCloud') sfx.sneeze();
      else if (e.kind === 'gravityFlip' || e.kind === 'controlsFlip') sfx.flip();
      else if (e.kind === 'launchFloor') sfx.launch();
      else if (e.kind === 'antiJump') sfx.antiJump();
      else if (e.kind === 'boulder') sfx.rumble();
      else sfx.trap();
      momo.surprise();
      if (game.coop) mimi.surprise();
      if (!reducedMotion) fovPunch = 2.0;
      break;
    case 'giftTrap':
      sfx.gift();
      confetti.burst(e.x, e.y + 0.6);
      hud.toast(t('trap.gift'), 1000, 'crack');
      momo.surprise();
      if (game.coop) mimi.surprise();
      if (!reducedMotion) { trauma = 0.5; fovPunch = 2.2; }
      break;
    case 'fakeWin':
      sfx.win();
      confetti.burst(e.x, e.y + 0.9);
      hud.toast(t('trap.fakeWin'), 950, 'crack');
      momo.surprise();
      if (game.coop) mimi.surprise();
      break;
    case 'fakeSave':
      sfx.fakeSave();
      hud.toast(t('trap.fakeSave'), 700);
      clearTimeout(fakeSaveTimer);
      fakeSaveTimer = setTimeout(() => hud.toast(t('trap.fakeSaveOops'), 1000), 750);
      momo.surprise();
      if (game.coop) mimi.surprise();
      break;
    case 'death': {
      sfx.death();
      duckMusic(0.5);
      const victimMomo = e.victim === 1 ? mimi : momo;
      victimMomo.onDeath(e.cause);
      hud.doorWait(false);
      if (e.cause !== 'crushed' && e.cause !== 'pit') confetti.burst(e.x, Math.max(e.y, 1.2));
      if (!reducedMotion) { trauma = 0.85; hitStop = 0.08; fovPunch = 2.5; }
      if (!game.coop) {
        save = { ...save, totalDeaths: save.totalDeaths + 1 };
        saveProgress(save);
      } else {
        hud.toast(t('coop.died', { name: e.victim === 1 ? 'Mimi' : 'Momo' }), 950, 'crack');
      }
      hud.deaths(game.deaths);

      let msgKey = null;
      if (game.deaths === 10 || game.deaths === 25 || game.deaths === 50) msgKey = `taunt.${game.deaths}`;
      else {
        const pool = Math.random() < 0.6 ? game.level.taunts : GENERIC_TAUNTS;
        msgKey = pool[Math.floor(Math.random() * pool.length)];
      }
      hud.taunt(t(msgKey));
      clearTimeout(babbleTimer);
      babbleTimer = setTimeout(sfx.babble, 120);
      break;
    }
    case 'respawn':
      clearTimeout(fakeSaveTimer);
      hud.doorWait(false);
      momo.reset();
      if (game.coop) mimi.reset();
      world.snap(game);
      break;
    case 'win': {
      clearTimeout(fakeSaveTimer);
      clearTimeout(babbleTimer);
      hud.doorWait(false);
      sfx.win();
      const clearedLevel = e.level;
      if (!game.coop) {
        const prevUnlocked = save.unlocked;
        save = recordWin(save, clearedLevel, e.deaths, LEVELS.length);
        if (clearedLevel >= 30 && prevUnlocked < 29) {
          save = { ...save, unlocked: prevUnlocked };
          saveProgress(save);
        }
      }
      hud.toast(e.deaths ? t('hud.cleared', { n: e.deaths }) : t('hud.flawless'), 1400);
      clearTimeout(pendingWinTimer);
      if (game.finished) {
        setPlaying(false);
        stopMusic();
        pendingWinTimer = setTimeout(() => { hud.hide(); hud.end(game.deaths, coopRole === 'guest'); }, 900);
        break;
      }
      transitioning = true;
      hud.iris(() => {
        transitioning = false;
        rebuildWorld();
        showLevel();
      }, reducedMotion);
      break;
    }
    default: break;
  }
}

const IDLE = { left: false, right: false, down: false, jump: false };
let acc = 0;
let prevRestart = false;
let last = performance.now();
let time = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  time += dt;
  const k = (rate) => 1 - Math.exp(-rate * dt);

  const padPressed = pollGamepad();
  if (!playing && !mapOpen && padPressed && !$('menu').hidden) startAt(game.levelIndex);

  if (mapOpen) {
    diorama.update(dt, time);
    camPos.x += (0 - camPos.x) * k(6);
    camPos.y += ((innerWidth < innerHeight ? 13 : 9.2) - camPos.y) * k(6);
    camPos.z += ((innerWidth < innerHeight ? 16 : 11.5) - camPos.z) * k(6);
    camera.position.copy(camPos);
    camera.lookAt(0, 0, 0.3);
    hemi.intensity = 1.7;
    sun.intensity = 2.3;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
    return;
  }

  if (playing && !transitioning && input.restart && !prevRestart) handleRestart();
  prevRestart = input.restart;

  if (!transitioning) {
    if (coopRole === 'guest') {
      const qx = Math.round((input.moveX || 0) * 20) / 20;
      const sig = `${+input.left}${+input.right}${qx}${+input.down}${+input.jump}`;
      if (playing && (sig !== lastSentSig || time - lastGuestSentAt > 0.08)) {
        lastSentSig = sig;
        lastGuestSentAt = time;
        lobby.session.sendInput(input);
      }
    } else if (hitStop > 0) {
      hitStop = Math.max(0, hitStop - dt);
    } else {
      acc += dt;
      while (acc >= FIXED && !transitioning && !game.finished) {
        acc -= FIXED;
        const stepIn = coopRole === 'host'
          ? (playing ? [input, { ...guestInput, jump: guestInput.jump || guestJumpPending }] : [IDLE, IDLE])
          : (playing ? input : IDLE);
        guestJumpPending = false;
        const evs = step(game, stepIn, FIXED);
        for (let i = 0; i < evs.length; i++) {
          const ev = evs[i];
          onEvent(ev);
          if (coopRole === 'host') {
            lobby.session.sendEvent({
              ...ev,
              nextLevel: game.levelIndex,
              finished: game.finished,
            });
          }
        }
        if (coopRole === 'host' && (evs.length > 0 || (stateSyncTick++ % 2 === 0))) {
          lobby.session.sendState(exportCoopSnapshot(game));
        }
        if (transitioning || game.finished) { acc = 0; break; }
      }
    }

    const alpha = coopRole === 'guest'
      ? Math.min(1, Math.max(0, (time - lastSnapTime) * 30))
      : (hitStop > 0 ? 1 : acc / FIXED);

    const p0 = game.players[0];
    const rx0 = p0.prevX + (p0.x - p0.prevX) * alpha;
    const ry0 = p0.prevY + (p0.y - p0.prevY) * alpha;
    if (p0.slip > 0 && Math.random() < 0.35) dust.burst(rx0, ry0, 1, -p0.slipDir * 2);

    const isP1Dead = game.dead && (!game.coop || game.deathVictim === 0);
    momo.update(p0, dt, time, isP1Dead, alpha, game.coop ? 0.14 : 0);

    let camFocusX = rx0 + p0.face * (1.1 + Math.min(0.6, Math.abs(p0.vx) * 0.08));
    let camFocusY = ry0;
    let spreadZ = 0;
    if (game.coop && game.players[1]) {
      const p1 = game.players[1];
      const rx1 = p1.prevX + (p1.x - p1.prevX) * alpha;
      const ry1 = p1.prevY + (p1.y - p1.prevY) * alpha;
      if (p1.slip > 0 && Math.random() < 0.35) dust.burst(rx1, ry1, 1, -p1.slipDir * 2);
      mimi.update(p1, dt, time, game.dead && game.deathVictim === 1, alpha, -0.16);
      camFocusX = (rx0 + rx1) * 0.5;
      camFocusY = (ry0 + ry1) * 0.5;
      spreadZ = Math.min(14, Math.abs(rx0 - rx1) * 1.05);
    }

    world.update(game, dt, time, alpha);
    confetti.update(dt);
    dust.update(dt);
    motes.update(time, camPos.x);
    const localPlayer = coopRole === 'guest' ? (game.players[1] ?? p0) : p0;
    hud.flipped(playing && localPlayer.flipped > 0);

    const targetHemi = game.darkTimer > 0 ? 0.22 : 1.7;
    const targetSun = game.darkTimer > 0 ? 0.28 : 2.3;
    hemi.intensity += (targetHemi - hemi.intensity) * k(10);
    sun.intensity += (targetSun - sun.intensity) * k(10);

    const L = game.level;
    const targetZ = (innerWidth < innerHeight ? 20 : 14) + spreadZ;
    camPos.z += (targetZ - camPos.z) * k(6);
    const halfView = Math.tan((38 * Math.PI) / 360) * camPos.z * camera.aspect;
    const lo = Math.min(halfView - 1, L.W / 2), hi = Math.max(L.W - halfView + 1, L.W / 2);
    const rawTx = Math.max(lo, Math.min(hi, camFocusX));
    const tx = Math.abs(rawTx - camPos.x) > 0.35 ? rawTx : camPos.x;
    const ty = Math.max(3.2, camFocusY + 1.6);
    camPos.x += (tx - camPos.x) * k(5.5);
    camPos.y += (ty + 1.4 - camPos.y) * k(4.5);

    trauma = Math.max(0, trauma - dt * 1.9);
    const shake = trauma * trauma * 0.42;
    const sx = shake > 0 ? Math.sin(time * 53) * shake : 0;
    const sy = shake > 0 ? Math.cos(time * 61) * shake * 0.7 : 0;

    fovPunch = Math.max(0, fovPunch - dt * 14);
    if (Math.abs(camera.fov - (38 - fovPunch)) > 0.05) {
      camera.fov = 38 - fovPunch;
      camera.updateProjectionMatrix();
    }

    camera.position.set(camPos.x + sx, camPos.y + sy, camPos.z);
    camLook.set(camPos.x, camPos.y - 1.4, 0);
    camera.lookAt(camLook);
    sun.position.set(camPos.x + 5, 14, 9);
    sun.target.position.set(camPos.x, 0, 0);
    rim.position.set(camPos.x - 4, 6, -9);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
