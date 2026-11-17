import {
  WebGLRenderer, Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, PCFShadowMap, SRGBColorSpace,
  ACESFilmicToneMapping, Vector3,
} from 'three';
import { LEVELS, RAW_LEVELS, GENERIC_TAUNTS } from './levels.js';
import { createGame, loadLevel, restartAttempt, step, stepPlayerLocal, exportCoopSnapshot, applyCoopSnapshot } from './core/game.js';
import { createModelStore } from './render/assets.js';
import { buildWorld } from './render/world.js';
import { createMomo } from './render/momo.js';
import { SKINS, getSkin } from './skins.js';
import { createConfetti, createDust, createAmbientMotes } from './render/fx.js';
import { createDiorama } from './render/diorama.js';
import { input, bindInput, pollGamepad, clearTouchInput } from './input.js';
import { initAudio, sfx, startMusic, stopMusic, duckMusic, setMuted } from './audio.js';
import { loadSave, saveProgress, recordWin } from './save.js';
import { parseRoomCodeInput } from './net/roomCode.js';
import { createSnapshotBuffer, createGuestReconciler, applyInterpolatedRemoteVisuals } from './net/coopSync.js';
import { createCoopLobby } from './ui/lobby.js';
import { hud } from './ui/hud.js';
import { t, applyI18n } from './i18n.js';
import {
  exitGameFullscreen, isFullscreenSupported, isInFullscreen,
  requestGameFullscreen, subscribeFullscreenChange,
} from './utils/fullscreen.js';

const FIXED = 1 / 60;
const TAN_HALF_38 = Math.tan((38 * Math.PI) / 360);
const TAN_HALF_44 = Math.tan((44 * Math.PI) / 360);
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarseQuery = matchMedia('(pointer: coarse)');
let isCoarsePointer = coarseQuery.matches;
coarseQuery.addEventListener?.('change', (e) => { isCoarsePointer = e.matches; });
const $ = (id) => document.getElementById(id);

applyI18n();
let save = loadSave();
setMuted(save.muted);
hud.muteIcon(save.muted);
let userMinimized = false;
const ensureDefaultFullscreen = () => {
  if (!userMinimized && !isInFullscreen()) requestGameFullscreen();
};
hud.fullscreenIcon(isInFullscreen());
if (!isFullscreenSupported()) hud.hideFullscreenBtn();
subscribeFullscreenChange((fs) => hud.fullscreenIcon(fs));
addEventListener('pointerdown', (e) => {
  if (e.target.closest?.('#btn-fullscreen, #btn-chat, #touch, #game-chat, input, textarea, select')) return;
  ensureDefaultFullscreen();
}, { capture: true, passive: true });
for (const evName of ['gesturestart', 'gesturechange', 'gestureend']) {
  addEventListener(evName, (e) => e.preventDefault(), { passive: false });
}
addEventListener('touchmove', (e) => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });
let lastTapAt = 0;
addEventListener('touchend', (e) => {
  const now = performance.now();
  if (now - lastTapAt < 300 && !e.target.closest?.('button, a, input, #coop, #menu, #map')) e.preventDefault();
  lastTapAt = now;
}, { passive: false });

const canvas = $('game');
const isCoarse = matchMedia('(pointer: coarse)').matches;
let renderer;
try {
  renderer = new WebGLRenderer({ canvas, antialias: !isCoarse, alpha: true, powerPreference: 'high-performance' });
} catch {
  renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true });
}
renderer.setPixelRatio(Math.min(devicePixelRatio, isCoarse ? 1.25 : 1.75));
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;

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
  hud.portraitHint(false);
}
addEventListener('resize', resize);
resize();

