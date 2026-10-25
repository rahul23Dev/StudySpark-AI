# Image prompts (for ChatGPT or another image generator)

The app currently uses simple placeholder art for these files. Generate each image, save it with the **exact file name** below into `design/generated/`, and tell Claude Code. It will resize the image, check its transparency, put it in `assets/illustrations/` and update the manifest.

**Shared style (paste into every prompt):**

> Original illustration for a premium educational mobile app called StudySpark AI. Friendly, clean, modern style with soft rounded shapes and subtle 3D depth. Brand palette: teal #18B6A4, deep navy #152238, coral #FF8066, amber #FFB547, warm cream #FFF9F0. **Transparent background (PNG with alpha), no background colour or scenery**, small soft shadow under the main object only. No text, no letters, no numbers, no logos, no watermark, no signature. Centered subject with generous empty margin around it. Square-ish composition that also reads well when cropped to 4:3.

Ask for **1536×1024 or larger, PNG, transparent background**. If ChatGPT returns a white background, ask: *"Same image, but with a fully transparent background."*

---

## 1. `ai-create.png`: Create with AI (welcome card on the AI screen)

> [shared style] A friendly, rounded white-and-teal study robot with a dark visor face and glowing cyan eyes, smiling, standing and holding up a single blank teal flashcard towards the viewer with both hands, as if presenting it. Two or three small coral and amber four-pointed sparkles float near the card. A small stack of two closed books (teal and coral covers) sits at the robot's feet.

Used: top of the "Create with AI" screen. Shown about 240 px wide.

## 2. `generation-loading.png`: while the AI is generating

> [shared style] Three closed books (teal, coral and navy covers) floating gently in the air at slightly different heights and angles, with one blank flashcard drifting between them and a single small amber sparkle above. Calm, airy, weightless feeling; no characters.

Used: loading state ("Creating your cards…"). Shown about 220 px wide.

## 3. `generation-error.png`: when generation fails

> [shared style] A cute, friendly book character (a closed teal book with a simple navy face, small arms and feet) looking slightly apologetic but hopeful, holding a large coral circular "retry" arrow symbol (a circle made of one curved arrow). No exclamation marks, no red error colours, nothing scary.

Used: error state with a "Try again" button. Shown about 220 px wide.

## 4. `ai-spark.svg`: small icon (optional; the vector icon already in the app is fine)

ChatGPT can't produce a real SVG. If you want a new look, generate:

> A simple flat app icon glyph: one bold four-pointed sparkle in teal #18B6A4 with a small amber #FFB547 sparkle at its top-right, navy #152238 outline, transparent background, 1024×1024 PNG, no text.

Claude Code will redraw it as a clean SVG.

---

### Already done (no need to generate)

The app icon, onboarding robot, empty-decks, deck-success, flashcard-empty, quiz-complete and study-celebration art are already in place. See `docs/ASSET_MANIFEST.md`. If you'd like higher-quality versions of any of them, ask for prompts and they'll be added here.
