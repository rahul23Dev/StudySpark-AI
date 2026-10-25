# StudySpark AI – Asset Manifest

The app's visible artwork is **cut from the StudySpark visual reference sheet** (`design/reference.webp`, 1536×1024), at the owner's request (2026-10-25). The original hand-made SVG artwork is kept as an editable fallback.

Pipeline:

1. `npm run assets:reference` – `scripts/crop-reference.mjs` cuts the boxes below out of the sheet into `assets/images/reference/`.
2. `npm run generate:icons` – `scripts/generate-icons.mjs` builds the app icon, Android icons, splash image, favicon and in-app logo from the cropped app icon.
3. Restart Expo with `npx expo start -c` after changing icons or splash.

## Resolution warning

The sheet is a small composite, so every crop is only about 100–160 px. Inside the app the images are shown small and look acceptable. **The 1024 px app icon and 512 px splash image are upscaled about 7× from a 138 px crop and look soft.** Before a store release, replace `assets/images/reference/app-icon-source.png` with a high-resolution original (1024 px or larger) and run `npm run generate:icons`.

## Cropped from the reference (`assets/images/reference/`)

| File | Sheet box (left, top, w×h) | Used on | Status |
| --- | --- | --- | --- |
| `app-icon-source.png` | 19, 17, 138×138 | Source for all icons, splash, favicon and logo | Used |
| `logo-mark.png` (generated, 120 px) | from app icon | Welcome screen header | Used |
| `illustration-robot-reading.png` | 952, 528, 156×124 | Welcome / onboarding | Used |
| `illustration-books.png` | 1118, 528, 128×124 | Home – "No study sets yet" empty state | Used |
| `tile-flashcards.png` | 1044, 686, 100×104 | Home – Flashcards card | Used |
| `tile-quizzes.png` | 1158, 686, 110×104 | Home – Quizzes card | Used |
| `tile-progress.png` | 1406, 686, 110×104 | Home – Study progress card | Used |
| `illustration-target.png` | 1254, 528, 120×124 | – (kept for a future goals screen) | Cut, unused |
| `illustration-chart.png` | 1380, 528, 124×124 | – (kept for a future progress screen) | Cut, unused |
| `tile-study-plans.png` | 1282, 686, 110×104 | – (Study Plans is not in the feature list yet) | Cut, unused |

Text, code snippets, phone mock-ups and the full splash banner from the sheet were **not** cropped: they contain baked-in text, and real UI is built with components.

## App icons and splash (`assets/images/`, generated)

| Output | Size | Source | Used by |
| --- | --- | --- | --- |
| `icon.png` | 1024×1024, opaque cream | reference app icon | `app.json › icon` |
| `android-icon-foreground.png` | 1024×1024, tile in 66% safe zone | reference app icon | `android.adaptiveIcon.foregroundImage` (bg `#FCFAF2`) |
| `android-icon-monochrome.png` | 1024×1024 | `assets/branding/adaptive-icon-monochrome.svg` | Android 13+ themed icon |
| `splash-icon.png` | 512×512, rounded tile | reference app icon | `expo-splash-screen` (bg `#FFF8EE`) |
| `favicon.png` | 48×48 | reference app icon | `web.favicon` |

## Original SVG artwork (fallback, still in the repo)

| Asset | File | Status |
| --- | --- | --- |
| Logo mark, app icon, adaptive icon sources | `assets/branding/*.svg` | Monochrome icon in use; others unused |
| Onboarding, empty state, flashcards, quiz, progress illustrations | `assets/illustrations/*.svg` | Unused; exported from `src/components/illustrations` |
| Spark icon, arrow-right icon | `assets/icons/*.svg` | **In use** (home label, Get started button) |

## Known style mismatch

The reference artwork uses indigo/blue/purple tones, while the app theme is cream, navy, teal and coral. The crops sit on white or pastel cards so they don't clash badly, but a later design pass should either move the theme toward the reference palette or recolour the art.

## Still needed

| Need | Notes |
| --- | --- |
| High-resolution app icon original | Required before store builds (see the resolution warning) |
| High-resolution illustrations | Optional; the current crops are fine at small sizes |
| Store listing graphics | Play feature graphic 1024×500 and screenshots, once features exist |
| Brand typeface | The reference shows Poppins; the app uses system fonts for now |
