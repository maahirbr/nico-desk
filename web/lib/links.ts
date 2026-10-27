// Links on a task: Docs, Sheets, Figma, decks, any web page. Pure helpers shared by the service, the API and the chips.
// The site icon comes from the host alone, from a built-in set. Nothing is fetched from a third party at runtime.

export const LINK_URL_MAX = 2000;
export const LINK_LABEL_MAX = 80;
export const LINKS_PER_TASK = 10;

export type TaskLink = { id: string; taskId: string; url: string; label: string | null; createdBy: string | null; createdAt: string };

export type LinkSite = 'docs' | 'sheets' | 'slides' | 'figma' | 'drive' | 'generic';

// The URL as stored, or a reason it is refused. Only http and https; no sign-in details inside the address.
export function checkLinkUrl(raw: unknown): { url: string } | { error: string } {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return { error: 'Paste a link.' };
  if (text.length > LINK_URL_MAX) return { error: `A link is up to ${LINK_URL_MAX} characters.` };
  let u: URL;
  try { u = new URL(text); } catch { return { error: 'That is not a web address. Start it with https://' }; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { error: 'Only http and https links are allowed.' };
  if (u.username || u.password) return { error: 'Leave sign-in details out of the link.' };
  if (!u.hostname.includes('.')) return { error: 'That address has no site name.' };
  return { url: u.toString() };
}

export function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

// Which built-in icon a link gets. Google files are told apart by the first path part.
export function siteOf(url: string): LinkSite {
  let u: URL;
  try { u = new URL(url); } catch { return 'generic'; }
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'figma.com' || host.endsWith('.figma.com')) return 'figma';
  if (host === 'docs.google.com') {
    const kind = u.pathname.split('/')[1];
    if (kind === 'spreadsheets') return 'sheets';
    if (kind === 'presentation') return 'slides';
    return 'docs';
  }
  if (host === 'drive.google.com') return 'drive';
  return 'generic';
}

// What a chip says: the label if there is one, otherwise the site, with the file kind for the common ones.
export function linkText(l: { url: string; label: string | null }): string {
  if (l.label) return l.label;
  const site = siteOf(l.url);
  const host = hostOf(l.url);
  if (site === 'docs') return 'Google Doc';
  if (site === 'sheets') return 'Google Sheet';
  if (site === 'slides') return 'Google Slides';
  if (site === 'drive') return 'Google Drive';
  if (site === 'figma') return 'Figma';
  return host || l.url;
}
