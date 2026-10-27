// Loading shapes. Each one mirrors the real page, with a flat fill and no movement.

const Block = ({ cls }: { cls: string }) => <span className={`sk ${cls}`} />;

export function SkHead() {
  return (<><Block cls="sk-h1" /><Block cls="sk-sub" /></>);
}

export function SkRows({ n = 4 }: { n?: number }) {
  return (
    <div className="sk-list">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="sk-row"><Block cls="sk-dot" /><Block cls="sk-line" /><Block cls="sk-chip" /></div>
      ))}
    </div>
  );
}

export function SkGroups({ groups = 2, rows = 3 }: { groups?: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: groups }, (_, i) => (<div key={i}><Block cls="sk-h2" /><SkRows n={rows} /></div>))}
    </>
  );
}

export function SkStats({ n = 4 }: { n?: number }) {
  return (<div className="sk-stats">{Array.from({ length: n }, (_, i) => <Block key={i} cls="sk-stat" />)}</div>);
}

export function SkCards({ n = 6 }: { n?: number }) {
  return (<div className="sk-cards">{Array.from({ length: n }, (_, i) => <Block key={i} cls="sk-card" />)}</div>);
}

export function SkTable() {
  return <Block cls="sk-table" />;
}

export function SkPage({ children }: { children: React.ReactNode }) {
  return (<div className="calm" role="status" aria-busy="true" aria-label="Loading">{children}</div>);
}
