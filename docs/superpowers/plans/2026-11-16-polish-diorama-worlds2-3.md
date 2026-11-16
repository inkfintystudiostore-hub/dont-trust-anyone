# Polish, 3D Diorama & Worlds 2–3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Parts 1, 2, and 4 from the roadmap: smooth 120Hz interpolation & juice, shaders/hints, procedural music + SFX, persistent save + 3D diorama map, all remaining §5.7 traps, World 2 (Levels 11–20) + World 3 (Levels 21–30) with bot fairness proofs, and synchronized GDDs.

**Architecture:** Keep `src/core/` pure, deterministic (`1/60`s fixed step), and allocation-free on steady-state frames while adding inverted gravity (`gravDir = -1`), conveyor/slow modifiers, and 11 new traps (`>`, `<`, `M`, `V`, `O`, `U`, `Y`, `Z`, `W`, `K`, `N`). Layer render interpolation, trauma camera shake, hit-stop, per-world palettes/fog, dust pool, diorama map (`src/render/diorama.js`), `localStorage` save (`src/save.js`), and procedural Web Audio music in `src/` without breaking `prefers-reduced-motion` or the `< 15 MB` budget.

**Tech Stack:** ES Modules, Three.js (`^0.170.0`), Vite (`^6.0.7`), Vitest (`^2.1.8`), Web Audio API, LocalStorage.

**Spec:** [GAME_DESIGN.md](../../../docs/GAME_DESIGN.md) & [GAME_PLAN.md](../../../GAME_PLAN.md)

## Global Constraints

- Pure `src/core/` with zero DOM/Three.js imports and zero RNG deaths.
- All 30 levels verified in `src/core/solutions.test.js`: naive player dies on each level's trap AND 0-death solution wins cleanly.
- All player-facing Hinglish strings stay in `src/i18n.js`; `prefers-reduced-motion` disables camera shake and UI motion.
- Keep `docs/GAME_DESIGN.md` and `c:\Users\user\Desktop\GAME_DESIGN.md` in sync after completion.

## Review Focus

- Inverted gravity (`gravDir = -1`) colliding wrongly with floor vs ceiling or leaving `onGround` stuck -> pinned to Task 2 (`game.test.js` ceiling walk & downward jump test).
- `step()` per-frame render interpolation leaving `prevX/prevY` stale on respawn or level load -> pinned to Task 1 (`game.test.js` `prevX/prevY` reset test).
- Rolling boulder (`O`) / Boxing glove (`V`) / Crusher (`M`) failing to reset position/state on death/respawn -> pinned to Task 1 (`game.test.js` reset tests).
- Save persistence (`src/save.js`) crashing in restricted environments (`localStorage` missing/throw) or corrupt JSON -> pinned to Task 4 (`save.test.js` fallback tests).
- Levels 11–30 introducing impossible gaps or unfair precision windows (`< 0.12s`) -> pinned to Task 5 (`solutions.test.js` L11–L30 naive + 0-death tests).

---

### Task 1: Physics Modifiers & World 2 Traps (`>`, `<`, `M`, `V`, `O`, `U`) + Interpolation Snapshots

**Files:**
- Modify: `src/core/physics.js`
- Modify: `src/core/level.js`
- Modify: `src/core/game.js`
- Test: `src/core/game.test.js`

- [ ] **Step 1: Write failing tests in `src/core/game.test.js` for conveyor, crusher, boxing glove, boulder, controls flip, `killerTrapIndex`, and `prevX/prevY` reset**
- [ ] **Step 2: Run `npm test` to confirm RED**
- [ ] **Step 3: Implement physics modifiers (`speedMul`, `jumpMul`, `beltVx`) in `physics.js`, `TRAP_BUILDERS` + `world` in `level.js`, and trap updates/resets in `game.js`**
- [ ] **Step 4: Run `npm test` to confirm GREEN**

---

### Task 2: Inverted Gravity & World 3 Traps (`Y`, `Z`, `W`, `K`, `N`)

**Files:**
- Modify: `src/core/physics.js`
- Modify: `src/core/level.js`
- Modify: `src/core/game.js`
- Test: `src/core/game.test.js`

