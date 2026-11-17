/**
 * Builds long Level Devil-style levels from one-screen "rooms" placed left to right.
 * A room is { rows, traps? }: rows top-first, bottom-aligned with the other rooms (shorter rooms are
 * padded with empty rows on top). Placeholders: 's' = start (P in the first room, else empty),
 * 'e' = room exit ('D' real door in the last room, otherwise empty or a fake door if exit: 'X').
 * Room trap configs `{ at: ch, ... }` apply only to that room's cells (turned into per-cell configs).
 *
 * @example
 * composeLevel({ name: 'l1.name', world: 1, rooms: [roomA, roomB] }) // -> raw level for parseLevel
 */
export function composeLevel({ rooms, traps = [], ...meta }) {
  const H = Math.max(...rooms.map((r) => r.rows.length));
  const out = Array.from({ length: H }, () => '');
  const cellTraps = [];
  const spans = []; // where each room sits, for per-room tools (co-op solver)
  rooms.forEach((room, ri) => {
    const w = Math.max(...room.rows.map((r) => r.length));
    const pad = H - room.rows.length;
    const rows = [...Array(pad).fill(''), ...room.rows].map((r) => r.padEnd(w, '.'));
    const last = ri === rooms.length - 1;
    const x0 = out[0].length;
    const exitX = rows.reduce((at, r) => (at >= 0 ? at : r.indexOf('e')), -1);
    spans.push({ id: room.id ?? null, x0, w, exitX: x0 + exitX + 0.5, last, script: room.script ?? null });
    rows.forEach((r, i) => {
      let s = r.replace(/s/g, ri === 0 ? 'P' : '.');
      s = s.replace(/e/g, last ? 'D' : (room.exit === 'X' ? 'X' : '.'));
      out[i] += s;
    });
    // column-specific configs ({ at, x }) first: the first matching per-cell config wins in parseLevel
    const cfgs = [...(room.traps ?? [])].sort((a, b) => (b.x !== undefined) - (a.x !== undefined));
    for (const cfg of cfgs) {
      if (cfg.at === 'D') { if (last) traps = [...traps, cfg]; continue; }
      const { x: onlyX, ...rest } = cfg;
      rows.forEach((r, i) => {
        for (let x = 0; x < r.length; x++) {
          if (r[x] === cfg.at && (onlyX === undefined || x === onlyX)) cellTraps.push({ ...rest, cell: [x0 + x, H - 1 - i] });
        }
      });
    }
  });
  return { ...meta, rows: out, traps: [...traps, ...cellTraps], spans };
}
