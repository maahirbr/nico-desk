'use client';

import { useState } from 'react';
import { parseChat } from '@/lib/chat';
import type { Named, QuickParse } from '@/lib/quickadd';
import type { SentenceRead } from '@/lib/sentence';
import { focusOnDesktop } from './motion';
import { isRealEnter } from './ime';
import { SpeechButton, useSpeech } from './speech';

// Quick add, the way a person talks: "Ask Sam to send me the design files by Monday for the landing page". The server reads the
// sentence (lib/sentenceRead.ts: the model when it is on, masked, else plain rules) and this fills the form's own fields,
// which stay editable. Nothing is made until the person presses Add task.
// A pasted chat (several lines with names and times) goes to the chat review instead (onChat), when the form has one.
// The mic (components/speech.tsx) types what is said into the box, and this reads it when the person stops.
// Keyboard rule: Enter ("go") reads the line and the global handler closes the keyboard.

// A chat looks like several lines with a sender each, as WhatsApp copies them.
export function looksLikeChat(text: string): boolean {
  if (!/\n/.test(text.trim())) return false;
  return parseChat(text).messages.filter((m) => m.sender).length >= 2;
}

export function QuickAddField({ people, projects, hasTitle, apply, focusAfter, onChat, onMany }: {
  today: string; people: Named[]; projects?: Named[]; hasTitle: boolean;
  apply: (p: QuickParse, details?: string) => string[]; focusAfter: () => void; onChat?: (text: string) => void; onMany?: (tasks: SentenceRead[]) => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const { canSpeak, listening, toggle } = useSpeech({ names: [...people, ...(projects ?? [])].map((p) => p.name), heard: setText, problem: setDone, stopped: (all) => void fill(all) });

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
      }, one.details)];
      setDone(['Filled in below. Check it, then Add task.', ...notes].join(' '));
      setText('');
      focusAfter();
    } catch {
      setDone('Could not read that. Fill in the fields below.');
    } finally { setBusy(false); }
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
              // The box is one line, so a pasted list would lose its breaks: read it as pasted instead.
              else if (/\n\s*\S/.test(pasted.trim())) { e.preventDefault(); void fill(pasted); }
            }}
            onKeyDown={(e) => { if (isRealEnter(e)) { e.preventDefault(); void fill(); } }}
            onBlur={() => { if (!hasTitle && text.trim() && !listening) void fill(); }} />
          {canSpeak && <SpeechButton listening={listening} stopLabel="Stop and fill in" onClick={() => { setDone(null); toggle(); }} />}
          <button type="button" className="btn ghost" disabled={busy || !text.trim()} onClick={() => void fill()}>{busy ? 'Reading…' : 'Fill in'}</button>
        </div>
      </div>
      <p className="hint" aria-live="polite" style={{ margin: 0 }}>
        {done ?? (listening ? 'Say what needs doing, who does it and by when. Pause as long as you need. It fills in when you stop talking, or tap the mic.'
          : `Type or say it the way you'd tell someone. Add one task or a few${onChat ? ', or paste a WhatsApp chat.' : '.'}`)}
      </p>
    </>
  );
}
