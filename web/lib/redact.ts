import fs from 'node:fs';
import path from 'node:path';
import type { Tx } from './db';
import { teamProjects } from './plan';
import { teamTasks } from './service';

// The masking layer. SERVER ONLY. Every request to Jev goes through makeMasker (see jev.ts): there is no way to send
// unmasked state. Names come from the database, not from a list in the code.
//
// What it does, in one request:
//   roster people (display name, first name, last name, emails, alt emails)  ->  Person 1, Person 2 ...
//   project names and workstream names                                       ->  Project 1 ...
//   extra terms from web/pilot/jev-terms.local.json (git-ignored)            ->  Term 1 ...
//   any email, phone number (with or without a country code) or link found by pattern                         ->  Email 1, Phone 1, Link 1
//   currency amounts and plain numbers of 4 digits or more                   ->  Amount 1
// Dates (2026-10-09) and status words stay, because Jev needs them.
//
// RESIDUAL RISK: a name that is not on the roster, not a project or workstream, and not in the terms file (a vendor,
// a partner, a customer) passes through unchanged. Free text cannot be fully masked by rules. Put those names in
// web/pilot/jev-terms.local.json as a JSON array of strings, e.g. ["Some Vendor", "Partner Name"].
//
// The map from placeholder back to the real text lives inside one Masker, for one request. It is never logged or stored.

export type MaskDict = {
  people: { names: string[]; emails: string[] }[]; // one entry per person: every name form and every address
  projects: string[]; // project names and workstream names
  terms?: string[]; // extra names to hide
};

const OPEN = '';
const CLOSE = '';
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A name matches as a whole word: not inside a longer word ("Ada" is left alone in "Adam").
const wordRe = (s: string) => new RegExp(`(?<![\\p{L}\\p{N}_])${esc(s).replace(/\s+/g, '\\s+')}(?![\\p{L}\\p{N}_])`, 'giu');

const RE_DATE = /(?<![\d-])\d{4}-\d{2}-\d{2}(?![\d-])/g;
const RE_URL = /\b(?:https?:\/\/|www\.)[^\s)>\]"']+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|in|co|org|net|io|ai|app|dev|test|me)\b(?:\/[^\s)>\]"']*)?/gi;
const RE_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
// Separators are spaces, tabs, dots, dashes and brackets only, never a line break, so two lines never join into one number.
const RE_PHONE = /(?<![\w])\+?\(?\d[\d \t().-]{6,}\d(?![\w])/g;
const RE_MONEY = /(?:(?:₹|Rs\.?|INR|USD|\$|€|£)\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:k|lakhs?|lacs?|cr|crores?|m|mn|million)\b)?|\b\d[\d,]*(?:\.\d+)?\s?(?:k|lakhs?|lacs?|crores?|rupees|rs|inr|usd|dollars)\b)/gi;
const RE_NUMBER = /(?<![\w.])\d[\d,]{3,}(?:\.\d+)?(?![\w])|(?<![\w.])\d{4,}(?![\w])/g;

type Kind = 'Person' | 'Project' | 'Term' | 'Email' | 'Phone' | 'Link' | 'Amount';

export type Masker = {
  mask<T>(v: T): T; // strings, and strings inside objects and arrays (values and keys)
  unmask<T>(v: T): T;
};

