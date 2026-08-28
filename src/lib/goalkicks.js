// ─── Módulo cuantitativo de SAQUES DE PORTERÍA (goal kicks) LIVE ─────────────
//
// Mismo principio que throwins.js: Datos → Modelo → Probabilidad →
// Incertidumbre → Línea → Edge → Decisión. NO BET es salida válida y frecuente.
//
// DEFINICIÓN DEL EVENTO (§1 del spec): usamos el conteo "Goal kicks" de
// Sofascore (fuente principal: Live-Score reporta GK = null siempre). Sofascore
// cuenta el REINICIO con saque de portería: balón que cruza la línea de fondo
// tocado por última vez por el atacante SIN ser gol ni córner. NO cuenta:
// córners, paradas del portero (el balón no salió), tiros bloqueados que no
// salen, goles, ni jugadas anuladas por falta/offside previo. Si el usuario
// compara contra un bookie, la definición del bookie puede diferir ±1 — la
// confianza lo castiga cuando la fuente es alterna.
//
// CAUSALIDAD (§3): NO es "más tiros = más GK". El generador directo son los
// TIROS DESVIADOS del RIVAL (fuera del arco) + centros/pases profundos que
// cruzan la línea de fondo. Con nuestras fuentes:
//   - offTarget ≈ Tiros totales − Tiros a puerta (incluye bloqueados cuando la
//     fuente no los separa — limitación documentada: el bloqueado que no sale
//     NO genera GK, así que este proxy sobreestima un poco; el coeficiente es
//     suave por eso).
//   - La correlación GK↔posesión ≈ −0.72 (el equipo dominado despeja/recibe
//     tiros → saca más de portería) ya vive en calcExpectedGK (prior).
//
// Variables SIN fuente (peso CERO, no se inventa): zona/ángulo/distancia del
// tiro, tipo de centro, altura del bloque, PPDA, salida corta/larga del
// portero, posesión territorial. Documentado en docs/modelo-saques-porteria.md.

import { poissonOver, calcExpectedGK } from './engine'
import { nbOver, makeLiveLog } from './throwins'
import { restanteEfectivo, regimeOf, redCardFactorGk } from './match-state'

// ── Constantes del modelo (recalibrables con el live-backtest) ───────────────
export const GK_MODEL = {
  K_CRED: 32,          // GK es más ruidoso que TI → el prior aguanta un poco más
  MIN_EFECTIVOS: 95,
  PHI: 1.35,           // sobredispersión NB (var = PHI × media)
  REGIME_MIN_SPAN: 8,
  REGIME_CLAMP: [0.85, 1.15],
  REGIME_SOFT: 0.5,
  STATE_CLAMP: [0.92, 1.08], // el marcador mueve GK vía tiros del que pierde: ±8%
  OFF_CLAMP: [0.90, 1.10],   // señal de tiros desviados acotada ±10%, medio peso
  EDGE_MIN: 0.04,
  MIN_MINUTO: 12,
}

const num = v => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return (n == null || isNaN(n)) ? null : n
}

