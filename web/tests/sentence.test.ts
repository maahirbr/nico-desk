import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Quick add said the way a person talks: the plain rules (lib/sentence.ts), the model path with masking and its checks
// (lib/sentenceRead.ts), the fallback, and the route. The model is a stand-in: no network.

const state = vi.hoisted(() => ({ jar: {} as Record<string, string>, testDb: null as unknown }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (n: string) => (n in state.jar ? { name: n, value: state.jar[n] } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock('../lib/db', async (orig) => ({ ...(await orig<typeof import('../lib/db')>()), db: async () => state.testDb }));

import { POST as readRoute } from '../app/api/v1/tasks/read-sentence/route';
import { COOKIE, signSession, signView, VIEW_COOKIE, type Me } from '../lib/auth';
import { openDb, type Db } from '../lib/db';
import type { Ask } from '../lib/paste';
import { readSentenceRules, readTasksRules, splitTasks } from '../lib/sentence';
import { readSentence } from '../lib/sentenceRead';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';
import { looksLikeChat } from '../components/QuickAdd';

const AS_OF = '2026-10-09'; // a Friday
const LEAD = 'per_ada'; // Meera Iyer
const BO = 'per_bo'; // Kabir Sethi

const people = [{ id: 'm', name: 'Meera Iyer' }, { id: 'k', name: 'Kabir Sethi' }, { id: 'a', name: 'Ananya Rao' }, { id: 'solo', name: 'Jeevan' }];
const projects = [{ id: 'l', name: 'Autumn landing page' }, { id: 'ai', name: 'AI' }, { id: 'as', name: 'AI studio partnership' }];
const ctx = { today: AS_OF, people, projects, meName: 'Meera Iyer' };
const read = (t: string) => readSentenceRules(t, ctx);

describe('the plain rules', () => {
  it('reads "ask NAME to ..." with "send me", a weekday and a project', () => {
    expect(read('Can you ask Kabir to send me the updated design files by Monday for Autumn landing page?'))
      .toEqual({ title: 'Send the updated design files to Meera', ownerId: 'k', dueOn: '2026-10-12', projectId: 'l', notes: [] });
  });

  it('forgives typos in the opener and lower case names', () => {
    const r = read('can yuo ask kabir to send me the files by monday for autumn landing page');
    expect(r).toMatchObject({ title: 'Send the files to Meera', ownerId: 'k', dueOn: '2026-10-12', projectId: 'l' });
  });

  it('reads remind, needs to, tomorrow and end of week', () => {
    expect(read('remind Ananya to check the sheet totals tomorrow')).toMatchObject({ title: 'Check the sheet totals', ownerId: 'a', dueOn: '2026-10-10' });
    expect(read('Kabir needs to share the margin by end of week')).toMatchObject({ title: 'Share the margin', ownerId: 'k', dueOn: '2026-10-09' });
    expect(read('please get Jeevan to call the vendor next week')).toMatchObject({ title: 'Call the vendor', ownerId: 'solo', dueOn: '2026-10-12' });
  });

  it('keeps an unknown name in the title and says so', () => {
    const r = read('ask Rohan to call the vendor');
    expect(r.ownerId).toBeNull();
    expect(r.title).toBe('Ask Rohan to call the vendor');
    expect(r.notes[0]).toMatch(/No one on the team is called "Rohan"/);
  });

  it('picks the longest project name, and never turns an ordinary word into an owner', () => {
    expect(read('Design to review the mood board on the AI studio partnership project by 20 Oct'))
      .toMatchObject({ title: 'Design to review the mood board', ownerId: null, projectId: 'as', dueOn: '2026-10-20' });
    expect(read('Plan the Friday launch')).toMatchObject({ title: 'Plan the Friday launch', ownerId: null, dueOn: null });
  });

  it('still takes @ and #, and a date phrase before them', () => {
    expect(read('share the deck with me by eod @kabir')).toMatchObject({ title: 'Share the deck with Meera', ownerId: 'k', dueOn: AS_OF });
  });
});

describe('several tasks at once', () => {
  it('splits on sentence ends, "and then" and a name spoken to (today is a Friday, so Friday is next week)', () => {
    const r = readTasksRules('Kabir can you schedule the Autumn landing page review by Friday? And then Ananya, can you get back to the vendor by Monday?', ctx);
    expect(r).toEqual([
      expect.objectContaining({ title: 'Schedule the Autumn landing page review', ownerId: 'k', dueOn: '2026-10-16', projectId: 'l' }),
      expect.objectContaining({ title: 'Get back to the vendor', ownerId: 'a', dueOn: '2026-10-12' }),
    ]);
  });

  it('splits "and also" lists, lines and numbered lists, and reads "I need to" as the writer\'s own', () => {
    const r = readTasksRules('ask Kabir to send the files by Monday, and also remind Ananya to check totals tomorrow, and I need to book the studio', { ...ctx, people: [...people] });
    expect(r.map((x) => [x.title, x.ownerId])).toEqual([['Send the files', 'k'], ['Check totals', 'a'], ['Book the studio', 'm']]);
    expect(splitTasks('1. Kabir to share the margin\n2. Ananya to call the vendor', people)).toEqual(['Kabir to share the margin', 'Ananya to call the vendor']);
  });

  it('keeps one task whole when "and then" does not start a new one', () => {
    expect(splitTasks('send the deck and then the prices to Kabir by Friday', people)).toHaveLength(1);
  });

  it('stops at ten', () => {
    expect(splitTasks(Array.from({ length: 14 }, (_, i) => `Kabir to call vendor ${i + 1}`).join('\n'), people)).toHaveLength(10);
  });
});

describe('telling a chat from a sentence', () => {
  it('needs several lines with senders', () => {
    expect(looksLikeChat('[09/10/26, 9:41 AM] Kabir Sethi: sent it\n[09/10/26, 9:42 AM] Meera Iyer: thanks')).toBe(true);
    expect(looksLikeChat('ask Kabir to send the deck by Monday')).toBe(false);
  });
});

describe('the server reader', () => {
  let db: Db;
  beforeAll(() => { process.env.NICO_TODAY = AS_OF; process.env.NICO_SESSION_SECRET = 'sentence-test-secret'; delete process.env.DATABASE_URL; });
  beforeEach(async () => { db = await openDb(); state.testDb = db; state.jar = {}; delete process.env.ANTHROPIC_API_KEY; });

  async function meAs(id: string): Promise<Me> {
    const person = (await s.listPeople(db, TEAM_ID)).find((p) => p.id === id)!;
    return { person, realPerson: person, viewingAs: false, team: { id: TEAM_ID, name: 'Team', teamType: 'department' } };
  }

  it('uses the rules when the model is off', async () => {
    const r = await readSentence(db, await meAs(LEAD), 'ask Kabir to send me the deck by Monday', { today: AS_OF });
    expect(r.via).toBe('rules');
    expect(r.tasks).toEqual([expect.objectContaining({ ownerId: BO, dueOn: '2026-10-12', title: 'Send the deck to Meera' })]);
  });

  it('sends the model labels, not names, and maps its answer back', async () => {
    let sent = '';
    const ask: Ask = async ({ user }) => {
      sent = user;
      const writer = /The writer is (Person \d+)/.exec(user)![1];
      const owner = /(Person \d+)/.exec(user.split('<said>')[1])![1]; // the name in the sentence, as its label
      const proj = /Projects:\n- (Project \d+)/.exec(user)![1];
      return JSON.stringify([{ title: `Send the deck to ${writer}`, owner, due: '2026-10-12', project: proj }]);
    };
    const r = await readSentence(db, await meAs(LEAD), 'ask Kabir Sethi to send me the deck by Monday', { ask, today: AS_OF });
    expect(sent).not.toMatch(/Kabir|Meera|Sethi|Iyer/);
    expect(r.via).toBe('model');
    expect(r.tasks).toHaveLength(1);
    expect(r.tasks[0].title).toBe('Send the deck to Meera Iyer');
    expect(r.tasks[0].ownerId).toBe(BO);
    expect(r.tasks[0].dueOn).toBe('2026-10-12');
    expect(r.tasks[0].projectId).toBeTruthy();
  });

  it('takes several tasks from the model in one answer', async () => {
    const two: Ask = async ({ user }) => {
      const labels = [...user.split('<said>')[1].matchAll(/Person \d+/g)].map((m) => m[0]);
      return JSON.stringify([{ title: 'Schedule the review', owner: labels[0], due: '2026-10-09', project: null }, { title: 'Call the vendor', owner: labels[1], due: '2026-10-12', project: null }]);
    };
    const r = await readSentence(db, await meAs(LEAD), 'Kabir Sethi, can you schedule the review by Friday? And Ananya Rao, call the vendor by Monday.', { ask: two, today: AS_OF });
    expect(r.tasks.map((t) => t.title)).toEqual(['Schedule the review', 'Call the vendor']);
    expect(r.tasks[0].ownerId).toBe(BO);
  });

  it('drops a past date and an unknown owner, and falls back to the rules on a bad answer', async () => {
    const odd: Ask = async () => JSON.stringify([{ title: 'Call the vendor', owner: 'Person 99', due: '2020-01-01', project: 'Project 99' }]);
    const r = await readSentence(db, await meAs(LEAD), 'call the vendor', { ask: odd, today: AS_OF });
    expect(r.via).toBe('model');
    expect(r.tasks[0]).toMatchObject({ ownerId: null, dueOn: null, projectId: null });
    const junk: Ask = async () => 'no idea';
    expect((await readSentence(db, await meAs(LEAD), 'ask Kabir to call the vendor', { ask: junk, today: AS_OF })).via).toBe('rules');
  });

  it('is a POST through route(): refused under View as, and writes nothing', async () => {
    state.jar[COOKIE] = signSession(LEAD);
    const count = async () => (await db.query<{ n: number }>('SELECT count(*)::int AS n FROM tasks')).rows[0].n;
    const before = await count();
    const ok = await readRoute(new Request('http://localhost/api/v1/tasks/read-sentence', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost', host: 'localhost' }, body: JSON.stringify({ text: 'ask Kabir to send the deck by Monday' }) }), { params: Promise.resolve({}) });
    expect(ok.status).toBe(200);
    expect(await count()).toBe(before);
    state.jar = { [COOKIE]: signSession('per_fay'), [VIEW_COOKIE]: signView('per_fay', BO) }; // an admin viewing as a member
    const viewing = await readRoute(new Request('http://localhost/api/v1/tasks/read-sentence', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost', host: 'localhost' }, body: JSON.stringify({ text: 'x' }) }), { params: Promise.resolve({}) });
    expect(viewing.status).toBe(403);
  });
});
