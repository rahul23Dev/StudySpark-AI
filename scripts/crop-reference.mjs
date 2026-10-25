// Cuts the raster artwork used by the app out of the StudySpark visual reference
// sheet (design/reference.webp, 1536x1024). Run with: npm run assets:reference
// Boxes are pixel coordinates on that sheet; re-measure them if the sheet changes.
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHEET = path.join(root, 'design/reference.webp');
const OUT_DIR = path.join(root, 'assets/images/reference');

const crops = [
  // "Illustrations" panel
  { name: 'illustration-robot-reading', left: 952, top: 528, width: 156, height: 124 },
  { name: 'illustration-books', left: 1118, top: 528, width: 128, height: 124 },
  { name: 'illustration-target', left: 1254, top: 528, width: 120, height: 124 },
  { name: 'illustration-chart', left: 1380, top: 528, width: 124, height: 124 },
  // Feature tiles (artwork only, labels left out)
  { name: 'tile-flashcards', left: 1044, top: 686, width: 100, height: 104 },
  { name: 'tile-quizzes', left: 1158, top: 686, width: 110, height: 104 },
  { name: 'tile-study-plans', left: 1282, top: 686, width: 110, height: 104 },
  { name: 'tile-progress', left: 1406, top: 686, width: 110, height: 104 },
  // Large app icon, top-left of the sheet (cream rounded tile on navy)
  { name: 'app-icon-source', left: 19, top: 17, width: 138, height: 138 },
];

await mkdir(OUT_DIR, { recursive: true });
for (const { name, ...box } of crops) {
  const out = path.join(OUT_DIR, `${name}.png`);
  await sharp(SHEET).extract(box).png().toFile(out);
  console.log(`${name}.png (${box.width}x${box.height})`);
}
