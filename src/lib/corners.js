// ─── Módulo cuantitativo de CÓRNERS LIVE ─────────────────────────────────────
//
// Mismo principio que throwins.js/goalkicks.js: Datos → Modelo → Probabilidad →
// Incertidumbre → Línea → Edge → Decisión. NO BET válido y frecuente.
//
// DEFINICIÓN (§1 del spec): usamos "Corner Kicks" de Live-Score (dato directo
// EN VIVO por equipo — el mejor de los tres mercados de saques) = córners
// EJECUTADOS por ese equipo. Sofascore coincide en definición (±0 típico).
// No mezclamos fuentes en un mismo partido.
//
// CAUSALIDAD (§3): generación ≠ promedio simple. El prior usa la interacción
// ataque×defensa-rival de calcExpectedCorners (60% córners que A genera + 40%
// que B concede, con Tactical_K por estilo REAL de centros de Sofascore) — un
// equipo llega al córner por: centro/tiro BLOQUEADO, despeje del defensor,
// parada al córner. Drivers live disponibles:
//   - Ataques peligrosos/min (proxy de presión sostenida en el último tercio)
//   - Tiros bloqueados (el generador mecánico más directo que tenemos)
//   - Marcador × minuto: la evidencia AQUÍ SÍ es fuerte (el que pierde ataca →
//     córners suben; Situation S del motor: 0.82–1.28)
//
// SIN FUENTE (peso CERO): ataques por banda izquierda/derecha, centros EN VIVO,
// entradas al área, toques en área, posesión territorial, despejes, alineación
// como coeficiente. Se documenta en docs/modelo-corners.md.
//
// MODELADO POR EQUIPO (§21): cada lado tiene su propia tasa, su propio estado
// de marcador y su propio régimen; el total = suma. Eso habilita mercados de
// córners local/visitante y hándicap, y el "próximo córner" (§22) como carrera
// de Poisson entre las dos tasas.

import { poissonOver, getSituationS } from './engine'
import { nbOver, makeLiveLog } from './throwins'
import { restanteEfectivo, regimeOf, pressureFactor, redCardFactor } from './match-state'
import { evaluarMercado } from './market-engine'

// ── Constantes (recalibrables con el live-backtest local) ────────────────────
export const CORNER_MODEL = {
  K_CRED: 28,          // los córners señalizan rápido el carácter del partido
  MIN_EFECTIVOS: 95,
  PHI: 1.30,           // sobredispersión NB del total
  PHI_TEAM: 1.25,      // por equipo
  REGIME_MIN_SPAN: 8,
  REGIME_CLAMP: [0.85, 1.15],
  REGIME_SOFT: 0.5,
  DA_BASE: 1.1,        // ataques peligrosos/min típicos de un partido parejo
  DA_CLAMP: [0.88, 1.12],  // presión sostenida acotada ±12%, medio peso
  BLK_CLAMP: [0.92, 1.10], // tiros bloqueados: señal directa pero muestra chica
  STATE_SOFT: 0.7,     // Situation S entra al 70% (0.82-1.28 → ~0.87-1.19)
  EDGE_MIN: 0.04,
  MIN_MINUTO: 10,      // córners arrancan a señalizar antes que TI/GK
}

const num = v => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return (n == null || isNaN(n)) ? null : n
}

// ─── PRIOR PREPARTIDO (por equipo + total) ───────────────────────────────────
// Interacción de calcExpectedCorners (con Tactical_K de estilo por centros y
// kCorners de liga) mezclada 50/50 con la mediana empírica de totales.
export function cornersPrior(preA, preB, league) {
  if (!preA || !preB) return null
  const kLiga = league?.kCorners ?? 1.0

  const K_STYLE = { bandas: 1.15, 'mixto-bandas': 1.07, mixto: 1.0, central: 0.92 }
  const baseA = (preA.corners_avg * 0.6 + preB.corners_against_avg * 0.4) * (K_STYLE[preA.style] ?? 1) * kLiga
  const baseB = (preB.corners_avg * 0.6 + preA.corners_against_avg * 0.4) * (K_STYLE[preB.style] ?? 1) * kLiga

  // Totales empíricos (córners casi siempre existen en el historial)
  const totals = []
  for (const t of [preA, preB]) {
    for (const r of (t.last10 ?? [])) {
      const c = num(r.corners); const ag = num(r.cornersAg)
      if (c != null && ag != null) totals.push(c + ag)
    }
  }
  let empTotal = null, empSd = null
  if (totals.length >= 4) {
    const sorted = [...totals].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    empTotal = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
    const mean = totals.reduce((s, x) => s + x, 0) / totals.length
    empSd = Math.sqrt(totals.reduce((s, x) => s + (x - mean) ** 2, 0) / (totals.length - 1))
  }

  const interTotal = baseA + baseB
  const total = empTotal != null ? interTotal * 0.5 + empTotal * 0.5 : interTotal
  // El ajuste empírico se reparte proporcional entre los dos lados
  const scale = interTotal > 0 ? total / interTotal : 1
  const expA = baseA * scale
  const expB = baseB * scale
  const sd = empSd != null ? Math.max(2.5, empSd) : Math.max(3, total * 0.28)

  const sample = (preA.statsMatches ?? 0) + (preB.statsMatches ?? 0)
  return {
    total: +total.toFixed(1),
    expA: +expA.toFixed(1), expB: +expB.toFixed(1),
    perMinA: +(expA / CORNER_MODEL.MIN_EFECTIVOS).toFixed(4),
    perMinB: +(expB / CORNER_MODEL.MIN_EFECTIVOS).toFixed(4),
    sd: +sd.toFixed(1),
    empTotal, interTotal: +interTotal.toFixed(1),
    sample, totalsN: totals.length,
    estimado: sample < 12,
  }
}

