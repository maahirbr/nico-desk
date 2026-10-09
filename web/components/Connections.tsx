'use client';

import { useState } from 'react';

// Where a lead connects the team's meeting-notes tools. Keys are checked against the tool before
// they are kept, stored on the server only, and shown back only as their last four characters.

type Status = Record<'granola' | 'fireflies', { connected: boolean; hint: string | null; savedAt: string | null }>;

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
} as const;

export function Connections({ status: initial, canManage }: { status: Status; canManage: boolean }) {
  const [status, setStatus] = useState(initial);
  return (
    <div className="calm narrow">
      <header className="page-head"><div><h1>Connections</h1><p className="summary">Bring meeting notes in from the tools you already use.</p></div></header>
      {(['granola', 'fireflies'] as const).map((p) => <Card key={p} p={p} s={status[p]} canManage={canManage} onChange={setStatus} />)}
      <section className="card conn">
        <div className="conn-head"><h2>Wispr Flow</h2><span className="st tone-quiet">Paste only</span></div>
        <p className="small dim" style={{ margin: 0 }}>
          Wispr Flow doesn’t offer an API for apps like this one; it only connects to AI assistants such as Claude. Copy a meeting’s
          summary from Wispr Flow and use <b>Import minutes → Paste</b> on any project.
        </p>
      </section>
      <p className="small dim">Keys are kept on this server only, never shown again in full, and used only to read meetings when someone imports one.</p>
    </div>
  );
}

function Card({ p, s, canManage, onChange }: { p: 'granola' | 'fireflies'; s: Status['granola']; canManage: boolean; onChange: (s: Status) => void }) {
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
        {s.connected ? <span className="st tone-ok">Connected · key {s.hint}</span> : <span className="st tone-quiet">Not connected</span>}
      </div>
      <p className="small dim" style={{ margin: 0 }}>{info.what}</p>
      {canManage ? (
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
