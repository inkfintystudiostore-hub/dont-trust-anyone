# Couples Co-op Coordination, New 3D Assets, Virtual Joystick & Fullscreen Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development, superpowers:code-review, and superpowers:verification-before-completion.

**Goal:** Upgrade Don't Trust Anyone with always-fullscreen support, a smooth mobile virtual analog joystick, 2 new Meshy 3D coordination assets (`golden_key.glb`, `ticking_bomb.glb`), 4 new interactive coordination mechanics (collectible Keys `*`, channel A/B hold plates & hazard gates `H`/`=`, `h`/`-`, coupled Bomb defusal `@`), and 7 dedicated Couples Co-op Coordination levels (`L36–L42`, `world: 5`), then review and re-deploy both the game Worker and `inkfinitystudio.store/game-room`.

**Architecture:** Extend `src/core/level.js` & `src/core/game.js` with pure deterministic state for Keys (`keyItem`), Hold Plates & Hazard Barriers (`plateA`/`gateA`, `plateB`/`gateB`), and Coupled Bombs (`bomb`), keeping solo `L1–L35` intact while enabling 7 true dual-player coordination puzzles in `L36–L42`. Extend `src/input.js` with analog `moveX` (`-1..1`) driven by an Inkfinity-styled virtual joystick on `#touch`. Add `src/utils/fullscreen.js` matching 3D Ludo's fullscreen manager and expose container fullscreen controls in `GameRoomPage.tsx`.

**Spec:** User request (16 Nov 2026) + [docs/GAME_DESIGN.md](file:///c:/Users/user/DONT%20TRUST%20ANYONE/docs/GAME_DESIGN.md).

## Global Constraints
- Shared fate preserved: any player dying in a trap/bomb/hazard restarts both together.
- Dual clear preserved: door requires ALL keys collected AND BOTH players safely reaching the door.
- Zero red trap hint boxes anywhere (`world.js` invariant).
- All 3D models follow faceless stylized pastel resin-toy art direction, compressed with meshopt + WebP 1024 (`public/models/*.glb`).
- Full code review pass before final live deploy on `dont-trust-anyone.inkfintystudio-store.workers.dev` and `inkfinitystudio.store/game-room`.

---

### Task 1: Generate & Compress 2 New 3D Assets (`golden_key.glb`, `ticking_bomb.glb`)
- [ ] Generate `assets/refs/golden_key.png` via `image-generator` (faceless glossy gold resin toy key, rounded bow), convert via `tools/meshy-image-to-3d.mjs`, optimize via `gltf-transform` to `public/models/golden_key.glb`.
- [ ] Generate `assets/refs/ticking_bomb.png` via `image-generator` (faceless stylized matte charcoal sphere bomb with brass collar and glowing fuse tip), convert via `tools/meshy-image-to-3d.mjs`, optimize to `public/models/ticking_bomb.glb`.
- [ ] Update `assets/ASSET_LIST.md`.

### Task 2: Pure Co-op Coordination Traps & Analog `moveX` Physics (TDD)
- [ ] Write failing TDD tests in `src/core/coop.test.js` covering:
  1. Analog `moveX` (`0.5` half-speed vs `1.0` full speed) smoothly steers character without breaking discrete `-1/0/1` tests.
  2. Collectible key (`*`): Door stays locked (`!doorUnlocked`) and touching Door does NOT finish/lock `atDoor` until all `*` keys in the level are collected (`keysLeft === 0`).
  3. Linked Plate `H` & Hazard Gate `=`: Gate `=` kills any player touching it while `H` is unpressed; holding any player ON `H` deactivates `=` so partner can walk cleanly across; leaving `H` reactivates `=`. Same symmetrically for `h` & `-`.
  4. Paired Bomb `@`: Fuse ticks down once active; standing adjacent to `@` fills `defuse` (`>= 1`) while partner holds `H` (or dual-defuse when no `H` exists); reaching `1` defuses permanently (`state = 'defused'`); fuse reaching `0` kills both (`cause: 'bomb'`).
  5. `exportCoopSnapshot` / `applyCoopSnapshot` syncs `keys`, `plateA/B`, `gates`, and `bomb` timer/defuse progress cleanly.
- [ ] Run `npm test` (confirm RED).
- [ ] Implement in `src/core/physics.js`, `src/core/level.js`, `src/core/game.js`.
- [ ] Run `npm test` (confirm GREEN).

### Task 3: Author 7 Creative Couples Coordination Levels (`L36–L42`, World 5) + Dual-Bot Proof
- [ ] Design `L36–L42` (`world: 5`) with progressive Teach -> Test -> Twist coordination mechanics (Keys, Hold Plate Handoffs, Overhead Trap Shielding, Bomb Defusal Under Pressure, Gift/Ghost Split, Twin Keys Maze, Couples Grand Finale).
- [ ] Add Hinglish dialogues/signs/taunts to `src/i18n.js` and 2-player bot solution tests (`src/core/coopSolutions.test.js`) proving each level fails if one player doesn't cooperate and passes with `0` deaths when coordinated.
- [ ] Run `npm test` (confirm GREEN).

### Task 4: Smooth Virtual Joystick, Always Fullscreen, 3D Trap Visuals & Lobby Default
- [ ] Add `src/utils/fullscreen.js` (`requestGameFullscreen`, `toggleGameFullscreen`, `isInFullscreen`, `subscribeFullscreenChange`) + HUD fullscreen toggle button & auto-fullscreen on play/action clicks.
- [ ] Replace touch L/R arrows with a smooth anchored **Virtual Analog Joystick** in `index.html`, `src/style.css`, and `src/input.js` (`moveX`, `down` fast-fall via pull-down, crisp puck spring physics + visual directional rim).
- [ ] Render `golden_key.glb`, `ticking_bomb.glb` (with glowing countdown fuse ring & defuse meter), `H`/`h` Crimson/Mint pressure pads, and `=`/`-` glowing laser/spike barriers in `src/render/world.js` + World 5 theme & 5th Diorama island (`diorama.js`).
- [ ] Add crisp Web Audio cues (`sfx.key()`, `sfx.gateOpen()`, `sfx.bombTick()`, `sfx.defuse()`, `sfx.boom()`) in `src/audio.js`.
- [ ] Wire `coopOnly` World 5 prompt on solo Map (jumping directly to Host Co-op on that level) and default Co-op Lobby to L36 (`Couples Co-op 1`) while allowing all `L1–L42`.

### Task 5: Fullscreen Store Wrapper, Code Review, Deploy & End-to-End Verification
- [ ] Upgrade `GameRoomPage.tsx` in `INKFINITY STORE` with Fullscreen button on each game header + full-bleed responsive sizing (`allow="clipboard-write; fullscreen"`).
- [ ] Run `code-reviewer` pass + fix any issues found.
- [ ] Run `npm test` & `npm run build` in both repos, deploy `dont-trust-anyone` Worker (`npx wrangler deploy`) and push + deploy `inkfinity-store` (`npm run deploy`).
- [ ] Verify live `https://dont-trust-anyone.inkfintystudio-store.workers.dev` and `https://inkfinitystudio.store/game-room` end-to-end (including 2-tab Co-op L36 & joystick/fullscreen checks).
