import { describe, expect, it } from 'vitest';
import { readBlocks } from '../lib/blocks';
import { nextStepsOf, plainParse } from '../lib/planUtil';
import { readTasksRules } from '../lib/sentence';

// Pasted notes are not one task per line. Headings give context, sub-bullets and plain statements are details,
// wrapped lines are one task, greetings and labels are noise, and "all by Friday" dates the lot. Every paste here is
// synthetic, written for these tests. Quick Add (lib/sentence.ts) and the minutes reader (lib/planUtil.ts) both read
// pasted lines through lib/blocks.ts.

const AS_OF = '2026-10-09'; // a Friday
const people = [{ id: 'm', name: 'Meera Iyer' }, { id: 'k', name: 'Kabir Sethi' }, { id: 'a', name: 'Ananya Rao' }, { id: 'j', name: 'Jeevan' }];
const projects = [{ id: 'l', name: 'Autumn landing page' }, { id: 'v', name: 'Vendor onboarding' }];
const ctx = { today: AS_OF, people, projects, meName: 'Meera Iyer' };
const tasks = (t: string) => readTasksRules(t, ctx);
const brief = (t: string) => tasks(t).map((r) => ({ title: r.title, ownerId: r.ownerId, dueOn: r.dueOn, projectId: r.projectId, details: r.details ?? '' }));

describe('reading pasted lines into blocks', () => {
  it('keeps a plain list as one block per line', () => {
    expect(readBlocks('Kabir to share the margin\nAnanya to call the vendor').map((b) => b.text))
      .toEqual(['Kabir to share the margin', 'Ananya to call the vendor']);
  });

  it('drops greetings, labels and sign-offs', () => {
    const b = readBlocks('Hi team, quick notes from today.\nAttendees: Meera, Kabir, Ananya\nAgenda\n- Kabir to share the margin by Friday\n- Ananya to call the vendor\nThanks all!');
    expect(b.map((x) => x.text)).toEqual(['Kabir to share the margin by Friday', 'Ananya to call the vendor']);
  });

  it('joins a sentence wrapped across lines', () => {
    expect(readBlocks('Kabir to send the updated design files for the\nAutumn landing page by Monday').map((b) => b.text))
      .toEqual(['Kabir to send the updated design files for the Autumn landing page by Monday']);
  });

  it('makes sub-bullets details of the task above them', () => {
    const b = readBlocks('- Kabir to prepare the vendor review by Friday\n  - pull last month\'s numbers\n  - list the open invoices\n- Ananya to book the studio');
    expect(b).toEqual([
      expect.objectContaining({ text: 'Kabir to prepare the vendor review by Friday', details: ["pull last month's numbers", 'list the open invoices'] }),
      expect.objectContaining({ text: 'Ananya to book the studio', details: [] }),
    ]);
  });

  it('gives a heading to the lines under it, with or without a colon', () => {
    expect(readBlocks('Autumn landing page:\n- fix the hero image\n- check the copy').map((b) => [b.text, b.heading]))
      .toEqual([['fix the hero image', 'Autumn landing page'], ['check the copy', 'Autumn landing page']]);
    expect(readBlocks('**Kabir Sethi**\n- send the margin sheet').map((b) => b.heading)).toEqual(['Kabir Sethi']);
    expect(readBlocks('Vendor onboarding\n  - draft the contract').map((b) => b.heading)).toEqual(['Vendor onboarding']);
  });

  it('makes a plain statement after a task a detail, not a task', () => {
    const b = readBlocks('Kabir to send the deck by Friday\nThe vendor said the price went up last week.\nAnanya to book the studio');
    expect(b.map((x) => [x.text, x.details])).toEqual([
      ['Kabir to send the deck by Friday', ['The vendor said the price went up last week.']],
      ['Ananya to book the studio', []],
    ]);
  });

  it('reads a shared date line for the tasks around it', () => {
    const b = readBlocks('Kabir to send the deck\nAnanya to call the vendor\nAll by Friday');
    expect(b.map((x) => [x.text, x.due])).toEqual([['Kabir to send the deck', 'by Friday'], ['Ananya to call the vendor', 'by Friday']]);
  });

  it('keeps a list of short items with no verbs as tasks', () => {
    expect(readBlocks('Vendor invoices\nStudio booking\nHero image').map((b) => b.text)).toEqual(['Vendor invoices', 'Studio booking', 'Hero image']);
  });
});

