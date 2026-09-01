// ─── Registro de predicciones del motor ──────────────────────────────────────
// Cada vez que analizas un partido, el snapshot de lo proyectado queda guardado
// 7 días. Después del partido se compara contra las stats reales → calibración.

const KEY = 'motor_predicciones_v1'
const EVAL_KEY = 'motor_predicciones_eval_v1' // evaluadas contra resultado real — permanentes
const TTL = 30 * 24 * 3600_000

const norm = s => (s ?? '').toLowerCase().trim()

function matchKey(leagueId, nameA, nameB) {
  return `${leagueId}_${[norm(nameA), norm(nameB)].sort().join('__')}`
}

function loadAll() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}')
    // limpiar viejas
    const now = Date.now()
    let dirty = false
    for (const k of Object.keys(raw)) {
      if (now - (raw[k].ts ?? 0) > TTL) { delete raw[k]; dirty = true }
    }
    if (dirty) localStorage.setItem(KEY, JSON.stringify(raw))
    return raw
  } catch { return {} }
}

export function savePrediccion({ leagueId, teamAName, teamBName, expected, picks }) {
  try {
    const all = loadAll()
    all[matchKey(leagueId, teamAName, teamBName)] = {
      ts: Date.now(),
      leagueId,
      home: teamAName,
      away: teamBName,
      expected,
      picks: (picks ?? []).map(p => ({
        label: p.label, marketKey: p.marketKey, category: p.category, dir: p.dir,
        line: p.line, pMod: p.pMod, confidence: p.confidence,
        expected: p.expected, // lo proyectado — clave para medir el sesgo después
        porque: p.porque,     // las líneas de justificación, para la tarjeta
        ...(p.cuota != null ? { cuota: p.cuota, casaCuota: p.casaCuota } : {}),
        // hándicap: lo necesario para resolverlo contra el marcador final
        ...(p.hLine != null ? { hLine: p.hLine, hSide: p.hSide } : {}),
      })),
    }
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {}
}

export function getPrediccion(leagueId, homeName, awayName) {
  const all = loadAll()
  return all[matchKey(leagueId, homeName, awayName)] ?? null
}

export function listPredicciones() {
  return Object.entries(loadAll()).map(([k, v]) => ({ key: k, ...v }))
}

// ─── Resultados resueltos (permanentes — el historial de calibración) ────────
// A diferencia de las predicciones (7 días), los resultados resueltos se
// guardan PARA SIEMPRE: son el registro de "cómo vamos" por liga y mercado.
const RES_KEY = 'motor_resultados_v1'

function loadResultados() {
  try { return JSON.parse(localStorage.getItem(RES_KEY) || '{}') } catch { return {} }
}

export function listResultados() {
  return Object.values(loadResultados()).sort((a, b) => (b.matchTs ?? 0) - (a.matchTs ?? 0))
}

export function yaResuelto(leagueId, homeName, awayName) {
  return !!loadResultados()[matchKey(leagueId, homeName, awayName)]
}

export function saveResultado(entry) {
  try {
    const all = loadResultados()
    all[matchKey(entry.leagueId, entry.home, entry.away)] = entry
    localStorage.setItem(RES_KEY, JSON.stringify(all))
  } catch {}
}

// ─── Resolver una predicción contra las stats finales (Live-Score) ───────────
// (usa numv declarado más abajo — const module-level, mismo archivo)

// homeStats/awayStats: objetos de stats normalizados del partido REAL.
// pred.home puede no coincidir con el local real (análisis con equipos volteados).
export function resolverPrediccion(pred, fixture, homeStats, awayStats) {
  const sum = key => {
    const h = numv(homeStats[key]); const a = numv(awayStats[key])
    return h != null && a != null ? h + a : null
  }
  const cardsSum = () => {
    const y = sum('Yellow Cards'); const r = sum('Red Cards')
    return y != null ? y + (r ?? 0) : null
  }

  const reales = {
    goals: (fixture.homeGoals != null && fixture.awayGoals != null) ? fixture.homeGoals + fixture.awayGoals : null,
    shots: sum('Total Shots'),
    sot: sum('Shots on Goal'),
    corners: sum('Corner Kicks'),
    cards: cardsSum(),
    fouls: sum('Fouls'),
    ti: sum('Throw Ins'),
    gk: sum('Goal Kicks'),
  }

  // Orientación: stats del equipo que la predicción llamó "local"
  const predHomeEsLocal = norm(fixture.homeTeam) === norm(pred.home)
  const statsPredHome = predHomeEsLocal ? homeStats : awayStats
  const statsPredAway = predHomeEsLocal ? awayStats : homeStats

  const REAL_POR_MARKET = {
    goles_totales: reales.goals, shots_totales: reales.shots, sot_totales: reales.sot,
    corners_totales: reales.corners, tarjetas_totales: reales.cards,
    gk_totales: reales.gk, ti_totales: reales.ti,
    tiros_local: numv(statsPredHome['Total Shots']),
    tiros_visita: numv(statsPredAway['Total Shots']),
    gk_local: numv(statsPredHome['Goal Kicks']),
    gk_visita: numv(statsPredAway['Goal Kicks']),
  }

  const picks = (pred.picks ?? []).map(p => {
    // Hándicap: se resuelve con la DIFERENCIA de goles + la línea del equipo
    if (p.hLine != null && fixture.homeGoals != null && fixture.awayGoals != null) {
      const diffPredHome = predHomeEsLocal
        ? fixture.homeGoals - fixture.awayGoals
        : fixture.awayGoals - fixture.homeGoals
      const ajustado = p.hSide === 'local' ? diffPredHome + p.hLine * -1 : -diffPredHome + p.hLine
      // hLine guarda la línea interna (diff > hLine para el local); el ajuste
      // de arriba deja: >0 cubre, <0 no cubre, 0 push
      const result = ajustado > 0 ? 'W' : ajustado < 0 ? 'L' : 'PUSH'
      return { ...p, real: diffPredHome, result }
    }
    const real = REAL_POR_MARKET[p.marketKey] ?? null
    let result = null
    if (real != null) {
      if (real === p.line) result = 'PUSH'
      else result = ((p.dir === 'OVER') === (real > p.line)) ? 'W' : 'L'
    }
    return { ...p, real, result }
  })

  // Error por mercado del expected
  const errores = {}
  for (const k of Object.keys(reales)) {
    const p = pred.expected?.[k]; const r = reales[k]
    if (p != null && r != null && p > 0) errores[k] = +((r - p) / p).toFixed(3)
  }

  return {
    leagueId: pred.leagueId,
    home: fixture.homeTeam,
    away: fixture.awayTeam,
    score: `${fixture.homeGoals ?? '?'} - ${fixture.awayGoals ?? '?'}`,
    matchTs: fixture.date ? new Date(fixture.date).getTime() : Date.now(),
    predTs: pred.ts,
    resolvedTs: Date.now(),
    expected: pred.expected,
    reales,
    errores,
    picks,
  }
}

// ── Todas las predicciones pendientes (para la pestaña de calibración) ──
export function getAllPredicciones() {
  const all = loadAll()
  return Object.entries(all)
    .map(([key, p]) => ({ key, ...p }))
    .sort((a, b) => b.ts - a.ts)
}

// ── Evaluaciones guardadas (predicción vs resultado real) — permanentes ──
export function getEvaluaciones() {
  try {
    return JSON.parse(localStorage.getItem(EVAL_KEY) || '[]')
  } catch { return [] }
}

// ─── Valor REAL de cada mercado desde las stats finales del partido ──────────
const numv = v => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return (n == null || isNaN(n)) ? null : n
}

