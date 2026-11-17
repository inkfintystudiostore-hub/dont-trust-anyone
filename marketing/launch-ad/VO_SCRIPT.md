# VO script: Momo + Mimi (dual speaker, Gemini 3.8 Flash TTS)

Momo: young Indian guy, ~22. Overconfident, lazy charm, quick to blame the game.
Mimi: young Indian girl, ~21. Sharp, sarcastic, laughs at him, gets genuinely annoyed.
Delivery: natural Hinglish between two friends recording a reaction. Overlapping energy, real breaths, no announcer voice.
The screen text says the joke. The voices react to it and never read it out.

| Clip | Lands at | Lines |
|---|---|---|
| v1 | 0.1s | **Momo:** Arre chill kar, bachon wala game hai ye. |
| v2 | 1.75s | **Mimi:** Momo! Tune kya chhua?! |
| v3 | 3.0s | **Mimi:** Button pe khada reh… bas ek second. **Momo:** Haan haan, khada hoon— |
| v4 | 4.35s | **Mimi:** (shriek) Aaah! Momo! |
| v5 | 5.2s | **Mimi:** Tu jaan bujh ke kar raha hai na? **Momo:** Kasam se nahi! (laughs) **Mimi:** Phir se?! |
| v6 | 9.0s | **Momo:** (sheepish) Achha… galti meri thi. **Mimi:** Aur mare dono. |
| v7 | 10.5s | **Mimi:** Theek hai. Akele khel ke dikha. **Momo:** Level one hai, isme kya hi— |
| v8 | 12.4s | **Mimi:** (laughing) Level one, Momo. Level ONE. |
| v9 | 13.8s | **Momo:** Ye sign jhootha hai! … Kela?! Kaun kela rakhta hai yaar! |
| v10 | 19.5s | **Momo:** Ruk, tere dost ko bhi bulata hoon. **Mimi:** Bechara. |
| v11 | 26.6s | **Mimi:** Don't Trust Anyone. Free hai, browser mein khelo. **Momo:** Aur us dost ko tag karo… jo tumhe marwayega. (both laugh) |

Slams (16.4–19.4) and world montage (22.4–26) carry no voice: music and hits only.

## As recorded (v2, local Kokoro, free)
Momo = `hm_psi`, Mimi = `hf_alpha`, Hindi phonemizer, lines in Devanagari, speed 1.1–1.22. Files: `assets/vo/v01–v15.wav` (v08 unused: "Akele khel loge?" is already on screen).
Kokoro has no laugh/gasp tags, so the bracketed reactions above were dropped. Placement and the deliberate mid-word cuts at each death live in the `VO` table in `build.mjs`.
Alternative takes for choosing voices: `vo/test/` (Momo: hm_omega, hm_psi; Mimi: hf_alpha, hf_beta).
