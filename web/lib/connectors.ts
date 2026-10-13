import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from './db';
import { ApiError, bad } from './errors';

// Meeting-notes sources a lead can connect, so minutes are picked from a list instead of pasted.
// Keys live only on the server, in .data/connections.json (git-ignored, owner-only file mode),
// and are never sent back to the browser. Every note fetched becomes proposals that a person
// accepts, same as pasted minutes.
//
// Granola:   public API, https://public-api.granola.ai, key made in Granola (Settings, Connectors, API keys).
// Fireflies: GraphQL API, https://api.fireflies.ai/graphql, key from Fireflies (Integrations, Fireflies API).
// Fathom:    REST API, https://api.fathom.ai/external/v1, key from Fathom (User Settings, API Access).
//            Header X-Api-Key. GET /meetings lists meetings; include_action_items=true and
//            include_summary=true add action_items[] and default_summary.markdown_formatted.
//            There is no get-one-meeting call, so one meeting is found by paging the list.
//            A Fathom key is per user and sees only that user's own and shared meetings.
//            Docs: https://developers.fathom.ai/quickstart (key, header, base URL),
//            https://developers.fathom.ai/api-reference/meetings/list-meetings (query and response fields),
//            https://developers.fathom.ai/api-overview (rate limits, 429 and Retry-After),
//            https://developers.fathom.ai/faq (key scope).
// Wispr Flow has no REST API for apps like this one. It has a read-only MCP server for its Notetaker
// (browser sign-in, no key), which needs an MCP client with per-user sign-in, so for now it stays paste-only.
//
// Keys: a key in the server environment (GRANOLA_API_KEY, FIREFLIES_API_KEY, FATHOM_API_KEY) wins over
// the key file. On Vercel the file sits in a temp folder and does not survive a cold start, so
// production keys must be env vars.

export type Provider = 'granola' | 'fireflies' | 'fathom';
export const PROVIDERS: Provider[] = ['granola', 'fireflies', 'fathom'];
export const isProvider = (v: unknown): v is Provider => typeof v === 'string' && (PROVIDERS as string[]).includes(v);
const LABEL: Record<Provider, string> = { granola: 'Granola', fireflies: 'Fireflies', fathom: 'Fathom' };
const ENV_VAR: Record<Provider, string> = { granola: 'GRANOLA_API_KEY', fireflies: 'FIREFLIES_API_KEY', fathom: 'FATHOM_API_KEY' };
const envKey = (p: Provider) => process.env[ENV_VAR[p]]?.trim() || undefined;
export type MeetingRow = { id: string; title: string; date: string; attendees: string[] };
export type MeetingNote = { id: string; title: string; date: string; text: string; link: string | null };

type Store = Partial<Record<Provider, { key: string; savedAt: string; savedBy: string }>>;

function file(): string {
  return path.join(dataDir(), 'connections.json');
}
function read(): Store {
  try { return JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { return {}; }
}
function write(s: Store) {
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(s, null, 2), { mode: 0o600 });
}

export type ConnectionState = { connected: boolean; hint: string | null; savedAt: string | null; source: 'env' | 'file' | null; envVar: string };

export function connectionStatus(): Record<Provider, ConnectionState> {
  const s = read();
  const one = (p: Provider): ConnectionState => {
    const env = envKey(p);
    if (env) return { connected: true, hint: `…${env.slice(-4)}`, savedAt: null, source: 'env', envVar: ENV_VAR[p] };
    const f = s[p];
    return { connected: !!f, hint: f ? `…${f.key.slice(-4)}` : null, savedAt: f?.savedAt ?? null, source: f ? 'file' : null, envVar: ENV_VAR[p] };
  };
  return { granola: one('granola'), fireflies: one('fireflies'), fathom: one('fathom') };
}

// The environment wins over the key file (production keys live in env vars).
function keyFor(p: Provider): string {
  const k = envKey(p) ?? read()[p]?.key;
  if (!k) throw bad('not_connected', `${LABEL[p]} is not connected. A lead can connect it from Import minutes.`);
  return k;
}

