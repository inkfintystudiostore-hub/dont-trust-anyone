# REVIEW: launch ad v1 (Hook C)

## How it is made
- **Footage:** every shot is real gameplay. `marketing/capture/capture.mjs` runs the game on a virtual 60 Hz clock and saves every 2nd frame (30 fps), with an in-engine camera that zooms in and follows Momo/Mimi. It also uses a fake room server, so 2-player levels record from the host view. A shot whose textures fail to load is re-recorded automatically.
- **Edit:** `build.mjs` holds the whole cut list and writes `index.html` + `compositions/*.html`. To retime the film, edit `build.mjs` and run `node build.mjs`, not the HTML.
- **Sound:** 14 SFX from Openverse (CC0 / CC BY). Each is placed so its measured peak lands 1 frame after its picture, and its gain is set from measured loudness.

## Creative calls
- Hook C ("Ye game dost ke saath mat khelna.") is on screen from frame 0. That frame is also the thumbnail.
- Skull counter = the game's own HUD skull, scaled up. It ticks on every real death (11 in the film).
- Montage lines are short ad copy built on real mechanics ("Laser chalu!", "Bhoot aaya!"). The game's own taunt "Level 1 hai bhai. LEVEL 1." is used verbatim.
- End card: the O of ANYONE falls out like a trap tile. Real Momo + Mimi idle footage sits below it.
- Not built (from STORYLINES in docs/launch-video/LAUNCH_SCRIPT.md): Hook A solo version, Hook B "trust the sign?" version.

## Measured vs looked at
- `hyperframes check`: 0 errors.
- Warnings kept on purpose:
  - Fast montage lines under the read floor: the rage-cut pace is the point.
  - TikTok right-edge on end-card text: main targets are Reels/Shorts.
  - Nested media start notes: informational.
- Frames looked at: 0, 1.9, 3.6, 5.4, 9.5, 12.6, 13.0, 17.6, 20.6, 24.8, 28.6, 29.75.
- Sound was **measured, not heard**.

## Open
- **No music bed yet.** Free HeyGen route needs a paid plan for voice and the HeyGen CLI for music; v2 uses free local Kokoro voices + SFX. Mix measured at −14.1 LUFS, −1.3 dBTP.
- Weakest shot: the world montage (22.4 to 26.0). The 0.55 s clips are tiny, and the type covers the action. With more time: record 3 hero traps at higher zoom and slow the payoff.
- CC BY credits for 2 sounds are in `assets/sfx/CREDITS.md`. Put them in the post description.
