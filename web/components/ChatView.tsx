'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Room } from '@/lib/teamchat';
import { fmtClock, istDate } from '@/lib/time';
import { dayLabel } from './chatLogic';
import { CHAT_CHANGED, tabVisible } from './chatEvents';
import { ChatRoom } from './ChatRoom';
import type { Person } from './CommentThread';
import { Help } from './HelpMode';
import { api } from './task-ui';

// The Chat page: the rooms on one side and the open room on the other. On a phone they are two screens with a back
// button between them (860px and under, set in globals.css). The open room is kept in the address as ?room=<id>.
// Nothing here reads the database: the page hands in the rooms, and this list asks again when a room is read or every 20 seconds.

const LIST_MS = 20_000;

function stamp(at: string | null, today: string): string {
  if (!at) return '';
  const day = istDate(at);
  return day === today ? fmtClock(at) : dayLabel(day, today);
}

export function ChatView({ rooms: start, people, teamId, initialRoom }: { rooms: Room[]; people: Person[]; teamId: string; initialRoom: string | null }) {
  const [rooms, setRooms] = useState(start);
  const [active, setActive] = useState<string | null>(initialRoom);
  const [phone, setPhone] = useState(false);
  const today = istDate(new Date());

  useEffect(() => {
    const q = window.matchMedia('(max-width: 860px)');
    const on = () => setPhone(q.matches);
    on(); q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);

  const refresh = useCallback(() => {
    if (!tabVisible()) return;
    api('/chat/rooms', 'GET').then((r: { rooms: Room[] }) => setRooms(r.rooms)).catch(() => {});
  }, []);
  useEffect(() => {
    const timer = setInterval(refresh, LIST_MS);
    window.addEventListener(CHAT_CHANGED, refresh);
    return () => { clearInterval(timer); window.removeEventListener(CHAT_CHANGED, refresh); };
  }, [refresh]);

  // Browser back (and the phone's back button below) returns to the list.
  useEffect(() => {
    const onPop = () => setActive(new URLSearchParams(window.location.search).get('room'));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const open = (id: string) => {
    setActive(id);
    setRooms((l) => l.map((r) => (r.id === id ? { ...r, unread: 0 } : r)));
    window.history.pushState(null, '', `/chat?room=${encodeURIComponent(id)}`);
  };
  const back = () => { setActive(null); window.history.pushState(null, '', '/chat'); };

  // A desktop screen always shows a room; a phone shows the list until one is picked.
  const shown = rooms.find((r) => r.id === (active ?? (phone ? '' : teamId))) ?? null;

  return (
    <div className={`chat-page calm${shown ? ' chat-open' : ''}`}>
      <header className="page-head"><div><h1>Chat</h1><p className="summary">Talk about the work next to the work. Mention someone to tell them. Make a task from any message.</p></div></header>
      <div className="chat-split card">
        <nav className="chat-rooms" aria-label="Rooms">
          <ul>
            {rooms.map((r) => (
              <li key={r.id}>
                <button type="button" className={`chat-room-item${shown?.id === r.id ? ' on' : ''}`} aria-current={shown?.id === r.id ? 'true' : undefined} onClick={() => open(r.id)}>
                  <span className="chat-room-name">{r.name}{r.archived && <span className="dim small"> · archived</span>}</span>
                  <span className="chat-room-meta small dim">{stamp(r.lastAt, today)}</span>
                  {r.unread > 0 && <span className="chat-unread" aria-label={`${r.unread} unread`}>{r.unread > 99 ? '99+' : r.unread}</span>}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <section className="chat-pane" aria-label={shown ? `${shown.name} chat` : 'Chat'}>
          {shown && (
            <>
              <div className="chat-pane-head">
                <button type="button" className="act chat-back" onClick={back}>← Rooms</button>
                <h2><Help term="chat_room">{shown.name}</Help></h2>
                <span className="dim small">{shown.kind === 'team' ? 'Everyone' : 'People who can see this project'}</span>
              </div>
              <ChatRoom key={shown.id} roomId={shown.id} people={people} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
