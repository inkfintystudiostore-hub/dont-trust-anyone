# Progressive Difficulty, Unexpectedly Funny Traps & Character Animations Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-architect all 42 levels (`L1–L42`) onto a strictly progressive difficulty curve, add 5 unexpectedly funny/co-op traps (`springTrap !`, `magnetOrb %`, `pieCannon $`, `discoFloor ~`, `syncPlate +`), and give Momo & Mimi hilarious custom character animations for every trap and death cause.

**Architecture:** Deterministic trap rules in `src/core/level.js` and `src/core/game.js` emit clean trap/effect events and state fields (`pieTimer`, `danceTimer`, `pullFx`, `springLaunch`), rendered at 60–144 Hz via `dt`-independent procedural animation in `src/render/momo.js` and Meshy GLB props in `src/render/world.js` (zero red trap hint wireframes). Every level & trap is gated by automated `vitest` solver tests (`>= 0.12s` timing windows).

**Tech Stack:** Vanilla ES Modules, Three.js (`GLTFLoader` + `MeshoptDecoder`), Vitest, Meshy v2 Text-to-3D API, `@gltf-transform/cli`, Cloudflare Workers + Durable Objects.

**Spec:** `docs/GAME_DESIGN.md` & user progressive-difficulty + animation brief (16 Nov 2026).

## Global Constraints
- Zero red trap hint wireframes or pre-reveals anywhere in `src/render/world.js` or HUD.
- Keep `src/core/` completely free of DOM, Three.js, or WebSocket imports.
- Every level `L1–L42` must remain deterministic at `60 Hz` (`1/60s`) with `>= 0.12s` precision timing windows.
- Solo Mode plays `L1–L35` (`L36–L42` locked); 2-Player Co-op always starts at `L1` and clears all `L1–L42` together.
- Every new GLB asset must stay `<= 4,500` triangles and `<= 150 KB` after `gltf-transform optimize --compress meshopt --texture-compress webp --texture-size 1024`.

## Review Focus
- `springTrap` (`!`) & `pieCannon` (`$`) in Co-op must have cooldowns/per-player resets so Player 2 is never soft-locked.
- `magnetOrb` (`%`) pull and `pieCannon` knockback must never clip players through `#` walls.
- `momo.js` `reset()` must cleanly clear all new animation timers/rotations/eye offsets on respawn so animations never stick across attempts.
- `syncPlate` (`+`) and `discoFloor` (`~`) states must serialize cleanly in `exportCoopSnapshot` / `applyCoopSnapshot`.

---

## Exact Skill Usage Schedule

| Step / Phase | Installed Skill(s) Used | Exact Role in Workflow |
|---|---|---|
| **Phase 1: Curve Audit** | `balance-check`, `design-review` | Audit `L1–L42` hazard density, reaction delays, and `>= 0.12s` precision windows before editing |
| **Phase 2: 3D Assets** | `3d-asset-generation` | Generate `spring_pad.glb`, `magnet_orb.glb`, `pie_cannon.glb` via Meshy, verify face-free thumbnails, optimize GLBs, log in `assets/ASSET_LIST.md` |
| **Phase 3: Core Rules (TDD)** | `test-driven-development`, `surgical-patch` | Write failing physics/co-op tests first for `!`, `%`, `$`, `~`, `+`, then implement cleanly in `level.js` & `game.js` |
| **Phase 4: Character Anims** | `threejs-animation`, `character-animation-qa` | Implement `dt`-independent comedy trap & death animations in `momo.js`, verify clean `reset()` & frame sampling |
| **Phase 5: Level Redesign** | `team-level` | Re-sequence & escalate `L1–L42` in `src/levels.js` + `src/i18n.js`, prove every level via `solutions.test.js` & `coopSolutions.test.js` |
| **Phase 6: QA & Deploy** | `code-reviewer`, `verification-before-completion` | Code review, `npm test && npm run build`, Cloudflare Worker deploy, and live multi-tab browser QA |

---

## New Unexpectedly Funny & Co-op Traps + Meshy Asset Budgets

