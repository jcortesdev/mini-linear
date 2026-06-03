import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Co-located unit tests live next to the code under src/. Playwright tests
    // live under tests/ and use a different runner.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
