'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import type { CommentResult, CommentView, MailTarget, Part } from '@/lib/comments';
import { suggest } from '@/lib/quickadd';
import { fmtStamp } from '@/lib/time';
import { Avatar, PersonLink } from './chips';
import { Help } from './HelpMode';
import { useReadOnly } from './readonly';
import { api } from './task-ui';
import { useOpenTask } from './taskUrl';
import { notify } from './toast';
import { composing } from './ime';
import { Count } from './LimitNotice';

// Comments on a task or a project. Typing @ or # opens a picker; a pick puts the name in the text and remembers the id,
// and on send the names become tokens ([[person:ID]]) that the server checks again (lib/comments.ts).
// Nothing is emailed from here: "Urgent: also email" only shows Gmail links that open a draft the writer sends.
// The mobile keyboard rule is met by components/KeyboardDismiss.tsx, which covers every field in the app.

type Person = { id: string; name: string };
type Choice = { kind: 'person' | 'task' | 'project'; id: string; label: string; sub?: string };
type Pick = { at: number; mark: '@' | '#'; word: string };
type Sent = { mail: MailTarget[]; text: string; by: string };

const MAX_TYPED = 1500; // leaves room for the tokens, which are longer than the names they stand for
const tokenOf = (c: Choice) => `[[${c.kind}:${c.id}]]`;
const labelOf = (c: Choice) => (c.kind === 'person' ? '@' : '#') + c.label.replace(/\s+/g, ' ').trim();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The text the writer sees for a saved comment, and the label-to-token map that goes with it.
function editable(parts: Part[]): { text: string; map: [string, string][] } {
  const map: [string, string][] = [];
  const text = parts.map((p) => {
    if (p.t === 'text') return p.text;
    if (p.t === 'hidden') return '(hidden item)';
    const c: Choice = p.t === 'person' ? { kind: 'person', id: p.id, label: p.name } : p.t === 'task' ? { kind: 'task', id: p.id, label: p.title } : { kind: 'project', id: p.id, label: p.name };
    map.push([labelOf(c), tokenOf(c)]);
    return labelOf(c);
  }).join('');
  return { text, map };
}

const plain = (parts: Part[]) => parts.map((p) => (p.t === 'text' ? p.text : p.t === 'person' ? `@${p.name}` : p.t === 'task' ? p.title : p.t === 'project' ? p.name : 'a hidden item')).join('');

