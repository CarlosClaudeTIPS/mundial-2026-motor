// ─── Adaptador Live-Score API (live-score-api.com) ───────────────────────────
// Traduce sus respuestas al formato interno del motor (compatible API-Football).
// Ventaja clave: match stats con THROW-INS y GOAL KICKS reales (19 campos).
// Auth: key + secret en query string.

import { LEAGUES } from './leagues'

const KEY    = import.meta.env.VITE_LIVESCORE_API_KEY || null
const SECRET = import.meta.env.VITE_LIVESCORE_API_SECRET || null
const BASE   = 'https://livescore-api.com/api-client'

const CACHE_KEY  = 'motor_ls_cache_v1'
const TTL_LIVE   = 60_000
const TTL_NORMAL = 10 * 60_000
const TTL_TEAM   = 3 * 3600_000
const TTL_STATS  = 30 * 24 * 3600_000 // partidos terminados no cambian

export function hasLivescore() {
  return !!(KEY && SECRET)
}

function lsCompId(apiFootballLeagueId) {
  return LEAGUES.find(l => l.id === Number(apiFootballLeagueId))?.lsId ?? null
}

// ─── Cache ────────────────────────────────────────────────────────────────────
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
    try {
      localStorage.removeItem(CACHE_KEY)
      localStorage.setItem(CACHE_KEY, JSON.stringify({ [key]: { data, ts: Date.now(), ttl } }))
    } catch {}
  }
}

