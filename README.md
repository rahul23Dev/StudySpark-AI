# StudySpark AI

**Learn Smarter. Remember Longer.**

StudySpark AI is a mobile study companion built with React Native, Expo (SDK 58), Expo Router and TypeScript.

| Phase | Status |
| --- | --- |
| Task 0 – project setup | Done |
| Phase 1 – foundation: tokens, shared components, tab navigation, onboarding, settings | Done |
| Phase 2 – local database and deck/flashcard management | Done |
| Phase 3 – flashcard player, quizzes, study sessions and results | Done |
| AI features | Not started. There are no AI calls or backend yet |

| Item | Value |
| --- | --- |
| Expo slug | `studyspark-ai` |
| Android package | `com.yourcompany.studysparkai` *(placeholder)* |
| iOS bundle ID | `com.yourcompany.studysparkai` *(placeholder)* |

> **Before any store release**, replace `com.yourcompany` in `app.json` with your real organisation identifier. Store IDs cannot be changed after the first upload.

## What the app does today

- **Onboarding** on first launch, remembered on the device and replayable from Profile.
- **Tabs:** Home, My Decks, Progress and Profile, on a floating navy tab bar.
- **My Decks:**
  - Create, rename and edit, duplicate (cards and quiz questions included) and delete decks. Deleting asks for confirmation first.
  - Search by title, subject or description.
  - Sort by Recent, Newest, A–Z or My order.
- **Flashcards:** add (including "save and add another"), edit, delete, reorder (move up/down), and set difficulty (easy/medium/hard).
- **Quiz questions:** multiple choice (2–6 options) or true/false, with an optional explanation.
- **Flashcard player:**
  - Tap or press Space to reveal the answer, then choose "Know it" or "Review again".
  - Previous/next navigation, and "Shuffle remaining".
- **Quiz:** pick an answer, check it, and get instant feedback with the explanation.
- **Sessions:** resume where you left off, "Save & exit", or end a session.
  - Every answer is saved as you go.
  - A failed save shows an error with "Try again".
  - Double taps can't record two answers.
- **Results:** your score, computed from the saved answers, with a review of everything you missed.
- **Keyboard (web):**
  - **Flashcards:** Space or Enter reveals, K means Know it, R means Review again.
  - **Quiz:** keys 1–6 pick an option, Enter checks the answer or moves on.
  - **Both:** the ← and → arrow keys go back and forward.
- **Settings:** display name (saved on the device) and the light theme.
- **Home:** real deck and card counts.
- **Progress:** sessions completed, day streak, and study minutes per day or week, all from completed sessions.

Everything is stored **on the device**. Nothing is sent anywhere.

## Expo SDK version

The project uses **Expo SDK 58** because the App Store build of **Expo Go** moved to SDK 58, and iPhones cannot install an older Expo Go. The project's SDK must match the Expo Go version on your phone. When Expo Go moves to a newer SDK, upgrade with `npx expo install expo@^<sdk> --fix`, then run `npm run check` and `npx expo-doctor`.

## Windows setup

Prerequisites:

- **Node.js 22 LTS or newer** (tested with Node 24.20 / npm 11.19). Node 22.5+ is needed for the database tests, which use Node's built-in `node:sqlite`.
- **Git for Windows** – <https://git-scm.com/download/win>
- **Expo Go** on your phone (App Store / Google Play), or Android Studio with an emulator.

No global Expo CLI is needed; everything runs through `npx`.

```powershell
cd F:\MY_PROJECTS\StudySparkAI
npm install
npm start
```

- **Phone:** scan the QR code with Expo Go on Android, or with the Camera app on iPhone. The phone must be on the same Wi-Fi as the PC.
- **iPhone sign-in:** run `npx expo login` here and use the same Expo account in Expo Go.
- **Emulator or browser:** press `a` for an Android emulator or `w` for the web preview.
- **Firewall:** if Windows Firewall asks about Node.js, allow it on **private** networks. If the phone still can't connect, use `npx expo start --tunnel`.
- **Web preview:** the database runs in your browser's private storage, and the first open can take a minute while the SQLite worker builds.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Start the Expo dev server |
| `npm run android` / `ios` / `web` | Start and open on a platform |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm run lint` | ESLint via `expo lint` |
| `npm test` | Jest + React Native Testing Library |
| `npm run check` | Type-check, lint and tests together |
| `npm run generate:icons` | Rebuild app icon, Android icons, favicon, splash and illustration PNGs |
| `npm run assets:reference` | Re-cut the Task 0 artwork from `design/reference.webp` |

## Project structure

```
assets/
  branding/        logo.svg (editable logo), splash.png
  icons/           app-icon.png, deck.svg, add-card.svg
  illustrations/   onboarding, empty-decks and deck-success art (PNG + SVG sources)
  images/          Android adaptive icon layers, favicon, Task 0 reference crops
design/            Source images supplied by the project owner
docs/              ASSET_MANIFEST.md, DATABASE.md
scripts/           Asset generation
src/
  app/             Expo Router routes
    (tabs)/        index (Home), decks, progress, profile
    deck/          new, [id]/index (detail), [id]/edit, [id]/card/…, [id]/question/…
    session/       [id]/index (flashcard player or quiz), [id]/results
    onboarding.tsx, settings.tsx, _layout.tsx (providers + database gate)
  components/      Shared UI; ui/ holds the primitives (Button, Card, Input,
                   ScreenContainer, Loading/Empty/ErrorState, ConfirmDialog, …)
  data/            SQLite schema, migrations, validation, repository, providers
  features/        Feature code (decks/: forms and rows; study/: players, study panel)
  study/           Pure scoring, session state and progress statistics
  settings/        Display name + onboarding flag (AsyncStorage)
  theme/           Design tokens and the light theme
  __tests__/       Jest tests
test/              Test helpers (in-memory SQLite, router mock, render helpers)
```

Path aliases: `@/…` → `src/…`, `@/assets/…` → `assets/…`.

## Data

See [docs/DATABASE.md](docs/DATABASE.md) for the schema, migrations and data rules.

## Environment variables

See `.env.example`. Anything prefixed `EXPO_PUBLIC_` is bundled into the app and visible to users, so **never put API keys or secrets there**. AI provider keys will live on a backend in a later phase. Real `.env` files are git-ignored.

## Design

Brand tokens live in `src/theme/tokens.ts`:
- **Colours:** cream `#FFF9F0`, navy `#152238`, teal `#18B6A4`, coral `#FF8066`, amber `#FFB547`, white surfaces, slate `#687386` muted text.
- **Fonts:** the platform's system fonts (SF Pro on iPhone, Roboto on Android), so there's nothing to license or load.
- **Accessibility:**
  - A test checks that every text colour pair meets WCAG AA contrast.
  - Teal is too light for white text, so text on teal is navy.
  - Touch targets are at least 48 pt.