describe('Quick Add with pasted notes', () => {
  it('a project heading names the project for each task under it', () => {
    expect(brief('Autumn landing page:\n- Kabir to fix the hero image by Monday\n- Ananya to check the copy')).toEqual([
      { title: 'Fix the hero image', ownerId: 'k', dueOn: '2026-10-12', projectId: 'l', details: '' },
      { title: 'Check the copy', ownerId: 'a', dueOn: null, projectId: 'l', details: '' },
    ]);
  });

  it('a name heading owns the tasks under it', () => {
    expect(brief('Kabir:\n- send the margin sheet\n- call the vendor by Friday').map((r) => [r.title, r.ownerId, r.dueOn]))
      .toEqual([['Send the margin sheet', 'k', null], ['Call the vendor', 'k', '2026-10-16']]);
  });

  it('sub-bullets become the details of one task', () => {
    const r = brief('- Kabir to prepare the vendor review by Friday\n  - pull last month\'s numbers\n  - list the open invoices\n- Ananya to book the studio');
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ title: 'Prepare the vendor review', ownerId: 'k', details: "Pull last month's numbers\nList the open invoices" });
  });

  it('a wrapped line is one task', () => {
    expect(brief('Kabir to send the updated design files for the\nAutumn landing page by Monday'))
      .toEqual([{ title: 'Send the updated design files', ownerId: 'k', dueOn: '2026-10-12', projectId: 'l', details: '' }]);
  });

  it('greetings, labels and thanks give no tasks', () => {
    expect(brief('Hi team, quick notes from today.\nAttendees: Meera, Kabir, Ananya\n- Kabir to share the margin by Friday\n- Ananya to call the vendor\nThanks all!').map((r) => r.title))
      .toEqual(['Share the margin', 'Call the vendor']);
  });

  it('"all by Friday" dates every task without its own date', () => {
    expect(brief('Kabir to send the deck\nAnanya to call the vendor by Monday\nAll by Friday').map((r) => r.dueOn)).toEqual(['2026-10-16', '2026-10-12']);
  });

  it('"he should also" keeps the owner from the task before', () => {
    expect(brief('Kabir to send the deck by Friday. He should also call the vendor.').map((r) => [r.title, r.ownerId]))
      .toEqual([['Send the deck', 'k'], ['Call the vendor', 'k']]);
  });

  it('a statement after a task is a detail', () => {
    const r = brief('Kabir to send the deck by Friday. The vendor wants it before the board meets.\nAnanya to book the studio');
    expect(r.map((x) => [x.title, x.details])).toEqual([['Send the deck', 'The vendor wants it before the board meets.'], ['Book the studio', '']]);
  });

  it('a real list still splits, and one line is still one task', () => {
    expect(brief('1. Kabir to share the margin\n2. Ananya to call the vendor\n3. Jeevan to book the studio')).toHaveLength(3);
    expect(brief('send the deck and then the prices to Kabir by Friday')).toHaveLength(1);
  });

  it('a full meeting paste gives the tasks in it and nothing else', () => {
    const paste = [
      'Notes from Monday sync',
      'Attendees: Meera, Kabir, Ananya, Jeevan',
      '',
      'Autumn landing page',
      '- Kabir to fix the hero image by Wednesday',
      '  - the crop is off on mobile',
      '- Ananya to rewrite the intro copy',
      '',
      'Vendor onboarding:',
      '- Jeevan to draft the contract. The vendor agreed to net 30.',
      '- I need to sign off the budget by Friday',
      '',
      'Thanks all!',
    ].join('\n');
    expect(brief(paste)).toEqual([
      { title: 'Fix the hero image', ownerId: 'k', dueOn: '2026-10-14', projectId: 'l', details: 'The crop is off on mobile' },
      { title: 'Rewrite the intro copy', ownerId: 'a', dueOn: null, projectId: 'l', details: '' },
      { title: 'Draft the contract', ownerId: 'j', dueOn: null, projectId: 'v', details: 'The vendor agreed to net 30.' },
      { title: 'Sign off the budget', ownerId: 'm', dueOn: '2026-10-16', projectId: 'v', details: '' },
    ]);
  });
});

describe('the minutes reader with notes that are not one step per line', () => {
  it('folds sub-bullets and statements into the step above', () => {
    const text = '### Next steps\n- (Kabir Sethi) Prepare the vendor review (Oct 14, 2026)\n  - pull last month\'s numbers\n  - list the open invoices\n- (Ananya Rao) Book the studio';
    expect(plainParse(nextStepsOf(text), AS_OF).map((s) => [s.owner, s.task, s.due])).toEqual([
      ['Kabir Sethi', "Prepare the vendor review: pull last month's numbers; list the open invoices", '2026-10-14'],
      ['Ananya Rao', 'Book the studio', ''],
    ]);
  });

  it('joins wrapped lines and skips noise when there is no next steps heading', () => {
    const text = 'Hi all, notes from the vendor call.\nAttendees: Kabir, Ananya\nKabir to send the signed contract to the\nvendor by Oct 12\nAnanya to set up the supplier account\nThanks!';
    expect(plainParse(nextStepsOf(text), AS_OF).map((s) => [s.owner, s.task, s.due])).toEqual([
      ['Kabir', 'Send the signed contract to the vendor', '2026-10-12'],
      ['Ananya', 'Set up the supplier account', ''],
    ]);
  });

  it('a name heading owns the steps under it, and a pronoun keeps the owner', () => {
    const text = 'Action items\nKabir Sethi:\n- Share the margin sheet\n- He should also chase the invoices';
    expect(plainParse(nextStepsOf(text), AS_OF).map((s) => [s.owner, s.task])).toEqual([
      ['Kabir Sethi', 'Share the margin sheet'], ['Kabir Sethi', 'Chase the invoices'],
    ]);
  });
});