// ─── PRIOR PREPARTIDO ────────────────────────────────────────────────────────
// Mezcla 50/50: (a) interacción causal de calcExpectedGK (posesión del rival,
// diferencia de nivel PPG, GK que el rival PROVOCA) — modela POR EQUIPO como
// pide el spec §18; (b) mediana empírica de TOTALES de sus últimos partidos.
export function gkPrior(preA, preB, league) {
  if (!preA || !preB) return null

  const inter = calcExpectedGK(preA, preB) // { expA, expB, total, posA, posB, weakerTeam }

  // Totales empíricos: filas con gk Y gkAg reales y plausibles (≥3 cada lado)
  const totals = []
  for (const t of [preA, preB]) {
    for (const r of (t.last10 ?? [])) {
      const gk = num(r.gk); const ag = num(r.gkAg)
      if (gk != null && ag != null && gk >= 3 && ag >= 3) totals.push(gk + ag)
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

  const total = empTotal != null ? inter.total * 0.5 + empTotal * 0.5 : inter.total
  const sd = empSd != null ? Math.max(3, empSd) : Math.max(4, total * 0.22)

  // Ritmo esperado de tiros desviados del cruce (para la señal live off-target)
  const offRate = (preA.shots_avg != null && preB.shots_avg != null)
    ? Math.max(0.05, ((preA.shots_avg - (preA.sot_avg ?? preA.shots_avg * 0.36)) +
                      (preB.shots_avg - (preB.sot_avg ?? preB.shots_avg * 0.36))) / GK_MODEL.MIN_EFECTIVOS)
    : null

  const sample = (preA.gkSample ?? 0) + (preB.gkSample ?? 0)
  return {
    total: +total.toFixed(1),
    perMin: +(total / GK_MODEL.MIN_EFECTIVOS).toFixed(4),
    sd: +sd.toFixed(1),
    empTotal, interTotal: +inter.total.toFixed(1),
    // Generación por equipo (spec §18): GK que saca cada uno
    expA: inter.expA, expB: inter.expB, weakerTeam: inter.weakerTeam,
    offRate,
    sample, totalsN: totals.length,
    estimado: preA.estGk || preB.estGk,
  }
}

// ─── ESTADO DEL PARTIDO ──────────────────────────────────────────────────────
// Mecanismo: el que pierde patea más (y falla más) → más GK del que gana.
// Ventaja amplia tarde → se administra, menos remates → menos GK. Acotado ±8%.
function stateFactor(goalDiff, minuto) {
  let f = 1.0
  const ad = Math.abs(goalDiff)
  if (ad >= 2 && minuto >= 70) f = 0.93        // partido resuelto → nadie patea
  else if (ad === 1 && minuto >= 60) f = 1.04  // perdedor bombardea → fallos → GK
  else if (ad === 0 && minuto >= 80) f = 0.98  // 0-0 tarde: nadie arriesga tiros lejanos
  const [lo, hi] = GK_MODEL.STATE_CLAMP
  return Math.min(hi, Math.max(lo, f))
}

// ─── SEÑAL DE TIROS DESVIADOS (driver causal directo) ────────────────────────
// Si el partido genera más tiros fuera/min de lo esperado, vienen más GK.
// offAcum = (tiros − a puerta) acumulados. Aplicado a medio peso (^0.5) y
// acotado ±10% porque el proxy incluye bloqueados (que no siempre salen).
function offTargetFactor(offAcum, minuto, prior) {
  if (offAcum == null || !minuto || minuto < 10 || !prior?.offRate) return { factor: 1, obs: null, exp: prior?.offRate ?? null }
  const obs = offAcum / minuto
  const raw = obs / prior.offRate
  const [lo, hi] = GK_MODEL.OFF_CLAMP
  const clamped = Math.min(hi, Math.max(lo, raw))
  return { factor: Math.pow(clamped, 0.5), obs: +obs.toFixed(3), exp: prior.offRate, raw: +raw.toFixed(2) }
}

// ─── MODELO LIVE ─────────────────────────────────────────────────────────────
// Régimen/restante del MATCH STATE ENGINE. reds {h,a}: la roja mueve el GK
// total poco (el de 10 saca MÁS, el dominante MENOS → efecto neto chico).
export function gkLiveModel({ minuto, acum, goalDiff = 0, snaps = [], prior = null, offAcum = null, reds = null }) {
  if (minuto == null || acum == null || minuto < 1) return null

  const restEff = restanteEfectivo(minuto)

  const rateObs = acum / minuto
  const ratePrior = prior?.perMin ?? null

  const K = ratePrior != null ? GK_MODEL.K_CRED : GK_MODEL.K_CRED / 2
  const wObs = minuto / (minuto + K)
  const rateBlend = ratePrior != null
    ? wObs * rateObs + (1 - wObs) * ratePrior
    : rateObs

  const state = stateFactor(goalDiff, minuto)
  const regime = regimeOf(snaps, 'gk', acum, minuto, {
    span: GK_MODEL.REGIME_MIN_SPAN, clamp: GK_MODEL.REGIME_CLAMP, soft: GK_MODEL.REGIME_SOFT,
  })
  const off = offTargetFactor(offAcum, minuto, prior)
  // Roja: efecto NETO sobre el total (promedio de ambos lados; una roja ≈ +2%)
  const redFactor = reds ? +(((redCardFactorGk(reds.h ?? 0, reds.a ?? 0) + redCardFactorGk(reds.a ?? 0, reds.h ?? 0)) / 2)).toFixed(3) : 1

  const muRest = rateBlend * restEff * state * regime.factor * off.factor * redFactor
  const expectedFinal = acum + muRest
  const naiveFinal = acum + rateObs * restEff

  // Intervalo ~10-90%
  const q = (p) => {
    let k = 0
    const cap = Math.ceil(muRest + 6 * Math.sqrt(GK_MODEL.PHI * muRest)) + 2
    while (k < cap && 1 - nbOver(muRest, k + 0.5, GK_MODEL.PHI) < p) k++
    return acum + k
  }

  return {
    minuto, acum, restEff,
    rateObs: +rateObs.toFixed(3),
    ratePrior,
    wObs: +wObs.toFixed(2),
    rateBlend: +rateBlend.toFixed(3),
    state: +state.toFixed(3),
    regime, off, redFactor,
    muRest: +muRest.toFixed(2),
    expectedFinal: +expectedFinal.toFixed(1),
    naiveFinal: +naiveFinal.toFixed(1),
    interval: [q(0.10), q(0.90)],
    pOver: line => line <= acum ? 1 : (muRest > 0 ? nbOver(muRest, line - acum, GK_MODEL.PHI) : poissonOver(0.01, line - acum)),
  }
}

// ─── CONFIANZA (0-100) — calidad/estabilidad, NO probabilidad de ganar ───────
export function gkConfidence({ model, prior, fuente, snapsN = 0 }) {
  if (!model) return { score: 0, parts: [] }
  const parts = []
  let score = 25

  if (fuente === 'api')       { score += 20; parts.push(['+20', 'GK en vivo de Live-Score (dato directo — raro, aprovéchalo)']) }
  else if (fuente === 'sofa') { score += 15; parts.push(['+15', 'GK en vivo de Sofascore (definición puede diferir ±1 del bookie)']) }
  else if (fuente === 'manual') { score += 8; parts.push(['+8', 'GK ingresados a mano (sin refresco automático)']) }

  const mMin = Math.min(20, Math.round((model.minuto / 90) * 26))
  score += mMin; parts.push([`+${mMin}`, `minuto ${model.minuto}' — peso del observado ${Math.round(model.wObs * 100)}%`])
  if (model.minuto < GK_MODEL.MIN_MINUTO) { score -= 15; parts.push(['-15', `antes del ${GK_MODEL.MIN_MINUTO}' el ritmo es ruido`]) }

  if (prior && !prior.estimado && prior.sample >= 8) { score += 12; parts.push(['+12', `prior sólido: ${prior.sample} partidos con GK real`]) }
  else if (prior && prior.sample >= 4) { score += 6; parts.push(['+6', `prior parcial: ${prior.sample} partidos con GK real`]) }
  else if (prior) { score += 2; parts.push(['+2', 'prior estimado desde posesión/baseline (débil)']) }
  else { score -= 8; parts.push(['-8', 'sin prior prepartido — solo ritmo observado']) }

  if (snapsN >= 3) { score += 6; parts.push(['+6', `${snapsN} snapshots — el cambio de ritmo es medible`]) }
  if (model.off?.obs != null) { score += 4; parts.push(['+4', 'señal de tiros desviados disponible (driver causal)']) }

  const dis = Math.abs(model.expectedFinal - model.naiveFinal) / Math.max(1, model.expectedFinal)
  if (dis < 0.06) { score += 10; parts.push(['+10', 'modelo y ritmo puro coinciden (predicción estable)']) }
  else if (dis > 0.15) { score -= 6; parts.push(['-6', 'modelo y ritmo puro difieren >15% (situación ambigua)']) }

  return { score: Math.min(92, Math.max(5, Math.round(score))), parts }
}

// ─── EDGE vs LÍNEA DE LA CASA ────────────────────────────────────────────────
export function gkEdge({ model, line, oddsOver, oddsUnder = null, confidence }) {
  if (!model || !line || !oddsOver || oddsOver <= 1) return null
  const pOver = model.pOver(line)

  let impOver
  let sinVig = false
  if (oddsUnder && oddsUnder > 1) {
    const a = 1 / oddsOver; const b = 1 / oddsUnder
    impOver = a / (a + b)
    sinVig = true
  } else {
    impOver = 1 / oddsOver
  }

  const edgeOver = pOver - impOver
  const edgeUnder = sinVig ? (1 - pOver) - (1 - impOver) : null

  let minEdge = GK_MODEL.EDGE_MIN
  const razonesUmbral = []
  if (confidence < 65) { minEdge += 0.02; razonesUmbral.push('confianza <65 → +2pp') }
  if (model.minuto < 20) { minEdge += 0.02; razonesUmbral.push('antes del 20\' → +2pp') }
  if (!sinVig) { minEdge += 0.01; razonesUmbral.push('sin cuota Under (no se quitó el vig) → +1pp') }

  let signal = 'NO BET'
  let lado = null
  if (confidence >= 50 && model.minuto >= GK_MODEL.MIN_MINUTO) {
    if (edgeOver >= minEdge) { signal = 'BET'; lado = 'OVER' }
    else if (sinVig && edgeUnder >= minEdge) { signal = 'BET'; lado = 'UNDER' }
  }

  return {
    line, oddsOver, oddsUnder,
    pOver: +(pOver * 100).toFixed(1),
    pUnder: +((1 - pOver) * 100).toFixed(1),
    impOver: +(impOver * 100).toFixed(2),
    sinVig,
    edgeOver: +(edgeOver * 100).toFixed(2),
    edgeUnder: sinVig ? +(edgeUnder * 100).toFixed(2) : null,
    minEdge: +(minEdge * 100).toFixed(1),
    razonesUmbral,
    signal, lado,
  }
}

// ─── EXPLICABILIDAD ──────────────────────────────────────────────────────────
export function gkFactores({ model, prior, goalDiff }) {
  if (!model) return { up: [], down: [] }
  const up = []; const down = []

  if (model.ratePrior != null) {
    const d = (model.rateObs - model.ratePrior) / model.ratePrior
    if (d > 0.10) up.push(`Ritmo de GK ${model.rateObs}/min supera el esperado (${model.ratePrior}/min) en ${Math.round(d * 100)}%`)
    else if (d < -0.10) down.push(`Ritmo de GK ${model.rateObs}/min por debajo del esperado (${model.ratePrior}/min) en ${Math.round(-d * 100)}%`)
  }
  if (model.off?.obs != null && model.off.raw != null) {
    if (model.off.raw >= 1.10) up.push(`Tiros desviados: ${model.off.obs}/min vs ${model.off.exp}/min esperado — cada fallo largo es un GK potencial`)
    else if (model.off.raw <= 0.90) down.push(`Pocos tiros desviados (${model.off.obs}/min vs ${model.off.exp}/min esperado) — el generador directo está frío`)
  }
  if (model.regime?.detected) {
    if (model.regime.dir === 'up') up.push(`Últimos ${model.regime.span}': ritmo reciente ${model.regime.recentRate}/min > ritmo del partido (se calienta)`)
    else if (model.regime.dir === 'down') down.push(`Últimos ${model.regime.span}': ritmo reciente ${model.regime.recentRate}/min < ritmo del partido (se enfría)`)
  }
  if (model.state > 1.01) up.push(`El que pierde está obligado a rematar → más fallos → más GK (+${Math.round((model.state - 1) * 100)}%)`)
  else if (model.state < 0.99) down.push(`Partido resuelto/cerrado → menos remates → menos GK (${Math.round((model.state - 1) * 100)}%)`)
  if (prior?.weakerTeam) up.push(`Desequilibrio de nivel: el débil pasa el partido defendiendo y saca más de portería (correlación GK↔posesión ≈ −0.72)`)
  if (prior?.estimado) down.push('Prior estimado (equipos sin GK real en su historial) — más incertidumbre')
  if (model.minuto < 20) down.push('Pocos minutos jugados — el ritmo observado pesa poco todavía')

  return { up, down }
}

// ─── LIVE-BACKTEST (mismo registro por minuto que TI, storage propio) ────────
const gkLog = makeLiveLog('motor_gk_livelog_v1')
export const logGkSnapshot = (matchId, info, model) => gkLog.logSnapshot(matchId, info, model)
export const resolveGkLog = (matchId, finalGk) => gkLog.resolve(matchId, finalGk)
export const gkLogPending = () => gkLog.pending()
export const gkBacktestSummary = () => gkLog.summary()
