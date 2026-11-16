# Asset List: Meshy se kya banana hai

## Pipeline (Momo pe test ho chuka hai, 16 Nov 2026)
1. **Gemini (Nano Banana)** mein reference image banao. Neeche wala prompt + template use karna.
2. Full-size PNG download karke `assets/refs/<naam>.png` mein rakho.
3. `node tools/meshy-image-to-3d.mjs <naam> [polycount]` chalao. Ye Meshy 7.1 se textured model banata hai, remesh karke default 10k triangles tak, aur `assets/raw/<naam>.glb` + thumbnail save karta hai.
4. `asset-viewer` (`.claude/launch.json`) mein `tools/viewer.html?f=<naam>.glb` khol ke check karo: shape, colour, triangles.
5. Baad mein gltf-transform se compress (M3 se pehle).

## Status (16 Nov 2026): 13/13 ready ✅
Kharcha: 420 credits (13 × 30 + Mimi retry 30), **980 bache hain**. Sab ek saath dekhne ke liye: `assets/models-sheet.png` (left: Gemini ref, right: Meshy model).

| Asset | Triangles | Raw MB | Check |
|---|---|---|---|
| momo | 10,474 | 1.55 | ✅ |
| mimi | 10,474 | ~1.5 | ✅ **Momo ka mesh, rang badal ke** (`node tools/recolor-glb.mjs momo mimi`): peach body, mint sprout. Meshy ki dono Mimi pe chehra bana (v1 aankhen, v2 texture prompt ke baad bhi ubhre hue nishaan, mesh mein bhi). Meshy v2 backup: `mimi_meshy_v2.glb`. |
| darwaza | 4,689 | 2.27 | ✅ |
| gappu_sign | 2,891 | 2.04 | ✅ (board pe text code se) |
| kabootar | 8,247 | 1.81 | ✅ aankhen nahi |
| lollipop_tree | 5,140 | 2.06 | ✅ |
| cotton_cloud | 4,198 | 1.39 | ✅ |
| banana_peel | 3,052 | 1.83 | ✅ |
| boxing_glove | 5,161 | 2.26 | ✅ spring + plate sahi |
| rubber_chicken | 6,260 | ~2 | ✅ aankhen nahi |
| boulder | 4,158 | ~2 | ✅ thoda faceted, chalega |
| checkpoint_flag | 2,975 | 2.18 | ✅ |
| coop_switch | 3,087 | ~2 | ✅ |

**Seekh:** Meshy kabhi kabhi "character jaisi" shapes pe khud aankhen paint (aur sculpt) kar deta hai, chahe reference mein na hon, aur `texture_prompt` se bhi nahi rukta. Agar ek saaf character mil jaaye, to uske variants `tools/recolor-glb.mjs` se banao, Meshy pe dobara mat chalao. Har character model ko viewer mein **saamne se** zaroor check karna. Meshy ki thumbnail ka angle galat ho sakta hai (boxing glove ka spring thumbnail mein nahi dikha tha).
**Total size:** ~25 MB raw. 15 MB budget ke liye gltf-transform compression zaroori hai.

**Gemini prompt template:** `Generate an image: a single cute 3D <asset> for a mobile game, designed as a reference for image-to-3D modeling. <neeche wala description>. IMPORTANT: no face at all, no eyes, no mouth. Full body, centered, three-quarter front view, plain pure white background, soft even studio lighting, no ground, no shadow, no text, no other objects. Smooth glossy resin-toy finish, pastel chibi style.`

Purani SVG drawings (`assets/concepts/`) ab sirf rough guide hain. Asli reference Gemini ki images hain (`assets/refs/`).

## Sabke liye rules
1. **Chehra NAHI banana.** Aankhein, moonh, daant aur expressions code se lagenge, taaki wo hans sakein, ro sakein, jeebh nikal sakein. Agar Meshy khud chehra bana de to dobara generate karo, ya prompt mein "no face, no eyes, no mouth" daalo.
2. **Style:** cute chunky resin toy / vinyl figure, pastel colours, smooth soft surfaces, simple shapes.
3. **Polycount kam:** characters ~8–10k triangles, props ~2–5k. Mobile pe chalna hai.
4. **Export:** GLB, textures ke saath. Ek model = ek object, base/ground ke bina (shadow code dega).
5. **Save karna:** `assets/raw/<file naam>` mein, bilkul neeche wale naam se. Baaki compression (gltf-transform) main kar dunga.
6. **Abhi zaroorat nahi:** pehle grey-box prototype banega (M1–M2), jismein boxes aur spheres se kaam chalega. Ye models **M3 (cute vertical slice)** se pehle chahiye. Main bataunga kab.

## Meshy se banenge (13)