function Composer({ people, initial, label, resetOnPost, submit, onCancel }: {
  people: Person[]; initial?: { text: string; map: [string, string][] }; label: string; resetOnPost?: boolean;
  submit: (body: string, urgent: boolean) => Promise<void>; onCancel?: () => void;
}) {
  const [text, setText] = useState(initial?.text ?? '');
  const map = useRef(new Map<string, string>(initial?.map ?? []));
  const [urgent, setUrgent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pick, setPick] = useState<Pick | null>(null);
  const [found, setFound] = useState<Choice[]>([]);
  const [sel, setSel] = useState(0);
  const ta = useRef<HTMLTextAreaElement>(null);
  const listId = useId();
  const picking = useRef(false); // a press is on the list: the field losing focus must not close it
  // Mentions already in the box when it opened (an edit) are shown at once; one picked later pops in (.cm-chip-new).
  const opened = useRef(new Set((initial?.map ?? []).map(([label]) => label)));
  const chips = [...map.current.keys()].filter((label) => text.includes(label));

  function look(value: string, caret: number) {
    const m = /(^|\s)([@#])([^\s@#]{0,40})$/.exec(value.slice(0, caret));
    setPick(m ? { at: caret - m[3].length - 1, mark: m[2] as '@' | '#', word: m[3] } : null);
  }

  // The list for the word typed after @ or #. People come from the page; tasks and projects from the search, which
  // only returns what this reader can see.
  useEffect(() => {
    setSel(0);
    if (!pick) { setFound([]); return; }
    if (pick.mark === '@') {
      setFound(suggest(pick.word, people).map((p) => ({ kind: 'person', id: p.id, label: p.name })));
      return;
    }
    if (!pick.word) { setFound([]); return; }
    let live = true;
    const t = setTimeout(() => {
      api(`/search?q=${encodeURIComponent(pick.word)}`, 'GET')
        .then((hits: { kind: string; id: string; title: string; sub: string }[]) => {
          if (live) setFound(hits.filter((h) => h.kind === 'task' || h.kind === 'project').slice(0, 6).map((h) => ({ kind: h.kind as 'task' | 'project', id: h.id, label: h.title, sub: h.sub })));
        })
        .catch(() => { if (live) setFound([]); });
    }, 150);
    return () => { live = false; clearTimeout(t); };
  }, [pick?.mark, pick?.word]); // eslint-disable-line react-hooks/exhaustive-deps -- people does not change while typing

  function choose(c: Choice) {
    const el = ta.current;
    if (!pick || !el) return;
    const label = labelOf(c);
    const caret = el.selectionStart ?? text.length;
    const next = `${text.slice(0, pick.at)}${label} ${text.slice(caret)}`;
    const pos = pick.at + label.length + 1;
    map.current.set(label, tokenOf(c));
    picking.current = false;
    setText(next);
    setPick(null);
    setTimeout(() => { el.focus(); el.setSelectionRange(pos, pos); }, 0); // keep writing after the pick
  }

  // Names back to tokens, longest first, so "@Ada Lovelace" is not eaten by "@Ada".
  function tokenize(): string {
    let out = text;
    for (const [label, token] of [...map.current].sort((a, b) => b[0].length - a[0].length)) {
      out = out.replace(new RegExp(`${esc(label)}(?![A-Za-z0-9])`, 'g'), () => token);
    }
    return out;
  }

  async function post() {
    if (busy || !text.trim()) return;
    setBusy(true); setErr(null);
    try {
      await submit(tokenize(), urgent);
      if (resetOnPost) { setText(''); map.current.clear(); setUrgent(false); }
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (composing(e)) return; // dictation or IME is still choosing the text: Enter, Tab and arrows belong to it
    if (pick) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setPick(null); return; } // closes the list, not the drawer
      if (found.length) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setSel((sel + 1) % found.length); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); setSel((sel + found.length - 1) % found.length); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); choose(found[sel]); return; }
      }
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void post(); }
  }

  return (
    <div className="cm-form">
      <textarea
        ref={ta} rows={3} value={text} maxLength={MAX_TYPED} aria-label={label} placeholder={label}
        role="combobox" aria-expanded={!!pick && found.length > 0} aria-controls={listId} aria-autocomplete="list"
        onChange={(e) => { setText(e.target.value); look(e.target.value, e.target.selectionStart); }}
        onClick={(e) => look(text, e.currentTarget.selectionStart)}
        onKeyUp={(e) => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) look(text, e.currentTarget.selectionStart); }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => { if (!picking.current) setPick(null); }, 150)}
      />
      <Count value={text} max={MAX_TYPED} />
      {pick && found.length > 0 && (
        <ul className="cm-pick" id={listId} role="listbox" aria-label={pick.mark === '@' ? 'People' : 'Tasks and projects'}>
          {found.map((c, i) => (
            <li key={`${c.kind}:${c.id}`} role="option" aria-selected={i === sel} className="cm-opt"
              onPointerDown={() => { picking.current = true; }} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(c)}>
              <span>{c.label}</span>{c.sub && <span className="dim small"> {c.sub}</span>}
            </li>
          ))}
        </ul>
      )}
      {chips.length > 0 && (
        <ul className="cm-chips" aria-label="Mentioned">
          {chips.map((label) => <li key={label} className={`cm-chip${opened.current.has(label) ? '' : ' cm-chip-new'}`}>{label}</li>)}
        </ul>
      )}
      <p className="hint cm-hint"><Help term="comment_mention">Type @ for a person</Help>. Type # for a task or a project.</p>
      <div className="cm-bar">
        <label className="cm-urgent"><input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} /> <Help term="comment_urgent">Urgent: also email</Help></label>
        <span className="cm-btns">
          {onCancel && <button type="button" className="act" onClick={onCancel}>Cancel</button>}
          <button type="button" className="btn" disabled={busy || !text.trim()} onClick={post}>{busy ? 'Saving…' : onCancel ? 'Save' : 'Post'}</button>
        </span>
      </div>
      {err && <p className="err" role="alert">{err}</p>}
    </div>
  );
}

function Parts({ parts, drawer, open }: { parts: Part[]; drawer: boolean; open: (id: string) => void }) {
  return (
    <>
      {parts.map((p, i) => {
        if (p.t === 'text') return <span key={i}>{p.text}</span>;
        if (p.t === 'hidden') return <span key={i} className="dim">a hidden item</span>;
        if (p.t === 'person') return <PersonLink key={i} id={p.id} className="cm-ref">@{p.name}</PersonLink>;
        if (p.t === 'project') return <Link key={i} className="cm-ref" href={`/projects/${p.id}`}>#{p.name}</Link>;
        return drawer
          ? <button key={i} type="button" className="cm-ref cm-ref-btn" onClick={() => open(p.id)}>#{p.title}</button>
          : <Link key={i} className="cm-ref" href={`/tasks/${p.id}`}>#{p.title}</Link>;
      })}
    </>
  );
}

