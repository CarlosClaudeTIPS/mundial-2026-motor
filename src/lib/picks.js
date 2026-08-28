// ─── Generador de Picks — Motor de Apuestas Ligas ────────────────────────────
import { poissonOver } from './engine'
import { nbOver } from './throwins'

// ─── Líneas realistas ────────────────────────────────────────────────────────
// Las casas ponen las líneas CERCA del expected del mercado, no en 4.5 tiros.
// Genera 5 líneas .5 centradas en el expected con el paso típico del mercado.
export function linesAround(expected, step = 1, count = 5) {
  if (expected == null || expected <= 0) return []
  // Ancla en la media línea (X.5) más cercana al expected — como las casas
  const c = Math.floor(expected) + 0.5
  const half = Math.floor(count / 2)
  const out = []
  for (let i = -half; i <= half; i++) {
    const l = +(c + i * step).toFixed(2)
    if (l > 0) out.push(l)
  }
  return out
}

// Margen creíble: las casas no dejan value de +70% — si el margen es absurdo,
// la línea no existiría. Solo recomendamos entre 4% y 15% de edge.
export const MARGIN_MIN = 0.04
export const MARGIN_MAX = 0.15

// Mejor línea recomendable dentro del rango creíble (o null).
// Usa las MISMAS 5 líneas que se muestran en la tarjeta.
export function bestRealisticLine(expected, step = 1) {
  let best = null
  for (const line of linesAround(expected, step, 5)) {
    const margin = (expected - line) / line
    const abs = Math.abs(margin)
    if (abs < MARGIN_MIN || abs > MARGIN_MAX) continue
    if (!best || abs > Math.abs(best.margin)) {
      best = { line, dir: margin > 0 ? 'OVER' : 'UNDER', margin, pct: Math.round(margin * 100) }
    }
  }
  return best
}

const CORRELATION = {
  'shots-sot':     0.85,
  'shots-corners': 0.45,
  'shots-goals':   0.55,
  'shots-cards':   0.30,
  'sot-corners':   0.50,
  'sot-goals':     0.65,
  'corners-goals': 0.35,
  'cards-goals':   0.20,
  'corners-cards': 0.25,
  // Saques (spec v2 §9): TI-córners 0.60 → límite, no combinar
  'gk-shots':      0.40,
  'gk-ti':         0.35,
  'gk-corners':    0.30,
  'gk-goals':      0.30,
  'gk-cards':      0.20,
  'corners-ti':    0.60,
  'shots-ti':      0.35,
  'cards-ti':      0.25,
  'goals-ti':      0.20,
  'sot-ti':        0.35,
  'gk-sot':        0.40,
}

function corr(mktA, mktB) {
  const key = [mktA, mktB].sort().join('-')
  return CORRELATION[key] ?? 0.30
}

const MARKET_META = {
  shots_totales:   { label: 'Tiros Totales',     risk: 22, category: 'shots'   },
  sot_totales:     { label: 'SOT Totales',        risk: 28, category: 'sot'     },
  corners_totales: { label: 'Córners Totales',    risk: 22, category: 'corners' },
  goles_totales:   { label: 'Goles Totales',      risk: 38, category: 'goals'   },
  tarjetas_totales:{ label: 'Tarjetas Totales',   risk: 42, category: 'cards'   },
  tiros_local:     { label: 'Tiros Local',        risk: 30, category: 'shots'   },
  tiros_visita:    { label: 'Tiros Visitante',    risk: 30, category: 'shots'   },
  corners_1h:      { label: 'Córners 1H',         risk: 28, category: 'corners' },
  corners_2h:      { label: 'Córners 2H',         risk: 28, category: 'corners' },
  tiros_1h:        { label: 'Tiros Totales 1H',   risk: 30, category: 'shots'   },
  gk_totales:      { label: 'Saques Portería Totales', risk: 28, category: 'gk' },
  gk_local:        { label: 'Saques Portería Local',   risk: 30, category: 'gk' },
  gk_visita:       { label: 'Saques Portería Visitante', risk: 30, category: 'gk' },
  ti_totales:      { label: 'Saques Banda Totales', risk: 30, category: 'ti'    },
  // ── Mercados por equipo ──
  corners_local:   { label: 'Córners Local',      risk: 28, category: 'corners' },
  corners_visita:  { label: 'Córners Visitante',  risk: 28, category: 'corners' },
  sot_local:       { label: 'SOT Local',          risk: 32, category: 'sot'     },
  sot_visita:      { label: 'SOT Visitante',      risk: 32, category: 'sot'     },
  tarjetas_local:  { label: 'Tarjetas Local',     risk: 45, category: 'cards'   },
  tarjetas_visita: { label: 'Tarjetas Visitante', risk: 45, category: 'cards'   },
  ti_local:        { label: 'Saques Banda Local',    risk: 32, category: 'ti'   },
  ti_visita:       { label: 'Saques Banda Visitante', risk: 32, category: 'ti'  },
  goles_local:     { label: 'Goles Local',        risk: 42, category: 'goals'   },
  goles_visita:    { label: 'Goles Visitante',    risk: 42, category: 'goals'   },
}

