// Vercel Edge Function — proxy de cuotas públicas de Betano Colombia
//
// Betano (betano.co) sirve su web desde JSON públicos sin login:
//   /api/sport/futbol/ligas/<slug>/<id>/?req=la,s,stnf,c,mb → partidos de una liga
//   /api/cuotas-de-partido/<slug>/<eventId>/?bt=13           → TODOS los mercados (pestaña "Todo")
// El navegador no puede llamarlos directo (CORS), así que pasan por aquí.
// Solo se reenvían mercados de EQUIPO/PARTIDO (nada de jugadores) para que la
// respuesta pese ~10 KB en vez de ~900 KB.
//
// Uso:  /api/betano?liga=1            → { ok, eventos:[{id,name,startTime,url,home,away}] }
//       /api/betano?evento=/cuotas-de-partido/x-y/91655509/ → { ok, evento, mercados:[{type,name,selections:[{name,handicap,price}]}] }

export const config = { runtime: 'edge' }

const BASE = 'https://www.betano.co'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'

// Códigos de mercado de Betano que usa el motor (verificados 2026-09-11 con
// Bournemouth–Brentford, Premier League). Por equipo: el 1º es local, el 2º visita.
const TIPOS = new Set([
  // totales del partido
  '4159', 'X002', 'CNOU', 'HCTG', 'TCOU', 'X128', 'X328', '4629', 'COU1', 'COU2', '4108', '1COU', 'OUH1',
  // por equipo
  '4160', '4161', 'X133', 'X134', 'XOF2', 'YOF2', 'OUHG', 'OUAG', 'HCOU', 'ACOU', '4167', '4168', '4165', '4166', 'X135', 'X136',
  // hándicaps
  'AHRF', 'FCH2', 'CHF3', '4115', '4113', '4111', 'AHCA',
  // referencia
  'MRES', 'DBLC', '1000617', '1000618',
])

export default async function handler(req) {
  const { searchParams } = new URL(req.url)
  const liga = searchParams.get('liga')
  const evento = searchParams.get('evento')

  try {
    if (liga) {
      if (!/^\d{1,8}g?$/.test(liga)) return json({ ok: false, error: 'liga inválida' }, 400)
      const r = await betano(`/api/sport/futbol/ligas/x/${liga}/?req=la,s,stnf,c,mb`)
      if (!r.ok) return json({ ok: false, error: `betano ${r.status}` })
      const data = (await r.json())?.data
      const eventos = (data?.blocks ?? []).flatMap(b => b.events ?? []).map(e => ({
        id: String(e.id),
        name: e.name,
        startTime: e.startTime,
        url: e.url,
        home: e.participants?.[0]?.name ?? (e.name ?? '').split(' - ')[0],
        away: e.participants?.[1]?.name ?? (e.name ?? '').split(' - ')[1],
        mercados: e.totalMarketsAvailable ?? null,
      }))
      return json({ ok: true, eventos }, 200, 900)
    }

    if (evento) {
      if (!/^\/cuotas-de-partido\/[a-z0-9-]+\/\d{5,12}\/?$/.test(evento)) return json({ ok: false, error: 'evento inválido' }, 400)
      const path = evento.endsWith('/') ? evento : `${evento}/`
      const r = await betano(`/api${path}?bt=13`)
      if (!r.ok) return json({ ok: false, error: `betano ${r.status}` })
      const data = (await r.json())?.data
      const ev = data?.event ?? {}
      // Los mercados viven anidados (pestañas, bloques…): recorrido genérico
      const vistos = new Set()
      const mercados = []
      const walk = (v) => {
        if (!v || typeof v !== 'object') return
        if (Array.isArray(v)) { v.forEach(walk); return }
        if (v.selections && v.type && v.name && TIPOS.has(String(v.type))) {
          const k = v.id ?? `${v.type}|${v.name}`
          if (!vistos.has(k)) {
            vistos.add(k)
            mercados.push({
              type: String(v.type),
              name: v.name,
              selections: v.selections.map(s => ({ name: s.name, handicap: s.handicap ?? null, price: s.price ?? null }))
                .filter(s => s.price),
            })
          }
          return
        }
        for (const key of Object.keys(v)) walk(v[key])
      }
      walk(data)
      return json({
        ok: true,
        evento: {
          id: String(ev.id ?? ''), name: ev.name, startTime: ev.startTime, url: ev.url,
          home: ev.participants?.[0]?.name ?? (ev.name ?? '').split(' - ')[0],
          away: ev.participants?.[1]?.name ?? (ev.name ?? '').split(' - ')[1],
          totalMercados: ev.totalMarketsAvailable ?? null,
        },
        mercados,
      }, 200, 300)
    }

    return json({ ok: false, error: 'falta liga o evento' }, 400)
  } catch (e) {
    return json({ ok: false, error: e.message })
  }
}

function betano(path) {
  return fetch(`${BASE}${path}`, {
    headers: {
      'User-Agent': UA,
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'es-CO,es;q=0.9',
      'Referer': `${BASE}/`,
    },
  })
}

function json(data, status = 200, sMaxAge = 0) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // CORS abierto: datos públicos; permite usar el proxy de producción desde el dev local
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': sMaxAge ? `s-maxage=${sMaxAge}, stale-while-revalidate=120` : 'no-store',
    },
  })
}
