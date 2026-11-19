import { describe, expect, it } from 'vitest';
import { readTasksRules } from '../lib/sentence';

// Two sentences said in one go (20 Nov, the PM's report): an add-on sentence is the task's details, not a second task,
// and speech without full stops still finds the date.
const ctx = { people: [{ id: 'p1', name: 'Aashi Raghuwanshi' }, { id: 'p2', name: 'Kabir Sethi' }, { id: 'me', name: 'Khushi Kedia' }],
  projects: [{ id: 'j1', name: 'NicoWrap' }], today: '2026-11-20', meName: 'Khushi Kedia' };
const read = (s: string) => readTasksRules(s, ctx).map((r) => ({ title: r.title, owner: r.ownerId, due: r.dueOn, details: r.details ?? '' }));

describe('a task said in two sentences', () => {
  it('keeps an add-on sentence as the details', () => {
    expect(read('Ask Aashi to send the deck by Monday. It needs the new prices.')).toEqual([{ title: 'Send the deck', owner: 'p1', due: '2026-11-23', details: 'It needs the new prices.' }]);
    expect(read('Kabir should finalise the NicoWrap budget by Friday. We discussed this in the meeting yesterday.')[0].details).toBe('We discussed this in the meeting yesterday.');
    expect(read('Aashi needs to send the deck by Monday. Make sure it has the new prices')).toHaveLength(1);
  });
  it('reads speech with no full stops', () => {
    expect(read('ask aashi to send the deck by monday it needs the new prices')).toEqual([{ title: 'Send the deck', owner: 'p1', due: '2026-11-23', details: 'It needs the new prices' }]);
  });
  it('still makes two tasks when the second is a new ask', () => {
    const two = read('Ask Aashi to send the deck by Monday. Kabir, can you book the studio by Friday?');
    expect(two.map((t) => t.owner)).toEqual(['p1', 'p2']);
  });
});
