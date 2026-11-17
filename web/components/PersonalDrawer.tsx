'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { TaskDrawer, type RowAction } from './task-ui';
import { useOpenTask } from './taskUrl';

// One task drawer for the whole Personal page (16 Nov): Today's 3 and the Personal task list both open tasks through
// it, so a task never opens twice. A Personal task opens with only me to pick from, as before. A team task opens with
// the team, as on Home, and keeps its usual rules.
type Open = (id: string, status?: RowAction) => void;
const Ctx = createContext<Open>(() => {});
export const usePersonalOpen = () => useContext(Ctx);

// "Today's notes" in the Today band asks the notes editor, further down the page, to go to today's heading.
export const TODAY_NOTES = 'nd:personal-today-notes';

export function PersonalDrawerHost({ children, personalIds, meId, meName, isLead, people, today, projectNames }: {
  children: ReactNode; personalIds: string[]; meId: string; meName: string; isLead: boolean;
  people: { id: string; name: string }[]; today: string; projectNames: Record<string, string>;
}) {
  const [openId, setOpenId] = useOpenTask();
  const [startStatus, setStartStatus] = useState<RowAction | undefined>();
  const open = useCallback<Open>((id, s) => { setStartStatus(s); setOpenId(id); }, [setOpenId]);
  const own = !!openId && personalIds.includes(openId);
  return (
    <Ctx.Provider value={open}>
      {children}
      {openId && <TaskDrawer key={`${openId}-${startStatus ?? ''}`} startStatus={startStatus} id={openId} meId={meId} isLead={own ? false : isLead}
        people={own ? [{ id: meId, name: meName }] : people} today={today} projectNames={projectNames} onClose={() => setOpenId(null)} />}
    </Ctx.Provider>
  );
}