// ─── Calcular P_modelo y EV para una línea ────────────────────────────────────
function evalLine(expected, line, cuota) {
  if (expected <= 0) return null
  const pOver  = poissonOver(expected, line)
  const pUnder = 1 - pOver
  const margin = (expected - line) / line

  // Decidir dirección
  const dir  = margin >= 0 ? 'OVER' : 'UNDER'
  const pMod = dir === 'OVER' ? pOver : pUnder
  const ev   = cuota ? pMod * cuota - 1 : null

  return { dir, pMod: +(pMod * 100).toFixed(1), ev: ev != null ? +(ev * 100).toFixed(1) : null, margin }
}

// ─── Generar candidatos de picks desde calc ───────────────────────────────────
export function generateCandidates(calc, _odds, teamA, teamB) {
  if (!calc) return []
  const candidates = []

  // Líneas dinámicas alrededor del expected con el paso típico de cada mercado
  const markets = [
    { key: 'shots_totales',    expected: calc.t.shots,    step: 2 },
    { key: 'sot_totales',      expected: calc.t.sot,      step: 1 },
    { key: 'corners_totales',  expected: calc.t.corners,  step: 1 },
    { key: 'goles_totales',    expected: calc.t.goals,    step: 0.5 },
    { key: 'tarjetas_totales', expected: calc.t.cards,    step: 1 },
    { key: 'tiros_local',      expected: calc.adj.shotsA, step: 1 },
    { key: 'tiros_visita',     expected: calc.adj.shotsB, step: 1 },
    { key: 'corners_local',    expected: calc.adj.cornA,  step: 1 },
    { key: 'corners_visita',   expected: calc.adj.cornB,  step: 1 },
    { key: 'sot_local',        expected: calc.adj.sotA,   step: 1 },
    { key: 'sot_visita',       expected: calc.adj.sotB,   step: 1 },
    { key: 'tarjetas_local',   expected: calc.adj.cardsA, step: 0.5 },
    { key: 'tarjetas_visita',  expected: calc.adj.cardsB, step: 0.5 },
    { key: 'ti_local',         expected: calc.adj.tiA,    step: 1 },
    { key: 'ti_visita',        expected: calc.adj.tiB,    step: 1 },
    { key: 'goles_local',      expected: calc.adj.goalsA, step: 0.5 },
    { key: 'goles_visita',     expected: calc.adj.goalsB, step: 0.5 },
    { key: 'corners_1h',       expected: calc.t.corn1h,   step: 1 },
    { key: 'corners_2h',       expected: calc.t.corn2h,   step: 1 },
    { key: 'tiros_1h',         expected: calc.t.shots1h,  step: 1 },
    { key: 'gk_totales',       expected: calc.t.gk,       step: 1 },
    { key: 'gk_local',         expected: calc.adj.gkA,    step: 1 },
    { key: 'gk_visita',        expected: calc.adj.gkB,    step: 1 },
    { key: 'ti_totales',       expected: calc.t.ti,       step: 2 },
  ]

  for (const { key, expected, step } of markets) {
    const meta = MARKET_META[key] ?? { label: key, risk: 35, category: 'other' }

    for (const line of linesAround(expected, step, 7)) {
      const margin = Math.abs((expected - line) / line)
      // Solo margen creíble: ni ruido (<4%) ni líneas que ninguna casa ofrecería (>22%)
      if (margin < MARGIN_MIN || margin > MARGIN_MAX) continue

      const result = evalLine(expected, line, null)
      if (!result) continue

      let confidence = 50
      if (margin > 0.15) confidence += 20
      else if (margin > 0.08) confidence += 12
      else if (margin > 0.03) confidence += 5
      if (teamA.est || teamB.est) confidence -= 10
      confidence = Math.min(85, Math.max(30, confidence))

      candidates.push({
        marketKey: key,
        label: meta.label,
        category: meta.category,
        expected: +expected.toFixed(2),
        line,
        dir: result.dir,
        pMod: result.pMod,
        ev: null,
        evNum: -999,
        margin: result.margin,
        cuota: null,
        confidence,
        risk: meta.risk,
      })
    }
  }

  // Ordenar por EV desc (si hay cuota), si no por margen abs desc
  candidates.sort((a, b) => b.evNum - a.evNum || Math.abs(b.margin) - Math.abs(a.margin))
  return candidates
}

// ─── Seleccionar top N (distintos mercados, baja correlación) ────────────────
export function selectTopPicks(candidates, max = 3) {
  const run = (minConf) => {
    const picks = []
    const usedCategories = new Set()
    for (const c of candidates) {
      if (picks.length >= max) break
      if (c.confidence < minConf) continue

      // No repetir misma categoría para picks principales
      if (picks.length < 2 && usedCategories.has(c.category)) continue

      // Verificar correlación con picks ya elegidos
      const maxCorr = picks.reduce((max, p) => Math.max(max, corr(p.category, c.category)), 0)
      if (maxCorr > 0.80) continue

      picks.push(c)
      usedCategories.add(c.category)
    }
    return picks
  }

  // Umbral estricto; si nada pasa (equipos con muestra pobre pierden -10 de
  // confianza — típico en fases previas, copas y recién ascendidos), relajar:
  // mejor mostrar los mejores picks con su confianza real que no mostrar nada.
  let picks = run(55)
  if (!picks.length) picks = run(45)
  return picks
}

