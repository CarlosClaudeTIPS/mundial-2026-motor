// ─── Módulo cuantitativo de SAQUES DE BANDA (throw-ins) LIVE ─────────────────
//
// Principio: Datos → Modelo → Probabilidad → Incertidumbre → Línea → Edge → Decisión.
// NO es un generador de picks: la salida NO BET es válida y frecuente.
//
// Jerarquía de variables (peso según evidencia disponible en NUESTRAS fuentes):
//   FUERTES  (dato real, relación directa):
//     - TI acumulados y minuto actual (Live-Score / Sofascore en vivo)
//     - Mediana de TI por partido de cada equipo, últimos 10-14 (prior)
//     - TI que el rival CONCEDE (interacción, no promedios aislados)
//   MEDIAS   (proxy razonable, coeficiente pequeño):
//     - Ritmo reciente vs ritmo del partido (cambio de régimen)
//     - Marcador × minuto (estado del partido) — efecto sobre TI es DÉBIL
//       comparado con córners/tiros: se acota a ±6%
//     - Estilo por bandas (centros/partido de Sofascore → Tactical_K_TI)
//     - Normalización por liga (kTI de leagues.js)
//   SIN DATO EN NUESTRAS FUENTES (peso CERO, no se inventa):
//     - PPDA / presión por zonas, posesión territorial, anchura de laterales,
//       alineaciones, clima por estadio, dimensiones de cancha, árbitro.
//
// Distribución: Binomial Negativa sobre los saques RESTANTES (los conteos de TI
// muestran sobredispersión leve vs Poisson: var/media ≈ 1.3-1.5 en totales de
// partido). PHI es recalibrable con los datos del live-backtest local.

import { poissonOver } from './engine'
import { restanteEfectivo, regimeOf } from './match-state'
import { evaluarMercado } from './market-engine'

// ── Constantes del modelo (recalibrables) ────────────────────────────────────
export const TI_MODEL = {
  K_CRED: 30,        // credibilidad bayesiana: peso_obs = min/(min+K) → al 30' pesa 50/50
  MIN_EFECTIVOS: 95, // un partido dura ~95' de reloj con el añadido
  PHI: 1.40,         // sobredispersión NB: var = PHI × media (1 = Poisson puro)
  REGIME_MIN_SPAN: 8,       // minutos mínimos de ventana para medir ritmo reciente
  REGIME_CLAMP: [0.85, 1.15], // el ritmo reciente no puede mover más de ±15%
  REGIME_SOFT: 0.5,         // se aplica como factor^0.5 (media evidencia, medio peso)
  STATE_CLAMP: [0.94, 1.06],  // el marcador mueve TI mucho menos que córners: ±6%
  EDGE_MIN: 0.04,    // edge mínimo 4 pp para señal BET
  MIN_MINUTO: 12,    // antes del 12' el ritmo observado es ruido
}

const num = v => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return (n == null || isNaN(n)) ? null : n
}

// ─── Binomial Negativa: P(X > k) con media m y varianza v = PHI·m ────────────
// Parametrización r,p: r = m²/(v−m), p = r/(r+m). Si PHI≤1 cae a Poisson.
export function nbOver(mean, line, phi = TI_MODEL.PHI) {
  if (mean <= 0) return 0
  const kMax = Math.floor(line) // P(X > line) con line X.5 = P(X ≥ kMax+1)
  if (kMax < 0) return 1
  const v = phi * mean
  if (v <= mean + 1e-9) return poissonOver(mean, line)
  const r = (mean * mean) / (v - mean)
  const p = r / (r + mean)
  // pmf(0) = p^r; recurrencia pmf(k+1) = pmf(k)·(k+r)/(k+1)·(1−p)
  let pmf = Math.pow(p, r)
  let cdf = pmf
  for (let k = 0; k < kMax; k++) {
    pmf = pmf * ((k + r) / (k + 1)) * (1 - p)
    cdf += pmf
    if (pmf < 1e-12 && k > mean) break
  }
  return +Math.min(1, Math.max(0, 1 - cdf)).toFixed(4)
}

