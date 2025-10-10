// vite.config.js
import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    base: '',
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:8000',
                changeOrigin: true,
            },
        },
        
    },
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        manifest: true,
        rollupOptions: {
            input: '/src/main.jsx',
        },
    },
})
