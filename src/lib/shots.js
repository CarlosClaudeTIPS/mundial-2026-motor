// ─── Módulo cuantitativo de TIROS LIVE ───────────────────────────────────────
//
// Mismo principio que corners/throwins/goalkicks: Datos → Modelo → Probabilidad
// → Incertidumbre → Línea → Edge → Decisión. NO BET válido y frecuente.
//
// DEFINICIÓN (§16, coherencia del proveedor): Live-Score reporta por equipo
// "Total Shots", "Shots on Goal" y "Blocked Shots" (y "Shots off Goal").
// En su definición: Total = OnGoal + OffGoal + Blocked (categorías excluyentes).
// ARQUITECTURA DE COHERENCIA: modelamos el TOTAL por equipo como conteo
// principal y lo repartimos con proporciones p_sot + p_off + p_blk = 1.
// Así el sistema NUNCA produce Total=25 con 15+10+12 (imposible).
//
// INTERACCIÓN (§6): tiros de A = 60% lo que A genera + 40% lo que B concede
// (Shot Generation vs Shot Prevention), con split localía cuando hay muestra.
// Las PROPORCIONES también son interacción: el % a puerta de A se mezcla con
// el % a puerta que la defensa de B suele permitir.
//
// CANTIDAD ≠ CALIDAD (§9): el xG de Sofascore se muestra como diagnóstico de
// calidad, pero NO infla el volumen (un equipo puede tirar 20 veces desde
// lejos con xG bajo). Peso cero en el conteo, visible en factores.
//
// SIN FUENTE (peso CERO): zona/distancia/ángulo del tiro, tipo de finalización,
// tiros por jugador, entradas al área, toques en área, PPDA, transiciones,
// formaciones como coeficiente. Documentado en docs/modelo-tiros.md.

import { getSituationS } from './engine'
import { nbOver, makeLiveLog } from './throwins'
import { restanteEfectivo, regimeOf, pressureFactor, redCardFactor } from './match-state'
import { evaluarMercado } from './market-engine'