// Cuantil aproximado de la NB (para el intervalo estimado)
function nbQuantile(mean, phi, q) {
  if (mean <= 0) return 0
  let k = 0
  // avanzar hasta que P(X ≤ k) ≥ q — reusa nbOver: P(X ≤ k) = 1 − P(X > k+0.5)
  const cap = Math.ceil(mean + 6 * Math.sqrt(phi * mean)) + 2
  while (k < cap && 1 - nbOver(mean, k + 0.5, phi) < q) k++
  return k
}

// ─── PRIOR PREPARTIDO ────────────────────────────────────────────────────────
// Mezcla: interacción equipo×rival (60% lo que genera + 40% lo que el rival
// concede — ya la trae calcExpectedTI vía throwins_avg/ti_against_avg) +
// distribución empírica de TOTALES de sus últimos partidos (mediana y sd).
export function tiPrior(preA, preB, league) {
  if (!preA || !preB) return null
  const kLiga = league?.kTI ?? 1.0

  // Totales empíricos: cada fila de last10 con ti Y tiAg reales
  const totals = []
  for (const t of [preA, preB]) {
    for (const r of (t.last10 ?? [])) {
      const ti = num(r.ti); const ag = num(r.tiAg)
      if (ti != null && ag != null && ti >= 8 && ag >= 8) totals.push(ti + ag)
    }
  }

  // Expected por interacción (mismo criterio que calcExpectedTI, sin clima)
  const K_STYLE = { bandas: 1.10, 'mixto-bandas': 1.05, mixto: 1.0, central: 0.94 }
  const baseA = preB.ti_against_avg != null
    ? preA.throwins_avg * 0.6 + preB.ti_against_avg * 0.4 : preA.throwins_avg
  const baseB = preA.ti_against_avg != null
    ? preB.throwins_avg * 0.6 + preA.ti_against_avg * 0.4 : preB.throwins_avg
  const interTotal = (baseA * (K_STYLE[preA.style] ?? 1) + baseB * (K_STYLE[preB.style] ?? 1)) * kLiga

  // Mediana empírica de totales (robusta a datos parciales)
  let empTotal = null, empSd = null
  if (totals.length >= 4) {
    const sorted = [...totals].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    empTotal = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
    const mean = totals.reduce((s, x) => s + x, 0) / totals.length
    empSd = Math.sqrt(totals.reduce((s, x) => s + (x - mean) ** 2, 0) / (totals.length - 1))
  }

  // Mezcla: si hay muestra empírica decente, 50/50; si no, solo interacción
  const total = empTotal != null ? interTotal * 0.5 + empTotal * 0.5 : interTotal
  const sd = empSd != null ? Math.max(4, empSd) : Math.max(5, total * 0.20)

  const sample = (preA.tiSample ?? 0) + (preB.tiSample ?? 0)
  return {
    total: +total.toFixed(1),
    perMin: +(total / TI_MODEL.MIN_EFECTIVOS).toFixed(4),
    sd: +sd.toFixed(1),
    empTotal, interTotal: +interTotal.toFixed(1),
    sample, totalsN: totals.length,
    estimado: preA.estTi || preB.estTi, // true = algún prior viene de baseline de liga, no de dato real
  }
}

// ─── ESTADO DEL PARTIDO (marcador × minuto) ──────────────────────────────────
// Evidencia DÉBIL para TI (a diferencia de córners): partidos cerrados tarde
// suben levemente el juego por bandas y los relojes parados; ventaja amplia
// tarde baja el ritmo de reinicio. Acotado a ±6% a propósito.
function stateFactor(goalDiff, minuto) {
  let f = 1.0
  const ad = Math.abs(goalDiff)
  if (ad >= 2 && minuto >= 70) f = 0.95        // partido resuelto → se administra
  else if (ad === 1 && minuto >= 75) f = 1.03  // final apretado → banda y reloj
  else if (ad === 0 && minuto >= 80) f = 1.02
  const [lo, hi] = TI_MODEL.STATE_CLAMP
  return Math.min(hi, Math.max(lo, f))
}

