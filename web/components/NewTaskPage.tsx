'use client';

import { useRouter } from 'next/navigation';
import { AddTaskForm, type Opt } from './task-ui';

export function NewTaskPage({ people, meId, today, projects, wsByProject }: {
  people: Opt[]; meId: string; today: string; projects: Opt[]; wsByProject: Record<string, string[]>;
}) {
  const router = useRouter();
  return (
    <div className="calm narrow">
      <header className="page-head"><div><h1>New Task</h1><p className="summary">Say it in one line, or fill it in yourself.</p></div></header>
      <div className="card form-card">
        <AddTaskForm people={people} meId={meId} today={today} projects={projects} wsByProject={wsByProject} onDone={() => router.push('/me')} />
      </div>
    </div>
  );
}
