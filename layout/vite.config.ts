import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/** Serves the layout harness (layout/index.html) with the app's own sources; the build-time constants are fixed. */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  define: { __GIT_HASH__: JSON.stringify('layout'), __BUILD_TIME__: JSON.stringify('layout') },
  server: {
    port: 5199,
    strictPort: true,
    fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
  },
});
