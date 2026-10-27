import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': import.meta.dirname } },
  // "Today" is the fixtures' as-of date, so seeding shifts nothing (lib/shift.ts).
  test: { testTimeout: 30000, hookTimeout: 30000, include: ['tests/**/*.test.ts'], env: { NICO_TODAY: '2026-10-09' } },
});
