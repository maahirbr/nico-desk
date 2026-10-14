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
// Wispr Flow has no public API (only a read-only MCP connection for AI tools), so it stays paste-only.

export type Provider = 'granola' | 'fireflies';
export const PROVIDERS: Provider[] = ['granola', 'fireflies'];
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

export function connectionStatus(): Record<Provider, { connected: boolean; hint: string | null; savedAt: string | null }> {
  const s = read();
  const one = (p: Provider) => ({ connected: !!s[p], hint: s[p] ? `…${s[p]!.key.slice(-4)}` : null, savedAt: s[p]?.savedAt ?? null });
  return { granola: one('granola'), fireflies: one('fireflies') };
}

function keyFor(p: Provider): string {
  const k = read()[p]?.key ?? process.env[p === 'granola' ? 'GRANOLA_API_KEY' : 'FIREFLIES_API_KEY'];
  if (!k) throw bad('not_connected', `${p === 'granola' ? 'Granola' : 'Fireflies'} is not connected. A lead can connect it from Import minutes.`);
  return k;
}

export async function saveConnection(p: Provider, key: string, by: string): Promise<void> {
  const k = key.trim();
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
  if (res.status === 429) throw new ApiError(429, 'rate_limited', `${who} is busy. Wait a minute and try again.`);
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
