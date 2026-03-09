import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    exclude: ['tests/**', 'node_modules/**'],
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
})
