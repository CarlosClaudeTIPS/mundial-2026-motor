// Cliente para API-Football con cache en localStorage

const CACHE_KEY   = 'mw26_api_cache'
const TTL_LIVE    = 60_000        // 1 min si hay partido en curso
const TTL_NORMAL  = 10 * 60_000  // 10 min fuera de partido
const TTL_IDLE    = 30 * 60_000  // 30 min sin partidos

function getCache(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    const entry = raw[key]
    if (!entry) return null
    if (Date.now() - entry.ts > entry.ttl) return null
    return entry.data
  } catch { return null }
}

function setCache(key, data, ttl) {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    raw[key] = { data, ts: Date.now(), ttl }
    localStorage.setItem(CACHE_KEY, JSON.stringify(raw))
  } catch {}
}

async function apiFetch(endpoint, ttl = TTL_NORMAL) {
  const cached = getCache(endpoint)
  if (cached) return cached
  const res = await fetch(`/api/football-data?endpoint=${endpoint}`, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (data.ok) setCache(endpoint, data, ttl)
  return data
}

// ─── Standings ────────────────────────────────────────────────────────────────
export async function fetchStandings() {
  return apiFetch('standings', TTL_NORMAL)
}

// ─── Fixtures (todos) ─────────────────────────────────────────────────────────
export async function fetchFixtures() {
  return apiFetch('fixtures', TTL_NORMAL)
}

// ─── Live ─────────────────────────────────────────────────────────────────────
export async function fetchLive() {
  return apiFetch('live', TTL_LIVE)
}

// ─── Helpers de fecha ─────────────────────────────────────────────────────────
// Zona horaria Bogotá UTC-5
export function toBogota(isoString) {
  return new Date(new Date(isoString).getTime() - 0) // el Date() already handles tz
}

export function formatLocalTime(isoString) {
  return new Date(isoString).toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota',
  })
}

export function formatLocalDate(isoString) {
  return new Date(isoString).toLocaleDateString('es-CO', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Bogota',
  })
}

export function getLocalDateStr(isoString) {
  return new Date(isoString).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) // YYYY-MM-DD
}

export function todayBogota() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

// ─── Status helpers ───────────────────────────────────────────────────────────
const LIVE_STATUSES  = ['1H','HT','2H','ET','P','BT','INT']
const DONE_STATUSES  = ['FT','AET','PEN']

export function isLive(status) { return LIVE_STATUSES.includes(status) }
export function isDone(status) { return DONE_STATUSES.includes(status) }

// ─── Badge de clasificación ───────────────────────────────────────────────────
// standings = array de 4 equipos del mismo grupo ordenados
export function getTeamBadge(team) {
  if (team.pj === 0) return null

  // Después de 3 partidos
  if (team.pj === 3) {
    if (team.rank <= 2) return { label: '✓ Clasificado', color: 'bg-green-800/60 text-green-300' }
    if (team.rank === 4) return { label: '✗ Eliminado', color: 'bg-red-800/60 text-red-300' }
    return { label: '⏳ Espera', color: 'bg-gray-700 text-gray-300' }
  }

  // Después de 2 partidos
  if (team.pj === 2) {
    if (team.pts === 6) return { label: '✓ Clasificado', color: 'bg-green-800/60 text-green-300' }
    if (team.pts === 0 && team.gd <= -4) return { label: '✗ Eliminado', color: 'bg-red-800/60 text-red-300' }
    if (team.pts <= 1 && team.rank === 4) return { label: '⚡ Necesita ganar', color: 'bg-orange-800/60 text-orange-300' }
  }

  // Después de 1 partido — solo si ya tiene 3 pts garantizados top2
  if (team.pj === 1 && team.pts === 3 && team.rank === 1) return null // demasiado pronto

  return null
}

// ─── Forma reciente ───────────────────────────────────────────────────────────
export function parseForm(formStr = '') {
  return formStr.split('').slice(-3).map(c => ({
    label: c,
    color: c === 'W' ? 'bg-green-600' : c === 'D' ? 'bg-yellow-600' : 'bg-red-600',
  }))
}
