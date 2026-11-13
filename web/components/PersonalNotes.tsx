'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import Image from '@tiptap/extension-image';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { HIGHLIGHTS, ICON, Indent, indent, ListMenu, Palette, TEXT_COLOURS } from './notesKit';
import type { Doc, Page } from '@/lib/notes';
import { dayHeading } from '@/lib/time';
import { ago } from '@/lib/updates';
import { DateField } from './DateField';
import { useReadOnly } from './readonly';
import { shrinkImage } from './shrinkImage';
import { SpeechButton, useSpeech } from './speech';
import { notify } from './toast';

// My running notes (11 Nov): one page under my Personal tasks, always open, like a notebook I keep writing in. Only I
// see it. It saves itself a moment after I stop typing. The bar above it: bold, italic, underline, a heading, bullets,
// numbers, a checklist, a dividing line, a picture or a file, "+ Today" (a dated heading at the top, for a running
// log), "+ Meeting" (a ready block: Notes, Decisions, To-dos), "→ Task" (the line I am on becomes a Personal task) and
// the mic. Text colour, highlight, alignment and indent sit beside them (13 Nov), with Google Docs' icons. ⌘B, ⌘I and ⌘U work as anywhere.
// Pictures and files are kept privately (lib/notes.ts) and open only for me.
const SAVE_AFTER = 900;

