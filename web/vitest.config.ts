import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': import.meta.dirname } },
  test: { testTimeout: 30000, hookTimeout: 30000, include: ['tests/**/*.test.ts'] },
});
