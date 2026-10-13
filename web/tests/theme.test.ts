import { describe, expect, it } from 'vitest';
import { SKINS, skinOf } from '../components/skins';
import { THEME_COOKIE, themeAttr, themeOf } from '../components/theme';

describe('theme cookie', () => {
  it('reads light and dark, and falls back to system for anything else', () => {
    expect(themeOf('light')).toBe('light');
    expect(themeOf('dark')).toBe('dark');
    expect(themeOf('system')).toBe('system');
    expect(themeOf(undefined)).toBe('system');
    expect(themeOf(null)).toBe('system');
    expect(themeOf('')).toBe('system');
    expect(themeOf('Dark')).toBe('system');
    expect(themeOf('"><script>')).toBe('system');
  });

  it('writes no data-theme attribute for System', () => {
    expect(themeAttr('system')).toBeUndefined();
    expect(themeAttr('light')).toBe('light');
    expect(themeAttr('dark')).toBe('dark');
  });

  it('uses the nd_theme cookie', () => {
    expect(THEME_COOKIE).toBe('nd_theme');
  });
});

describe('skin names', () => {
  it('keeps the cookie ids and uses the Nico names', () => {
    expect(SKINS.map((s) => s.id)).toEqual(['w', 'a', 'b', 'c', 'm', 'i']);
    expect(SKINS.map((s) => s.name)).toEqual(['NicoWarm', 'NicoPlain', 'NicoCalm', 'NicoSoft', 'NicoOS', 'NicoNote']);
    expect(skinOf('m')).toBe('m');
    expect(skinOf('nope')).toBe('w');
  });
});
