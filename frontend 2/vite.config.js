// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// 🔧 Fix for __dirname in ES module context
const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  build: {
    manifest: true,             // ✅ generate manifest.json for Django
    outDir: 'dist',             // ✅ output to frontend/dist
    emptyOutDir: true,          // ✅ clean old builds
    rollupOptions: {
      input: resolve(__dirname, 'src/main.jsx'), // ✅ match your actual entry
    },
  },
})