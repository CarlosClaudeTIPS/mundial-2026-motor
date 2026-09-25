import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// PWA: la app se instala en el celular y el "cascarón" (HTML/JS/CSS) queda en
// caché. Los datos (preguntas, respuestas) viven en IndexedDB (ver src/lib/db.js),
// así que la práctica funciona sin conexión y se sincroniza después.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icono.svg'],
      manifest: {
        name: 'Saber 11 · Preparación',
        short_name: 'Saber 11',
        description: 'Preparación para la prueba Saber 11° del ICFES: práctica, retroalimentación y seguimiento.',
        lang: 'es-CO',
        start_url: '/',
        display: 'standalone',
        background_color: '#0F172A',
        theme_color: '#0F172A',
        icons: [
          { src: 'icono.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 5180 },
})
