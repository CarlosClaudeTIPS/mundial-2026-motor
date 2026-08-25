import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Sofascore (saques de banda y portería) — el navegador no puede llamarlo
      // directo por CORS; en producción lo hace api/sofascore.js (Vercel)
      '/sofa': {
        target: 'https://api.sofascore.com',
        changeOrigin: true,
        rewrite: p => p.replace(/^\/sofa/, '/api/v1'),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
          'Referer': 'https://www.sofascore.com/',
          'Accept': 'application/json',
        },
      },
    },
  },
})
