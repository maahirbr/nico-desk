import { describe, expect, it } from 'vitest';
import { roleFor } from '../components/OwnerPicker';

// 18 Nov, from a pilot teammate's feedback: someone joining a project starts with their Roster job title as their role.
describe('a new project role starts as the job title', () => {
  const people = [
    { id: 'a', name: 'A', role: 'Merchandiser' },
    { id: 'b', name: 'B', role: 'Visual Designer' },
    { id: 'c', name: 'C', role: '' },
    { id: 'd', name: 'D', role: 'x'.repeat(80) },
  ];
  it('fills an empty role with the picked person\'s title', () => {
    expect(roleFor(people, '', '', 'a')).toBe('Merchandiser');
    expect(roleFor(people, '  ', '', 'b')).toBe('Visual Designer');
  });
  it('swaps the last person\'s title for the new one, but keeps a role someone typed', () => {
    expect(roleFor(people, 'Merchandiser', 'a', 'b')).toBe('Visual Designer');
    expect(roleFor(people, 'Sourcing', 'a', 'b')).toBe('Sourcing');
  });
  it('leaves the role empty when there is no title, and clips a long one to 60', () => {
    expect(roleFor(people, 'Merchandiser', 'a', 'c')).toBe('');
    expect(roleFor(people, '', '', 'zzz')).toBe('');
    expect(roleFor(people, '', '', 'd')).toHaveLength(60);
  });
});