// ─── MODELO LIVE (por equipo → total) ────────────────────────────────────────
// acumH/acumA: córners por lado (si solo hay total, se reparte por el prior).
// daTotal: ataques peligrosos. blkTotal: tiros bloqueados. reds {h,a}: rojas →
// cambio ESTRUCTURAL: el lado con 10 genera ×0.80, su rival ×1.08 (match-state).
// Régimen/presión/restante vienen del MATCH STATE ENGINE.
export function cornersLiveModel({ minuto, acumH = null, acumA = null, acumTotal = null, goalDiff = 0, snaps = [], prior = null, daTotal = null, blkTotal = null, reds = null }) {
  if (minuto == null || minuto < 1) return null
  // Resolver acumulados: por lado o repartiendo el total según el prior
  let h = acumH; let a = acumA
  if (h == null || a == null) {
    if (acumTotal == null) return null
    const fr = prior ? prior.expA / Math.max(0.1, prior.expA + prior.expB) : 0.5
    h = Math.round(acumTotal * fr); a = acumTotal - h
  }
  const acum = h + a

  const restEff = restanteEfectivo(minuto)

  // Presión sostenida: ataques peligrosos/min vs baseline (Match State Engine)
  const press = pressureFactor(daTotal, minuto, { base: CORNER_MODEL.DA_BASE, clamp: CORNER_MODEL.DA_CLAMP })
  const daFactor = press.factor
  const daObs = press.obs
  // Tiros bloqueados: generador mecánico (centro/tiro bloqueado → córner).
  // Baseline ~0.09/min (≈8.5 bloqueados/95min en un partido típico).
  let blkFactor = 1; let blkObs = null
  if (blkTotal != null && minuto >= 15) {
    blkObs = blkTotal / minuto
    const [lo, hi] = CORNER_MODEL.BLK_CLAMP
    blkFactor = Math.pow(Math.min(hi, Math.max(lo, blkObs / 0.09)), 0.5)
  }

  const mkSide = (acumSide, ratePriorSide, diffSide, key, redF) => {
    const rateObs = acumSide / minuto
    const K = ratePriorSide != null ? CORNER_MODEL.K_CRED : CORNER_MODEL.K_CRED / 2
    const wObs = minuto / (minuto + K)
    const rateBlend = ratePriorSide != null ? wObs * rateObs + (1 - wObs) * ratePriorSide : rateObs
    // Situation S del motor (evidencia fuerte en córners), suavizada al 70%
    const S = getSituationS(diffSide)
    const state = Math.pow(S, CORNER_MODEL.STATE_SOFT)
    const regime = regimeOf(snaps, key, acumSide, minuto, {
      span: CORNER_MODEL.REGIME_MIN_SPAN, clamp: CORNER_MODEL.REGIME_CLAMP, soft: CORNER_MODEL.REGIME_SOFT,
    })
    const muRest = rateBlend * restEff * state * regime.factor * daFactor * blkFactor * redF
    return {
      redF,
      acum: acumSide,
      rateObs: +rateObs.toFixed(3),
      ratePrior: ratePriorSide,
      wObs: +wObs.toFixed(2),
      state: +state.toFixed(3),
      regime,
      muRest: +muRest.toFixed(2),
      expectedFinal: +(acumSide + muRest).toFixed(1),
      pOver: line => line <= acumSide ? 1 : nbOver(muRest, line - acumSide, CORNER_MODEL.PHI_TEAM),
    }
  }

  // goalDiff visto desde el local: local pierde → su S sube; visita al revés.
  // Rojas: factor estructural de generación por lado.
  const redH = redCardFactor(reds?.h ?? 0, reds?.a ?? 0)
  const redA = redCardFactor(reds?.a ?? 0, reds?.h ?? 0)
  const home = mkSide(h, prior?.perMinA ?? null, goalDiff, 'ch', redH)
  const away = mkSide(a, prior?.perMinB ?? null, -goalDiff, 'ca', redA)

  const muRest = home.muRest + away.muRest
  const expectedFinal = acum + muRest
  const naiveFinal = acum + (acum / minuto) * restEff

  const q = (p) => {
    let k = 0
    const cap = Math.ceil(muRest + 6 * Math.sqrt(CORNER_MODEL.PHI * muRest)) + 2
    while (k < cap && 1 - nbOver(muRest, k + 0.5, CORNER_MODEL.PHI) < p) k++
    return acum + k
  }

  // Próximo córner (§22): carrera de Poisson entre las tasas actuales
  const rateNow = restEff > 0 ? muRest / restEff : 0
  const nextCorner = rateNow > 0 ? {
    pHome: +(home.muRest / muRest).toFixed(2),
    pAway: +(away.muRest / muRest).toFixed(2),
    pNone10: +Math.exp(-rateNow * Math.min(10, restEff)).toFixed(2),
  } : null

  return {
    minuto, acum, acumH: h, acumA: a, restEff,
    rateObs: +(acum / minuto).toFixed(3),
    hayRoja: (reds?.h ?? 0) + (reds?.a ?? 0) > 0,
    reds,
    home, away,
    daFactor: +daFactor.toFixed(3), daObs: daObs != null ? +daObs.toFixed(2) : null,
    blkFactor: +blkFactor.toFixed(3), blkObs: blkObs != null ? +blkObs.toFixed(2) : null,
    muRest: +muRest.toFixed(2),
    expectedFinal: +expectedFinal.toFixed(1),
    naiveFinal: +naiveFinal.toFixed(1),
    interval: [q(0.10), q(0.90)],
    // P(Over) para las tres variantes del mercado
    pOver: line => line <= acum ? 1 : nbOver(muRest, line - acum, CORNER_MODEL.PHI),
    pOverHome: home.pOver,
    pOverAway: away.pOver,
    nextCorner,
  }
}

