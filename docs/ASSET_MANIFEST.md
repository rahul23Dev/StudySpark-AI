# StudySpark AI – Asset Manifest

**Image generation:** no image-generation tool was available while building Phases 1–4. For Phase 4 the owner offered to generate images with ChatGPT; ready-to-paste prompts are in `docs/ASSET_PROMPTS.md`. Save results to `design/generated/<name>.png`, and `npm run generate:icons` will use them in place of the SVG placeholders. The illustrations are used only for empty and result states; the flashcard player and quiz are built from native UI components. Raster art comes from images the project owner supplied (`design/`) or is rendered from original SVGs written for this project. Everything is regenerated with:

```bash
npm run generate:icons
```

That runs `scripts/generate-icons.mjs` (uses `sharp`). Restart Expo with `npx expo start -c` after changing icons or the splash image.

Brand palette: cream `#FFF9F0`, navy `#152238`, teal `#18B6A4`, coral `#FF8066`, amber `#FFB547`, white `#FFFFFF`, slate `#687386`.

## In use

| File | Purpose | Dimensions | Format | Source |
| --- | --- | --- | --- | --- |
| `assets/icons/app-icon.png` | App icon (`app.json › icon`) | 1024×1024, opaque, no alpha | PNG | Owner's icon `design/app-icon-source.png` (512 px, upscaled; white corners filled with its own gradient so it's full-bleed) |
| `assets/images/android-icon-background.png` | Android adaptive icon background | 1024×1024 | PNG | Teal→blue gradient sampled from the owner's icon |
| `assets/images/android-icon-foreground.png` | Android adaptive icon foreground | 1024×1024, transparent | PNG | White book glyph extracted from the owner's icon, kept inside the 66% safe zone |
| `assets/images/android-icon-monochrome.png` | Android 13+ themed icon | 1024×1024, transparent | PNG | Same glyph, single colour |
| `assets/images/favicon.png` | Web favicon | 48×48 | PNG | Owner's icon tile |
| `assets/branding/logo.svg` | Editable vector logo: teal open book, coral sparkle, navy details. Used in app headers | 120×120 viewBox | SVG | Original |
| `assets/branding/splash.png` | Splash image (`expo-splash-screen`, shown at 240 pt on `#FFF9F0`) | 1024×1024 | PNG | `logo.svg` on a cream-to-light-teal glow that fades into the cream background |
| `assets/illustrations/onboarding.png` | Welcome screen: friendly robot reading a book | 450×450 | PNG (white background, shown on a white card) | Owner-supplied `design/robot-reading-source.png` |
| `assets/illustrations/empty-decks.png` | My Decks empty state: books, an open folder, blank cards waiting to be organised | 640×480, transparent | PNG | `empty-decks.svg` (original) |
| `assets/illustrations/deck-success.png` | "Deck created / Copy created" banner: neat stack of cards with a teal check | 640×480, transparent | PNG | `deck-success.svg` (original) |
| `assets/illustrations/flashcard-empty.png` | Deck screen "No cards yet" state and empty sessions: a blank floating card with a sparkle | 640×480, transparent | PNG | `flashcard-empty.svg` (original) |
| `assets/illustrations/quiz-complete.png` | Quiz results (not perfect): a finished answer card with a star badge | 640×480, transparent | PNG | `quiz-complete.svg` (original) |
| `assets/illustrations/study-celebration.png` | Perfect scores and flashcard results: a card with a check, confetti and sparkles | 640×480, transparent | PNG | `study-celebration.svg` (original) |
| `assets/illustrations/ai-create.png` | Create with AI screen header: robot presenting a flashcard | 640×480, transparent | PNG | **Placeholder** from `ai-create.svg`; prompt in `docs/ASSET_PROMPTS.md` |
| `assets/illustrations/generation-loading.png` | "Creating your flashcards…" state: floating books and a sparkle | 640×480, transparent | PNG | **Placeholder** from `generation-loading.svg`; prompt in `docs/ASSET_PROMPTS.md` |
| `assets/illustrations/generation-error.png` | Generation failed: book character holding a retry symbol | 640×480, transparent | PNG | **Placeholder** from `generation-error.svg`; prompt in `docs/ASSET_PROMPTS.md` |
| `assets/icons/ai-spark.svg` | "Create with AI" entry points, generate button and AI notice | 24×24 viewBox | SVG | Original |
| `assets/icons/rotate-card.svg` | "Show answer" button and the Flashcards row in the Study panel | 24×24 viewBox | SVG | Original |
| `assets/icons/quiz.svg` | "Add question" button and the Quiz row in the Study panel | 24×24 viewBox | SVG | Original |
| `assets/icons/check-answer.svg` | "Check answer" button in the quiz | 24×24 viewBox | SVG | Original |
| `assets/icons/deck.svg` | Deck icon (folder holding a card) in deck list rows | 24×24 viewBox | SVG | Original |
| `assets/icons/add-card.svg` | "New deck" / "Add card" button icon (card with plus badge) | 24×24 viewBox | SVG | Original |
| `assets/images/reference/tile-flashcards.png`, `tile-quizzes.png`, `tile-progress.png` | Home "Coming soon" feature tiles | ~100×104 | PNG | Cut from `design/reference.webp` in Task 0 |

The tab-bar and UI line icons (Home, Decks, Progress, Profile, settings, chevrons, check, sparkle) are drawn in code in `src/components/icons.tsx` so their colour can follow state.

## Editable sources

| File | Purpose | Format |
| --- | --- | --- |
| `assets/illustrations/empty-decks.svg`, `deck-success.svg`, `flashcard-empty.svg`, `quiz-complete.svg`, `study-celebration.svg` | Sources for the PNGs above (320×240 viewBox) | SVG |
| `design/app-icon-source.png` | Owner-supplied app icon (512×512) | PNG |
| `design/robot-reading-source.png` | Owner-supplied robot (450×450) | PNG |
| `design/ui-inspiration.webp` | Owner-supplied UI inspiration (layout and tab-bar style only, no content copied) | WebP |
| `design/reference.webp` | Task 0 reference sheet | WebP |

## Kept but not used (Task 0 artwork)

`assets/branding/app-icon.svg`, `adaptive-icon-*.svg`, `logo-mark.svg`; `assets/illustrations/onboarding.svg`, `empty-state.svg`, `flashcards.svg`, `quiz.svg`, `progress.svg`; `assets/icons/spark.svg`, `arrow-right.svg`; and the unused reference crops (`app-icon-source.png`, `illustration-*.png`, `tile-study-plans.png`). Safe to delete once you're sure you won't return to them. `adaptive-icon-monochrome.svg` is no longer used either; the monochrome icon now comes from the owner's glyph.

## Known limitations

- **App icon resolution:** the supplied icon is 512 px, so the 1024 px store icon is upscaled. It looks fine on a phone, but supply a 1024 px original before a store release and run `npm run generate:icons`.
- **Brief vs supplied icon:** the Phase 1 brief described a cream-background icon with a teal book. The supplied icon (used, as the more specific instruction) is a teal→blue tile with a white book. The in-app `logo.svg` follows the brief. If you'd rather have the cream icon, it can be generated from `logo.svg`.
- **Robot art:** has a white background, so it sits on a white card rather than directly on cream.
