import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'child_process';

// Get git hash at build time (from env var or git)
function getGitHash(): string {
  if (process.env.VITE_GIT_HASH && process.env.VITE_GIT_HASH !== 'unknown') {
    return process.env.VITE_GIT_HASH;
  }
  try {
    // a fixed path, not PATH (Sonar S4036); Woodpecker passes the commit through VITE_GIT_HASH anyway
    return execFileSync('/usr/bin/git', ['rev-parse', '--short', 'HEAD']).toString().trim();
  } catch {
    return 'unknown';
  }
}

// Get build timestamp (from env var or current time)
function getBuildTime(): string {
  return process.env.VITE_BUILD_TIME || new Date().toISOString();
}

export default defineConfig({
  plugins: [react()],
  define: {
    __GIT_HASH__: JSON.stringify(getGitHash()),
    __BUILD_TIME__: JSON.stringify(getBuildTime()),
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // vite 8 bundles with rolldown, which takes manualChunks as a function only (the object form: "manualChunks is
        // not a function"); the same two chunks, each package's own dependencies with it as the object form grouped them
        manualChunks(id: string) {
          if (
            /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(
              id,
            )
          ) {
            return 'vendor-react';
          }
          if (/[\\/]node_modules[\\/](recharts|d3-[a-z-]+|victory-vendor)[\\/]/.test(id)) {
            return 'vendor-charts';
          }
          return undefined;
        },
      },
    },
  },
});
