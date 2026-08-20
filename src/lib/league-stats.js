// ─── Constructor de stats de equipo desde API-Football — spec v2 §4/§5 ────────
// Convierte los últimos N partidos (con estadísticas por partido) en el objeto
// de equipo que consume el motor (mismo shape que usaba teams.js del Mundial).
//
// Ponderación temporal (§4, ligas):
//   últimos 5 → 30% · últimos 10 → 70% (el 20% de "temporada" colapsa en últimos 10
//   porque a inicio de temporada la muestra cross-season ES la base estructural)

import { fetchTeamLast, fetchFixtureStats } from './football-api'
import { getBaseline } from './leagues'

// Nombres de stats de API-Football
const S = {
  shots:      'Total Shots',
  sot:        'Shots on Goal',
  blocked:    'Blocked Shots',
  corners:    'Corner Kicks',
  fouls:      'Fouls',
  yellow:     'Yellow Cards',
  red:        'Red Cards',
  possession: 'Ball Possession',
  passes:     'Total passes',
}

function num(v) {
  if (v == null) return null
  if (typeof v === 'string') return parseFloat(v.replace('%', '')) || 0
  return v
}

function avg(arr) {
  const valid = arr.filter(v => v != null && !isNaN(v))
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null
}

// Promedio ponderado: últimos 5 ×0.30 + últimos 10 ×0.70
function weighted(values) {
  const a10 = avg(values)
  const a5  = avg(values.slice(0, 5)) // values vienen ordenados del más reciente al más viejo
  if (a10 == null) return null
  if (a5 == null) return a10
  return a5 * 0.30 + a10 * 0.70
}

