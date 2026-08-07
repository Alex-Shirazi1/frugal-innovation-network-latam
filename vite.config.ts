import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Frontend talks to the local dev backend through this proxy, so the app
    // and any future real backend share the same /api contract.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  test: {
    /**
     * Split by runtime, because the two halves genuinely differ.
     *
     * The server suites import node builtins (node:sqlite, node:fs). Running
     * them under jsdom made Vite treat them as client code and try to *bundle*
     * `node:sqlite`, which failed on Node 22 — where it is not yet listed in
     * module.builtinModules — while passing on Node 23 where it is. That made
     * the whole thing pass locally and break in CI.
     */
    projects: [
      {
        extends: true,
        test: {
          name: 'web',
          include: ['src/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: './src/test/setup.ts',
          globals: true,
        },
      },
      {
        extends: true,
        test: {
          name: 'server',
          include: ['server/**/*.test.ts'],
          environment: 'node',
          globals: true,
        },
      },
    ],
  },
})
