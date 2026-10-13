import type { Tx } from './db';
import { jevAsk, jevOn, type JevQuestion, type JevResult } from './jev';
import { maskDictFor, type MaskDict } from './redact';
import { searchCandidates, search, type Cand, type SearchHit } from './search';
import { today as todayIst } from './time';

// Search by meaning (use case 1). Local search gives up to 30 candidates. Jev scores each one against the query in one
// batched request (a Noul per candidate, as in the TypeSafe re-ranking cookbook). Code merges the scores with the local
// order. Off, slow or failed: the caller keeps the plain local result.

const hitId = (h: SearchHit) => `${h.kind}-${h.id}`;
export const KEEP_LOOSE = 0.3; // a candidate that matched no whole query needs at least this score to stay
const STRICT_BONUS = 0.15; // a plain full match keeps a small lead, so a good literal hit is never buried by a near miss
export const MAX_OUT = 20;

// scores: candidate id -> noul (0..1). Missing scores count as 0. Returns the new order. Pure.
export function mergeRank<T extends { hit: SearchHit; strict: boolean }>(local: T[], scores: Map<string, number>): SearchHit[] {
  const ranked = local.map((c, i) => ({ c, i, v: (scores.get(hitId(c.hit)) ?? 0) + (c.strict ? STRICT_BONUS : 0), s: scores.get(hitId(c.hit)) ?? 0 }));
  return ranked
    .filter((x) => x.c.strict || x.s >= KEEP_LOOSE)
    .sort((a, b) => b.v - a.v || a.i - b.i)
    .slice(0, MAX_OUT)
    .map((x) => x.c.hit);
}

export function rerankQuestions(query: string, cands: Cand[]): { state: unknown; questions: Record<string, JevQuestion> } {
  const questions: Record<string, JevQuestion> = {};
  cands.forEach((c, i) => {
    questions[`c${i}`] = {
      type: 'noul',
      instructions: {
        candidate: c.text.slice(0, 400),
        question: 'Is `candidate` something the person who typed `search_query` would want to open? A match by meaning counts, even with no shared word.',
      },
      criteria: { true: 'The item is about what the query asks for.', false: 'The item is on a different subject.' },
    };
  });
  return { state: { search_query: query }, questions };
}

export function askRerank(dict: MaskDict, query: string, cands: Cand[], env?: Record<string, string | undefined>): Promise<JevResult> {
  const { state, questions } = rerankQuestions(query, cands);
  return jevAsk(state, questions, { dict, env });
}

export function scoresOf(r: JevResult, cands: Cand[]): Map<string, number> | null {
  if (!r.ok) return null;
  const out = new Map<string, number>();
  cands.forEach((c, i) => {
    const v = r.answers[`c${i}`]?.noul;
    if (typeof v === 'number') out.set(hitId(c.hit), v);
  });
  return out.size ? out : null;
}

// The route calls this. { hits, ranked }: ranked says whether Jev changed the order.
export async function searchByMeaning(db: Tx, teamId: string, q: string, today = todayIst()): Promise<{ hits: SearchHit[]; ranked: boolean }> {
  const local = async () => ({ hits: await search(db, teamId, q, today), ranked: false });
  if (!jevOn() || q.trim().length < 3) return local();
  try {
    const cands = await searchCandidates(db, teamId, q, today);
    if (cands.length < 2) return local();
    const dict = await maskDictFor(db, teamId);
    const scores = scoresOf(await askRerank(dict, q.trim(), cands), cands);
    if (!scores) return local();
    return { hits: mergeRank(cands, scores), ranked: true };
  } catch {
    return local();
  }
}
