'use client';

import { useRouter } from 'next/navigation';
import { AddTaskForm, type Opt } from './task-ui';

// From a chat message: the form opens with its first line as the title and the room's project. The person still
// confirms, and the new task links back to the message.
export type FromMessage = { id: string; roomName: string; back: string; text: string; title: string; projectId?: string };

export function NewTaskPage({ people, meId, today, projects, wsByProject, from }: {
  people: Opt[]; meId: string; today: string; projects: Opt[]; wsByProject: Record<string, string[]>; from?: FromMessage;
}) {
  const router = useRouter();
  return (
    <div className="calm narrow">
      <header className="page-head"><div><h1>New task</h1><p className="summary">{from ? 'Check the details, then add it. The task will link back to the message.' : 'Pick a project, or leave it empty for a one-off task this week.'}</p></div></header>
      {from && (
        <blockquote className="chat-quote">
          <span className="chat-quote-room">From chat, {from.roomName}</span>
          <p>{from.text}</p>
        </blockquote>
      )}
      <div className="card form-card">
        <AddTaskForm people={people} meId={meId} today={today} projects={projects} wsByProject={wsByProject}
          projectId={from?.projectId} startTitle={from?.title} fromMessage={from?.id}
          onDone={() => router.push(from ? from.back : '/me')} />
      </div>
    </div>
  );
}
