// Builds the app icon, Android adaptive icons, splash image and favicon.
// Colour artwork comes from the reference app icon (run `npm run assets:reference`
// first); the Android themed icon still comes from the SVG silhouette.
// Run with: npm run generate:icons
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const at = (p) => path.join(root, p);

const SOURCE = at('assets/images/reference/app-icon-source.png'); // 138x138 rounded cream tile on navy
const SOURCE_SIZE = 138;
const CORNER_RADIUS = 30; // corner radius of the tile in the source crop
export const ICON_CREAM = '#FCFAF2'; // tile colour, also the adaptive icon background

// The source tile with its navy corners made transparent. The mask is inset a
// little so the dark anti-aliased rim from the sheet background is dropped too.
const INSET = 3;
const mask = Buffer.from(
  `<svg width="${SOURCE_SIZE}" height="${SOURCE_SIZE}"><rect x="${INSET}" y="${INSET}" width="${SOURCE_SIZE - 2 * INSET}" height="${SOURCE_SIZE - 2 * INSET}" rx="${CORNER_RADIUS - INSET}" fill="#fff"/></svg>`,
);
const roundedTile = await sharp(SOURCE).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();

async function tileAt(size) {
  return sharp(roundedTile).resize(size, size, { kernel: 'lanczos3' }).png().toBuffer();
}

async function write(buffer, out, label) {
  await sharp(buffer).png().toFile(at(out));
  console.log(`${label} -> ${out}`);
}

// iOS/legacy icon: opaque and full bleed (the OS rounds the corners itself).
await write(
  await sharp(await tileAt(1024)).flatten({ background: ICON_CREAM }).png().toBuffer(),
  'assets/images/icon.png',
  'app icon 1024',
);

// Android adaptive foreground: tile kept inside the 66% safe zone, on transparency.
const fgSize = 680;
await write(
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await tileAt(fgSize), left: (1024 - fgSize) / 2, top: (1024 - fgSize) / 2 }])
    .png()
    .toBuffer(),
  'assets/images/android-icon-foreground.png',
  'adaptive foreground 1024',
);

// Android 13+ themed icon: single-colour silhouette from the SVG source.
await write(
  await sharp(await readFile(at('assets/branding/adaptive-icon-monochrome.svg')), { density: (72 * 1024) / 120 })
    .resize(1024, 1024)
    .png()
    .toBuffer(),
  'assets/images/android-icon-monochrome.png',
  'monochrome 1024',
);

await write(await tileAt(512), 'assets/images/splash-icon.png', 'splash 512');
await write(await tileAt(48), 'assets/images/favicon.png', 'favicon 48');
// In-app logo mark (shown at 40pt, so 3x = 120px is enough).
await write(await tileAt(120), 'assets/images/reference/logo-mark.png', 'logo mark 120');
