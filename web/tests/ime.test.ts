import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { composing, cutBy, isRealEnter } from '../components/ime';

// Dictation check (HANDOFF 8.6): Enter during a composition is not a submit, and a long paste or dictation
// into a box with a limit is never cut without a word.

describe('Enter during composition', () => {
  it('ignores Enter while a composition is open, in Chrome and Firefox (isComposing) and in Safari (keyCode 229)', () => {
    expect(isRealEnter({ key: 'Enter', nativeEvent: { isComposing: true, keyCode: 13 } })).toBe(false);
    expect(isRealEnter({ key: 'Enter', nativeEvent: { isComposing: false, keyCode: 229 } })).toBe(false);
    expect(isRealEnter({ key: 'Enter', isComposing: true })).toBe(false); // a native event
    expect(isRealEnter({ key: 'Enter', keyCode: 229 })).toBe(false);
  });
  it('takes a real Enter, and nothing else', () => {
    expect(isRealEnter({ key: 'Enter', nativeEvent: { isComposing: false, keyCode: 13 } })).toBe(true);
    expect(isRealEnter({ key: 'a', nativeEvent: { isComposing: false, keyCode: 65 } })).toBe(false);
    expect(composing({ nativeEvent: {} })).toBe(false);
  });
});

describe('a limit that cuts text', () => {
  it('counts what the browser drops: a paste at the end, a paste over a selection, and one that fits', () => {
    expect(cutBy('a'.repeat(590), 590, 590, 'b'.repeat(30), 600)).toBe(20);
    expect(cutBy('a'.repeat(600), 0, 600, 'b'.repeat(700), 600)).toBe(100); // replaces everything, 700 into 600
    expect(cutBy('a'.repeat(300), 100, 200, 'b'.repeat(150), 600)).toBe(0);
    expect(cutBy('a'.repeat(10), 10, 10, 'b'.repeat(500), -1)).toBe(0); // no limit set
    expect(cutBy('abc', 3, 1, 'xyz', 3)).toBe(1); // a backwards selection
  });
});

describe('the text boxes', () => {
  const dir = new URL('../components/', import.meta.url);
  const sources = readdirSync(dir).filter((f) => f.endsWith('.tsx')).map((f) => [f, readFileSync(new URL(f, dir), 'utf8')] as const);

  it('has no Enter handler on a text box without the composition check', () => {
    // A file with a key handler on Enter must take it through ./ime (isRealEnter or composing). The help and menu widgets are not text boxes.
    for (const [f, src] of sources) {
      if (/^(HelpMode|popover)\.tsx$/.test(f)) continue;
      const bare = src.split('\n').filter((l) => /e\.key === 'Enter'/.test(l) && !/isRealEnter/.test(l));
      if (bare.length) expect(src, `${f}: ${bare.join(' | ')}`).toMatch(/from '\.\/ime'/);
    }
  });

  it('listens for a cut on every page, through LimitNotice in the layout', () => {
    expect(readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8')).toContain('<LimitNotice />');
    expect(readFileSync(new URL('LimitNotice.tsx', dir), 'utf8')).toContain("'beforeinput'");
  });

  it('keeps a speaking line in the guide', () => {
    // Since 30 Oct the Guide points to Quick Add's own mic in place of a dictation app.
    expect(readFileSync(new URL('GuideView.tsx', dir), 'utf8')).toContain('Type or say it the way you&rsquo;d tell someone');
  });
});
