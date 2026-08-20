import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function resolveAppVersion(): string {
  if (process.env.VITE_APP_VERSION?.trim()) return process.env.VITE_APP_VERSION.trim()
  if (process.env.APP_VERSION?.trim()) return process.env.APP_VERSION.trim()
  try {
    return execSync('git describe --tags --always --dirty', { encoding: 'utf8' }).trim()
  } catch {
    return 'dev'
  }
}

process.env.VITE_APP_VERSION = resolveAppVersion()

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.BACKEND_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
