import { createHash } from 'node:crypto';
import { makeMasker, type MaskDict } from './redact';

// Jev (TypeSafe System One): a small typed client. SERVER ONLY. Import it from route handlers and lib files,
// never from a 'use client' file, so the key and the call never reach a browser bundle.
//
// Everything sent goes through the masker in redact.ts first (names, emails, phones, links and amounts become labels),
// and the answer is mapped back. jevAsk has no path that sends unmasked state, and it needs the dictionary from the database.
// Every feature that uses it must work without it. jevAsk never throws: it returns { ok: false } and the caller
// keeps today's behaviour. It never logs the key or the state it sends.

const URL_API = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-latest';
const BUDGET_MS = 4000; // the whole call, retries included
const TRIES = 4; // one call and up to three retries, on 429 and 529 only
const CACHE_MAX = 300;
const CACHE_MS = 10 * 60 * 1000;

type Env = Record<string, string | undefined>;

// On only when asked for (NICO_JEV=1) and keyed. Never against the hosted database unless NICO_JEV_LIVE=1,
// because the live pilot holds real work text and nothing real goes to a third party without a yes.
export function jevOn(env: Env = process.env): boolean {
  if (env.NICO_JEV !== '1') return false;
  if (!env.TYPESAFE_API_KEY) return false;
  if (env.DATABASE_URL && env.NICO_JEV_LIVE !== '1') return false;
  return true;
}

export type JevQuestion =
  | { type: 'noul'; instructions: unknown; criteria?: { true?: string; false?: string } }
  | { type: 'choice'; instructions: unknown; criteria: Record<string, string | null> }
  | { type: 'score'; instructions: unknown; criteria: string[] };

export type NoulAnswer = { noul: number };
export type ChoiceAnswer = { choice: string; probabilities: Record<string, number>; confidence: number };
export type JevAnswer = Partial<NoulAnswer & ChoiceAnswer> & Record<string, unknown>;

export type JevResult =
  | { ok: true; answers: Record<string, JevAnswer>; usage: { input: number; output: number }; cached: boolean }
  | { ok: false; reason: 'off' | 'timeout' | 'rate' | 'error' };

const cache = new Map<string, { at: number; answers: Record<string, JevAnswer>; usage: { input: number; output: number } }>();
export const jevCacheClear = () => cache.clear();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function jevAsk(
  state: unknown,
  questions: Record<string, JevQuestion>,
  opts: { dict: MaskDict; env?: Env; backoffMs?: number; budgetMs?: number },
): Promise<JevResult> {
  const env = opts.env ?? process.env;
  if (!jevOn(env)) return { ok: false, reason: 'off' };
  // Masking is not optional. On a live database an empty roster means the dictionary did not load: send nothing.
  // If the masker throws, send nothing and let the caller fall back.
  let masker: ReturnType<typeof makeMasker>;
  let body: string;
  try {
    if (env.DATABASE_URL && opts.dict.people.length === 0) return { ok: false, reason: 'error' };
    masker = makeMasker(opts.dict);
    body = JSON.stringify({ state: masker.mask(state), model: MODEL, questions: masker.mask(questions) });
  } catch {
    return { ok: false, reason: 'error' };
  }
  const key = createHash('sha256').update(body).digest('hex');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return { ok: true, answers: masker.unmask(hit.answers), usage: hit.usage, cached: true };

  const budget = opts.budgetMs ?? BUDGET_MS;
  const backoff = opts.backoffMs ?? 250;
  const deadline = Date.now() + budget;
  let last: 'timeout' | 'rate' | 'error' = 'error';
  for (let attempt = 0; attempt < TRIES; attempt++) {
    const left = deadline - Date.now();
    if (left <= 0) return { ok: false, reason: 'timeout' };
    try {
      const res = await fetch(URL_API, {
        method: 'POST',
        headers: { authorization: `Bearer ${env.TYPESAFE_API_KEY}`, 'content-type': 'application/json' },
        body,
        signal: AbortSignal.timeout(left),
        cache: 'no-store',
      });
      if (res.status === 429 || res.status === 529) {
        last = 'rate';
        if (attempt + 1 < TRIES) await sleep(Math.min(backoff * (attempt + 1), Math.max(0, deadline - Date.now())));
        continue;
      }
      if (!res.ok) return { ok: false, reason: 'error' };
      const json = (await res.json()) as { answers?: Record<string, JevAnswer>; usage?: { input_tokens?: number; output_tokens?: number } };
      if (!json || typeof json.answers !== 'object' || !json.answers) return { ok: false, reason: 'error' };
      const usage = { input: json.usage?.input_tokens ?? 0, output: json.usage?.output_tokens ?? 0 };
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
      cache.set(key, { at: Date.now(), answers: json.answers, usage });
      return { ok: true, answers: masker.unmask(json.answers), usage, cached: false };
    } catch (e) {
      const name = (e as { name?: string })?.name;
      return { ok: false, reason: name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'error' };
    }
  }
  return { ok: false, reason: last };
}