// ─── MODELO LIVE ─────────────────────────────────────────────────────────────
// Devuelve proyección + distribución de probabilidad del total final.
// Régimen y minutos restantes vienen del MATCH STATE ENGINE (match-state.js).
export function tiLiveModel({ minuto, acum, goalDiff = 0, snaps = [], prior = null }) {
  if (minuto == null || acum == null || minuto < 1) return null

  const restEff = restanteEfectivo(minuto)

  const rateObs = acum / minuto
  const ratePrior = prior?.perMin ?? null

  // Mezcla bayesiana: el observado gana credibilidad con los minutos.
  // Sin prior → K se reduce (el observado es lo único que hay) pero se avisa.
  const K = ratePrior != null ? TI_MODEL.K_CRED : TI_MODEL.K_CRED / 2
  const wObs = minuto / (minuto + K)
  const rateBlend = ratePrior != null
    ? wObs * rateObs + (1 - wObs) * ratePrior
    : rateObs

  const state = stateFactor(goalDiff, minuto)
  const regime = regimeOf(snaps, 'ti', acum, minuto, {
    span: TI_MODEL.REGIME_MIN_SPAN, clamp: TI_MODEL.REGIME_CLAMP, soft: TI_MODEL.REGIME_SOFT,
  })

  const muRest = rateBlend * restEff * state * regime.factor
  const expectedFinal = acum + muRest

  // Naive (extrapolación lineal pura) — para medir cuánto corrige el modelo
  const naiveFinal = acum + rateObs * restEff

  // Intervalo ~10-90% desde la NB de los restantes
  const q10 = acum + nbQuantile(muRest, TI_MODEL.PHI, 0.10)
  const q90 = acum + nbQuantile(muRest, TI_MODEL.PHI, 0.90)

  return {
    minuto, acum, restEff,
    rateObs: +rateObs.toFixed(3),
    ratePrior,
    wObs: +wObs.toFixed(2),
    rateBlend: +rateBlend.toFixed(3),
    state: +state.toFixed(3),
    regime,
    muRest: +muRest.toFixed(2),
    expectedFinal: +expectedFinal.toFixed(1),
    naiveFinal: +naiveFinal.toFixed(1),
    interval: [q10, q90],
    // P(total final > línea) para cualquier línea X.5
    pOver: line => line <= acum ? 1 : nbOver(muRest, line - acum),
  }
}

// ─── CONFIANZA (0-100) — calidad/estabilidad, NO probabilidad de ganar ───────
export function tiConfidence({ model, prior, fuente, snapsN = 0 }) {
  if (!model) return { score: 0, parts: [] }
  const parts = []
  let score = 25

  // Fuente del dato en vivo
  if (fuente === 'api')       { score += 20; parts.push(['+20', 'TI en vivo de Live-Score (dato directo)']) }
  else if (fuente === 'sofa') { score += 15; parts.push(['+15', 'TI en vivo de Sofascore (fuente alterna, definición puede diferir ±1-2)']) }
  else if (fuente === 'manual') { score += 8; parts.push(['+8', 'TI ingresados a mano (sin refresco automático)']) }

  // Minutos jugados: más partido = ritmo más creíble
  const mMin = Math.min(20, Math.round((model.minuto / 90) * 26))
  score += mMin; parts.push([`+${mMin}`, `minuto ${model.minuto}' — peso del observado ${Math.round(model.wObs * 100)}%`])
  if (model.minuto < TI_MODEL.MIN_MINUTO) { score -= 15; parts.push(['-15', `antes del ${TI_MODEL.MIN_MINUTO}' el ritmo es ruido`]) }

  // Prior prepartido
  if (prior && !prior.estimado && prior.sample >= 8) { score += 12; parts.push(['+12', `prior sólido: ${prior.sample} partidos con TI real`]) }
  else if (prior && prior.sample >= 4) { score += 6; parts.push(['+6', `prior parcial: ${prior.sample} partidos con TI real`]) }
  else if (prior) { score += 2; parts.push(['+2', 'prior estimado desde baseline de liga (débil)']) }
  else { score -= 8; parts.push(['-8', 'sin prior prepartido — solo ritmo observado']) }

  // Historia de snapshots (régimen medible)
  if (snapsN >= 3) { score += 6; parts.push(['+6', `${snapsN} snapshots — el cambio de ritmo es medible`]) }

  // Acuerdo modelo vs extrapolación naive: si difieren mucho, hay tensión
  const dis = Math.abs(model.expectedFinal - model.naiveFinal) / Math.max(1, model.expectedFinal)
  if (dis < 0.06) { score += 10; parts.push(['+10', 'modelo y ritmo puro coinciden (predicción estable)']) }
  else if (dis > 0.15) { score -= 6; parts.push(['-6', 'modelo y ritmo puro difieren >15% (situación ambigua)']) }

  return { score: Math.min(92, Math.max(5, Math.round(score))), parts }
}

