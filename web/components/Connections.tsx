'use client';

import { useState } from 'react';
import { Help } from './HelpMode';

// Where a lead connects the team's meeting-notes tools. Keys are checked against the tool before
// they are kept, stored on the server only, and shown back only as their last four characters.

type Name = 'granola' | 'fireflies' | 'fathom';
type State = { connected: boolean; savedAt: string | null; source: 'env' | 'file' | null; envVar: string; envOnly?: boolean };
type Status = Record<Name, State>;

const INFO = {
  granola: {
    name: 'Granola',
    what: 'Lists your Granola meetings and reads each one’s summary and action items.',
    how: ['In the Granola desktop app, open Settings, then Connectors, then API keys.', 'Create a key (it starts with grn_). An Enterprise key from a workspace admin covers the whole team; a personal key needs a Business plan.', 'Paste it below.'],
  },
  fireflies: {
    name: 'Fireflies',
    what: 'Lists your Fireflies meetings and reads each one’s action items, grouped by person.',
    how: ['In Fireflies, open Integrations, then Fireflies API.', 'Copy the API key.', 'Paste it below.'],
  },
  fathom: {
    name: 'Fathom',
    what: 'Lists your Fathom meetings and reads each one’s action items. A Fathom key sees only its owner’s meetings and the ones shared with them.',
    how: ['In Fathom, open User Settings, then API Access.', 'Generate an API key.', 'Paste it below.'],
  },
} as const;

type MeetState = { connected: boolean; email: string | null; since: string | null };

// What the callback tells the lead when they come back from Google, by its short code.
const MEET_CODES: Record<string, { err: boolean; text: string }> = {
  connected: { err: false, text: 'Connected. Google Meet notes are ready to use in Import minutes.' },
  cancelled: { err: true, text: 'Google Meet was not connected. You closed the permission screen.' },
  scopes: { err: true, text: 'Google Meet was not connected. Both permissions are needed: tick both on the Google screen, then try again.' },
  mismatch: { err: true, text: 'Google Meet was not connected. The Google account is not the address on your profile. Pick your own account.' },
  state: { err: true, text: 'Google Meet was not connected. The request expired or came from another browser. Try again.' },
  no_refresh: { err: true, text: 'Google did not give a lasting link. Remove this app at myaccount.google.com/permissions, then try again.' },
  viewing_as: { err: true, text: 'Nothing was saved. You are viewing as someone else, and that view is read-only.' },
  not_allowed: { err: true, text: 'Only a lead can connect Google Meet.' },
  google: { err: true, text: 'Google did not accept the request. Try again.' },
  email: { err: true, text: 'Google did not confirm your email address. Try again.' },
};

export function Connections({ status: initial, canManage, meet = null, meetCode = null }: { status: Status; canManage: boolean; meet?: MeetState | null; meetCode?: string | null }) {
  const [status, setStatus] = useState(initial);
  return (
    <div className="calm">
      <header className="page-head"><div><h1>Connections</h1><p className="summary">Bring meeting notes in from the tools you already use.</p></div></header>
      {(['granola', 'fireflies', 'fathom'] as const).map((p) => <Card key={p} p={p} s={status[p]} canManage={canManage} onChange={setStatus} />)}
      {meet && <MeetCard initial={meet} code={meetCode} />}
      <section className="card conn">
        <div className="conn-head"><h2>Wispr Flow</h2><span className="st tone-quiet">Paste only</span></div>
        <p className="small dim" style={{ margin: 0 }}>
          Wispr Flow has no key-based API for apps like this one. Its Notetaker connects through a read-only MCP server for AI
          assistants such as Claude, and this app does not use that yet. Copy a meeting’s summary from Wispr Flow and use <b>Import minutes → Paste</b> on any project.
        </p>
      </section>
      <p className="small dim">Keys are kept on this server only, never shown again, and used only to read meetings when someone imports one.</p>
    </div>
  );
}