// ─── CONFIANZA (0-100) ───────────────────────────────────────────────────────
export function cornersConfidence({ model, prior, fuente, snapsN = 0 }) {
  if (!model) return { score: 0, parts: [] }
  const parts = []
  let score = 25

  if (fuente === 'api')       { score += 22; parts.push(['+22', 'córners en vivo de Live-Score por equipo (el dato más confiable del motor)']) }
  else if (fuente === 'manual') { score += 8; parts.push(['+8', 'córners ingresados a mano (sin refresco automático)']) }

  const mMin = Math.min(20, Math.round((model.minuto / 90) * 26))
  score += mMin; parts.push([`+${mMin}`, `minuto ${model.minuto}' — peso del observado ${Math.round(model.home.wObs * 100)}%`])
  if (model.minuto < CORNER_MODEL.MIN_MINUTO) { score -= 15; parts.push(['-15', `antes del ${CORNER_MODEL.MIN_MINUTO}' el ritmo es ruido`]) }

  if (prior && !prior.estimado && prior.sample >= 14) { score += 12; parts.push(['+12', `prior sólido: ${prior.sample} partidos con córners reales`]) }
  else if (prior && prior.sample >= 8) { score += 7; parts.push(['+7', `prior parcial: ${prior.sample} partidos`]) }
  else if (prior) { score += 2; parts.push(['+2', 'prior con muestra corta']) }
  else { score -= 8; parts.push(['-8', 'sin prior prepartido — solo ritmo observado']) }

  if (snapsN >= 3) { score += 5; parts.push(['+5', `${snapsN} snapshots — el cambio de ritmo es medible`]) }
  if (model.daObs != null) { score += 4; parts.push(['+4', 'presión medible por ataques peligrosos']) }
  if (model.blkObs != null) { score += 3; parts.push(['+3', 'tiros bloqueados disponibles (generador directo)']) }

  if (model.hayRoja) { score -= 5; parts.push(['-5', 'roja en cancha — régimen menos predecible (sin validar)']) }

  const dis = Math.abs(model.expectedFinal - model.naiveFinal) / Math.max(1, model.expectedFinal)
  if (dis < 0.06) { score += 8; parts.push(['+8', 'modelo y ritmo puro coinciden (predicción estable)']) }
  else if (dis > 0.18) { score -= 6; parts.push(['-6', 'modelo y ritmo puro difieren >18% (situación ambigua)']) }

  return { score: Math.min(92, Math.max(5, Math.round(score))), parts }
}