// ─── EDGE vs LÍNEA DE LA CASA — delega en el MARKET ENGINE unificado ─────────
export function tiEdge({ model, line, oddsOver, oddsUnder = null, confidence }) {
  if (!model) return null
  return evaluarMercado({
    pOverFn: model.pOver, line, oddsOver, oddsUnder, confidence,
    minuto: model.minuto, minMinuto: TI_MODEL.MIN_MINUTO,
    extras: [{ cond: model.minuto < 20, pp: 0.02, why: "antes del 20' → +2pp" }],
  })
}

// ─── EXPLICABILIDAD: solo los factores que de verdad mueven ESTA predicción ──
export function tiFactores({ model, prior, goalDiff }) {
  if (!model) return { up: [], down: [] }
  const up = []; const down = []

  if (model.ratePrior != null) {
    const d = (model.rateObs - model.ratePrior) / model.ratePrior
    if (d > 0.10) up.push(`Ritmo observado ${model.rateObs}/min supera el esperado prepartido (${model.ratePrior}/min) en ${Math.round(d * 100)}%`)
    else if (d < -0.10) down.push(`Ritmo observado ${model.rateObs}/min por debajo del esperado prepartido (${model.ratePrior}/min) en ${Math.round(-d * 100)}%`)
  }
  if (model.regime?.detected) {
    if (model.regime.dir === 'up') up.push(`Últimos ${model.regime.span}': ritmo reciente ${model.regime.recentRate}/min > ritmo del partido ${model.regime.matchRate}/min (se calienta)`)
    else if (model.regime.dir === 'down') down.push(`Últimos ${model.regime.span}': ritmo reciente ${model.regime.recentRate}/min < ritmo del partido ${model.regime.matchRate}/min (se enfría)`)
  }
  if (model.state > 1.01) up.push(`Marcador ${goalDiff === 0 ? 'empatado' : 'cerrado'} en tramo final → más juego por banda y reloj parado (+${Math.round((model.state - 1) * 100)}%)`)
  else if (model.state < 0.99) down.push(`Ventaja amplia tarde → el partido se administra (${Math.round((model.state - 1) * 100)}%)`)
  if (prior?.estimado) down.push('Prior estimado (equipos sin TI real en su historial) — más incertidumbre')
  if (model.minuto < 20) down.push('Pocos minutos jugados — el ritmo observado pesa poco todavía')

  return { up, down }
}

// ─── LIVE-BACKTEST LOCAL (fábrica compartida TI/GK) ──────────────────────────
// Cada refresco guarda un snapshot {min, acum, proj, pCentral, lineCentral}
// usando SOLO información disponible en ese minuto. Al terminar el partido se
// resuelve con el total final real y se mide el error POR MINUTO.
const LOG_MAX = 50

