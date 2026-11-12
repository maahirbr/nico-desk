'use client';

import { useEffect, useRef } from 'react';

// A small email editor: bold, italic, underline, bullets, numbers and a link. Cmd/Ctrl+B, I and U work as usual.
// It is uncontrolled: the parent gives the first HTML and remounts it (a new key) to replace the text.
// The server keeps only the tags this toolbar makes (lib/gmailSend.ts cleanHtml), so a paste from elsewhere is cut down.

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Plain text to the editor's first HTML: lines become line breaks, web addresses become links.
export function textToHtml(text: string): string {
  return esc(text).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}">${u}</a>`).replace(/\n/g, '<br>');
}

const TOOLS: { cmd: string; label: string; face: React.ReactNode }[] = [
  { cmd: 'bold', label: 'Bold', face: <b>B</b> },
  { cmd: 'italic', label: 'Italic', face: <i>I</i> },
  { cmd: 'underline', label: 'Underline', face: <u>U</u> },
  { cmd: 'insertUnorderedList', label: 'Bulleted list', face: '•' },
  { cmd: 'insertOrderedList', label: 'Numbered list', face: '1.' },
  { cmd: 'createLink', label: 'Link', face: 'Link' },
];

export function RichText({ initial, label, readOnly, onChange }: {
  initial: string; label: string; readOnly?: boolean; onChange: (html: string, text: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.innerHTML = initial;
    onChange(el.innerHTML, el.innerText);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- set once per mount; the parent remounts to replace
  }, []);
  const changed = () => { const el = box.current; if (el) onChange(el.innerHTML, el.innerText); };
  const run = (cmd: string) => {
    let arg: string | undefined;
    if (cmd === 'createLink') {
      const got = window.prompt('Link address');
      if (!got?.trim()) return;
      arg = /^(https?:|mailto:)/i.test(got.trim()) ? got.trim() : `https://${got.trim()}`;
    }
    box.current?.focus();
    document.execCommand(cmd, false, arg);
    changed();
  };
  return (
    <div className="rte">
      {!readOnly && (
        <div className="rte-tools" role="toolbar" aria-label="Formatting">
          {TOOLS.map((t) => (
            <button key={t.cmd} type="button" className="rte-btn" aria-label={t.label} title={t.label}
              onMouseDown={(e) => e.preventDefault() /* keep the selection in the text */} onClick={() => run(t.cmd)}>{t.face}</button>
          ))}
        </div>
      )}
      <div ref={box} className="rte-body" role="textbox" aria-multiline="true" aria-label={label} contentEditable={!readOnly} suppressContentEditableWarning
        onInput={changed} onBlur={changed} />
    </div>
  );
}
