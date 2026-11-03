import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// "Ask for an update" (3 Nov): anyone but the owner asks; the owner sees it on Home; an update or a change by anyone but
// the asker answers it; the asker reads the answer in Updates for you; an old unanswered ask shows on Reminders.

const state = vi.hoisted(() => ({ jar: {} as Record<string, string>, testDb: null as unknown }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (n: string) => (n in state.jar ? { name: n, value: state.jar[n] } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock('../lib/db', async (orig) => ({ ...(await orig<typeof import('../lib/db')>()), db: async () => state.testDb }));

import { COOKIE, VIEW_COOKIE, signSession, signView, type Me } from '../lib/auth';
import { openDb, upgrade, type Db } from '../lib/db';
import { asksForMe, staleAsks } from '../lib/asks';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';
import { GET as getAsks, POST as postAsk } from '../app/api/v1/tasks/[id]/ask/route';

const LEAD = 'per_ada', OWNER = 'per_bo', ADMIN = 'per_fay';
let db: Db;
beforeAll(() => { process.env.NICO_TODAY = '2026-10-09'; process.env.NICO_SESSION_SECRET = 'asks-test-secret'; });
beforeEach(async () => { db = await openDb(); state.testDb = db; state.jar = {}; });

const signIn = (id: string, view?: string) => { state.jar = { [COOKIE]: signSession(id), ...(view ? { [VIEW_COOKIE]: view } : {}) }; };
const call = (fn: typeof postAsk, id: string, method: string, body?: unknown) => fn(new Request(`http://localhost/api/v1/tasks/${id}/ask`, {
  method, headers: { origin: 'http://localhost', host: 'localhost', 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
}), { params: Promise.resolve({ id }) });
const ask = (id: string, question?: string) => call(postAsk, id, 'POST', question === undefined ? {} : { question });
const meFor = async (id: string): Promise<Me> => {
  const p = (await s.listPeople(db, TEAM_ID)).find((x) => x.id === id)!;
  return { person: p, realPerson: p, viewingAs: false, team: { id: TEAM_ID, name: 'Team', teamType: 'department' } };
};
const task = () => s.createTask(db, LEAD, { teamId: TEAM_ID, title: 'Box artwork sign-off', ownerId: OWNER, dueOn: '2026-10-20' });
const names = async () => Object.fromEntries((await s.listPeople(db, TEAM_ID)).map((p) => [p.id, p.displayName]));
const answers = async (personId: string) =>
  (await s.updatesView(db, personId, TEAM_ID, await names(), {}, null, new Date(Date.now() + 1000))).items.filter((i) => i.kind === 'replied');

describe('asking for an update', () => {
  it('lets someone ask the owner once, with a question, and shows it to the owner', async () => {
    const t = await task();
    signIn(LEAD);
    const res = await ask(t.id, '  Has the printer replied?  ');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ taskId: t.id, askerId: LEAD, question: 'Has the printer replied?' });
    const again = await ask(t.id);
    expect(again.status).toBe(400);
    expect((await again.json()).error.code).toBe('already_asked');
    expect(await (await call(getAsks, t.id, 'GET')).json()).toHaveLength(1);
    expect((await asksForMe(db, await meFor(OWNER))).map((a) => [a.title, a.question])).toEqual([['Box artwork sign-off', 'Has the printer replied?']]);
  });

  it('refuses the owner asking themselves, a closed task, and anyone viewing as someone', async () => {
    const t = await task();
    signIn(OWNER);
    expect((await (await ask(t.id)).json()).error.code).toBe('own_task');
    signIn(ADMIN, signView(ADMIN, LEAD));
    const viewing = await ask(t.id);
    expect(viewing.status).toBe(403);
    expect((await viewing.json()).error.code).toBe('viewing_as');
    await s.closeTask(db, OWNER, t.id, { version: t.version, as: 'done' });
    signIn(LEAD);
    expect((await (await ask(t.id)).json()).error.code).toBe('task_closed');
  });

  it('is answered by the owner’s update, and the asker reads the reply', async () => {
    const t = await task();
    signIn(LEAD);
    await ask(t.id);
    await new Promise((r) => setTimeout(r, 5));
    await s.addUpdate(db, OWNER, t.id, 'Proofs on Thursday');
    expect(await asksForMe(db, await meFor(OWNER))).toEqual([]);
    expect(await (await call(getAsks, t.id, 'GET')).json()).toEqual([]);
    const [a] = await answers(LEAD);
    expect(a).toMatchObject({ taskId: t.id, clause: 'replied: “Proofs on Thursday”' });
    expect(a.text).toContain('replied on “Box artwork sign-off”');
    signIn(LEAD);
    expect((await ask(t.id)).status).toBe(200); // answered, so a new ask is fine
  });

  it('is answered by a status change, but not by the asker’s own change', async () => {
    const t = await task();
    signIn(LEAD);
    await ask(t.id);
    await new Promise((r) => setTimeout(r, 5));
    await s.addUpdate(db, LEAD, t.id, 'Chasing this'); // the asker is a lead, so may add one; it answers nothing
    expect(await asksForMe(db, await meFor(OWNER))).toHaveLength(1);
    await s.setHealth(db, OWNER, t.id, { version: t.version, health: 'on_track' });
    expect(await asksForMe(db, await meFor(OWNER))).toEqual([]);
    expect((await answers(LEAD)).map((i) => i.clause)).toEqual(['moved it to In progress']);
  });

  it('shows on Reminders once it has waited two days', async () => {
    const t = await task();
    signIn(LEAD);
    await ask(t.id, 'Any news?');
    const lead = await meFor(LEAD);
    expect(await staleAsks(db, lead)).toEqual([]);
    const later = new Date(Date.now() + 3 * 86_400_000);
    expect((await staleAsks(db, lead, undefined, later)).map((a) => [a.title, a.ownerId, a.days])).toEqual([['Box artwork sign-off', OWNER, 3]]);
  });

  it('comes to an older database through upgrade(), twice over', async () => {
    await db.exec('DROP TABLE update_asks');
    await upgrade(db);
    await upgrade(db);
    const t = await task();
    signIn(LEAD);
    expect((await ask(t.id)).status).toBe(200);
  });
});
