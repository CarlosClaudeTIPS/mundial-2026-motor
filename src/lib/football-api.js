// Cliente de datos multi-liga con cache en localStorage.
// Prioridad de proveedores:
//  1. Live-Score API (VITE_LIVESCORE_API_KEY + SECRET) — incluye throw-ins y goal kicks reales
//  2. API-Football directo (VITE_API_FOOTBALL_KEY)
//  3. Proxy Vercel /api/football-data (API_FOOTBALL_KEY en el servidor)

import * as ls from './livescore-api'

const CACHE_KEY   = 'motor_api_cache_v2'
const TTL_LIVE    = 60_000            // 1 min si hay partido en curso
const TTL_NORMAL  = 10 * 60_000      // 10 min fuera de partido
const TTL_STATS   = 30 * 24 * 3600_000 // 30 días — stats de partidos terminados no cambian

const DIRECT_KEY = import.meta.env.VITE_API_FOOTBALL_KEY || null
const BASE_URL   = 'https://v3.football.api-sports.io'

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
  } catch {
    // localStorage lleno → limpiar cache y reintentar una vez
    try {
      localStorage.removeItem(CACHE_KEY)
      localStorage.setItem(CACHE_KEY, JSON.stringify({ [key]: { data, ts: Date.now(), ttl } }))
    } catch {}
  }
}

function defaultSeason() {
  const now = new Date()
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
}

async function directFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-apisports-key': DIRECT_KEY, 'Accept': 'application/json' },
    signal: AbortSignal.timeout(12_000),
  })
  if (!res.ok) throw new Error(`API-Football ${res.status}`)
  return res.json()
}

async function proxyFetch(params) {
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`/api/football-data?${qs}`, { signal: AbortSignal.timeout(12_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    // En dev local /api no existe (es una función de Vercel) → mensaje claro
    throw new Error('Sin acceso a API-Football. En dev local agrega VITE_API_FOOTBALL_KEY en .env.local; en Vercel configura API_FOOTBALL_KEY.')
  }
}

function mapFixture(f) {
  return {
    id:        f.fixture.id,
    date:      f.fixture.date,
    status:    f.fixture.status.short,
    elapsed:   f.fixture.status.elapsed,
    venue:     f.fixture.venue?.city ?? '',
    referee:   f.fixture.referee ?? null,
    homeId:    f.teams.home.id,
    awayId:    f.teams.away.id,
    homeTeam:  f.teams.home.name,
    awayTeam:  f.teams.away.name,
    homeGoals: f.goals.home,
    awayGoals: f.goals.away,
    homeWinner: f.teams.home.winner,
    awayWinner: f.teams.away.winner,
    htHome:    f.score?.halftime?.home,
    htAway:    f.score?.halftime?.away,
  }
}

function dateStr(offsetDays) {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10)
}

// ─── Standings ────────────────────────────────────────────────────────────────
export async function fetchStandings(league, season = defaultSeason()) {
  if (ls.hasLivescore()) return ls.fetchStandings(league)
  const key = `standings_${league}_${season}`
  const cached = getCache(key)
  if (cached) return cached

  let out
  if (DIRECT_KEY) {
    const data = await directFetch(`/standings?league=${league}&season=${season}`)
    const raw = data?.response?.[0]?.league?.standings ?? []
    const groups = raw.map(group => group.map(team => ({
      rank: team.rank, id: team.team.id, name: team.team.name, logo: team.team.logo,
      group: team.group, pts: team.points, pj: team.all.played,
      pg: team.all.win, pe: team.all.draw, pp: team.all.lose,
      gf: team.all.goals.for, gc: team.all.goals.against, gd: team.goalsDiff,
      form: team.form ?? '',
    })))
    out = { ok: true, groups, season }
  } else {
    out = await proxyFetch({ endpoint: 'standings', league, season })
  }
  if (out.ok) setCache(key, out, TTL_NORMAL)
  return out
}

