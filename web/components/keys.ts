// Single-key shortcuts must stay out of the way of typing. True when the key press lands in a field.
export function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

// The item the page is about, as a thread map address (key "t"). A task, project or person page gives its own item.
// Anywhere else, an open task drawer (?task=<id>) gives that task. The map page itself and every other page give null.
export function mapFocusFrom(pathname: string, search: string): string | null {
  const m = /^\/(tasks|projects|people)\/([A-Za-z0-9_.-]{1,64})\/?$/.exec(pathname);
  if (m && m[2] !== 'new') {
    const kind = m[1] === 'tasks' ? 'task' : m[1] === 'projects' ? 'project' : 'person';
    return `/map?focus=${kind}:${m[2]}`;
  }
  if (m) return null;
  if (pathname === '/map') return null;
  const t = new URLSearchParams(search).get('task');
  return t && /^[A-Za-z0-9_.-]{1,64}$/.test(t) ? `/map?focus=task:${t}` : null;
}

// The shortcut list: the one source for the pop-up (Shortcuts.tsx) and the Guide page, so they never differ.
// "/" and Ctrl/Cmd K live in TopSearch, "n" and "t" in Shortcuts, "?" in HelpMode.
export const SHORTCUTS: readonly (readonly [string, string])[] = [
  ['/ or Ctrl/Cmd K', 'Search'],
  ['n', 'New task'],
  ['t', 'Thread map of the task, project or person you are on'],
  ['?', 'Help mode on or off'],
  ['Esc', 'Close a panel, a menu or the search'],
];
