// The line icons of the sidebar and the top bar. They stay still; each stroke has a pathLength of 1 so an empty
// state's mark can draw in (stroke-dashoffset, a named exception in DESIGN.md).
export const ICON: Record<string, string> = {
  '/me': 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z',
  '/team': 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  '/search': 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.35-4.35',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  '/week': 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  '/status': 'M4 6h16M4 12h10M4 18h6',
  '/ledger': 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  '/reminders': 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  '/projects': 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',
  '/feedback': 'M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z',
  '/activity': 'M22 12h-4l-3 9L9 3l-3 9H2',
  '/admin': 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  help: 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
};

export const Icon = ({ d, className = 'ico' }: { d: string; className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {/* One path per stroke: the dash restarts on each stroke of a path, so a short stroke inside a shared
        pathLength would finish early and the icon would look rushed. */}
    {d.split(/(?=M)/).map((part, i) => <path key={i} d={part} pathLength={1} />)}
  </svg>
);

// The page's own icon above the words of an empty state. It draws itself once when the state appears.
export const EmptyMark = ({ d }: { d: string }) => <Icon d={d} className="ico empty-mark" />;
