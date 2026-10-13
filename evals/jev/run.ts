// Jev evals, on synthetic data only (fixtures/ and evals/jev/*.json).
//
// Run from web/ with the key in the environment (never printed):
//   set -a; . web/.env.local; set +a
//   cd web && NICO_JEV=1 npx tsx ../evals/jev/run.ts
//
// What it measures:
//   1. Status nudge, asked twice: MASKED (the app's own path, lib/jev.ts, with the dictionary from the database)
//      and RAW (the same question posted without masking, here in the eval only, to see what masking costs).
//      Prints accuracy, confusion, a threshold sweep and the threshold it picks.
//   2. Search by meaning: the app's own path (searchCandidates -> askRerank -> mergeRank) against plain local
//      search, as the hit rate of the right answer in the top 3.
//   3. Latency and tokens per call.
import fs from 'node:fs';
import path from 'node:path';
import { openDb } from '../../web/lib/db';
import { jevCacheClear } from '../../web/lib/jev';
import { maskDictFor } from '../../web/lib/redact';
import { decide, readPick, askStatus, statusQuestion, WORD, type StatusKey, type StatusPick } from '../../web/lib/jevStatus';
import { askRerank, mergeRank, scoresOf } from '../../web/lib/jevSearch';
import { search, searchCandidates } from '../../web/lib/search';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const TEAM = 'team_pilot';
const TODAY = '2026-10-09';
const KEYS: StatusKey[] = ['todo', 'doing', 'blocked', 'done', 'dropped'];
type Expect = StatusKey | 'none';
const COLS: Expect[] = [...KEYS, 'none'];
const LABEL: Record<Expect, string> = { ...WORD, none: 'No change' };

type Case = { id: string; title: string; now: StatusKey; note: string; expect: Expect };
type Row = { c: Case; pick: StatusPick | null; ms: number; tokens: number; ok: boolean };

const env = { ...process.env, DATABASE_URL: undefined, NICO_JEV: '1' } as Record<string, string | undefined>;
if (!env.TYPESAFE_API_KEY) {
  console.error('TYPESAFE_API_KEY is not set. Load web/.env.local first.');
  process.exit(1);
}

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

// The unmasked arm. Eval only, synthetic text only. The app has no path like this.
async function askRaw(c: Case): Promise<{ pick: StatusPick | null; ms: number; tokens: number }> {
  const body = JSON.stringify({ state: { task_title: c.title, status_now: WORD[c.now], note: c.note }, model: 'jev-latest', questions: { status: statusQuestion() } });
  const t0 = Date.now();
  for (let a = 0; a < 3; a++) {
    const res = await fetch('https://api.typesafe.ai/v1/systemone', { method: 'POST', headers: { authorization: `Bearer ${env.TYPESAFE_API_KEY}`, 'content-type': 'application/json' }, body });
    if (res.status === 429 || res.status === 529) { await new Promise((r) => setTimeout(r, 400 * (a + 1))); continue; }
    if (!res.ok) return { pick: null, ms: Date.now() - t0, tokens: 0 };
    const j = (await res.json()) as { answers?: Record<string, never>; usage?: { input_tokens?: number; output_tokens?: number } };
    return { pick: readPick(j.answers?.status), ms: Date.now() - t0, tokens: (j.usage?.input_tokens ?? 0) + (j.usage?.output_tokens ?? 0) };
  }
  return { pick: null, ms: Date.now() - t0, tokens: 0 };
}

const predicted = (r: Row): Expect | 'fail' => (!r.pick ? 'fail' : r.pick.choice === null ? 'none' : r.pick.choice);
const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : 'n/a');
const pad = (s: string | number, n: number) => String(s).padStart(n);
const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };

function report(name: string, rows: Row[]) {
  const right = rows.filter((r) => predicted(r) === r.c.expect).length;
  const fails = rows.filter((r) => !r.pick).length;
  console.log(`\n== Status, ${name}: ${right}/${rows.length} right (${pct(right, rows.length)}), ${fails} failed calls`);
  console.log('confusion (rows: expected, columns: picked)');
  console.log(' '.repeat(12) + [...COLS, 'fail'].map((c) => pad(c === 'none' ? 'nochg' : c, 8)).join(''));
  for (const e of COLS) {
    const rs = rows.filter((r) => r.c.expect === e);
    console.log(pad(e === 'none' ? 'nochg' : e, 11) + ' ' + [...COLS, 'fail'].map((c) => pad(rs.filter((r) => predicted(r) === c).length, 8)).join('') + `   (${rs.length})`);
  }
  for (const e of COLS) {
    const miss = rows.filter((r) => r.c.expect === e && predicted(r) !== e);
    if (miss.length) console.log(`misses expecting ${LABEL[e]}: ` + miss.map((r) => `${r.c.id}->${predicted(r)}${r.pick ? '@' + r.pick.p.toFixed(2) : ''}`).join(', '));
  }
  const ms = rows.map((r) => r.ms);
  console.log(`latency ms: p50 ${q(ms, 0.5)}, p90 ${q(ms, 0.9)}, max ${Math.max(...ms)}; over 4000ms: ${ms.filter((x) => x > 4000).length}; mean tokens per call ${(rows.reduce((s, r) => s + r.tokens, 0) / rows.length).toFixed(0)}`);
}

