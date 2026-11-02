import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {}, push() {} }), usePathname: () => '/', useSearchParams: () => new URLSearchParams() }));

import { TaskRow } from '../components/task-ui';
import { proposalGap } from '../components/Minutes';
import { GUIDE_SECTIONS, GuideView } from '../components/GuideView';
import { personFields } from '../lib/personFields';
import type { Task } from '../lib/derive';

// The fixes the launch QA of 29 Oct proposed (qa report numbers F2 to F9), where they can be pinned without a browser.
const task = (over: Partial<Task> = {}) => ({
  id: 't1', title: 'A task', description: '', statusCategory: 'open', health: 'not_started', blocked: null, links: [], dateMoves: 0,
  ownerId: 'p1', dueOn: '2026-10-20', firstDueOn: '2026-10-20', readOnly: false, version: 1, ...over,
}) as unknown as Task;
const row = (t: Task) => renderToStaticMarkup(createElement(TaskRow, { t, today: '2026-10-09', canTick: true, onOpen() {}, onStatus() {} }));

describe('a task row', () => {
  it('offers a tick and the status menu on a normal task', () => {
    expect(row(task())).toContain('type="checkbox"');
    expect(row(task())).toContain('aria-haspopup');
  });

  it('offers neither on a task from a Sheet, so nobody meets the 403', () => {
    const out = row(task({ readOnly: true }));
    expect(out).not.toContain('type="checkbox"');
    expect(out).not.toContain('aria-haspopup');
  });

  it('gives the moved-date mark a role, so its label is allowed', () => {
    expect(row(task({ dateMoves: 2 }))).toMatch(/class="moved"[^>]*role="img"|role="img"[^>]*class="moved"/);
  });
});

describe('the minutes badge', () => {
  it('names only what is missing', () => {
    expect(proposalGap('', '')).toBe('Needs owner and date');
    expect(proposalGap('', '2026-10-20')).toBe('Needs an owner');
    expect(proposalGap('p1', '')).toBe('Needs a date');
    expect(proposalGap('p1', '2026-10-20')).toBeNull();
  });
});

describe('the guide', () => {
  it('says who sees what', () => {
    expect(GUIDE_SECTIONS.map((s) => s.id)).toContain('sees');
    const out = renderToStaticMarkup(createElement(GuideView));
    expect(out).toContain('Who sees what');
    expect(out).toContain('via Claude');
  });
});

describe('the roster fields', () => {
  const message = (body: unknown) => {
    const r = personFields.safeParse(body);
    return r.success ? null : r.error.issues[0].message;
  };
  const good = { displayName: 'Ada Rao', role: 'Designer', department: 'Design', email: 'ada@example.test' };

  it('accepts a whole person', () => { expect(message(good)).toBeNull(); });

  it('names the field in plain words', () => {
    expect(message({ ...good, displayName: 'A' })).toBe('Name must be 2 to 80 characters.');
    expect(message({ ...good, role: 'x'.repeat(81) })).toBe('Job title must be 2 to 80 characters.');
    expect(message({ ...good, department: '' })).toBe('Department must be 2 to 80 characters.');
    expect(message({ ...good, email: 'not an email' })).toBe('Enter a valid email address.');
    expect(message({ ...good, displayName: undefined })).toBe('Name must be 2 to 80 characters.');
  });
});