// ─── Fixtures (ventana ±7 días) ───────────────────────────────────────────────
export async function fetchFixtures(league, season = defaultSeason()) {
  if (ls.hasLivescore()) return ls.fetchFixtures(league)
  const key = `fixtures_${league}_${season}`
  const cached = getCache(key)
  if (cached) return cached

  let out
  if (DIRECT_KEY) {
    const data = await directFetch(`/fixtures?league=${league}&season=${season}&from=${dateStr(-7)}&to=${dateStr(7)}&timezone=America/Bogota`)
    out = { ok: true, fixtures: (data?.response ?? []).map(mapFixture) }
  } else {
    out = await proxyFetch({ endpoint: 'fixtures', league, season })
  }
  if (out.ok) setCache(key, out, TTL_NORMAL)
  return out
}

// ─── Live ─────────────────────────────────────────────────────────────────────
export async function fetchLive(league) {
  if (ls.hasLivescore()) return ls.fetchLive(league)
  const key = `live_${league}`
  const cached = getCache(key)
  if (cached) return cached

  let out
  if (DIRECT_KEY) {
    const data = await directFetch(`/fixtures?live=all&league=${league}`)
    out = { ok: true, live: (data?.response ?? []).map(f => ({ ...mapFixture(f), stats: f.statistics ?? [] })) }
  } else {
    out = await proxyFetch({ endpoint: 'live', league })
  }
  if (out.ok) setCache(key, out, TTL_LIVE)
  return out
}

// ─── Últimos N partidos de un equipo (cross-season, para ponderación §4) ─────
export async function fetchTeamLast(league, teamId, last = 10) {
  if (ls.hasLivescore()) return ls.fetchTeamLast(league, teamId, last)
  const key = `teamlast_${league}_${teamId}_${last}`
  const cached = getCache(key)
  if (cached) return cached

  let out
  if (DIRECT_KEY) {
    const data = await directFetch(`/fixtures?team=${teamId}&league=${league}&last=${last}&status=FT-AET-PEN`)
    out = { ok: true, fixtures: (data?.response ?? []).map(mapFixture) }
  } else {
    out = await proxyFetch({ endpoint: 'teamlast', league, team: teamId, last })
  }
  if (out.ok) setCache(key, out, 3 * 3600_000) // 3h — cambia solo cuando juegan
  return out
}

// ─── Stats detalladas de un partido terminado (cache 30 días) ────────────────
export async function fetchFixtureStats(fixtureId, homeId, awayId) {
  if (ls.hasLivescore()) return ls.fetchFixtureStats(fixtureId, homeId, awayId)
  const key = `fixstats_${fixtureId}`
  const cached = getCache(key)
  if (cached) return cached

  let out
  if (DIRECT_KEY) {
    const data = await directFetch(`/fixtures/statistics?fixture=${fixtureId}`)
    out = {
      ok: true, fixture: fixtureId,
      stats: (data?.response ?? []).map(t => ({
        teamId: t.team.id,
        stats: Object.fromEntries((t.statistics ?? []).map(s => [s.type, s.value])),
      })),
    }
  } else {
    out = await proxyFetch({ endpoint: 'fixstats', fixture: fixtureId })
  }
  if (out.ok && out.stats?.length) setCache(key, out, TTL_STATS)
  return out
}

export function hasApiAccess() {
  return !!DIRECT_KEY // en producción el proxy responde igual; esto es solo para dev
}

// ─── Helpers de fecha (Bogotá UTC-5) ─────────────────────────────────────────
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
  return new Date(isoString).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

export function todayBogota() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

// ─── Status helpers ───────────────────────────────────────────────────────────
const LIVE_STATUSES = ['1H', 'HT', '2H', 'ET', 'P', 'BT', 'INT']
const DONE_STATUSES = ['FT', 'AET', 'PEN']

export function isLive(status) { return LIVE_STATUSES.includes(status) }
export function isDone(status) { return DONE_STATUSES.includes(status) }

// ─── Forma reciente ───────────────────────────────────────────────────────────
export function parseForm(formStr = '') {
  return formStr.split('').slice(-5).map(c => ({
    label: c,
    color: c === 'W' ? 'bg-green-600' : c === 'D' ? 'bg-yellow-600' : 'bg-red-600',
  }))
}