// subjectTitle names the task or project in the Gmail draft. drawer says a task drawer is on this page, so a #task opens it
// there; without one the link goes to the task's own page.
export function CommentThread({ subjectKind, subjectId, subjectTitle, people, drawer, onPosted }: {
  subjectKind: 'task' | 'project'; subjectId: string; subjectTitle: string; people: Person[]; drawer: boolean;
  onPosted?: (plainText: string) => void; // a task's drawer uses it to ask for a status nudge (Jev). It only offers.
}) {
  const readOnly = useReadOnly();
  const [, openTask] = useOpenTask();
  const [list, setList] = useState<CommentView[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null); // the comment whose delete is waiting for a second press
  const [sent, setSent] = useState<Sent | null>(null);
  const [fresh, setFresh] = useState<string | null>(null); // the comment just posted here: it rises in once (.arrive)
  const base = `/${subjectKind}s/${subjectId}/comments`;

  useEffect(() => {
    let live = true;
    setList(null);
    api(base, 'GET').then((d) => { if (live) setList(d); }).catch((e) => { if (live) setErr(e.message); });
    return () => { live = false; };
  }, [base]);

  const replace = (c: CommentView) => setList((l) => (l ?? []).map((x) => (x.id === c.id ? c : x)));
  // Only when the writer ticked "Urgent": the links open a draft in their own Gmail.
  const offerMail = (r: CommentResult, urgent: boolean) => setSent(urgent && r.mail.length ? { mail: r.mail, text: plain(r.comment.parts), by: r.comment.authorName } : null);
  const draft = (m: MailTarget, s: Sent) => {
    const link = `${window.location.origin}/${subjectKind}s/${subjectId}`;
    const su = `${s.by} mentioned you: ${subjectTitle}`;
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(m.to)}&su=${encodeURIComponent(su)}&body=${encodeURIComponent(`${s.text}\n\n${link}`)}`;
  };

  async function add(body: string, urgent: boolean) {
    const r: CommentResult = await api(base, 'POST', { body });
    setList((l) => [...(l ?? []), r.comment]);
    setFresh(r.comment.id);
    offerMail(r, urgent);
    if (onPosted) onPosted(plain(r.comment.parts));
  }
  async function save(id: string, body: string, urgent: boolean) {
    const r: CommentResult = await api(`/comments/${id}`, 'PATCH', { body });
    replace(r.comment); setEditing(null);
    offerMail(r, urgent);
  }
  async function remove(c: CommentView) {
    try {
      await api(`/comments/${c.id}`, 'DELETE');
      replace({ ...c, deleted: true, parts: [], body: null }); setAsking(null);
    } catch (e) { notify((e as Error).message); }
  }

  return (
    <section className="cm" aria-label="Comments">
      <h3 className="cm-title"><Help term="comment_box">Comments</Help> {list && <span className="count-badge">{list.filter((c) => !c.deleted).length}</span>}</h3>
      {err && <p className="err" role="alert">{err}</p>}
      {list && list.length > 0 && (
        <ol className="cm-list">
          {list.map((c) => (
            <li key={c.id} className={`cm-item${c.id === fresh ? ' arrive' : ''}`}>
              <div className="cm-head">
                <Avatar name={c.authorName} id={c.authorId} />
                <PersonLink id={c.authorId}><b>{c.authorName}</b></PersonLink>
                <span className="when dim small">{fmtStamp(c.createdAt)}{c.via === 'claude' ? ' · via Claude' : ''}{c.editedAt && !c.deleted ? ' · edited' : ''}</span>
              </div>
              {c.deleted ? <p className="cm-body dim">Comment removed</p>
                : editing === c.id ? (
                  <Composer people={people} initial={editable(c.parts)} label="Edit comment" onCancel={() => setEditing(null)} submit={(b, u) => save(c.id, b, u)} />
                ) : (
                  <p className="cm-body"><Parts parts={c.parts} drawer={drawer} open={openTask} /></p>
                )}
              {c.mine && !c.deleted && !readOnly && editing !== c.id && (
                <div className="cm-acts">
                  {asking === c.id ? (
                    <>
                      <span className="small dim">Remove this comment?</span>
                      <button type="button" className="act" onClick={() => remove(c)}>Remove</button>
                      <button type="button" className="act" onClick={() => setAsking(null)}>Keep</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="act" onClick={() => { setEditing(c.id); setAsking(null); }}>Edit</button>
                      <button type="button" className="act" onClick={() => setAsking(c.id)}>Delete</button>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      {list && list.length === 0 && <p className="small dim">No comments yet.</p>}
      {sent && (
        <p className="cm-mail small" role="status">
          Open a draft in your Gmail, then press Send there:{' '}
          {sent.mail.map((m) => <a key={m.personId} className="act" href={draft(m, sent)} target="_blank" rel="noopener noreferrer">{m.name}</a>)}
          <button type="button" className="act" onClick={() => setSent(null)}>Dismiss</button>
        </p>
      )}
      {!readOnly && list && <Composer people={people} label="Add a comment" resetOnPost submit={add} />}
    </section>
  );
}
