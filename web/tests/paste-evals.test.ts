import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseChat } from '../lib/chat';
import { makeMasker } from '../lib/redact';

// The 20 synthetic chats in evals/paste/. The real parser must read each one into the same messages as the gold file.
// evals/paste/check.py checks the same gold against a second, independent parser.
const DIR = join(__dirname, '..', '..', 'evals', 'paste');
const ctx = JSON.parse(readFileSync(join(DIR, 'context.json'), 'utf8'));
const cases = readdirSync(DIR).filter((d) => /^\d\d-/.test(d)).sort();

describe('paste evals', () => {
  it('has the 20 cases', () => {
    expect(cases).toHaveLength(20);
  });

  describe.each(cases)('%s', (name) => {
    const chat = readFileSync(join(DIR, name, 'chat.txt'), 'utf8');
    const exp = JSON.parse(readFileSync(join(DIR, name, 'expected.json'), 'utf8'));

    it('is read into the gold messages', () => {
      const r = parseChat(chat);
      expect(r.messages).toEqual(exp.messages);
      expect(r.format).toBe(exp.format);
      expect(r.dropped).toBe(exp.dropped);
    });

    it('keeps every quoted line as an exact piece of its source message', () => {
      const r = parseChat(chat);
      for (const p of exp.proposals) expect(r.messages[p.source].text).toContain(p.quote);
    });

    it('masks names, emails and phone numbers before the model sees the text', () => {
      const dict = {
        people: ctx.people.map((p: { name: string }) => ({ names: [p.name, p.name.split(' ')[0]], emails: [] as string[] })),
        projects: ctx.projects.map((p: { name: string }) => p.name),
      };
      const m = makeMasker(dict);
      const masked = parseChat(chat).messages.map((x) => m.mask(`${x.sender ?? ''}: ${x.text}`)).join('\n');
      for (const p of ctx.people) expect(masked).not.toContain(p.name);
      for (const p of ctx.projects) expect(masked).not.toContain(p.name);
      expect(masked).not.toMatch(/@[\w.-]+\.\w+/);
      expect(masked).not.toMatch(/90000 000\d\d/);
    });
  });
});
