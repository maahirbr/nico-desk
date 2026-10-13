import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_MS } from '../lib/motionMath';
import { ditherPath, ditherRows } from '../lib/dither';

// Pins the motion rules in DESIGN.md Motion to the files that carry them: tokens.css (durations), globals.css
// (keyframes and the reduced-motion block) and components/motion.ts (the JS springs). A new move that breaks a
// rule fails here rather than in review.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const tokens = read('app/tokens.css');
const globals = read('app/globals.css');
const motionTs = read('components/motion.ts');
const design = readFileSync(join(root, '..', 'DESIGN.md'), 'utf8');

const durations = [...tokens.matchAll(/(--(?:dur|dither-spread|stagger-step)[a-z-]*):\s*(\d+)ms/g)].map((m) => ({ name: m[1], ms: Number(m[2]) }));
const reducedBlock = (css: string) => {
  const i = css.indexOf('@media (prefers-reduced-motion: reduce)');
  return css.slice(i, css.indexOf('\n}\n', i));
};

describe('durations are tokens and stay under 300ms', () => {
  it('finds the tokens', () => {
    const names = new Set(durations.map((d) => d.name));
    for (const n of ['--dur-arrive', '--dur-pop', '--dur-dither', '--dur-glyph', '--dither-spread', '--dur-stagger']) expect(names.has(n)).toBe(true);
  });
  it('keeps every duration token at 300ms or less', () => {
    for (const d of durations) expect(d.ms, d.name).toBeLessThanOrEqual(MAX_MS);
  });
  it('finishes a dither picture within 300ms: the last row starts late, then runs its own duration', () => {
    const v = (n: string) => durations.find((d) => d.name === n && d.ms > 0)!.ms;
    expect(v('--dither-spread') + v('--dur-dither')).toBeLessThanOrEqual(MAX_MS);
  });
  it('writes every time in an animation as a token, never a number', () => {
    const lines = globals.split('\n').filter((l) => /\banimation:/.test(l) && !/animation-timeline|animation:\s*none|fade-l-in/.test(l));
    expect(lines.length).toBeGreaterThan(10);
    for (const l of lines) expect(l, l).toMatch(/var\(--dur-/);
  });
  it('keeps every duration and spring in motion.ts at 0.3s or less', () => {
    const secs = [...motionTs.matchAll(/(?:visualDuration|duration):\s*([\d.]+)/g)].map((m) => Number(m[1]));
    expect(secs.length).toBeGreaterThan(8);
    for (const s of secs) expect(s).toBeLessThanOrEqual(MAX_MS / 1000);
  });
});

describe('only transform and opacity move', () => {
  const keyframes = [...globals.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)].map((m) => ({ name: m[1], body: m[2] }));
  const ALLOWED = new Set(['opacity', 'transform', 'stroke-dashoffset']);
  // The edge fade on scrolling tab rows is driven by scroll position, not by time (animation-timeline), and has no duration.
  const SCROLL_DRIVEN = new Set(['fade-l-in', 'fade-r-out']);

  it('finds the keyframes, including the new moves', () => {
    const names = keyframes.map((k) => k.name);
    for (const n of ['dither-row', 'chip-pop', 'glyph-out', 'glyph-in', 'arrive']) expect(names).toContain(n);
  });
  it('animates nothing but opacity, transform and the stroke draw', () => {
    for (const k of keyframes.filter((k) => !SCROLL_DRIVEN.has(k.name))) {
      const props = [...k.body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      for (const p of props) expect(ALLOWED.has(p), `${k.name} animates ${p}`).toBe(true);
    }
  });
  it('never transitions a layout property', () => {
    const decls = [...globals.matchAll(/\btransition(?:-property)?:\s*([^;}]*)/g)].map((m) => m[1]);
    expect(decls.length).toBeGreaterThan(10);
    for (const l of decls) {
      expect(l, l).not.toMatch(/\b(width|height|top|left|right|bottom|margin|padding|inset)\b/);
    }
  });
  it('shifts the new moves by transform only', () => {
    expect(keyframes.find((k) => k.name === 'dither-row')!.body).not.toMatch(/transform/);
    expect(keyframes.find((k) => k.name === 'chip-pop')!.body).toMatch(/scale\(var\(--pop-scale-from\)\)/);
  });
});

describe('reduced motion stops everything', () => {
  it('zeroes every duration token in tokens.css', () => {
    const block = reducedBlock(tokens);
    // The base tokens are the ones declared in the first :root block, before any skin.
    const base = tokens.slice(0, tokens.indexOf('@media (prefers-reduced-motion: reduce)'));
    for (const d of durations.filter((d) => base.includes(`${d.name}:`))) {
      expect(block, d.name).toMatch(new RegExp(`${d.name}:\\s*0ms`));
    }
  });
  it('turns off every animation class in globals.css', () => {
    const off = reducedBlock(globals);
    // Selectors of rules that start a time-based animation.
    const rules = [...globals.matchAll(/^([^\n{}@/][^{}\n]*)\{[^}\n]*\banimation:\s*[^;}]*var\(--dur-[^}\n]*\}/gm)].map((m) => m[1].trim());
    expect(rules.length).toBeGreaterThan(10);
    for (const sel of rules.flatMap((r) => r.split(','))) {
      const s = sel.trim().replace(/^:root\[[^\]]+\]\s*/, '');
      if (!s || /\.is-(closing|leaving)/.test(s)) continue; // the closing fades run on --dur-panel and --dur-toast, which are 0 under reduced motion
      expect(off.includes(s), `${s} is not stopped under reduced motion`).toBe(true);
    }
  });
  it('makes every other transition instant', () => {
    expect(reducedBlock(globals)).toMatch(/transition-duration:\s*0ms\s*!important/);
  });
  it('makes the JS presets return no movement', () => {
    const presets = [...motionTs.matchAll(/export function (\w+Motion|fadeShift)\(/g)].map((m) => m[1]);
    expect(presets.length).toBeGreaterThanOrEqual(7);
    for (const name of presets) {
      const start = motionTs.indexOf(`export function ${name}(`);
      const body = motionTs.slice(start, motionTs.indexOf('\n}\n', start));
      expect(body, name).toMatch(/reduced\(\)/);
    }
  });
});

describe('dither rows', () => {
  it('splits a picture into rows that add up to the one-path picture', () => {
    for (const f of ['glow', 'bands', 'hill'] as const) {
      const rows = ditherRows(f, 56, 14);
      expect(rows).toHaveLength(14);
      expect(rows.join('')).toBe(ditherPath(f, 56, 14));
    }
  });
  it('keeps each row on its own line of the grid', () => {
    const rows = ditherRows('bands', 20, 8);
    rows.forEach((d, r) => { for (const m of d.matchAll(/M\d+ (\d+)/g)) expect(Number(m[1])).toBe(r); });
  });
});

describe('the new moves are listed in DESIGN.md Motion', () => {
  const motion = design.slice(design.indexOf('\n## Motion'), design.indexOf('\n## Components'));
  it('names each one with its token', () => {
    expect(motion).toMatch(/dither[\s\S]*--dur-dither/i);
    expect(motion).toMatch(/mention chip[\s\S]*--dur-pop/i);
    expect(motion).toMatch(/status icon[\s\S]*--dur-glyph/i);
    expect(motion).toMatch(/new comment[\s\S]*\.arrive/i);
  });
});