async function lsFetch(path, params = {}) {
  const qs = new URLSearchParams({ ...params, key: KEY, secret: SECRET }).toString()
  const res = await fetch(`${BASE}/${path}?${qs}`, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`Live-Score API HTTP ${res.status}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'Live-Score API error')
  return json.data
}

// ─── Parsers ──────────────────────────────────────────────────────────────────
function parseScore(str) {
  // "1 - 1" → [1, 1]
  if (!str || typeof str !== 'string') return [null, null]
  const m = str.match(/(\d+)\s*-\s*(\d+)/)
  return m ? [Number(m[1]), Number(m[2])] : [null, null]
}

function parsePair(str) {
  // "7:11" → [7, 11]
  if (!str || typeof str !== 'string') return [null, null]
  const parts = str.split(':')
  if (parts.length !== 2) return [null, null]
  const a = parseFloat(parts[0]); const b = parseFloat(parts[1])
  return [isNaN(a) ? null : a, isNaN(b) ? null : b]
}

function mapStatus(time, status) {
  // El campo confiable es "status"; "time" mezcla minuto, estado y HORA DE INICIO ("16:30")
  const st = (status ?? '').toUpperCase()
  if (st === 'FINISHED') return 'FT'
  if (st === 'NOT STARTED') return 'NS'
  if (st === 'HALF TIME BREAK') return 'HT'
  if (time === 'FT' || time === 'AET') return 'FT'
  if (time === 'HT') return 'HT'
  // "16:30" es hora programada, NO minuto de juego
  if (String(time).includes(':')) return 'NS'
  const n = parseInt(time)
  if (!isNaN(n)) return n > 45 ? '2H' : '1H'
  return st === 'IN PLAY' || st === 'ADDED TIME' ? '1H' : 'NS'
}

function elapsedFrom(time) {
  if (String(time).includes(':')) return null // hora programada, no minuto
  const n = parseInt(time)
  return isNaN(n) ? null : n
}

// ─── Standings ────────────────────────────────────────────────────────────────
export async function fetchStandings(leagueId) {
  const compId = lsCompId(leagueId)
  if (!compId) return { ok: false, error: 'Liga no mapeada en Live-Score API' }
  const key = `ls_standings_${compId}`
  const cached = getCache(key)
  if (cached) return cached

  try {
    const data = await lsFetch('competitions/standings.json', { competition_id: compId })
    const table = data?.table ?? []
    // Agrupar por group_name (ligas normales: un solo grupo)
    const byGroup = {}
    for (const t of table) {
      const g = t.group_name || 'A'
      if (!byGroup[g]) byGroup[g] = []
      byGroup[g].push({
        rank: Number(t.rank),
        id:   Number(t.team_id),
        name: t.name,
        logo: null,
        group: t.group_name,
        pts:  Number(t.points),
        pj:   Number(t.matches),
        pg:   Number(t.won),
        pe:   Number(t.drawn),
        pp:   Number(t.lost),
        gf:   Number(t.goals_scored),
        gc:   Number(t.goals_conceded),
        gd:   Number(t.goal_diff),
        form: '',
      })
    }
    const groups = Object.values(byGroup).map(g => g.sort((a, b) => a.rank - b.rank))
    const out = { ok: true, groups, season: new Date().getFullYear() }
    setCache(key, out, TTL_NORMAL)
    return out
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

// ─── Fixtures (próximos) + resultados recientes ──────────────────────────────
export async function fetchFixtures(leagueId) {
  const compId = lsCompId(leagueId)
  if (!compId) return { ok: false, error: 'Liga no mapeada' }
  const key = `ls_fixtures_${compId}`
  const cached = getCache(key)
  if (cached) return cached

  try {
    const fixtures = []
    let lastErr = null

    // Próximos partidos
    try {
      const data = await lsFetch('fixtures/matches.json', { competition_id: compId })
      for (const f of data?.fixtures ?? []) {
        fixtures.push({
          id: Number(f.id),
          date: `${f.date}T${f.time || '00:00:00'}Z`,
          status: 'NS',
          elapsed: null,
          venue: f.location ?? '',
          homeId: Number(f.home_id),
          awayId: Number(f.away_id),
          homeTeam: f.home_name,
          awayTeam: f.away_name,
          homeGoals: null,
          awayGoals: null,
          homeWinner: null,
          awayWinner: null,
        })
      }
    } catch (e) { lastErr = e }

    // Terminados de HOY: el historial va con retraso, pero el feed live los
    // trae como FINISHED — rescatarlos de ahí para verlos apenas acaban
    try {
      const liveData = await lsFetch('scores/live.json', { competition_id: compId })
      const hoy = new Date().toISOString().slice(0, 10)
      for (const m of liveData?.match ?? []) {
        if ((m.status ?? '').toUpperCase() !== 'FINISHED' && m.time !== 'FT') continue
        const [hg, ag] = parseScore(m.score)
        fixtures.push({
          id: Number(m.id),
          date: `${hoy}T${(m.scheduled ?? '12:00').slice(0, 5)}:00Z`,
          status: 'FT',
          elapsed: 90,
          venue: m.location ?? '',
          homeId: Number(m.home_id),
          awayId: Number(m.away_id),
          homeTeam: m.home_name,
          awayTeam: m.away_name,
          homeGoals: hg,
          awayGoals: ag,
          homeWinner: hg > ag ? true : hg < ag ? false : null,
          awayWinner: ag > hg ? true : ag < hg ? false : null,
        })
      }
    } catch (e) { lastErr = e }

    // Resultados últimos 7 días
    try {
      const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
      const to   = new Date().toISOString().slice(0, 10)
      const hist = await lsFetch('scores/history.json', { competition_id: compId, from, to })
      for (const m of hist?.match ?? []) {
        if (fixtures.some(f => f.id === Number(m.id))) continue
        const [hg, ag] = parseScore(m.score)
        fixtures.push({
          id: Number(m.id),
          date: `${m.date}T${m.scheduled || '00:00:00'}${(m.scheduled || '').length === 5 ? ':00' : ''}Z`,
          status: 'FT',
          elapsed: 90,
          venue: m.location ?? '',
          homeId: Number(m.home_id),
          awayId: Number(m.away_id),
          homeTeam: m.home_name,
          awayTeam: m.away_name,
          homeGoals: hg,
          awayGoals: ag,
          homeWinner: hg > ag ? true : hg < ag ? false : null,
          awayWinner: ag > hg ? true : ag < hg ? false : null,
        })
      }
    } catch (e) { lastErr = e }

    if (!fixtures.length && lastErr) {
      // NO cachear el fallo — que el próximo intento vuelva a pegar a la API
      return { ok: false, error: `Live-Score no respondió (${lastErr.message}) — suele ser el límite diario del trial; reintenta en un rato` }
    }
    const out = { ok: true, fixtures }
    if (fixtures.length) setCache(key, out, TTL_NORMAL)
    return out
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

// ─── Live ─────────────────────────────────────────────────────────────────────
export async function fetchLive(leagueId) {
  const compId = lsCompId(leagueId)
  if (!compId) return { ok: false, error: 'Liga no mapeada' }
  const key = `ls_live2_${compId}`
  const cached = getCache(key)
  if (cached) return cached

  try {
    const data = await lsFetch('scores/live.json', { competition_id: compId })
    // La API mete en "live" también terminados y por-empezar — filtrar SOLO en juego
    const NOT_LIVE = new Set(['FINISHED', 'NOT STARTED', 'CANCELLED', 'POSTPONED', 'ABANDONED', 'SUSPENDED'])
    const live = (data?.match ?? [])
      .filter(m => !NOT_LIVE.has((m.status ?? '').toUpperCase()) && !['FT', 'AET', 'PS'].includes(m.time))
      .map(m => {
      const [hg, ag] = parseScore(m.score)
      return {
        id: Number(m.id),
        date: null,
        status: mapStatus(m.time, m.status),
        elapsed: elapsedFrom(m.time),
        venue: m.location ?? '',
        homeId: Number(m.home_id),
        awayId: Number(m.away_id),
        homeTeam: m.home_name,
        awayTeam: m.away_name,
        homeGoals: hg,
        awayGoals: ag,
        stats: [],
      }
    })
    const out = { ok: true, live }
    setCache(key, out, TTL_LIVE)
    return out
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

// ─── Live GLOBAL: todos los partidos en juego ahora, de cualquier liga ───────
export async function fetchLiveGlobal() {
  const key = 'ls_live_global'
  const cached = getCache(key)
  if (cached) return cached

  try {
    const data = await lsFetch('scores/live.json', {})
    const NOT_LIVE = new Set(['FINISHED', 'NOT STARTED', 'CANCELLED', 'POSTPONED', 'ABANDONED', 'SUSPENDED'])
    const live = (data?.match ?? [])
      .filter(m => !NOT_LIVE.has((m.status ?? '').toUpperCase()) && !['FT', 'AET', 'PS'].includes(m.time))
      .map(m => {
        const [hg, ag] = parseScore(m.score)
        return {
          id: Number(m.id),
          status: mapStatus(m.time, m.status),
          elapsed: elapsedFrom(m.time),
          homeId: Number(m.home_id),
          awayId: Number(m.away_id),
          homeTeam: m.home_name,
          awayTeam: m.away_name,
          homeGoals: hg,
          awayGoals: ag,
          competition: m.competition_name ?? m.competition?.name ?? '',
          competitionId: Number(m.competition_id ?? m.competition?.id ?? 0) || 0,
          country: m.country?.name ?? '',
        }
      })
    const out = { ok: true, live }
    setCache(key, out, TTL_LIVE)
    return out
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

// ─── Últimos N partidos de un equipo ─────────────────────────────────────────
// Excluye amistosos (tier 0 / "Friendlies") para que la ponderación use partidos serios.
export async function fetchTeamLast(leagueId, teamId, last = 10) {
  const key = `ls_teamlast3_${teamId}_${last}`
  const cached = getCache(key)
  if (cached) return cached

  try {
    // Pedir más para poder filtrar amistosos y quedarnos con `last` competitivos
    const data = await lsFetch('teams/matches.json', { team_id: teamId, number: Math.min(last + 8, 25) })
    const all = Array.isArray(data) ? data : []

    const competitive = all.filter(m =>
      m.status === 'FINISHED' &&
      !(m.competition?.name ?? '').toLowerCase().includes('friendl')
    )
    // Si el filtro deja muy pocos (inicio de temporada), completar con amistosos
    const pool = competitive.length >= 5 ? competitive : all.filter(m => m.status === 'FINISHED')
    const picked = pool.slice(0, last)

    // Amistosos recientes NO incluidos: se usan aparte para saques (TI/GK),
    // porque la API solo trae esos datos en partidos recientes
    const friendlyExtras = all.filter(m =>
      m.status === 'FINISHED' &&
      (m.competition?.name ?? '').toLowerCase().includes('friendl') &&
      !picked.includes(m)
    ).slice(0, 6)

    const fixtures = picked.map(m => {
      const [hg, ag] = parseScore(m.ft_score || m.score)
      const [hh, ha] = parseScore(m.ht_score)
      return {
        id: Number(m.id),
        date: m.date,
        status: 'FT',
        elapsed: 90,
        venue: m.location ?? '',
        homeId: Number(m.home_id),
        awayId: Number(m.away_id),
        homeTeam: m.home_name,
        awayTeam: m.away_name,
        homeGoals: hg,
        awayGoals: ag,
        htHome: hh,
        htAway: ha,
        competition: m.competition?.name ?? '',
        tier: Number(m.competition?.tier ?? 0) || 0,
        isFriendly: (m.competition?.name ?? '').toLowerCase().includes('friendl'),
      }
    })

    const mapExtra = m => {
      const [hg, ag] = parseScore(m.ft_score || m.score)
      return {
        id: Number(m.id), date: m.date,
        homeId: Number(m.home_id), awayId: Number(m.away_id),
        homeTeam: m.home_name, awayTeam: m.away_name,
        homeGoals: hg, awayGoals: ag,
      }
    }

    const out = { ok: true, fixtures, friendlies: friendlyExtras.map(mapExtra) }
    setCache(key, out, TTL_TEAM)
    return out
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

// ─── Stats de un partido — mapea a nombres API-Football + GK/TI reales ───────
// Respuesta LS: { "corners": "10:2", "throw_ins": "7:11", ... } (home:away)
// OJO: sus keys tienen typos reales: "possesion", "fauls"
const LS_STAT_MAP = {
  attempts_on_goal:  'Total Shots',
  shots_on_target:   'Shots on Goal',
  shots_off_target:  'Shots off Goal',
  shots_blocked:     'Blocked Shots',
  corners:           'Corner Kicks',
  fauls:             'Fouls',
  yellow_cards:      'Yellow Cards',
  red_cards:         'Red Cards',
  possesion:         'Ball Possession',
  offsides:          'Offsides',
  goal_kicks:        'Goal Kicks',
  throw_ins:         'Throw Ins',
  free_kicks:        'Free Kicks',
  saves:             'Goalkeeper Saves',
  attacks:           'Attacks',
  dangerous_attacks: 'Dangerous Attacks',
  expected_goals:    'Expected Goals',
}

// ─── Head to Head ─────────────────────────────────────────────────────────────
export async function fetchH2H(team1Id, team2Id) {
  const key = `ls_h2h_${team1Id}_${team2Id}`
  const cached = getCache(key)
  if (cached) return cached

  try {
    const data = await lsFetch('teams/head2head.json', { team1_id: team1Id, team2_id: team2Id })
    const meetings = (data?.h2h ?? []).map(m => {
      const [hg, ag] = parseScore(m.ft_score || m.score)
      return {
        id: Number(m.id),
        date: m.date,
        homeId: Number(m.home_id),
        awayId: Number(m.away_id),
        homeTeam: m.home_name,
        awayTeam: m.away_name,
        homeGoals: hg,
        awayGoals: ag,
        competition: m.competition?.name ?? '',
      }
    })
    const out = {
      ok: true,
      team1: { id: Number(data?.team1?.id), name: data?.team1?.name, overallForm: data?.team1?.overall_form ?? [], h2hForm: data?.team1?.h2h_form ?? [] },
      team2: { id: Number(data?.team2?.id), name: data?.team2?.name, overallForm: data?.team2?.overall_form ?? [], h2hForm: data?.team2?.h2h_form ?? [] },
      meetings,
    }
    setCache(key, out, 24 * 3600_000)
    return out
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

export async function fetchFixtureStats(fixtureId, homeId, awayId, opts = {}) {
  const key = `ls_fixstats_${fixtureId}`
  if (!opts.noCache) {
    const cached = getCache(key)
    if (cached) return cached
  }

  try {
    const data = await lsFetch('matches/stats.json', { match_id: fixtureId })
    const home = {}
    const away = {}
    for (const [lsKey, afName] of Object.entries(LS_STAT_MAP)) {
      const [h, a] = parsePair(data?.[lsKey])
      if (h != null) home[afName] = afName === 'Ball Possession' ? `${h}%` : h
      if (a != null) away[afName] = afName === 'Ball Possession' ? `${a}%` : a
    }
    const out = {
      ok: true,
      fixture: fixtureId,
      stats: [
        { teamId: Number(homeId), stats: home },
        { teamId: Number(awayId), stats: away },
      ],
    }
    // Solo cachear si trajo datos (algunos partidos no tienen stats).
    // En vivo (noCache) nunca se cachea — las stats cambian minuto a minuto.
    if (!opts.noCache && Object.keys(home).length > 0) setCache(key, out, TTL_STATS)
    return out
  } catch (e) {
    return { ok: false, error: e.message, stats: [] }
  }
}// ─── Live ─────────────────────────────────────────────────────────────────────
