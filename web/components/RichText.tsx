'use client';

import { useEffect, useRef, useState } from 'react';
import { ListMenu } from './notesKit';

// A small email editor: bold, italic, underline, and one Lists menu (bulleted or numbered), as in Personal notes
// (15 Nov: no Link button, no checklist). Cmd/Ctrl+B, I and U work as usual.
// It is uncontrolled: the parent gives the first HTML and remounts it (a new key) to replace the text.
// The server keeps only the tags this toolbar makes (lib/gmailSend.ts cleanHtml), so a paste from elsewhere is cut down.

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Plain text to the editor's first HTML: lines become line breaks, web addresses become links.
export function textToHtml(text: string): string {
  return esc(text).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}">${u}</a>`).replace(/\n/g, '<br>');
}

// The editor's text for plain drafts (Gmail, the mail app, Copy): line breaks kept, list items as "• " or "1. ".
export function plainOf(root: Node): string {
  let out = '';
  const walk = (n: Node, list: { ordered: boolean; n: number } | null) => {
    if (n.nodeType === Node.TEXT_NODE) { out += n.textContent ?? ''; return; }
    if (!(n instanceof HTMLElement)) return;
    const tag = n.tagName;
    if (tag === 'BR') { out += '\n'; return; }
    if (tag === 'UL' || tag === 'OL') {
      if (out && !out.endsWith('\n')) out += '\n';
      const l = { ordered: tag === 'OL', n: 0 };
      n.childNodes.forEach((c) => walk(c, l));
      return;
    }
    if (tag === 'LI') { out += list?.ordered ? `${++list.n}. ` : '• '; n.childNodes.forEach((c) => walk(c, null)); if (!out.endsWith('\n')) out += '\n'; return; }
    const block = tag === 'DIV' || tag === 'P';
    if (block && out && !out.endsWith('\n')) out += '\n';
    n.childNodes.forEach((c) => walk(c, list));
    if (block && !out.endsWith('\n')) out += '\n';
  };
  root.childNodes.forEach((c) => walk(c, null));
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

const TOOLS: { cmd: string; label: string; face: React.ReactNode }[] = [
  { cmd: 'bold', label: 'Bold', face: <b>B</b> },
  { cmd: 'italic', label: 'Italic', face: <i>I</i> },
  { cmd: 'underline', label: 'Underline', face: <u>U</u> },
];

export function RichText({ initial, label, readOnly, onChange }: {
  initial: string; label: string; readOnly?: boolean; onChange: (html: string, text: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.innerHTML = initial;
    onChange(el.innerHTML, plainOf(el));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- set once per mount; the parent remounts to replace
  }, []);
  const changed = () => { const el = box.current; if (el) onChange(el.innerHTML, plainOf(el)); };
  // Which list the cursor is in, so the Lists button shows it, as in Personal notes.
  const [list, setList] = useState({ bullets: false, numbers: false });
  const where = () => { try { setList({ bullets: document.queryCommandState('insertUnorderedList'), numbers: document.queryCommandState('insertOrderedList') }); } catch { /* not supported */ } };
  const run = (cmd: string) => {
    box.current?.focus();
    document.execCommand(cmd, false);
    changed(); where();
  };
  return (
    <div className="rte">
      {!readOnly && (
        <div className="rte-tools" role="toolbar" aria-label="Formatting">
          {TOOLS.map((t) => (
            <button key={t.cmd} type="button" className="rte-btn" aria-label={t.label} title={t.label}
              onMouseDown={(e) => e.preventDefault() /* keep the selection in the text */} onClick={() => run(t.cmd)}>{t.face}</button>
          ))}
          <ListMenu bullets={list.bullets} numbers={list.numbers} onBullets={() => run('insertUnorderedList')} onNumbers={() => run('insertOrderedList')} />
        </div>
      )}
      <div ref={box} className="rte-body" role="textbox" aria-multiline="true" aria-label={label} contentEditable={!readOnly} suppressContentEditableWarning
        onInput={changed} onBlur={changed} onKeyUp={where} onMouseUp={where} />
    </div>
  );
}