async function api(path: string, method: string, body?: unknown) {
  const r = await fetch(`/api/v1/me${path}`, { method, headers: body === undefined ? undefined : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.error?.message ?? 'Could not save your notes. Check your connection.');
  return data;
}

export function PersonalNotes({ page, projectId, meId, teamId, today }: { page: Page; projectId: string; meId: string; teamId: string; today: string }) {
  const readOnly = useReadOnly();
  const router = useRouter();
  const [state, setState] = useState<'saved' | 'saving' | 'error' | 'idle'>(page.updatedAt ? 'saved' : 'idle');
  const [savedAt, setSavedAt] = useState(page.updatedAt);
  const [prevAt, setPrevAt] = useState(page.prevAt);
  const [tasking, setTasking] = useState<{ title: string; due: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const save = async (doc: Doc) => {
    setState('saving');
    try { const r = await api('/notes', 'PUT', { doc }); setSavedAt(r.updatedAt); setPrevAt(r.prevAt); setState('saved'); }
    catch (e) { setState('error'); notify((e as Error).message); }
  };
  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: true, autolink: true, defaultProtocol: 'https' } }),
      TaskList, TaskItem.configure({ nested: true }),
      Image.configure({ inline: false }),
      TextStyle, Color, Highlight.configure({ multicolor: true }), TextAlign.configure({ types: ['heading', 'paragraph'] }), Indent,
      Placeholder.configure({ placeholder: 'Jot anything: ideas, meeting notes, lists. Auto-saved.' }),
    ],
    content: page.doc as JSONContent,
    onUpdate: ({ editor: e }) => {
      setState('saving');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { timer.current = null; void save(e.getJSON() as Doc); }, SAVE_AFTER);
    },
  });
  // A jot made elsewhere (Jot, or another tab) changed the page: read it again, unless a save of mine is still waiting,
  // so typing here never overwrites the jot.
  const savedRef = useRef(page.updatedAt);
  useEffect(() => { savedRef.current = savedAt; }, [savedAt]);
  useEffect(() => {
    if (!editor) return;
    const reload = async () => {
      if (timer.current || document.visibilityState === 'hidden') return;
      try {
        const p: Page | null = await api('/notes', 'GET');
        if (p?.updatedAt && p.updatedAt !== savedRef.current && !timer.current) {
          editor.commands.setContent(p.doc as JSONContent, { emitUpdate: false }); setSavedAt(p.updatedAt); setPrevAt(p.prevAt); setState('saved');
        }
      } catch { /* stays as it is */ }
    };
    window.addEventListener('nd:notes-changed', reload);
    window.addEventListener('focus', reload);
    document.addEventListener('visibilitychange', reload);
    return () => { window.removeEventListener('nd:notes-changed', reload); window.removeEventListener('focus', reload); document.removeEventListener('visibilitychange', reload); };
  }, [editor]);
  // Leaving the page with a save still waiting: send it now.
  useEffect(() => () => { if (timer.current && editor) { clearTimeout(timer.current); void save(editor.getJSON() as Doc); } }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps

  const speech = useSpeech({
    heard: () => {},
    stopped: (all) => { editor?.chain().focus().insertContent(`${all} `).run(); },
    problem: (say) => notify(say),
  });

  const attach = async (files: File[]) => {
    for (const f of files) {
      try {
        const isImage = f.type.startsWith('image/') && f.type !== 'image/gif';
        const body = isImage ? await shrinkImage(f) : f;
        const r = await fetch('/api/v1/me/files', { method: 'POST', headers: { 'content-type': isImage ? body.type : (f.type || 'application/octet-stream'), 'x-file-name': encodeURIComponent(f.name) }, body });
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.error?.message ?? 'Could not attach that file.');
        if (data.image) editor?.chain().focus().setImage({ src: data.url, alt: data.name }).run();
        else editor?.chain().focus().insertContent([{ type: 'text', text: `📎 ${data.name}`, marks: [{ type: 'link', attrs: { href: data.url } }] }, { type: 'text', text: ' ' }]).run();
      } catch (e) { notify((e as Error).message); }
    }
  };

  const addToday = () => {
    if (!editor) return;
    const label = dayHeading(today);
    // Today's heading is already on top: just go under it.
    const top = editor.state.doc.firstChild;
    if (top?.type.name === 'heading' && top.textContent === label) { editor.chain().setTextSelection(top.nodeSize + 1).focus().scrollIntoView().run(); return; }
    editor.chain().insertContentAt(0, [{ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: label }] }, { type: 'paragraph' }]).run();
    // Then the cursor goes on the empty line under the new heading, read from the page as it now is.
    const heading = editor.state.doc.firstChild;
    editor.chain().setTextSelection(heading ? heading.nodeSize + 1 : 1).focus().scrollIntoView().run();
  };
  // A meeting block under today's heading (made if missing): a title to type, then Notes, Decisions and To-dos.
  const addMeeting = () => {
    if (!editor) return;
    addToday();
    const at = editor.state.selection.from;
    const bold = (t: string) => ({ type: 'paragraph', content: [{ type: 'text', text: t, marks: [{ type: 'bold' }] }] });
    editor.chain().insertContentAt(at - 1, [
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Meeting · ' }] },
      bold('Notes'), { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
      bold('Decisions'), { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
      bold('To-dos'), { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }] },
    ]).setTextSelection(at - 1 + 'Meeting · '.length + 1).focus().scrollIntoView().run();
  };
  const startTask = () => {
    if (!editor) return;
    const line = editor.state.selection.$from.parent.textContent.trim();
    if (line.length < 3) { notify('Put the cursor on a line with a few words, then press → Task.'); return; }
    setTasking({ title: line.slice(0, 200), due: today });
  };
  const makeTask = async () => {
    if (!tasking) return;
    const r = await fetch('/api/v1/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ teamId, title: tasking.title, ownerId: meId, dueOn: tasking.due, projectId }) });
    const data = await r.json().catch(() => null);
    if (!r.ok) { notify(data?.error?.message ?? 'Could not add the task.'); return; }
    notify(`Added to your tasks: ${tasking.title}`); setTasking(null); router.refresh();
  };

  return (
    <section className="rnotes" aria-labelledby="rnotes-h">
      <div className="psec-head">
        <h2 id="rnotes-h">Notes</h2>
        <span className="rnotes-state small dim" aria-live="polite">
          {state === 'saving' ? 'Saving…' : state === 'error' ? 'Not saved, check your connection' : savedAt ? `Saved ${ago(savedAt, new Date().toISOString())}` : ''}
        </span>
      </div>
      <div className="card rnotes-card">
        {!readOnly && editor && <Toolbar editor={editor} onImage={() => file.current?.click()} onToday={addToday} onMeeting={addMeeting} onTask={startTask} speech={speech} />}
        {tasking && (
          <div className="rnotes-task">
            <span className="small">Make a task: <b>{tasking.title}</b></span>
            <DateField noQuick min={today} value={tasking.due} onChange={(e) => setTasking({ ...tasking, due: e.target.value })} aria-label="Due date" />
            <button type="button" className="mini-btn" disabled={!tasking.due} onClick={() => void makeTask()}>Add task</button>
            <button type="button" className="mini-btn" onClick={() => setTasking(null)}>Cancel</button>
          </div>
        )}
        <EditorContent editor={editor} className="rnotes-body"
          onPaste={(e) => { const fs = Array.from(e.clipboardData?.files ?? []); if (fs.length && !readOnly) { e.preventDefault(); void attach(fs); } }}
          onDrop={(e) => { const fs = Array.from(e.dataTransfer?.files ?? []); if (fs.length && !readOnly) { e.preventDefault(); void attach(fs); } }} />
        <input ref={file} type="file" hidden multiple onChange={(e) => { void attach(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
      </div>
    </section>
  );
}

function Toolbar({ editor, onImage, onToday, onMeeting, onTask, speech }: {
  editor: Editor; onImage: () => void; onToday: () => void; onMeeting: () => void; onTask: () => void; speech: ReturnType<typeof useSpeech>;
}) {
  const on = useEditorState({ editor, selector: ({ editor: e }) => ({
    b: e.isActive('bold'), i: e.isActive('italic'), u: e.isActive('underline'), h: e.isActive('heading'),
    ul: e.isActive('bulletList'), ol: e.isActive('orderedList'), task: e.isActive('taskList'),
    left: e.isActive({ textAlign: 'left' }) || (!e.isActive({ textAlign: 'center' }) && !e.isActive({ textAlign: 'right' })),
    center: e.isActive({ textAlign: 'center' }), right: e.isActive({ textAlign: 'right' }),
    colour: (e.getAttributes('textStyle').color as string | undefined) ?? null, mark: (e.getAttributes('highlight').color as string | undefined) ?? null,
  }) });
  const btn = (label: React.ReactNode, title: string, active: boolean, run: () => void, cls = '') => (
    <button type="button" className={`rn-btn${active ? ' on' : ''} ${cls}`} aria-pressed={active} title={title} aria-label={title}
      onMouseDown={(e) => e.preventDefault()} onClick={run}>{label}</button>
  );
  const c = () => editor.chain().focus();
  return (
    <div className="rnotes-bar" role="toolbar" aria-label="Format">
      {btn('B', 'Bold (⌘B)', on.b, () => c().toggleBold().run(), 'rn-b')}
      {btn('I', 'Italic (⌘I)', on.i, () => c().toggleItalic().run(), 'rn-i')}
      {btn('U', 'Underline (⌘U)', on.u, () => c().toggleUnderline().run(), 'rn-u')}
      <Palette title="Text colour" swatches={TEXT_COLOURS} current={on.colour}
        onPick={(v) => (v ? c().setColor(v).run() : c().unsetColor().run())}>
        <span className="rn-a">A<span className="rn-bar" style={{ background: on.colour ?? 'var(--ink)' }} /></span>
      </Palette>
      <Palette title="Highlight colour" swatches={HIGHLIGHTS} current={on.mark}
        onPick={(v) => (v ? c().setHighlight({ color: v }).run() : c().unsetHighlight().run())}>
        <span className="rn-a">{ICON.highlight}<span className="rn-bar" style={{ background: on.mark ?? 'transparent' }} /></span>
      </Palette>
      <span className="rn-sep" aria-hidden />
      {btn(ICON.alignLeft, 'Align left', on.left, () => c().setTextAlign('left').run())}
      {btn(ICON.alignCenter, 'Align centre', on.center, () => c().setTextAlign('center').run())}
      {btn(ICON.alignRight, 'Align right', on.right, () => c().setTextAlign('right').run())}
      <span className="rn-sep" aria-hidden />
      <ListMenu bullets={on.ul} numbers={on.ol} checks={on.task} onBullets={() => c().toggleBulletList().run()} onNumbers={() => c().toggleOrderedList().run()} onChecks={() => c().toggleTaskList().run()} />
      {btn(ICON.indentLess, 'Decrease indent', false, () => indent(editor, -1))}
      {btn(ICON.indentMore, 'Increase indent', false, () => indent(editor, 1))}
      <span className="rn-sep" aria-hidden />
      {btn(ICON.divider, 'Dividing line', false, () => c().setHorizontalRule().run())}
      {btn(ICON.attach, 'Add a picture or file', false, onImage)}
      <span className="rn-sep" aria-hidden />
      {btn('+ Today', 'A dated heading at the top', false, onToday, 'rn-word')}
      {btn('+ Meeting', 'A meeting block: notes, decisions, to-dos', false, onMeeting, 'rn-word')}
      {btn('→ Task', 'Make the line you are on a task', false, onTask, 'rn-word')}
      {speech.canSpeak && <SpeechButton listening={speech.listening} onClick={speech.toggle} />}
    </div>
  );
}
