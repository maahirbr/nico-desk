import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {}, push() {} }), usePathname: () => '/', useSearchParams: () => new URLSearchParams() }));

import { CLEAR_LINES, clearLine } from '../components/HomeView';

// With nothing open, Home shows one of five lines: the same all day for a person, and it moves with the day (30 Oct).
describe('the all clear line', () => {
  it('stays the same for a person all day, and comes from the list', () => {
    expect(clearLine('per_a', '2026-10-30')).toBe(clearLine('per_a', '2026-10-30'));
    expect(CLEAR_LINES).toContain(clearLine('per_a', '2026-10-30'));
  });
  it('changes across days, so it stays a surprise', () => {
    const days = Array.from({ length: 14 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);
    expect(new Set(days.map((d) => clearLine('per_a', d))).size).toBeGreaterThan(2);
  });
});
