import { describe, expect, it } from 'vitest';
import { describeQuick, parseQuickAdd, pickHeard, respell, soundKey } from '../lib/quickadd';

// The quick-add line: title, due date, @owner and #project. Wednesday 7 Oct 2026 unless a test says otherwise.

const WED = '2026-10-07';
const FRI = '2026-10-09';
const people = [
  { id: 'p1', name: 'Ada Rao' }, { id: 'p2', name: 'Sam Iyer' }, { id: 'p3', name: 'Asha Nair' }, { id: 'p4', name: 'Ashok Pillai' },
  { id: 'p5', name: 'Sam Verma' }, { id: 'p6', name: 'Mira Kapoor' },
];
const projects = [{ id: 'j1', name: 'Spring hamper' }, { id: 'j2', name: 'Spring lookbook' }, { id: 'j3', name: 'Launch' }, { id: 'j4', name: 'Vendor onboarding' }];
const parse = (s: string, today = WED) => parseQuickAdd(s, { today, people, projects });

describe('title and due date', () => {
  it('takes a weekday at the end', () => {
    const p = parse('Send deck to vendor fri');
    expect(p.title).toBe('Send deck to vendor');
    expect(p.dueOn).toBe('2026-10-09');
  });
  it('reads today, tomorrow, and a bare weekday as the next one after today', () => {
    expect(parse('Pay invoice today').dueOn).toBe(WED);
    expect(parse('Pay invoice tomorrow').dueOn).toBe('2026-10-08');
    expect(parse('Pay invoice wed').dueOn).toBe('2026-10-14');
    expect(parse('Pay invoice friday', FRI).dueOn).toBe('2026-10-16');
    expect(parse('Pay invoice mon', FRI).dueOn).toBe('2026-10-12');
  });
  it('reads next weekday as the one in the following week', () => {
    expect(parse('Plan offsite next fri').dueOn).toBe('2026-10-16');
    expect(parse('Plan offsite next mon').dueOn).toBe('2026-10-12');
  });
  it('reads day and month in either order, with a suffix, a long month or a year', () => {
    for (const s of ['Book venue 24 Oct', 'Book venue 24th October', 'Book venue Oct 24', 'Book venue 24 oct 2026', 'Book venue 2026-10-24']) {
      const p = parse(s);
      expect(p.dueOn, s).toBe('2026-10-24');
      expect(p.title, s).toBe('Book venue');
    }
  });
  it('rolls a day that has passed to next year, and refuses a day that does not exist', () => {
    expect(parse('Renew licence 3 Mar').dueOn).toBe('2027-03-03');
    expect(parse('Renew licence 30 Feb').dueOn).toBeNull();
    expect(parse('Renew licence 30 Feb').title).toBe('Renew licence 30 Feb');
  });
  it('drops "by", "on" and "due" in front of the date', () => {
    expect(parse('Send deck by fri').title).toBe('Send deck');
    expect(parse('Send deck due on 24 Oct').title).toBe('Send deck');
  });
  it('leaves date-like words inside the title alone', () => {
    const a = parse('Plan the Friday launch');
    expect(a.title).toBe('Plan the Friday launch');
    expect(a.dueOn).toBeNull();
    expect(parse('Review sun cream samples').dueOn).toBeNull();
    expect(parse('Review the mon').dueOn).toBeNull();
    expect(parse('Order 24 oct packs for the sale').dueOn).toBeNull();
  });
  it('keeps a title when the line is only a date', () => {
    const p = parse('fri');
    expect(p.dueOn).toBeNull();
    expect(p.title).toBe('fri');
  });
  it('takes the date even when an @ or # word comes after it', () => {
    const p = parse('Send deck fri @ada #launch');
    expect(p.title).toBe('Send deck');
    expect(p.dueOn).toBe('2026-10-09');
  });
  it('gives back a plain title when nothing special is typed', () => {
    const p = parse('Approve hamper samples');
    expect(p).toMatchObject({ title: 'Approve hamper samples', dueOn: null, owner: null, project: null });
  });
});

describe('@owner', () => {
  it('matches a first name and removes the word from the title', () => {
    const p = parse('Send deck @ada');
    expect(p.owner).toMatchObject({ status: 'matched', item: { id: 'p1' } });
    expect(p.title).toBe('Send deck');
  });
  it('is not case sensitive, and the @ word can sit in the middle', () => {
    const p = parse('Send @MIRA the deck');
    expect(p.owner).toMatchObject({ status: 'matched', item: { id: 'p6' } });
    expect(p.title).toBe('Send the deck');
  });
  it('prefers a whole first name over a longer one that starts with it', () => {
    expect(parse('Do it @asha').owner).toMatchObject({ status: 'matched', item: { id: 'p3' } });
  });
  it('is ambiguous when two people fit, and keeps the word in the title', () => {
    const p = parse('Do it @sam');
    expect(p.owner).toMatchObject({ status: 'ambiguous' });
    expect((p.owner as { items: unknown[] }).items).toHaveLength(2);
    expect(p.title).toBe('Do it @sam');
    expect(parse('Do it @ash').owner).toMatchObject({ status: 'ambiguous' });
  });
  it('can use a last name or more of the name to tell two apart', () => {
    expect(parse('Do it @verma').owner).toMatchObject({ status: 'matched', item: { id: 'p5' } });
    expect(parse('Do it @samiyer').owner).toMatchObject({ status: 'matched', item: { id: 'p2' } });
  });
  it('reports no match and leaves the word in the title', () => {
    const p = parse('Do it @zed');
    expect(p.owner).toMatchObject({ status: 'none', word: 'zed' });
    expect(p.title).toBe('Do it @zed');
  });
  it('ignores an email address and a lone @', () => {
    expect(parse('Mail ada@example.com now').owner).toBeNull();
    expect(parse('Meet @ noon').owner).toBeNull();
  });
  it('strips punctuation after the word', () => {
    expect(parse('Ask @ada, then ship').owner).toMatchObject({ status: 'matched', item: { id: 'p1' } });
  });
});

