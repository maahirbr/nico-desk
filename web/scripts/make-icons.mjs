// Draws the home-screen icons from the app mark (app/icon.svg: a terracotta square with a serif "n").
// Run with: node scripts/make-icons.mjs (from web/). The PNGs in public/icons are committed, so this is only for a redraw.
// Uses sharp, which Next.js already installs. The "n" is set in the system serif, so redraw on a Mac or a machine with Georgia.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ACCENT = '#b5532c'; // the mark's colour, as in app/icon.svg
const dir = fileURLToPath(new URL('../public/icons/', import.meta.url));
mkdirSync(dir, { recursive: true });

// radius: share of the side that is rounded. glyph: font size as a share of the side.
const svg = (size, radius, glyph) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * radius}" fill="${ACCENT}"/>
  <text x="${size / 2}" y="${size * 0.5 + glyph * size * 0.5 * 0.68}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${size * glyph}" font-weight="600" fill="#ffffff">n</text>
</svg>`;

const out = [
  // Rounded, for the "any" purpose: same shape as the favicon.
  ['icon-192.png', 192, 0.25, 0.56],
  ['icon-512.png', 512, 0.25, 0.56],
  // Full bleed, with the glyph inside the central 60% (the maskable safe zone), so any mask keeps it whole.
  ['maskable-512.png', 512, 0, 0.42],
  // iOS rounds the corners itself and fills transparent ones with black, so this one is full bleed too.
  ['apple-touch-icon.png', 180, 0, 0.52],
];
for (const [name, size, radius, glyph] of out) {
  await sharp(Buffer.from(svg(size, radius, glyph)), { density: 300 }).resize(size, size).png().toFile(dir + name);
  console.log('wrote', name);
}