| # | Asset | File naam | Kab chahiye | Description (Gemini prompt mein daalna) |
|---|---|---|---|---|
| 01 | Momo (P1 hero) ✅ **done** | `momo.glb` | **M3** | cute chubby egg-shaped jelly blob creature, cream colour, two tiny stubby feet, tiny nub arms, small crimson two-leaf sprout on top of head, no face, no eyes, no mouth, smooth glossy resin toy, pastel, chibi |
| 02 | Mimi (P2 friend) ✅ **done** (Momo recolor, bow ki jagah mint sprout) | `mimi.glb` | **M3** | cute chubby egg-shaped jelly blob creature, peach colour, two tiny stubby feet, tiny nub arms, small mint green bow on top of head, no face, no eyes, no mouth, smooth glossy resin toy, pastel, chibi |
| 03 | Darwaza Ji (exit door) | `darwaza.glb` | **M3** | cute cartoon arched wooden door with thick rounded frame, warm peach-orange wood planks, round golden knob, small stone step, chunky toy style, no face |
| 04 | Gappu (fake sign) | `gappu_sign.glb` | **M3** | cute cartoon wooden signpost, blank rectangular board with rounded corners and four nails on a single post, slightly tilted, chunky toy style, no text |
| 05 | Narrator Kabootar | `kabootar.glb` | M4 | chubby round cartoon pigeon sitting, lavender grey body, iridescent mint and purple neck ring, small orange beak, tiny orange feet, no eyes, cute vinyl toy |
| 06 | Lollipop tree | `lollipop_tree.glb` | **M3** | giant swirl lollipop as a tree, pink candy disc with white spiral, red and white striped candy cane stick, small mint grass mound base, cute stylized |
| 07 | Cotton cloud | `cotton_cloud.glb` | **M3** | puffy cartoon cloud made of cotton candy, white to soft pink, flat bottom, rounded bubbly shapes, cute stylized |
| 08 | Banana peel | `banana_peel.glb` | **M3** | cartoon banana peel lying flat on the ground, three yellow peel flaps spread out, brown tips and stem, cute stylized, chunky |
| 09 | Boxing glove on spring | `boxing_glove.glb` | **M3** | cartoon red boxing glove attached to a metal coil spring mounted on a small wall plate, cream cuff, chunky toy style |
| 10 | Rubber chicken | `rubber_chicken.glb` | M4 | classic yellow rubber chicken toy, long neck, red comb, orange beak and legs, plucked, squeaky toy, no eyes, cute |
| 11 | Candy boulder | `boulder.glb` | M4 | round smooth grey boulder with colourful candy sprinkle dots embedded, cute stylized, no face |
| 12 | Checkpoint flag | `checkpoint_flag.glb` | M4 | small cartoon checkpoint flag, cream pole with gold ball on top, wavy crimson triangular flag, chunky toy style, no base |
| 13 | Co-op floor switch | `coop_switch.glb` | M4 (online) | big round arcade push button floor switch, crimson glossy dome button on a cream cylindrical base, chunky toy style |
| 14 | Mystery gift box ✅ **done** | `gift_box.glb` | Mind Games | cute wrapped mystery gift box with coral ribbon and bouncy spring jack-in-the-box vibe, shiny pastel resin toy, no face |
| 15 | Mirror toy robot ✅ **done** | `toy_robot.glb` | Mind Games | cute retro blocky mint & peach wind-up clockwork toy robot with gold winding key and blank dark visor (eyes in code), chunky resin toy |
| 16 | Peek-a-boo ghost ✅ **done** | `cute_ghost.glb` | Mind Games | smooth cream-to-lavender marshmallow ghost figurine with tiny scalloped tail and nub arms, no eyes, no mouth, chunky resin toy |
| 17 | Golden Co-op Key ✅ **done** (86 KB compressed) | `golden_key.glb` | World 5 (Couple Co-op) | cute ornate glossy pastel-gold skeleton key prop, smooth resin toy finish, no face |
| 18 | Ticking Co-op Bomb ✅ **done** (163 KB compressed) | `ticking_bomb.glb` | World 5 (Couple Co-op) | classic smooth matte charcoal round cartoon bomb with gold brass collar and twisted cream rope fuse, no face |
| 19 | Spring Trap Pad ✅ **done** (162 KB compressed) | `spring_pad.glb` | World 2 / 4 / 5 | coiled gold toy spring on crimson/cream pad (`!` disguised under normal tile), no face |
| 20 | Magnet Pull Orb ✅ **done** (182 KB compressed) | `magnet_orb.glb` | World 3 / 4 / 5 | glossy coral-red U-magnet with silver tips (`%`), no face |
| 21 | Cream Pie Cannon ✅ **done** (261 KB compressed) | `pie_cannon.glb` | World 2 / 3 / 4 | chunky pastel coral toy cannon on oak wheel mount (`$`), no face |

**M3 wale (9) sabse pehle**, M4 wale (4) baad mein.

## Code se banenge (Meshy ki zaroorat nahi)
- Aankhein, moonh, daant, sab expressions (har character pe).
- Platform tiles, grass top, invisible/ghost blocks, gravity zones.
- Spikes, ceiling crusher block, conveyor, gears.
- **Chomp Coin**: dono halves code se, taaki moonh khul ke kaat sake.
- Confetti, splat, dust, sneeze particles.
- Level-map diorama ka table/base.

## World 2 & 3 (M6, baad mein)
Toy Factory (gears, toy robot, conveyor props) aur Haunted Bakery (cute ghost, cake, candle) ki list M5 ke baad banegi.