export async function saveConnection(p: Provider, key: string, by: string): Promise<void> {
  const k = key.trim();
  if (envKey(p)) throw new ApiError(409, 'key_from_env', `${LABEL[p]} uses the key set in the server environment (${ENV_VAR[p]}). Change it in the hosting settings.`);
  if (p === 'granola' && !/^grn_[A-Za-z0-9_-]{8,}$/.test(k)) throw bad('invalid_body', 'A Granola key starts with grn_.', 'apiKey');
  if (k.length < 8 || k.length > 400) throw bad('invalid_body', 'That does not look like an API key.', 'apiKey');
  await listMeetings(p, { days: 7 }, k); // proves the key works before it is kept
  write({ ...read(), [p]: { key: k, savedAt: new Date().toISOString(), savedBy: by } });
}

export function removeConnection(p: Provider): void {
  const s = read();
  delete s[p];
  write(s);
}

async function http(url: string, init: RequestInit, who: string): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new ApiError(502, 'source_unreachable', `${who} did not answer. Try again in a moment.`);
  }
  if (res.status === 401 || res.status === 403) throw new ApiError(400, 'source_key_rejected', `${who} rejected the API key. Check it, or make a new one.`);
  if (res.status === 429) {
    const wait = Number(res.headers.get('retry-after'));
    throw new ApiError(429, 'rate_limited', wait > 0 && wait <= 600 ? `${who} is busy. Wait ${wait} seconds and try again.` : `${who} is busy. Wait a minute and try again.`);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(502, 'source_error', `${who} returned an error (${res.status}).`);
  if (data?.errors?.length) {
    const m = String(data.errors[0]?.message ?? '');
    if (/auth|token|key/i.test(m)) throw new ApiError(400, 'source_key_rejected', `${who} rejected the API key. Check it, or make a new one.`);
    throw new ApiError(502, 'source_error', `${who} said: ${m.slice(0, 160)}`);
  }
  return data;
}

const day = (iso: string) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

export async function listMeetings(p: Provider, opts: { days: number; q?: string }, key = keyFor(p)): Promise<MeetingRow[]> {
  const since = new Date(Date.now() - Math.min(Math.max(opts.days, 1), 365) * 86400000).toISOString();
  if (p === 'granola') {
    const u = new URL('https://public-api.granola.ai/v1/notes');
    u.searchParams.set('created_after', since);
    u.searchParams.set('page_size', '30');
    const data = await http(u.toString(), { headers: { Authorization: `Bearer ${key}` } }, 'Granola');
    const notes: any[] = data?.notes ?? [];
    const q = opts.q?.toLowerCase();
    return notes
      .filter((n) => !n.deleted_at && (!q || String(n.title ?? '').toLowerCase().includes(q)))
      .map((n) => ({ id: String(n.id), title: n.title || 'Untitled meeting', date: day(n.created_at), attendees: (n.attendees ?? []).map((a: any) => a?.name || a?.email).filter(Boolean) }));
  }
  if (p === 'fathom') {
    const q = opts.q?.toLowerCase();
    const rows: MeetingRow[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < FATHOM_MAX_PAGES; page++) {
      const u = new URL(`${FATHOM_BASE}/meetings`);
      u.searchParams.set('created_after', since);
      if (cursor) u.searchParams.set('cursor', cursor);
      const data = await http(u.toString(), { headers: { 'X-Api-Key': key } }, 'Fathom');
      for (const m of (data?.items ?? []) as any[]) {
        const title = String(m.title || m.meeting_title || '');
        if (q && !title.toLowerCase().includes(q)) continue;
        rows.push({ id: String(m.recording_id), title: title || 'Untitled meeting', date: day(m.recording_start_time || m.scheduled_start_time || m.created_at), attendees: fathomAttendees(m) });
      }
      cursor = data?.next_cursor ?? null;
      if (!cursor) break;
    }
    return rows;
  }
  const query = `query List($fromDate: DateTime, $keyword: String, $limit: Int) {
    transcripts(fromDate: $fromDate, keyword: $keyword, limit: $limit) { id title date participants }
  }`;
  const data = await http('https://api.fireflies.ai/graphql', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables: { fromDate: since, keyword: opts.q || undefined, limit: 50 } }),
  }, 'Fireflies');
  return (data?.data?.transcripts ?? []).map((t: any) => ({
    id: String(t.id), title: t.title || 'Untitled meeting', date: t.date ? new Date(Number(t.date)).toISOString().slice(0, 10) : '',
    attendees: (t.participants ?? []).slice(0, 6),
  }));
}

