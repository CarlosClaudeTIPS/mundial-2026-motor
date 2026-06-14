// ─── Motor de Análisis v2.0 ───────────────────────────────────────────────────

// Tactical K modifier
const TACTICAL_K = {
  bandas: 1.25,
  'mixto-bandas': 1.10,
  mixto: 1.00,
  central: 0.90,
}

// Situation S modifier based on goal difference
export function getSituationS(goalDiff) {
  if (goalDiff >= 2) return 0.82
  if (goalDiff === 1) return 0.93
  if (goalDiff === 0) return 1.00
  if (goalDiff === -1) return 1.18
  return 1.28
}

export function getTacticalK(style) {
  return TACTICAL_K[style] ?? 1.00
}

// ─── Expected Corners ─────────────────────────────────────────────────────────
export function calcExpectedCorners(teamA, teamB, tacticalStyle = 'mixto', situation = 'empate') {
  const goalDiff = situation === 'ganando2+' ? 2
    : situation === 'ganando1' ? 1
    : situation === 'empate' ? 0
    : situation === 'perdiendo1' ? -1
    : -2

  const S = getSituationS(goalDiff)
  const K = getTacticalK(tacticalStyle)

  const defModA = teamA.corners_against_avg > 0 ? teamA.corners_avg / teamA.corners_against_avg : 1
  const defModB = teamB.corners_against_avg > 0 ? teamB.corners_avg / teamB.corners_against_avg : 1

  const expA = teamA.corners_avg * defModB * K * S
  const expB = teamB.corners_avg * defModA * K * (2 - S)

  return {
    expA: +expA.toFixed(2),
    expB: +expB.toFixed(2),
    total: +(expA + expB).toFixed(2),
  }
}

// ─── Expected Shots ───────────────────────────────────────────────────────────
export function calcExpectedShots(teamA, teamB, absenceModifier = 1.0, motivationK = 1.0) {
  const defQualityB = teamB.shots_against_avg > 0
    ? teamA.shots_avg / teamB.shots_against_avg
    : 1

  const expShotsA = teamA.shots_avg * defQualityB * absenceModifier * motivationK
  const sotRatioA = teamA.shots_avg > 0 ? teamA.sot_avg / teamA.shots_avg : 0.4
  const expSOTA = expShotsA * sotRatioA

  const defQualityA = teamA.shots_against_avg > 0
    ? teamB.shots_avg / teamA.shots_against_avg
    : 1
  const expShotsB = teamB.shots_avg * defQualityA * absenceModifier * motivationK
  const sotRatioB = teamB.shots_avg > 0 ? teamB.sot_avg / teamB.shots_avg : 0.4
  const expSOTB = expShotsB * sotRatioB

  return {
    expShotsA: +expShotsA.toFixed(2),
    expSOTA: +expSOTA.toFixed(2),
    expShotsB: +expShotsB.toFixed(2),
    expSOTB: +expSOTB.toFixed(2),
    totalShots: +(expShotsA + expShotsB).toFixed(2),
    totalSOT: +(expSOTA + expSOTB).toFixed(2),
  }
}

// ─── EV y Value Score ─────────────────────────────────────────────────────────
export function calcEV(pModelo, cuota) {
  const ev = pModelo * cuota - 1
  const valueScore = Math.min(100, Math.max(0, 50 + ev * 200))
  return {
    ev: +ev.toFixed(4),
    evPct: +(ev * 100).toFixed(2),
    valueScore: +valueScore.toFixed(1),
    isActive: ev > 0.025,
  }
}

export function getImpliedProb(cuota) {
  return cuota > 0 ? +(1 / cuota).toFixed(4) : 0
}

// ─── Confidence Score ─────────────────────────────────────────────────────────
export function calcConfidence({
  lineupConfirmed = false,
  lineupProbable = false,
  dataConsistent = false,
  tacticalAligned = false,
  oddsStable = false,
  doubtfulPlayers = 0,
  confirmedAbsences = 0,
  contradictoryStats = false,
  matchesInWindow = 10,
}) {
  let score = 50

  if (lineupConfirmed) score += 15
  else if (lineupProbable) score += 7

  if (dataConsistent) score += 10
  if (tacticalAligned) score += 10
  if (oddsStable) score += 10

  score -= doubtfulPlayers * 10
  score -= confirmedAbsences * 20
  if (contradictoryStats) score -= 15
  if (matchesInWindow < 7) score -= 10

  return Math.min(95, Math.max(0, score))
}

export const CONFIDENCE_THRESHOLDS = {
  corners: 65,
  shots: 65,
  sot: 70,
  throwins: 60,
  cards: 70,
  handicap: 75,
  goals: 72,
  winner: 80,
}

// ─── Risk Score ───────────────────────────────────────────────────────────────
const RISK_BASE = {
  corners: 20,
  shots: 25,
  sot: 30,
  goals: 35,
  cards: 40,
  handicap: 45,
  winner: 55,
}

export function calcRisk({
  market,
  highImpactAbsence = false,
  strategyShift = false,
  neutralVenue = false,
  matchesInWindow = 10,
}) {
  let risk = RISK_BASE[market] ?? 30

  if (highImpactAbsence) risk += 10
  if (strategyShift) risk += 8
  if (neutralVenue) risk += 5
  if (matchesInWindow < 7) risk += 10

  return Math.min(100, risk)
}

export const RISK_PROFILES = {
  conservador: 40,
  moderado: 55,
  agresivo: 75,
}

export function getVeredicto(ev, confidence, risk, market, profile = 'moderado') {
  const minConf = CONFIDENCE_THRESHOLDS[market] ?? 65
  const maxRisk = RISK_PROFILES[profile]

  if (ev > 0.025 && confidence >= minConf && risk <= maxRisk) return 'ACTIVO'
  if (ev > 0 && confidence >= minConf - 5 && risk <= maxRisk + 10) return 'MARGINAL'
  return 'SIN VALOR'
}

// ─── Poisson para En Vivo ─────────────────────────────────────────────────────
export function poissonProb(lambda, k) {
  if (lambda <= 0) return k === 0 ? 1 : 0
  let prob = Math.exp(-lambda)
  for (let i = 0; i < k; i++) prob *= lambda / (i + 1)
  return prob
}

export function poissonOver(lambda, line) {
  let cumulative = 0
  const ceil = Math.ceil(line)
  for (let k = 0; k < ceil; k++) cumulative += poissonProb(lambda, k)
  return +(1 - cumulative).toFixed(4)
}

export function calcLiveExpected({ statAcumulada, minutos, minutosRestantes, situationS, tacticalK }) {
  const ritmo = minutos > 0 ? statAcumulada / minutos : 0
  const lambda = ritmo * minutosRestantes * situationS * tacticalK
  return { ritmo: +ritmo.toFixed(3), lambda: +lambda.toFixed(2) }
}

// ─── Altitude Correction ──────────────────────────────────────────────────────
export function altitudeCorrection(altitudeMsnm) {
  if (altitudeMsnm > 1800) return 0.92
  return 1.0
}

// ─── Minimum Cuota for EV > 2.5% ─────────────────────────────────────────────
export function minCuotaForEV(pModelo, evThreshold = 0.025) {
  if (pModelo <= 0) return null
  return +((1 + evThreshold) / pModelo).toFixed(2)
}
