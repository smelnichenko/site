import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

// Get git hash at build time (from env var or git)
function getGitHash(): string {
  if (process.env.VITE_GIT_HASH && process.env.VITE_GIT_HASH !== 'unknown') {
    return process.env.VITE_GIT_HASH
  }
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'unknown'
  }
}

// Get build timestamp (from env var or current time)
function getBuildTime(): string {
  return process.env.VITE_BUILD_TIME || new Date().toISOString()
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
  },
})
