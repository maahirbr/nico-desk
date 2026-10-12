import type { LinkSite, TaskLink } from '@/lib/links';
import { hostOf, linkText, siteOf } from '@/lib/links';

// Link chips for a task: one small pill per link with a built-in site icon. The icon is picked from the host
// alone (lib/links.ts), so nothing is fetched from a third party. Each chip opens in a new tab.

export function SiteIcon({ site }: { site: LinkSite }) {
  return (
    <svg className="lchip-icon" viewBox="0 0 12 12" width="12" height="12" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      {site === 'docs' && (<><path d="M3 1.6h4l2 2v6.8H3z" /><path d="M7 1.6v2h2M4.4 6h3.2M4.4 8h3.2" /></>)}
      {site === 'sheets' && (<><rect x="2" y="2" width="8" height="8" rx="1" /><path d="M2 6h8M6 2v8" /></>)}
      {site === 'slides' && (<><rect x="1.8" y="2.6" width="8.4" height="6" rx="1" /><path d="M6 8.6v1.8M4.4 10.4h3.2" /></>)}
      {site === 'figma' && (<><rect x="3.2" y="1.6" width="2.8" height="2.8" rx="1.4" /><rect x="6" y="1.6" width="2.8" height="2.8" rx="1.4" /><rect x="3.2" y="4.4" width="2.8" height="2.8" rx="1.4" /><circle cx="7.4" cy="5.8" r="1.4" /><path d="M4.6 7.2a1.4 1.4 0 1 0 1.4 1.4V7.2z" /></>)}
      {site === 'drive' && (<><path d="M4.2 2h3.6l3 5.2H7.2zM4.2 2L1.2 7.2l1.8 3.1h6l1.8-3.1" /></>)}
      {site === 'generic' && (<><circle cx="6" cy="6" r="4.2" /><path d="M1.8 6h8.4M6 1.8c1.2 1.2 1.8 2.6 1.8 4.2S7.2 9 6 10.2C4.8 9 4.2 7.6 4.2 6S4.8 3 6 1.8z" /></>)}
    </svg>
  );
}

export function LinkChip({ l, onRemove }: { l: Pick<TaskLink, 'url' | 'label'>; onRemove?: () => void }) {
  const site = siteOf(l.url);
  const text = linkText(l);
  return (
    <span className="lchip-wrap">
      <a className="lchip" href={l.url} target="_blank" rel="noopener noreferrer" title={l.url} aria-label={`${text}, ${hostOf(l.url)}, opens in a new tab`}>
        <SiteIcon site={site} /><span className="lchip-text">{text}</span>
      </a>
      {onRemove && <button type="button" className="lchip-x" aria-label={`Remove link ${text}`} onClick={onRemove}>×</button>}
    </span>
  );
}

// On a row: up to `max` chips, then "+N" which opens the task (the rest are in its side panel).
export function TaskLinkChips({ links, max = 2, onMore }: { links: TaskLink[]; max?: number; onMore?: () => void }) {
  if (links.length === 0) return null;
  const shown = links.slice(0, max);
  const rest = links.length - shown.length;
  return (
    <span className="lchips">
      {shown.map((l) => <LinkChip key={l.id} l={l} />)}
      {rest > 0 && (onMore
        ? <button type="button" className="lchip lchip-more" onClick={onMore} aria-label={`${rest} more links, open the task`}>+{rest}</button>
        : <span className="lchip lchip-more">+{rest}</span>)}
    </span>
  );
}