// ─── PROBABILIDAD CONJUNTA de dos picks (revisión metodológica §7-§11) ───────
// P(A)×P(B) exige independencia — FALSA para picks del mismo partido que
// comparten estado (tempo). Aproximación: MATCH TEMPO latente de 3 estados
// (frío/normal/caliente) que escala los expecteds de los mercados sensibles
// al ritmo; los picks son condicionalmente independientes DADO el tempo.
// P(A∩B) = Σ_T w(T) · P(A|T) · P(B|T). El producto queda solo como benchmark.
// HEURÍSTICO (magnitudes ±12%, pesos 25/50/25) — marcado como no validado.
const TEMPO_STATES = [[0.88, 0.25], [1.00, 0.50], [1.12, 0.25]]

// P(pick | estado de tempo) con la MISMA familia del mercado individual:
// NB con su PHI (v4 §2 — coherencia entre individual y combinada).
function pPickDadoTempo(pick, T) {
  const sens = TEMPO_SENS[pick.category] ?? 0
  const exp = pick.expected * Math.pow(T, sens)
  const pOver = nbOver(exp, pick.line, PHI_CAT[pick.category] ?? 1.3)
  return pick.dir === 'OVER' ? pOver : 1 - pOver
}

// ─── Familia de distribución por mercado (auditoría v4 §2: COHERENCIA) ───────
// Las combinadas usan la MISMA familia que los mercados individuales:
// Negative Binomial con el PHI de cada mercado, condicionada al tempo.
// (Antes usaban Poisson — el individual decía una probabilidad y la combinada
// otra: incoherencia corregida.)
export const PHI_CAT = {
  shots: 1.45, sot: 1.25, corners: 1.30, cards: 1.20,
  goals: 1.10, ti: 1.40, gk: 1.35,
}
// Sensibilidad al tempo POR MERCADO (v4 §6): estructura para que cada mercado
// tenga su propia respuesta. Hoy heurística binaria (1 = sensible, 0 = no);
// el registro de respuesta observada permitirá estimarla después.
export const TEMPO_SENS = {
  shots: 1, sot: 1, corners: 1, goals: 1, cards: 1,
  ti: 0, gk: 0,
}

// ─── Muestreadores para el MC (NB = mezcla Gamma-Poisson) ────────────────────
function gauss(rng) {
  let u = 0; let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
function sampleGamma(shape, rng) { // scale 1, Marsaglia-Tsang
  if (shape < 1) {
    const u = rng()
    return sampleGamma(shape + 1, rng) * Math.pow(u, 1 / shape)
  }
  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  for (;;) {
    let x; let v
    do { x = gauss(rng); v = 1 + c * x } while (v <= 0)
    v = v * v * v
    const u = rng()
    if (u < 1 - 0.0331 * x * x * x * x) return d * v
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
  }
}
function samplePoisson(lambda, rng) {
  if (lambda > 60) { // aproximación normal para lambdas grandes (evita underflow)
    return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * gauss(rng)))
  }
  const L = Math.exp(-lambda)
  let k = 0; let p = 1
  do { k++; p *= rng() } while (p > L)
  return k - 1
}
function sampleNB(mean, phi, rng) {
  if (mean <= 0) return 0
  if (phi <= 1.001) return samplePoisson(mean, rng)
  // NB(mean, var=phi·mean) = Poisson(λ), λ ~ Gamma(r, scale=phi−1), r = mean/(phi−1)
  const scale = phi - 1
  const r = mean / scale
  const lambda = sampleGamma(r, rng) * scale
  return samplePoisson(lambda, rng)
}

// Validador MONTE CARLO (v3 §17 + v4 §3): mismo proceso generativo —
// muestrear tempo → NB de cada mercado (SU familia y SU phi) condicionada al
// MISMO estado → evaluar A, B y A∩B. Las marginales DEBEN coincidir con el
// analítico y con la probabilidad individual del mercado; si no → BUG MODEL.
export function jointProbabilityMC(pickA, pickB, n = 30000, rng = Math.random) {
  const cumW = []
  let acc = 0
  for (const [T, w] of TEMPO_STATES) { acc += w; cumW.push([T, acc]) }
  let cA = 0; let cB = 0; let cAB = 0
  for (let i = 0; i < n; i++) {
    const u = rng()
    const T = cumW.find(([, c]) => u <= c)[0]
    const expA = pickA.expected * Math.pow(T, TEMPO_SENS[pickA.category] ?? 0)
    const expB = pickB.expected * Math.pow(T, TEMPO_SENS[pickB.category] ?? 0)
    const xA = sampleNB(expA, PHI_CAT[pickA.category] ?? 1.3, rng)
    const xB = sampleNB(expB, PHI_CAT[pickB.category] ?? 1.3, rng)
    const okA = pickA.dir === 'OVER' ? xA > pickA.line : xA < pickA.line
    const okB = pickB.dir === 'OVER' ? xB > pickB.line : xB < pickB.line
    if (okA) cA++
    if (okB) cB++
    if (okA && okB) cAB++
  }
  return {
    margA: +(cA / n * 100).toFixed(1),
    margB: +(cB / n * 100).toFixed(1),
    pJoint: +(cAB / n * 100).toFixed(1),
  }
}