// ─── EDGE vs LÍNEA — delega en el MARKET ENGINE unificado ────────────────────
export function cornersEdge({ model, market = 'total', line, oddsOver, oddsUnder = null, confidence }) {
  if (!model) return null
  const pFn = market === 'local' ? model.pOverHome : market === 'visitante' ? model.pOverAway : model.pOver
  const res = evaluarMercado({
    pOverFn: pFn, line, oddsOver, oddsUnder, confidence,
    minuto: model.minuto, minMinuto: CORNER_MODEL.MIN_MINUTO,
    extras: [
      { cond: model.minuto < 20, pp: 0.02, why: "antes del 20' → +2pp" },
      { cond: market !== 'total', pp: 0.01, why: 'mercado por equipo (más varianza) → +1pp' },
      // Red Card Regime (v3 §25): recalcula estructural + sube exigencia,
      // sin bloquear — el efecto en córners aún no está validado con datos
      { cond: model.hayRoja, pp: 0.02, why: 'roja: régimen sin validar → +2pp' },
    ],
  })
  return res ? { ...res, market } : null
}

// ─── EXPLICABILIDAD ──────────────────────────────────────────────────────────
export function cornersFactores({ model, prior, goalDiff, homeName = 'Local', awayName = 'Visitante' }) {
  if (!model) return { up: [], down: [] }
  const up = []; const down = []

  for (const [side, name, diff] of [[model.home, homeName, goalDiff], [model.away, awayName, -goalDiff]]) {
    if (side.ratePrior != null) {
      const d = (side.rateObs - side.ratePrior) / side.ratePrior
      if (d > 0.25) up.push(`${name} genera córners muy por encima de su esperado (${side.rateObs}/min vs ${side.ratePrior}/min)`)
      else if (d < -0.25) down.push(`${name} genera menos córners que su esperado (${side.rateObs}/min vs ${side.ratePrior}/min)`)
    }
    if (side.state > 1.05) up.push(`${name} ${diff < 0 ? 'pierde y está obligado a atacar' : 'empuja'} → Situation S ×${side.state}`)
    else if (side.state < 0.95) down.push(`${name} administra la ventaja → Situation S ×${side.state}`)
    if (side.regime?.detected) {
      if (side.regime.dir === 'up') up.push(`${name}: ritmo reciente de córners subiendo (últimos ${side.regime.span}')`)
      else if (side.regime.dir === 'down') down.push(`${name}: ritmo reciente de córners bajando (últimos ${side.regime.span}')`)
    }
  }
  if (model.hayRoja) {
    if ((model.reds?.h ?? 0) > 0) { down.push(`⚠️ ROJA a ${homeName} — con 10 genera ×${model.home.redF}`); up.push(`${awayName} domina contra 10 → generación ×${model.away.redF}`) }
    if ((model.reds?.a ?? 0) > 0) { down.push(`⚠️ ROJA a ${awayName} — con 10 genera ×${model.away.redF}`); up.push(`${homeName} domina contra 10 → generación ×${model.home.redF}`) }
  }
  if (model.daFactor > 1.03) up.push(`Presión sostenida alta: ${model.daObs} ataques peligrosos/min (baseline ${CORNER_MODEL.DA_BASE})`)
  else if (model.daFactor < 0.97) down.push(`Partido frío: ${model.daObs} ataques peligrosos/min (baseline ${CORNER_MODEL.DA_BASE})`)
  if (model.blkFactor > 1.02) up.push(`Muchos tiros bloqueados (${model.blkObs}/min) — el bloqueo es el generador mecánico del córner`)
  else if (model.blkFactor < 0.98) down.push(`Pocos tiros bloqueados (${model.blkObs}/min) — las llegadas no están terminando en rebote`)
  if (prior?.estimado) down.push('Prior con muestra corta — más incertidumbre')
  if (model.minuto < 20) down.push('Pocos minutos jugados — el ritmo observado pesa poco todavía')

  return { up, down }
}

// ─── LIVE-BACKTEST (registro por minuto, resolución vía Live-Score) ──────────
const cornersLog = makeLiveLog('motor_corners_livelog_v1')
export const logCornersSnapshot = (matchId, info, model) => cornersLog.logSnapshot(matchId, info, model)
export const resolveCornersLog = (matchId, finalTotal) => cornersLog.resolve(matchId, finalTotal)
export const cornersLogPending = () => cornersLog.pending()
export const cornersBacktestSummary = () => cornersLog.summary()
