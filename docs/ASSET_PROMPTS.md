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

## Phase 5: progress and spaced repetition

These three replace placeholder art that is already in the app. Each block below is a complete prompt: copy one block, paste it into ChatGPT, and save the result to `design/generated/` with the file name in the heading. Then run `npm run generate:icons`, or ask Claude Code to do it.

The Phase 5 brief describes a cream background. These prompts ask for a **transparent** one instead, because the art sits on white, cream and teal cards; the app's cream shows through.

### 5a. `progress-growth.png`: Progress tab, before any study

```text
Original minimal educational illustration for a mobile study app: a rising learning chart made of three rounded teal bars (#18B6A4, getting taller left to right) with a coral-orange (#FF8066) trend arrow climbing above them, a small coral-orange calendar badge with a white checkmark beside the bars, a small sprouting teal plant at the right and one small amber (#FFB547) celebratory four-pointed sparkle. Friendly geometric vector art, soft rounded shapes, thin deep navy (#152238) outlines, flat colour with a very subtle soft shadow under the objects only. Fully transparent background (PNG with alpha), no background colour, no scenery. No text, no letters, no numbers, no logos, no watermark. Centered with generous empty margin, 1536x1024, PNG.
```

### 5b. `streak-celebration.png`: goal met on a study streak

```text
Original minimal educational illustration for a mobile study app: a friendly, cute coral-orange (#FF8066) flame character with a warm amber (#FFB547) inner glow and a simple happy navy (#152238) face, standing proudly next to a coral-orange calendar badge with a white checkmark, surrounded by a few small teal (#18B6A4) and amber confetti pieces and one small amber celebratory four-pointed sparkle. Friendly geometric vector art, soft rounded shapes, thin deep navy outlines, flat colour with a very subtle soft shadow under the objects only. Fully transparent background (PNG with alpha), no background colour, no scenery. No text, no letters, no numbers, no logos, no watermark. Centered with generous empty margin, 1536x1024, PNG.
```

### 5c. `revision-calendar.png`: nothing due for review

```text
Original minimal educational illustration for a mobile study app: a clean white wall calendar page with a teal (#18B6A4) header strip and two navy (#152238) binding rings, a grid of soft beige day squares with one day marked by a coral-orange (#FF8066) checkmark, a small blank flashcard leaning against the calendar's lower right corner, and one small amber (#FFB547) celebratory four-pointed sparkle near the top. Friendly geometric vector art, soft rounded shapes, thin deep navy outlines, flat colour with a very subtle soft shadow under the objects only. Fully transparent background (PNG with alpha), no background colour, no scenery. No text, no letters, no numbers, no logos, no watermark. Centered with generous empty margin, 1536x1024, PNG.
```

If ChatGPT returns a white or cream background, reply: *"Same image, but with a fully transparent background."*

The three Phase 5 icons (`streak.svg`, `progress-chart.svg`, `review-calendar.svg`) are hand-drawn SVGs and don't need generating.

---

### Already done (no need to generate)

The app icon, onboarding robot, empty-decks, deck-success, flashcard-empty, quiz-complete and study-celebration art are already in place. See `docs/ASSET_MANIFEST.md`. If you'd like higher-quality versions of any of them, ask for prompts and they'll be added here.
