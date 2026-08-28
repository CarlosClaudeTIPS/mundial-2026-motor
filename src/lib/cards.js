// ─── Módulo cuantitativo de TARJETAS LIVE ────────────────────────────────────
//
// Arquitectura PREMATCH/LIVE global: prior congelable (baseline.js) →
// actualización bayesiana live sobre el MATCH STATE ENGINE → NB → dos edges.
//
// DEFINICIÓN (§1): Live-Score reporta "Yellow Cards" y "Red Cards" por equipo
// (jugadores; las de cuerpo técnico no siempre entran — puede diferir ±1 del
// bookie, la confianza lo refleja). Total del mercado = amarillas + rojas,
// igual que cuenta la mayoría de casas (roja directa = 1, segunda amarilla
// suele contar la amarilla y la roja según la casa — VERIFICAR la regla de tu
// bookie; aquí contamos Y+R del proveedor).
//
// CAUSALIDAD (§5): cadena fricción → faltas → tarjetas. NO "más faltas = más
// tarjetas proporcional": cada equipo tiene su tasa cards/foul propia y el
// árbitro modula. Disciplina PROPIA separada de la PROVOCADA (§3): las
// tarjetas esperadas de A = 60% su historial disciplinario + 40% lo que B
// suele provocar en sus rivales.
//
// HAZARD TEMPORAL (§17): las tarjetas NO caen uniformes — se concentran al
// final (fricción acumulada + desespero + pérdida de tiempo). El modelo usa
// una curva de intensidad acumulada H(min) en vez de extrapolación lineal:
// 4 tarjetas al 30' NO proyectan 12 — proyectan contra lo que "debería" haber
// caído a esa altura.
//
// ÁRBITRO (§11): amarillas/partido reales de Sofascore (fetchSofaContexto),
// factor acotado 0.80-1.25 vs baseline 4.2. La interacción árbitro×equipos
// fina (§13) no tiene fuente → el factor es global y recalibrable.
//
// SIN FUENTE (peso CERO): tipo/zona de falta, duelos, tackles, PPDA,
// transiciones, VAR, posición del amonestado, perfil por jugador. Los
// AMONESTADOS (Sofascore incidents) se muestran como riesgo cualitativo de
// segunda amarilla — sin coeficiente inventado.

import { calcExpectedFouls } from './engine'
import { nbOver, makeLiveLog } from './throwins'
import { restanteEfectivo, regimeOf } from './match-state'
import { evaluarMercado } from './market-engine'

export const CARDS_MODEL = {
  K_CRED: 38,        // ~5 tarjetas/partido → el conteo observado es ruidoso; el prior aguanta
  PHI: 1.20,
  PHI_TEAM: 1.15,
  REGIME_MIN_SPAN: 10,
  REGIME_CLAMP: [0.85, 1.15],
  REGIME_SOFT: 0.5,
  FOULS_BASE_CLAMP: [0.88, 1.12], // señal causal de faltas acotada ±12%, ^0.5
  REF_BASE: 4.2,     // amarillas/partido típicas de un árbitro promedio
  REF_CLAMP: [0.80, 1.25],
  EDGE_MIN: 0.04,
  MIN_MINUTO: 15,    // las tarjetas señalizan LENTO (pocas y tardías)
  RATE_DEFAULT: 0.18, // tarjeta por falta típica
}