- [ ] **Step 1: Write failing tests in `src/core/game.test.js` for `gravDir = -1` ceiling movement/jumping + upper pit death, `Y` gravity flip, `Z` slow floor, `W` sneeze cloud push, `K` fake checkpoint `fakeSave`, and `N` dark candle**
- [ ] **Step 2: Run `npm test` to confirm RED**
- [ ] **Step 3: Implement `gravDir` support in `physics.js` and `Y/Z/W/K/N` in `level.js` + `game.js`**
- [ ] **Step 4: Run `npm test` to confirm GREEN**

---

### Task 3: 3D Visuals, World Themes, Animations, FX Dust Pool & Upgraded Web Audio

**Files:**
- Modify: `src/render/world.js`
- Modify: `src/render/momo.js`
- Modify: `src/render/fx.js`
- Modify: `src/audio.js`

- [ ] **Step 1: Add per-world themes (Candy Meadow / Toy Factory / Haunted Bakery), trap meshes (`>`, `<`, `M`, `V`, `O`, `W`, `K`, `U`, `Y`, `Z`, `N`), `darwaza` procedural eyes, ghost-floor tell, and `killerTrapIndex` / `assist` crimson outline glow in `world.js`**
- [ ] **Step 2: Upgrade `momo.js` (`1 - exp(-k*dt)`, eye lag, idle sit/sleep gags, upside-down flip, pancake crush & pit stretch)**
- [ ] **Step 3: Add `createDust()` fixed pool to `fx.js` and trap SFX + bouncy per-world Web Audio music loop + death ducking + mute to `audio.js`**
- [ ] **Step 4: Run `npm test && npm run build` to verify clean compilation**

---

### Task 4: Smoothness, Save Persistence, 3D Diorama Map, Iris Wipe, Assist & Mobile UX

**Files:**
- Create: `src/save.js`, `src/save.test.js`, `src/render/diorama.js`
- Modify: `index.html`, `src/style.css`, `src/ui/hud.js`, `src/main.js`, `src/i18n.js`

- [ ] **Step 1: Write failing tests in `src/save.test.js` for progress saving, best deaths tracking, corrupt JSON fallback, and storage-unavailable fallback**
- [ ] **Step 2: Implement `src/save.js` and run `npm test` to verify GREEN**
- [ ] **Step 3: Build `src/render/diorama.js` (interactive 30-node tabletop 3D world map across 3 islands with death badges & flying pigeon)**
- [ ] **Step 4: Update `index.html`, `src/style.css`, `src/ui/hud.js`, `src/i18n.js`, and `src/main.js` (120Hz interpolation, 80ms hit-stop, trauma camera shake + dead-zone + FOV punch, dark-candle lighting, iris wipe, crack banner, restart/mute/map/assist HUD buttons, portrait hint)**
- [ ] **Step 5: Run `npm test && npm run build` to verify**

---

### Task 5: World 2 (Levels 11–20) & World 3 (Levels 21–30) + Bot Fairness Proofs

**Files:**
- Modify: `src/levels.js`
- Modify: `src/i18n.js`
- Modify: `src/core/levels.test.js`
- Modify: `src/core/solutions.test.js`

- [ ] **Step 1: Update `levels.test.js` (`LEVELS.length === 30`) and add failing naive-death & 0-death bot tests for Levels 11–30 in `solutions.test.js`**
- [ ] **Step 2: Run `npm test` to verify RED**
- [ ] **Step 3: Author Levels 11–20 (Toy Factory) and 21–30 (Haunted Bakery) in `src/levels.js` and Hinglish strings in `src/i18n.js`**
- [ ] **Step 4: Run `npm test && npm run build` to verify all 30 levels pass naive-trap & 0-death fairness tests**

---

### Task 6: Sync GDDs & Full End-to-End Verification

**Files:**
- Modify: `docs/GAME_DESIGN.md`, `c:\Users\user\Desktop\GAME_DESIGN.md`

- [ ] **Step 1: Sync both GDD files with all implemented features, 30 levels, controls, traps, and §15 decisions**
- [ ] **Step 2: Run `npm test` and `npm run build` after final edit**
- [ ] **Step 3: Playtest in live Chromium (`browser` subagent) across Diorama Map, World 1, World 2, World 3, and 375px mobile viewport**
