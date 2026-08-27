// ─── Sofascore — fuente de saques de banda (TI) y portería (GK) ──────────────
// Live-Score API no trae GK nunca y TI solo en partidos muy recientes.
// Sofascore tiene ambos para TODOS los partidos, gratis.
// Se llama DIRECTO desde el navegador: su API permite CORS y el Cloudflare
// deja pasar a un Chrome real (curl/Node dan 403 — por eso no va por proxy).

const BASE = 'https://api.sofascore.com/api/v1'
const CACHE_KEY = 'motor_sofa_cache_v1'
const TTL_TEAMID = 90 * 24 * 3600_000  // el id de un equipo no cambia
const TTL_EVENTS = 3 * 3600_000        // lista de partidos: 3h
const TTL_STATS  = 30 * 24 * 3600_000  // stats de partido terminado: 30 días

function getCache(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    const e = raw[key]
    if (!e || Date.now() - e.ts > e.ttl) return null
    return e.data
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

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function sofaFetch(path) {
  const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(12_000) })
  if (!res.ok) throw new Error(`Sofascore ${res.status}`)
  return res.json()
}

// ─── Resolver el id de Sofascore desde el nombre del equipo ──────────────────
async function getTeamId(teamName) {
  const key = `sofa_team_${teamName.toLowerCase()}`
  const cached = getCache(key)
  if (cached) return cached

  const data = await sofaFetch(`/search/all?q=${encodeURIComponent(teamName)}`)
  const hit = (data.results ?? []).find(r =>
    r.type === 'team' &&
    (r.entity?.sport?.slug === 'football' || r.entity?.sport?.name === 'Football' || !r.entity?.sport)
  )
  if (!hit?.entity?.id) throw new Error(`Sofascore: equipo "${teamName}" no encontrado`)
  const out = { id: hit.entity.id, name: hit.entity.name }
  setCache(key, out, TTL_TEAMID)
  return out
}

// ─── Stats de un evento: saques + variables de flujo de juego ────────────────
// Además de TI/GK extrae: centros (para inferir estilo por bandas), xG y
// grandes ocasiones — las variables que van "más allá del promedio".
async function getEventSaques(eventId) {
  const key = `sofa_stats2_${eventId}`
  const cached = getCache(key)
  if (cached) return cached

  const data = await sofaFetch(`/event/${eventId}/statistics`)
  const all = data.statistics?.find(s => s.period === 'ALL')
  const items = (all?.groups ?? []).flatMap(g => g.statisticsItems ?? [])
  const find = re => items.find(it => re.test(it.name))
  const num = v => { const n = parseFloat(v); return isNaN(n) ? null : n }
  // "Accurate crosses" viene como "8/24 (33%)" → el total es lo que importa
  const cross = v => {
    if (v == null) return null
    const m = String(v).match(/\/(\d+)/)
    return m ? Number(m[1]) : num(v)
  }

  const tiItem = find(/^throw[- ]?ins?$/i)
  const gkItem = find(/^goal ?kicks?$/i)
  const crItem = find(/cross/i)
  const xgItem = find(/^expected goals/i)
  const bcItem = find(/^big chances$/i)
  const out = {
    tiHome: num(tiItem?.home), tiAway: num(tiItem?.away),
    gkHome: num(gkItem?.home), gkAway: num(gkItem?.away),
    crHome: cross(crItem?.home), crAway: cross(crItem?.away),
    xgHome: num(xgItem?.home), xgAway: num(xgItem?.away),
    bcHome: num(bcItem?.home), bcAway: num(bcItem?.away),
  }
  // cachear siempre (aunque venga vacío) — el partido ya terminó, no va a cambiar
  setCache(key, out, TTL_STATS)
  return out
}

// ─── Partido actual (o de hoy) de un equipo — con stats en vivo ──────────────
// Cubre lo que Live-Score no: torneos exóticos (ASEAN, amistosos, etc.).
// Sin cache: si está en juego, las stats cambian minuto a minuto.
const SOFA_LIVE_ROWS = [
  ['Ball possession', 'Posesión %'],
  ['Expected goals', 'xG'],
  ['Big chances', 'Grandes ocasiones'],
  ['Total shots', 'Tiros'],
  ['Shots on target', 'A puerta'],
  ['Corner kicks', 'Córners'],
  ['Throw-ins', 'Saques banda'],
  ['Goal kicks', 'Saques portería'],
  ['Fouls', 'Faltas'],
  ['Yellow cards', 'Amarillas'],
  ['Red cards', 'Rojas'],
  ['Offsides', 'Offsides'],
]

