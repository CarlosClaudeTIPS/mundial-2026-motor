// Lógica compartida del proxy de Betano Colombia.
// La usan: api/betano.js (Vercel, bloqueado por geo desde fuera de Colombia) y
// scripts/betano-relay.mjs (relé local en el PC de Carlos, IP colombiana).
//
// Betano (betano.co) sirve su web desde JSON públicos sin login:
//   /api/sport/futbol/ligas/<slug>/<id>/?req=la,s,stnf,c,mb → partidos de una liga
//   /api/cuotas-de-partido/<slug>/<eventId>/?bt=13           → TODOS los mercados (pestaña "Todo")
// Solo se reenvían mercados de EQUIPO/PARTIDO (nada de jugadores): ~10 KB en vez de ~900 KB.

import https from 'node:https'
import zlib from 'node:zlib'

const BASE = 'https://www.betano.co'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

// Códigos de mercado de Betano que usa el motor (verificados 2026-09-11 con
// Bournemouth–Brentford, Premier League). Por equipo: el 1º es local, el 2º visita.
export const TIPOS = new Set([
  // totales del partido
  '4159', 'X002', 'CNOU', 'HCTG', 'TCOU', 'X128', 'X328', '4629', 'COU1', 'COU2', '4108', '1COU', 'OUH1',
  // por equipo
  '4160', '4161', 'X133', 'X134', 'XOF2', 'YOF2', 'OUHG', 'OUAG', 'HCOU', 'ACOU', '4167', '4168', '4165', '4166', 'X135', 'X136',
  // hándicaps
  'AHRF', 'FCH2', 'CHF3', '4115', '4113', '4111', 'AHCA',
  // referencia
  'MRES', 'DBLC', '1000617', '1000618',
])

export function cabeceras() {
  // Mínimas: exactamente lo que probó bien (curl y https nativo)
  return { 'User-Agent': UA, 'Accept': 'application/json' }
}

// OJO: el fetch de Node (undici) añade solas `sec-fetch-mode: cors`,
// `accept-language: *` y `accept-encoding`, y Betano responde 403 con una
// "splash screen" (probado 2026-10-10 desde Colombia: fetch 403, https nativo
// 200, curl 200). Por eso se usa node:https con cabeceras controladas.
export function fetchBetano(path) {
  return new Promise((resolve, reject) => {
    const req = https.get(`${BASE}${path}`, { headers: cabeceras(), timeout: 15000 }, (res) => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        const buf = Buffer.concat(chunks)
        const enc = res.headers['content-encoding']
        const text = () => Promise.resolve(
          (enc === 'gzip' ? zlib.gunzipSync(buf) : enc === 'br' ? zlib.brotliDecompressSync(buf) : enc === 'deflate' ? zlib.inflateSync(buf) : buf).toString('utf8'))
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          headers: { get: (k) => res.headers[k.toLowerCase()] ?? null },
          text,
          json: () => text().then(JSON.parse),
        })
      })
    })
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', reject)
  })
}

// Resuelve una petición ?liga= / ?evento= y devuelve { status, body, sMaxAge }
export async function resolver(searchParams) {
  const liga = searchParams.get('liga')
  const evento = searchParams.get('evento')
  try {
    if (liga) {
      if (!/^\d{1,8}g?$/.test(liga)) return { status: 400, body: { ok: false, error: 'liga inválida' } }
      const r = await fetchBetano(`/api/sport/futbol/ligas/x/${liga}/?req=la,s,stnf,c,mb`)
      if (!r.ok) return { status: 200, body: { ok: false, error: `betano ${r.status}` } }
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
      return { status: 200, body: { ok: true, eventos }, sMaxAge: 900 }
    }

    if (evento) {
      if (!/^\/cuotas-de-partido\/[a-z0-9-]+\/\d{5,12}\/?$/.test(evento)) return { status: 400, body: { ok: false, error: 'evento inválido' } }
      const path = evento.endsWith('/') ? evento : `${evento}/`
      const r = await fetchBetano(`/api${path}?bt=13`)
      if (!r.ok) return { status: 200, body: { ok: false, error: `betano ${r.status}` } }
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
      return {
        status: 200, sMaxAge: 300,
        body: {
          ok: true,
          evento: {
            id: String(ev.id ?? ''), name: ev.name, startTime: ev.startTime, url: ev.url,
            home: ev.participants?.[0]?.name ?? (ev.name ?? '').split(' - ')[0],
            away: ev.participants?.[1]?.name ?? (ev.name ?? '').split(' - ')[1],
            totalMercados: ev.totalMarketsAvailable ?? null,
          },
          mercados,
        },
      }
    }

    return { status: 400, body: { ok: false, error: 'falta liga o evento' } }
  } catch (e) {
    return { status: 200, body: { ok: false, error: e.message } }
  }
}
