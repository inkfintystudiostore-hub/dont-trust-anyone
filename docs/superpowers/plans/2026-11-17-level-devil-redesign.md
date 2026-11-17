# Level Devil–style Level Redesign (Solo + Co-op): PLAN v2, awaiting approval

## 0. Ground truth
**Repo (checked 2026-11-17):** 62 levels (solo L1–L47, co-op L48–L62), 38 trap kinds. Most levels are 26–34 tiles wide, so length is not progressive. `GAME_DESIGN.md` is stale (says 42).
Hard-coded things that must be fixed: `i < 30` unlock checks in `src/main.js` (~497, 518, 667), world slices in `levels.test.js`, `diorama.js` layout, `save.js` `recordWin(..., LEVELS.length)`, i18n keys `lN.name/sign/t1-3`. `solutions.test.js` (658 lines) + `coopSolutions.test.js` (451) hold a hand-written bot path per level and break on any level change.

**Video watched** (Level Devil Game Trailer, 33 s, by Unept; I sampled a frame about every 2 s, so I saw roughly half of it). What it actually shows:
1. Flat art, one colour per level, **one screen per level**, tiny player, grey door. Difficulty comes from trick density, not size.
2. Opening: plain corridor to the door, then **pits open in the floor** between you and the door; the door sits beside a pit.
3. A **row of dots** (coins/bait) along the floor toward the door.
4. **Floor spikes** with a low ledge overhead (jump ceiling).
5. **Vertical tower/shaft** with a narrow climb, tiny spikes on the walls, a ledge, the door at the bottom corner.
6. A **giant player** under a **ceiling of spikes** with a pit between two floor pieces (a size-change trick).
7. **Disguised blocks** (concentric-square tiles floating in the room) next to a long ceiling shelf and a walled-off door.
8. **Serpentine corridor** (switchback tunnels) with a spike strip near the door.
9. **Spikes on both floor and ceiling** with a **wall cannon** on the left and the door on a pedestal.
10. **Circular saw blade** sliding in a horizontal tunnel, multi-floor layout with gaps in the floors, saw blades on the ground of the lowest floor.
11. Dense **multi-storey maze with saws along the bottom**, and the devil-eyes end card.
(Short of the full video: I did not see what each trap does when triggered. I'm mapping them to behaviours we can build and will confirm any I'm unsure of with you.)

## 1. Rules (yours + the video's)
1. Never telegraph: no red/debug outlines, no hints before the first death.
2. Deterministic, fair on 2nd try (fixed 60 Hz, no RNG).
3. 3-beat rule: safe twice, betray on the third.
4. One new idea per level (teach it, then betray it).
5. **Callback rule (new): every trap introduced in a low level must come back in higher levels, harder** (see §3).
6. Almost-win betrayal inside the last 3 tiles in at least 1 of every 3 levels.
7. Every level uses the **room structure** from the video: a "room" is a one-screen mini-puzzle (about 26–34 tiles). Early levels = 1 room. Later levels chain 2–6 rooms with a fake door between them. That is how length grows without changing the feel.

## 2. Progression curve (solo, 47 levels)
| Band | Levels | Rooms | Width (tiles) | Tricks per room | Target deaths | Notes |
|---|---|---|---|---|---|---|
| Tutorial-troll | L1–L5 | 1 | 26–32 | 1 | 1–3 | video opening: corridor, pit before door, coin dots |
| Warm-up | L6–L12 | 1–2 | 32–60 | 1 + callbacks | 2–5 | first callbacks, first almost-win |
| Rising | L13–L22 | 2–3 | 60–90 | 2–3 | 4–8 | shaft/tower levels (height 10–14), serpentine corridors |
| Hard | L23–L34 | 3–4 | 90–120 | 3–4 | 6–12 | saws, cannons, ceiling+floor spikes |
| Devil | L35–L44 | 4–5 | 120–150 | 4–5 | 10–20 | reversals of earlier lessons |
| Finale | L45–L47 | 5–6 | 150–180 | 5+ | 15–30 | every trap family, two fake final doors, devil-eyes end card |
A short breather level at about every fifth level. Targets assume 20–90 s clears.

## 3. Callback system (traps from low levels return in high levels)
**Trap ledger.** Every trap kind gets: `debut` level, a list of callback levels, and a difficulty ladder.
| Rung | Where | What changes |
|---|---|---|
| Debut | one level | taught safely, betrayed once (e.g. fallingFloor, delay 0.25) |
| Callback 1 | debut +3 to +5 | same trap, new angle (reversed direction, on a ceiling, different trigger line) |
| Callback 2 | next band | tighter numbers (delay 0.08, radius larger, speed up) |
| Stack | Hard/Devil bands | combined with a second old trap (fallingFloor over hiddenSpikes, banana into saw) |
| Finale | L45–L47 | all families together |
**Rules checked by an automated test (`trapLedger.test.js`):**
- every trap kind appears in at least 3 different levels;
- the gap between two appearances of a kind is at most 8 levels;
- every kind that debuts before L35 appears again in the last 10 solo levels;
- from L6 on, each level contains at least 1 callback trap and at most 1 debut;
- difficulty parameters of a kind never get easier on a later appearance (unless the level is marked `breather`).
Co-op: same ledger for the co-op range; co-op mechanics (plates, gates, key, bomb, sync plate, weight bridge) also return, and solo traps are reused in co-op.

