import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

// Make built asset URLs start with /static/
export default defineConfig({
    plugins: [react()],
    base: '/static/',
    build: {
        outDir: 'dist',       // already your default
        assetsDir: 'assets',  // default; keep it explicit
        manifest: true,
        rollupOptions: {
            input: '/src/main.jsx',  // <-- critical for django-vite
        },
    }
})
