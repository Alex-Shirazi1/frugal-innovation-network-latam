import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Frontend talks to the prototype backend through this proxy in dev,
    // so the app and any future real backend share the same /api contract.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