describe('#project', () => {
  it('matches by the start of the name, or by one word of it', () => {
    expect(parse('Draft copy #launch').project).toMatchObject({ status: 'matched', item: { id: 'j3' } });
    expect(parse('Draft copy #onboarding').project).toMatchObject({ status: 'matched', item: { id: 'j4' } });
    expect(parse('Draft copy #hamper').project).toMatchObject({ status: 'matched', item: { id: 'j1' } });
  });
  it('matches a whole name written with a hyphen', () => {
    expect(parse('Draft copy #spring-hamper').project).toMatchObject({ status: 'matched', item: { id: 'j1' } });
  });
  it('is ambiguous when two projects fit', () => {
    const p = parse('Draft copy #spring');
    expect(p.project).toMatchObject({ status: 'ambiguous' });
    expect(p.title).toBe('Draft copy #spring');
  });
  it('leaves a hashtag that is not a project in the title', () => {
    const p = parse('Fix item #12');
    expect(p.project).toMatchObject({ status: 'none' });
    expect(p.title).toBe('Fix item #12');
  });
});

describe('the whole line', () => {
  it('fills all four', () => {
    const p = parse('Send deck to vendor fri @sam.iyer #launch');
    expect(p.owner).toMatchObject({ status: 'matched', item: { id: 'p2' } });
    const q = parse('Send deck to vendor fri @samiyer #launch');
    expect(q.title).toBe('Send deck to vendor');
    expect(q.dueOn).toBe('2026-10-09');
    expect(q.owner).toMatchObject({ status: 'matched', item: { id: 'p2' } });
    expect(q.project).toMatchObject({ status: 'matched', item: { id: 'j3' } });
  });
  it('describes what it found for the preview', () => {
    expect(describeQuick(parse('Send deck fri @ada #launch'))).toEqual(['Due 9 Oct', 'Owner Ada Rao', 'Project Launch']);
    expect(describeQuick(parse('Send deck @zed #spring'))).toEqual(['No one matches @zed', '#spring fits Spring hamper and Spring lookbook, so pick one']);
    expect(describeQuick(parse('Send deck'))).toEqual([]);
  });
  it('handles empty input and extra spaces', () => {
    expect(parse('').title).toBe('');
    expect(parse('   Send   deck   fri  ').title).toBe('Send deck');
  });
});

describe('names as speech spells them', () => {
  const roster = ['Kabir Sethi', 'Shreya Iyer', 'Meera Rao', 'Ishaan Bhatt', 'Vivek Nair'];

  it('gives the common Indian spellings of one name one sound', () => {
    expect(soundKey('Kabeer')).toBe(soundKey('Kabir'));
    expect(soundKey('Sreya')).toBe(soundKey('Shreya'));
    expect(soundKey('Mira')).toBe(soundKey('Meera'));
    expect(soundKey('Ishan')).toBe(soundKey('Ishaan'));
    expect(soundKey('Wivek')).toBe(soundKey('Vivek'));
    expect(soundKey('Kabir')).not.toBe(soundKey('Kavya'));
  });

  it('respells a heard name to the roster, and leaves other words and exact names alone', () => {
    expect(respell('ask Kabeer to send Sreya the deck', roster)).toBe('ask Kabir to send Shreya the deck');
    expect(respell('ask Kabir and Mira to call', roster)).toBe('ask Kabir and Meera to call');
    expect(respell('send the files by Monday', roster)).toBe('send the files by Monday');
    expect(respell('ask kabeer to call', roster)).toBe('ask kabeer to call'); // lower case: not written as a name
    expect(respell('I am seeing the vendor about the bath fittings', ['Arjun Singh', 'Ishaan Bhatt'])).toBe('I am seeing the vendor about the bath fittings');
  });

  it('leaves a sound alone when two roster spellings share it', () => {
    expect(respell('ask Mira to call', ['Meera Rao', 'Mira Nair'])).toBe('ask Mira to call');
  });

  it('picks the speech guess that holds a roster name, else the first', () => {
    expect(pickHeard(['ask cab here to send the deck', 'ask Kabeer to send the deck'], roster)).toBe('ask Kabeer to send the deck');
    expect(pickHeard(['send the deck', 'sent the deck'], roster)).toBe('send the deck');
    expect(pickHeard([], roster)).toBe('');
  });
});