export async function fetchSofaPartidoActual(teamName) {
  const team = await getTeamId(teamName)

  const [lastData, nextData] = await Promise.all([
    sofaFetch(`/team/${team.id}/events/last/0`).catch(() => null),
    sofaFetch(`/team/${team.id}/events/next/0`).catch(() => null),
  ])
  const all = [...(lastData?.events ?? []), ...(nextData?.events ?? [])]

  const now = Date.now()
  const enJuego = all.find(e => e.status?.type === 'inprogress')
  const reciente = [...all]
    .filter(e => e.status?.type === 'finished' && now - e.startTimestamp * 1000 < 36 * 3600_000)
    .sort((a, b) => b.startTimestamp - a.startTimestamp)[0]
  const proximo = [...all]
    .filter(e => e.status?.type === 'notstarted' && e.startTimestamp * 1000 - now < 24 * 3600_000 && e.startTimestamp * 1000 > now)
    .sort((a, b) => a.startTimestamp - b.startTimestamp)[0]

  const ev = enJuego ?? reciente ?? proximo
  if (!ev) return null

  let rows = []
  if (ev.status?.type !== 'notstarted') {
    try {
      const data = await sofaFetch(`/event/${ev.id}/statistics`)
      const allP = data.statistics?.find(s => s.period === 'ALL')
      const items = (allP?.groups ?? []).flatMap(g => g.statisticsItems ?? [])
      rows = SOFA_LIVE_ROWS.map(([name, label]) => {
        const it = items.find(i => i.name === name)
        return it ? { label, h: it.home, a: it.away } : null
      }).filter(Boolean)
    } catch {}
  }

  return {
    id: ev.id,
    homeTeam: ev.homeTeam?.name,
    awayTeam: ev.awayTeam?.name,
    torneo: ev.tournament?.name ?? '',
    inicio: ev.startTimestamp * 1000,
    estado: ev.status?.type, // inprogress | finished | notstarted
    estadoTxt: ev.status?.description ?? '',
    marcador: `${ev.homeScore?.current ?? '?'} - ${ev.awayScore?.current ?? '?'}`,
    rows,
  }
}

// ─── Saques de los últimos N partidos de un equipo, indexados por fecha ──────
// Devuelve { byDate: { 'YYYY-MM-DD': { ti, tiAg, gk, gkAg, rival } }, teamId }
export async function fetchSofaSaques(teamName, n = 12, onProgress) {
  const team = await getTeamId(teamName)

  const evKey = `sofa_events_${team.id}`
  let events = getCache(evKey)
  if (!events) {
    const data = await sofaFetch(`/team/${team.id}/events/last/0`)
    events = (data.events ?? [])
      .filter(e => e.status?.type === 'finished')
      .map(e => ({
        id: e.id,
        ts: e.startTimestamp,
        homeId: e.homeTeam?.id,
        homeName: e.homeTeam?.name,
        awayName: e.awayTeam?.name,
      }))
    setCache(evKey, events, TTL_EVENTS)
  }

  const recent = events.slice(-n)
  const byDate = {}

  for (let i = 0; i < recent.length; i++) {
    const ev = recent[i]
    onProgress?.(i + 1, recent.length)
    try {
      const s = await getEventSaques(ev.id)
      const isHome = ev.homeId === team.id
      const entry = {
        ti: isHome ? s.tiHome : s.tiAway,
        tiAg: isHome ? s.tiAway : s.tiHome,
        gk: isHome ? s.gkHome : s.gkAway,
        gkAg: isHome ? s.gkAway : s.gkHome,
        crosses: isHome ? s.crHome : s.crAway,
        crossesAg: isHome ? s.crAway : s.crHome,
        xg: isHome ? s.xgHome : s.xgAway,
        xgAg: isHome ? s.xgAway : s.xgHome,
        bigch: isHome ? s.bcHome : s.bcAway,
        rival: isHome ? ev.awayName : ev.homeName,
      }
      if (entry.ti != null || entry.gk != null || entry.crosses != null || entry.xg != null) {
        // Indexar por fecha UTC y por fecha UTC-5 (partidos nocturnos de América
        // caen "al día siguiente" en UTC y no matchearían con Live-Score)
        const dUtc = new Date(ev.ts * 1000).toISOString().slice(0, 10)
        const dBog = new Date((ev.ts - 5 * 3600) * 1000).toISOString().slice(0, 10)
        byDate[dUtc] = entry
        if (dBog !== dUtc) byDate[dBog] = { ...entry }
      }
    } catch {}
    if (i < recent.length - 1) await sleep(350) // rate limit amable
  }

  return { byDate, teamId: team.id, teamName: team.name }
}
