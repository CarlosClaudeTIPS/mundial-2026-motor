// ─── RECIÉN ASCENDIDOS (2026-09-09) ──────────────────────────────────────────
//
// Pedido de Carlos: "el recién ascendido se juega más y viene con menos ritmo
// competitivo". Aquí se DETECTA con datos del proveedor, no a mano: un equipo
// es recién ascendido si está en la tabla actual y NO estaba en la tabla de la
// misma competición la temporada anterior (Live-Score, seasons/list + standings
// con ?season=). Caché 7 días por liga.
//
// Ojo: "no estaba el año pasado" también cubre a un equipo que bajó de una
// categoría superior (raro en primera división; en segundas divisiones puede
// pasar). Por eso se expone `motivo` y la UI lo dice como "no estaba en la
// categoría la temporada pasada".

import { fetchStandingsPrevSeason } from './livescore-api'

const KEY = 'motor_ascendidos_v1'
const TTL = 7 * 24 * 3600_000
const norm = s => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')

// Pura (testeable): tablas actual y anterior → ids/nombres nuevos
export function detectarAscendidos(tablaActual = [], tablaAnterior = []) {
  if (!tablaActual.length || !tablaAnterior.length) return { ids: [], nombres: [], disponible: false }
  const idsPrev = new Set(tablaAnterior.map(t => t.id))
  const nombresPrev = new Set(tablaAnterior.map(t => norm(t.name)))
  const nuevos = tablaActual.filter(t => !idsPrev.has(t.id) && !nombresPrev.has(norm(t.name)))
  return { ids: nuevos.map(t => t.id), nombres: nuevos.map(t => t.name), disponible: true }
}

export function esAscendido(asc, team) {
  if (!asc?.disponible || !team) return false
  return asc.ids.includes(team.id) || asc.ids.includes(team.apiId) || asc.nombres.some(n => norm(n) === norm(team.name))
}

export async function ascendidosDeLiga(leagueId, tablaActual) {
  try {
    const cache = JSON.parse(localStorage.getItem(KEY) || '{}')
    const c = cache[leagueId]
    if (c && Date.now() - c.ts < TTL) return c.data
  } catch {}
  const prev = await fetchStandingsPrevSeason(leagueId)
  if (!prev.ok) return { ids: [], nombres: [], disponible: false, error: prev.error }
  const data = { ...detectarAscendidos(tablaActual, prev.table), temporadaAnterior: prev.temporada }
  try {
    const cache = JSON.parse(localStorage.getItem(KEY) || '{}')
    cache[leagueId] = { ts: Date.now(), data }
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {}
  return data
}
