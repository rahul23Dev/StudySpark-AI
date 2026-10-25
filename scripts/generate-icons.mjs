// Builds every brand raster the app uses from the sources in design/ and the
// editable SVGs in assets/. Run with: npm run generate:icons
//
// Sources
//   design/app-icon-source.png      512x512 owner-supplied icon (rounded tile, white corners)
//   design/robot-reading-source.png 450x450 owner-supplied onboarding robot
//   assets/branding/logo.svg        editable vector logo
//   assets/illustrations/empty-decks.svg
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const at = (p) => path.join(root, p);

const ICON_SOURCE = at('design/app-icon-source.png');
const ICON_SOURCE_SIZE = 512;
const ICON_CORNER_RADIUS = 112; // corner radius of the tile in the source, measured
const ICON_TOP = '#0DC6C1'; // gradient colours sampled from the source edges
const ICON_BOTTOM = '#0C7FCC';
const CREAM = '#FFF9F0';

const svg = (markup) => Buffer.from(markup);
const gradientSquare = (size) =>
  svg(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${ICON_TOP}"/><stop offset="1" stop-color="${ICON_BOTTOM}"/>
    </linearGradient></defs>
    <rect width="${size}" height="${size}" fill="url(#g)"/></svg>`);
const roundedMask = (size, inset, radius) =>
  svg(`<svg width="${size}" height="${size}"><rect x="${inset}" y="${inset}" width="${size - 2 * inset}"
    height="${size - 2 * inset}" rx="${radius - inset}" fill="#fff"/></svg>`);

async function write(image, out) {
  await image.png().toFile(at(out));
  const { width, height } = await sharp(at(out)).metadata();
  console.log(`${out} (${width}x${height})`);
}

// The source tile with its white corners cut away (a little inset drops the anti-aliased fringe).
const tile = await sharp(ICON_SOURCE)
  .ensureAlpha()
  .composite([{ input: roundedMask(ICON_SOURCE_SIZE, 3, ICON_CORNER_RADIUS), blend: 'dest-in' }])
  .png()
  .toBuffer();

// White book-and-sparkle glyph only, as alpha: whiter pixels are more opaque.
// Masked well inside the tile edge so the edge's light fringe isn't picked up.
async function glyph() {
  const inner = await sharp(ICON_SOURCE)
    .ensureAlpha()
    .composite([{ input: roundedMask(ICON_SOURCE_SIZE, 30, ICON_CORNER_RADIUS), blend: 'dest-in' }])
    .png()
    .toBuffer();
  const { data, info } = await sharp(inner).raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, o = 0; i < data.length; i += 4, o += 4) {
    const whiteness = Math.min(data[i], data[i + 1], data[i + 2]);
    const alpha = data[i + 3] === 0 ? 0 : Math.max(0, Math.min(255, ((whiteness - 40) / 200) * 255));
    out[o] = out[o + 1] = out[o + 2] = 255;
    out[o + 3] = alpha;
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}
const glyphPng = await glyph();

// App icon: full bleed (iOS and Android round the corners themselves), opaque.
await write(
  sharp(gradientSquare(1024)).composite([
    { input: await sharp(tile).resize(1024, 1024, { kernel: 'lanczos3' }).toBuffer() },
  ])
    .flatten({ background: ICON_TOP })
    .removeAlpha(), // App Store icons must not have an alpha channel
  'assets/icons/app-icon.png',
);

// Android adaptive icon: gradient background layer + white glyph inside the 66% safe zone.
await write(sharp(gradientSquare(1024)), 'assets/images/android-icon-background.png');
const fgSize = 820;
const transparent = { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } };
const centred = async (input, size) => ({
  input: await sharp(input).resize(size, size, { kernel: 'lanczos3' }).toBuffer(),
  left: (1024 - size) / 2,
  top: (1024 - size) / 2,
});
await write(sharp({ create: transparent }).composite([await centred(glyphPng, fgSize)]), 'assets/images/android-icon-foreground.png');
// Android 13+ themed icon: same glyph, single colour (the OS tints it).
await write(
  sharp({ create: transparent }).composite([
    await centred(await sharp(glyphPng).linear(0, 0).toBuffer(), fgSize),
  ]),
  'assets/images/android-icon-monochrome.png',
);

// Favicon: the rounded tile.
await write(sharp(tile).resize(48, 48, { kernel: 'lanczos3' }), 'assets/images/favicon.png');

// Splash: vector logo on a soft cream-to-light-teal glow that fades into the cream splash background.
const logo = await sharp(await readFile(at('assets/branding/logo.svg')), { density: (72 * 560) / 120 })
  .resize(560, 560)
  .toBuffer();
await write(
  sharp(
    svg(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
      <defs><radialGradient id="r" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#D3F3EE"/><stop offset="0.55" stop-color="#E9F7F1"/>
        <stop offset="1" stop-color="${CREAM}"/>
      </radialGradient></defs>
      <rect width="1024" height="1024" fill="${CREAM}"/><circle cx="512" cy="512" r="512" fill="url(#r)"/></svg>`),
  ).composite([{ input: logo, left: 232, top: 232 }]),
  'assets/branding/splash.png',
);

// Illustrations.
await write(sharp(at('design/robot-reading-source.png')), 'assets/illustrations/onboarding.png');
for (const name of ['empty-decks', 'deck-success', 'flashcard-empty', 'quiz-complete', 'study-celebration']) {
  await write(
    sharp(await readFile(at(`assets/illustrations/${name}.svg`)), { density: 144 }).resize(640, 480),
    `assets/illustrations/${name}.png`,
  );
}
