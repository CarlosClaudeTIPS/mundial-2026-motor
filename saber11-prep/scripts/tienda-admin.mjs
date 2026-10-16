// Panel de administración de la tienda: SOLO en tu computador.
// El panel no se publica en el sitio; este servidor lo sirve en localhost
// junto con los archivos de la tienda (public/portal/tienda) y la barra
// común (public/portal/shared). Uso:  npm run tienda-admin
import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = fileURLToPath(new URL('..', import.meta.url))
const PUERTO = Number(process.env.PUERTO || 5555)
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.pdf': 'application/pdf', '.txt': 'text/plain' }

async function existe(p) { try { return (await stat(p)).isFile() } catch { return false } }

const server = http.createServer(async (req, res) => {
  let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (ruta.endsWith('/')) ruta += 'index.html'
  ruta = normalize(ruta).replace(/^(\.\.[/\\])+/, '')
  // Primero el panel (archivos privados), luego la tienda publicada.
  const candidatos = ruta.startsWith('/shared/')
    ? [join(raiz, 'public/portal', ruta)]
    : [join(raiz, 'herramientas/tienda-admin', ruta), join(raiz, 'public/portal/tienda', ruta)]
  for (const c of candidatos) {
    if (!c.startsWith(raiz) || !(await existe(c))) continue
    res.writeHead(200, { 'Content-Type': TIPOS[extname(c)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' })
    return res.end(await readFile(c))
  }
  res.writeHead(404); res.end('No encontrado')
})
server.listen(PUERTO, '127.0.0.1', () => {
  console.log(`\nPanel de la tienda (solo en este computador):\n  http://localhost:${PUERTO}/admin.html\n\nCuando termines: descarga catalogo.json y config.json desde el panel,\nreemplázalos en public/portal/tienda/data/ y publica. Ctrl+C para cerrar.\n`)
})