// Marginal de un pick bajo el MISMO proceso generativo de las combinadas
// (mixtura de tempo sobre NB) — para tests de coherencia MC vs analítico.
export function marginalTempo(pick) {
  let m = 0
  for (const [T, w] of TEMPO_STATES) m += w * pPickDadoTempo(pick, T)
  return +(m * 100).toFixed(1)
}

export function jointProbability(pickA, pickB) {
  // IMPORTANTE: marginales y conjunta salen del MISMO modelo de tempo — así el
  // ajuste por dependencia es solo el efecto covarianza (comparable de verdad).
  let margA = 0; let margB = 0; let pJoint = 0
  for (const [T, w] of TEMPO_STATES) {
    const a = pPickDadoTempo(pickA, T); const b = pPickDadoTempo(pickB, T)
    margA += w * a; margB += w * b; pJoint += w * a * b
  }
  const pIndep = margA * margB
  return {
    pIndep: +(pIndep * 100).toFixed(1),
    pJoint: +(pJoint * 100).toFixed(1),
    ajusteDep: +((pJoint - pIndep) * 100).toFixed(1), // pp por dependencia (covarianza del tempo)
  }
}

// ─── UNA SOLA PROBABILIDAD OFICIAL (v5 §2-3) ─────────────────────────────────
// El TEMPO es EXPERIMENTAL (no ha demostrado mejora sobre el baseline), así
// que NO contamina el modelo oficial: la probabilidad OFICIAL de cada pick es
// la MISMA NB plana que muestra su panel individual. La mixtura de tempo se
// usa solo como (a) modelo experimental de dependencia y (b) recorte
// conservador del gate de combinadas.
export const TEMPO_STATUS = 'EXPERIMENTAL'

export function pOficial(pick) { // NB plana — idéntica a la del panel individual
  const p = nbOver(pick.expected, pick.line, PHI_CAT[pick.category] ?? 1.3)
  return pick.dir === 'OVER' ? p : 1 - p
}

// ─── EV UNCERTAINTY ENGINE (v5 §9-§11) — escenarios, no distribuciones ───────
// Mientras los parámetros sean heurísticos NO se finge una distribución
// estadística: se recorre una malla EXPLÍCITA de escenarios (pesos del tempo ×
// magnitud del tempo × PHI ± × μ ±) y se reporta cuántos escenarios dan EV>0.
// Resultado marcado PROVISIONAL: es incertidumbre PARAMÉTRICA — NO incluye la
// incertidumbre ESTRUCTURAL (¿NB correcta? ¿el tempo existe?), que sigue ahí.
const ESC_PESOS = [[0.15, 0.70, 0.15], [0.25, 0.50, 0.25], [0.35, 0.30, 0.35]]
const ESC_MAG = [0.08, 0.12, 0.16]     // amplitud del tempo (baseline 0.12)
const ESC_PHI = [-0.15, 0, 0.15]       // corrimiento de PHI
const ESC_MU = [0.95, 1.00, 1.05]      // escala de μ

function pPickEscenario(pick, T, phiShift, muScale) {
  const sens = TEMPO_SENS[pick.category] ?? 0
  const exp = pick.expected * muScale * Math.pow(T, sens)
  const phi = Math.max(1.02, (PHI_CAT[pick.category] ?? 1.3) + phiShift)
  const p = nbOver(exp, pick.line, phi)
  return pick.dir === 'OVER' ? p : 1 - p
}

export function evUncertaintyEngine(pickA, pickB, odds) {
  const evs = []
  for (const pesos of ESC_PESOS) {
    for (const mag of ESC_MAG) {
      const estados = [[1 - mag, pesos[0]], [1.00, pesos[1]], [1 + mag, pesos[2]]]
      for (const phiShift of ESC_PHI) {
        for (const muScale of ESC_MU) {
          let pJoint = 0
          for (const [T, w] of estados) {
            pJoint += w * pPickEscenario(pickA, T, phiShift, muScale) * pPickEscenario(pickB, T, phiShift, muScale)
          }
          evs.push(pJoint * odds - 1)
        }
      }
    }
  }
  evs.sort((a, b) => a - b)
  const q = (p) => +(evs[Math.min(evs.length - 1, Math.floor(p * evs.length))] * 100).toFixed(1)
  const nPos = evs.filter(e => e > 0).length
  return {
    n: evs.length,
    nPos,
    fraccionPos: +(nPos / evs.length).toFixed(2),
    evMediana: q(0.5),
    evP10: q(0.10),
    evP90: q(0.90),
    status: 'PROVISIONAL', // incertidumbre paramétrica; la estructural NO está incluida
  }
}