const MODEL_HEIGHTS = {
  momo: 0.95, mimi: 0.95, darwaza: 1.35, gappu_sign: 1.85, kabootar: 0.7, lollipop_tree: 2.4, cotton_cloud: 1, boulder: 1,
  banana_peel: 0.42, rubber_chicken: 0.75, boxing_glove: 0.75, checkpoint_flag: 1.1,
  gift_box: 0.9, toy_robot: 0.95, cute_ghost: 0.95,
  coop_switch: 0.45, golden_key: 0.28, ticking_bomb: 0.85,
  spring_pad: 0.65, magnet_orb: 0.8, pie_cannon: 0.85,
  portal_gate: 1.5, countdown_speaker: 0.75, saw_blade: 0.9,
  ...Object.fromEntries(SKINS.filter((k) => k.id !== 'momo').map((k) => [k.id, k.h])),
};
const CORE_MODELS = ['momo', 'mimi', 'darwaza', 'gappu_sign', 'kabootar', 'lollipop_tree', 'cotton_cloud', 'boulder'];
const TRAP_MODEL = {
  bananaPeel: 'banana_peel',
  rubberChicken: 'rubber_chicken',
  boxingGlove: 'boxing_glove',
  fakeCheckpoint: 'checkpoint_flag',
  giftTrap: 'gift_box',
  mimicRobot: 'toy_robot',
  booGhost: 'cute_ghost',
  keyItem: 'golden_key',
  plateA: 'coop_switch',
  plateB: 'coop_switch',
  syncPlate: 'coop_switch',
  bomb: 'ticking_bomb',
  springTrap: 'spring_pad',
  magnetOrb: 'magnet_orb',
  pieCannon: 'pie_cannon',
  portalWall: 'portal_gate',
  countdownLie: 'countdown_speaker',
  saw: 'saw_blade',
};
function modelsForLevel(level) {
  const needed = new Set([...CORE_MODELS, save.skin]);
  for (let i = 0; i < level.trapDefs.length; i++) {
    const m = TRAP_MODEL[level.trapDefs[i].kind];
    if (m) needed.add(m);
  }
  return [...needed];
}

const qsParams = new URLSearchParams(location.search);
const qsLevel = Number(qsParams.get('level'));
const qsRoom = parseRoomCodeInput(qsParams.get('room'));
const worldIndices = (w) => LEVELS.map((l, i) => ((l.world ?? 1) - 1 === w ? i : -1)).filter((i) => i >= 0);
const lastSoloLevel = LEVELS.reduce((accIdx, l, idx) => (l.coopOnly ? accIdx : idx), 0);
const rawStart = qsLevel ? Math.max(0, Math.min(LEVELS.length - 1, qsLevel - 1)) : Math.min(save.unlocked, lastSoloLevel);
const startLevel = LEVELS[rawStart]?.coopOnly ? lastSoloLevel : rawStart;
if (qsLevel && startLevel > save.unlocked) save = { ...save, unlocked: startLevel };

await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 600))]);
const modelStore = createModelStore(MODEL_HEIGHTS);
let models = modelStore.models;
try {
  await modelStore.ensure(modelsForLevel(LEVELS[startLevel]));
} catch (err) {
  const titleEl = $('loading').querySelector('h1');
  if (titleEl) titleEl.textContent = 'Model load fail — refresh karo 🙏';
  throw err;
}
$('loading').hidden = true;
modelStore.preloadAll().catch(() => {});

let game = createGame(LEVELS, startLevel);
let world = buildWorld(scene, game.level, models);
let momo = createMomo(models[save.skin], { eyeY: getSkin(save.skin).eyeY });
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
let coopUnlocked = 0;
let prevGuestJump = false;
let guestJumpPending = false;
let lastHudDeaths = -1;
const guestInput = { left: false, right: false, moveX: 0, down: false, jump: false };
let lastSnapTime = 0;
let pendingGuestSnap = null;
let lastSentSig = '';
let lastGuestSentAt = 0;
let guestInputSeq = 0;
let hostSimTick = 0;
let hostAckSeq = 0;
let stateSyncTick = 0;
let pendingLocalJump = false;
const snapBuffer = createSnapshotBuffer({ fixedDt: FIXED });
const guestReconciler = createGuestReconciler();

function sendHostSnapshot() {
  lobby.session.sendState(exportCoopSnapshot(game, { simTick: hostSimTick, ackSeq: hostAckSeq }));
}
let trauma = 0;
let hitStop = 0;
let fovPunch = 0;
let pendingWinTimer = 0;
let fakeSaveTimer = 0;
let babbleTimer = 0;
const camPos = new Vector3(game.player.x, game.player.y + 2, 14);
const camLook = new Vector3();

