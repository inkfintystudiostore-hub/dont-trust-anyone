/**
 * Co-op Room Lobby UI controller: manages Create/Join tabs, 9-digit invite links,
 * live 2-seat roster, and WebSocket lifecycle. Co-op runs always begin at Level 1.
 */
import { buildRoomShareUrl, formatRoomCode, parseRoomCodeInput } from '../net/roomCode.js';
import { createCoopSession, loadCoopName, reserveCoopRoom, saveCoopName } from '../net/coopClient.js';
import { t } from '../i18n.js';

const $ = (id) => document.getElementById(id);

export function createCoopLobby(_levels, callbacks) {
  let tab = 'create';
  let currentCode = null;
  let latestSnapshot = null;
  let copyTimer = 0;
  let reserveSeq = 0;

  $('coop-name').value = loadCoopName();

  const session = createCoopSession({
    onStatus(kind, message) {
      $('coop-status').textContent = message;
      if (kind === 'rejected') {
        currentCode = null;
        latestSnapshot = null;
        $('coop-code').textContent = '--- --- ---';
        renderRoster(null);
      }
    },
    onSnapshot(snap) {
      latestSnapshot = snap;
      currentCode = snap.code;
      $('coop-code').textContent = formatRoomCode(snap.code);
      renderRoster(snap);
      callbacks.onSnapshot?.(snap);
      if (snap.started && !$('coop').hidden) {
        $('coop').hidden = true;
        callbacks.onMatchStart?.(snap.levelIndex, snap);
      }
    },
    onStarted(levelIndex) {
      $('coop').hidden = true;
      callbacks.onMatchStart?.(levelIndex, latestSnapshot);
    },
    onGuestInput: callbacks.onGuestInput,
    onStateSync: callbacks.onStateSync,
    onEventSync: callbacks.onEventSync,
    onRestart: callbacks.onRestart,
    onEmote: callbacks.onEmote,
    onPeerLeft() {
      $('coop-status').textContent = t('coop.waitP2');
      callbacks.onPeerLeft?.();
    },
    onRoomClosed(reason, message) {
      currentCode = null;
      latestSnapshot = null;
      $('coop-code').textContent = '--- --- ---';
      renderRoster(null);
      $('coop-status').textContent = message || 'Room closed.';
      callbacks.onRoomClosed?.(reason, message);
    },
    onError(msg) {
      $('coop-status').textContent = msg;
    },
  });

  function renderRoster(snap) {
    const rosterEl = $('coop-roster');
    rosterEl.innerHTML = '';
    const seats = snap?.seats ?? [
      { seat: 0, character: 'momo', occupant: 'human', playerName: $('coop-name').value.trim() || 'Momo (Host)', connected: true },
      { seat: 1, character: 'mimi', occupant: 'open', playerName: 'Waiting…', connected: false },
    ];
    for (const s of seats) {
      const card = document.createElement('div');
      const isMe = snap ? snap.yourSeat === s.seat : (tab === 'create' && s.seat === 0);
      card.className = `seat-card${isMe ? ' me' : ''}`;
      const dot = document.createElement('span');
      dot.className = `seat-dot${s.occupant === 'human' && s.connected ? ' on' : ''}`;
      const info = document.createElement('div');
      const nameDiv = document.createElement('div');
      nameDiv.textContent = s.occupant === 'human' ? s.playerName : 'Waiting…';
      const meta = document.createElement('div');
      meta.className = 'seat-meta';
      const statusTxt = s.occupant === 'human' ? (s.connected ? 'Online' : 'Offline') : 'Open';
      meta.textContent = `${s.seat === 0 ? 'P1 Momo' : 'P2 Mimi'} · ${statusTxt}${isMe ? ' · YOU' : ''}`;
      info.append(nameDiv, meta);
      card.append(dot, info);
      rosterEl.appendChild(card);
    }

    const bothConnected = Boolean(snap?.seats?.every((s) => s.occupant === 'human' && s.connected));
    const isHost = snap ? snap.isHost : tab === 'create';
    const startBtn = $('coop-start');
    startBtn.hidden = !isHost;
    startBtn.disabled = !bothConnected || !snap;
    if (snap && !snap.started) {
      if (isHost) $('coop-status').textContent = bothConnected ? t('coop.readyP2') : t('coop.waitP2');
      else $('coop-status').textContent = t('coop.waitHost');
    }
  }

  function setTab(nextTab) {
    tab = nextTab;
    $('coop-tab-create').classList.toggle('on', tab === 'create');
    $('coop-tab-join').classList.toggle('on', tab === 'join');
    $('coop-create-pane').hidden = tab !== 'create';
    $('coop-join-pane').hidden = tab !== 'join';
    renderRoster(latestSnapshot);
  }

  async function hostNewRoom() {
    const reqId = ++reserveSeq;
    if (currentCode || session.isConnected()) session.leave();
    latestSnapshot = null;
    currentCode = null;
    setTab('create');
    $('coop-code').textContent = '…';
    $('coop-status').textContent = 'Reserving 9-digit room…';
    const res = await reserveCoopRoom(0);
    if (reqId !== reserveSeq || $('coop').hidden || tab !== 'create') return;
    if (!res.ok) {
      $('coop-code').textContent = '--- --- ---';
      $('coop-status').textContent = res.error;
      return;
    }
    currentCode = res.code;
    $('coop-code').textContent = formatRoomCode(res.code);
    session.connect({
      code: res.code,
      role: 'host',
      levelIndex: 0,
      playerName: $('coop-name').value.trim(),
    });
  }

  function joinByCode(rawInput) {
    const clean = parseRoomCodeInput(rawInput);
    if (!clean) {
      $('coop-status').textContent = 'Valid 9-digit code ya invite link daalo.';
      return;
    }
    reserveSeq++;
    if (currentCode && currentCode !== clean) {
      session.leave();
      latestSnapshot = null;
      currentCode = null;
    }
    setTab('join');
    $('coop-join-input').value = formatRoomCode(clean);
    session.connect({
      code: clean,
      role: 'guest',
      playerName: $('coop-name').value.trim(),
    });
  }

  async function copyText(btn, text, origLabel) {
    try {
      await navigator.clipboard.writeText(text);
      clearTimeout(copyTimer);
      btn.textContent = 'Copied!';
      copyTimer = setTimeout(() => { btn.textContent = origLabel; }, 1600);
    } catch {
      $('coop-status').textContent = text;
    }
  }

  $('coop-tab-create').addEventListener('click', () => {
    if (tab !== 'create') hostNewRoom();
  });
  $('coop-tab-join').addEventListener('click', () => {
    if (tab === 'join') return;
    reserveSeq++;
    if (currentCode || session.isConnected()) {
      session.leave();
      latestSnapshot = null;
      currentCode = null;
      $('coop-code').textContent = '--- --- ---';
    }
    setTab('join');
    $('coop-status').textContent = '';
  });
  $('coop-name').addEventListener('change', () => {
    const name = $('coop-name').value.trim();
    saveCoopName(name);
    if (session.isConnected()) session.setName(name);
  });
  $('coop-copy-code').addEventListener('click', () => {
    if (currentCode) copyText($('coop-copy-code'), formatRoomCode(currentCode), t('coop.copyCode'));
  });
  $('coop-copy-link').addEventListener('click', () => {
    if (currentCode) copyText($('coop-copy-link'), buildRoomShareUrl(currentCode), t('coop.copyLink'));
  });
  $('coop-join-btn').addEventListener('click', () => joinByCode($('coop-join-input').value));
  $('coop-join-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      joinByCode($('coop-join-input').value);
    }
  });
  $('coop-start').addEventListener('click', () => session.startMatch(0));
  $('coop-close').addEventListener('click', () => {
    $('coop').hidden = true;
    session.leave();
    latestSnapshot = null;
    currentCode = null;
    callbacks.onClosed?.();
  });

  return {
    openCreate() {
      $('coop').hidden = false;
      $('coop-name').focus();
      hostNewRoom();
    },
    openJoin(prefillCode) {
      $('coop').hidden = false;
      $('coop-name').focus();
      joinByCode(prefillCode);
    },
    session,
    getSnapshot: () => latestSnapshot,
    close() { $('coop').hidden = true; },
  };
}