// ─── Combinada — meta del usuario: cuota total ≥ 1.50 ────────────────────────
// v5: probabilidad OFICIAL = producto de las NB planas individuales (mismo
// número que ven los paneles). La conjunta-tempo es EXPERIMENTAL y solo puede
// RECORTAR el gate (min de ambas): el supuesto no validado nunca infla el EV.
export function suggestCombo(picks, targetOdds = 1.50) {
  if (picks.length < 2) return null
  let best = null
  for (let i = 0; i < picks.length; i++) {
    for (let j = i + 1; j < picks.length; j++) {
      const c = corr(picks[i].category, picks[j].category)
      if (c > 0.70) continue
      const pA = pOficial(picks[i]); const pB = pOficial(picks[j])
      const pIndepOficial = pA * pB
      const jp = jointProbability(picks[i], picks[j]) // EXPERIMENTAL (mixtura)
      const pGate = Math.min(pIndepOficial, jp.pJoint / 100) // conservador
      const evGate = pGate * targetOdds - 1
      if (!best) best = null
      if (!best || evGate > best.evGate) {
        best = { p1: picks[i], p2: picks[j], pA, pB, pIndepOficial, jp, pGate, evGate, correlation: c }
      }
    }
  }
  if (!best) return null

  const impTarget = +((1 / targetOdds) * 100).toFixed(1)
  const unc = evUncertaintyEngine(best.p1, best.p2, targetOdds)

  return {
    p1: best.p1, p2: best.p2,
    // OFICIAL: mismas probabilidades que los paneles individuales
    pA: +(best.pA * 100).toFixed(1),
    pB: +(best.pB * 100).toFixed(1),
    pIndep: +(best.pIndepOficial * 100).toFixed(1),
    // EXPERIMENTAL: conjunta con tempo (solo diagnóstico/recorte)
    pJointTempo: best.jp.pJoint,
    ajusteDep: best.jp.ajusteDep,
    tempoStatus: TEMPO_STATUS,
    // GATE conservador (min) — el que decide
    pGate: +(best.pGate * 100).toFixed(1),
    pCombo: +(best.pGate * 100).toFixed(1), // compat
    correlation: +best.correlation.toFixed(2),
    cuotaJusta: +(1 / best.pGate).toFixed(2),
    targetOdds, impTarget,
    evAlTarget: +(best.evGate * 100).toFixed(1),
    // Incertidumbre PARAMÉTRICA por escenarios (PROVISIONAL, no estructural)
    unc,
    // PROVISIONAL_RISK_GATE (no es un umbral estadístico calibrado):
    // EV del gate > +2% y la mayoría amplia de escenarios con EV positivo
    valeAlTarget: best.evGate > 0.02 && unc.fraccionPos >= 0.7,
  }
}