export async function getMeeting(p: Provider, id: string): Promise<MeetingNote> {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw bad('invalid_body', 'Bad meeting id.');
  const key = keyFor(p);
  if (p === 'fathom') {
    // No get-one call exists, so page the last year of meetings until the recording id turns up.
    const since = new Date(Date.now() - 365 * 86400000).toISOString();
    let cursor: string | null = null;
    for (let page = 0; page < FATHOM_MAX_PAGES * 2; page++) {
      const u = new URL(`${FATHOM_BASE}/meetings`);
      u.searchParams.set('created_after', since);
      u.searchParams.set('include_action_items', 'true');
      u.searchParams.set('include_summary', 'true');
      if (cursor) u.searchParams.set('cursor', cursor);
      const data = await http(u.toString(), { headers: { 'X-Api-Key': key } }, 'Fathom');
      const m = ((data?.items ?? []) as any[]).find((x) => String(x.recording_id) === id);
      if (m) {
        return {
          id, title: m.title || m.meeting_title || 'Untitled meeting', date: day(m.recording_start_time || m.scheduled_start_time || m.created_at),
          text: fathomNextSteps(m.action_items, m.default_summary?.markdown_formatted), link: typeof m.url === 'string' ? m.url : null,
        };
      }
      cursor = data?.next_cursor ?? null;
      if (!cursor) break;
    }
    throw new ApiError(404, 'not_found', 'Fathom has no meeting with that id.');
  }
  if (p === 'granola') {
    const n = await http(`https://public-api.granola.ai/v1/notes/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${key}` } }, 'Granola');
    return { id, title: n.title || 'Untitled meeting', date: day(n.created_at), text: String(n.summary_markdown || n.summary_text || ''), link: null };
  }
  const query = `query One($id: String!) { transcript(id: $id) { id title date transcript_url summary { action_items overview } } }`;
  const data = await http('https://api.fireflies.ai/graphql', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables: { id } }),
  }, 'Fireflies');
  const t = data?.data?.transcript;
  if (!t) throw new ApiError(404, 'not_found', 'Fireflies has no meeting with that id.');
  return {
    id, title: t.title || 'Untitled meeting', date: t.date ? new Date(Number(t.date)).toISOString().slice(0, 10) : '',
    text: firefliesNextSteps(String(t.summary?.action_items ?? '')), link: t.transcript_url ?? null,
  };
}

// Fireflies writes action items grouped under a bold name:
//   **Kabir Sethi**\nSend the column list (12:30)\n**Priya**\nShare the template
// This turns them into "(Name) task" lines, which the minutes reader understands.
export function firefliesNextSteps(actionItems: string): string {
  const out: string[] = [];
  let who = '';
  for (const raw of actionItems.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const head = line.match(/^\*\*(.+?)\*\*:?$/);
    if (head) { who = head[1].trim(); continue; }
    const task = line.replace(/^[-*•\d.)\s]+/, '').replace(/\s*\(\d{1,2}:\d{2}(?::\d{2})?\)\s*$/, '').trim();
    if (task) out.push(who ? `(${who}) ${task}` : task);
  }
  return out.length ? `### Next Steps\n${out.join('\n')}` : '';
}

const FATHOM_BASE = 'https://api.fathom.ai/external/v1';
const FATHOM_MAX_PAGES = 4; // the list pages by cursor; four pages is far more than a week of one person's calls

function fathomAttendees(m: any): string[] {
  return ((m?.calendar_invitees ?? []) as any[]).map((a) => a?.name || a?.email).filter(Boolean).slice(0, 6);
}

// Fathom gives action items as objects: { description, completed, assignee: { name, email } }.
// Open ones become "(Name) task" lines. A meeting with none falls back to its summary, which the
// minutes reader scans for a next-steps section. Nothing is a task until a person accepts it.
export function fathomNextSteps(actionItems: unknown, summaryMarkdown?: unknown): string {
  const out: string[] = [];
  for (const a of Array.isArray(actionItems) ? actionItems : []) {
    if (!a || a.completed) continue;
    const task = String(a.description ?? '').replace(/\s+/g, ' ').trim();
    if (!task) continue;
    const who = String(a.assignee?.name ?? '').replace(/[()\n]/g, ' ').trim();
    out.push(who ? `(${who}) ${task}` : task);
  }
  if (out.length) return `### Next Steps\n${out.join('\n')}`;
  return typeof summaryMarkdown === 'string' ? summaryMarkdown.trim() : '';
}
