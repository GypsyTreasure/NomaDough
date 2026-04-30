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
    // iife bundles all imports into the worker file and enables importScripts()
    // which is required for loading OpenCV.js in the CV worker
    format: 'iife',
  },
  optimizeDeps: {
    exclude: ['opencv.js'],
  },
  build: {
    chunkSizeWarningLimit: 2000,
  },
})