// ─── Generar explicación textual ─────────────────────────────────────────────
// base (opcional): baseline de la liga (getBaseline) — habilita la lectura de
// DIFICULTAD DEL RIVAL: no es lo mismo patearle al Racing que al Real Madrid.
export function generateExplanation(pick, teamA, teamB, ctx, calc, modsA, modsB, base = null) {
  const dir    = pick.dir === 'OVER' ? 'por encima' : 'por debajo'
  const pctStr = `${Math.abs(Math.round(pick.margin * 100))}%`

  const summary = `El motor espera ${pick.expected} ${pick.label.toLowerCase()} en este partido. La línea es ${pick.line}. El expected está ${pctStr} ${dir}.`

  // ── Mercado por equipo vs total, y dirección del pick ──
  // Cada razón debe hablar DEL EQUIPO del pick y APOYAR su dirección; lo que
  // vaya en contra se muestra como advertencia, nunca como argumento a favor.
  const isLocal  = /_local$/.test(pick.marketKey)
  const isVisita = /_visita$/.test(pick.marketKey)
  const target   = isLocal ? teamA : isVisita ? teamB : null
  const rival    = isLocal ? teamB : isVisita ? teamA : null
  const over     = pick.dir === 'OVER'
  const cat      = pick.category

  const statName = { shots: 'tiros', sot: 'tiros a puerta', corners: 'córners', goals: 'goles', cards: 'tarjetas', gk: 'saques de portería', ti: 'saques de banda' }[cat] ?? cat
  const avgOf = t => parseFloat(getStat(t, cat))
  const againstOf = t => cat === 'shots' ? t.shots_against_avg
    : cat === 'sot' ? (t.sot_against_avg ?? null)
    : cat === 'corners' ? t.corners_against_avg
    : cat === 'goals' ? t.ga_avg
    : cat === 'ti' ? t.ti_against_avg
    : cat === 'gk' ? t.gk_against_avg
    : null

  // Valor por partido de la categoría en una fila del historial
  const rowVal = r => cat === 'sot' ? r.sot : cat === 'shots' ? r.shots
    : cat === 'corners' ? r.corners : cat === 'cards' ? r.cards
    : cat === 'goals' ? r.gf : cat === 'ti' ? r.ti : cat === 'gk' ? r.gk : null

  // Promedio de la liga para esta categoría (para medir si el rival es blando/duro)
  const baseAvg = base == null ? null
    : cat === 'shots' ? base.shotsAvg
    : cat === 'sot' ? +(base.shotsAvg * 0.36).toFixed(1)
    : cat === 'corners' ? base.cornersAvg
    : cat === 'cards' ? base.cardsAvg
    : cat === 'gk' ? base.gkAvg
    : cat === 'ti' ? base.tiAvg
    : cat === 'goals' ? base.gaAvg
    : null

  const factors = []
  // supports: el dato apoya la dirección del pick → 'up'; si la contradice → 'down'.
  // Si el dato está PRÁCTICAMENTE EN la línea (±0.3), no es argumento ni a favor
  // ni en contra: decirlo honesto — "promedia 3.5 y la línea es 3.5" NO apoya un OVER.
  const add = (value, textUp, textDown) => {
    if (value == null || isNaN(value)) return
    if (Math.abs(value - pick.line) < 0.3) {
      const dato = textUp.split(' — ')[0]
      factors.push({ icon: 'ℹ️', text: `${dato} — prácticamente EN la línea ${pick.line}: este dato NO decide; el ${pick.dir} se apoya en el rival y el contexto`, dir: 'neutral' })
      return
    }
    const apoya = (value > pick.line) === over
    factors.push(apoya
      ? { icon: '✅', text: textUp, dir: 'up' }
      : { icon: '⚠️', text: textDown, dir: 'down' })
  }

  if (target) {
    // ── Pick de UN equipo: hablar SOLO de ese equipo y su rival directo ──
    const avg = avgOf(target)
    add(avg,
      `${target.name} promedia ${avg} ${statName}/partido en sus últimos ${target.matches ?? 10} — ${over ? 'por encima' : 'por debajo'} de la línea ${pick.line}`,
      `OJO: ${target.name} promedia ${avg} ${statName}/partido, que contradice el ${pick.dir} ${pick.line} — el motor lo ajustó por el rival y el contexto`)

    // Forma reciente: últimos 5 con los valores partido a partido
    const l5 = (target.last5 ?? []).map(rowVal).filter(v => v != null && !isNaN(v))
    if (l5.length >= 3) {
      const a5 = +(l5.reduce((s, v) => s + v, 0) / l5.length).toFixed(1)
      add(a5,
        `Forma reciente: ${a5} ${statName}/partido en los últimos ${l5.length} (${l5.join(', ')}) — acompaña el ${pick.dir}`,
        `OJO: forma reciente de ${a5} ${statName}/partido (${l5.join(', ')}) — los últimos partidos no acompañan el ${pick.dir}`)
    }

    const ag = rival ? againstOf(rival) : null
    if (ag != null) add(ag,
      `${rival.name} concede ${ag.toFixed(1)} ${statName}/partido a sus rivales — apoya el ${pick.dir}`,
      `OJO: ${rival.name} concede ${ag.toFixed(1)} ${statName}/partido — factor en contra del ${pick.dir}`)

    // ── DIFICULTAD DEL RIVAL: no es lo mismo el Racing que el Real Madrid ──
    // (a) Su defensa vs la media de la liga en esta categoría
    if (rival && ag != null && baseAvg) {
      const ratio = ag / baseAvg
      if (ratio >= 1.08) {
        factors.push(over
          ? { icon: '✅', text: `Rival blando en esto: ${rival.name} concede un ${Math.round((ratio - 1) * 100)}% MÁS ${statName} que la media de la liga (${ag.toFixed(1)} vs ${baseAvg}) — la línea es más alcanzable`, dir: 'up' }
          : { icon: '⚠️', text: `OJO: ${rival.name} concede un ${Math.round((ratio - 1) * 100)}% más ${statName} que la media de la liga — rival blando, factor en contra del UNDER`, dir: 'down' })
      } else if (ratio <= 0.92) {
        factors.push(!over
          ? { icon: '✅', text: `Rival duro en esto: ${rival.name} concede un ${Math.round((1 - ratio) * 100)}% MENOS ${statName} que la media de la liga (${ag.toFixed(1)} vs ${baseAvg}) — apoya el UNDER`, dir: 'up' }
          : { icon: '⚠️', text: `OJO: ${rival.name} es de las defensas que menos ${statName} conceden en la liga (${ag.toFixed(1)} vs media ${baseAvg}) — no es lo mismo que jugar contra un rival blando; factor en contra del OVER`, dir: 'down' })
      } else {
        factors.push({ icon: 'ℹ️', text: `Dificultad del rival: ${rival.name} concede ${ag.toFixed(1)} ${statName}/partido, en línea con la media de la liga (${baseAvg}) — rival estándar`, dir: 'neutral' })
      }
    }
    // (b) Diferencia de nivel (PPG): el superior domina y genera más volumen
    if (rival && ['shots', 'sot', 'corners', 'goals'].includes(cat)) {
      const dif = (target.ppg ?? 1.3) - (rival.ppg ?? 1.3)
      if (Math.abs(dif) >= 0.5) {
        const superior = dif > 0
        factors.push((superior === over)
          ? { icon: '✅', text: `Nivel: ${target.name} (PPG ${target.ppg}) es claramente ${superior ? 'superior' : 'inferior'} a ${rival.name} (PPG ${rival.ppg}) — ${superior ? 'debería dominar y generar volumen' : 'le costará generar'}, apoya el ${pick.dir}`, dir: 'up' }
          : { icon: '⚠️', text: `OJO: ${target.name} (PPG ${target.ppg}) es ${superior ? 'muy superior' : 'claramente inferior'} a ${rival.name} (PPG ${rival.ppg}) — factor en contra del ${pick.dir}`, dir: 'down' })
      }
    }
    // Localía del equipo del pick
    const split = isLocal ? target.split?.home : target.split?.away
    const splitVal = split ? (cat === 'shots' ? split.shots : cat === 'sot' ? split.sot : cat === 'corners' ? split.corners : cat === 'goals' ? split.gf : cat === 'cards' ? split.cards : null) : null
    if (splitVal != null) add(splitVal,
      `${isLocal ? 'En casa' : 'De visita'} promedia ${splitVal} (${split.n} PJ) — apoya el ${pick.dir}`,
      `OJO: ${isLocal ? 'en casa' : 'de visita'} promedia ${splitVal} (${split.n} PJ) — no acompaña el ${pick.dir}`)
    // Estilo bandas del equipo del pick (solo córners/TI)
    if ((cat === 'corners' || cat === 'ti') && (target.style === 'bandas' || target.style === 'mixto-bandas')) {
      factors.push(over
        ? { icon: '✅', text: `${target.name} ataca por bandas → genera más ${statName}`, dir: 'up' }
        : { icon: '⚠️', text: `OJO: ${target.name} ataca por bandas (empuja los ${statName}) — factor en contra del UNDER; el motor igual proyecta ${pick.expected} por su volumen y el rival`, dir: 'down' })
    }
    // Modificadores del equipo del pick
    const modsT = isLocal ? modsA : modsB
    const modKey = cat === 'sot' ? 'sot' : cat === 'ti' || cat === 'gk' ? null : cat
    const m = modKey ? modsT[modKey] : null
    if (m != null && Math.abs(m - 1) > 0.05) {
      const sube = m > 1
      factors.push((sube === over)
        ? { icon: '✅', text: `Contexto de ${target.name}: ${statName} ×${m.toFixed(2)} — empuja hacia el ${pick.dir}`, dir: 'up' }
        : { icon: '⚠️', text: `Contexto de ${target.name}: ${statName} ×${m.toFixed(2)} — va en contra del ${pick.dir}`, dir: 'down' })
    }
  } else {
    // ── Pick de TOTALES: la suma de ambos ──
    const sumAvg = +(avgOf(teamA) + avgOf(teamB)).toFixed(1)
    add(sumAvg,
      `Entre los dos suman ${sumAvg} ${statName}/partido de promedio — ${over ? 'por encima' : 'por debajo'} de la línea ${pick.line}`,
      `OJO: entre los dos suman ${sumAvg} ${statName}/partido, que contradice el ${pick.dir} ${pick.line} — el ajuste viene del contexto (defensas, ritmo de liga, copa)`)
    factors.push({ icon: 'ℹ️', text: `Desglose: ${teamA.name} ${avgOf(teamA)} + ${teamB.name} ${avgOf(teamB)} ${statName}/partido${baseAvg ? ` · media de la liga por equipo: ${baseAvg}` : ''}`, dir: 'neutral' })
    if (cat === 'corners' || cat === 'ti') {
      for (const t of [teamA, teamB]) {
        if (t.style === 'bandas' || t.style === 'mixto-bandas') {
          factors.push(over
            ? { icon: '✅', text: `${t.name} ataca por bandas → más ${statName}`, dir: 'up' }
            : { icon: '⚠️', text: `OJO: ${t.name} ataca por bandas (empuja los ${statName}) — factor en contra del UNDER`, dir: 'down' })
        }
      }
    }
    if (cat === 'goals') {
      factors.push({ icon: 'ℹ️', text: `BTTS: ${teamA.name} ${teamA.btts_pct}% · ${teamB.name} ${teamB.btts_pct}%`, dir: 'neutral' })
    }
    if (cat === 'gk') {
      const ppgDiff = Math.abs(teamA.ppg - teamB.ppg)
      if (ppgDiff > 0.4) {
        const debil = teamA.ppg < teamB.ppg ? teamA.name : teamB.name
        factors.push(over
          ? { icon: '✅', text: `${debil} es claramente inferior → defenderá más → más GK`, dir: 'up' }
          : { icon: '⚠️', text: `OJO: ${debil} es muy inferior y defenderá mucho (más GK) — factor en contra del UNDER`, dir: 'down' })
      }
    }
    if (cat === 'cards' && ctx.checks?.rivalidad) {
      factors.push(over
        ? { icon: '✅', text: 'Clásico/rivalidad → tarjetas ×1.20', dir: 'up' }
        : { icon: '⚠️', text: 'OJO: es un clásico (tarjetas ×1.20) — factor en contra del UNDER', dir: 'down' })
    }
    if (cat === 'ti' && ctx.checks?.lluvia) {
      factors.push(over
        ? { icon: '🌧️', text: 'Lluvia → balón resbaladizo → más saques de banda', dir: 'up' }
        : { icon: '⚠️', text: 'OJO: lluvia prevista (sube los saques de banda) — en contra del UNDER', dir: 'down' })
    }
  }

  // Eliminación directa apoya los UNDER de volumen y los OVER de tarjetas
  if (ctx.checks?.eliminacion && ['shots', 'sot', 'goals', 'corners', 'cards'].includes(cat)) {
    const favoreceUnder = cat !== 'cards'
    const apoya = favoreceUnder ? !over : over
    factors.push(apoya
      ? { icon: '⚔️', text: `Eliminación directa: partidos más cerrados → apoya el ${pick.dir}`, dir: 'up' }
      : { icon: '⚠️', text: `OJO: en eliminación directa ${favoreceUnder ? 'suele haber MENOS volumen' : 'suele haber MÁS tarjetas'} — factor en contra del ${pick.dir}`, dir: 'down' })
  }

  const pushUp   = factors.filter(f => f.dir === 'up')
  const pushDown = factors.filter(f => f.dir === 'down')
  const neutral  = factors.filter(f => f.dir === 'neutral')

  const keyVars = [
    { label: `${teamA.name} ${pick.category === 'shots' ? 'tiros' : pick.category === 'corners' ? 'córners' : 'stats'}/P`, value: getStat(teamA, pick.category), weight: '28%' },
    { label: `${teamB.name} ${pick.category === 'shots' ? 'tiros' : pick.category === 'corners' ? 'córners' : 'stats'}/P`, value: getStat(teamB, pick.category), weight: '28%' },
    { label: `Motivación ${teamA.name}`, value: `×${modsA[pick.category] ?? modsA.shots}`, weight: '12%' },
    { label: `Mod. jornada ${ctx.jornada}`, value: `×${getJornadaMod(ctx.jornada, pick.category)}`, weight: '5%' },
    { label: 'Expected final', value: pick.expected, weight: '—' },
  ]

  // Los factores en contra van de primeros en los riesgos — el usuario debe verlos
  const risks = pushDown.map(f => f.text.replace(/^OJO: /, ''))
  // Muestra pobre: decir CUÁL equipo y POR QUÉ (no un aviso genérico)
  for (const t of [teamA, teamB]) {
    if (t.est) {
      const razon = (t.statsMatches ?? 0) < 7
        ? `la API solo trae stats completas en ${t.statsMatches ?? '?'} de sus últimos ${t.matches ?? 10} partidos (los viejos o de copa vienen sin detalle)`
        : 'la mayoría de su muestra viene de otra división (recién ascendido — stats descontadas por tier)'
      risks.push(`Muestra pobre de ${t.name}: ${razon} — promedios menos fiables (−10 Confidence)`)
    }
  }
  if (ctx.jornada === 'inicio') risks.push('Inicio de temporada: equipos irregulares, más varianza')
  if (ctx.jornada === 'ko') risks.push('Eliminatoria KO: partidos más cerrados de lo que dicen las stats')
  if (pick.category === 'gk' || pick.category === 'ti') risks.push('GK/TI estimados (API no da el dato real) — verificar en Sofascore')
  if (!pick.cuota) risks.push('Cuota no disponible — EV no calculado')
  if (pick.confidence < 65) risks.push('Confidence bajo 65 — señal moderada')

  return { summary, pushUp, pushDown, neutral, keyVars, risks }
}

function getStat(team, category) {
  if (category === 'sot') return team.sot_avg.toFixed(1)
  if (category === 'shots') return team.shots_avg.toFixed(1)
  if (category === 'corners') return team.corners_avg.toFixed(1)
  if (category === 'goals') return team.gf_avg.toFixed(2)
  if (category === 'cards') return team.cards_avg.toFixed(1)
  if (category === 'gk') return team.goalkicks_avg.toFixed(1)
  if (category === 'ti') return team.throwins_avg.toFixed(1)
  return '—'
}

function getJornadaMod(fase, category) {
  if (fase === 'inicio') return category === 'cards' ? '×0.92' : '×0.94'
  if (fase === 'final')  return category === 'cards' ? '×1.12' : '×1.05'
  if (fase === 'ko')     return category === 'cards' ? '×1.10' : '×0.92'
  return '×1.00'
}
