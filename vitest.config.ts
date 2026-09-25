import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    // a test that takes 0.3 s here took over 5 s (the default) on a CI node still loaded from a restart (site pipeline
    // 162, 2026-09-25: the suite ran 402 s); room for a slow machine, never for a wrong answer
    testTimeout: 15_000,
    exclude: ['tests/**', 'layout/**', 'node_modules/**'], // tests/ and layout/ are Playwright's
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.test.*', 'src/vite-env.d.ts'],
    },
  },
  define: {
    __GIT_HASH__: JSON.stringify('abc1234'),
    __BUILD_TIME__: JSON.stringify('2025-01-15T10:30:00Z'),
  },
});
