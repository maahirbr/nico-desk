'use client';

import { useRemembered } from './remember';

// Projects as cards or as a list (19 Nov, the PM's call), soonest date first or A to Z (22 Nov). Both choices are kept per
// person in this browser. The page sends the cards by date, each with its A to Z place (--by-name); the sort only sets CSS order.
type View = 'grid' | 'list';
type Sort = 'date' | 'name';

// summary: the count line under the title; the sort reads on in it as a small drop-down ("7 projects · soonest date first ▾").
export function ProjectsLayout({ title, summary, action, children }: { title: React.ReactNode; summary?: string; action?: React.ReactNode; children: React.ReactNode }) {
  const [kept, keep] = useRemembered('projects', { view: 'grid' as View, sort: 'date' as Sort }, (raw): { view?: View; sort?: Sort } => ({
    ...(raw.view === 'list' || raw.view === 'grid' ? { view: raw.view } : {}),
    ...(raw.sort === 'date' || raw.sort === 'name' ? { sort: raw.sort } : {}),
  }));
  const { view, sort } = kept;
  return (
    <>
      <header className="page-head">
        <div>{title}
          {summary && <p className="summary">{summary} · <label className="inline-sort"><span className="sr-only">Sort projects</span>
            <select value={sort} onChange={(e) => keep('sort', e.target.value === 'name' ? 'name' : 'date')}>
              <option value="date">soonest date first</option>
              <option value="name">by name, A to Z</option>
            </select></label></p>}
        </div>
        {action}
      </header>
      <div className="pview-bar">
        <span className="pview-switch" role="group" aria-label="Show projects as">
          <button type="button" aria-pressed={view === 'list'} aria-label="List" title="List" onClick={() => keep('view', 'list')}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <button type="button" aria-pressed={view === 'grid'} aria-label="Grid" title="Grid" onClick={() => keep('view', 'grid')}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></svg>
          </button>
        </span>
      </div>
      <div className="pview" data-pview={view} data-psort={sort}>{children}</div>
    </>
  );
}
