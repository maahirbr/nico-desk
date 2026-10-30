import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { HELP } from '../components/help';
import { SHORTCUTS } from '../components/keys';

// The route's only outside call is requireMe (cookies, redirect), so the test stands in for a signed-in member.
const auth = vi.hoisted(() => ({ who: async (): Promise<unknown> => null }));
vi.mock('@/lib/auth', () => ({ requireMe: () => auth.who() }));

import Guide from '../app/guide/page';
import { GUIDE_SECTIONS, GuideView, helpRest } from '../components/GuideView';

const html = (el: unknown) => renderToStaticMarkup(el as Parameters<typeof renderToStaticMarkup>[0]);
const text = (markup: string) => markup.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&rsquo;/g, "'").replace(/\s+/g, ' ');

describe('the guide page', () => {
  it('renders for a signed-in member, with every section as an h2', async () => {
    auth.who = async () => ({ person: { id: 'p1', displayName: 'Test Member', appRoles: ['member'] } });
    const markup = html(await Guide());
    for (const s of GUIDE_SECTIONS) expect(markup, s.title).toContain(`<h2 id="g-${s.id}">${s.title}</h2>`);
    expect(markup.match(/<h2/g)).toHaveLength(GUIDE_SECTIONS.length);
    expect(markup).toContain('<h1>How to use NicoDesk</h1>');
  });

  it('sends a signed-out visitor to sign-in: the redirect from requireMe goes up, nothing renders', async () => {
    auth.who = async () => { throw new Error('NEXT_REDIRECT'); };
    const out = await Guide().then(() => 'rendered', (e: Error) => e.message);
    expect(out).toBe('NEXT_REDIRECT');
  });

  it('lists exactly the shortcuts in keys.ts', () => {
    const markup = html(createElement(GuideView));
    const rows = [...markup.matchAll(/<dt><kbd class="kbd-key">([^<]*)<\/kbd><\/dt><dd>([^<]*)<\/dd>/g)].map((m) => [m[1], m[2]]);
    expect(rows).toEqual(SHORTCUTS.map(([k, what]) => [k, what]));
  });

  it('keeps the shortcuts pop-up on the same list', () => {
    const src = readFileSync(new URL('../components/Shortcuts.tsx', import.meta.url), 'utf8');
    expect(src).toContain('SHORTCUTS.map(');
    expect(src).not.toMatch(/const LIST/);
  });

  it('shows the five statuses with the words help mode uses', () => {
    const markup = text(html(createElement(GuideView)));
    for (const term of ['status_todo', 'status_doing', 'status_blocked', 'status_done', 'status_dropped'] as const) {
      expect(helpRest(term).length, term).toBeGreaterThan(0);
      expect(markup, term).toContain(HELP[term].split('. ')[0]);
      expect(markup, term).toContain(helpRest(term).replace(/&/g, '&amp;'));
    }
    expect(markup).toContain(helpRest('late'));
    expect(markup).toContain(helpRest('at_risk'));
  });

  it('uses plain words: no em dashes, no semicolons, short sentences', () => {
    const markup = html(createElement(GuideView));
    expect(text(markup)).not.toMatch(/[—–;]/);
    // One text node at a time, so a label and the line beside it are not read as one sentence.
    for (const node of markup.split(/<[^>]+>/).map((n) => n.trim()).filter(Boolean)) {
      for (const s of node.split(/(?<=[.!?])\s+/)) expect(s.split(/\s+/).length, s).toBeLessThanOrEqual(25);
    }
  });
});