// An offer is right when the UI would show the status the case expects. A wrong offer is any other offer.
// The threshold is the lowest one with no wrong offer in either arm, plus 0.15 of room, because a small set
// cannot show where the next wrong pick will land.
function sweep(arms: { name: string; rows: Row[] }[]) {
  const rows = arms[0].rows;
  const should = rows.filter((r) => r.c.expect !== 'none' && r.c.expect !== r.c.now).length;
  console.log(`\n== Threshold sweep. Cases that should get an offer: ${should}. Wrong = an offer that is not the expected status.`);
  console.log('   t' + arms.map((a) => `  ${a.name}: offers right wrong`).join(''));
  let zero = -1;
  for (let t = 0.5; t <= 0.951; t += 0.05) {
    let wrongAll = 0;
    const cells = arms.map((a) => {
      let offers = 0, right = 0;
      for (const r of a.rows) {
        const o = decide(r.pick, r.c.now, t);
        if (!o) continue;
        offers++;
        if (o === r.c.expect) right++;
      }
      wrongAll += offers - right;
      return `  ${pad('', a.name.length)}  ${pad(offers, 6)} ${pad(right, 5)} ${pad(offers - right, 5)}`;
    });
    console.log(`${pad(t.toFixed(2), 5)}${cells.join('')}`);
    if (zero < 0 && wrongAll === 0) zero = Math.round(t * 100) / 100;
  }
  const chosen = Math.min(0.95, Math.round((zero + 0.15) * 100) / 100);
  console.log(`first threshold with no wrong offer in either arm: ${zero}. chosen threshold: ${chosen}`);
  for (const a of arms) {
    const right = a.rows.filter((r) => (decide(r.pick, r.c.now, chosen) ?? 'none') === (r.c.expect === r.c.now ? 'none' : r.c.expect)).length;
    console.log(`at ${chosen}, ${a.name}: the app does the right thing (offer the right status, or stay quiet) on ${right}/${a.rows.length} notes`);
  }
}

async function main() {
  const cases = (JSON.parse(fs.readFileSync(path.join(HERE, 'notes.json'), 'utf8')) as { cases: Case[] }).cases;
  const queries = (JSON.parse(fs.readFileSync(path.join(HERE, 'queries.json'), 'utf8')) as { queries: { q: string; expect: string[] }[] }).queries;
  const db = await openDb();
  const dict = await maskDictFor(db, TEAM);
  console.log(`dictionary: ${dict.people.length} people, ${dict.projects.length} project and workstream names. ${cases.length} notes, ${queries.length} queries.`);
  jevCacheClear();

  const masked: Row[] = await pool(cases, 4, async (c) => {
    const t0 = Date.now();
    const r = await askStatus(dict, c.title, c.now, c.note, { ...env });
    const ms = Date.now() - t0;
    const pick = r.ok ? readPick(r.answers.status as never) : null;
    return { c, pick, ms, tokens: r.ok ? r.usage.input + r.usage.output : 0, ok: r.ok };
  });
  const raw: Row[] = await pool(cases, 4, async (c) => {
    const r = await askRaw(c);
    return { c, pick: r.pick, ms: r.ms, tokens: r.tokens, ok: !!r.pick };
  });
  report('masked (the app path)', masked);
  report('raw (no masking, eval only)', raw);
  const am = masked.filter((r) => predicted(r) === r.c.expect).length;
  const ar = raw.filter((r) => predicted(r) === r.c.expect).length;
  console.log(`\nmasking cost: masked ${am}/${cases.length}, raw ${ar}/${cases.length}, difference ${(((am - ar) * 100) / cases.length).toFixed(1)} points`);
  const flips = cases.filter((c, i) => predicted(masked[i]) !== predicted(raw[i])).map((c) => c.id);
  console.log(`cases where the two arms differ: ${flips.join(', ') || 'none'}`);
  sweep([{ name: 'masked', rows: masked }, { name: 'raw', rows: raw }]);

  // Search
  console.log('\n== Search by meaning');
  let localHit = 0, jevHit = 0, failed = 0;
  const ms: number[] = [], toks: number[] = [], sizes: number[] = [];
  for (const k of queries) {
    const local = (await search(db, TEAM, k.q, TODAY)).slice(0, 3).map((h) => `${h.kind}-${h.id}`);
    const cands = await searchCandidates(db, TEAM, k.q, TODAY);
    const t0 = Date.now();
    const r = await askRerank(dict, k.q, cands, { ...env });
    ms.push(Date.now() - t0);
    sizes.push(cands.length);
    const scores = scoresOf(r, cands);
    if (r.ok) toks.push(r.usage.input + r.usage.output);
    const top = scores ? mergeRank(cands, scores).slice(0, 3).map((h) => `${h.kind}-${h.id}`) : local;
    if (!scores) failed++;
    const lh = local.some((id) => k.expect.includes(id));
    const jh = top.some((id) => k.expect.includes(id));
    if (lh) localHit++;
    if (jh) jevHit++;
    const inPool = cands.some((c) => k.expect.includes(`${c.hit.kind}-${c.hit.id}`));
    console.log(`${lh ? 'L' : '.'}${jh ? 'J' : '.'} cands ${pad(cands.length, 2)} ${inPool ? 'in-pool ' : 'NOT-in-pool'} "${k.q}" -> ${top.join(', ') || '(none)'}`);
  }
  console.log(`top-3 hit rate: local ${localHit}/${queries.length} (${pct(localHit, queries.length)}), with Jev ${jevHit}/${queries.length} (${pct(jevHit, queries.length)}), failed calls ${failed}`);
  console.log(`latency ms: p50 ${q(ms, 0.5)}, p90 ${q(ms, 0.9)}, max ${Math.max(...ms)}; over 4000ms: ${ms.filter((x) => x > 4000).length}; mean candidates ${(sizes.reduce((a, b) => a + b, 0) / sizes.length).toFixed(1)}; mean tokens per call ${(toks.reduce((a, b) => a + b, 0) / Math.max(1, toks.length)).toFixed(0)}`);
}

main().then(() => process.exit(0), (e) => { console.error('eval failed:', (e as Error).message); process.exit(1); });