export function makeMasker(dict: MaskDict): Masker {
  const held: string[] = []; // sentinel index -> the text to put back (a held date, or a label)
  const labelOf = new Map<string, string>(); // `${kind}:${lower-case original}` -> label
  const back = new Map<string, string>(); // label -> real text (the first one seen)
  const counts: Record<Kind, number> = { Person: 0, Project: 0, Term: 0, Email: 0, Phone: 0, Link: 0, Amount: 0 };

  // A person has many spellings (full name, first name, emails) but one label: they share the canonical text.
  const label = (kind: Kind, original: string): string => {
    const key = `${kind}:${original.toLowerCase()}`;
    const known = labelOf.get(key);
    if (known) return known;
    const l = `${kind} ${++counts[kind]}`;
    labelOf.set(key, l);
    back.set(l, original);
    return l;
  };
  // Sentinels use private-use characters only, so no later pattern can match inside a finished replacement.
  const hold = (text: string) => {
    held.push(text);
    return OPEN + String(held.length - 1).replace(/\d/g, (d) => String.fromCharCode(0xe100 + Number(d))) + CLOSE;
  };
  const SENT = new RegExp(`${OPEN}([\\uE100-\\uE109]+)${CLOSE}`, 'g');

  // Named things: longest first, so "Autumn landing page" wins over "Autumn".
  type Rule = { re: RegExp; kind: Kind; canonical: string; alias: string };
  const rules: Rule[] = [];
  const seenRule = new Set<string>();
  const addRule = (alias: string, kind: Kind, canonical: string) => {
    const a = alias.trim();
    if (a.length < 2) return;
    const k = `${kind}:${a.toLowerCase()}`;
    if (seenRule.has(k)) return;
    seenRule.add(k);
    rules.push({ re: wordRe(a), kind, canonical, alias: a });
  };
  for (const p of dict.people) {
    const canon = p.names[0] ?? p.emails[0];
    if (canon) for (const a of [...p.names, ...p.emails]) addRule(a, 'Person', canon);
  }
  dict.projects.forEach((n) => addRule(n, 'Project', n));
  (dict.terms ?? []).forEach((n) => addRule(n, 'Term', n));
  rules.sort((a, b) => b.alias.length - a.alias.length);

  const maskString = (input: string): string => {
    let s = input;
    const sub = (re: RegExp, f: (m: string) => string | null) => { s = s.replace(re, (m) => { const l = f(m); return l === null ? m : hold(l); }); };
    // 1. keep ISO dates untouched while the number rules run
    sub(RE_DATE, (m) => m);
    // 2. emails (roster addresses first, so they take the person's label), then links
    for (const r of rules) if (r.alias.includes('@')) sub(r.re, () => label('Person', r.canonical));
    sub(RE_EMAIL, (m) => label('Email', m));
    sub(RE_URL, (m) => label('Link', m));
    // 3. names, longest first
    for (const r of rules) if (!r.alias.includes('@')) sub(r.re, () => label(r.kind, r.canonical));
    // 4. phones (nine digits or more), money, then plain long numbers
    sub(RE_PHONE, (m) => { const n = m.replace(/\D/g, '').length; return n >= 9 || (m.startsWith('+') && n >= 8) ? label('Phone', m) : null; });
    sub(RE_MONEY, (m) => label('Amount', m));
    sub(RE_NUMBER, (m) => label('Amount', m));
    // 5. put the labels and the held dates in
    return s.replace(SENT, (_m, d: string) => held[Number([...d].map((c) => c.charCodeAt(0) - 0xe100).join(''))]);
  };

  const unmaskString = (s: string): string => {
    if (!back.size) return s;
    const labels = [...back.keys()].sort((a, b) => b.length - a.length);
    const re = new RegExp(`(?<![\\p{L}\\p{N}])(${labels.map(esc).join('|')})(?![\\p{L}\\p{N}])`, 'gu');
    return s.replace(re, (m) => back.get(m) ?? m);
  };

  const walk = (v: unknown, f: (s: string) => string): unknown => {
    if (typeof v === 'string') return f(v);
    if (Array.isArray(v)) return v.map((x) => walk(x, f));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [f(k), walk(x, f)]));
    return v;
  };

  return {
    mask: <T,>(v: T) => walk(v, maskString) as T,
    unmask: <T,>(v: T) => walk(v, unmaskString) as T,
  };
}

// ---------- the dictionary, read from the database ----------

function extraTerms(): string[] {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'pilot', 'jev-terms.local.json'), 'utf8'));
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

type PRow = { display_name: string; email: string | null; contact_email: string | null; alt_emails: string[] | null };

export async function maskDictFor(db: Tx, teamId: string): Promise<MaskDict> {
  const { rows } = await db.query<PRow>(
    `SELECT display_name, email, contact_email, alt_emails FROM people WHERE id IN (SELECT person_id FROM team_members WHERE team_id = $1)`,
    [teamId],
  );
  const people = rows.map((r) => {
    const parts = r.display_name.trim().split(/\s+/);
    const names = [r.display_name, ...(parts.length > 1 ? [parts[0], parts[parts.length - 1]] : [])];
    return { names, emails: [r.email, r.contact_email, ...(r.alt_emails ?? [])].filter((e): e is string => !!e) };
  });
  const [projects, tasks] = await Promise.all([teamProjects(db, teamId), teamTasks(db, teamId, '2000-01-01')]);
  const names = new Set<string>();
  for (const p of projects) { names.add(p.name); p.workstreams.forEach((w) => names.add(w)); }
  for (const t of tasks) if (t.workstream) names.add(t.workstream);
  return { people, projects: [...names], terms: extraTerms() };
}
