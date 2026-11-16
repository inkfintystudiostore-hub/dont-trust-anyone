# Two-Player Online Co-op & Cloudflare Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development and superpowers:verification-before-completion. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activate 2-player online co-op mode (Momo + Mimi) with shared-fate trap restarts and dual-clear door completion, powered by a Cloudflare Worker + Hibernatable SQLite Durable Object WebSocket server deployed to `*.workers.dev`.

**Architecture:** Extend `src/core/game.js` cleanly with multi-player (`coop: true`) simulation so both players share traps, trigger shared-fate death restarts if either dies, and only win when both reach the exit door without any mistakes. Mirror Chibi Ludo 3D's Cloudflare Worker (`/api/rooms/reserve`, `/ws/room/:code`, Hibernatable SQLite Durable Object, `FRAME_ANCESTORS_CSP` for `inkfinitystudio.store`) in `worker/` with pure room state logic unit-tested via Vitest. Wire P2 (`mimi.glb`), dual camera framing, `?room=` invite links, and the Inkfinity Co-op Room Modal in `src/`.

**Tech Stack:** Three.js (`0.170.0`), Vite (`6.0.7`), Vitest (`2.1.8`), Cloudflare Workers + Durable Objects (`wrangler`), WebSockets.

**Spec:** User request + [docs/GAME_DESIGN.md](file:///c:/Users/user/DONT%20TRUST%20ANYONE/docs/GAME_DESIGN.md) Sections 1.2, 5.8 + `D:\3D LUDO` reference architecture.

## Global Constraints
- Shared fate: If either player dies in any trap/pit/hazard, the level restarts for BOTH players together.
- Dual clear: Both players must reach the exit door cleanly without either dying to complete the level.
- Zero red trap hint boxes anywhere in solo or co-op (`world.js` invariant preserved).
- Zero DOM / Three.js / WebSocket imports inside `src/core/`.
- Worker CSP must permit framing from `https://inkfinitystudio.store` and `https://www.inkfinitystudio.store`.

## Review Focus
- `runningDoor` edge case in co-op: entering a door that still has remaining `stops` must NOT lock `atDoor = true` early.
- Shared fate when P1 is already waiting safely at the door and P2 dies on a trap: P1's `atDoor` resets and both restart cleanly.
- Guest client reaching 9-digit `?room=XXXXXXXXX` link directly on page load auto-opens lobby and connects as Mimi.
- 3rd player joining a full 2P room gets rejected cleanly (`4003`); expired/nonexistent room on join gets `4004`.
- Host leaving or disconnecting notifies Guest gracefully instead of leaving frozen simulation.

---

### Task 1: Dual-Player Co-op Physics & Rules (`src/core/game.js` + `src/core/coop.test.js`)
- [ ] Write failing TDD tests in `src/core/coop.test.js` covering:
  1. `createGame(levels, 0, { coop: true })` spawns 2 distinct players (`Momo` at index 0, `Mimi` at index 1).
  2. Shared traps: P2 stepping on `fallingFloor` / `launchFloor` or jumping near `antiJump` triggers the trap in the shared level for both.
  3. Shared fate: if P1 reaches door (`atDoor: true`) and waits while P2 dies on spikes/fallingFloor/pit, `g.dead === true` triggers for the whole match and `resetLevel` restarts BOTH players cleanly (`atDoor === false`).
  4. Dual clear: if ONLY P1 reaches a stationary door, `win` does NOT fire (`g.finished === false`, `g.levelIndex === 0`); when BOTH reach the door, `win` advances BOTH to next level (or finishes).
  5. `runningDoor` protection: while door still has `stops`, reaching it triggers the run and does not set `atDoor`.
  6. Compact state serialization/application helpers (`exportCoopSnapshot` / `applyCoopSnapshot`) round-trip player, door, timer, and trap visual states without allocations on solo hot path.
- [ ] Run `npm test` and watch `coop.test.js` fail (RED).
- [ ] Implement co-op support in `src/core/game.js` reusing existing `movePlayer`, `updateTraps`, and `checkHazards`.
- [ ] Run `npm test` and confirm all tests pass (GREEN).

### Task 2: Pure Durable Object Room State Machine (`worker/roomLogic.js` + `worker/roomLogic.test.js` + `src/net/roomCode.js` + `src/net/roomCode.test.js`)
- [ ] Write failing TDD tests for `roomCode.js` (`formatRoomCode`, `parseRoomCodeInput` with raw/hyphenated/URL inputs) and `worker/roomLogic.js` (reserve/occupy, 2-seat cap host/guest, 3rd player rejection, deviceId reclaim on refresh, level select, start match, relay permissions: only guest sends `input`, only host sends `state`/`event`, idle TTL expiry).
- [ ] Run `npm test` to confirm RED.
- [ ] Implement `src/net/roomCode.js` and `worker/roomLogic.js`.
- [ ] Run `npm test` to confirm GREEN.

### Task 3: Cloudflare Worker + Durable Object Entry (`worker/index.js` + `wrangler.toml` + `vite.config.js`)
- [ ] Create `wrangler.toml` (`name = "dont-trust-anyone"`, Durable Object binding `GAME_ROOM` -> `DontTrustRoomDO`, SQLite migration `v1`, `workers_dev = true`, `assets = ./dist`).
- [ ] Implement `worker/index.js` with Hibernatable WebSockets (`ctx.acceptWebSocket`, attachment serialization, alarm expiry/cleanup), `POST /api/rooms/reserve`, `GET /ws/room/:code`, `GET /api/health`, CORS headers, and `FRAME_ANCESTORS_CSP`.
- [ ] Add `/ws` and `/api` dev proxy + `worker:dev` script if needed.

### Task 4: Frontend Co-op WebSocket Client, Dual Rendering, Lobby UI & i18n (`src/net/coopClient.js`, `src/ui/lobby.js`, `src/render/world.js`, `src/main.js`, `index.html`, `src/style.css`, `src/i18n.js`)
- [ ] Implement `src/net/coopClient.js` (heartbeat ping/pong, auto-reconnect, host/guest transport, `?room=` URL helpers).
- [ ] Upgrade `src/render/world.js` `update()` to project contact drop-shadow discs for ALL players (`g.players` / array of discs pooled once per world, zero hint boxes).
- [ ] Create Co-op Room Modal (`index.html`, `src/style.css`, `src/ui/lobby.js`) enabling `"Dost ke saath"` button with Create Room, 9-digit code display, Copy Invite Link, Join Code input, World 1–4 level selector, and 2-player ready roster (`Momo` + `Mimi`).
- [ ] Wire `mimi.glb` (`createMomo(models.mimi)`), Host 60 Hz sync + Guest prediction/interpolation, dual-framing camera, shared-fate death banner, door-waiting indicator, and emote/restart sync in `src/main.js`.

### Task 5: Deploy Cloudflare Worker & Full Verification
- [ ] Run `npm test` (confirm 100% pass across all solo + co-op + worker tests).
- [ ] Run `npm run build` and deploy via `npx wrangler deploy`.
- [ ] Verify live `https://dont-trust-anyone.inkfintystudio-store.workers.dev/api/health`, `POST /api/rooms/reserve`, and end-to-end 2-player WebSocket + browser co-op session (`death` restarts both, both reaching door wins, 0 console errors), plus keep local `http://localhost:5173/` running cleanly.
