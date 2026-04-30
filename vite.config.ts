import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  // GitHub Pages serves from /NomaDough/ — set base accordingly
  base: process.env.NODE_ENV === 'production' ? '/NomaDough/' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['opencv.js'],
  },
  build: {
    chunkSizeWarningLimit: 2000,
  },
})
