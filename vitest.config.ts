import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    exclude: ['tests/**', 'node_modules/**'],
  },
  define: {
    __GIT_HASH__: JSON.stringify('abc1234'),
    __BUILD_TIME__: JSON.stringify('2025-01-15T10:30:00Z'),
  },
})