| Trap | Char | Meshy Asset | Target Tris / Size | Funny Gameplay & Co-op Twist |
|---|---|---|---|---|
| **Spring Trap Floor** | `!` | `public/models/spring_pad.glb` | ~3,500 tris / ~90 KB | Disguised normal tile -> `0.08s` later BOINGS skyward (`vy=21.5`) into ceiling `^` unless fast-falling (`↓`) or jumping over; Co-op `H` pins it down |
| **Magnet Pull Orb** | `%` | `public/models/magnet_orb.glb` | ~3,500 tris / ~95 KB | Hovers above pits/spikes (`4.0` radius) tugging jump arcs off-course; Co-op `h` reverses polarity to boost partner across wide gaps |
| **Cream Pie Cannon** | `$` | `public/models/pie_cannon.glb` | ~3,800 tris / ~110 KB | Fires flying cream pie (`5.5` range) — splats face (`pieTimer = 1.4s`), blurs & knocks back `vx = -10` into danger if careless |
| **Disco Boogie Floor** | `~` | Procedural glowing pastel tile | 0 KB extra | Looks normal until stepped on -> rainbow pulse + funky beat forces `1.1s` uncontrollable boogie dance (`danceTimer`) that messes with jump timing; Co-op `h` pauses beat |
| **Sync Dual Plates** | `+` | Reuses `coop_switch.glb` (amber clone) | 0 KB extra | Both partners must step on matching `+` plates within `0.9s` to disarm linked gates/bombs |

---

## Per-Trap Character Animations Matrix (`src/render/momo.js`)

| Trap / Cause | Animation Name | Visual Motion in `momo.js` |
|---|---|---|
| `bananaPeel` (`B`) | Banana Wipeout | Feet-up `78°` horizontal tilt + rapid spin |
| `rubberChicken` (`R`) / `launchFloor` (`L`) | Rocket Stretch | Flat squash (`1.35×0.55`) then tall `0.62×1.65` skyrocket |
| `springTrap` (`!`) | Corkscrew Boing | `720°` vertical spin + stretched body + wide googly eyes |
| `magnetOrb` (`%`) | Magnetic Tug | `35°` lean toward orb + vibrating jelly shudder |
| `pieCannon` (`$`) | Cream Splat Stumble | Wobbly head tilt + dizzy eye offset during `pieTimer` |
| `discoFloor` (`~`) | Funky Boogie Dance | Rhythmic beat bounce (`sin(t*22)`) + side-to-side hip wiggle |
| `boxingGlove` (`V`) | KO Spin | Recoil flatten + rapid yaw spin |
| `sneezeCloud` (`W`) | Blowback Puff | Puffed scale (`1.28`) + wind-blown `40°` tilt |
| `controlsFlip` (`U`) / `giftTrap` (`J`) | Confused Head-Shake | Rapid head shake (`sin(t*28)*0.25`) + uneven eye scales |
| `gravityFlip` (`Y`) | Flip Tuck | Smooth `180°` somersault |
| `slowFloor` (`Z`) | Caramel Trudge | Heavy squat (`1.18×0.82`) + squelchy bob |
| `invisibleBlock` (`I`) | Bonk Wobble | Squished head (`1.28×0.72`) + dizzy wobble |
| `darkCandle` (`N`) | Spooked Shiver | Rapid nervous tremble + huge scared eyes |
| Deaths (`bomb`, `gate`, `spikes`, `crushed`, `pit`) | Distinct Death Poses | `crushed` pancake, `pit` vertical stretch, `bomb` charred rocket spin, `gate`/`spikes` electric zap jitter |

---

### Task 1: Asset Generation & Compression (`3d-asset-generation`)
- [ ] Generate & inspect `spring_pad.glb`, `magnet_orb.glb`, `pie_cannon.glb` via `tools/meshy-text-to-3d.mjs` + `gltf-transform optimize`.
- [ ] Update `assets/ASSET_LIST.md`.

### Task 2: Core Trap Mechanics (`test-driven-development` + `surgical-patch`)
- [ ] Add failing tests in `src/core/game.test.js` & `src/core/coop.test.js` for `!`, `%`, `$`, `~`, `+`.
- [ ] Implement in `src/core/level.js` & `src/core/game.js` + snapshot sync (`exportCoopSnapshot` / `applyCoopSnapshot`).
- [ ] Verify `npm test` passes GREEN.

### Task 3: Per-Trap Character Animations & Props (`threejs-animation` + `character-animation-qa`)
- [ ] Implement all trap reaction animations + distinct death poses + clean `reset()` in `src/render/momo.js`.
- [ ] Load new models in `src/main.js`, wire visuals in `src/render/world.js` (zero red hints!), and add SFX cues in `src/audio.js`.

### Task 4: Progressive Difficulty Redesign (`balance-check` + `team-level`)
- [ ] Re-organize & escalate `L1–L35` (Solo + Co-op compatible) and `L36–L42` (Couples Co-op Finale) in `src/levels.js` & `src/i18n.js`.
- [ ] Prove every level in `src/core/solutions.test.js` & `src/core/coopSolutions.test.js` (`>= 0.12s` windows).

### Task 5: Review, Deploy & Live Verification (`code-reviewer` + `verification-before-completion`)
- [ ] Run `code-reviewer`, fix findings, run `npm test && npm run build`, deploy to Cloudflare Workers, and run 2-tab live browser QA.