function Card({ p, s, canManage, onChange }: { p: Name; s: State; canManage: boolean; onChange: (s: Status) => void }) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ err: boolean; text: string } | null>(null);
  const info = INFO[p];
  async function send(method: 'POST' | 'DELETE') {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(method === 'POST' ? '/api/v1/connections' : `/api/v1/connections?provider=${p}`, {
        method, headers: method === 'POST' ? { 'content-type': 'application/json' } : undefined,
        body: method === 'POST' ? JSON.stringify({ provider: p, apiKey: key }) : undefined,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message ?? 'That did not work.');
      onChange(data); setKey('');
      setMsg({ err: false, text: method === 'POST' ? 'Connected. The key works.' : 'Disconnected.' });
    } catch (e) { setMsg({ err: true, text: (e as Error).message }); }
    finally { setBusy(false); }
  }
  return (
    <section className="card conn">
      <div className="conn-head">
        <h2>{info.name}</h2>
        {s.connected ? <span className="st tone-ok">Connected{s.source === 'env' && <> · <Help term="conn_from_env">from the server environment</Help></>}</span> : <span className="st tone-quiet">Not connected</span>}
      </div>
      <p className="small dim" style={{ margin: 0 }}>{info.what}</p>
      {canManage && s.source === 'env' ? (
        <p className="small" style={{ margin: 0 }}>This key is set in the server environment (<code>{s.envVar}</code>). To change or remove it, edit that setting where the app is hosted.</p>
      ) : canManage && s.envOnly ? (
        <p className="small" style={{ margin: 0 }}>On the hosted app, this key is set only in the server environment (<code>{s.envVar}</code>). Ask the repo owner to add it.</p>
      ) : canManage ? (
        <>
          {!s.connected && <ol className="steps small">{info.how.map((h) => <li key={h}>{h}</li>)}</ol>}
          <div className="row">
            <input type="password" autoComplete="off" value={key} placeholder={s.connected ? 'Paste a new key to replace it' : `${info.name} API key`} aria-label={`${info.name} API key`}
              onChange={(e) => setKey(e.target.value)} style={{ flex: 1 }} />
            <button className="btn" disabled={busy || key.trim().length < 8} onClick={() => send('POST')}>{busy ? 'Checking…' : s.connected ? 'Replace key' : 'Connect'}</button>
            {s.connected && <button className="btn ghost" disabled={busy} onClick={() => send('DELETE')}>Disconnect</button>}
          </div>
        </>
      ) : <p className="small" style={{ margin: 0 }}>{s.connected ? 'Ready to use in Import minutes.' : 'Ask a lead to connect it.'}</p>}
      {msg && <p className={msg.err ? 'err' : 'ok'} role={msg.err ? 'alert' : 'status'}>{msg.text}</p>}
    </section>
  );
}

// Google Meet is a lead's own account, not a team key. The app asks Google for read-only access to the notes and
// transcripts of meetings that lead was part of, and keeps only an encrypted refresh token.
function MeetCard({ initial, code }: { initial: MeetState; code: string | null }) {
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ err: boolean; text: string } | null>(code ? MEET_CODES[code] ?? null : null);
  async function connect() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/v1/connections/google-meet', { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok || typeof data?.url !== 'string') throw new Error(data?.error?.message ?? 'That did not work.');
      window.location.href = data.url;
    } catch (e) { setMsg({ err: true, text: (e as Error).message }); setBusy(false); }
  }
  async function disconnect() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/v1/connections/google-meet', { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message ?? 'That did not work.');
      setS(data); setMsg({ err: false, text: 'Disconnected. The saved link is deleted and Google was told to end it.' });
    } catch (e) { setMsg({ err: true, text: (e as Error).message }); }
    finally { setBusy(false); }
  }
  return (
    <section className="card conn">
      <div className="conn-head">
        <h2><Help term="conn_meet">Google Meet</Help></h2>
        {s.connected ? <span className="st tone-ok">Connected · {s.email}</span> : <span className="st tone-quiet">Not connected</span>}
      </div>
      <p className="small dim" style={{ margin: 0 }}>Lists the meetings you were part of and reads the notes Gemini made, or the transcript if there are no notes. This reads what Google already made. It does not record.</p>
      {!s.connected && <ol className="steps small">
        <li>Press Connect. Google asks for read-only access to your Meet notes and transcripts.</li>
        <li>Pick the Google account that matches your email here.</li>
        <li>Tick both permissions, then allow.</li>
      </ol>}
      <div className="row">
        <button className="btn" disabled={busy} onClick={connect}>{busy && !s.connected ? 'Opening Google…' : s.connected ? 'Reconnect' : 'Connect Google Meet'}</button>
        {s.connected && <button className="btn ghost" disabled={busy} onClick={disconnect}>Disconnect</button>}
      </div>
      {msg && <p className={msg.err ? 'err' : 'ok'} role={msg.err ? 'alert' : 'status'}>{msg.text}</p>}
    </section>
  );
}
