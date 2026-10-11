// Relé local de cuotas de Betano Colombia.
//
// Betano solo responde a IPs colombianas, así que el proxy de Vercel (EE. UU. /
// Brasil) recibe 403. Este script corre en el PC de Carlos y la app (en
// motor-apuestas-xi.vercel.app o en localhost:5173) le pide las cuotas a
// http://localhost:8787 — el navegador permite llamar a localhost desde una
// página https. Si el relé no está encendido, la app sigue con cuotas estimadas.
//
// Arrancar:   npm run betano        (déjalo abierto mientras analizas)
// Probar:     http://localhost:8787/api/betano?liga=1

import http from 'node:http'
import { resolver } from '../api/_betano-core.js'

const PORT = Number(process.env.BETANO_RELAY_PORT || 8787)
const cache = new Map() // url → { ts, ttl, body }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  if (url.pathname === '/ping') { res.end(JSON.stringify({ ok: true, relay: 'betano', ts: Date.now() })); return }
  if (url.pathname !== '/api/betano') { res.writeHead(404); res.end(JSON.stringify({ ok: false, error: 'ruta' })); return }

  const key = url.search
  const hit = cache.get(key)
  if (hit && Date.now() - hit.ts < hit.ttl) { res.end(hit.body); return }

  const t0 = Date.now()
  const r = await resolver(url.searchParams)
  const body = JSON.stringify(r.body)
  if (r.body?.ok && r.sMaxAge) cache.set(key, { ts: Date.now(), ttl: r.sMaxAge * 1000, body })
  res.writeHead(r.status)
  res.end(body)
  const que = url.searchParams.get('liga') ? `liga ${url.searchParams.get('liga')}` : `evento ${url.searchParams.get('evento')}`
  const resumen = r.body?.ok ? (r.body.eventos ? `${r.body.eventos.length} partidos` : `${r.body.mercados?.length ?? 0} mercados`) : `ERROR ${r.body?.error}`
  console.log(`${new Date().toLocaleTimeString()}  ${que} → ${resumen} (${Date.now() - t0} ms)`)
})

server.listen(PORT, () => {
  console.log(`🎰 Relé Betano escuchando en http://localhost:${PORT}`)
  console.log('   Deja esta ventana abierta mientras usas la app. Ctrl+C para cerrar.')
})
