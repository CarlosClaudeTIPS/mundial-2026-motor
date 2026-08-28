// ─── Constructor de stats de equipo desde API-Football — spec v2 §4/§5 ────────
// Convierte los últimos N partidos (con estadísticas por partido) en el objeto
// de equipo que consume el motor (mismo shape que usaba teams.js del Mundial).
//
// Ponderación temporal (§4, ligas):
//   últimos 5 → 30% · últimos 10 → 70% (el 20% de "temporada" colapsa en últimos 10
//   porque a inicio de temporada la muestra cross-season ES la base estructural)

import { fetchTeamLast, fetchFixtureStats } from './football-api'
import { fetchSofaSaques } from './sofascore'
import { getBaseline } from './leagues'

// Nombres de stats normalizados (formato API-Football; el adaptador
// de Live-Score API traduce a estos mismos nombres)
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
  offsides:   'Offsides',
  gk:         'Goal Kicks',   // solo Live-Score API
  ti:         'Throw Ins',    // solo Live-Score API
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
export async function buildTeamStats(league, teamId, teamName, onProgress, opts = {}) {
  const base = getBaseline(league.id)

  const lastRes = await fetchTeamLast(league.id, teamId, 10)
  if (!lastRes.ok || !lastRes.fixtures?.length) {
    throw new Error(`Sin partidos recientes para ${teamName}`)
  }

  // Más reciente primero. excludeFixtureId: para backtest — el partido que se
  // quiere "predecir" no puede formar parte de su propio historial.
  const fixtures = [...lastRes.fixtures]
    .filter(f => !opts.excludeFixtureId || f.id !== opts.excludeFixtureId)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
  if (!fixtures.length) throw new Error(`Sin partidos recientes para ${teamName}`)

  // Stats por partido (secuencial para respetar rate limit del plan gratuito)
  const rows = []
  for (let i = 0; i < fixtures.length; i++) {
    const f = fixtures[i]
    onProgress?.(teamName, i + 1, fixtures.length)
    try {
      const statsRes = await fetchFixtureStats(f.id, f.homeId, f.awayId)
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
        cards:  num(own[S.yellow]) != null || num(own[S.red]) != null
          ? (num(own[S.yellow]) ?? 0) + (num(own[S.red]) ?? 0) : null,
        cardsAg: num(rival[S.yellow]) != null || num(rival[S.red]) != null
          ? (num(rival[S.yellow]) ?? 0) + (num(rival[S.red]) ?? 0) : null,
        yellow: num(own[S.yellow]),   red: num(own[S.red]),
        yellowAg: num(rival[S.yellow]), redAg: num(rival[S.red]),
        offsides: num(own[S.offsides]), offsidesAg: num(rival[S.offsides]),
        possession: num(own[S.possession]),
        passes: num(own[S.passes]), passesAg: num(rival[S.passes]),
        gk: num(own[S.gk]),  gkAg: num(rival[S.gk]),
        ti: num(own[S.ti]),  tiAg: num(rival[S.ti]),
        rival: isHome ? f.awayTeam : f.homeTeam,
        date: f.date,
        isHome,
        tier: f.tier ?? 0,
        comp: f.competition ?? '',
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
        tier: f.tier ?? 0,
        comp: f.competition ?? '',
      })
    }
  }

  // ── Saques extra desde amistosos recientes ──────────────────────────────
  // La API solo trae TI/GK en partidos nuevos; los amistosos de pretemporada
  // suelen ser los únicos con el dato al inicio de temporada.
  const saquesExtra = []
  for (const f of (lastRes.friendlies ?? [])) {
    try {
      const sr = await fetchFixtureStats(f.id, f.homeId, f.awayId)
      const own   = sr.stats?.find(t => t.teamId === teamId)?.stats ?? {}
      const rival = sr.stats?.find(t => t.teamId !== teamId)?.stats ?? {}
      const ti = num(own[S.ti]); const tiAg = num(rival[S.ti])
      const gk = num(own[S.gk]); const gkAg = num(rival[S.gk])
      if (ti != null || gk != null) saquesExtra.push({ ti, tiAg, gk, gkAg })
    } catch {}
  }

  // ── Sofascore: saques reales + variables de flujo (centros, xG) ─────────
  // Rellena las filas por fecha; lo que no matchea entra igual al promedio.
  let sofaOk = false
  const sofaEntries = [] // únicas, para promedios de centros/xG
  try {
    const sofa = await fetchSofaSaques(teamName, 14, (i, nn) => onProgress?.(`${teamName} · Sofascore (${i}/${nn})`, i, nn))
    const usedDates = new Set()
    const seen = new Set()
    for (const [d, s] of Object.entries(sofa.byDate)) {
      const sig = `${s.rival}_${s.ti}_${s.gk}_${s.crosses}`
      if (seen.has(sig)) continue // el índice doble por zona horaria duplica entradas
      seen.add(sig)
      sofaEntries.push(s)
    }
    for (const r of rows) {
      const s = sofa.byDate[r.date]
      if (s) {
        usedDates.add(r.date)
        if (r.ti == null && s.ti != null) { r.ti = s.ti; r.tiAg = s.tiAg; sofaOk = true }
        if (r.gk == null && s.gk != null) { r.gk = s.gk; r.gkAg = s.gkAg; sofaOk = true }
        if (s.crosses != null) r.crosses = s.crosses
      }
    }
    // fechas de sofa sin fila correspondiente → solo para el promedio de saques
    const seen2 = new Set()
    for (const [d, s] of Object.entries(sofa.byDate)) {
      if (usedDates.has(d)) continue
      const sig = `${s.rival}_${s.ti}_${s.gk}`
      if (seen2.has(sig)) continue
      seen2.add(sig)
      saquesExtra.push({ ti: s.ti, tiAg: s.tiAg, gk: s.gk, gkAg: s.gkAg })
      sofaOk = true
    }
  } catch {}

  // ── Variables de flujo desde Sofascore ──────────────────────────────────
  const avgOf = arr => {
    const v = arr.filter(x => x != null)
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
  }
  const crosses_avg = avgOf(sofaEntries.map(e => e.crosses))
  const xg_avg = avgOf(sofaEntries.map(e => e.xg))
  const xga_avg = avgOf(sofaEntries.map(e => e.xgAg))
  const bigch_avg = avgOf(sofaEntries.map(e => e.bigch))

  // Estilo de juego inferido desde centros reales (spec: Tactical_K)
  // >=20 centros/partido = ataque por bandas · <=8 = juego interior
  const style = crosses_avg == null ? 'mixto'
    : crosses_avg >= 20 ? 'bandas'
    : crosses_avg >= 15 ? 'mixto-bandas'
    : crosses_avg <= 8 ? 'central'
    : 'mixto'

  // ── Ajuste por división (spec §4: cambio de contexto) ───────────────────
  // Un recién ascendido trae stats infladas de su división anterior:
  // Championship ≠ Premier. Se descuenta ataque y se infla lo concedido.
  const leagueTier = league.id === 40 ? 2 : 1 // Championship es tier 2; el resto tier 1
  const mul = (v, k) => v != null ? v * k : null
  const scaleRow = r => {
    if (!r.tier || r.tier === 0 || r.tier === leagueTier) return r
    if (r.tier > leagueTier) {
      // partido jugado en división INFERIOR a la analizada
      return {
        ...r,
        gf: mul(r.gf, 0.68), ga: mul(r.ga, 1.35),
        shots: mul(r.shots, 0.80), sot: mul(r.sot, 0.78),
        shotsAg: mul(r.shotsAg, 1.25), sotAg: mul(r.sotAg, 1.25),
        corners: mul(r.corners, 0.88), cornersAg: mul(r.cornersAg, 1.12),
        passes: mul(r.passes, 0.90),
      }
    }
    // jugó contra tier superior (raro): leve crédito
    return { ...r, gf: mul(r.gf, 1.08), shots: mul(r.shots, 1.06) }
  }
  const aRows = rows.map(scaleRow)
  const lowerTierCount = rows.filter(r => r.tier > leagueTier).length

  const withStats = rows.filter(r => r.shots != null)
  const matches = rows.length

  // PPG desde resultados — descontado si vienen de división inferior
  const pts = rows.reduce((s, r) => s + (r.result === 'W' ? 3 : r.result === 'D' ? 1 : 0), 0)
  const lowerFrac = matches ? lowerTierCount / matches : 0
  const ppg = (matches ? pts / matches : 1.3) * (1 - 0.40 * lowerFrac)

  const w = key => weighted(aRows.map(r => r[key]))
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

  // Pases: Live-Score API no los da → estimar desde posesión (~870 pases totales/partido)
  const passesReal  = w('passes')
  const passes_avg  = passesReal ?? 870 * (possession / 100)
  const gf_avg      = w('gf') ?? 1.3
  const ga_avg      = w('ga') ?? base.gaAvg

  // GK/TI: usar dato REAL si existe — de los partidos de liga recientes O de
  // los amistosos de pretemporada (única fuente al inicio de temporada).
  // Si no hay nada, estimar por posesión (correlación GK↔posesión ≈ -0.72).
  // MEDIANA + filtro de plausibilidad: la API a veces reporta datos parciales
  // (TI de 3-8 en un partido completo es dato roto) que arrastran la media
  // hacia abajo y generan UNDERs falsos. La mediana es inmune a esos outliers.
  const combineReal = (key) => {
    const minPlausible = key.startsWith('ti') ? 8 : 3 // TI real de un partido completo: 12-30 · GK: 4-14
    const vals = [
      ...rows.map(r => r[key]).filter(v => v != null),
      ...saquesExtra.map(s => s[key]).filter(v => v != null),
    ].filter(v => v >= minPlausible)
    if (!vals.length) return null
    const sorted = [...vals].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  }
  const gkReal = combineReal('gk')
  const tiReal = combineReal('ti')
  const gkAgReal = combineReal('gkAg') // saques de portería que PROVOCA en el rival
  const tiAgReal = combineReal('tiAg') // saques de banda que CONCEDE al rival
  const tiSample = rows.filter(r => r.ti != null).length + saquesExtra.filter(s => s.ti != null).length
  const gkSample = rows.filter(r => r.gk != null).length + saquesExtra.filter(s => s.gk != null).length
  const gkEst = gkReal ?? base.gkAvg * (1 + (50 - possession) * 0.022)
  const tiEst = tiReal ?? base.tiAvg

  const cs = rows.filter(r => r.ga === 0).length
  const btts = rows.filter(r => r.gf > 0 && r.ga > 0).length

  return {
    id: teamId,
    name: teamName,
    apiId: teamId,
    est: withStats.length < 7 || lowerFrac > 0.5, // muestra pobre o de otra división → -10 Confidence
    estGkTi: gkReal == null && tiReal == null,
    estGk: gkReal == null,
    estTi: tiReal == null,
    tiSample,
    gkSample,
    saquesSource: sofaOk ? 'Sofascore' : (saquesExtra.length ? 'amistosos' : null),
    estPasses: passesReal == null,
    tierAdj: lowerTierCount > 0 ? { lowerTierCount, lowerFrac: +lowerFrac.toFixed(2) } : null,
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
    sot_against_avg: w('sotAg') != null ? +w('sotAg').toFixed(1) : null,
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
    ti_against_avg: tiAgReal != null ? +tiAgReal.toFixed(1) : null,
    gk_against_avg: gkAgReal != null ? +gkAgReal.toFixed(1) : null,
    freekicks_avg: +(w('foulsAg') ?? 12).toFixed(1),
    // Variables de flujo (Sofascore) — el "más allá del promedio"
    crosses_avg: crosses_avg != null ? +crosses_avg.toFixed(1) : null,
    xg_avg: xg_avg != null ? +xg_avg.toFixed(2) : null,
    xga_avg: xga_avg != null ? +xga_avg.toFixed(2) : null,
    bigch_avg: bigch_avg != null ? +bigch_avg.toFixed(1) : null,
    // Disciplina: cuántas faltas necesita este equipo para ver una tarjeta
    cardsPerFoul: (w('cards') != null && w('fouls') > 0) ? +(w('cards') / w('fouls')).toFixed(3) : null,
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
    style, // inferido desde centros reales de Sofascore ('mixto' si no hay dato)
    styleReal: crosses_avg != null,
    last5: rows.slice(0, 5).map(mapHistoryRow),
    last10: rows.slice(0, 10).map(mapHistoryRow),
    // ── Splits de localía y racha (para el factor casa/visita del análisis) ──
    split: (() => {
      const mkSplit = rs => {
        const a = key => {
          const v = rs.map(r => r[key]).filter(x => x != null && !isNaN(x))
          return v.length ? +(v.reduce((s, b) => s + b, 0) / v.length).toFixed(2) : null
        }
        const p = rs.reduce((s, r) => s + (r.result === 'W' ? 3 : r.result === 'D' ? 1 : 0), 0)
        return rs.length ? {
          n: rs.length, ppg: +(p / rs.length).toFixed(2),
          gf: a('gf'), ga: a('ga'), shots: a('shots'), sot: a('sot'),
          corners: a('corners'), cards: a('cards'),
        } : null
      }
      return { home: mkSplit(rows.filter(r => r.isHome)), away: mkSplit(rows.filter(r => !r.isHome)) }
    })(),
    racha: (() => {
      if (!rows.length) return null
      const first = rows[0].result
      let n = 0
      for (const r of rows) { if (r.result === first) n++; else break }
      return { tipo: first, n } // ej: { tipo: 'W', n: 3 } = 3 victorias seguidas
    })(),
  }
}

function mapHistoryRow(r) {
  return {
    rival: r.rival,
    result: r.result,
    gf: r.gf, ga: r.ga,
    shots: r.shots, shotsAg: r.shotsAg,
    sot: r.sot, sotAg: r.sotAg,
    corners: r.corners, cornersAg: r.cornersAg,
    cards: r.cards, cardsAg: r.cardsAg,
    yellow: r.yellow, red: r.red, yellowAg: r.yellowAg, redAg: r.redAg,
    offsides: r.offsides, offsidesAg: r.offsidesAg,
    fouls: r.fouls, foulsAg: r.foulsAg,
    passes: r.passes,
    gk: r.gk, gkAg: r.gkAg,
    ti: r.ti, tiAg: r.tiAg,
    possession: r.possession,
    isHome: r.isHome,
    date: r.date?.slice(0, 10),
    comp: r.comp ?? '',
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
