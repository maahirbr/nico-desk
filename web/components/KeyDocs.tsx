'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ProjectLink } from '@/lib/projectLinks';
import { SiteIcon } from './TaskLinks';
import { hostOf, linkText, siteOf } from '@/lib/links';
import { useReadOnly } from './readonly';
import { notify } from './toast';

// Key documents at the top of a project (23 Nov, the PM's call, from a teammate's feedback): the brief, the plan, the
// tracker; a pre-read says so in its name. Everyone who can see the project sees them; anyone on it adds one, and
// removes their own; the owner, its lead or an admin removes any (lib/projectLinks.ts). On a partner project a link can be kept Nicobar only.
async function send(path: string, method: string, body?: unknown): Promise<ProjectLink[]> {
  const res = await fetch(`/api/v1/projects${path}`, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? 'That did not work. Try again.');
  return data.links as ProjectLink[];
}

// canAdd: anyone on the project (23 Nov); canRemoveAny: the owner, its lead or an admin. Anyone removes their own link.
export function KeyDocs({ projectId, links: start, canAdd, canRemoveAny, meId, partner }: { projectId: string; links: ProjectLink[]; canAdd: boolean; canRemoveAny: boolean; meId: string; partner: boolean }) {
  const router = useRouter();
  const readOnly = useReadOnly();
  const edit = canAdd && !readOnly;
  const [links, setLinks] = useState(start);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ url: '', label: '', nicobarOnly: false });
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState<string | null>(null); // the link whose × was pressed: asks before removing
  const [err, setErr] = useState<string | null>(null);
  if (!links.length && !edit) return null;
  const run = async (fn: () => Promise<ProjectLink[]>, done: string) => {
    setBusy(true); setErr(null);
    try { setLinks(await fn()); notify(done); router.refresh(); return true; } catch (e) { setErr((e as Error).message); return false; } finally { setBusy(false); }
  };
  return (
    <section className="keydocs" aria-label="Key documents">
      {/* Empty (23 Nov, the PM's call): just "+ Key documents", quiet, until someone adds the first link. */}
      {!links.length && !adding ? (
        <button type="button" className="linkbtn keydocs-add keydocs-empty" onClick={() => { setAdding(true); setErr(null); }}>+ Key documents</button>
      ) : (
      <div className="keydocs-row">
        {/* "+ Key documents" stays the heading after the first link too (24 Nov, the PM's call): one way to add, no "+ Add". */}
        {edit && !adding ? <button type="button" className="linkbtn keydocs-add keydocs-empty keydocs-head" onClick={() => { setAdding(true); setErr(null); }}>+ Key documents</button>
          : <span className="keydocs-h">Key documents</span>}
        {links.map((l) => {
          const mayRemove = edit && (canRemoveAny || l.createdBy === meId);
          // The × sits inside the bubble, on its right, and asks first (23 Nov, the PM's call: it is small, easy to hit).
          if (asking === l.id) return (
            <span key={l.id} className="keydoc keydoc-ask" role="group" aria-label="Remove this link?">
              <span>Remove “{linkText(l)}”?</span>
              <button type="button" className="keydoc-yes" disabled={busy} onClick={async () => { if (await run(() => send(`/${projectId}/links/${l.id}`, 'DELETE'), 'Link removed')) setAsking(null); }}>Remove</button>
              <button type="button" className="keydoc-no" onClick={() => setAsking(null)}>Keep</button>
            </span>
          );
          return (
            <span key={l.id} className="keydoc">
              <a className="keydoc-link" href={l.url} target="_blank" rel="noopener noreferrer" title={l.url} aria-label={`${linkText(l)}, ${hostOf(l.url)}, opens in a new tab`}>
                <SiteIcon site={siteOf(l.url)} /><span className="lchip-text">{linkText(l)}</span>
              </a>
              {l.nicobarOnly && <span className="keydoc-own" title="Partners on this project do not see this link">Nicobar only</span>}
              {mayRemove && <button type="button" className="keydoc-x" aria-label={`Remove ${linkText(l)}`} title="Remove" onClick={() => setAsking(l.id)}>×</button>}
            </span>
          );
        })}
      </div>
      )}
      {adding && (
        <form className="keydocs-form" onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => send(`/${projectId}/links`, 'POST', { url: f.url, label: f.label || null, nicobarOnly: f.nicobarOnly }), 'Link added')) {
            setF({ url: '', label: '', nicobarOnly: false }); setAdding(false);
          }
        }}>
          <input value={f.url} required maxLength={2000} autoFocus placeholder="Paste a link: Doc, Sheet, Slides" aria-label="Link" onChange={(e) => setF({ ...f, url: e.target.value })} />
          <input value={f.label} maxLength={80} placeholder="Name, e.g. Pre-read, MOMs" aria-label="Name" onChange={(e) => setF({ ...f, label: e.target.value })} />
          {partner && <label className="check"><input type="checkbox" checked={f.nicobarOnly} onChange={(e) => setF({ ...f, nicobarOnly: e.target.checked })} /> Nicobar only</label>}
          <button className="btn" disabled={busy || !f.url.trim()}>Add</button>
          <button type="button" className="act" onClick={() => { setAdding(false); setErr(null); }}>Cancel</button>
          <p className="small dim keydocs-hint">Make sure the file is shared with the people on this project.</p>
        </form>
      )}
      {err && <p className="err" role="alert">{err}</p>}
    </section>
  );
}
