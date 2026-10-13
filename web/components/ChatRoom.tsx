'use client';

import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MessageView, RoomPage } from '@/lib/teamchat';
import { fmtClock, istDate } from '@/lib/time';
import { chatChanged, tabVisible } from './chatEvents';
import { firstUnread, mergeLatest, rowsOf } from './chatLogic';
import { Avatar, PersonLink } from './chips';
import { Composer, editable, Parts, type Person } from './CommentThread';
import { Help } from './HelpMode';
import { useReadOnly } from './readonly';
import { api } from './task-ui';
import { notify } from './toast';

// One chat room: the messages, oldest at the top and newest last, and the box to write in (lib/teamchat.ts).
// There are no sockets. The room asks for the newest page every 10 seconds, only while this browser tab is on screen,
// and folds the answer into what is shown (chatLogic.ts). Opening the room, and every poll that brings something new,
// moves the reader's read mark. While an admin views as someone else, or the project is archived, the room only reads.

const POLL_MS = 10_000;

export function ChatRoom({ roomId, people, embedded = false }: { roomId: string; people: Person[]; embedded?: boolean }) {
  const viewing = useReadOnly();
  const [messages, setMessages] = useState<MessageView[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [archived, setArchived] = useState(false);
  const [unreadFrom, setUnreadFrom] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [older, setOlder] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null); // the message whose delete waits for a second press
  const [fresh, setFresh] = useState<string | null>(null); // the message just sent from here: it rises in once (.arrive)
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true); // the reader is at the bottom, so a new message scrolls into view
  const grew = useRef<number | null>(null); // scroll height before earlier messages were added, to keep the place
  const lastId = useRef<string | null>(null);
  const marked = useRef<string | null>(null);
  const base = `/chat/rooms/${encodeURIComponent(roomId)}`;
  const canWrite = !viewing && !archived;

  // Moves the read mark to the newest message on screen. Not while hidden, not in View as, and not twice for one message.
  const markNow = useCallback(() => {
    const id = lastId.current;
    if (viewing || !tabVisible() || !id || id === marked.current) return;
    marked.current = id;
    api(`${base}/read`, 'POST', { upTo: id }).then(chatChanged).catch(() => { if (marked.current === id) marked.current = null; });
  }, [base, viewing]);

  // Opening a room: the newest page.
  useEffect(() => {
    let live = true;
    setMessages(null); setErr(null); setHasMore(false); setEditing(null); setAsking(null); setFresh(null);
    marked.current = null; stick.current = true;
    api(`${base}/messages`, 'GET')
      .then((p: RoomPage) => {
        if (!live) return;
        setMessages(p.messages); setHasMore(p.hasMore); setArchived(p.room.archived);
        setUnreadFrom(firstUnread(p.messages, p.lastReadAt));
      })
      .catch((e) => { if (live) setErr((e as Error).message); });
    return () => { live = false; };
  }, [base]);

  // Polling: every 10 seconds while the tab is visible, and once more when it comes back.
  useEffect(() => {
    let live = true;
    const tick = () => {
      if (!tabVisible()) return;
      api(`${base}/messages`, 'GET')
        .then((p: RoomPage) => { if (live) { setMessages((cur) => (cur ? mergeLatest(cur, p.messages, p.hasMore) : cur)); setArchived(p.room.archived); } })
        .catch(() => {}); // a missed poll is not worth a message; the next one tries again
    };
    const timer = setInterval(tick, POLL_MS);
    const onShow = () => { if (tabVisible()) { tick(); markNow(); } };
    document.addEventListener('visibilitychange', onShow);
    return () => { live = false; clearInterval(timer); document.removeEventListener('visibilitychange', onShow); };
  }, [base, markNow]);

  useEffect(() => {
    lastId.current = messages?.length ? messages[messages.length - 1].id : null;
    markNow();
  }, [messages, markNow]);

  // Keep the place: at the bottom for new messages, where it was after earlier ones load.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    if (grew.current != null) { el.scrollTop += el.scrollHeight - grew.current; grew.current = null; }
    else if (stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const replace = (m: MessageView) => setMessages((l) => (l ?? []).map((x) => (x.id === m.id ? m : x)));

  async function loadOlder() {
    if (!messages?.length || older) return;
    setOlder(true);
    try {
      const p: RoomPage = await api(`${base}/messages?before=${encodeURIComponent(messages[0].id)}`, 'GET');
      grew.current = box.current?.scrollHeight ?? null;
      setMessages((cur) => [...p.messages.filter((m) => !(cur ?? []).some((x) => x.id === m.id)), ...(cur ?? [])]);
      setHasMore(p.hasMore);
    } catch (e) { notify((e as Error).message); }
    setOlder(false);
  }

  async function send(body: string) {
    const m: MessageView = await api(`${base}/messages`, 'POST', { body });
    stick.current = true;
    setMessages((l) => mergeLatest(l ?? [], [m], false));
    setFresh(m.id);
  }
  async function save(id: string, body: string) {
    const m: MessageView = await api(`/chat/messages/${id}`, 'PATCH', { body });
    replace(m); setEditing(null);
  }
  async function remove(m: MessageView) {
    try {
      await api(`/chat/messages/${m.id}`, 'DELETE');
      replace({ ...m, deleted: true, parts: [], body: null, tasks: [] }); setAsking(null);
    } catch (e) { notify((e as Error).message); }
  }

  const rows = messages ? rowsOf(messages, istDate(new Date()), unreadFrom) : [];

  return (
    <div className={`chat-room${embedded ? ' chat-embedded' : ''}`}>
      <div className="chat-scroll" ref={box} role="log" aria-label="Messages"
        onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
        {err && <p className="err" role="alert">{err}</p>}
        {hasMore && <button type="button" className="act chat-older" disabled={older} onClick={loadOlder}>{older ? 'Loading…' : 'Earlier messages'}</button>}
        {messages && messages.length === 0 && <p className="chat-empty dim">No messages yet.</p>}
        <ol className="chat-list">
          {rows.map((r) => {
            if (r.kind === 'day') return <li key={r.key} className="chat-day"><span>{r.label}</span></li>;
            if (r.kind === 'new') return <li key={r.key} className="chat-new"><span>New</span></li>;
            const { m, head } = r;
            return (
              <li key={r.key} className={`chat-msg${head ? ' chat-first' : ''}${m.id === fresh ? ' arrive' : ''}`} title={fmtClock(m.createdAt)}>
                {head && (
                  <div className="cm-head">
                    <Avatar name={m.authorName} id={m.authorId} />
                    <PersonLink id={m.authorId}><b>{m.authorName}</b></PersonLink>
                    <span className="when dim small">{fmtClock(m.createdAt)}</span>
                  </div>
                )}
                {m.deleted ? <p className="cm-body dim">Message removed</p>
                  : editing === m.id ? (
                    <Composer chat people={people} initial={editable(m.parts)} label="Edit message" onCancel={() => setEditing(null)} submit={(b) => save(m.id, b)} />
                  ) : (
                    <p className="cm-body"><Parts parts={m.parts} drawer={false} open={() => {}} />{m.editedAt && <span className="dim small"> · edited</span>}</p>
                  )}
                {m.tasks.length > 0 && !m.deleted && (
                  <p className="chat-made small">
                    <span className="dim">Task made: </span>
                    {m.tasks.map((t) => <Link key={t.id} className="cm-ref" href={`/tasks/${t.id}`}>{t.title}</Link>)}
                  </p>
                )}
                {!m.deleted && editing !== m.id && (
                  <div className="cm-acts chat-acts">
                    {asking === m.id ? (
                      <>
                        <span className="small dim">Remove this message?</span>
                        <button type="button" className="act" onClick={() => remove(m)}>Remove</button>
                        <button type="button" className="act" onClick={() => setAsking(null)}>Keep</button>
                      </>
                    ) : (
                      <>
                        {!viewing && <Help term="chat_make_task" host><Link className="act" href={`/tasks/new?fromMessage=${encodeURIComponent(m.id)}`}>Make a task</Link></Help>}
                        {m.mine && canWrite && <button type="button" className="act" onClick={() => { setEditing(m.id); setAsking(null); }}>Edit</button>}
                        {m.mine && canWrite && <button type="button" className="act" onClick={() => setAsking(m.id)}>Delete</button>}
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      {messages && (canWrite
        ? <div className="chat-compose"><Composer chat people={people} label="Write a message" resetOnPost submit={send} /></div>
        : <p className="chat-note dim small">{archived ? 'This project is archived. Its chat is read-only.' : 'You are viewing as someone else. Chat is read-only.'}</p>)}
    </div>
  );
}
