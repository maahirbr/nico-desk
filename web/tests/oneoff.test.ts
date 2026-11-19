import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {}, push() {} }), usePathname: () => '/', useSearchParams: () => new URLSearchParams() }));

import { oneOffWord } from '../components/task-ui';

// A task on no project says so, and who gave it (19 Nov, the PM's call).
describe('the one-off label', () => {
  const names = { me: 'Khushi K', sa: 'Sachin S' };
  it('names who gave it, or you', () => {
    expect(oneOffWord({ projectId: null, createdBy: 'me', ownerId: 'sa' }, names, 'sa')).toBe('One-off · from Khushi');
    expect(oneOffWord({ projectId: null, createdBy: 'me', ownerId: 'sa' }, names, 'me')).toBe('One-off · from you');
  });
  it('is plain for your own, and empty on a project', () => {
    expect(oneOffWord({ projectId: null, createdBy: 'sa', ownerId: 'sa' }, names, 'sa')).toBe('One-off');
    expect(oneOffWord({ projectId: 'p1', createdBy: 'me', ownerId: 'sa' }, names, 'sa')).toBe('');
  });
});