const lobby = createCoopLobby(LEVELS, {
  onSnapshot(snap) {
    if (playing && coopRole) hud.coopPresence(snap);
  },
  onNetStats(stats) {
    if (playing && coopRole) hud.coopNetStats(stats);
  },
  async onMatchStart(levelIndex, snap) {
    coopRole = snap?.isHost ? 'host' : 'guest';
    const startIdx = Number.isFinite(Number(snap?.levelIndex)) ? snap.levelIndex : levelIndex;
    coopUnlocked = Math.max(startIdx, Number(snap?.maxLevelIndex ?? startIdx));
    guestInput.left = guestInput.right = guestInput.down = guestInput.jump = false;
    guestInput.moveX = 0;
    prevGuestJump = false;
    guestJumpPending = false;
    lastSentSig = '';
    lastGuestSentAt = 0;
    guestInputSeq = 0;
    hostSimTick = 0;
    hostAckSeq = 0;
    snapBuffer.reset();
    guestReconciler.reset();
    acc = 0;
    lastHudDeaths = -1;
    game = createGame(LEVELS, startIdx, { coop: true });
    window.__game = game;
    mimi.group.visible = true;
    mimi.reset();
    await startAt(startIdx, true);
    if (coopRole === 'host') {
      sendHostSnapshot();
    } else if (pendingGuestSnap) {
      const buffered = pendingGuestSnap;
      pendingGuestSnap = null;
      snapBuffer.push(buffered, time);
      applyCoopSnapshot(game, buffered, { predictPlayerIndex: 1 });
      lastSnapTime = time;
      world.snap(game);
    }
  },
  onGuestInput(msg) {
    if (coopRole !== 'host') return;
    const seq = Number(msg.seq) || 0;
    if (seq > hostAckSeq) hostAckSeq = seq;
    guestInput.left = !!msg.left;
    guestInput.right = !!msg.right;
    guestInput.moveX = Number.isFinite(Number(msg.moveX)) ? Math.max(-1, Math.min(1, Number(msg.moveX))) : 0;
    guestInput.down = !!msg.down;
    const j = !!msg.jump;
    if (j && !prevGuestJump) guestJumpPending = true;
    prevGuestJump = j;
    guestInput.jump = j;
  },
  onGuestState(st) {
    if (coopRole !== 'host' || !game.coop || game.dead || game.finished || transitioning) return;
    if (st?.levelIndex !== game.levelIndex) return;
    // positions sent before the last death are stale: applying them would drag the guest back to the trap
    if (Number.isFinite(st.deaths) && st.deaths !== game.deaths) return;
    const p1 = game.players?.[1];
    if (!p1 || p1.atDoor || p1.stun > 0 || p1.slip > 0) return;
    if (!Number.isFinite(st.x) || !Number.isFinite(st.y)) return;
    const dist = Math.hypot(st.x - p1.x, st.y - p1.y);
    if (dist > 5.0) return;
    if (dist < 0.03) {
      // Negligible drift: avoid micro-nudges
    } else if (dist < 1.5) {
      // Smoothly converge toward Guest's authoritative position without 30 Hz snapping
      const dx = (st.x - p1.x) * 0.55;
      const dy = (st.y - p1.y) * 0.55;
      p1.x += dx;
      p1.y += dy;
      p1.prevX += dx;
      p1.prevY += dy;
    } else {
      p1.x = st.x;
      p1.y = st.y;
      p1.prevX = st.x;
      p1.prevY = st.y;
    }
    if (Number.isFinite(st.vx)) p1.vx = st.vx;
    if (Number.isFinite(st.vy)) p1.vy = st.vy;
    if (st.face === 1 || st.face === -1) p1.face = st.face;
    if (typeof st.onGround === 'boolean') p1.onGround = st.onGround;
    if (Number.isFinite(st.seq) && st.seq > hostAckSeq) hostAckSeq = st.seq;
  },
  onStateSync(snap) {
    if (coopRole !== 'guest' || !game.coop) {
      if (coopRole === 'guest') pendingGuestSnap = snap;
      return;
    }
    snapBuffer.push(snap, time);
    if (transitioning) return;
    const savedP0 = game.players[0] ? {
      x: game.players[0].x,
      y: game.players[0].y,
      prevX: game.players[0].prevX,
      prevY: game.players[0].prevY,
      vx: game.players[0].vx,
      vy: game.players[0].vy,
    } : null;
    const { levelChanged, respawned } = applyCoopSnapshot(game, snap, {
      predictPlayerIndex: 1,
      skipPredictPlayer: true,
      snapAlpha: 1,
    });
    // Preserve smoothly interpolated p0 position when snapshot buffer is active
    if (!levelChanged && !respawned && !game.dead && savedP0 && game.players[0] && snapBuffer.size() >= 2) {
      game.players[0].x = savedP0.x;
      game.players[0].y = savedP0.y;
      game.players[0].prevX = savedP0.prevX;
      game.players[0].prevY = savedP0.prevY;
      game.players[0].vx = savedP0.vx;
      game.players[0].vy = savedP0.vy;
    }
    guestReconciler.reconcile(game, snap, stepPlayerLocal, { respawned });
    lastSnapTime = time;
    if (levelChanged) {
      snapBuffer.reset();
      snapBuffer.push(snap, time);
      const need = modelsForLevel(game.level);
      const rebuild = () => { rebuildWorld(); showLevel(); };
      if (modelStore.hasAll(need)) rebuild();
      else modelStore.ensure(need).catch(() => {}).then(rebuild);
    } else if (respawned) {
      snapBuffer.reset();
      snapBuffer.push(snap, time);
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
    if (ev.type === 'jump' || ev.type === 'land') {
      // Guest plays its own jump/land SFX & squash-stretch immediately in stepPlayerLocal
      if (ev.playerIndex === 1) return;
    }
    if (ev.type === 'death') {
      game.dead = true;
      game.deathVictim = ev.victim ?? 0;
      if (Number.isFinite(ev.deaths)) game.deaths = ev.deaths;
    } else if (ev.type === 'win') {
      snapBuffer.reset();
      guestReconciler.reset();
      if (ev.nextLevel !== undefined && ev.nextLevel !== game.levelIndex && !ev.finished) {
        loadLevel(game, ev.nextLevel);
      } else if (ev.finished) {
        game.finished = true;
      }
    } else if (ev.type === 'levelSync' && Number.isFinite(ev.nextLevel)) {
      snapBuffer.reset();
      guestReconciler.reset();
      startAt(ev.nextLevel);
      return;
    }
    onEvent(ev);
  },
  onRestart() {
    if (coopRole === 'host') handleRestart(true);
  },
  onPeerLeft() {
    if (!playing) return;
    hud.toast('Partner left — 30s to reconnect!', 2200);
  },
  onChat(msg) {
    sfx.chat();
    hud.chatMessage(msg.senderName || 'Partner', msg.text, false);
  },
  onChatSent(senderName, text) {
    hud.chatMessage(senderName, text, true);
  },
  onRoomClosed(_reason, message) {
    hud.clearChat();
    const msg = message || 'Room closed.';
    const wasActive = playing || mapOpen || !$('end').hidden || Boolean(coopRole);
    coopRole = null;
    coopUnlocked = 0;
    snapBuffer.reset();
    guestReconciler.reset();
    if (wasActive) {
      clearActionTimers();
      resetEffects();
      transitioning = false;
      hud.cancelIris();
      stopMusic();
      setPlaying(false);
      if (mapOpen) closeMap(true);
      $('end').hidden = true;
      hud.coopControls(false);
      hud.hide();
      game = createGame(LEVELS, startLevel);
      window.__game = game;
      mimi.group.visible = false;
      rebuildWorld();
      $('coop').hidden = false;
      $('coop-status').textContent = msg;
      hud.toast(msg, 3200);
    }
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
  const initZ = innerWidth < innerHeight ? Math.max(26, 15 / Math.max(0.45, camera.aspect)) : 14;
  const focusP = (coopRole === 'guest' && game.players?.[1]) ? game.players[1] : game.player;
  camPos.set(focusP.x, focusP.y + 1.1, initZ);
}

function showLevel() {
  hud.level(game.levelIndex, t(game.level.name), game.level.world ?? 1);
  hud.toast(t('hud.level', { n: game.levelIndex + 1, name: t(game.level.name) }), 1600, 'intro');
}

async function startAt(index = game.levelIndex, forceRebuild = false) {
  const needed = modelsForLevel(LEVELS[index]);
  if (!modelStore.hasAll(needed)) await modelStore.ensure(needed);
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
    const locked = coopRole
      ? i > coopUnlocked
      : (Boolean(LEVELS[i]?.coopOnly) || i > save.unlocked);
    btn.disabled = locked;

    const top = document.createElement('span');
    if (locked) top.innerHTML = ICO_LOCK;
    else top.textContent = String(i + 1);
    const sub = document.createElement('small');
    const best = save.bestDeaths[i];
    if (best !== undefined && !locked) sub.innerHTML = `${ICO_CHECK} ${best}`;
    else sub.textContent = locked ? (LEVELS[i]?.coopOnly && !coopRole ? '2P' : 'Locked') : 'New';
    btn.append(top, sub);

    btn.addEventListener('click', () => {
      mapSelected = i;
      renderMapGrid(true);
    });
    grid.appendChild(btn);
  }
  const sel = LEVELS[mapSelected];
  const selLocked = coopRole
    ? mapSelected > coopUnlocked
    : (Boolean(sel?.coopOnly) || mapSelected > save.unlocked);
  $('map-selected-title').textContent = sel
    ? (selLocked && sel.coopOnly && !coopRole ? `Level ${mapSelected + 1}: ${t('map.lockedCoop')}` : `Level ${mapSelected + 1}: ${t(sel.name)}`)
    : '';
  $('map-play').disabled = selLocked;
  diorama.sync(save, mapSelected, Boolean(coopRole), coopUnlocked);
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
    coopUnlocked = 0;
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
  ensureDefaultFullscreen();
  const resetFromCoop = Boolean(coopRole);
  if (coopRole) {
    lobby.session.leave();
    coopRole = null;
    coopUnlocked = 0;
    game = createGame(LEVELS, startLevel);
    window.__game = game;
    mimi.group.visible = false;
  }
  startAt(game.levelIndex, resetFromCoop);
});
$('open-coop').addEventListener('click', () => {
  initAudio();
  ensureDefaultFullscreen();
  $('menu').hidden = true;
  lobby.openCreate();
});
$('open-map').addEventListener('click', openMap);

// Outfit picker: same faceless body, different costume model. Applies to the Momo seat only.
function renderSkins() {
  $('skin-grid').innerHTML = SKINS.map((k) => `<button type="button" class="skin-btn${k.id === save.skin ? ' on' : ''}" data-skin="${k.id}" aria-pressed="${k.id === save.skin}"><img src="${import.meta.env.BASE_URL}skins/${k.id}.webp" alt="" width="120" height="120" loading="lazy"><span>${k.name}</span><small>${k.tag}</small></button>`).join('');
}
async function setSkin(id) {
  const k = getSkin(id);
  await modelStore.ensure([k.id]);
  const old = momo;
  momo = createMomo(models[k.id], { eyeY: k.eyeY });
  momo.group.visible = old.group.visible;
  scene.add(momo.group);
  scene.remove(old.group);
  momo.reset();
  save = { ...save, skin: k.id };
  saveProgress(save);
  renderSkins();
}
$('open-skins').addEventListener('click', () => { renderSkins(); $('skins').hidden = false; });
$('skins-close').addEventListener('click', () => { $('skins').hidden = true; $('open-skins').focus(); });
$('skin-grid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-skin]');
  if (b) setSkin(b.dataset.skin).catch(() => hud.toast('Outfit load nahi hua, dobara try karo', 1500));
});
$('end-map').addEventListener('click', openMap);
$('btn-map').addEventListener('click', openMap);
$('btn-chat').addEventListener('click', () => {
  const next = !hud.isChatOpen();
  hud.chatOpen(next);
  if (next) $('game-chat-input')?.focus();
});
$('game-chat-close').addEventListener('click', () => hud.chatOpen(false));
function sendInGameChat(raw) {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!text || !coopRole || !lobby.session.isConnected()) return;
  const myName = $('coop-name').value.trim() || (coopRole === 'host' ? 'Momo' : 'Mimi');
  lobby.session.sendChat(text);
  lobby.appendChat(myName, text, true);
  hud.chatMessage(myName, text, true);
}
$('game-chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const inp = $('game-chat-input');
  sendInGameChat(inp.value);
  inp.value = '';
});
$('game-chat-quick').addEventListener('click', (e) => {
  const chip = e.target.closest?.('button[data-msg]');
  if (chip) sendInGameChat(chip.dataset.msg);
});
$('btn-leave').addEventListener('click', leaveCoopToMenu);
$('end-leave').addEventListener('click', leaveCoopToMenu);
$('coop-start').addEventListener('click', () => { initAudio(); ensureDefaultFullscreen(); });
$('coop-join-btn').addEventListener('click', () => { initAudio(); ensureDefaultFullscreen(); });
$('map-close').addEventListener('click', () => {
  if (coopRole) {
    lobby.session.leave();
    coopRole = null;
    coopUnlocked = 0;
    game = createGame(LEVELS, startLevel);
    window.__game = game;
    mimi.group.visible = false;
  }
  closeMap(true);
  $('menu').hidden = false;
  $('play').focus();
});
$('map-play').addEventListener('click', async () => {
  ensureDefaultFullscreen();
  if (!coopRole && (LEVELS[mapSelected]?.coopOnly || mapSelected > save.unlocked)) {
    return;
  }
  if (coopRole === 'host') {
    if (mapSelected > coopUnlocked) return;
    lobby.session.setLevel(mapSelected);
    lobby.session.sendEvent({ type: 'levelSync', nextLevel: mapSelected });
    await startAt(mapSelected);
    sendHostSnapshot();
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
    sendHostSnapshot();
  }
}
function showHint() {
  if (!playing) return;
  // hint for the room the player is standing in
  const px = game.player.x;
  const room = RAW_LEVELS[game.levelIndex]?.spans?.find((s) => px >= s.x0 && px < s.x0 + s.w);
  const hintKey = room?.id ? `room.${room.id}.hint` : null;
  const text = hintKey && t(hintKey) !== hintKey
    ? t(hintKey)
    : t(game.level.taunts?.[0] ?? 'taunt.1');
  hud.toast(`💡 ${text}`, 3200);
}
$('btn-restart').addEventListener('click', handleRestart);
$('btn-hint')?.addEventListener('click', showHint);
addEventListener('keydown', (e) => {
  if (e.code === 'KeyH' && playing && !e.repeat && document.activeElement?.tagName !== 'INPUT') showHint();
});
$('btn-fullscreen').addEventListener('click', () => {
  if (isInFullscreen()) {
    userMinimized = true;
    exitGameFullscreen();
  } else {
    userMinimized = false;
    requestGameFullscreen();
  }
});
$('btn-mute').addEventListener('click', () => {
  save = { ...save, muted: !save.muted };
  if (!save.muted) initAudio();
  setMuted(save.muted);
  hud.muteIcon(save.muted);
  saveProgress(save);
});

addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && hud.isChatOpen()) {
    e.preventDefault();
    hud.chatOpen(false);
    return;
  }
  if (e.target.closest?.('input, textarea, select')) return;
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
  ensureDefaultFullscreen();
  clearActionTimers();
  resetEffects();
  if (coopRole === 'host') {
    coopUnlocked = 0;
    lobby.session.startMatch(0);
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
    case 'doorBluff':
      sfx.locked();
      hud.toast('Wrong door! Back to start 😂', 1250);
      break;
    case 'doorShrunk':
      sfx.locked();
      hud.toast('Darwaza chhota ho gaya! Switch dabao!', 1400);
      break;
    case 'countdown':
      hud.toast(`Kabootar: "${e.text}"`, 500);
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
      else if (e.kind === 'springTrap') sfx.spring();
      else if (e.kind === 'pieCannon') sfx.pie();
      else if (e.kind === 'discoFloor') sfx.disco();
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
      if (game.coop && !game.finished) {
        coopUnlocked = Math.max(coopUnlocked, game.levelIndex);
      }
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
        // the next level may need models that are still downloading (slow guest phones)
        modelStore.ensure(modelsForLevel(game.level)).catch(() => {}).then(() => {
          transitioning = false;
          rebuildWorld();
          showLevel();
        });
      }, reducedMotion);
      break;
    }
    default: break;
  }
}