// ── Constantes (recalibrables con el live-backtest) ──────────────────────────
export const SHOTS_MODEL = {
  K_CRED: 26,          // los tiros señalizan rápido (hay ~26/partido)
  MIN_EFECTIVOS: 95,
  PHI_TOTAL: 1.45,     // clustering de tiros (rachas de presión) → var alta
  PHI_TEAM: 1.35,
  PHI_SOT: 1.25,
  REGIME_MIN_SPAN: 8,
  REGIME_CLAMP: [0.85, 1.15],
  REGIME_SOFT: 0.5,
  DA_BASE: 1.1,
  DA_CLAMP: [0.88, 1.12],
  STATE_SOFT: 0.8,     // marcador→tiros: evidencia fuerte (el que pierde patea)
  SOT_SHARE_DEFAULT: 0.34,  // % a puerta típico
  BLK_SHARE_DEFAULT: 0.17,  // % bloqueado típico
  EDGE_MIN: 0.04,
  MIN_MINUTO: 10,
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
const clampP = (p, lo = 0.05, hi = 0.60) => Math.min(hi, Math.max(lo, p))

// ─── PRIOR PREPARTIDO (por equipo, con proporciones coherentes) ──────────────
export function shotsPrior(preA, preB, { homeA = true } = {}) {
  if (!preA || !preB) return null

  // Volumen: interacción generación×concesión, con split localía si hay muestra
  const volSide = (own, rival, isHome) => {
    let ownShots = own.shots_avg
    const split = isHome ? own.split?.home : own.split?.away
    if (split?.shots != null && split.n >= 3) ownShots = ownShots * 0.7 + split.shots * 0.3
    return ownShots * 0.6 + rival.shots_against_avg * 0.4
  }
  const expA = volSide(preA, preB, homeA)
  const expB = volSide(preB, preA, !homeA)

  // Proporciones por lado: % propio mezclado con lo que la defensa rival permite
  const shares = (own, rival) => {
    const ownRows = (own.last10 ?? []).filter(r => r.shots > 0)
    const rivRows = (rival.last10 ?? []).filter(r => r.shotsAg > 0)
    const pSotOwn = median(ownRows.map(r => r.sot != null ? r.sot / r.shots : null)) ?? SHOTS_MODEL.SOT_SHARE_DEFAULT
    const pSotRiv = median(rivRows.map(r => r.sotAg != null ? r.sotAg / r.shotsAg : null)) ?? SHOTS_MODEL.SOT_SHARE_DEFAULT
    const pBlkOwn = median(ownRows.map(r => r.blocked != null ? r.blocked / r.shots : null)) ?? SHOTS_MODEL.BLK_SHARE_DEFAULT
    const pBlkRiv = median(rivRows.map(r => r.blockedAg != null ? r.blockedAg / r.shotsAg : null)) ?? SHOTS_MODEL.BLK_SHARE_DEFAULT
    const pSot = clampP(pSotOwn * 0.6 + pSotRiv * 0.4, 0.18, 0.55)
    const pBlk = clampP(pBlkOwn * 0.6 + pBlkRiv * 0.4, 0.05, 0.35)
    return { pSot: +pSot.toFixed(3), pBlk: +pBlk.toFixed(3), pOff: +(1 - pSot - pBlk).toFixed(3) }
  }
  const shA = shares(preA, preB)
  const shB = shares(preB, preA)

  // Ancla empírica del total (mediana de shots+shotsAg por partido)
  const totals = []
  for (const t of [preA, preB]) {
    for (const r of (t.last10 ?? [])) {
      if (r.shots != null && r.shotsAg != null) totals.push(r.shots + r.shotsAg)
    }
  }
  const empTotal = totals.length >= 4 ? median(totals) : null
  let empSd = null
  if (totals.length >= 4) {
    const mean = totals.reduce((s, x) => s + x, 0) / totals.length
    empSd = Math.sqrt(totals.reduce((s, x) => s + (x - mean) ** 2, 0) / (totals.length - 1))
  }

  const interTotal = expA + expB
  const total = empTotal != null ? interTotal * 0.5 + empTotal * 0.5 : interTotal
  const scale = interTotal > 0 ? total / interTotal : 1

  const mk = (exp, sh) => ({
    shots: +(exp * scale).toFixed(1),
    sot: +(exp * scale * sh.pSot).toFixed(1),
    off: +(exp * scale * sh.pOff).toFixed(1),
    blk: +(exp * scale * sh.pBlk).toFixed(1),
    perMin: +((exp * scale) / SHOTS_MODEL.MIN_EFECTIVOS).toFixed(4),
    ...sh,
  })

  const sample = (preA.statsMatches ?? 0) + (preB.statsMatches ?? 0)
  return {
    A: mk(expA, shA), B: mk(expB, shB),
    total: +total.toFixed(1),
    sotTotal: +((expA * scale * shA.pSot) + (expB * scale * shB.pSot)).toFixed(1),
    empTotal, interTotal: +interTotal.toFixed(1),
    sd: empSd != null ? +Math.max(3.5, empSd).toFixed(1) : +Math.max(4, total * 0.22).toFixed(1),
    // Calidad (diagnóstico, NO volumen): xG por tiro si Sofascore lo dio
    xgPerShotA: preA.xg_avg != null && preA.shots_avg > 0 ? +(preA.xg_avg / preA.shots_avg).toFixed(3) : null,
    xgPerShotB: preB.xg_avg != null && preB.shots_avg > 0 ? +(preB.xg_avg / preB.shots_avg).toFixed(3) : null,
    sample,
    estimado: sample < 12,
  }
}

// ─── MODELO LIVE ─────────────────────────────────────────────────────────────
// Por lado: total como conteo principal; SOT como conteo "adelgazado" por la
// proporción en vivo mezclada con la del prior (coherencia garantizada).
// Régimen/presión/restante del MATCH STATE ENGINE. reds {h,a}: roja = cambio
// estructural (el de 10 genera ×0.80, el rival ×1.08).
export function shotsLiveModel({ minuto, sH = null, sA = null, sotH = null, sotA = null, blkH = null, blkA = null, goalDiff = 0, snaps = [], prior = null, daTotal = null, reds = null }) {
  if (minuto == null || minuto < 1 || sH == null || sA == null) return null

  const restEff = restanteEfectivo(minuto)

  const press = pressureFactor(daTotal, minuto, { base: SHOTS_MODEL.DA_BASE, clamp: SHOTS_MODEL.DA_CLAMP })
  const daFactor = press.factor
  const daObs = press.obs

  const mkSide = (acum, sotAcum, blkAcum, pr, diffSide, key, redF) => {
    const rateObs = acum / minuto
    const ratePrior = pr?.perMin ?? null
    const K = ratePrior != null ? SHOTS_MODEL.K_CRED : SHOTS_MODEL.K_CRED / 2
    const wObs = minuto / (minuto + K)
    const rateBlend = ratePrior != null ? wObs * rateObs + (1 - wObs) * ratePrior : rateObs
    const state = Math.pow(getSituationS(diffSide), SHOTS_MODEL.STATE_SOFT)
    const regime = regimeOf(snaps, key, acum, minuto, {
      span: SHOTS_MODEL.REGIME_MIN_SPAN, clamp: SHOTS_MODEL.REGIME_CLAMP, soft: SHOTS_MODEL.REGIME_SOFT,
    })
    const muRest = rateBlend * restEff * state * regime.factor * daFactor * redF
    const expectedFinal = acum + muRest

    // Proporción a puerta EN VIVO mezclada con el prior (mismo peso bayesiano)
    const pSotPrior = pr?.pSot ?? SHOTS_MODEL.SOT_SHARE_DEFAULT
    const pSotObs = (sotAcum != null && acum >= 4) ? sotAcum / acum : null
    const wP = acum / (acum + 10) // credibilidad de la proporción por nº de tiros
    const pSot = clampP(pSotObs != null ? wP * pSotObs + (1 - wP) * pSotPrior : pSotPrior, 0.15, 0.60)
    const pBlkPrior = pr?.pBlk ?? SHOTS_MODEL.BLK_SHARE_DEFAULT
    const pBlkObs = (blkAcum != null && acum >= 4) ? blkAcum / acum : null
    const pBlk = clampP(pBlkObs != null ? wP * pBlkObs + (1 - wP) * pBlkPrior : pBlkPrior, 0.04, 0.35)

    const muSotRest = muRest * pSot
    const sotFinal = (sotAcum ?? Math.round(acum * pSot)) + muSotRest
    // Coherencia EXACTA (§16): bloqueados anclados igual que SOT y "fuera" como
    // residuo → sot + off + blk = total siempre, nunca categorías imposibles.
    const blkFinal = (blkAcum ?? acum * pBlk) + muRest * pBlk
    const offFinal = Math.max(0, expectedFinal - sotFinal - blkFinal)

    return {
      acum, sotAcum, blkAcum, redF,
      rateObs: +rateObs.toFixed(3),
      ratePrior, wObs: +wObs.toFixed(2),
      state: +state.toFixed(3),
      regime,
      muRest: +muRest.toFixed(2),
      expectedFinal: +expectedFinal.toFixed(1),
      pSot: +pSot.toFixed(3), pBlk: +pBlk.toFixed(3),
      sotFinal: +sotFinal.toFixed(1),
      offFinal: +offFinal.toFixed(1),
      blkFinal: +blkFinal.toFixed(1),
      muSotRest: +muSotRest.toFixed(2),
      pOverShots: line => line <= acum ? 1 : nbOver(muRest, line - acum, SHOTS_MODEL.PHI_TEAM),
      pOverSot: line => {
        const base = sotAcum ?? 0
        return line <= base ? 1 : nbOver(muSotRest, line - base, SHOTS_MODEL.PHI_SOT)
      },
    }
  }

  const redFH = redCardFactor(reds?.h ?? 0, reds?.a ?? 0)
  const redFA = redCardFactor(reds?.a ?? 0, reds?.h ?? 0)
  const home = mkSide(sH, sotH, blkH, prior?.A ?? null, goalDiff, 'sh', redFH)
  const away = mkSide(sA, sotA, blkA, prior?.B ?? null, -goalDiff, 'sa', redFA)

  const acum = sH + sA
  const sotAcum = (sotH != null || sotA != null) ? (sotH ?? 0) + (sotA ?? 0) : null
  const muRest = home.muRest + away.muRest
  const muSotRest = home.muSotRest + away.muSotRest
  const expectedFinal = acum + muRest
  const naiveFinal = acum + (acum / minuto) * restEff

  const q = (mu, phi, base, p) => {
    let k = 0
    const cap = Math.ceil(mu + 6 * Math.sqrt(phi * mu)) + 2
    while (k < cap && 1 - nbOver(mu, k + 0.5, phi) < p) k++
    return base + k
  }

  return {
    minuto, acum, sotAcum, restEff,
    rateObs: +(acum / minuto).toFixed(3),
    hayRoja: (reds?.h ?? 0) + (reds?.a ?? 0) > 0,
    reds,
    home, away,
    daFactor: +daFactor.toFixed(3), daObs: daObs != null ? +daObs.toFixed(2) : null,
    muRest: +muRest.toFixed(2),
    expectedFinal: +expectedFinal.toFixed(1),
    naiveFinal: +naiveFinal.toFixed(1),
    interval: [q(muRest, SHOTS_MODEL.PHI_TOTAL, acum, 0.10), q(muRest, SHOTS_MODEL.PHI_TOTAL, acum, 0.90)],
    sotFinal: +(home.sotFinal + away.sotFinal).toFixed(1),
    sotInterval: sotAcum != null
      ? [q(muSotRest, SHOTS_MODEL.PHI_SOT, sotAcum, 0.10), q(muSotRest, SHOTS_MODEL.PHI_SOT, sotAcum, 0.90)]
      : null,
    offFinal: +(home.offFinal + away.offFinal).toFixed(1),
    blkFinal: +(home.blkFinal + away.blkFinal).toFixed(1),
    pOver: line => line <= acum ? 1 : nbOver(muRest, line - acum, SHOTS_MODEL.PHI_TOTAL),
    pOverSot: line => {
      const base = sotAcum ?? 0
      return line <= base ? 1 : nbOver(muSotRest, line - base, SHOTS_MODEL.PHI_SOT)
    },
  }
}

// ─── CONFIANZA (0-100) ───────────────────────────────────────────────────────
export function shotsConfidence({ model, prior, fuente, snapsN = 0 }) {
  if (!model) return { score: 0, parts: [] }
  const parts = []
  let score = 25

  if (fuente === 'api')       { score += 22; parts.push(['+22', 'tiros en vivo de Live-Score por equipo (dato directo)']) }
  else if (fuente === 'manual') { score += 8; parts.push(['+8', 'tiros ingresados a mano']) }

  const mMin = Math.min(20, Math.round((model.minuto / 90) * 26))
  score += mMin; parts.push([`+${mMin}`, `minuto ${model.minuto}' — peso del observado ${Math.round(model.home.wObs * 100)}%`])
  if (model.minuto < SHOTS_MODEL.MIN_MINUTO) { score -= 15; parts.push(['-15', `antes del ${SHOTS_MODEL.MIN_MINUTO}' el ritmo es ruido`]) }

  if (prior && !prior.estimado && prior.sample >= 14) { score += 12; parts.push(['+12', `prior sólido: ${prior.sample} partidos con tiros reales`]) }
  else if (prior && prior.sample >= 8) { score += 7; parts.push(['+7', `prior parcial: ${prior.sample} partidos`]) }
  else if (prior) { score += 2; parts.push(['+2', 'prior con muestra corta']) }
  else { score -= 8; parts.push(['-8', 'sin prior prepartido — solo ritmo observado']) }

  if (snapsN >= 3) { score += 5; parts.push(['+5', `${snapsN} snapshots — el cambio de ritmo es medible`]) }
  if (model.daObs != null) { score += 4; parts.push(['+4', 'presión medible por ataques peligrosos']) }
  if (model.sotAcum != null) { score += 3; parts.push(['+3', 'SOT en vivo disponible (proporción real, no estimada)']) }

  const dis = Math.abs(model.expectedFinal - model.naiveFinal) / Math.max(1, model.expectedFinal)
  if (dis < 0.06) { score += 8; parts.push(['+8', 'modelo y ritmo puro coinciden (predicción estable)']) }
  else if (dis > 0.18) { score -= 6; parts.push(['-6', 'modelo y ritmo puro difieren >18% (situación ambigua)']) }

  return { score: Math.min(92, Math.max(5, Math.round(score))), parts }
}

// ─── EDGE — delega en el MARKET ENGINE unificado ─────────────────────────────
export function shotsEdge({ model, market = 'shots_total', line, oddsOver, oddsUnder = null, confidence }) {
  if (!model) return null
  const P = {
    shots_total: model.pOver,
    shots_local: model.home.pOverShots,
    shots_visitante: model.away.pOverShots,
    sot_total: model.pOverSot,
    sot_local: model.home.pOverSot,
    sot_visitante: model.away.pOverSot,
  }[market]
  if (!P) return null
  const res = evaluarMercado({
    pOverFn: P, line, oddsOver, oddsUnder, confidence,
    minuto: model.minuto, minMinuto: SHOTS_MODEL.MIN_MINUTO,
    extras: [
      { cond: model.minuto < 20, pp: 0.02, why: "antes del 20' → +2pp" },
      { cond: market.endsWith('local') || market.endsWith('visitante'), pp: 0.01, why: 'mercado por equipo → +1pp' },
      { cond: market.startsWith('sot') && model.sotAcum == null, pp: 0.02, why: 'SOT sin dato en vivo (estimado) → +2pp' },
    ],
  })
  return res ? { ...res, market } : null
}

// ─── EXPLICABILIDAD ──────────────────────────────────────────────────────────
export function shotsFactores({ model, prior, goalDiff, homeName = 'Local', awayName = 'Visitante' }) {
  if (!model) return { up: [], down: [] }
  const up = []; const down = []

  for (const [side, name, diff] of [[model.home, homeName, goalDiff], [model.away, awayName, -goalDiff]]) {
    if (side.ratePrior != null) {
      const d = (side.rateObs - side.ratePrior) / side.ratePrior
      if (d > 0.25) up.push(`${name} genera tiros muy por encima de su esperado (${side.rateObs}/min vs ${side.ratePrior}/min)`)
      else if (d < -0.25) down.push(`${name} genera menos tiros que su esperado (${side.rateObs}/min vs ${side.ratePrior}/min)`)
    }
    if (side.state > 1.05) up.push(`${name} ${diff < 0 ? 'pierde y está obligado a rematar' : 'empuja'} → Situation S ×${side.state}`)
    else if (side.state < 0.95) down.push(`${name} administra → Situation S ×${side.state}`)
    if (side.regime?.detected) {
      if (side.regime.dir === 'up') up.push(`${name}: ritmo de tiros subiendo (últimos ${side.regime.span}')`)
      else if (side.regime.dir === 'down') down.push(`${name}: ritmo de tiros bajando (últimos ${side.regime.span}')`)
    }
  }
  if (model.hayRoja) {
    if ((model.reds?.h ?? 0) > 0) { down.push(`⚠️ ROJA a ${homeName} — con 10 genera ×${model.home.redF}`); up.push(`${awayName} domina contra 10 → generación ×${model.away.redF}`) }
    if ((model.reds?.a ?? 0) > 0) { down.push(`⚠️ ROJA a ${awayName} — con 10 genera ×${model.away.redF}`); up.push(`${homeName} domina contra 10 → generación ×${model.home.redF}`) }
  }
  if (model.daFactor > 1.03) up.push(`Presión sostenida alta: ${model.daObs} ataques peligrosos/min`)
  else if (model.daFactor < 0.97) down.push(`Partido frío: ${model.daObs} ataques peligrosos/min`)
  // Calidad vs cantidad (diagnóstico, no mueve el conteo)
  if (prior?.xgPerShotA != null && prior.xgPerShotA < 0.08) down.push(`${homeName} tira mucho de lejos (xG/tiro ${prior.xgPerShotA}) — volumen alto no implica peligro`)
  if (prior?.xgPerShotB != null && prior.xgPerShotB < 0.08) down.push(`${awayName} tira mucho de lejos (xG/tiro ${prior.xgPerShotB})`)
  if (prior?.estimado) down.push('Prior con muestra corta — más incertidumbre')
  if (model.minuto < 20) down.push('Pocos minutos jugados — el ritmo observado pesa poco todavía')

  return { up, down }
}

// ─── LIVE-BACKTEST (dos registros: tiros y SOT, resueltos vía Live-Score) ────
const shotsLog = makeLiveLog('motor_shots_livelog_v1')
export const logShotsSnapshot = (matchId, info, model) => shotsLog.logSnapshot(matchId, info, model)
export const resolveShotsLog = (matchId, finalTotal) => shotsLog.resolve(matchId, finalTotal)
export const shotsLogPending = () => shotsLog.pending()
export const shotsBacktestSummary = () => shotsLog.summary()

const sotLog = makeLiveLog('motor_sot_livelog_v1')
// Adapter: el log genérico espera {minuto, acum, expectedFinal, pOver}
export const logSotSnapshot = (matchId, info, model) => {
  if (!model || model.sotAcum == null) return
  sotLog.logSnapshot(matchId, info, {
    minuto: model.minuto,
    acum: model.sotAcum,
    expectedFinal: model.sotFinal,
    pOver: model.pOverSot,
  })
}
export const resolveSotLog = (matchId, finalSot) => sotLog.resolve(matchId, finalSot)
export const sotLogPending = () => sotLog.pending()
export const sotBacktestSummary = () => sotLog.summary()