// ─── Cargar y agregar los últimos partidos de un equipo ──────────────────────
// Devuelve objeto compatible con el motor + metadata de calidad de datos.
export async function buildTeamStats(league, teamId, teamName, onProgress) {
  const base = getBaseline(league.id)

  const lastRes = await fetchTeamLast(league.id, teamId, 10)
  if (!lastRes.ok || !lastRes.fixtures?.length) {
    throw new Error(`Sin partidos recientes para ${teamName}`)
  }

  // Más reciente primero
  const fixtures = [...lastRes.fixtures].sort((a, b) => new Date(b.date) - new Date(a.date))

  // Stats por partido (secuencial para respetar rate limit del plan gratuito)
  const rows = []
  for (let i = 0; i < fixtures.length; i++) {
    const f = fixtures[i]
    onProgress?.(teamName, i + 1, fixtures.length)
    try {
      const statsRes = await fetchFixtureStats(f.id)
      const own   = statsRes.stats?.find(t => t.teamId === teamId)?.stats ?? {}
      const rival = statsRes.stats?.find(t => t.teamId !== teamId)?.stats ?? {}
      const isHome = f.homeId === teamId
      rows.push({
        result: resultFor(f, teamId),
        gf: isHome ? f.homeGoals : f.awayGoals,
        ga: isHome ? f.awayGoals : f.homeGoals,
        gf1h: isHome ? f.htHome : f.htAway,
        ga1h: isHome ? f.htAway : f.htHome,
        shots:  num(own[S.shots]),  shotsAg:  num(rival[S.shots]),
        sot:    num(own[S.sot]),    sotAg:    num(rival[S.sot]),
        blocked: num(own[S.blocked]), blockedAg: num(rival[S.blocked]),
        corners: num(own[S.corners]), cornersAg: num(rival[S.corners]),
        fouls:  num(own[S.fouls]),  foulsAg:  num(rival[S.fouls]),
        cards:  (num(own[S.yellow]) ?? 0) + (num(own[S.red]) ?? 0),
        possession: num(own[S.possession]),
        passes: num(own[S.passes]), passesAg: num(rival[S.passes]),
        rival: isHome ? f.awayTeam : f.homeTeam,
        date: f.date,
        isHome,
      })
    } catch {
      // partido sin stats → solo goles
      const isHome = f.homeId === teamId
      rows.push({
        result: resultFor(f, teamId),
        gf: isHome ? f.homeGoals : f.awayGoals,
        ga: isHome ? f.awayGoals : f.homeGoals,
        rival: isHome ? f.awayTeam : f.homeTeam,
        date: f.date, isHome,
      })
    }
  }

  const withStats = rows.filter(r => r.shots != null)
  const matches = rows.length

  // PPG desde resultados
  const pts = rows.reduce((s, r) => s + (r.result === 'W' ? 3 : r.result === 'D' ? 1 : 0), 0)
  const ppg = matches ? pts / matches : 1.3

  const w = key => weighted(rows.map(r => r[key]))
  const goals1hShare = (() => {
    const withHt = rows.filter(r => r.gf1h != null && r.gf != null && r.gf > 0)
    if (!withHt.length) return 0.42
    const g1h = withHt.reduce((s, r) => s + r.gf1h, 0)
    const gt  = withHt.reduce((s, r) => s + r.gf, 0)
    return gt > 0 ? g1h / gt : 0.42
  })()

  const shots_avg   = w('shots')   ?? base.shotsAvg
  const sot_avg     = w('sot')     ?? shots_avg * 0.36
  const corners_avg = w('corners') ?? base.cornersAvg
  const possession  = w('possession') ?? 50
  const passes_avg  = w('passes')  ?? 430
  const gf_avg      = w('gf') ?? 1.3
  const ga_avg      = w('ga') ?? base.gaAvg

  // GK/TI: API-Football no los da (spec §3) → estimación por posesión y baseline.
  // Correlación GK↔posesión ≈ -0.72: menos posesión → más saques de portería.
  const gkEst = base.gkAvg * (1 + (50 - possession) * 0.022)
  const tiEst = base.tiAvg

  const cs = rows.filter(r => r.ga === 0).length
  const btts = rows.filter(r => r.gf > 0 && r.ga > 0).length

  return {
    id: teamId,
    name: teamName,
    apiId: teamId,
    est: withStats.length < 7,       // muestra pobre → -10 Confidence (§8)
    estGkTi: true,                    // GK/TI siempre estimados en modo liga
    matches,
    statsMatches: withStats.length,
    ppg: +ppg.toFixed(2),
    gf_avg: +gf_avg.toFixed(2),
    ga_avg: +ga_avg.toFixed(2),
    cs_pct: Math.round((cs / matches) * 100),
    btts_pct: Math.round((btts / matches) * 100),
    shots_avg: +shots_avg.toFixed(1),
    sot_avg: +sot_avg.toFixed(1),
    shots_against_avg: +(w('shotsAg') ?? base.shotsAvg).toFixed(1),
    corners_avg: +corners_avg.toFixed(1),
    corners_against_avg: +(w('cornersAg') ?? base.cornersAvg).toFixed(1),
    cards_avg: +(w('cards') ?? base.cardsAvg).toFixed(1),
    fouls_avg: +(w('fouls') ?? 12).toFixed(1),
    fouls_against_avg: +(w('foulsAg') ?? 12).toFixed(1),
    passes_avg: Math.round(passes_avg),
    passes_against_avg: Math.round(w('passesAg') ?? 430),
    possession_avg: +possession.toFixed(0),
    goalkicks_avg: +gkEst.toFixed(1),
    throwins_avg: +tiEst.toFixed(1),
    freekicks_avg: +(w('foulsAg') ?? 12).toFixed(1),
    // Splits 1H/2H: goles reales desde halftime score; resto ~45/55 típico
    goals_1h: +(gf_avg * goals1hShare).toFixed(2),
    goals_2h: +(gf_avg * (1 - goals1hShare)).toFixed(2),
    shots_1h: +(shots_avg * 0.45).toFixed(1),
    shots_2h: +(shots_avg * 0.55).toFixed(1),
    sot_1h: +(sot_avg * 0.44).toFixed(1),
    sot_2h: +(sot_avg * 0.56).toFixed(1),
    corners_1h: +(corners_avg * 0.44).toFixed(1),
    corners_2h: +(corners_avg * 0.56).toFixed(1),
    cards_1h: +((w('cards') ?? base.cardsAvg) * 0.38).toFixed(1),
    cards_2h: +((w('cards') ?? base.cardsAvg) * 0.62).toFixed(1),
    style: 'mixto', // sin dato táctico desde API — neutro
    last5: rows.slice(0, 5).map(r => ({
      rival: r.rival,
      result: r.result,
      gf: r.gf, ga: r.ga,
      shots: r.shots, sot: r.sot, corners: r.corners,
      cards: r.cards, fouls: r.fouls, passes: r.passes,
      isHome: r.isHome,
      date: r.date?.slice(0, 10),
    })),
  }
}

function resultFor(f, teamId) {
  const isHome = f.homeId === teamId
  const gf = isHome ? f.homeGoals : f.awayGoals
  const ga = isHome ? f.awayGoals : f.homeGoals
  if (gf > ga) return 'W'
  if (gf < ga) return 'L'
  return 'D'
}

// ─── Lista de equipos de la liga (desde standings) ───────────────────────────
export function teamsFromStandings(standingsGroups) {
  const teams = []
  for (const group of standingsGroups ?? []) {
    for (const t of group) {
      teams.push({ id: t.id, name: t.name, logo: t.logo, rank: t.rank, group: t.group })
    }
  }
  return teams.sort((a, b) => a.name.localeCompare(b.name))
}