const IDLE = { left: false, right: false, down: false, jump: false };
let acc = 0;
let prevRestart = false;
let lastFlipped = false;
let last = performance.now();
let time = 0;
let fpsAvgDt = FIXED;
let gpuTier = 0; // 0 = full, 1 = pixelRatio 1, 2 = shadows off
let slowFrames = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  time += dt;
  if (!document.hidden && dt > 0) {
    fpsAvgDt += (dt - fpsAvgDt) * 0.08;
    if (gpuTier < 2 && fpsAvgDt > (gpuTier === 0 ? 0.024 : 0.032)) {
      if (++slowFrames >= 45) {
        slowFrames = 0;
        gpuTier++;
        if (gpuTier === 1) renderer.setPixelRatio(1);
        else if (gpuTier === 2) renderer.shadowMap.enabled = false;
      }
    } else {
      slowFrames = 0;
    }
  }

  const padPressed = pollGamepad();
  if (!playing && !mapOpen && padPressed && !$('menu').hidden) startAt(game.levelIndex);

  if (mapOpen) {
    diorama.update(dt, time);
    camPos.x += (0 - camPos.x) * damp(6, dt);
    camPos.y += ((innerWidth < innerHeight ? 13 : 9.2) - camPos.y) * damp(6, dt);
    camPos.z += ((innerWidth < innerHeight ? 16 : 11.5) - camPos.z) * damp(6, dt);
    camera.position.copy(camPos);
    camera.lookAt(0, 0, 0.3);
    hemi.intensity = 1.7;
    sun.intensity = 2.3;
    if (!document.hidden) renderer.render(scene, camera);
    requestAnimationFrame(frame);
    return;
  }

  if (playing && !transitioning && input.restart && !prevRestart) handleRestart();
  prevRestart = input.restart;

  if (!transitioning) {
    if (coopRole === 'guest') {
      if (hitStop > 0) hitStop = Math.max(0, hitStop - dt);
      if (playing && input.jump) pendingLocalJump = true;
      const activeIn = playing ? { ...input, jump: input.jump || pendingLocalJump } : IDLE;
      const qx = Math.round((activeIn.moveX || 0) * 20) / 20;
      const sig = `${+activeIn.left}${+activeIn.right}${qx}${+activeIn.down}${+activeIn.jump}`;
      const keepalive = sig === '00000' ? 0.25 : 0.10;
      let localJumped = false;
      let localLanded = false;
      acc += dt;
      while (acc >= FIXED && !transitioning && !game.finished) {
        acc -= FIXED;
        const tickIn = playing ? { ...input, jump: input.jump || pendingLocalJump } : IDLE;
        pendingLocalJump = false;
        const seq = ++guestInputSeq;
        stepPlayerLocal(game, 1, tickIn, FIXED, { predictTraps: true });
        const p1Local = game.players[1];
        if (p1Local) {
          if (p1Local.jumped) {
            localJumped = true;
            sfx.jump();
            dust.burst(p1Local.x, p1Local.y, 4, -p1Local.vx * 0.2);
          }
          if (p1Local.landed) {
            localLanded = true;
            sfx.land();
            dust.burst(p1Local.x, p1Local.y, 6, 0);
          }
        }
        guestReconciler.recordPrediction(seq, p1Local);
      }
      if (game.players[1]) {
        if (localJumped) game.players[1].jumped = true;
        if (localLanded) game.players[1].landed = true;
      }
      if (playing && (sig !== lastSentSig || time - lastGuestSentAt > keepalive)) {
        lastSentSig = sig;
        lastGuestSentAt = time;
        lobby.session.sendInput(activeIn, guestInputSeq);
      }
      if (playing && game.players[1] && !game.dead) {
        const p1 = game.players[1];
        const moving = Math.abs(p1.vx) > 0.05 || Math.abs(p1.vy) > 0.05 || !p1.onGround;
        const posStride = moving ? (lobby.session.isP2P() ? 1 : 2) : 6;
        if (localJumped || localLanded || (stateSyncTick++ % posStride === 0)) {
          lobby.session.sendGuestState({
            levelIndex: game.levelIndex,
            seq: guestInputSeq,
            deaths: game.deaths,
            x: Math.round(p1.x * 1000) / 1000,
            y: Math.round(p1.y * 1000) / 1000,
            vx: Math.round(p1.vx * 100) / 100,
            vy: Math.round(p1.vy * 100) / 100,
            face: p1.face,
            onGround: p1.onGround,
          });
        }
      }
      const interpSnap = snapBuffer.sample(time);
      if (interpSnap) {
        applyInterpolatedRemoteVisuals(game, interpSnap);
      }
      guestReconciler.decayError(dt);
    } else if (hitStop > 0) {
      hitStop = Math.max(0, hitStop - dt);
    } else {
      acc += dt;
      let snapDue = false; // one snapshot per rendered frame, even after a catch-up burst of sim steps
      while (acc >= FIXED && !transitioning && !game.finished) {
        acc -= FIXED;
        const stepIn = coopRole === 'host'
          ? (playing ? [input, { ...guestInput, jump: guestInput.jump || guestJumpPending }] : [IDLE, IDLE])
          : (playing ? input : IDLE);
        if (coopRole === 'host' && guestJumpPending && game.players[1]) {
          game.players[1].prevJump = false;
        }
        guestJumpPending = false;
        const evs = step(game, stepIn, FIXED);
        if (coopRole === 'host') hostSimTick++;
        for (let i = 0; i < evs.length; i++) {
          const ev = evs[i];
          onEvent(ev);
          if (coopRole === 'host') {
            lobby.session.sendEvent({
              ...ev,
              deaths: game.deaths,
              nextLevel: game.levelIndex,
              finished: game.finished,
            });
          }
        }
        if (coopRole === 'host') {
          const p0 = game.players[0], p1 = game.players[1];
          const playersIdle = p0 && p1
            && p0.onGround && p1.onGround
            && Math.abs(p0.vx) < 0.05 && Math.abs(p0.vy) < 0.05
            && Math.abs(p1.vx) < 0.05 && Math.abs(p1.vy) < 0.05;
          // full 60 Hz over the P2P data channel; the Worker relay keeps 30 Hz to stay light
          const syncStride = playersIdle ? 6 : (lobby.session.isP2P() ? 1 : 2);
          if (evs.length > 0 || (stateSyncTick++ % syncStride === 0)) snapDue = true;
        }
        if (transitioning || game.finished) { acc = 0; break; }
      }
      if (snapDue && coopRole === 'host') sendHostSnapshot();
    }

    const snapAlpha = coopRole === 'guest'
      ? 1
      : (hitStop > 0 ? 1 : acc / FIXED);
    const localAlpha = hitStop > 0 ? 1 : acc / FIXED;

    const p0 = game.players[0];
    const rx0 = p0.prevX + (p0.x - p0.prevX) * snapAlpha;
    const ry0 = p0.prevY + (p0.y - p0.prevY) * snapAlpha;
    if (p0.slip > 0 && Math.random() < 0.35) dust.burst(rx0, ry0, 1, -p0.slipDir * 2);

    const isP1Dead = game.dead && (!game.coop || game.deathVictim === 0);
    momo.update(p0, dt, time, isP1Dead, snapAlpha, game.coop ? 0.14 : 0);

    let camFocusX = rx0 + p0.face * (1.1 + Math.min(0.6, Math.abs(p0.vx) * 0.08));
    let camFocusY = ry0;
    let spreadZ = 0;
    if (game.coop && game.players[1]) {
      const p1 = game.players[1];
      const p1Alpha = coopRole === 'guest' ? localAlpha : snapAlpha;
      const visErr = coopRole === 'guest' ? guestReconciler.getVisualOffset() : { x: 0, y: 0 };
      const rx1 = p1.prevX + (p1.x - p1.prevX) * p1Alpha + visErr.x;
      const ry1 = p1.prevY + (p1.y - p1.prevY) * p1Alpha + visErr.y;
      if (p1.slip > 0 && Math.random() < 0.35) dust.burst(rx1, ry1, 1, -p1.slipDir * 2);
      const renderP1 = (visErr.x !== 0 || visErr.y !== 0)
        ? { ...p1, x: p1.x + visErr.x, prevX: p1.prevX + visErr.x, y: p1.y + visErr.y, prevY: p1.prevY + visErr.y }
        : p1;
      mimi.update(renderP1, dt, time, game.dead && game.deathVictim === 1, p1Alpha, -0.16);
      if (coopRole === 'guest') {
        camFocusX = rx1 + p1.face * (1.1 + Math.min(0.6, Math.abs(p1.vx) * 0.08));
        camFocusY = ry1;
        spreadZ = 0;
      } else if (coopRole === 'host') {
        camFocusX = rx0 + p0.face * (1.1 + Math.min(0.6, Math.abs(p0.vx) * 0.08));
        camFocusY = ry0;
        spreadZ = 0;
      } else {
        camFocusX = (rx0 + rx1) * 0.5;
        camFocusY = (ry0 + ry1) * 0.5;
        spreadZ = Math.min(14, Math.abs(rx0 - rx1) * 1.05);
      }
    }

    world.update(game, dt, time, snapAlpha);
    confetti.update(dt);
    dust.update(dt);
    motes.update(time, camPos.x);
    const localPlayer = coopRole === 'guest' ? (game.players[1] ?? p0) : p0;
    const isFlippedNow = playing && localPlayer.flipped > 0;
    if (isFlippedNow !== lastFlipped) {
      lastFlipped = isFlippedNow;
      hud.flipped(isFlippedNow);
    }

    const targetHemi = game.darkTimer > 0 ? 0.22 : 1.7;
    const targetSun = game.darkTimer > 0 ? 0.28 : 2.3;
    hemi.intensity += (targetHemi - hemi.intensity) * damp(10, dt);
    sun.intensity += (targetSun - sun.intensity) * damp(10, dt);

    const L = game.level;
    const isPortrait = innerWidth < innerHeight;
    const baseFov = isPortrait ? 44 : 38;
    const targetZ = (isPortrait ? Math.max(26, 15 / Math.max(0.45, camera.aspect)) : 14) + spreadZ;
    camPos.z += (targetZ - camPos.z) * damp(6, dt);
    const halfView = (isPortrait ? TAN_HALF_44 : TAN_HALF_38) * camPos.z * camera.aspect;
    const lo = Math.min(halfView - 1, L.W / 2), hi = Math.max(L.W - halfView + 1, L.W / 2);
    const rawTx = Math.max(lo, Math.min(hi, camFocusX));
    const tx = Math.abs(rawTx - camPos.x) > 0.35 ? rawTx : camPos.x;
    const joyLift = isCoarsePointer ? -0.95 : -0.35;
    const ty = Math.max(2.1, camFocusY + 1.4 + joyLift);
    camPos.x += (tx - camPos.x) * damp(5.5, dt);
    camPos.y += (ty + 1.4 - camPos.y) * damp(4.5, dt);

    trauma = Math.max(0, trauma - dt * 1.9);
    const shake = trauma * trauma * 0.42;
    const sx = shake > 0 ? Math.sin(time * 53) * shake : 0;
    const sy = shake > 0 ? Math.cos(time * 61) * shake * 0.7 : 0;

    fovPunch = Math.max(0, fovPunch - dt * 14);
    if (Math.abs(camera.fov - (baseFov - fovPunch)) > 0.05) {
      camera.fov = baseFov - fovPunch;
      camera.updateProjectionMatrix();
    }

    camera.position.set(camPos.x + sx, camPos.y + sy, camPos.z);
    camLook.set(camPos.x, camPos.y - 1.4, 0);
    camera.lookAt(camLook);
    const sunX = Math.round(camPos.x * 2) * 0.5;
    sun.position.set(sunX + 5, 14, 9);
    sun.target.position.set(sunX, 0, 0);
    rim.position.set(camPos.x - 4, 6, -9);
  }

  if (!document.hidden) renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