export function makeLiveLog(storageKey) {
  const load = () => {
    try { return JSON.parse(localStorage.getItem(storageKey)) ?? {} } catch { return {} }
  }
  const save = (log) => {
    const ids = Object.keys(log)
    if (ids.length > LOG_MAX) {
      ids.sort((a, b) => (log[a].ts ?? 0) - (log[b].ts ?? 0))
      for (const id of ids.slice(0, ids.length - LOG_MAX)) delete log[id]
    }
    try { localStorage.setItem(storageKey, JSON.stringify(log)) } catch {}
  }

  return {
    logSnapshot(matchId, info, model) {
      if (!model || model.minuto < 5) return
      const log = load()
      const m = log[matchId] ?? { ts: Date.now(), snaps: [], final: null }
      // Actualizar metadata en cada llamada (el baseline/rojas pueden llegar tarde)
      for (const [k, v] of Object.entries(info ?? {})) if (v != null) m[k] = v
      const last = m.snaps[m.snaps.length - 1]
      if (last && model.minuto <= last.min) return // solo si avanzó el minuto
      const lineCentral = Math.floor(model.expectedFinal) + 0.5
      m.snaps.push({
        min: model.minuto,
        acum: model.acum,
        proj: model.expectedFinal,
        lineCentral,
        pCentral: model.pOver(lineCentral),
      })
      log[matchId] = m
      save(log)
    },
    resolve(matchId, finalTotal) {
      if (finalTotal == null) return
      const log = load()
      if (!log[matchId] || log[matchId].final != null) return
      log[matchId].final = finalTotal
      save(log)
    },
    pending() {
      const log = load()
      return Object.entries(log).filter(([, m]) => m.final == null && m.snaps.length)
        .map(([id, m]) => ({ id, ...m }))
    },
    // Resumen: error absoluto medio, acierto y Brier por tramo de minuto.
    // Incluye la comparación PREMATCH vs LIVE (§14): si el live no mejora el
    // error del baseline conforme avanza el partido, algo anda mal.
    summary() {
      const log = load()
      const resolved = Object.values(log).filter(m => m.final != null && m.snaps.length)
      if (!resolved.length) return null

      // Error del baseline prematch (solo partidos que lo tienen guardado)
      const conBase = resolved.filter(m => m.baseline != null)
      const pre = conBase.length ? {
        n: conBase.length,
        mae: +(conBase.reduce((s, m) => s + Math.abs(m.baseline - m.final), 0) / conBase.length).toFixed(1),
      } : null

      const BUCKETS = [[5, 20], [20, 35], [35, 50], [50, 65], [65, 80], [80, 95]]
      const rows = BUCKETS.map(([lo, hi]) => {
        const pts = []
        for (const m of resolved) {
          for (const s of m.snaps) {
            if (s.min >= lo && s.min < hi) pts.push({ err: Math.abs(s.proj - m.final), hit: (m.final > s.lineCentral) === (s.pCentral > 0.5), brier: (s.pCentral - (m.final > s.lineCentral ? 1 : 0)) ** 2 })
          }
        }
        if (!pts.length) return null
        return {
          bucket: `${lo}-${hi}'`,
          n: pts.length,
          mae: +(pts.reduce((s, p) => s + p.err, 0) / pts.length).toFixed(1),
          hit: Math.round(pts.reduce((s, p) => s + (p.hit ? 1 : 0), 0) / pts.length * 100),
          brier: +(pts.reduce((s, p) => s + p.brier, 0) / pts.length).toFixed(3),
        }
      }).filter(Boolean)
      return { matches: resolved.length, rows, pre, conRoja: resolved.filter(m => m.hayRoja).length }
    },
  }
}

const tiLog = makeLiveLog('motor_ti_livelog_v1')
export const logTiSnapshot = (matchId, info, model) => tiLog.logSnapshot(matchId, info, model)
export const resolveTiLog = (matchId, finalTi) => tiLog.resolve(matchId, finalTi)
export const tiLogPending = () => tiLog.pending()
export const tiBacktestSummary = () => tiLog.summary()
