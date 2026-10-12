import { ditherPath, type FieldName } from '@/lib/dither';

// A dithered picture for empty states, the sign-in screen and the people header. It is decoration only:
// hidden from screen readers, never under text, and drawn in currentColor so `--dither-ink` tints it in
// every skin and in night mode. It does not move. Runs on the server, so it ships no script.
export function DitherArt({ field, cols = 48, rows = 16, className = '' }: { field: FieldName; cols?: number; rows?: number; className?: string }) {
  return (
    <svg className={`dither ${className}`.trim()} viewBox={`0 0 ${cols} ${rows}`} preserveAspectRatio="xMidYMid slice" shapeRendering="crispEdges" aria-hidden focusable="false">
      <path d={ditherPath(field, cols, rows)} fill="currentColor" />
    </svg>
  );
}
