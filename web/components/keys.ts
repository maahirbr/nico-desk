// Single-key shortcuts must stay out of the way of typing. True when the key press lands in a field.
export function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

// The shortcut list: the one source for the pop-up (Shortcuts.tsx) and the Guide page, so they never differ.
// "/" and Ctrl/Cmd K live in TopSearch, "n" in Shortcuts, "?" in HelpMode.
export const SHORTCUTS: readonly (readonly [string, string])[] = [
  ['/ or Ctrl/Cmd K', 'Search'],
  ['n', 'New task'],
  ['?', 'Help mode on or off'],
  ['Esc', 'Close a panel, a menu or the search'],
];
