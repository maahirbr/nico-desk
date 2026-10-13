// Light, dark or follow the system. The server reads the cookie and sets data-theme on <html>, like data-skin.
// System sets no attribute, so each skin's night block answers to prefers-color-scheme alone.
export const THEMES = [
  { id: 'system', name: 'System' },
  { id: 'light', name: 'Light' },
  { id: 'dark', name: 'Dark' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];
export const THEME_COOKIE = 'nd_theme';
export const DEFAULT_THEME: ThemeId = 'system';

export function themeOf(value: string | undefined | null): ThemeId {
  return THEMES.some((t) => t.id === value) ? (value as ThemeId) : DEFAULT_THEME;
}

// The value for data-theme: undefined for System, so React writes no attribute.
export function themeAttr(theme: ThemeId): 'light' | 'dark' | undefined {
  return theme === 'system' ? undefined : theme;
}
