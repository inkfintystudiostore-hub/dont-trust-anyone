/**
 * Lightweight binary packet encoder/decoder for high-frequency co-op messages
 * (`net_ping`, `net_pong`, `input`, `guest_state`) over WebRTC DataChannels.
 * Falls back to JSON when a message contains unexpected/complex fields.
 */

const TAG_PING = 1;
const TAG_PONG = 2;
const TAG_INPUT = 3;
const TAG_GUEST_STATE = 4;
function packInputFlags(inp) {
  let flags = 0;
  if (inp.left) flags |= 1;
  if (inp.right) flags |= 2;
  if (inp.jump) flags |= 4;
  if (inp.action) flags |= 8;
  if (inp.down) flags |= 16;
  return flags;
}

function unpackInputFlags(flags) {
  return {
    left: Boolean(flags & 1),
    right: Boolean(flags & 2),
    jump: Boolean(flags & 4),
    action: Boolean(flags & 8),
    down: Boolean(flags & 16),
  };
}

/**
 * Encodes a fast-path message into an ArrayBuffer.
 * Returns null if the message shape isn't supported by the binary fast-path.
 * @param {object} msg
 * @returns {ArrayBuffer | null}
 */
export function encodeFastPacket(msg) {
  if (!msg || typeof msg !== 'object') return null;

  if (msg.type === 'net_ping' && Number.isFinite(msg.t)) {
    const buf = new ArrayBuffer(9);
    const view = new DataView(buf);
    view.setUint8(0, TAG_PING);
    view.setFloat64(1, msg.t, true);
    return buf;
  }

  if (msg.type === 'net_pong' && Number.isFinite(msg.t)) {
    const buf = new ArrayBuffer(9);
    const view = new DataView(buf);
    view.setUint8(0, TAG_PONG);
    view.setFloat64(1, msg.t, true);
    return buf;
  }

  if (msg.type === 'input' && typeof msg.input === 'object' && msg.input !== null) {
    // Pack up to 4 redundant input frames (current + up to 3 previous) to survive packet loss
    const history = Array.isArray(msg.history) ? msg.history.slice(0, 3) : [];
    const count = 1 + history.length;
    const buf = new ArrayBuffer(6 + count);
    const view = new DataView(buf);
    view.setUint8(0, TAG_INPUT);
    view.setUint32(1, Number(msg.seq) >>> 0, true);
    view.setUint8(5, count);
    view.setUint8(6, packInputFlags(msg.input));
    for (let i = 0; i < history.length; i++) {
      view.setUint8(7 + i, packInputFlags(history[i] ?? {}));
    }
    return buf;
  }

  if (msg.type === 'guest_state' && msg.state && typeof msg.state === 'object') {
    const s = msg.state;
    // Only use fixed 26-byte layout when core numeric fields are present
    if (
      Number.isFinite(s.x) &&
      Number.isFinite(s.y) &&
      Number.isFinite(s.vx) &&
      Number.isFinite(s.vy)
    ) {
      const buf = new ArrayBuffer(26);
      const view = new DataView(buf);
      view.setUint8(0, TAG_GUEST_STATE);
      view.setUint32(1, Number(s.simTick ?? 0) >>> 0, true);
      view.setUint32(5, Number(s.ackSeq ?? 0) >>> 0, true);
      view.setFloat32(9, s.x, true);
      view.setFloat32(13, s.y, true);
      view.setFloat32(17, s.vx, true);
      view.setFloat32(21, s.vy, true);
      let flags = 0;
      if (s.grounded) flags |= 1;
      if (s.dead) flags |= 2;
      if (s.facing < 0) flags |= 4;
      view.setUint8(25, flags);
      return buf;
    }
  }

  return null;
}

/**
 * Decodes an ArrayBuffer fast-path packet back into a message object.
 * @param {ArrayBuffer} buf
 * @returns {object | null}
 */
export function decodeFastPacket(buf) {
  if (!(buf instanceof ArrayBuffer) || buf.byteLength < 1) return null;
  const view = new DataView(buf);
  const tag = view.getUint8(0);

  if (tag === TAG_PING && buf.byteLength === 9) {
    return { type: 'net_ping', t: view.getFloat64(1, true) };
  }

  if (tag === TAG_PONG && buf.byteLength === 9) {
    return { type: 'net_pong', t: view.getFloat64(1, true) };
  }

  if (tag === TAG_INPUT && buf.byteLength >= 7) {
    const seq = view.getUint32(1, true);
    const count = Math.min(4, Math.max(1, view.getUint8(5)));
    if (buf.byteLength !== 6 + count) return null;
    const input = unpackInputFlags(view.getUint8(6));
    const history = [];
    for (let i = 1; i < count; i++) {
      history.push(unpackInputFlags(view.getUint8(6 + i)));
    }
    return history.length > 0
      ? { type: 'input', seq, input, history }
      : { type: 'input', seq, input };
  }

  if (tag === TAG_GUEST_STATE && buf.byteLength === 26) {
    const flags = view.getUint8(25);
    return {
      type: 'guest_state',
      state: {
        simTick: view.getUint32(1, true),
        ackSeq: view.getUint32(5, true),
        x: view.getFloat32(9, true),
        y: view.getFloat32(13, true),
        vx: view.getFloat32(17, true),
        vy: view.getFloat32(21, true),
        grounded: Boolean(flags & 1),
        dead: Boolean(flags & 2),
        facing: flags & 4 ? -1 : 1,
      },
    };
  }

  return null;
}
