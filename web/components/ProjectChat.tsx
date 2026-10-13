'use client';

import { useEffect, useState } from 'react';
import { CHAT_CHANGED } from './chatEvents';
import { ChatRoom } from './ChatRoom';
import type { Person } from './CommentThread';

// The project page's chat: a card that stays shut until opened, so a closed one asks the server for nothing.
// It opens by itself when the project has messages the reader has not seen. Same room as on the Chat page.
export function ProjectChat({ projectId, people, unread }: { projectId: string; people: Person[]; unread: number }) {
  const [open, setOpen] = useState(unread > 0);
  const [left, setLeft] = useState(unread);
  // Once the room is open it marks itself read, so the number in the header goes with it.
  useEffect(() => {
    if (!open) return;
    const clear = () => setLeft(0);
    window.addEventListener(CHAT_CHANGED, clear);
    return () => window.removeEventListener(CHAT_CHANGED, clear);
  }, [open]);
  return (
    <section className="card card-pad project-chat" aria-label="Chat">
      <button type="button" className="project-chat-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <h2>Chat</h2>
        {left > 0 && <span className="chat-unread" aria-label={`${left} unread`}>{left > 99 ? '99+' : left}</span>}
        <span className="dim small">{open ? 'Hide' : 'Open'}</span>
      </button>
      {open && <ChatRoom roomId={projectId} people={people} embedded />}
    </section>
  );
}
