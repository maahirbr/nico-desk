'use client';

import { useEffect, useRef, useState } from 'react';
import { parseChat } from '@/lib/chat';
import type { Named, QuickParse } from '@/lib/quickadd';
import type { SentenceRead } from '@/lib/sentence';
import { focusOnDesktop } from './motion';
import { isRealEnter } from './ime';

// Quick add, the way a person talks: "Ask Sam to send me the design files by Monday for the landing page". The server reads the
// sentence (lib/sentenceRead.ts: the model when it is on, masked, else plain rules) and this fills the form's own fields,
// which stay editable. Nothing is made until the person presses Add task.
// A pasted chat (several lines with names and times) goes to the chat review instead (onChat), when the form has one.
// The mic types what is said into the box, through the browser's own speech service, and reads it when the person stops.
// Keyboard rule: Enter ("go") reads the line and the global handler closes the keyboard.

type Speech = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };
const speechApi = (): (new () => Speech) | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Speech; webkitSpeechRecognition?: new () => Speech };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

// A chat looks like several lines with a sender each, as WhatsApp copies them.
export function looksLikeChat(text: string): boolean {
  if (!/\n/.test(text.trim())) return false;
  return parseChat(text).messages.filter((m) => m.sender).length >= 2;
}

export function QuickAddField({ people, projects, hasTitle, apply, focusAfter, onChat, onMany }: {
  today: string; people: Named[]; projects?: Named[]; hasTitle: boolean;
  apply: (p: QuickParse) => string[]; focusAfter: () => void; onChat?: (text: string) => void; onMany?: (tasks: SentenceRead[]) => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const rec = useRef<Speech | null>(null);
  const said = useRef('');
  useEffect(() => { setCanSpeak(!!speechApi()); return () => rec.current?.stop(); }, []);

  async function fill(line = text.trim()) {
    if (!line || busy) return;
    if (onChat && looksLikeChat(line)) { setText(''); onChat(line); return; }
    setBusy(true); setDone(null);
    try {
      const res = await fetch('/api/v1/tasks/read-sentence', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: line }) });
      const r = await res.json().catch(() => null);
      if (!res.ok || !r) { setDone(r?.error?.message ?? 'Could not read that. Fill in the fields below.'); return; }
      const tasks: SentenceRead[] = Array.isArray(r.tasks) ? r.tasks : [];
      if (tasks.length > 1 && onMany) { setText(''); onMany(tasks); return; }
      if (!tasks.length) { setDone('Could not find a task in that. Fill in the fields below.'); return; }
      const one = tasks[0];
      const owner = one.ownerId ? people.find((p) => p.id === one.ownerId) : undefined;
      const project = one.projectId && projects ? projects.find((p) => p.id === one.projectId) : undefined;
      const notes = [...(one.notes ?? []), ...apply({
        title: one.title ?? '', dueOn: one.dueOn ?? null, dueText: null,
        owner: owner ? { word: owner.name, status: 'matched', item: owner } : null,
        project: project ? { word: project.name, status: 'matched', item: project } : null,
      })];
      setDone(['Filled in below. Check it, then Add task.', ...notes].join(' '));
      setText('');
      focusAfter();
    } catch {
      setDone('Could not read that. Fill in the fields below.');
    } finally { setBusy(false); }
  }

  function speak() {
    if (listening) { rec.current?.stop(); return; }
    const Api = speechApi();
    if (!Api) return;
    const r = new Api();
    r.lang = 'en-IN'; r.interimResults = true; r.continuous = false;
    said.current = '';
    r.onresult = (e) => {
      const all = Array.from(e.results).map((x) => x[0]?.transcript ?? '').join(' ').replace(/\s+/g, ' ').trim();
      said.current = all; setText(all);
    };
    r.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setDone('The browser blocked the microphone. Allow it in the address bar, or type instead.'); };
    r.onend = () => { setListening(false); rec.current = null; if (said.current) void fill(said.current); };
    rec.current = r; setDone(null); setListening(true);
    try { r.start(); } catch { setListening(false); rec.current = null; }
  }

  return (
    <>
      <div className="f">
        <label htmlFor="say-line" className="say-label"><span>Quick Add</span></label>
        <div className="say-row">
          <input id="say-line" ref={focusOnDesktop} enterKeyHint="go" autoComplete="off" maxLength={500} value={text} disabled={busy}
            placeholder={listening ? 'Listening…' : 'e.g. Ask Sam to send me the design files by Monday'}
            onChange={(e) => { setText(e.target.value); setDone(null); }}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData('text');
              if (onChat && looksLikeChat(pasted)) { e.preventDefault(); setText(''); onChat(pasted); }
            }}
            onKeyDown={(e) => { if (isRealEnter(e)) { e.preventDefault(); void fill(); } }}
            onBlur={() => { if (!hasTitle && text.trim() && !listening) void fill(); }} />
          {canSpeak && (
            <button type="button" className={`btn ghost say-mic${listening ? ' on' : ''}`} aria-pressed={listening}
              aria-label={listening ? 'Stop and fill in' : 'Say it'} title={listening ? 'Stop' : 'Say it'} onClick={speak}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" />
              </svg>
            </button>
          )}
          <button type="button" className="btn ghost" disabled={busy || !text.trim()} onClick={() => void fill()}>{busy ? 'Reading…' : 'Fill in'}</button>
        </div>
      </div>
      <p className="hint" aria-live="polite" style={{ margin: 0 }}>
        {done ?? (listening ? 'Say what needs doing, who does it and by when. Tap the mic again to stop.'
          : `Type it, or tap the mic and say it the way you'd tell someone. One task or several.${onChat ? ' You can also paste a WhatsApp chat.' : ''}`)}
      </p>
    </>
  );
}
