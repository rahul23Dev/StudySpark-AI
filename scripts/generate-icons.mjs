// Builds every brand raster the app uses from the sources in design/ and the
// editable SVGs in assets/. Run with: npm run generate:icons
//
// Sources (first one found wins)
//   App icon:  design/generated/app-icon-source.png  1024x1024 full-bleed, opaque (owner, via ChatGPT)
//              design/app-icon-source.png            512x512 rounded tile with white corners (owner)
//   Robot:     design/robot-reading-source.png       450x450 onboarding robot (owner)
//   Illustrations: design/generated/<name>.png (owner, via ChatGPT) else assets/illustrations/<name>.svg
//   Logo:      assets/branding/logo.svg              editable vector logo
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const at = (p) => path.join(root, p);
const exists = (p) => access(at(p)).then(() => true, () => false);

const CREAM = '#FFF9F0';
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const svg = (markup) => Buffer.from(markup);
const roundedMask = (size, inset, radius) =>
  svg(`<svg width="${size}" height="${size}"><rect x="${inset}" y="${inset}" width="${size - 2 * inset}"
    height="${size - 2 * inset}" rx="${radius - inset}" fill="#fff"/></svg>`);
const gradientSquare = (size, top, bottom) =>
  svg(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/>
    </linearGradient></defs>
    <rect width="${size}" height="${size}" fill="url(#g)"/></svg>`);
const hex = ([r, g, b]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

async function write(image, out) {
  await image.png().toFile(at(out));
  const { width, height } = await sharp(at(out)).metadata();
  console.log(`${out} (${width}x${height})`);
}

async function pixel(buffer, x, y) {
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return [data[i], data[i + 1], data[i + 2]];
}

// ---------- App icon source: a 1024x1024 full-bleed, opaque square ----------

async function fullBleedIcon() {
  if (await exists('design/generated/app-icon-source.png')) {
    // The ChatGPT export has a lighter strip along its bottom ~30px (left over from its
    // concept sheet). Crop a centred 990px square above it, then scale back to 1024.
    const icon = await sharp(at('design/generated/app-icon-source.png'))
      .extract({ left: 17, top: 0, width: 990, height: 990 })
      .resize(1024, 1024, { kernel: 'lanczos3' })
      .removeAlpha()
      .png()
      .toBuffer();
    return { icon, origin: 'design/generated/app-icon-source.png' };
  }
  // Older source: a 512px rounded tile with white corners. Fill the corners with the
  // tile's own gradient so the icon is full bleed.
  const SIZE = 512;
  const RADIUS = 112;
  const tile = await sharp(at('design/app-icon-source.png'))
    .ensureAlpha()
    .composite([{ input: roundedMask(SIZE, 3, RADIUS), blend: 'dest-in' }])
    .png()
    .toBuffer();
  const icon = await sharp(gradientSquare(1024, '#0DC6C1', '#0C7FCC'))
    .composite([{ input: await sharp(tile).resize(1024, 1024, { kernel: 'lanczos3' }).toBuffer() }])
    .removeAlpha()
    .png()
    .toBuffer();
  return { icon, origin: 'design/app-icon-source.png' };
}

/** The white book-and-sparkle glyph only, as alpha (whiter = more opaque), from inside the icon. */
async function glyphFrom(icon) {
  const masked = await sharp(icon)
    .ensureAlpha()
    .composite([{ input: roundedMask(1024, 70, 230), blend: 'dest-in' }])
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { data, info } = masked;
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, o = 0; i < data.length; i += 4, o += 4) {
    const whiteness = Math.min(data[i], data[i + 1], data[i + 2]);
    out[o] = out[o + 1] = out[o + 2] = 255;
    out[o + 3] = data[i + 3] === 0 ? 0 : Math.max(0, Math.min(255, ((whiteness - 60) / 180) * 255));
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

const { icon, origin } = await fullBleedIcon();
console.log(`app icon source: ${origin}`);

// iOS/legacy icon: full bleed (the OS rounds corners), no alpha channel.
await write(sharp(icon).removeAlpha(), 'assets/icons/app-icon.png');

// Android adaptive icon: gradient sampled from the icon's own edges + white glyph in the safe zone.
const top = hex(await pixel(icon, 60, 30));
const bottom = hex(await pixel(icon, 60, 990));
await write(sharp(gradientSquare(1024, top, bottom)), 'assets/images/android-icon-background.png');
const glyph = await glyphFrom(icon);
const fg = 780;
const centred = async (input) => ({
  input: await sharp(input).resize(fg, fg, { kernel: 'lanczos3' }).toBuffer(),
  left: (1024 - fg) / 2,
  top: (1024 - fg) / 2,
});
const transparentSquare = { width: 1024, height: 1024, channels: 4, background: TRANSPARENT };
await write(sharp({ create: transparentSquare }).composite([await centred(glyph)]), 'assets/images/android-icon-foreground.png');
// Android 13+ themed icon: same glyph in a single colour (the OS tints it).
await write(
  sharp({ create: transparentSquare }).composite([await centred(await sharp(glyph).linear(0, 0).toBuffer())]),
  'assets/images/android-icon-monochrome.png',
);

// Favicon: the icon with rounded corners.
await write(
  sharp(await sharp(icon).ensureAlpha().composite([{ input: roundedMask(1024, 0, 220), blend: 'dest-in' }]).png().toBuffer())
    .resize(48, 48, { kernel: 'lanczos3' }),
  'assets/images/favicon.png',
);

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

// ---------- Illustrations ----------

await write(sharp(at('design/robot-reading-source.png')), 'assets/illustrations/onboarding.png');

/**
 * Per-image clean-up for the ChatGPT exports, which were cut from one concept sheet:
 * `cropTop` drops a strip of the neighbouring image along the top edge.
 */
const GENERATED_FIXES = { 'generation-error': { cropTop: 24 } };

async function cleanGenerated(name) {
  let image = sharp(at(`design/generated/${name}.png`)).ensureAlpha();
  const fix = GENERATED_FIXES[name];
  if (fix?.cropTop) {
    const { width, height } = await image.metadata();
    image = sharp(await image.extract({ left: 0, top: fix.cropTop, width, height: height - fix.cropTop }).png().toBuffer());
  }
  // Trim transparent margins, then add an even transparent margin so every illustration sits alike.
  const trimmed = await image.trim({ background: TRANSPARENT, threshold: 10 }).png().toBuffer();
  const { width, height } = await sharp(trimmed).metadata();
  const pad = Math.round(Math.max(width, height) * 0.06);
  // Materialise the padding: sharp would otherwise apply a later resize() before extend().
  const padded = await sharp(trimmed)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: TRANSPARENT })
    .png()
    .toBuffer();
  return sharp(padded);
}

const ILLUSTRATIONS = [
  'empty-decks',
  'deck-success',
  'flashcard-empty',
  'quiz-complete',
  'study-celebration',
  'ai-create',
  'generation-loading',
  'generation-error',
  'progress-growth',
  'streak-celebration',
  'revision-calendar',
];
for (const name of ILLUSTRATIONS) {
  const generated = await exists(`design/generated/${name}.png`);
  const source = generated
    ? await cleanGenerated(name)
    : sharp(await readFile(at(`assets/illustrations/${name}.svg`)), { density: 144 });
  await write(
    source.resize(640, 480, { fit: 'contain', background: TRANSPARENT, kernel: 'lanczos3' }),
    `assets/illustrations/${name}.png`,
  );
  if (generated) console.log(`  (from design/generated/${name}.png)`);
}
