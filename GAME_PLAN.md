# DON'T TRUST ANYONE — 3D Rage-Bait Platformer (Game Plan v4)

> Genre inspiration: troll platformer (jaise [Level Devil](https://playleveldevil.com/play/)). Wahan se jo dekha: world-map pe level nodes, skull wala death counter, simple controls, aur har level mein dhoka.
> **Game original hoga**: apna naam, apne characters, apne levels, apna art. Level Devil ka naam, art ya levels copy nahi karenge, sirf genre ka feel lenge.
> **Ghar:** [inkfinitystudio.store/game-room](https://inkfinitystudio.store/game-room), Chibi 3D Ludo ke saath.

---

## 0. Status (16 Nov 2026)

**M1 (solo grey-box) poora, aur M3 ka art bhi aa gaya.** Khelne layak game: 3 levels, 5 trap types + spikes, Meshy ke 3D models, Inkfinity style menu/HUD, mobile touch + keyboard + gamepad.

| Cheez | Kahan | Note |
|---|---|---|
| Chalana | `npm run dev` → http://localhost:5173 (`?level=2` se seedha level) | Build: `npm run build` → `dist/` (1.9 MB kul) |
| Tests | `npm test` (24 tests) | Physics, har trap, aur **har level ke liye bot**: naive player phanste hain, aur sahi tareeke se har level jeeta ja sakta hai (fairness rule) |
| Core logic | `src/core/` (physics, level parser, game rules) | Rendering se alag, hot path mein koi allocation nahi |
| Levels | `src/levels.js` | ASCII map. Text keys `src/i18n.js` mein |
| 3D | `src/render/` | Models `public/models/` (meshopt + webp, 56–133 KB each) |
| UI | `index.html`, `src/style.css`, `src/ui/hud.js` | Inkfinity tokens, string table, `prefers-reduced-motion` respected |

**Levels (World 1):**
1. *Bilkul Aasaan*: girta floor, phir darwaza bhaag ke start pe chala jaata hai.
2. *Upar Mat Dekhna*: far ledge ke upar invisible block. Normal jump takraata hai, Momo chakkar kha ke gaddhe mein. Pehle se jump karo (safe window ~0.23 sec). Phir chhupe kaante.
3. *Bharosa Karo*: "Safe ➜" wala pul nakli hai. Upar wala raasta lo (usmein ek girta tile), aur darwaza kaanton ke peeche chhup jaata hai.

**Faisle jo raste mein liye:**
- Mimi = Momo ka mesh recolor (Meshy ne Mimi pe 2 baar chehra bana diya). Details `assets/ASSET_LIST.md`.
- Invisible block se side ya neeche se takrane pe Momo 0.35 sec "dizzy" hota hai aur neeche girta hai. Bina iske momentum use bacha leta tha (bot test ne pakda).
- Sounds abhi code-synth bleeps hain (0 KB). Stage 7 mein jsfxr/Kenney CC0 se badlenge.

**Abhi nahi hua / agla:**
- Online co-op (M2): Ludo ka room server code chahiye.
- Game Room mein embed + deploy (M5): website ka source + Cloudflare access chahiye.
- Level-select diorama map, Stage 0 ke formal GDD docs, World 1 ke baaki 7 levels, asli SFX/music.
- Portrait mobile pe aage ka view chhota hai. Landscape mein behtar.

---

## 1. Core Idea

Ek cute, gol-matol hero **"Momo"** ko door tak pahunchana hai, lekin level khud usse troll karta hai. Floor bhaag jaata hai, door hasta hai, sign board jhooth bolta hai.
**Online mode mein twist:** tumhara dost bhi saath hai, aur wo bhi tumhe troll kar sakta hai. Isliye naam hai *"Don't Trust Anyone"*: na floor pe bharosa, na dost pe. 😈

**Feel target:** 70% "ARRGH!" + 30% "hahaha", taaki player bole "bas ek aur try".

---

## 2. Game Modes

| Mode | Kya hai |
|---|---|
| **Solo** | Akele khelo, saare 30 levels. Progress browser mein save hoti hai. |
| **Private Room (2 players)** | "Create Room" dabao, **9-digit room code** ya **"Copy Game Room Link"** milta hai. Dost link khole aur seedha tumhare room mein aa jaaye. Ludo jaisa hi flow hai, taaki site pe dono games ek jaise lagein. |

Online room mein **Duo Momo**: player 1 **Momo** (cream/crimson), player 2 **Mimi** (peach/mint). Dono ek hi level mein saath khelte hain.

### Online co-op mechanics (maze + dhoka)
- **Sir pe chadho:** ek Momo doosre ke sir pe khada ho ke high jump le sakta hai. Kuch doors sirf isi tarah pahunch mein aate hain.
- **Dhakka:** ek "bump" button, jisse dost ko halka dhakka do. Help bhi kar sakte ho… ya spikes mein gira sakte ho. 😂
- **Do-switch doors:** ek player button daba ke rakhe, tabhi doosra aage jaa sakta hai. Aur switch kabhi kabhi jhooth bolta hai.
- **Trap sabke liye:** ek player trap trigger kare to wo dono ke liye trigger hota hai. "Tune kya chhua?!" wale moments yahin se aayenge.
- **Level complete:** jab **dono** door tak pahunchein.
- **Respawn rule (room setting):**
  - *"Saath Jiyo, Saath Maro"* (default, full rage): ek mara to dono restart.
  - *"Chill"*: sirf jo mara wahi respawn.
- **Emote buttons:** 😂 😡 🙏 🤡 aur pre-written taunts ("Sorry bhai 😇", "Jaan bujh ke kiya"). Free-text chat nahi rakhenge, taaki moderation ka jhanjhat na ho.
- **End screen stats:** kaun kitni baar mara, aur **"Betrayals"**: kisne kisko kitni baar maraya. Ye screenshot share karne layak hoga.

---

## 3. Gameplay Basics

| Cheez | Decision |
|---|---|
| View | **2.5D**: world 3D hai, camera side se thoda angled. Controls 2D jaise simple. Co-op mein camera dono players ko frame mein rakhta hai. |
| Controls | ← → move, Space/↑ jump, **E = bump** (online). Mobile pe on-screen buttons. |
| Death | Instant respawn (< 0.5 sec). Koi lives nahi, fast retry hi rage bait ka asli nasha hai. |
| Death counter | Skull icon ke saath bada sa counter, har level ka aur total. |
| Troll v2 | Kai levels mein trap seekh lo to agli try mein **trap badal jaata hai**. |
| Level map | Ek **3D miniature diorama** (resin figurine jaisa) mez pe rakha hua. Inkfinity ke 3D miniature business se seedha connect hota hai. |

---

## 4. Characters (cute + funny)

| Character | Role | Personality / Animation |
|---|---|---|
| **Momo** (P1) | Hero | Jelly-blob, badi aankhein. Jump pe squash & stretch, landing pe "boing". Idle mein naak saaf karta hai, der tak khada rahe to so jaata hai. |
| **Mimi** (P2) | Online dost | Momo ki "twin", lekin uski ek aankh shararat mein hamesha aadhi band rehti hai. |
| **Darwaza Ji** | Exit door | Aankhen aur moonh wala door. Bhaag jaata hai, jeebh nikalta hai, hasta hai. |
| **Gappu the Sign** | Fake helper | "Safe ➜" likha hota hai aur wahi trap nikalta hai. Kabhi kabhi sach bhi bolta hai. |
| **Chomp Coin** | Lalach | Chhuo to daant nikal ke kaat leta hai. |
| **Narrator Kabootar** | Commentator | Kone mein baith ke taunt karta hai ("Phir se? 😂"). |

**Death animations** (sab funny, gore bilkul nahi): confetti pop, pancake squash, zameen mein ghus ke sirf aankhen dikhna, aur "splat + bounce". Har death pe 1 sec slow-mo zoom bhi, jo settings se band ho sakta hai.

---

## 5. Trap Library

**A. Dikhte hain par sneaky hain:** falling floor, delayed spikes, ceiling crusher, bhaagta door, rolling boulder.
**B. Invisible:** invisible wall, chhupa block (neeche se sir takraane pe dikhta hai), ghost floor, invisible spike (death ke baad red outline se hint milta hai).
**C. Unexpected / mind-games:** controls flip, cardboard fake door, fake checkpoint flag, camera troll, gravity flip, fake "LEVEL COMPLETE!" banner jiske baad floor gir jaata hai.
**D. Funny:** banana peel, wall se boxing glove, Chomp Coin, rubber-chicken trampoline, chheenkne wala badal.
**E. Co-op only:** jhootha do-switch, "swap" trap (dono players ki jagah badal jaati hai), ek ka jump dono ko jump karwata hai, aur "trust bridge" jo sirf tab tikta hai jab dono ek saath chalein.

**Fairness rules:**
- Har trap seekha ja sakta hai. Koi RNG death nahi: same input pe same result.
- Har level mein max 3–4 naye tricks.
- Har 5 levels ke baad ek "breather" level.

---

## 6. Worlds & Levels

**30 levels, 3 worlds** (v1 mein World 1 ke 10 levels):

| World | Theme | Trap flavour |
|---|---|---|
| 1. Candy Meadow | Cream-peach ghaas, lollipop trees, crimson ribbons | Falling floor, bhaagta door, Chomp Coin |
| 2. Toy Factory | Conveyors, gears, toy robots | Crushers, gloves, controls flip |
| 3. Haunted Bakery | Cute ghosts, cakes, candles | Invisible blocks, ghost floors, gravity flip |

- Har world ke end mein ek **mini-boss level** hai.
- Har level ek **JSON file** hai (tiles + traps + co-op variant), isliye naya level banane ke liye code nahi chhedna padega.
- Level ka co-op version solo jaisa hi hai, bas kuch extra switches aur 2-player gates add hote hain.
- v2 mein ek simple in-browser level editor ho sakta hai.

---

## 7. Website Fit: inkfinitystudio.store

Site check karne pe ye mila:

| Cheez | Value |
|---|---|
| Background | `--bg: #fffbf7` (warm cream) |
| Text | `--ink: #1f1916` |
| Accent / buttons | `--crimson: #8b0d1a` (white text, 8px radius, halki shadow) |
| Fonts | **Outfit** 600–800 (headings), **Plus Jakarta Sans** (body), **JetBrains Mono** (labels/codes) |
| Motion | `--ease: cubic-bezier(.22,.61,.36,1)`, 0.2s / 0.35s / 0.65s |
| Site tech | React + Vite SPA, Firebase, Cloudflare |
| Game Room | "Chibi 3D Ludo" iframe se embed hai: `chibi-ludo-3d.inkfintystudio-store.workers.dev/?embed=1&parentUrl=…` |

**Iska plan mein matlab:**
- Saare game menus (start, room create/join, pause, results) **inhi tokens** mein banenge: cream background, crimson buttons, Outfit headings. Room code JetBrains Mono mein dikhega, Ludo jaisa.
- 3D world thoda colourful rahega, lekin palette cream/peach/crimson ke paas, taaki site se alag na lage.
- **Deploy bhi Ludo jaisa:** apna Cloudflare Worker (`dont-trust-anyone.…workers.dev`) aur same `?embed=1&parentUrl=` iframe pattern. "Copy Game Room Link" aur "Full Window" buttons bhi same rahenge.
- Game Room page pe ek **game switcher** chahiye (Ludo | Don't Trust Anyone). Iske liye site ke React code mein chhota sa change lagega.

---

## 8. Tech Stack

| Part | Choice | Kyun |
|---|---|---|
| Engine | **Three.js + Vite** | Ludo bhi Three.js pe hai, to same skills aur same tooling. |
| Physics | Custom simple AABB collision (2.5D) | Precise aur predictable. Co-op sync mein bhi aasaan. |
| Models | Low-poly stylised **GLB** (Draco compressed) | Cute, halke aur fast. Ludo bhi Draco use karta hai. |
| Multiplayer server | **Cloudflare Worker + Durable Object (1 room = 1 object) + WebSocket** | Ludo ka pattern bhi yahi hai (`/rooms/reserve`, `/ws/room/{code}`). Ek hi jagah host hoga, extra server ka kharcha nahi. |
| Hosting | Cloudflare Workers static assets | Ludo jaisa. |

### Multiplayer kaise kaam karega (simple version)
1. **Create Room:** server ek random 9-digit code reserve karta hai. Room 2 players tak limited hai aur 30 min idle rehne pe expire ho jaata hai.
2. **Join:** link ya code se dost aata hai, aur dono "Ready" dabate hain.
3. **Movement:** har player apna Momo **apne device pe** chalata hai, isliye controls mein zero lag. Position aur animation ~20 baar/sec bheji jaati hai, aur doosre screen pe smooth (interpolated) dikhti hai.
4. **Traps aur deaths:** ye "events" hain (`trap#7 triggered`, `P2 died`, `P1 bumped P2`). Durable Object inko order mein dono ko bhejta hai, isliye dono screens pe same trap same waqt chalta hai. Traps deterministic hain, to event milte hi dono pe same result aata hai.
5. **Disconnect:** 20 sec tak reconnect ka mauka milta hai, phir room "waiting for friend" pe chala jaata hai.
6. **Safety:** message size aur rate limit, room code guess karne pe rate limit, koi personal data store nahi, aur free-text chat nahi.

> Dosto ke beech private co-op mein **client-authoritative movement** theek hai. Cheating se kya hi milega 😄. Public matchmaking ya leaderboard aaye to server-side checks badhane padenge (v2).

### ₹0 Budget Stack (Meshy ke alawa sab free)

**Tumhara PC:** AMD integrated graphics + 7 GB RAM. Isliye bhaari AI models (music generation) local pe practically nahi chalenge. Jo cheez PC pe na chale, wo free cloud pe chalegi ya ready-made free library se aayegi.

| Kaam | Pehle (paid) | Ab (free) | License / note |
|---|---|---|---|
| **3D models** | Atlas Cloud / fal.ai | **Gemini Nano Banana** (free, reference image) → **Meshy API** (tumhara subscription, 30 credits/model, 1,370 bache hain) | Paid plan pe models commercial use ke liye tumhare. Latest Meshy model use karna: `meshy-7` 31 Dec 2026 ko generation ke liye retire ho raha hai. |
| **Model optimize** | — | **gltf-transform** (npm, free): Draco/meshopt compression, textures 512–1024px WebP | MIT |
| **Character animation** | Rig + clips | **Procedural animation in Three.js**: squash/stretch, bounce, wobble, aankhon ke expressions (code se) | Free. Meshy ka auto-rig sirf **humanoid** models pe theek chalta hai, aur gol blob Momo ko bones ki zaroorat nahi. Isse funny bhi zyada lagega. |
| **Props ke rig/anim** (agar chahiye) | — | Meshy auto-rig (sirf 2-pair wale chibi characters, jaise Narrator Kabootar nahi) ya **Blender** (free) | Blender GPL, output tumhara |
| **SFX** | ElevenLabs | ① **jsfxr** (browser mein retro/cartoon SFX banao: boing, pop, jump) ② **Kenney audio packs** (CC0) ③ **Freesound** sirf CC0 filter ④ **apni awaaz** record + Audacity/ffmpeg | CC0 = koi credit nahi chahiye. jsfxr se bani sound tumhari. |
| **Music** | ElevenLabs / Lyria | ① **Pixabay Music** (ready-made, free) ② **ACE-Step 1.5** (open-source AI, **MIT**) free **Google Colab GPU** pe chala ke | Pixabay license commercial use allow karta hai, credit zaroori nahi. ACE-Step PC pe bahut slow hoga, isliye Colab. |
| **Kabootar ki awaaz** | HeyGen TTS | ① **"Gibberish babble"**: Web Audio se har letter pe chhoti cute awaaz (jaise cute animal games mein) ② **apni awaaz** + pitch shift (ffmpeg) ③ **Kokoro TTS** (Apache-2.0, CPU pe chalta hai, Hindi voices: `hf_alpha`, `hf_beta`, `hm_omega`, `hm_psi`) | Option ① sabse free, sabse halka (0 KB files) aur sabse cute. Kokoro ki Hindi quality average (grade C) hai, isliye backup. |
| **Hosting + rooms** | — | **Cloudflare Workers Free** + Durable Objects (WebSocket Hibernation) | Free plan ki limits deploy se pehle `find-docs` se confirm karenge. 2-player rooms ke liye kaafi hona chahiye. |
| **Code, tests, tools** | — | Three.js, Vite, Vitest, Playwright, Wrangler | Sab open-source |

**Credits screen:** CC-BY wali koi cheez use hui to game ke "Credits" mein naam denge. Koshish rahegi ki sab CC0/Pixabay/apna banaya ho, taaki credits ka jhanjhat hi na ho.

---

## 9. Skills Timeline: kaun sa skill, kab, kis order mein

> Har skill ka description padh ke check kiya hai ki wo installed hai aur hamare stack (**Three.js web + Cloudflare**) pe chalta hai. Jo Unity ya 2D ke liye hain, unki list neeche alag hai.
> **Backbone:** installed **game-studio pipeline**: concept → GDD → architecture → epics/stories → build → QA gates → release. Baaki skills is pipeline ke andar plug hote hain.
> `→` matlab ek ke baad ek. `+` matlab saath mein (jugalbandi).

### Stage 0: Setup & Concept Lock (code se pehle)
| Kab | Skill(s) | Kya nikalega |
|---|---|---|
| Day 1 | `start` → `setup-engine` | Studio workflow shuru. Engine **web (Three.js + Vite)** pe pin hoga. |
| Day 1 | `brainstorm` + `idea-refine` (`interview-me` agar kuch clear na ho) | Game pillars lock: rage + cute + co-op betrayal. |
| Day 1–2 | `visual-style` → `art-bible` | `visual-style` **inkfinitystudio.store ke URL se style extract karega** (colors, fonts, motion). `art-bible` us pe game ka art guide banayega. |
| Day 2 | `map-systems` | Systems index + dependency order. |
| Day 2–4 | `design-system` (×9, ek system ek baar) | GDD har system ka: Movement, Trap Engine, Death/Respawn, Level Format, Rooms & Net-Sync, Bump/Betrayal, UI/HUD, Save, Audio. |
| Day 4 | `review-all-gdds` + `consistency-check` + `design-review` | GDDs ke beech contradictions pakadna. |
| Day 4 | `doubt-driven-development` | "Traps fair hain?" aur "net-sync pe desync hoga?" jaise sawaalon ka adversarial review. |
| Day 5 | `gstack-plan-ceo-review` + `gstack-plan-design-review` | Ye GAME_PLAN scope aur design dono angle se review hoga. |
| **Gate** | `gate-check` | Concept → Pre-production: PASS hone pe hi aage badhenge. |

### Stage 1: Prototype the Fun (M1)
| Kab | Skill(s) | Kya nikalega |
|---|---|---|
| Week 1 | `prototype` | **Playable browser grey-box**: 3 levels, 5 traps. Skill khud khel ke screenshot leta hai. |
| Week 1 | `playtest-report` | Tumhare (aur dosto ke) khelne ke notes structured feedback mein. |
| Week 1 | `balance-check` + `quick-design` | Trap timings / jump numbers tune karna, chhote design changes. |
| **Gate** | `gate-check` | "Kya ye mazedaar hai?" Agar nahi, to pehle ye loop dubara, art baad mein. |

### Stage 2: Architecture & Quality Bar
| Kab | Skill(s) | Kya nikalega |
|---|---|---|
| Week 2 | `find-docs` / `context7-mcp` | Three.js, Cloudflare Durable Objects, Wrangler ke **latest docs** (purani yaad pe bharosa nahi). |
| Week 2 | `create-architecture` → `architecture-decision` (ADRs) | Client modules + Worker + protocol. ADRs: custom AABB physics, client-auth movement + server event ordering, Ludo room server reuse, GLB+Draco, level JSON. |
| Week 2 | `api-and-interface-design` | WebSocket messages + level JSON ka exact schema. |
| Week 2 | `create-control-manifest` | Har system ke liye "must do / never do" coding rules. |
| Week 2 | `constraint-driven-development` | `CONSTRAINTS.md`: neeche "Quality Bar" wale numbers contract ban jaayenge. |
| Week 2 | `ux-design` → `ux-review` | Screens ke specs: menu, room create/join, HUD, pause, results, emote bar. |
| Week 2 | `test-setup` → `test-helpers` | Test framework + CI + helpers. |

### Stage 3: Work Breakdown
| Kab | Skill(s) | Kya nikalega |
|---|---|---|
| Week 3 | `create-epics` → `create-stories` → `story-readiness` | Epics (har module ek), stories with acceptance criteria. |
| Week 3 | `sprint-plan` + `estimate` | Sprints aur effort. |
| Har milestone se pehle | **`writing-plans`** | Us milestone ka **TDD implementation plan**: exact files, interfaces, tests. |

### Stage 4: Build Loop (har story pe repeat)
| Step | Skill(s) |
|---|---|
| 1. Implement | `dev-story` + `test-driven-development` + `incremental-implementation` + `ponytail` (overbuild nahi) |
| 2. Execute style | `subagent-driven-development` (har task ka fresh reviewer) ya `executing-plans`. Independent epics (art vs server) ke liye **`dispatching-parallel-agents`**. |
| 3. Three.js kaam (story ke type ke hisaab se) | `threejs-fundamentals` (scene, 2.5D camera, loop) · `threejs-geometry` (instanced tiles, confetti) · `threejs-interaction` (keyboard/touch input) · `threejs-loaders` (GLB/Draco) · `threejs-materials` + `threejs-textures` (toon pastel) · `threejs-lighting` · `threejs-shaders` (invisible-trap shimmer, death dissolve, squash) · `threejs-postprocessing` (outline, bloom) · `threejs-animation` (mixer, blending) · `threejs-world-generation` (backgrounds + diorama level map) |
| 4. Bug aaye | `investigate-first` → `systematic-debugging` → `surgical-patch`. WebGL memory badhe to `memory-leak-debugging`. |
| 5. Done bolne se pehle | `verification-before-completion` |

### Stage 5: Online Co-op Epic (M2)
| Order | Skill(s) | Kya |
|---|---|---|
| 1 | `api-and-interface-design` | `join / ready / state / event / emote / leave` protocol final. |
| 2 | `test-driven-development` | Room tests: 3rd player reject, expiry, reconnect, event order. |
| 3 | `browser-testing-with-devtools` | **2 tabs**, slow network throttle, console/network check. |
| 4 | `observability-and-instrumentation` | Room logs/metrics, taaki live bugs dikhein. |
| 5 | `soak-test` | Lambe sessions: leaks, late disconnects. |
| 6 | `security-and-hardening` → `security-audit` → `gstack-cso` | Rate limits, input validation, room-code guessing, cheat vectors. |

### Stage 6: Characters, World & Levels (M3–M4)
| Order | Skill(s) | Kya |
|---|---|---|
| 1 | `asset-spec` | Har asset ka spec + AI generation prompt (art bible se). |
| 2 | `pose-library-design` | Momo/Mimi ke **poses aur expressions ki list** (shock, splat, sleepy, shararat). Skill 2D-focused hai, isliye sirf design list ke liye. |
| 3 | **Gemini (Nano Banana)** → **Meshy API** | Gemini mein faceless reference image (`assets/refs/`), phir `tools/meshy-image-to-3d.mjs` se Meshy 7.1 textured model, remesh karke ~10k triangles tak (`assets/raw/`). 30 credits/model. Momo pe test ho chuka hai. Details: `assets/ASSET_LIST.md`. |
| 3a | `tools/viewer.html` (asset-viewer) | Har model ghuma ke check karna: shape, colour, triangle count. |
| 3b | `ffmpeg` + **gltf-transform** | GLB compress (Draco/meshopt), textures resize. Ye free CLI tools hain. Momo raw 1.55 MB hai, target < 400 KB. |
| 4 | `asset-audit` | Naming, file size budget, Draco check. |
| 5 | `threejs-animation` + `threejs-shaders` + `threejs-geometry` | **Procedural** animation: squash/stretch, wobble, aankh blink/expressions. Bones ki zaroorat nahi. |
| 6 | `character-animation-qa` | Browser preview + frame sampling: timing funny hai? loop smooth hai? |
| 7 | `team-level` | Level designer + world builder + QA team: 30 levels, solo + co-op variants. |
| 8 | `playtest-report` → `balance-check` | Deaths-per-level target check, aur loop. |

### Stage 7: Audio (M3–M4)
| Skill(s) | Kya |
|---|---|
| `team-audio` (orchestrator) | Audio direction se implementation tak. |
| **jsfxr** + Kenney CC0 + Freesound CC0 | Boing, splat, pop, slip, jump, bump. Door ki hansi tumhari awaaz ya CC0 se. |
| Pixabay Music **ya** `acestep` (Google Colab pe) | Har world ka bouncy loop. Jo better lage wo rakhenge. |
| Web Audio "babble" (code) **ya** Kokoro TTS | Kabootar ki taunts: text bubble + cute gibberish awaaz. |
| `ffmpeg` | Pitch shift (funny awaaz), trim, ogg/mp3 compress, loudness same. |
✅ Koi paid audio service nahi.

### Stage 8: UI + Website (M4–M5)
| Order | Skill(s) | Kya |
|---|---|---|
| 1 | `team-ui` | UX spec → visual → implement → review pipeline. |
| 2 | `frontend-ui-engineering` + `visual-style` (apply) | Menus/HUD as HTML overlay, Inkfinity style mein. |
| 3 | `impeccable` | Room create/join aur results screen ko "designed" feel dena. |
| 4 | `gsap-core` + `gsap-timeline` | Menu transitions, fake "LEVEL COMPLETE" troll banner. |
| 5 | `a11y-debugging` | Keyboard, focus, tap targets, contrast, shake-off option. |
| 6 | `react-best-practices` | Site ke Game Room page pe Ludo / DTA game switcher. |
| 7 | `gstack-design-review` | Visual QA: spacing, hierarchy, AI-slop pakadna. |
| 8 | `banner-design` | Game Room card thumbnail + social launch posts. |

### Stage 9: QA, Polish & Perf (har milestone ke end)
| Skill(s) | Kya |
|---|---|
| `team-qa` → `qa-plan` → `smoke-check` → `regression-suite` → `test-evidence-review` | Test cycle. |
| `test-flakiness` | Multiplayer tests flaky hon to. |
| `team-polish` | Juice: screen shake, particles, feel. |
| `perf-profile` + `gstack-benchmark` | Mobile 60 FPS, load time, regression detection. |
| `code-review` + `requesting-code-review` | Architecture + code review. |
| `bug-triage` + `tech-debt` | Bugs/debt badhne pe. |
| `content-audit` + `scope-check` + `cut` | Planned vs built, scope creep, kya kaatna hai. |
| `milestone-review` → `gate-check` → `retrospective` | Go/no-go aur seekh. |

### Stage 10: Release (M5) & Live (v2)
| Skill(s) | Kya |
|---|---|
| `team-release` → `release-checklist` → `shipping-and-launch` | Launch readiness. |
| Deploy | Cloudflare Wrangler (command tum chalaoge, account tumhara). |
| `smoke-check` (live URL) + `browser-testing-with-devtools` | Live pe 2-player test. |
| `patch-notes` | Players ke liye notes. |
| `team-live-ops` (v2) | Daily troll level, events. |
| `localize` (v2, optional) | Hinglish/English text toggle. |

---

### 🎵 Jugalbandi: combos jo saath milke best result dete hain
| # | Combo | Kyun |
|---|---|---|
| 1 | **Brand lock:** `visual-style` (URL extract) → `art-bible` → `asset-spec` (prompts) → Gemini Nano Banana → Meshy API → viewer QA → gltf-transform → `asset-audit` | Site ka look seedha 3D assets tak bina tootey pahunchta hai. |
| 2 | **Design bible:** `map-systems` → `design-system` ×9 → `review-all-gdds` + `consistency-check` → `doubt-driven-development` | Code se pehle hi galtiyaan pakdi jaati hain. |
| 3 | **Fun first:** `prototype` → `playtest-report` → `balance-check` → `quick-design` ↺ | Art pe paisa/time lagane se pehle fun prove ho jaata hai. |
| 4 | **Architecture chain:** `find-docs` → `create-architecture` → `architecture-decision` → `create-control-manifest` (baad mein design badle to `propagate-design-change`) | Decisions likhe hue rehte hain, bhoolte nahi. |
| 5 | **Story machine:** `create-stories` → `story-readiness` → `writing-plans` → `dev-story` + `test-driven-development` + `ponytail` → `verification-before-completion` | Har feature chhota, tested aur proven. |
| 6 | **Net-sync quartet:** `api-and-interface-design` → `test-driven-development` → `browser-testing-with-devtools` (2 tabs) → `soak-test` → `security-audit` | Co-op smooth aur safe. |
| 7 | **Cute feel:** `threejs-animation` + `threejs-shaders` → `character-animation-qa` ↺ | Squash/stretch + dissolve jab tak funny na lage. |
| 8 | **Invisible-trap magic:** `threejs-shaders` + `threejs-postprocessing` + jsfxr "aha!" sound | Trap chhupa rahe, death ke baad "aha!" shimmer + sound. |
| 9 | **UI shine:** `team-ui` + `impeccable` + `gsap-timeline` + `a11y-debugging` + `gstack-design-review` | Menus site jaise premium lagein aur sabke liye usable rahein. |
| 10 | **Parallel speed:** `dispatching-parallel-agents` | Art pipeline aur room server alag files hain, isliye ek saath ban sakte hain. |
| 11 | **Milestone gate:** `smoke-check` → `code-review` → `milestone-review` → `gate-check` → `retrospective` | Har milestone pe quality pakki. |

### ❌ Installed hain par use NAHI honge (aur kyun)
| Skill | Kyun nahi |
|---|---|
| `physics-3d-collision`, `craft-game-floors`, `optimize-web`, `optimize-audio`, `setup-multiplayer-services`, `build-live-game`, `ui`, `localization` | Ye **Unity** ke liye hain. Hum Three.js web pe hain. |
| `character-rigging`, `svg-character-animation`, `canvas-procedural-animation` | **2D** rigs/animation ke liye hain. Hamare characters 3D GLB hain. |
| `wobnimo-mascot` | Alag engine (Wobnimo) ke liye hai. |
| `3d-asset-generation`, `atlas-cloud`, `sound-effects`, `music`, `elevenlabs`, `text-to-speech` (HeyGen), `lyria`, `fish-audio-tts`, `azure-text-to-speech`, `dashscope` | **Paid** services hain. ₹0 budget mein inki jagah Meshy + free tools (section 8). |
| `design-system` UI tokens ke liye | Ye skill asal mein **GDD likhne** ke liye hai, isliye Stage 0 mein usi kaam pe lagaya hai. UI tokens `visual-style` se aayenge. |

---

### Quality Bar (`constraint-driven-development` se `CONSTRAINTS.md` banega)
- Mid-range Android phone pe **60 FPS** (min 45).
- First download **< 15 MB**, playable **< 5 sec** mein (4G).
- Death → respawn **< 0.5 sec**.
- Online: remote player ka lag **< 150 ms** (India-India), trap events dono screens pe ek hi order mein.
- Room: max 2 players, 9-digit code, 30 min idle pe expire.
- Koi personal data store nahi, koi free-text chat nahi.
- Menus sirf Inkfinity tokens mein (`#fffbf7`, `#1f1916`, `#8b0d1a`, Outfit / Plus Jakarta Sans).

### Review Focus: top 5 risks jinpe sabse zyada nazar rahegi
1. **Desync:** ek screen pe trap gira, doosri pe nahi. Isliye events server se ordered aayenge aur deterministic trap tests likhe jaayenge.
2. **Dost beech mein chala gaya** (tab band / net gaya): room crash nahi hona chahiye, 20 sec reconnect window milegi.
3. **Unfair rage:** player trap seekh hi na paaye aur game chhod de. Isliye "har trap 2nd try mein bachne layak" wala test playtest mein hoga.
4. **Mobile performance:** 3D + post-processing se FPS gire. Isliye low-quality preset aur perf budget pehle din se.
5. **iframe embed:** fullscreen, keyboard focus aur audio autoplay ka parent site ke andar kaam karna. Isliye Game Room ke andar real test hoga.

---

## 10. Build Order & Milestones

| # | Milestone | Main skills (Stage) | Done kab maana jaayega | Gate |
|---|---|---|---|---|
| M0 | Concept lock | Stage 0 | Art bible, 9 GDDs, systems index ready. | `gate-check` |
| M1 ✅ | Solo grey-box | Stage 1 (`prototype`) | Momo chalta aur koodta hai, 3 levels, 5 trap types, death + instant respawn. | `playtest-report` → `gate-check` |
| M2 | Online grey-box | Stage 2–5 | Room create/join (9-digit code + link), 2 Momo ek level mein, traps dono pe sync, dono ka door pe pahunchna = win. | `soak-test` + `security-audit` → `milestone-review` |
| M3 | Cute vertical slice | Stage 6–7 (+ `vertical-slice`) | 3 levels full 3D art, animations aur sound ke saath, solo + duo dono. | `character-animation-qa` → `gate-check` |
| M4 | World 1 complete | Stage 6–8 | 10 levels + mini-boss, diorama map, death counter, betrayal stats, emotes. | Stage 9 full QA |
| M5 | Website live | Stage 8–10 | Cloudflare Worker pe deploy, Game Room mein switcher, mobile pe chal raha. | `release-checklist` + live `smoke-check` |
| M6 | World 2 & 3 | Stage 6 loop (`team-level`) | 30 levels total. | `content-audit` → `milestone-review` |
| M7 (v2) | Extras | `team-live-ops`, `localize` | Level editor, skins (Momo ki topi!), leaderboard, daily troll level. | `retrospective` |

Har milestone shuru hone se pehle `writing-plans` us milestone ka TDD task plan banayega, aur khatam hone pe Stage 9 ka gate chalega.

---

## 11. Tumse chahiye

1. **Chibi Ludo ka source code** (repo ya folder). Iska room server (Worker + Durable Object) reuse karenge, zero se nahi likhna padega.
2. **Website ka source code**, Game Room page pe game switcher add karne ke liye.
3. Cloudflare account mein naya Worker deploy karne ka access (deploy ke time tum khud command chala sakte ho).
4. Final naam aur hero design: "Don't Trust Anyone" + Momo/Mimi theek hai?
5. **Meshy:** API kaam kar rahi hai (MCP config wali key se), 1,370 credits bache hain. Commercial use ke liye paid plan ki terms ek baar confirm kar lena.
6. **Google account** (free Colab ke liye), agar AI music banana ho. Warna Pixabay ka ready-made music.
