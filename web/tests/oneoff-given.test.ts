import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../lib/db';
import { TEAM_ID } from '../lib/seed';
import { closeTask, createTask, oneOffsGiven, teamTasks } from '../lib/service';
import { reminderDrafts } from '../lib/reminders';
import { SEE_ALL } from '../lib/sight';

// One-off tasks I gave (20 Nov): only tasks I made for someone else outside any project.
const AS_OF = '2026-10-09';
let db: Db;
beforeEach(async () => { process.env.NICO_TODAY = AS_OF; db = await openDb(); });
const ME = 'per_ada', THEM = 'per_bo';

describe('one-off tasks I gave', () => {
  it('lists what I gave, open then closed, and nothing else', async () => {
    const given = await createTask(db, ME, { teamId: TEAM_ID, title: 'Send the swatches', ownerId: THEM, dueOn: '2026-10-20' });
    await createTask(db, ME, { teamId: TEAM_ID, title: 'My own note', ownerId: ME, dueOn: '2026-10-20' });
    const proj = (await teamTasks(db, TEAM_ID, AS_OF)).find((t) => t.projectId)!.projectId!;
    await createTask(db, ME, { teamId: TEAM_ID, title: 'On a project', ownerId: THEM, dueOn: '2026-10-20', projectId: proj });
    let r = await oneOffsGiven(db, TEAM_ID, ME, AS_OF);
    expect(r.open.map((t) => t.title)).toContain('Send the swatches');
    expect(r.open.map((t) => t.title)).not.toContain('My own note');
    expect(r.open.map((t) => t.title)).not.toContain('On a project');
    await closeTask(db, THEM, given.id, { version: given.version, as: 'done' });
    r = await oneOffsGiven(db, TEAM_ID, ME, AS_OF);
    expect(r.open.map((t) => t.id)).not.toContain(given.id);
    expect(r.closed.map((t) => t.id)).toContain(given.id);
    expect((await oneOffsGiven(db, TEAM_ID, THEM, AS_OF)).open.map((t) => t.id)).not.toContain(given.id); // not theirs to track
  });
  it('keeps one-off tasks out of Reminders', async () => {
    const t = await createTask(db, ME, { teamId: TEAM_ID, title: 'Call the printer', ownerId: THEM, dueOn: '2026-10-10' });
    const keys = (await reminderDrafts(db, TEAM_ID, { mode: 'window', days: 14, sight: SEE_ALL }, 'x', AS_OF)).drafts.flatMap((d) => d.items.map((i) => i.key));
    expect(keys).not.toContain(`task:${t.id}`);
  });
});
