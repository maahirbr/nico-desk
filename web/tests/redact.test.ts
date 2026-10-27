import { describe, expect, it } from 'vitest';
import { makeMasker, type MaskDict } from '../lib/redact';

// The masking layer. No network. Names are synthetic.
const DICT: MaskDict = {
  people: [
    { names: ['Meera Iyer', 'Meera', 'Iyer'], emails: ['meera@example.test', 'meera.alt@example.test'] },
    { names: ['Ada Quill', 'Ada', 'Quill'], emails: ['ada@example.test'] },
  ],
  projects: ['Autumn landing page', 'Loyalty tier pilot', 'Content'],
  terms: ['Acme Print'],
};

describe('masking', () => {
  const note = 'Meera Iyer says the Autumn landing page is held. Mail meera@example.test or call +91 90000 00001, see https://docs.example.test/brief and pay Rs 45,000 (ref 123456) by 2026-10-09.';

  it('removes names, emails, phones, links, amounts and project names', () => {
    const out = makeMasker(DICT).mask(note);
    for (const bad of ['Meera', 'Iyer', 'example.test', '90000', 'https', '45,000', '123456', 'Autumn landing page']) expect(out).not.toContain(bad);
    expect(out).toContain('Person 1');
    expect(out).toContain('Project 1');
    expect(out).toContain('Phone 1');
    expect(out).toContain('Link 1');
    expect(out).toContain('Amount 1');
  });

  it('masks phone numbers with and without a country code, spaces and dashes, on or off the roster', () => {
    const m = makeMasker(DICT);
    for (const n of ['+91 90000 00001', '+919000000001', '09000000001', '90000-00001', '90000 00001', '(0124) 400 1234', '+44 20 7946 0958']) {
      const out = m.mask(`call ${n} today`);
      expect(out, n).toMatch(/^call Phone \d+ today$/);
    }
    // a short number is not a phone, and a line break never joins two numbers
    expect(m.mask('room 4021 or 12-34-56')).not.toContain('Phone');
    expect(m.mask('90000\n00001')).not.toContain('Phone'); // two separate numbers, not one phone
  });

  it('keeps dates and status words', () => {
    const out = makeMasker(DICT).mask('Blocked until 2026-10-09, then In progress.');
    expect(out).toBe('Blocked until 2026-10-09, then In progress.');
  });

  it('gives one person one label across name, first name and email', () => {
    const m = makeMasker(DICT);
    expect(m.mask('Meera Iyer, then Meera, then meera@example.test, then meera.alt@example.test')).toBe('Person 1, then Person 1, then Person 1, then Person 1');
    expect(m.mask('Ada asked Meera')).toBe('Person 2 asked Person 1');
  });

  it('round-trips through the map', () => {
    const m = makeMasker(DICT);
    const masked = m.mask(note);
    expect(masked).not.toBe(note);
    // A person's email comes back as the person's name: one label stands for every spelling.
    expect(m.unmask(masked)).toBe(note.replace('meera@example.test', 'Meera Iyer'));
    const plain = 'Ping Ada Quill about Loyalty tier pilot at +91 90000 00001, link https://docs.example.test/brief, Rs 45,000.';
    const m2 = makeMasker(DICT);
    expect(m2.unmask(m2.mask(plain))).toBe(plain);
  });

  it('does not mask a name inside another word', () => {
    const m = makeMasker(DICT);
    expect(m.mask('Adam and Adaptive and Quilted')).toBe('Adam and Adaptive and Quilted');
    expect(m.mask("Ada's draft")).toBe("Person 1's draft");
  });

  it('matches longest first and ignores case', () => {
    const m = makeMasker(DICT);
    expect(m.mask('LOYALTY TIER PILOT and the content plan')).toBe('Project 1 and the Project 2 plan');
  });

  it('masks extra terms and keys of objects, and unmasks answers', () => {
    const m = makeMasker(DICT);
    const q = m.mask({ criteria: { 'Meera Iyer': 'Acme Print owns it' } });
    expect(JSON.stringify(q)).not.toMatch(/Meera|Acme/);
    expect(m.unmask({ choice: 'Person 1', probabilities: { 'Person 1': 0.9 } })).toEqual({ choice: 'Meera Iyer', probabilities: { 'Meera Iyer': 0.9 } });
  });

  it('numbers more than nine in order without mixing Person 1 and Person 10', () => {
    const people = Array.from({ length: 12 }, (_, i) => ({ names: [`Name${String.fromCharCode(97 + i)}x`], emails: [] }));
    const m = makeMasker({ people, projects: [] });
    const masked = m.mask(people.map((p) => p.names[0]).join(' '));
    expect(masked).toBe('Person 1 Person 2 Person 3 Person 4 Person 5 Person 6 Person 7 Person 8 Person 9 Person 10 Person 11 Person 12');
    expect(m.unmask('Person 10 and Person 1')).toBe('Namejx and Nameax');
  });
});
