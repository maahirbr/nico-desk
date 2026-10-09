// A status: an 8px square plus its word. Colour never stands without the word.
const TONE = {
  grey: "var(--rag-grey)",
  red: "var(--rag-red-vivid)",
  amber: "var(--rag-amber-vivid)",
  green: "var(--rag-green-vivid)",
} as const;

export type Tone = keyof typeof TONE;

const HEALTH: Record<string, { word: string; tone: Tone }> = {
  not_started: { word: "Not started", tone: "grey" },
  off_track: { word: "Off track", tone: "red" },
  on_track: { word: "On track", tone: "green" },
  ahead: { word: "Ahead", tone: "green" },
  on_time: { word: "On time", tone: "grey" },
  late: { word: "Late", tone: "red" },
};

export function Mark({ kind, word, tone }: { kind?: string | null; word?: string; tone?: Tone }) {
  const h = kind ? HEALTH[kind] : undefined;
  const label = word ?? h?.word ?? "No health";
  const color = TONE[tone ?? h?.tone ?? "grey"];
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span aria-hidden className="inline-block size-2" style={{ background: color }} />
      <span>{label}</span>
    </span>
  );
}
