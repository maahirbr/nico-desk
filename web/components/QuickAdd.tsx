'use client';

import { useState } from 'react';
import { describeQuick, parseQuickAdd, type Named, type QuickParse } from '@/lib/quickadd';
import { fmtDate } from '@/lib/time';
import { focusOnDesktop } from './motion';
import { isRealEnter } from './ime';

// The quick-add line of the new-task forms: "Send deck to vendor fri @owner #project". It only fills
// the form's own fields, which stay editable; what it found, or could not match, shows under the line.
// The parent applies the parse and returns any extra notes (for example "not on that project").
// Keyboard rule: Enter ("go") fills the fields and the global handler closes the keyboard.

export function QuickAddField({ today, people, projects, hasTitle, apply, focusAfter }: {
  today: string; people: Named[]; projects?: Named[]; hasTitle: boolean;
  apply: (p: QuickParse) => string[]; focusAfter: () => void;
}) {
  const [text, setText] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const ctx = { today, people, projects: projects ?? [] };
  const preview = text.trim() ? describeQuick(parseQuickAdd(text, ctx)) : [];

  function fill() {
    const line = text.trim();
    if (!line) return;
    const p = parseQuickAdd(line, ctx);
    const notes = describeQuick(p).filter((n) => !/^(Due|Owner|Project) /.test(n));
    if (p.dueOn && p.dueOn < today) notes.push(`${fmtDate(p.dueOn)} has passed, so the due date is unchanged`);
    notes.push(...apply(p));
    const got = [
      p.dueOn && p.dueOn >= today ? `due ${fmtDate(p.dueOn)}` : null,
      p.owner?.status === 'matched' ? `owner ${p.owner.item.name}` : null,
      p.project?.status === 'matched' && projects ? `project ${p.project.item.name}` : null,
    ].filter(Boolean);
    setDone([got.length ? `Filled ${got.join(', ')}. Check the fields below.` : 'Filled the task name.', ...notes].join(' '));
    setText('');
    focusAfter();
  }

  return (
    <>
      <label className="f"><span>Quick add (optional)</span>
        <input ref={focusOnDesktop} enterKeyHint="go" autoComplete="off" maxLength={300} value={text}
          placeholder={`Send deck to vendor fri @owner${projects ? ' #project' : ''}`}
          onChange={(e) => { setText(e.target.value); setDone(null); }}
          onKeyDown={(e) => { if (isRealEnter(e)) { e.preventDefault(); fill(); } }}
          onBlur={() => { if (!hasTitle) fill(); }} />
      </label>
      {(preview.length > 0 || done) && (
        <p className="hint" aria-live="polite" style={{ margin: 0 }}>{preview.length > 0 ? `${preview.join(' · ')}. Press Enter to fill the fields.` : done}</p>
      )}
    </>
  );
}
