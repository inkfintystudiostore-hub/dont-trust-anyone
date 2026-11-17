# Don't Trust Anyone: Game Design Document (v1)

> **Kis liye:** ab tak kya bana, aur game ka poora gameplay (traps, levels, difficulty, animation, graphics, motion) detail mein, taaki tum verify kar sako aur apni cheezein jod sako.
> **Kaise padhna:** ✅ = game mein ban chuka hai · 🔜 = plan hai, abhi nahi bana · 🎛️ = tuning number (badal ke feel badal sakte ho).
> **Kaise add karna:** jahan bhi `✍️ Tumhara note:` likha hai, wahan apni baat likh do. Naya trap add karna ho to section 5 ka template copy karo.
> **Numbers ka source:** saare physics/trap numbers seedha code se liye hain (`src/core/physics.js`, `src/core/game.js`, `src/levels.js`). Code badle to yahan bhi badalna.
> **Structure:** installed `design-system` skill ke GDD sections (Overview → Player Fantasy → Rules → Formulas → Edge Cases → Tuning Knobs → Acceptance Criteria) aur `art-bible` / `team-level` / `balance-check` ke lenses pe bana hai. Unka "har section pe approval" wala process skip kiya, kyunki tumne poora kaam ek saath maanga.

---

## Index
1. [Ab tak kya bana](#1-ab-tak-kya-bana)
2. [Game ek nazar mein + Player Fantasy](#2-game-ek-nazar-mein--player-fantasy)
3. [Rage-bait ke 10 niyam](#3-rage-bait-ke-10-niyam-design-pillars)
4. [Core gameplay: kya karne se kya hoga](#4-core-gameplay-kya-karne-se-kya-hoga)
5. [Trap Bible](#5-trap-bible-har-trap-detail-mein)
6. [Levels aur difficulty](#6-levels-aur-difficulty)
7. [Animation: smooth aur funny](#7-animation-smooth-aur-funny)
8. [Graphics aur motion graphics](#8-graphics-aur-motion-graphics)
9. [Sound aur game feel](#9-sound-aur-game-feel)
10. [UI, accessibility, mobile](#10-ui-accessibility-mobile)
11. [Tuning knobs](#11-tuning-knobs-sab-numbers-ek-jagah)
12. [Edge cases](#12-edge-cases-ajeeb-situations)
13. [Acceptance criteria](#13-acceptance-criteria-kab-maanein-ki-sahi-bana)
14. [Skills ka istemaal](#14-skills-ka-istemaal-ab-tak-aur-aage)
15. [Khule sawaal + tumhare notes](#15-khule-sawaal--tumhare-notes)

---

## 1. Ab tak kya bana

### 1.1 Planning
| Cheez | File | Kya hai |
|---|---|---|
| Game plan v4 | `GAME_PLAN.md` | Concept, modes (solo + private room), skills timeline (10 stages), ₹0 budget stack, milestones, status |
| Asset list | `assets/ASSET_LIST.md` | 13 models ka status, Gemini → Meshy pipeline, seekh |
| Ye document | `docs/GAME_DESIGN.md` | Gameplay ka poora design |

### 1.2 Website research (inkfinitystudio.store)
- Brand tokens nikaale: cream `#fffbf7`, ink `#1f1916`, crimson `#8b0d1a`, fonts Outfit / Plus Jakarta Sans / JetBrains Mono, 8px button radius, ease `cubic-bezier(.22,.61,.36,1)`.
- Game Room mein Chibi 3D Ludo mila: Three.js + Cloudflare Worker + WebSocket rooms (`/rooms/reserve`, `/ws/room/{code}`), aur iframe embed (`?embed=1&parentUrl=`). Hamara game bhi isi pattern pe banega.

### 1.3 3D assets (18 models)
- **Pipeline:** Gemini (Nano Banana) + Meshy v2 Text-to-3D (`tools/meshy-image-to-3d.mjs`, `tools/meshy-text-to-3d.mjs`) → `gltf-transform optimize` (meshopt + WebP 1024px).
- **Models:** Momo, Mimi, Darwaza Ji, Gappu sign, Kabootar, Lollipop tree, Cotton cloud, Banana peel, Boxing glove, Rubber chicken, Candy boulder, Checkpoint flag, Co-op switch, Mystery gift box (`gift_box`), Mirror robot (`toy_robot`), Peek-a-boo ghost (`cute_ghost`), Golden key (`golden_key`), Ticking bomb (`ticking_bomb`).
- **Mimi:** Momo ka mesh recolor (`tools/recolor-glb.mjs`), peach body + mint sprout.

### 1.4 Khelne layak game (Worlds 1–5 + Online Couples Co-op) ✅
| Hissa | File(s) | Kya karta hai |
|---|---|---|
| Physics | `src/core/physics.js` | Tile-based platformer: run, proportional analog `moveX`, jump, coyote time, jump buffer, wall/ceiling hits, conveyor/slow/launch modifiers, inverted gravity (`gravDir = -1`) |
| Game rules | `src/core/game.js` | Traps, shared-fate co-op death/respawn, win (`coopOnly` guard), keys (`*`), hold plates (`H`/`h`), full-height laser gates (`=`/`-`), bomb defusal (`@`), `prevX/prevY` snapshots. Fixed 60 Hz step, rendering se alag |
| Level format | `src/core/level.js` | ASCII map (`29` tile/trap types + markers + `coopOnly`) → level |
| Levels | `src/levels.js` | **42 levels** across Worlds 1–5: Worlds 1–4 Solo (`L1–L35`) + World 5 Couples Co-op (`L36–L42`) |
| Save | `src/save.js` | `localStorage` persistence (`unlocked`, `bestDeaths`, `totalDeaths`, `muted`, `assist`) |
| Text | `src/i18n.js` | Saara player-facing text ek table mein (Hinglish). |
| 3D duniya | `src/render/world.js` | World 1–5 themes + fog, instanced tiles, zero red trap hints, tall laser barriers, Darwaza padlock, bomb fuse/defuse bars, spinning golden key |
| Diorama map | `src/render/diorama.js` | Tabletop 3D diorama (`42` level nodes across `5` world islands, uddta kabootar) |
| Momo & Mimi | `src/render/momo.js` | Render interpolation, `dt`-independent squash/stretch, eye lag, idle sit/sleep gags, gravity flip, crusher pancake & pit stretch |
| FX | `src/render/fx.js` | Death confetti (90 tukde) + fixed 16-particle dust pool + ambient motes |
| HUD/menu & Fullscreen | `index.html`, `src/style.css`, `src/ui/hud.js`, `src/utils/fullscreen.js` | Inkfinity UI (`100dvh`), Iris wipe, crack banner, auto-fullscreen + `#btn-fullscreen` toggle, Leave Co-op button, 5-World Map |
| Input | `src/input.js` | Keyboard, smooth **Virtual Analog Joystick** (`moveX` + pull-down fast-fall), gamepad |
| Sound | `src/audio.js` | Web Audio SFX (20+ cues incl. key, gate, defuse, boom, locked door) + per-world procedural loop (`Worlds 1–5`) with 0.5s death ducking (0 KB) |

### 1.5 Quality
- **192 automated tests** (`npm test`): `save.test.js`, `levels.test.js`, `game.test.js`, `solutions.test.js` (`L1–L35` + precision sweeps), `coop.test.js`, `coopSolutions.test.js` (`L36–L42` coordination + gate bypass prevention), `roomCode.test.js`, `worker/roomLogic.test.js`.
- Production build (`npm run build`) 100% clean, deployed live on Cloudflare Workers & `inkfinitystudio.store/game-room`.

### 1.6 Chalana
```bash
npm run dev
```
Phir http://localhost:5173 kholo. Seedha kisi level pe jaane ke liye `?level=2`.

✍️ Tumhara note:

---

## 2. Game ek nazar mein + Player Fantasy

**Ek line:** cute jelly-blob Momo ko darwaze tak pahunchao. Har level tumhe dhokha deta hai, floor, sign, darwaza, sab jhooth bolte hain, aur online mode mein tumhara dost bhi.

**Player kya mehsoos kare (fantasy):**
> "Main smart hoon, ye level bachchon wala hai… *(mar gaya)* …WHAT?! 😂 Achha, ab samajh gaya… *(phir mar gaya, naye tareeke se)* …ARGH! Bas ek aur try." *(jeet gaya)* "HAHA! Dekha?!"

**Emotion curve, har level ka (≈20–90 sec):**
```
Bharosa ──► Dhoka (death) ──► Hansi ──► Seekh ──► Pakka plan ──► Naya dhoka ──► ... ──► Jeet (garv)
 "aasaan hai"   "WHAT"       taunt+confetti  "aha!"     "ab nahi marunga"  "ye kahan se aaya"     screenshot
```
- **Frustrate** karo, par **unfair** mat karo: gussa player pe aaye ("main bewakoof hoon"), game pe nahi ("game cheat hai").
- **Irritate** karo chhoti cheezon se: darwaza bhaag jaata hai, sign jhooth bolta hai, kabootar hasta hai.
- **Aggravate** karo "almost" moments se: darwaza 1 tile door tha aur floor gir gaya.

---

## 3. Rage-bait ke 10 niyam (design pillars)

Har naya trap ya level in niyamon pe check karna:

| # | Niyam | Matlab | Game mein kaise |
|---|---|---|---|
| 1 | **Pehli baar dhoka, doosri baar mauka** | Har trap pehli try mein pakad sakta hai, par doosri try mein bachne layak ho | Bot test: naive player phanse, sahi player jeete ✅ |
| 2 | **Turant wapas** | Marne ke baad 1 sec se kam mein dobara khelo | Death pause 0.6s ✅ (🎛️ 0.4–0.8) |
| 3 | **3-beat rule** | Pattern 2 baar safe dikhao, teesri baar dhoka | L1: 9 safe tiles, 10th girta hai ✅ |
| 4 | **Koi random nahi** | Same input = same result. RNG death kabhi nahi | Fixed 60 Hz physics, deterministic traps ✅ |
| 5 | **Bharosa banao, phir todo** | Jo cheez pehle madad kare, wahi baad mein dhoka de | Sign L1 mein bhi "Safe" kehta hai… aur L3 mein bhi 😈 |
| 6 | **Ego bait** | Level ke naam aur text player ko over-confident banayein | "Bilkul Aasaan", "Upar Mat Dekhna" ✅ |
| 7 | **Almost-win** | Sabse bura dhoka jeet ke 1 kadam pehle | Darwaza bhaag jaata hai jab tum 2 tile door ho ✅ |
| 8 | **Hansi > saza** | Death funny ho (confetti, taunt), gore nahi, lambi saza nahi | Confetti + kabootar ✅ |
| 9 | **Seekh ka hint** | Marne ke baad trap thoda "dikh" jaaye, taaki player seekhe | Invisible block reveal + death ke baad `killerTrapIndex` crimson outline + Bharosa Mode ✅ |
| 10 | **Troll v2** | Jab player trap seekh le, kabhi kabhi trap badal do | 🔜 same level, 3 deaths ke baad naya twist |

✍️ Tumhara note:

---

## 4. Core gameplay: kya karne se kya hoga

### 4.1 Controls
| Action | Keyboard | Gamepad | Mobile |
|---|---|---|---|
| Chalna | ← → / A D | D-pad / left stick (`moveX`) | Smooth **Virtual Analog Joystick** (proportional speed) ✅ |
| Fast-fall | ↓ / S | D-pad / stick down | Joystick neeche pull (`ny > 0.68`) ✅ |
| Koodna | Space / ↑ / W | A (button 0) | ⤒ (crimson) |
| Restart / Fullscreen | R | Start | ↺ / ⛶ buttons ✅ |

### 4.2 Momo ki physics (code ke asli numbers)
| Cheez | Value | Matlab |
|---|---|---|
| Chalne ki speed | 6.5 tiles/sec | |
| Ground acceleration | 60 tiles/s² | 0.1 sec mein full speed: controls tight lagein |
| Hawa mein acceleration | 35 tiles/s² | Hawa mein bhi thoda control |
| Jump velocity | 14.4 tiles/sec | |
| Gravity | 40 tiles/s² | |
| **Jump height** | **2.6 tiles** | h = v² / 2g = 14.4² / 80 |
| **Jump time (hawa mein)** | **0.72 sec** | t = 2v / g |
| **Jump ki lambai (full speed)** | **4.68 tiles** | 6.5 × 0.72 |
| Max girne ki speed | 22 tiles/sec | |
| Coyote time | 0.10 sec | Ledge chhodne ke baad bhi 0.1s tak jump ho sakta hai (fair feel) |
| Jump buffer | 0.12 sec | Zameen chhoone se 0.12s pehle dabaya jump bhi chalega |
| Momo ka size | 0.72 × 0.86 tiles | Collision box |

**Iska level design pe matlab:**
- Gap ≤ 3 tiles: aaram se. 4 tiles: achha jump chahiye. 4.6+ tiles: lagbhag impossible, kabhi mat banana.
- 2 tiles oonchi deewar pe chadh sakte ho, 3 pe nahi.

### 4.3 Game ka state flow
```
Loading → Menu ──Solo──► Level intro (toast 1.6s) → PLAYING
                                                   │
             ┌──── trap / spikes / gaddha ─────────┤
             ▼                                     │
           DEAD (0.6s: confetti, taunt, 💀+1) → RESPAWN (level reset) → PLAYING
                                                   │
                                     darwaza chhua ┘→ WIN (toast) → agla level → … → END screen (kul deaths)
```

### 4.4 Death ke niyam
| Kaise mare | Kab | Code |
|---|---|---|
| Gaddha (pit) | Momo ke pair `y < −2` (ya inverted gravity mein `y > H + 3`) | `checkHazards` ✅ |
| Kaante (spikes) | Floor (`cy..cy+0.5`) ya ceiling (`#` ke neeche `cy+0.5..cy+1.0`), 0.12 side margin | `checkHazards` ✅ |
| Chhupe kaante | Wahi, jab active ho | ✅ |
| Crusher, boulder, chomp | Overlap hone par `crushed`, `boulder`, `chomp` | Section 5 ✅ |

**Death ke baad:** 💀 counter +1 (bump animation), confetti, kabootar ka random taunt (60% level ka apna, 40% generic), level poora reset: traps wapas, darwaza wapas, Momo start pe.

### 4.5 Jeet
- Darwaze ka hitbox: 0.7 wide × 1.2 high. Hawa mein chhoona bhi chalega.
- Win toast: "Level paar! 💀 × N". Zero death pe "Ek bhi death nahi?! Cheater 🤨".
- Aakhri level ke baad end screen: kul deaths.

### 4.6 Level banane ka format (ASCII)
```
#  zameen         ^  kaante (floor/ceil)  P  Momo start      D  darwaza
F  girta floor    G  nakli floor          I  invisible block S  chhupe kaante
B  banana peel    R  rubber chicken       C  chomp coin      X  nakli win darwaza
>  conveyor ->    <  conveyor <-          M  crusher         V  boxing glove
O  boulder        U  controls flip        Y  gravity flip    Z  slow caramel
W  sneeze cloud   K  nakli checkpoint     N  dark candle
1..9 / T / A / E = marker (e.g. door run stops: runTo: ['1','2','3','4'])
```
Level 1 asal mein aisa dikhta hai:
```
.P.T..................D...
##########F###...#########
##########.###...#########
```
Trap tuning: `traps: [{ at: 'D', runTo: 'T', radius: 2.2 }, { at: 'S', delay: 0.12, radius: 1.6 }]`

✍️ Tumhara note:

---

## 5. Trap Bible (har trap detail mein)

**Har trap ka template:** Dikhta kya hai · Trigger · Kya hota hai · Timing · Bachne ka tareeka · Variants · Status

### 5.1 Girta Floor (Falling Floor) ✅ `F`
- **Dikhta kya hai:** bilkul normal zameen.
- **Trigger:** Momo us tile pe khada ho (zameen pe, aur box ka thoda sa bhi hissa tile ke upar).
- **Kya hota hai:** tile 0.25s kaanpti hai (left-right shake), phir gravity se girti hai aur ghoom jaati hai. Neeche gaddha.
- **Timing:** 🎛️ delay 0.25s. Full speed pe Momo 0.25s mein 1.6 tile chalta hai, isliye 1 tile ka girta floor daud ke paar ho sakta hai. Khade raho to gire.
- **Bachne ka tareeka:** kood ke paar karo, ya daudte raho (agar aage zameen hai).
- **Variants 🔜:**
  - *Domino:* 5 tiles ek ke baad ek girein, piche se peecha karte hue.
  - *Delayed:* delay 1.5s, player sochta hai safe hai, ruk jaata hai… gir jaata hai.
  - *Wapas aane wala:* girke 2s baad wapas aa jaaye (timing puzzle).
  - *Ulta:* tile upar ud jaaye aur Momo ko chhat se dabaa de.

### 5.2 Nakli Floor (Ghost Floor) ✅ `G`
- **Dikhta kya hai:** bilkul zameen jaisa (same model, same rang).
- **Trigger:** koi nahi, ye kabhi solid hai hi nahi.
- **Kya hota hai:** Momo seedha andar dhans jaata hai. Sirf sprout dikhta hai jab wo neeche jaata hai 😄
- **Bachne ka tareeka:** doosra raasta (L3 mein upar wala platform). Sign "Safe ➜" isi ki taraf ishara karta hai.
- **Hint 🔜:** marne ke baad nakli tiles pe 1 sec ki shimmer (shader), taaki player "aha" kare.
- **Variants 🔜:** aadha pul nakli, aadha asli (yaad rakhna padega); nakli floor jo sirf doosre player ke liye asli ho (co-op).

### 5.3 Invisible Block ✅ `I`
- **Dikhta kya hai:** kuch nahi, khali hawa.
- **Trigger:** Momo neeche se (sir) ya side se takraaye.
- **Kya hota hai:**
  1. Block dikh jaata hai (crimson).
  2. Momo **ruk jaata hai** (vx = 0) aur **neeche thappad** (vy ≤ −4).
  3. **0.35s dizzy:** koi control nahi, Momo hilta hai (wobble).
  4. Dizzy ke waqt neeche gaddha hai, to mara.
- **L2 ka asli design:** block door wale ledge ke upar (col 8, height 5). Edge ke paas wala natural jump (take-off x 4.5–6.0) har baar takraata hai aur gaddhe mein. Pehle se kooddo (take-off **x 2.9–4.4**, ~0.23s window), to block ke neeche se nikal jaoge. Bot sweep se naapa.
- **Formula:** safe window ki chaudai ≈ (block column − landing ledge column) + 1.38 tiles. Block ko ledge se aage karo to window bada, peeche karo to chhota.
- **Variants 🔜:** invisible seedhi (sirf takrane pe dikhe, upar chadhne ke kaam aaye), invisible deewar jo darwaze ke saamne ho, "?" block jo coin ki jagah kaanta de.

### 5.4 Chhupe Kaante (Hidden Spikes) ✅ `S`
- **Dikhta kya hai:** saaf zameen.
- **Trigger:** Momo kaante wali tile se 🎛️ 1.6 tile (radius) ke andar aaye aur zyada upar na ho (2 tile ke andar).
- **Kya hota hai:** 0.12s baad kaante pop hote hain (scale animation, overshoot ke saath).
- **Timing ka gyaan:** 1.6 tile full speed pe 0.25s mein. Kaante 0.12s mein nikalte hain, isliye daud ke nikalna namumkin. Kood ke paar karna padega.
- **Variants 🔜:** pehli baar trigger pe nahi nikle, doosri baar pe nikle (troll v2); kaante jo kood dabate hi nikalein (anti-jump); kaante ki line jo ek ke baad ek nikle (wave).

### 5.5 Bhaagta Darwaza (Running Door) ✅ `D` + target marker
- **Dikhta kya hai:** Darwaza Ji, halka sa hilta hua (idle wobble).
- **Trigger:** Momo darwaze se 🎛️ radius (L1: 2.2, L3: 2.5 tile) ke andar aaye.
- **Kya hota hai:** darwaza 3 tile ooncha uchhalta hai, 2 baar ghoomta hai (0.45s), aur target jagah pe utarta hai. Ek level mein ek baar.
- **L1:** wapas start pe bhaag jaata hai, aur tumhe girte floor aur gap ko dobara paar karna padta hai.
- **L3:** kaante ke peeche, deewar se chipak ke.
- **Variants 🔜:** darwaza tumhari taraf bhaage (jab tum bhaag rahe ho to takraake gir jao); darwaza 3 baar bhaage; darwaza chhupe jab tum dekho (camera troll); "cardboard darwaza" jo gir jaaye aur peeche asli wala ho.

### 5.6 Kaante (Spikes) ✅ `^` · Gaddha ✅
- Normal khatre. Fairness ke liye hitbox thoda chhota.

### 5.7 Implemented & Planned traps (World 1–3)
| Trap | Dikhta kya hai | Trigger | Kya hota hai | Bachne ka tareeka | Model / Status |
|---|---|---|---|---|---|
| **Ceiling Crusher** (`M`) | Muskurata hua dark block upar | Momo neeche se guzre (`< 1.9`) | `0.16s` shake ke baad dhadaam, pancake | Ruko, girne do, uthte waqt nikal jao | code ✅ |
| **Conveyor Belt** (`>`/`<`) | Moving chevron belt | Upar khade ho | Speed `±3.2` tiles/sec judti hai | Belt ke hisaab se jump timing | code ✅ |
| **Nakli Checkpoint** (`K`) | Flag | Chhuo | "Checkpoint saved! ✅" → "Jhooth tha 😂", flag ud jaata hai | Flag pe bharosa mat karo | `checkpoint_flag` ✅ |
| **Banana Peel** (`B`) | Chhilka | Upar se guzro (`onGround`) | `1.5s` phisalna (jump band, `8.5` speed) | Kood ke paar | `banana_peel` ✅ |
| **Boxing Glove** (`V`) | Deewar pe plate + glove | Saamne aao (`< 2.3`) | `0.12s` windup → `2.8`–`3.2` tile punch (`vx = ±16`) | Bait karke retract pe niklo ya upar koodo | `boxing_glove` ✅ |
| **Rubber Chicken** (`R`) | Pyaari murgi | Upar kooddo / chhuo | `1.42×` jump velocity (~`5.2` tiles = 2× height), chhat ke kaanton mein | Murgi ke upar se koodo, ya khule aasmaan mein use karo | `rubber_chicken` ✅ |
| **Chhenk wala Badal** (`W`) | Cotton cloud | Neeche aao (`< 1.5`) | `0.45s` phoolta hai → "Aaa-chhoo!" wind push (`1.8s` cooldown) | Bait karke peeche hato, cooldown mein niklo | `cotton_cloud` ✅ |
| **Chomp Coin** (`C`) | Chamakta gold coin | Chhuo | Daant nikal ke kaat leta hai = death (`chomp`) | Coin mat lo (lalach!) | code ✅ |
| **Rolling Boulder** (`O`) | Candy boulder | Trigger line (`triggerDist`) | Peeche/saamne se lurhakta aata hai | Upar se kood jao | `boulder` ✅ |
| **Controls Flip** (`U`) | Glowing ring pad | Chhuo | `← →` ulte (`3.0s`), HUD pe `🔄 Ulta!` | Ulta soch ke khelo | code ✅ |
| **Gravity Flip** (`Y`) | Lavender zone | Zone entry | Momo chhat pe chalta hai (`gravDir = -1`), neeche koodta hai | Ceiling kaante dekho, doosre `Y` tak jao | code ✅ |
| **Nakli "LEVEL COMPLETE"** (`X`) | Asli jaisa darwaza | Chhuo | Banner crack + confetti… neeche `FFF` bridge gayab | Darwaze ke upar se koodo | `darwaza` + CSS ✅ |
| **Slow Floor** (`Z`) | Chipchipa caramel | Upar chalo | Speed `0.5×`, jump `0.78×` | Pehle se koodo ya solid kinare se | code ✅ |
| **Dark Candle** (`N`) | Jalti mombatti | Chhuo | `1.8s` duniya andheri (`hemi/sun` dim) | Aage ka rasta yaad rakho | code ✅ |
| **Camera Troll** | — | Zone | Camera aage khisak ke trap chhupa deta hai | Yaad rakho | 🔜 |
| **Pause Trap** (1 baar) | — | Pause dabao | Pause screen pe bhi kaante dikhte hain | Bas mazaak | 🔜 |
| **Mirror Momo** | Doosra Momo (glass) | Zone | Ulta chalta hai | Dimaag lagao | 🔜 |
| **Nakli Death Counter** | HUD | Random | 💀 counter achanak +5 | Sirf irritation | 🔜 |

### 5.8 Co-op coordination puzzles & traps ✅ (`World 5`, L36–L42)
| Mechanic | Char | Kya hota hai |
|---|---|---|
| **Golden Key** ✅ | `*` | Collect all keys (`keysLeft === 0`) to unlock the golden padlock on Darwaza Ji (`golden_key.glb`) |
| **Hold Plate A / B** ✅ | `H` / `h` | Crimson (`H`) ya Mint (`h`) arcade button (`coop_switch.glb`): tab tak dabaa jab tak ek partner upar khada rahe |
| **Hazard Laser Gate A / B** ✅ | `=` / `-` | Full-height vertical laser wall floor se chhat tak — sirf jab partner `H`/`h` dabayega tab khulti hai (upar se kood nahi sakte) |
| **Paired Ticking Bomb** ✅ | `@` | Proximity fuse countdown (`ticking_bomb.glb`); ek partner bomb defuse karta hai jab doosra partner `H` button daba ke support de — time 0 pe kaboom! Shared-fate death! |
| **Peek-a-Boo Watchtower** ✅ | `Q` + `H` | Ek partner plate par khada hoke Ghost ki taraf dekhe (freeze) tab doosra partner cross kare |

### 5.8.1 New Progressive & Funny Traps ✅ (`!` `%` `$` `~` `+`)
| Trap | Char | Visual / Model | Trigger & Funny Effect | Co-op Twist |
|---|---|---|---|---|
| **Spring Trap** ✅ | `!` | Normal ground tile (zero red hints!) → reveals `spring_pad.glb` | `0.08s` delay → catapults player skyward (`vy = 21.5`) into ceiling spikes unless jumped; resets `0.9s` | Holding `H` (`channelA`) pins `!` down |
| **Magnet Orb** ✅ | `%` | Hovering `magnet_orb.glb` | Pulls jump arcs sideways via `beltVx` over pits/hazards | Holding `h` (`channelB`) reverses polarity to boost partner forward |
| **Pie Cannon** ✅ | `$` | `pie_cannon.glb` | Fires cream pie projectile → splats player (`1.4s` slow `0.65×` + knockback `9.5`) | Jump over pie or time cooldown (`2.2s`) |
| **Disco Floor** ✅ | `~` | Normal ground tile (zero red hints!) → neon pink pulse | Triggers `1.1s` uncontrollable funky dance bounce (`danceTimer`) | Holding `h` (`channelB`) pauses the disco beat |
| **Sync Plate** ✅ | `+` | Amber twin `coop_switch.glb` | Both partners must step on `+` within `0.9s` to latch `=` gates open for `2.5s` | Synchronized couple countdown |

### 5.8.2 Character Animations (`src/render/momo.js`) ✅
- **Per-trap reactions:** `boing`/`launch` (stretch + flail), `slip` (windmilling spin), `pie` (wobbling splat stagger), `disco` (side-to-side funk groove + bounce), `punch`/`sneeze` (horizontal recoil), `bonk` (dizzy head wobble), `flip` (barrel roll), `magnetPull` (tilt strain), `sticky` (squat).
- **Per-death poses:** `crushed`/`boulder` (flat pancake), `pit` (stretched plummet), `bomb` (rocket spin + char shrink), `gate`/`spikes`/`chomp`/`robot`/`ghost` (electric pop/jitter).

### 5.9 Trap combos (jo sabse zyada gussa dilaate hain)
1. **Sign + Nakli floor:** "Safe ➜" seedha nakli pul ki taraf (L3 ✅).
2. **Gap + Invisible block:** normal jump pe thappad, gaddhe mein (L2 ✅).
3. **Darwaza bhaage + kaante:** darwaza kaante ke peeche jaake chhup jaaye (L3 ✅).
4. **Lalach + girta floor:** coin girte floor pe.
5. **Nakli LEVEL COMPLETE + girta floor:** jashn ke beech mein maut.
6. **Banana + glove:** phisal ke glove ke saamne, glove gaddhe mein.
7. **Checkpoint jhootha + lamba level:** sab shuru se, par level chhota hi rakho (niyam 2).
8. **Troll v2:** jo trap 3 baar maar chuka, chauthi baar wo trap gayab, aur bachne wala raasta hi trap ban jaaye.

✍️ Tumhara note (naya trap idea yahan likho, upar wale template mein):

---

## 6. Levels aur difficulty

### 6.1 Har level ka formula: Teach → Test → Twist
1. **Teach (sikhao):** ek safe jagah pe nayi cheez dikhao (girta floor jahan neeche zameen ho).
2. **Test (parkho):** wahi cheez thoda khatre ke saath.
3. **Twist (dhoka):** wahi cheez ulti ya naye combo mein.
- Ek level = 1 naya idea + max 3–4 tricks. Length 20–60 sec agar pata ho kya hoga.

### 6.2 Difficulty ke 6 knobs
| Knob | Easy | Medium | Hard | Kabhi nahi |
|---|---|---|---|---|
| **Precision window** (safe timing) | ≥ 0.35s | 0.20–0.30s | 0.12–0.18s | < 0.10s |
| **Reaction time** (trap delay) | ≥ 0.5s | 0.25s | 0.12s | 0 (instant, bina hint ke) |
| **Memory** (traps per level) | 1–2 | 3 | 4–5 | 7+ |
| **Deception** (jhoothi info) | sign sach | 50/50 | sab jhooth | — |
| **Punishment** (death pe kitna wapas) | 5 sec | 15 sec | 30 sec | 60+ sec bina checkpoint |
| **Gap width** | 2 | 3 | 4 | ≥ 4.6 (impossible) |

**Precision window kaise naapein:** `tools` mein bot sweep script (jaise L2 ke liye kiya: take-off point 0.1 tile ke steps mein, kaun jeeta, kaun mara). 🔜 Ise permanent test bana dena (`balance-check` skill ke saath).

### 6.3 Death target (balance)
| Level type | Pehli baar khelne pe deaths | Kitne sec mein jeet |
|---|---|---|
| Tutorial (L1) | 2–5 | 1–2 min |
| Normal | 5–12 | 2–4 min |
| Breather (har 5th) | 0–2 | 30 sec |
| Mini-boss (har world ka 10th) | 15–30 | 5–8 min |
🔜 Playtest mein naapna (`playtest-report` skill), aur jo level 30+ deaths le, uska window bada karna.

### 6.4 Level Devil redesign (17 Nov 2026) ✅
Inspiration: *Level Devil* trailer (Unept). Har level ab **kamron (rooms)** se bana hai: ek room = ek screen, ek trap family. Shuru mein 1 room, aakhri levels mein 6 rooms, isliye lambai badhti hai par feel wahi rehti hai.

| Band | Levels | Rooms | Width (tiles) |
|---|---|---|---|
| Tutorial-troll | L1–L5 | 1–2 | 26–56 |
| Warm-up | L6–L12 | 2 | 50–60 |
| Rising | L13–L22 | 3 | 78–90 |
| Hard | L23–L34 | 4 | 112–123 |
| Devil | L35–L44 | 3–5 | 85–154 |
| Finale | L45–L47 | 6 | 170–178 |
| Co-op | L48–L62 | 2–6 | 52–173 |

Breathers: L10, L15, L20, L25, L30, L35, L40 (chhote, par phir bhi ek purana trap).

**Kahan kya hai:**
- Rooms: `src/levels/rooms.js` (solo traps), `src/levels/coopRooms.js` (co-op puzzles + unki `script` choreography). Har room `h` (0..1) leta hai: debut pe 0, baad mein level ke hisaab se tight.
- Level list: `src/levels/solo.js` (SCHEDULE), `src/levels/coop.js`. Jodne wala: `src/levels/compose.js`.
- Text: `src/levels/soloText.js` (`sN.*`), `src/levels/coopText.js` (`cN.*`). Hint button: `src/levels/roomHints.js` (jis room mein khade ho uska hint).

**Callback rule (har purana trap wapas aata hai, aur mushkil hokar):** `src/core/trapLedger.js` + `trapLedger.test.js`. Solo: har trap ≥3 levels, do appearances ke beech ≤8 levels, aakhri 10 levels mein zaroor, kabhi debut se aasaan nahi; L6 se har level mein max 1 naya trap aur kam se kam 1 purana. Co-op: ≥3 levels, gap ≤6, aakhri 5 mein.

**Fairness:** `node tools/solve-levels.mjs` har level room-by-room solve karke `src/replays.json` likhta hai (trap rooms = beam-search bot, co-op puzzle rooms = script). `replays.test.js`: replay jeetna chahiye, aur sirf right bhaagne wala kabhi nahi jeetta. Naya room banao to `node tools/check-rooms.mjs [--coop] [--h 1]`.

**Naye traps:** `;` girta kaanta (bilkul chhat ke kaanton jaisa dikhta hai), `]` band hoti deewar, `[` upar uthti zameen, `&` aara (Meshy model), `{` size swell (Momo giant), `,` spike-swap (2 baar safe, teesri baar kaante). `F` ka `near`: paas aate hi gaddha khulta hai.
**Solo se hataye (code/model abhi bhi hain):** gift box, countdown, magnet, disco, sneeze, caramel, anti-jump.

### 6.5 Worlds
World 1 = L1–L12, World 2 = L13–L24, World 3 = L25–L36, World 4 = L37–L47, World 5 (Couples Co-op, `coopOnly`) = L48–L62. Har level ka naya trap aur rooms ki list `src/levels/solo.js` / `src/levels/coop.js` mein comment ke saath hai.

### 6.6 Level map ✅
Resin-miniature jaisa 3D tabletop diorama (`src/render/diorama.js`) + `src/save.js` (`localStorage` progress & `bestDeaths` per level, save key `dta.save.v2`). 5 world islands (`62` level nodes), aur selected node pe uddta kabootar.

✍️ Tumhara note:

---

## 7. Animation: smooth aur funny

### 7.1 Ab kya hai ✅ (sab code se, bina bones ke)
| Animation | Kab | Kaise |
|---|---|---|
| **Squash (landing)** | Zameen chhoone pe | Chauda 1.15×, chhota 0.8×, phir 0.1s mein wapas |
| **Stretch (jump)** | Jump pe | Patla, lamba. Hawa mein upar jaate stretch, neeche aate squash |
| **Walk bob** | Daudte waqt | sin(t×16) se chhota uchhalna |
| **Idle saans** | Khade | Halki saans (scale) |
| **Lean** | Speed ke saath | Aage jhukna (velocity ka 18%) |
| **Muhna** | Direction | 0.35 rad us taraf ghoomna |
| **Blink** | Har 2–4.5 sec | 0.12s aankh band |
| **Surprise** | Trap trigger | Aankhein 1.5× chaudi, 0.6s |
| **Dizzy** | Invisible block | Tez wobble 0.35s |
| **Death** | Kisi bhi death | Momo gayab + 90 confetti + camera shake 0.35s |
| **Darwaza** | Bhaagte waqt | 3 tile uchhal, 2 chakkar. Idle mein halki hil |
| **Girta floor** | Trigger | Kaanpna, phir ghoomte hue girna |
| **Kaante** | Pop | Overshoot ke saath scale |
| **Kabootar, badal** | Hamesha | Bob, drift |

### 7.2 Smoothness & Game Feel ✅
1. **Render interpolation ✅:** `prevX`/`prevY` snapshots + `alpha = acc / FIXED`, taaki 120/144 Hz screens pe zero judder ho.
2. **dt-independent smoothing ✅:** `1 - Math.exp(-k * dt)` `momo.js`, `world.js`, `diorama.js`, aur `main.js` mein.
3. **Camera ✅:** dead-zone (`0.35` tiles), velocity look-ahead, trauma-squared sine-noise shake, aur `38° -> 36°` FOV punch.
4. **Hit-stop ✅:** `80 ms` game freeze on death before confetti burst.
5. **Landing dust pool ✅:** `createDust()` fixed 16-particle pool (`fx.js`), zero allocation.

### 7.3 Funny animations & Death variants ✅
- **Eye lag & Idle gags ✅:** Eyes velocity ke ulte thoda pichhe; 5s idle par Momo baith jaata hai, 10s par sleepy eyes (`eyeY = 0.35`).
- **Death variants ✅:** *Crusher* pancake squash (`1.55 × 0.22`), *Pit* lamba vertical stretch drop, *Spikes/Boulder/Chomp* pop + 90 confetti.
- **Darwaza Ji expressions ✅:** Code eyes blink karti hain, paas aane aur bhaagte waqt chaudi ho jaati hain.

### 7.4 Tools / skills
- `threejs-animation` (mixer, blending), `threejs-shaders` (sprout wobble, dissolve), `character-animation-qa` (frame sampling check), GSAP (`gsap-core`, `gsap-timeline`) UI ke liye.

✍️ Tumhara note:

---

## 8. Graphics aur motion graphics

### 8.1 Art direction (abhi ✅ / aage 🔜)
- **Palette:** Inkfinity (cream `#fffbf7`, crimson `#8b0d1a`, ink `#1f1916`) + candy pastels (peach `#f4b98f`, mint `#9fe3c9`, pink `#ff8fb0`). Sky gradient peach → cream. ✅
- **Shapes:** sab gol, chunky, "resin toy" jaisa. Koi nukili cheez nahi, sirf kaante (taaki khatra turant dikhe). ✅
- **Khatre ka rang:** sirf khatre crimson/laal (kaante, revealed block). Baaki sab pastel. Khatra turant pehchaana jaaye. ✅

### 8.2 Lighting aur rendering
| Cheez | Ab | Aage 🔜 |
|---|---|---|
| Lights | Hemisphere + sun, soft shadows (1024 map, player ke saath chalti) ✅ | Rim light (piche se), Momo ke kinare chamkein |
| Tone mapping | ACES filmic ✅ | Halka color grade (LUT): warm |
| Materials | Standard PBR ✅ | `MeshToonMaterial` + gradient map option: cartoon feel |
| Outline | — | Inverted-hull outline (sasta) ya OutlinePass: sticker jaisa look |
| Bloom | — | Bahut halka, sirf coins aur revealed traps pe |
| Depth | — | Peeche ke trees pe halki fog, parallax gehrai |
| AO | — | Sirf high preset mein (SSAO/N8AO) |

### 8.3 Background aur duniya
- Ab ✅: meadow strip, lollipop trees (seeded random), boulders, udte badal.
- Aage 🔜: 3 parallax layers (paas: ghaas aur phool, beech: trees, door: candy pahad), chhoti titliyan, hawa mein udte candy sprinkles, har world ka apna sky.

### 8.4 Shader effects 🔜
| Effect | Kab | Kyun |
|---|---|---|
| **Trap reveal shimmer** | Death ke baad, jis trap ne maara | Niyam 9: seekh ka hint |
| **Dissolve** | Nakli floor pe Momo dhansta hai | "Ye asli nahi tha" dikhana |
| **Squash wobble** | Jelly body | Vertex shader se jelly jaisa hilna, bina bones ke |
| **Ghost floor tell** | Har 4 sec pe 1 frame ka halka flicker (hard mode mein band) | Dhyan dene walon ko inaam |

### 8.5 Motion graphics (UI) 🔜
| Moment | Animation | Tool |
|---|---|---|
| Level intro | Crimson card slide-in + level naam letter-by-letter, 1.2s | GSAP timeline |
| Death counter | Bump ✅ → 10, 25, 50 deaths pe special shake + kabootar comment | CSS / GSAP |
| Taunt bubble | Pop ✅ → typewriter text + babble sound | GSAP |
| **Iris wipe** | Level khatam: Momo pe gol circle band hota hai (classic cartoon) | Shader / CSS mask |
| Nakli LEVEL COMPLETE | Banner, confetti, "🎉"… phir crack ho ke gir jaata hai | GSAP + 3D |
| End screen | Deaths number roll-up, kabootar ka "certificate" | GSAP |
| Reduced motion | Sab animations ka static version (abhi CSS mein ✅) | — |

### 8.6 Performance budget (mobile ko dhyan mein)
| Cheez | Budget | Abhi |
|---|---|---|
| FPS | 60 (min 45) mid Android | 60 desktop (integrated GPU) ✅ |
| Download | < 15 MB | 1.9 MB ✅ |
| Triangles on screen | < 150k | ~70k saare models milake ✅ |
| Draw calls | < 100 | Tiles instanced (2 calls) ✅ |
| Textures | 1024px WebP | ✅ |
| Quality presets 🔜 | Low: shadows off, pixel ratio 1 · High: AO, bloom | — |

✍️ Tumhara note:

---

## 9. Sound aur game feel ✅

| Event | Implemented (0 KB Web Audio Synth) |
|---|---|
| Jump / Land | Layered triangle+square boing · sine thud + soft dust noise ✅ |
| Traps | Slip whistle (`B`), chicken squeak (`R`), chomp crunch (`C`), glove punch (`V`), crusher slam (`M`), sneeze burst (`W`), flip chime (`U/Y`), boulder rumble (`O`), fake checkpoint jingle (`K`) ✅ |
| Death / Win | Wobble + noise pop · 4-note arpeggio + kabootar babble ✅ |
| Music | Per-world procedural loop (`World 1/2/3`) + 0.5s death ducking + `🔊`/`🔇` mute toggle ✅ |

**Comedy timing:** death sound aur taunt ke beech 120 ms gap, plus 80 ms hit-stop.

---

## 10. UI, accessibility, mobile
- **HUD:** level naam, `🗺️` Map, `↺` Restart, `🔊` Mute, `⛶` Fullscreen, `🚪` Leave Co-op, `🔄 Ulta!` flip badge, `1/2 Door` wait badge, `💀` counter ✅
- **Motion & Transitions:** Circular Iris Wipe between levels, intro slide-in, crack-drop fake banner, `prefers-reduced-motion` sab band rakhta hai ✅
- **Input & Mobile:** keyboard + gamepad + smooth **Virtual Analog Joystick** (`moveX` + pull-down fast-fall) + always fullscreen (`100dvh`), portrait phone-rotate hint ✅

---

## 11. Tuning knobs (sab numbers ek jagah)
| Knob | File | Abhi | Safe range | Badhane se |
|---|---|---|---|---|
| Move speed | physics.js `move` | 6.5 | 5.5–7.5 | Tez, mushkil control |
| Jump velocity | physics.js `jump` | 14.4 | 13–15.5 | Ooncha jump (levels todta hai!) |
| Gravity | physics.js `gravity` | 40 | 32–48 | Bhaari, tez girna |
| Coyote time | physics.js `coyote` | 0.10 | 0.06–0.14 | Zyada maafi |
| Jump buffer | physics.js `jumpBuffer` | 0.12 | 0.08–0.15 | Zyada maafi |
| Death pause | game.js `DEATH_PAUSE` | 0.6 | 0.4–0.8 | Lamba joke, dheema retry |
| Dizzy (stun) | game.js `STUN` | 0.35 | 0.25–0.5 | Zyada saza |
| Falling floor delay | levels `F.delay` | 0.25 | 0.12–1.5 | Daud ke nikalna aasaan |
| Hidden spikes delay | levels `S.delay` | 0.12 | 0.08–0.5 | Aasaan |
| Hidden spikes radius | levels `S.radius` | 1.6 | 1.0–2.5 | Pehle trigger |
| Door run radius | levels `D.radius` | 2.2 / 2.5 | 1.5–4 | Pehle bhaage |
| Camera distance | main.js `camPos.z` | 14 / 20 portrait | 12–22 | Zyada dikhe, Momo chhota |
| Camera look-ahead | main.js | 1.2 | 0.5–2.5 | Aage zyada dikhe |
| Shake | main.js `shake` | 0.35 | 0–0.5 | — |
| Squash/stretch | momo.js | 0.22 / 0.28 | 0.1–0.4 | Zyada jelly |

⚠️ Physics knobs badle to `npm test` chalao. Bot tests batayenge ki koi level toota to nahi.

---

## 12. Edge cases (ajeeb situations)
| Situation | Kya hota hai | Status |
|---|---|---|
| Ek hi frame mein death aur darwaza | Death pehle check hoti hai, jeet nahi milti | ✅ |
| Respawn ke turant baad trap | Traps reset hote hain, Momo start pe | ✅ |
| Restart (R) dabaye rakho | Sirf ek baar restart (key-down edge) | ✅ |
| Tab chhod ke wapas aao | Keys release ho jaati hain, dt 0.1s pe capped | ✅ |
| Bahut kam FPS | Fixed 60 Hz physics, game slow nahi, same result | ✅ |
| Screen resize / phone ghumana | Camera limits naye size pe | ✅ |
| Gaddhe mein death | Confetti kinare pe dikhta hai (y ≥ 1.2) | ✅ |
| Level ke kinare | Left/right deewar, Momo bahar nahi jaata | ✅ |
| 2 traps ek frame mein | Pehli death hi count, double count nahi | ✅ |
| Online: dost disconnect | 20s reconnect window | 🔜 M2 |

---

## 13. Acceptance criteria (kab maanein ki sahi bana)
- [x] Har level ka naive raasta kam se kam ek baar maarta hai (bot test)
- [x] Har level sahi tareeke se 0 deaths mein jeeta ja sakta hai (bot test)
- [x] Death se respawn < 1 sec
- [x] Same input = same result (deterministic)
- [x] 60 FPS desktop integrated GPU, build < 15 MB
- [x] Keyboard + gamepad + touch
- [x] Har precision window ≥ 0.12s (sweep test in `solutions.test.js`) ✅
- [ ] 5 naye players pe playtest: avg deaths target range mein, koi 10 min se zyada ek level pe nahi atka 🔜
- [ ] Asli Android phone pe 45+ FPS 🔜
- [x] Render interpolation (`prevX/prevY` + `alpha`) implemented for 120/144 Hz screens ✅

---

## 14. Skills ka istemaal (ab tak aur aage)

**Ab tak use hue:**
| Kaam | Skill / tool |
|---|---|
| Plan likhna | `writing-plans` (structure), skill descriptions padh ke sahi skills chune |
| GDD structure | `design-system`, `art-bible`, `team-level`, `balance-check` (sections aur lenses) |
| Site style | Browser se CSS tokens (`visual-style` jaisa extraction) |
| Assets | Gemini Nano Banana → Meshy API → gltf-transform |
| Code | `test-driven-development` (tests pehle), `ponytail` (chhota code), engine rules (zero-alloc hot path) |
| Verify | `verification-before-completion`: tests, browser play-test, mobile, build check |
| Design hooks | `impeccable` (font/colour warnings triage) |

**Aage, is document ke har hisse ke liye:**
| Kaam | Skills (jugalbandi) |
|---|---|
| Naye traps + levels 4–10 | `team-level` → `playtest-report` → `balance-check` ↺ |
| Precision window test | `balance-check` + `test-driven-development` |
| Render interpolation, camera | `threejs-fundamentals` + `perf-profile` |
| Momo ke naye animations | `threejs-animation` + `threejs-shaders` → `character-animation-qa` |
| Toon/outline/bloom | `threejs-materials` + `threejs-postprocessing` |
| UI motion (iris wipe, intro card) | `gsap-timeline` + `frontend-ui-engineering` + `a11y-debugging` |
| Asli SFX/music | `ffmpeg` + jsfxr / Kenney CC0 / Pixabay (free) |
| Online co-op | `api-and-interface-design` → `test-driven-development` → `browser-testing-with-devtools` → `security-audit` |
| Har milestone gate | `code-review` → `verification-before-completion` → `milestone-review` |

---

## 15. Khule sawaal + resolved decisions
1. Death pause: `0.6s` (`DEATH_PAUSE = 0.6`) ✅
2. Zero Red Trap Hints / Zero Reveal: traps NEVER show any red wireframe outline or pre-reveal on retry or via any toggle (`world.js` cleaned) ✅
3. Kabootar ki awaaz: 0 KB Web Audio babble ✅
4. Mimi ke sir pe mint sprout (recolor GLB, M2 Co-op mein use hogi) ✅
5. World 1–3 (`L1–L30`) + World 4 Mind Games (`L31–L35`): poore 35 levels complete + bot-tested ✅
6. Naye unexpected Mind Games traps (`L` Launch Floor, `A` Anti-Jump, `J` Mystery Gift Box `gift_box.glb`, `E` Mirror Toy Robot `toy_robot.glb`, `Q` Peek-a-Boo Ghost `cute_ghost.glb`) + SVG HUD/map UI polish + fast-fall (`↓`/`S`) + contact drop-shadow + parallax sky shader ✅
7. Online 2-Player Co-op (`Momo` + `Mimi`) via Cloudflare Worker + Durable Object (`https://dont-trust-anyone.inkfintystudio-store.workers.dev`): shared-fate death restarts BOTH players, BOTH must reach door to clear level, 9-digit room codes + `?room=` invite links, mid-match reconnect support, zero jump-latch drops ✅
8. World 5 Couple Co-op (`L36–L42`, `coopOnly: true`): Golden Key (`golden_key.glb`), Hold Plates (`H`/`h`, `coop_switch.glb`), Full-height Laser Gates (`=`/`-`), Ticking Bomb Defusal (`ticking_bomb.glb`), always-fullscreen default landscape (`manifest.webmanifest`, `screen.orientation.lock('landscape')`) + Minimize-to-normal toggle + Landscape & Portrait ("front view") support, aur **strict Solo vs Co-op rules**: Solo (`L1–L35`, 2P levels locked) vs 2P Co-op hamesha **Level 1 (`L1`)** se shuru hoke saath `L1 → L42` paar ✅

✍️ Tumhare notes / naye ideas:

-
-
-
