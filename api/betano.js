// Vercel Function (Node, gru1) — proxy de cuotas públicas de Betano Colombia.
//
// OJO (2026-10-10): Betano/Cloudflare responde 403 a cualquier IP fuera de
// Colombia (probado desde iad1 y gru1 con cabeceras idénticas a Chrome; desde
// Colombia con curl responde 200). Este endpoint queda por si algún día abre;
// mientras tanto la app usa primero el relé local scripts/betano-relay.mjs
// (corre en el PC de Carlos) — misma lógica, ver api/_betano-core.js.
//
// Uso:  /api/betano?liga=1            → { ok, eventos:[...] }
//       /api/betano?evento=/cuotas-de-partido/x-y/91655509/ → { ok, evento, mercados:[...] }
//       /api/betano?debug=1           → región, cabeceras que salen y status de Betano

import { resolver, fetchBetano, cabeceras } from './_betano-core.js'

export default async function handler(req, res) {
  const { searchParams } = new URL(req.url, 'http://x')
  const json = (data, status = 200, sMaxAge = 0) => {
    res.setHeader('Content-Type', 'application/json')
    // CORS abierto: datos públicos; permite usar el proxy de producción desde el dev local
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', sMaxAge ? `s-maxage=${sMaxAge}, stale-while-revalidate=120` : 'no-store')
    res.status(status).send(JSON.stringify(data))
  }

  if (searchParams.get('debug')) {
    try {
      const eco = await fetch('https://httpbin.org/anything', { headers: cabeceras() }).then(r => r.json()).catch(e => ({ error: e.message }))
      const b = await fetchBetano('/api/sport/futbol/ligas/x/1/?req=la,s,stnf,c,mb')
      return json({ ok: true, region: process.env.VERCEL_REGION, eco: { origin: eco.origin, headers: eco.headers }, betano: { status: b.status, server: b.headers.get('server'), ray: b.headers.get('cf-ray') } })
    } catch (e) { return json({ ok: false, error: e.message }) }
  }

  const r = await resolver(searchParams)
  return json(r.body, r.status, r.sMaxAge ?? 0)
}
