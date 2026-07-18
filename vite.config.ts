/// <reference types="node" />

import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const frontendPort = Number(process.env.FRONTEND_PORT) || 5173
const backendPort = Number(process.env.BACKEND_PORT) || 8011

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    port: frontendPort,
    proxy: { '/api': { target: `http://127.0.0.1:${backendPort}`, changeOrigin: true } },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    // fake-indexeddb and the full App mount can exceed the 5s default under
    // parallel CPU load, which showed up as flaky timeouts. Give real headroom.
    testTimeout: 20000,
  },
})
