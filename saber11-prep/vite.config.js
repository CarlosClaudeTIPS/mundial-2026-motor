import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

// PWA: la app se instala en el celular y el "cascarón" (HTML/JS/CSS) queda en
// caché. Los datos (preguntas, respuestas) viven en IndexedDB (ver src/lib/db.js),
// así que la práctica funciona sin conexión y se sincroniza después.
//
// Rendimiento: el banco de preguntas (content/banco/*.json, ~5 MB) NO va en el
// paquete inicial. Cada archivo es un trozo aparte que se descarga bajo demanda
// la primera vez (o cuando cambia su contenido) y se vuelca a IndexedDB en
// segundo plano. __BANCO_VERSION__ es una huella del contenido calculada aquí,
// al compilar, para saber si hace falta volver a descargarlo sin abrir los trozos.
const carpetaBanco = resolve(__dirname, 'content/banco')
const archivosBanco = readdirSync(carpetaBanco).filter(f => f.endsWith('.json')).sort()
// Conteo de preguntas por prueba (para la portada), calculado aquí para no cargar el banco al entrar.
const conteoBanco = {}
for (const f of archivosBanco) { const j = JSON.parse(readFileSync(resolve(carpetaBanco, f), 'utf8')); for (const p of (Array.isArray(j) ? j : j.preguntas ?? [])) if ((p.estado ?? 'aprobada') === 'aprobada') conteoBanco[p.prueba] = (conteoBanco[p.prueba] ?? 0) + 1 }
const versionBanco = createHash('sha1').update(readdirSync(carpetaBanco).filter(f => f.endsWith('.json')).sort().map(f => f + readFileSync(resolve(carpetaBanco, f))).join('\n')).digest('hex').slice(0, 12)

export default defineConfig({
  define: { __BANCO_VERSION__: JSON.stringify(versionBanco), __BANCO_CONTEO__: JSON.stringify(conteoBanco) },
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
        background_color: '#F4F7FC',
        theme_color: '#1FA9EC',
        icons: [
          { src: 'icono.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Los trozos del banco y del lector de PDF no se precargan: el banco queda en IndexedDB
        // tras la siembra y el PDF solo lo usa el docente al importar. Si se piden, se cachean.
        // El portal (/portal/: portada, Apoyo docente, Tienda) es estático y no es parte de la PWA.
        globIgnores: ['**/banco-*.js', '**/pdf*.js', '**/pdf*.mjs', 'portal/**'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/portal(\/|$)/, /^\/api\//],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [{ urlPattern: ({ url }) => /\/assets\/(banco-|pdf)/.test(url.pathname), handler: 'CacheFirst', options: { cacheName: 'trozos-bajo-demanda', expiration: { maxEntries: 40, maxAgeSeconds: 60 * 24 * 3600 } } }],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/content/banco/')) return 'banco-' + id.split('/').pop().replace(/\.json$/, '').replace(/[^a-z0-9_-]/gi, '')
          if (id.includes('/content/guia/')) return 'guia-datos'
          if (id.includes('/content/futuro/')) return 'futuro-datos'
        },
      },
    },
  },
  server: { port: 5180 },
})
