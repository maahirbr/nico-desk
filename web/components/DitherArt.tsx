import { ditherPath, ditherRows, type FieldName } from '@/lib/dither';

// A dithered picture for empty states, the sign-in screen and the people header. It is decoration only:
// hidden from screen readers, never under text, and drawn in currentColor so `--dither-ink` tints it in
// every skin and in night mode. Runs on the server, so it ships no script.
// It holds still, except with `fade` (empty states, the 404 and error pages): then each row is its own path and
// the rows fade in from the top, once (globals.css .dither-fade; --row-t is how far down the row sits, 0 to 1).
export function DitherArt({ field, cols = 48, rows = 16, className = '', fade = false }: { field: FieldName; cols?: number; rows?: number; className?: string; fade?: boolean }) {
  return (
    <svg className={`dither${fade ? ' dither-fade' : ''} ${className}`.trim()} viewBox={`0 0 ${cols} ${rows}`} preserveAspectRatio="xMidYMid slice" shapeRendering="crispEdges" aria-hidden focusable="false">
      {fade
        ? ditherRows(field, cols, rows).map((d, r) => d && <path key={r} d={d} fill="currentColor" style={{ '--row-t': rows > 1 ? r / (rows - 1) : 0 } as React.CSSProperties} />)
        : <path d={ditherPath(field, cols, rows)} fill="currentColor" />}
    </svg>
  );
}
