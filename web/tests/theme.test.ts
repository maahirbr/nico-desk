import { describe, expect, it } from 'vitest';
import { SKINS, appearanceLabel, skinMenuName, skinOf } from '../components/skins';
import { THEME_COOKIE, themeAttr, themeOf } from '../components/theme';
import { commandsFor } from '../components/commands';

describe('theme cookie', () => {
  it('reads light and dark, and falls back to light for anything else', () => {
    expect(themeOf('light')).toBe('light');
    expect(themeOf('dark')).toBe('dark');
    expect(themeOf('system')).toBe('light');
    expect(themeOf(undefined)).toBe('light');
    expect(themeOf(null)).toBe('light');
    expect(themeOf('')).toBe('light');
    expect(themeOf('Dark')).toBe('light');
    expect(themeOf('"><script>')).toBe('light');
  });

  it('always writes data-theme, so the OS setting never overrides the pick', () => {
    expect(themeAttr('light')).toBe('light');
    expect(themeAttr('dark')).toBe('dark');
  });

  it('uses the nd_theme cookie', () => {
    expect(THEME_COOKIE).toBe('nd_theme');
  });
});

describe('skins', () => {
  it('offers Warm and Cool, and keeps their cookie ids', () => {
    expect(SKINS.map((s) => s.id)).toEqual(['w', 'm']);
    expect(SKINS.map((s) => s.name)).toEqual(['Warm', 'Cool']);
    expect(skinOf('m')).toBe('m');
    expect(skinOf('nope')).toBe('w');
  });

  it('moves a retired skin pick to Warm', () => {
    for (const old of ['a', 'b', 'c', 'i']) expect(skinOf(old)).toBe('w');
  });
});

describe('appearance labels', () => {
  it('says Default only on Warm and Light, else the skin picked', () => {
    expect(appearanceLabel('w', 'light')).toBe('Default');
    expect(appearanceLabel('w', 'dark')).toBe('Warm');
    expect(appearanceLabel('m', 'light')).toBe('Cool');
    expect(appearanceLabel('m', 'dark')).toBe('Cool');
  });

  it('marks the default skin in the menu', () => {
    expect(skinMenuName('w')).toBe('Warm (Default)');
    expect(skinMenuName('m')).toBe('Cool');
  });
});

describe('appearance commands', () => {
  it('lists both skins and both modes', () => {
    const labels = commandsFor('appearance', { isLead: false, readOnly: false }).map((c) => c.label);
    expect(labels).toEqual(['Appearance: Warm', 'Appearance: Cool', 'Appearance: Light', 'Appearance: Dark']);
  });
});
