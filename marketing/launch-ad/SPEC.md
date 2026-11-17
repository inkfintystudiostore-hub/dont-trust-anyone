# SPEC: Don't Trust Anyone, launch ad (Hook C)

GOAL:    a viewer laughs at the double death, thinks "mera dost bhi yahi karega", and taps the link or tags a friend.
OUTPUT:  HyperFrames, 1080 x 1920, 30 fps. Reels / Shorts / Moj.
TIME:    30.0 s x 30 = 900 frames. Music ~120 BPM (15 frames a beat) once a track is in.

LOOK:    the game's own world and brand, nothing invented.
         ground = the real gameplay footage (pastel candy world). Colour-field cards use the game tokens only:
         cream #fffbf7, ink #1f1916, crimson #8b0d1a (accent: one word per line, the skull count, the CTA).
         Display: Outfit 900, titles 96-132 px (5-7% of height), tracking -2%, line-height 0.95. Never under 44 px.
         Type material = the game's HUD pill: cream fill, 3 px #eadad0 border, radius 999, ink text, shadow 0 10px 0 rgba(31,25,22,.18)
         (a hard sticker shadow, no blur, no glow).
         Skull counter = the game's own skull icon + JetBrains Mono 800 crimson number, in a cream pill.
OBJECTS: Momo (cream), Mimi (peach), button, bomb, laser gate, ghost, launch floor, door that runs, "Safe ->" sign:
         all real game renders from marketing/footage. The room card is the real lobby UI.
MOTION:  enter: per word, blur 8px -> 0 + opacity 0 -> 1, 0.13 s, 0.07 s apart, no translate (titles over footage);
         slam: scale 1.35 -> 1 in 0.18 s expo.out with a 2-frame white flash on the card edge (slam cards);
         pill pop: scale 0.6 -> 1 back.out(2.2) 0.22 s (counter + labels);
         exit: blur 0 -> 6px + opacity -> 0 in 0.12 s. Camera on footage: punch-in scale 1 -> 1.12 power2.inOut on deaths.
         Death beat: footage freezes? no. 3-frame zoom punch 1 -> 1.08 -> 1.04 on the death frame.
SHOTS (s):
  0.0-2.3   c37_bomb. Frame 0: Momo + Mimi on L37 and "Ye game dost ke saath" / "mat khelna." already on screen (thumbnail).
            death at ~1.3: punch-in, counter pops 1, line 2: "Ek mara to" / "DONO marte hain" (DONO crimson). sfx: bonk.
  2.3-4.3   c36_release. "Bas 1 second" / "ruk na…" over Momo on the button; Mimi fried by the gate. counter 2. sfx: zap.
  4.3-8.9   2P montage, cut on each death: c38 laser, c39 squad, c40 ghost, c41 rocket. Game's own line per shot
            (small pill, 52 px). counter 3..6 then a fast roll to 23. sfx: rotate 3 hits.
  8.9-10.4  "Galti uski." / "Maut DONO ki." on a crimson field, the last c41 frame shrinking into a polaroid at 0.6 scale. sfx: bass hit.
  10.4-11.7 s01_fall start: "Akele khel loge?" over Momo walking happily.
  11.7-16.4 solo montage (0.6-0.9 s each, cut on death): s01 fall, s01 door runs, s02 bonk, s06 banana, s08 coin, s09 fake win.
            game's own taunt lines in pills. counter 24 -> 47.
  16.4-19.2 slam cards, colour fields alternating cream/ink/crimson, one line each 0.6 s:
            "Floor jhooth bolta hai." / "Sign bhi." / "Darwaza bhi." / "Aur DOST?" + "Sabse pehle." (1.0 s)
  19.2-22.6 c_lobby (real room UI): "Link bhejo." -> code shown; "Dost aaya." -> P2 joins; "Dosti gayi." -> match starts.
  22.6-26.0 world montage, 0.45 s cuts: s12, s14, s23, s29, s33, c42 with level names; type on top builds
            "42 Levels" / "5 Worlds" / "0 Bharosa" (0 in crimson).
  26.0-30.0 end card on cream: wordmark "DON'T TRUST ANYONE" stamps in word by word; the A of ANYONE drops out of the
            frame like a falling floor tile (0.5 s power3.in) at 27.4 with a bonk; then "Free · Browser mein · Koi download nahi",
            "inkfinitystudio.store/game-room" in an ink pill, and "Us dost ko tag karo jo tumhe marwayega" (crimson). Hold 2 s.
SAFE:    all words between y 168 and 1330; nothing in the right 140 px rail band below 900.
BANNED:  dark void, glow/bloom/neon, particles, purple-blue gradients, glass cards, everything fade-and-slide-up,
         titles drifting after they land, docked corner logo, three cards in a row, emoji as icons, invented UI or levels,
         claims not in the game (no bump button, no emotes, no "Betrayals" stats, no comparison to other games).
QA:      t=0 (thumbnail reads without sound), 1.4 (both die + counter), 3.6 (release gag), 9.5, 12.5, 17.5, 20.5, 24.5, 28.5 (CTA).
