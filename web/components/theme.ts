// Light or dark, for either skin. The server reads the cookie and sets data-theme on <html>, like data-skin.
// Light is the default (the PM's call, 13 Oct): with no cookie, or any other value (including the retired
// 'system'), the page is light.
export const THEMES = [
  { id: 'light', name: 'Light' },
  { id: 'dark', name: 'Dark' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];
export const THEME_COOKIE = 'nd_theme';
export const DEFAULT_THEME: ThemeId = 'light';

export function themeOf(value: string | undefined | null): ThemeId {
  return THEMES.some((t) => t.id === value) ? (value as ThemeId) : DEFAULT_THEME;
}

// The value for data-theme. Always set, so the OS setting never overrides the pick.
export function themeAttr(theme: ThemeId): 'light' | 'dark' {
  return theme;
}
