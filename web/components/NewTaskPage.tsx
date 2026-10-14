'use client';

import { useRouter } from 'next/navigation';
import { AddTaskForm, type Opt } from './task-ui';

export function NewTaskPage({ people, meId, today, projects, wsByProject }: {
  people: Opt[]; meId: string; today: string; projects: Opt[]; wsByProject: Record<string, string[]>;
}) {
  const router = useRouter();
  return (
    <div className="calm narrow">
      <header className="page-head"><div><h1>New task</h1><p className="summary">Pick a project, or leave it empty for a one-off task this week.</p></div></header>
      <div className="card form-card">
        <AddTaskForm people={people} meId={meId} today={today} projects={projects} wsByProject={wsByProject} onDone={() => router.push('/me')} />
      </div>
    </div>
  );
}
