/// <reference types="node" />

import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const frontendPort = Number(process.env.FRONTEND_PORT) || 5173

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  define: {
    'import.meta.env.VITE_QUICKGRAPH_ADAPTER': JSON.stringify('browser'),
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { port: frontendPort },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    testTimeout: 20000,
  },
})
