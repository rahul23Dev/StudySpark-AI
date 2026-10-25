# StudySpark AI

**Learn Smarter. Remember Longer.**

StudySpark AI is a mobile study companion built with React Native, Expo (SDK 57), Expo Router and TypeScript. This repository currently contains the **project foundation only**: a welcome screen, a home screen that lists the planned study tools (flashcards, quizzes, progress) as *coming soon*, design tokens, reusable UI components and original artwork. No AI features or backend integrations exist yet.

| Item | Value |
| --- | --- |
| Expo slug | `studyspark-ai` |
| Android package | `com.yourcompany.studysparkai` *(placeholder)* |
| iOS bundle ID | `com.yourcompany.studysparkai` *(placeholder)* |

> **Before any store release**, replace `com.yourcompany` in `app.json` with your real organisation identifier. Store IDs cannot be changed after the first upload.

## Why Expo SDK 57?

The App Store / Play Store build of **Expo Go** supports SDK 57 only (checked against `https://api.expo.dev/v2/versions` → `expoGoSdkVersion`). Staying on 57 lets you test on a real phone with the store Expo Go app. Upgrade only after Expo Go supports a newer SDK: `npx expo install expo@^58 --fix`.

## Windows setup

Prerequisites:

- **Node.js 20 LTS or newer** (tested with Node 24.20 / npm 11.19) – <https://nodejs.org>
- **Git for Windows** – <https://git-scm.com/download/win>
- **Expo Go** on your phone (App Store / Google Play), or Android Studio with an emulator for Android.

No global Expo CLI is needed; everything runs through `npx`.

```powershell
cd F:\MY_PROJECTS\StudySparkAI
npm install
copy .env.example .env.local   # optional – no values are required yet
npm start
```

Then scan the QR code with Expo Go (Android) or the Camera app (iOS), press `a` for an Android emulator, or `w` for the web preview.

Tip: if Windows Firewall asks about Node.js, allow it on **private** networks so your phone can reach the dev server. If the phone cannot connect, try `npx expo start --tunnel`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Start the Expo dev server |
| `npm run android` / `ios` / `web` | Start and open on a platform |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm run lint` | ESLint via `expo lint` |
| `npm test` | Jest + React Native Testing Library |
| `npm run check` | Type-check, lint and tests together |
| `npm run assets:reference` | Cut the app artwork out of `design/reference.webp` |
| `npm run generate:icons` | Rebuild app icon / splash / favicon / logo PNGs from the cropped reference icon |

## Project structure

```
assets/
  branding/        Editable SVG sources for the logo, app icon and adaptive icons
  icons/           Small UI icons (SVG)
  illustrations/   Feature illustrations (SVG, imported as components)
  images/          PNGs used by app.json (icon, splash, favicon)
    reference/     Artwork cropped from the visual reference sheet
design/            Visual reference sheet (source for the cropped artwork)
docs/              Project docs (see docs/ASSET_MANIFEST.md)
scripts/           Developer scripts (icon generation)
src/
  app/             Expo Router screens (index = welcome, home = study space)
  components/      Shared components; ui/ holds the primitives (Button, Card, ...)
  features/        Feature data and logic (catalog of planned study tools)
  theme/           Design tokens (colours, spacing, radii, typography, shadows)
  types/           Ambient type declarations
  __tests__/       Jest tests
test/              Jest helpers and mocks
```

Path aliases: `@/…` → `src/…`, `@/assets/…` → `assets/…`.

## Environment variables

See `.env.example`. Anything prefixed `EXPO_PUBLIC_` is bundled into the app and visible to users — **never put API keys or secrets there**. AI provider keys will live on a backend in a later phase. Real `.env` files are git-ignored.

## Design

Warm cream background (`#FFF8EE`), deep navy text (`#1B2A4A`), teal primary (`#0E7C7B`) and coral/yellow highlights, rounded cards and soft shadows. Tokens live in `src/theme/tokens.ts`; a test checks that text colour pairs meet WCAG AA contrast. Touch targets are at least 48 pt.
