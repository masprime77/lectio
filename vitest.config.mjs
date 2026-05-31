import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Pure logic + filesystem layer run under Node (no DOM needed).
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // Measure the extracted, testable core logic.
      include: ['lib/**/*.js'],
      thresholds: {
        lines: 70,
        functions: 70,
      },
    },
  },
});
