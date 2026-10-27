// Typo-tolerant word matching, local and pure: no outside model. Used by search (lib/search.ts) and by the
// commands in Cmd+K (components/commands.ts).
//
// A word matches a text in one of two ways:
//  - it sits inside the text as typed (accents and case ignored): an exact match, which includes a prefix;
//  - it is a few edits away from one word of the text, or from the start of one: a fuzzy match. An edit is one
//    letter added, dropped, changed, or two neighbours swapped. Words of 1 to 3 letters get no edits (too many false
//    hits), 4 to 7 letters get one edit, 8 or more get two.

export const fold = (s: string): string => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
export const tokensOf = (s: string): string[] => fold(s).split(/[^a-z0-9]+/).filter(Boolean);
export const allowedEdits = (len: number): number => (len <= 3 ? 0 : len <= 7 ? 1 : 2);

// Edit distance with swaps (optimal string alignment). Gives up and returns max + 1 once it must exceed max.
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      let d = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prev2[j - 2] + 1);
      cur[j] = d;
      if (d < best) best = d;
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

export type WordMatch = 0 | 1 | 2; // none, exact, fuzzy

// `hay` is the folded text, `tokens` its folded words. `w` is a folded query word.
export function matchWord(w: string, hay: string, tokens: string[]): WordMatch {
  if (hay.includes(w)) return 1;
  const k = allowedEdits(w.length);
  if (!k) return 0;
  const bare = w.replace(/[^a-z0-9]/g, '');
  if (bare.length < 4) return 0;
  for (const tok of tokens) {
    if (editDistance(bare, tok, k) <= k) return 2;
    // A word still being typed: compare with the start of a longer word.
    if (tok.length > bare.length && editDistance(bare, tok.slice(0, bare.length), k) <= k) return 2;
  }
  return 0;
}

// How many of the words the text holds, and how many of those only by a typo. The text is split into words once, and
// only when a word has no exact match.
export function scoreText(words: string[], text: string): { matched: number; fuzzy: number } {
  const hay = fold(text);
  let toks: string[] | null = null;
  let matched = 0;
  let fuzzy = 0;
  for (const w of words) {
    let m = matchWord(w, hay, []);
    if (!m) { toks ??= tokensOf(text); m = matchWord(w, hay, toks); }
    if (m) matched++;
    if (m === 2) fuzzy++;
  }
  return { matched, fuzzy };
}