const num = v => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return (n == null || isNaN(n)) ? null : n
}
const median = arr => {
  const v = arr.filter(x => x != null && !isNaN(x))
  if (!v.length) return null
  const s = [...v].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// ─── HAZARD TEMPORAL: fracción acumulada de tarjetas esperada al minuto m ────
// Curva empírica (fútbol profesional): 1T ~38%, 2T ~62%, con el tramo 75-final
// como el más cargado. Piecewise-lineal sobre 95' efectivos.
const HAZARD = [ // [hasta_min, share_acumulado]
  [15, 0.09], [30, 0.21], [48, 0.38], [60, 0.53], [75, 0.73], [95, 1.00],
]
export function hazardShare(minuto) {
  if (minuto == null || minuto <= 0) return 0
  const m = Math.min(95, minuto)
  let prevMin = 0; let prevSh = 0
  for (const [hi, sh] of HAZARD) {
    if (m <= hi) return prevSh + (sh - prevSh) * ((m - prevMin) / (hi - prevMin))
    prevMin = hi; prevSh = sh
  }
  return 1
}

// ─── PRIOR PREPARTIDO (por equipo + árbitro) ─────────────────────────────────
export function cardsPrior(preA, preB, { refYellowPg = null } = {}) {
  if (!preA || !preB) return null

  // Cadena causal: faltas esperadas del cruce × tasa tarjeta/falta propia
  const fouls = calcExpectedFouls(preA, preB)
  const causal = (own, expF) => expF * (own.cardsPerFoul ?? CARDS_MODEL.RATE_DEFAULT)

  // Disciplina propia (50/50 causal+promedio) + lo que el rival PROVOCA (§3)
  const provoca = t => median((t.last10 ?? []).map(r => num(r.cardsAg))) // tarjetas que ven sus rivales
  const side = (own, rival, expF) => {
    const propia = causal(own, expF) * 0.5 + (own.cards_avg ?? 2) * 0.5
    const prov = provoca(rival)
    return prov != null ? propia * 0.6 + prov * 0.4 : propia
  }
  let expA = side(preA, preB, fouls.expFoulsA)
  let expB = side(preB, preA, fouls.expFoulsB)

  // Árbitro: amarillas/partido reales (Sofascore) vs baseline — factor global
  let refFactor = 1; let refUsado = false
  if (refYellowPg != null && refYellowPg > 0) {
    const [lo, hi] = CARDS_MODEL.REF_CLAMP
    refFactor = Math.min(hi, Math.max(lo, refYellowPg / CARDS_MODEL.REF_BASE))
    refUsado = true
    expA *= refFactor; expB *= refFactor
  }

  // Ancla empírica de totales
  const totals = []
  for (const t of [preA, preB]) {
    for (const r of (t.last10 ?? [])) {
      const c = num(r.cards); const ag = num(r.cardsAg)
      if (c != null && ag != null) totals.push(c + ag)
    }
  }
  const empTotal = totals.length >= 4 ? median(totals) : null
  let empSd = null
  if (totals.length >= 4) {
    const mean = totals.reduce((s, x) => s + x, 0) / totals.length
    empSd = Math.sqrt(totals.reduce((s, x) => s + (x - mean) ** 2, 0) / (totals.length - 1))
  }
  const interTotal = expA + expB
  const total = empTotal != null ? interTotal * 0.6 + empTotal * refFactor * 0.4 : interTotal
  const scale = interTotal > 0 ? total / interTotal : 1

  const sample = (preA.statsMatches ?? 0) + (preB.statsMatches ?? 0)
  return {
    total: +total.toFixed(1),
    expA: +(expA * scale).toFixed(1),
    expB: +(expB * scale).toFixed(1),
    sd: empSd != null ? +Math.max(1.5, empSd).toFixed(1) : +Math.max(1.8, total * 0.35).toFixed(1),
    foulsExp: +fouls.total.toFixed(1),
    foulsRate: +(fouls.total / 95).toFixed(3),
    refFactor: +refFactor.toFixed(2), refUsado, refYellowPg,
    empTotal, interTotal: +interTotal.toFixed(1),
    sample,
    estimado: sample < 12,
  }
}

// ─── Estado del partido para tarjetas ────────────────────────────────────────
// Cerrado tarde = fricción/desespero/pérdida de tiempo ↑. Resuelto tarde ↓.
// El lado que PIERDE arriesga más (faltas tácticas + protestas).
function stateFactorSide(diffSide, minuto) {
  let f = 1
  const ad = Math.abs(diffSide)
  if (minuto >= 65 && ad <= 1) f *= 1.10
  else if (minuto >= 65 && ad >= 2) f *= 0.94
  if (diffSide < 0) f *= 1.05 // perdiendo → más fricción
  return Math.min(1.18, Math.max(0.90, f))
}

// ─── MODELO LIVE ─────────────────────────────────────────────────────────────
// cH/cA: tarjetas por lado (Y+R). foulsH/foulsA: faltas por lado.
// booked: { h: [..], a: [..] } amonestados (Sofascore) — SOLO display/factores.
export function cardsLiveModel({ minuto, cH = null, cA = null, yH = null, yA = null, rH = 0, rA = 0, foulsH = null, foulsA = null, goalDiff = 0, snaps = [], prior = null, booked = null }) {
  if (minuto == null || minuto < 1 || cH == null || cA == null) return null

  const restEff = restanteEfectivo(minuto)
  const H = Math.max(0.06, hazardShare(minuto))   // fracción "que ya debió caer"
  const restShare = Math.max(0, 1 - hazardShare(minuto))
  const acum = cH + cA

  // Señal causal: ritmo de faltas vs esperado del cruce
  let foulsFactor = 1; let foulsObs = null
  const foulsTot = (foulsH != null || foulsA != null) ? (foulsH ?? 0) + (foulsA ?? 0) : null
  if (foulsTot != null && prior?.foulsRate && minuto >= 12) {
    foulsObs = +(foulsTot / minuto).toFixed(3)
    const [lo, hi] = CARDS_MODEL.FOULS_BASE_CLAMP
    foulsFactor = Math.pow(Math.min(hi, Math.max(lo, foulsObs / prior.foulsRate)), 0.5)
  }

  const regime = regimeOf(snaps, 'c', acum, minuto, {
    span: CARDS_MODEL.REGIME_MIN_SPAN, clamp: CARDS_MODEL.REGIME_CLAMP, soft: CARDS_MODEL.REGIME_SOFT,
  })

  // Por lado: estimar el NIVEL del partido vía hazard (no extrapolación lineal):
  // totalEst = w·(acum_lado / H) + (1−w)·prior_lado → restante = totalEst × restShare
  const mkSide = (acumSide, priorSide, diffSide) => {
    const wObs = minuto / (minuto + CARDS_MODEL.K_CRED)
    const obsLevel = acumSide / H
    const totalEst = priorSide != null ? wObs * obsLevel + (1 - wObs) * priorSide : obsLevel
    const state = stateFactorSide(diffSide, minuto)
    const muRest = Math.max(0, totalEst * restShare * state * foulsFactor * regime.factor)
    return {
      acum: acumSide,
      priorSide,
      wObs: +wObs.toFixed(2),
      state: +state.toFixed(3),
      muRest: +muRest.toFixed(2),
      expectedFinal: +(acumSide + muRest).toFixed(1),
      pOver: line => line <= acumSide ? 1 : nbOver(muRest, line - acumSide, CARDS_MODEL.PHI_TEAM),
    }
  }

  const home = mkSide(cH, prior?.expA ?? null, goalDiff)
  const away = mkSide(cA, prior?.expB ?? null, -goalDiff)

  const muRest = home.muRest + away.muRest
  const expectedFinal = acum + muRest
  const naiveFinal = minuto > 0 ? acum + (acum / minuto) * restEff : acum

  const q = (p) => {
    let k = 0
    const cap = Math.ceil(muRest + 6 * Math.sqrt(CARDS_MODEL.PHI * muRest)) + 2
    while (k < cap && 1 - nbOver(muRest, k + 0.5, CARDS_MODEL.PHI) < p) k++
    return acum + k
  }

  // Próxima tarjeta (§28): carrera entre las tasas actuales por lado
  const rateNow = restEff > 0 ? muRest / restEff : 0
  const nextCard = rateNow > 0 ? {
    pHome: +(home.muRest / muRest).toFixed(2),
    pAway: +(away.muRest / muRest).toFixed(2),
    pNone10: +Math.exp(-rateNow * Math.min(10, restEff)).toFixed(2),
  } : null

  const bookedH = booked?.home?.filter(b => b.type === 'yellow').length ?? null
  const bookedA = booked?.away?.filter(b => b.type === 'yellow').length ?? null

  return {
    minuto, acum, acumH: cH, acumA: cA, restEff,
    yH, yA, rH, rA,
    hayRoja: (rH ?? 0) + (rA ?? 0) > 0,
    hazardH: +H.toFixed(2), restShare: +restShare.toFixed(2),
    rateObs: +(acum / minuto).toFixed(3),
    foulsTot, foulsObs, foulsFactor: +foulsFactor.toFixed(3),
    regime,
    home, away,
    booked, bookedH, bookedA,
    muRest: +muRest.toFixed(2),
    expectedFinal: +expectedFinal.toFixed(1),
    naiveFinal: +naiveFinal.toFixed(1),
    interval: [q(0.10), q(0.90)],
    pOver: line => line <= acum ? 1 : nbOver(muRest, line - acum, CARDS_MODEL.PHI),
    pOverHome: home.pOver,
    pOverAway: away.pOver,
    nextCard,
  }
}

// ─── CONFIANZA ───────────────────────────────────────────────────────────────
export function cardsConfidence({ model, prior, fuente, snapsN = 0 }) {
  if (!model) return { score: 0, parts: [] }
  const parts = []
  let score = 25

  if (fuente === 'api')       { score += 20; parts.push(['+20', 'tarjetas en vivo de Live-Score por equipo (dato directo)']) }
  else if (fuente === 'manual') { score += 8; parts.push(['+8', 'tarjetas ingresadas a mano']) }

  const mMin = Math.min(18, Math.round((model.minuto / 90) * 24))
  score += mMin; parts.push([`+${mMin}`, `minuto ${model.minuto}' — peso del observado ${Math.round(model.home.wObs * 100)}%`])
  if (model.minuto < CARDS_MODEL.MIN_MINUTO) { score -= 15; parts.push(['-15', `antes del ${CARDS_MODEL.MIN_MINUTO}' las tarjetas casi no señalizan`]) }

  if (prior?.refUsado) { score += 8; parts.push(['+8', `árbitro con dato real: ${prior.refYellowPg} amarillas/partido (factor ×${prior.refFactor})`]) }
  else { score -= 4; parts.push(['-4', 'sin dato del árbitro — variable de alto impacto ausente']) }

  if (prior && !prior.estimado && prior.sample >= 14) { score += 10; parts.push(['+10', `prior sólido: ${prior.sample} partidos`]) }
  else if (prior && prior.sample >= 8) { score += 6; parts.push(['+6', `prior parcial: ${prior.sample} partidos`]) }
  else if (prior) { score += 2; parts.push(['+2', 'prior con muestra corta']) }
  else { score -= 8; parts.push(['-8', 'sin prior prepartido']) }

  if (model.foulsObs != null) { score += 5; parts.push(['+5', 'faltas en vivo disponibles (driver causal medible)']) }
  if (snapsN >= 3) { score += 4; parts.push(['+4', `${snapsN} snapshots — régimen medible`]) }
  if (model.booked) { score += 3; parts.push(['+3', 'amonestados identificados (Sofascore)']) }
  if (model.hayRoja) { score -= 5; parts.push(['-5', 'roja en cancha — partido menos predecible']) }

  const dis = Math.abs(model.expectedFinal - model.naiveFinal) / Math.max(1, model.expectedFinal)
  if (dis > 0.25) { score -= 4; parts.push(['-4', 'hazard y ritmo puro difieren mucho (situación ambigua)']) }

  return { score: Math.min(90, Math.max(5, Math.round(score))), parts }
}

// ─── EDGE — delega en el MARKET ENGINE unificado ─────────────────────────────
export function cardsEdge({ model, market = 'total', line, oddsOver, oddsUnder = null, confidence }) {
  if (!model) return null
  const P = { total: model.pOver, local: model.pOverHome, visitante: model.pOverAway }[market]
  if (!P) return null
  const res = evaluarMercado({
    pOverFn: P, line, oddsOver, oddsUnder, confidence,
    minuto: model.minuto, minMinuto: CARDS_MODEL.MIN_MINUTO,
    extras: [
      { cond: model.minuto < 25, pp: 0.02, why: "antes del 25' → +2pp (tarjetas señalizan tarde)" },
      { cond: market !== 'total', pp: 0.015, why: 'mercado por equipo → +1.5pp' },
    ],
    // ABSTENCIÓN (revisión §14): con roja el partido cambió de naturaleza y el
    // modelo de tarjetas no tiene datos para ese régimen → no confiar
    abstenciones: [
      { cond: model.hayRoja, why: 'roja en cancha — el modelo no está validado para partidos con expulsión' },
    ],
  })
  return res ? { ...res, market } : null
}

// ─── EXPLICABILIDAD ──────────────────────────────────────────────────────────
export function cardsFactores({ model, prior, goalDiff, homeName = 'Local', awayName = 'Visitante' }) {
  if (!model) return { up: [], down: [] }
  const up = []; const down = []

  if (prior?.refUsado) {
    if (prior.refFactor >= 1.10) up.push(`Árbitro estricto: ${prior.refYellowPg} amarillas/partido (factor ×${prior.refFactor})`)
    else if (prior.refFactor <= 0.92) down.push(`Árbitro permisivo: ${prior.refYellowPg} amarillas/partido (factor ×${prior.refFactor})`)
  } else down.push('Sin dato del árbitro — el factor de mayor impacto potencial está ausente')

  if (model.foulsObs != null && prior?.foulsRate) {
    const d = model.foulsObs / prior.foulsRate
    if (d >= 1.15) up.push(`Fricción alta: ${model.foulsObs} faltas/min vs ${prior.foulsRate} esperado — la cadena faltas→tarjetas empuja`)
    else if (d <= 0.85) down.push(`Partido limpio: ${model.foulsObs} faltas/min vs ${prior.foulsRate} esperado`)
  }
  for (const [side, name, diff] of [[model.home, homeName, goalDiff], [model.away, awayName, -goalDiff]]) {
    if (side.state >= 1.08) up.push(`${name}: ${diff < 0 ? 'pierde — faltas tácticas y protestas suben' : 'partido cerrado en tramo final'} (×${side.state})`)
    else if (side.state <= 0.95) down.push(`${name}: partido resuelto — baja la fricción (×${side.state})`)
  }
  if (model.minuto < 60) up.push(`Hazard: el ${Math.round(model.restShare * 100)}% de las tarjetas de un partido típico cae después del minuto ${model.minuto} — el tramo final es el cargado`)
  if (model.regime?.detected) {
    if (model.regime.dir === 'up') up.push(`Ritmo de tarjetas reciente subiendo (últimos ${model.regime.span}')`)
    else down.push(`Ritmo de tarjetas reciente bajando (últimos ${model.regime.span}')`)
  }
  if ((model.bookedH ?? 0) + (model.bookedA ?? 0) >= 3) up.push(`${model.bookedH + model.bookedA} jugadores ya amonestados — riesgo de segunda amarilla (cualitativo, sin peso en el número)`)
  if (model.hayRoja) up.push('🟥 Roja en cancha — partidos con expulsión tienden a más fricción (y más incertidumbre)')
  if (prior?.estimado) down.push('Prior con muestra corta — más incertidumbre')

  return { up, down }
}

// ─── LIVE-BACKTEST ───────────────────────────────────────────────────────────
const cardsLog = makeLiveLog('motor_cards_livelog_v1')
export const logCardsSnapshot = (matchId, info, model) => cardsLog.logSnapshot(matchId, info, model)
export const resolveCardsLog = (matchId, finalTotal) => cardsLog.resolve(matchId, finalTotal)
export const cardsLogPending = () => cardsLog.pending()
export const cardsBacktestSummary = () => cardsLog.summary()
