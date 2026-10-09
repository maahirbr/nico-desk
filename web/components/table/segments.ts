// Lays a note out as rows for the drafting table. Each non-empty line of the note is one row.
// A draft's quote is found in the note text and underlined. A quote that is missing, or that overlaps
// an earlier one, cannot sit on a sentence. It goes in `unplaced` and has no tether.

export type Piece = { text: string; draftId?: string };
export type NoteRow = { pieces: Piece[]; draftIds: string[] };
export type Laid = { rows: NoteRow[]; unplaced: string[] };

// A first line "# <title>" repeats the title shown above the table, so it gets no row. The stored text is not changed.
const isTitleLine = (line: string, title: string | undefined) => title !== undefined && /^#{1,6}\s+/.test(line) && line.replace(/^#{1,6}\s+/, "").trim() === title.trim();

export function layoutNote(body: string, drafts: { id: string; quote: string }[], title?: string): Laid {
  const unplaced: string[] = [];
  const ranges: { id: string; start: number; end: number }[] = [];
  for (const d of drafts) {
    const start = d.quote.length > 0 ? body.indexOf(d.quote) : -1;
    if (start < 0) {
      unplaced.push(d.id);
      continue;
    }
    const end = start + d.quote.length;
    if (ranges.some((r) => start < r.end && end > r.start)) unplaced.push(d.id);
    else ranges.push({ id: d.id, start, end });
  }
  ranges.sort((a, b) => a.start - b.start);

  const rows: NoteRow[] = [];
  let offset = 0;
  let first = true;
  for (const line of body.split("\n")) {
    const ls = offset;
    const le = offset + line.length;
    offset = le + 1;
    if (line.trim().length === 0) continue;
    const isFirst = first;
    first = false;
    if (isFirst && isTitleLine(line, title) && !ranges.some((r) => r.end > ls && r.start < le)) continue;
    const pieces: Piece[] = [];
    let at = ls;
    for (const r of ranges) {
      if (r.end <= ls || r.start >= le) continue;
      const a = Math.max(r.start, ls);
      const b = Math.min(r.end, le);
      if (a > at) pieces.push({ text: body.slice(at, a) });
      pieces.push({ text: body.slice(a, b), draftId: r.id });
      at = b;
    }
    if (at < le) pieces.push({ text: body.slice(at, le) });
    rows.push({ pieces, draftIds: ranges.filter((r) => r.start >= ls && r.start < le).map((r) => r.id) });
  }
  return { rows, unplaced };
}
