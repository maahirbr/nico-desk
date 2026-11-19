'use client';

import { useRemembered } from './remember';

// Projects as cards or as a list (19 Nov, the PM's call). The choice is kept per person in this browser.
type View = 'grid' | 'list';

export function ProjectsLayout({ title, action, children }: { title: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  const [kept, keep] = useRemembered('projects', { view: 'grid' as View }, (raw): { view?: View } => (raw.view === 'list' || raw.view === 'grid' ? { view: raw.view } : {}));
  const view = kept.view;
  return (
    <>
      <header className="page-head">
        {title}
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
      <div className="pview" data-pview={view}>{children}</div>
    </>
  );
}