## 4. New traps (from the video, 6 total; reuse first)
| Trap | From video frame | Behaviour (not telegraphed) | Debut | Needs 3D asset |
|---|---|---|---|---|
| Patrol saw (`n`) | #10, #11 | saw slides along a ledge/tunnel on a fixed 60 Hz timeline | L16 | yes: saw blade (Meshy) |
| Size Swell (`v`) | #6 | touching a tile makes Momo giant for a few seconds: bigger hitbox, can't fit gaps, hits ceiling spikes | L22 | no (scale) |
| Ceiling icicle drop (`u`) | #9 | safe ceiling spike falls when you pass under; 3rd one only | L9 | yes: candy icicle (Meshy) |
| Closing walls (`]`) | #8 | corridor walls slam shut after you cross a line | L26 | no |
| Rising floor (`w`) | #4, #6 | floor you trust rises into the ceiling spikes | L12 | no |
| Spike-swap tile (`x`) | #2, #3 | safe tile twice, spikes on the third pass | L7 | no |
Re-skins of what exists: wall cannon = `pieCannon` (horizontal dart variant), disguised block = `invisibleBlock`/`fallingFloor` with a decorative block mesh, pits before the door = `fallingFloor`/`ghostFloor`, dot row = `chompCoin`.
Assets: Gemini Nano Banana reference (white bg, no face) → `tools/meshy-image-to-3d.mjs` (about 30 credits each; I run `meshy_check_balance` first and ask you before spending) → viewer check → gltf-transform compress.

## 5. Co-op (L48–L62, 15 levels)
Same curve and room structure, every room needs both players (plates + gates A/B, key, bomb defuse, sync plate, weight bridge). L48–L51 one mechanic + one lie; L52–L56 two mechanics, a trap that punishes trusting your partner; L57–L60 split-route rooms (P1 and P2 take different paths and rejoin at a fake door); L61–L62 finale. Widths 30 → 150. Shared-fate death stays. Traps are deterministic from the same step, so new traps sync with no extra netcode.

## 6. Work plan (each phase ends with `npm test` and `npm run build` green; I work on `feat/level-devil-redesign`)
| # | Phase | Skills / tools | Output |
|---|---|---|---|
| A | **Auto-solver bot** that finds an input replay per level (BFS/beam over key presses at 60 Hz, hand-hint fallback); fairness test = replay wins, naive walk dies | test-driven-development, systematic-debugging | `src/core/solver.js` + one parametrised test |
| B | De-hardcode world ranges, unlock rule, diorama, i18n key generation, level-count tests; add `trapLedger.test.js` | safe-refactor, surgical-patch | green on the current 62 levels |
| C | Six new traps (`level.js`, `game.js`, `world.js`), each with a "catches naive / fair on 2nd" test | threejs-fundamentals/geometry/animation, test-driven-development | 6 traps |
| D | Meshy assets: saw blade, icicle | Gemini Nano Banana + Meshy MCP, 3d-asset-generation | 2 GLBs in `public/models` |
| E | Solo levels in 6 band batches; solver + ledger test after each | craft-game-floors, team-level, balance-check, brainstorming | new solo part of `levels.js` + Hinglish i18n |
| F | Co-op levels, same process, 2-player solver | team-level, balance-check | new co-op part |
| G | Browser playtest per band, mobile joystick/camera check, bundle size, update `GAME_DESIGN.md`; deploy only on your word | verification-before-completion, playtest-report, code-review | screenshots + test output |

## 7. Risks
- Antigravity also edits this repo: `git log/status` before each phase, work on a branch.
- Long levels frustrate: room structure, breathers, fake checkpoints (jokes only), existing assist mode.
- Solver may fail on combo rooms: hand-recorded replays for those.
- Old saves become meaningless: bump save version and reset progress.
- Meshy credits and the Gemini image download step need your OK.

## 8. Open questions (defaults in bold)
1. Level count: **47 solo + 15 co-op**?
2. Finale length: **about 150–180 tiles (6 rooms, about 2 min)**, or shorter?
3. Reset saved progress: **yes**.
4. Add the 6 new traps: **yes**.
5. Branch, deploy only after you test: **yes**.
