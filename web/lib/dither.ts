// A small ordered dither of our own, for the few places that hold a picture: empty states, the sign-in
// screen and the people page header. We checked DitherKit first and could not confirm a permissive
// licence for it (see the 12 Oct decision), so this is about 40 lines and adds no dependency.
//
// It turns a smooth value field into a grid of dots using a Bayer matrix. The output is one SVG path
// of squares, drawn in currentColor, so a skin tints it with a token and night mode needs no second copy.

// 4x4 Bayer matrix, thresholds 0..15.
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// Smooth fields. Each returns 0 to 1 for a point (x, y) in 0..1.
export const FIELDS = {
  // Soft light from the top right corner.
  glow: (x: number, y: number) => clamp01(1 - Math.hypot(x - 0.85, y - 0.1) * 1.15),
  // Diagonal bands that thin out toward the bottom left.
  bands: (x: number, y: number) => clamp01((0.5 + 0.5 * Math.sin((x + y) * 7)) * (0.25 + 0.75 * (x * 0.6 + (1 - y) * 0.4))),
  // A low hill along the bottom edge.
  hill: (x: number, y: number) => clamp01((y - (0.72 - 0.28 * Math.sin(x * Math.PI))) * 4.5),
} as const;
export type FieldName = keyof typeof FIELDS;

// Is the dot at column c, row r on? `v` is the field value, 0 to 1.
export function dotOn(v: number, c: number, r: number): boolean {
  return v > (BAYER[r % 4][c % 4] + 0.5) / 16;
}

// SVG path data for each row of a cols x rows grid, one `cell` unit square per lit dot. Deterministic.
// An empty string means that row has no lit dot.
export function ditherRows(field: FieldName, cols: number, rows: number, cell = 1): string[] {
  const f = FIELDS[field];
  const out: string[] = [];
  for (let r = 0; r < rows; r++) {
    let d = '';
    for (let c = 0; c < cols; c++) {
      const v = f((c + 0.5) / cols, (r + 0.5) / rows);
      if (dotOn(v, c, r)) d += `M${c * cell} ${r * cell}h${cell}v${cell}h${-cell}z`;
    }
    out.push(d);
  }
  return out;
}

// The same picture as one path.
export function ditherPath(field: FieldName, cols: number, rows: number, cell = 1): string {
  return ditherRows(field, cols, rows, cell).join('');
}
