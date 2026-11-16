# Unexpected Traps, Zero-Hint Fix & Full-Stack Polish Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate all red trap hint boxes on retries, add 5 psychological/unexpected traps (`L` Launch Floor, `A` Anti-Jump, `J` Gift Mimic, `E` Mirror Toy Robot, `Q` Peek-a-Boo Ghost) with 3 new Gemini+Meshy 3D GLB assets, weave them into Worlds 1–3 + a new unlocked **Mind Games (L31–L35)** showcase section, and apply UI/smoothness/controls/lighting polish across the codebase.

**Architecture:** Remove `killerTrapIndex` / `hintEdges` / `assistMode` completely so traps remain unspoiled across deaths. Add `L, A, J, E, Q` in `src/core/level.js` & `src/core/game.js` (keeping steady-state `step()` allocation-free & deterministic), enhance `src/core/physics.js` + `src/input.js` (snappier `accelAir`, fast-fall `down`, mobile thumb-slide touch pad, `Esc`/`M` map shortcut), upgrade 3D visuals in `src/render/world.js` & `src/render/momo.js` (contact drop-shadow disc beneath Momo, drifting ambient motes, parallax sky backdrop, moving-trap interpolation), and refine HUD/UI typography & SVG iconography per `impeccable` + `ui-ux-pro-max`.

**Tech Stack:** ES Modules, Three.js (`^0.170.0`), Vite, Vitest, Web Audio API, Gemini + Meshy + `gltf-transform`.

---

### Task 1: Generate & Compress 3 New 3D GLB Assets (`gift_box`, `toy_robot`, `cute_ghost`)
- Generate faceless pastel resin-toy reference PNGs in `assets/refs/`
- Convert via `node tools/meshy-image-to-3d.mjs <name> 5000 "no eyes, no face, glossy pastel resin toy"`
- Compress via `npx gltf-transform optimize assets/raw/<name>.glb public/models/<name>.glb --compress meshopt --texture-compress webp --texture-size 1024`
- Update `assets/ASSET_LIST.md`

### Task 2: Eliminate Red Trap Hint Boxes & Ghost Tell (`world.js`, `main.js`, `hud.js`, `index.html`, `save.js`)
- Remove `GEO.hintEdges`, `MAT.hint`, `SNEAKY`, `v.userData.hint`, `killerTrapIndex` pre-reveals, `ghostFloor` `tellPulse`, and `🛡️ Bharosa` assist UI.
- Ensure `invisibleBlock` renders ONLY when `tr.revealed` is true (never pre-revealed on 2nd attempt).

### Task 3: Controls, Physics & Unexpected Traps Core (`physics.js`, `level.js`, `game.js`, `input.js`)
- TDD tests in `src/core/game.test.js` for:
  - `L` (`launchFloor`): solid until stepped on, then rockets upward + flings Momo (`vy >= 19`).
  - `A` (`antiJump`): safe to walk across; pressing Jump nearby pops spikes on landing.
  - `J` (`giftTrap`): emits `'giftTrap'`, flips controls + knocks player backward.
  - `E` (`mimicRobot`): mirrors player horizontal steering and jumps when player jumps, falls in pits, kills on touch (`cause: 'robot'`).
  - `Q` (`booGhost`): creeps toward player when facing away, freezes (`shy: true`) when looked at, kills on touch (`cause: 'ghost'`).
  - `input.down` fast-fall & snappier `accelAir = 48`.
- Implement in `physics.js`, `level.js`, `game.js`, `input.js`.

### Task 4: Smoothness, Shaders/FX, Contact Drop-Shadow & Impeccable SVG UI (`world.js`, `momo.js`, `fx.js`, `audio.js`, `index.html`, `style.css`, `hud.js`, `main.js`)
- Add Momo contact drop-shadow disc ray/height projection (`world.js`/`momo.js`) for crisp 2.5D depth judgment.
- Add `createAmbientMotes()` fixed 28-particle pool (`fx.js`) + animated 3D parallax hills/factory/bakery sky backdrop shader (`world.js`) + moving-trap `prevX/prevY` render interpolation (`boulder`, `mimicRobot`, `booGhost`, `crusher`).
- Upgrade `index.html` & `style.css` per `impeccable` craft floor (consistent inline SVG icons instead of emojis, remove `.eyebrow` kickers, `tabular-nums`, soft diffused elevation, smooth touch swipe-pad, `Esc`/`M` map shortcut, crisp `fakeSave`/`giftTrap` SFX).

### Task 5: Showcase Levels 31–35 (Mind Games) + World 1–3 Integration + Bot Tests
- Add `world: 4` ("Mind Games" — unlocked from the start on the Diorama Map!) featuring Levels 31–35 (`Yeet Floor`, `Koodna Mana Hai`, `Surprise Gift`, `Mirror Robot`, `Peek-a-Boo`), plus weave `L`/`A`/`J`/`E`/`Q` into select World 1–3 levels (`L8`, `L10`, `L17`, `L19`, `L27`, `L30` or clean upgraded layouts).
- Update `levels.test.js` (`LEVELS.length === 35`) and `solutions.test.js` (naive death + 0-death solution for all 35 levels!).
- Sync `docs/GAME_DESIGN.md` & `Desktop/GAME_DESIGN.md`, run `npm test` + `npm run build` + live Playwright & visual Browser QA at `http://localhost:5173/`.
