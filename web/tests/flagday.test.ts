import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {}, push() {} }), usePathname: () => '/', useSearchParams: () => new URLSearchParams() }));

import type { Task } from '../lib/derive';
import { FlagChip } from '../components/task-ui';

// A finished task's aside (30 Oct): Ahead shows the day, Late how late against the first date, On time nothing more.
const done = (outcome: 'ahead' | 'on_time' | 'late', endedAt: string) =>
  ({ statusCategory: 'done', outcome, firstDueOn: '2026-10-13', dueOn: '2026-10-13', endedAt }) as unknown as Task;
const text = (t: Task) => renderToStaticMarkup(createElement(FlagChip, { t, today: '2026-10-30' })).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('the aside on a finished task', () => {
  it('shows the day for Ahead, how late for Late, and nothing for On time', () => {
    expect(text(done('ahead', '2026-10-12T10:00:00+05:30'))).toBe('Ahead 12 Oct');
    expect(text(done('late', '2026-10-16T10:00:00+05:30'))).toBe('Late 3 days');
    expect(text(done('late', '2026-10-14T23:30:00+05:30'))).toBe('Late 1 day');
    expect(text(done('on_time', '2026-10-13T18:00:00+05:30'))).toBe('On time');
  });
  it('shows the day a dropped task was dropped', () => {
    const t = { statusCategory: 'dropped', outcome: null, firstDueOn: '2026-10-13', dueOn: '2026-10-13', endedAt: '2026-10-11T09:00:00+05:30' } as unknown as Task;
    expect(text(t)).toBe('11 Oct');
  });
});