export function actualValue(marketKey, fixture, homeStats, awayStats) {
  const h = k => numv(homeStats?.[k])
  const a = k => numv(awayStats?.[k])
  const t = k => (h(k) != null || a(k) != null) ? (h(k) ?? 0) + (a(k) ?? 0) : null
  const cards = s => {
    const y = numv(s?.['Yellow Cards']); const r = numv(s?.['Red Cards'])
    return (y != null || r != null) ? (y ?? 0) + (r ?? 0) : null
  }
  switch (marketKey) {
    case 'goles_totales':    return (fixture.homeGoals ?? 0) + (fixture.awayGoals ?? 0)
    case 'goles_local':      return fixture.homeGoals
    case 'goles_visita':     return fixture.awayGoals
    case 'shots_totales':    return t('Total Shots')
    case 'tiros_local':      return h('Total Shots')
    case 'tiros_visita':     return a('Total Shots')
    case 'sot_totales':      return t('Shots on Goal')
    case 'sot_local':        return h('Shots on Goal')
    case 'sot_visita':       return a('Shots on Goal')
    case 'corners_totales':  return t('Corner Kicks')
    case 'corners_local':    return h('Corner Kicks')
    case 'corners_visita':   return a('Corner Kicks')
    case 'tarjetas_totales': return (cards(homeStats) != null || cards(awayStats) != null) ? (cards(homeStats) ?? 0) + (cards(awayStats) ?? 0) : null
    case 'tarjetas_local':   return cards(homeStats)
    case 'tarjetas_visita':  return cards(awayStats)
    case 'ti_totales':       return t('Throw Ins')
    case 'ti_local':         return h('Throw Ins')
    case 'ti_visita':        return a('Throw Ins')
    case 'gk_totales':       return t('Goal Kicks')
    case 'gk_local':         return h('Goal Kicks')
    case 'gk_visita':        return a('Goal Kicks')
    default:                 return null // corners_1h, tiros_1h... sin dato de tiempos
  }
}

export function judge(pick, actual) {
  if (actual == null) return { res: 'sin_dato' }
  if (actual === pick.line) return { res: 'push' }
  const over = actual > pick.line
  const won = (pick.dir === 'OVER') === over
  return { res: won ? 'ganada' : 'perdida', actual }
}

// Marcar/corregir a mano el resultado de un pick evaluado
export function setPickResult(evalKey, idx, res) {
  try {
    const all = getEvaluaciones()
    const e = all.find(x => x.key === evalKey)
    if (!e?.picks?.[idx]) return
    e.picks[idx].res = res
    e.picks[idx].manual = true
    localStorage.setItem(EVAL_KEY, JSON.stringify(all))
  } catch {}
}

// Pasar una predicción pendiente a evaluada SIN datos de la API (para marcarla a mano)
export function evaluarManual(pendKey) {
  const p = loadAll()[pendKey]
  if (!p) return
  saveEvaluacion({
    key: pendKey, ts: p.ts, evalTs: Date.now(),
    leagueId: p.leagueId, home: p.home, away: p.away,
    score: null, manual: true,
    picks: (p.picks ?? []).map(pk => ({ ...pk, res: 'sin_dato' })),
  })
}

export function saveEvaluacion(ev) {
  try {
    const all = getEvaluaciones()
    // no duplicar el mismo partido
    if (all.some(e => e.key === ev.key)) return
    all.unshift(ev)
    localStorage.setItem(EVAL_KEY, JSON.stringify(all.slice(0, 300)))
    // sacar de pendientes
    const pend = loadAll()
    delete pend[ev.key]
    localStorage.setItem(KEY, JSON.stringify(pend))
  } catch {}
}
