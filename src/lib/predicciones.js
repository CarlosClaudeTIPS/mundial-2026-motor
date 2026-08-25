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
        label: p.label, marketKey: p.marketKey, dir: p.dir,
        line: p.line, pMod: p.pMod, confidence: p.confidence,
        expected: p.expected, // lo proyectado — clave para medir el sesgo después
      })),
    }
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {}
}

export function getPrediccion(leagueId, homeName, awayName) {
  const all = loadAll()
  return all[matchKey(leagueId, homeName, awayName)] ?? null
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
