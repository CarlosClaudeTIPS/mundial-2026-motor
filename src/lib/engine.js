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
// Fórmula: promedio ponderado ataque(60%) + defensa rival(40%)
// Evita explosión cuando la ratio ataque/contra-rival es muy alta
export function calcExpectedCorners(teamA, teamB) {
  // Estilo REAL por equipo (inferido de centros/partido en Sofascore):
  // el que ataca por bandas centra más → más despejes al córner (spec Tactical_K)
  const KA = getTacticalK(teamA.style)
  const KB = getTacticalK(teamB.style)

  // Promedio ponderado: ataque propio 60% + lo que concede el rival 40%
  const expA = (teamA.corners_avg * 0.6 + teamB.corners_against_avg * 0.4) * KA
  const expB = (teamB.corners_avg * 0.6 + teamA.corners_against_avg * 0.4) * KB

  return {
    expA: +expA.toFixed(2),
    expB: +expB.toFixed(2),
    total: +(expA + expB).toFixed(2),
    KA, KB,
  }
}

// ─── Expected Shots ───────────────────────────────────────────────────────────
// Fórmula: promedio ponderado ataque(60%) + defensa rival(40%)
export function calcExpectedShots(teamA, teamB, absenceModifier = 1.0, motivationK = 1.0) {
  const expShotsA = (teamA.shots_avg * 0.6 + teamB.shots_against_avg * 0.4) * absenceModifier * motivationK
  const sotRatioA = teamA.shots_avg > 0 ? teamA.sot_avg / teamA.shots_avg : 0.38
  const expSOTA = expShotsA * sotRatioA

  const expShotsB = (teamB.shots_avg * 0.6 + teamA.shots_against_avg * 0.4) * absenceModifier * motivationK
  const sotRatioB = teamB.shots_avg > 0 ? teamB.sot_avg / teamB.shots_avg : 0.38
  const expSOTB = expShotsB * sotRatioB

  return {
    expShotsA: +expShotsA.toFixed(2),
    expSOTA:   +expSOTA.toFixed(2),
    expShotsB: +expShotsB.toFixed(2),
    expSOTB:   +expSOTB.toFixed(2),
    totalShots: +(expShotsA + expShotsB).toFixed(2),
    totalSOT:   +(expSOTA  + expSOTB).toFixed(2),
  }
}

// ─── Expected Goal Kicks (Saques de Portería) — spec v2 §6.3 ─────────────────
// GK_avg × Posesion_mod_rival × Nivel_diff_mod
// Posesión estimada desde volumen de pases (proxy: no hay possession_avg en datos)
// Insight clave: el equipo débil siempre suma más GK; correlación GK↔posesión ≈ -0.72
export function calcExpectedGK(teamA, teamB) {
  const totalPasses = teamA.passes_avg + teamB.passes_avg
  const posB = totalPasses > 0 ? teamB.passes_avg / totalPasses : 0.5
  const posA = 1 - posB

  const posesionMod = (posRival) => {
    if (posRival >= 0.60) return 1.25
    if (posRival >= 0.55) return 1.12
    if (posRival >= 0.45) return 1.00
    if (posRival >= 0.40) return 0.90
    return 0.82
  }

  // Diferencia de nivel (PPG): el débil pasa el partido defendiendo → más GK
  const ppgDiff = teamA.ppg - teamB.ppg
  const nivelMod = (diff) => {
    if (diff < -0.8) return 1.28
    if (diff < -0.4) return 1.10
    return 1.00
  }

  const expA = teamA.goalkicks_avg * posesionMod(posB) * nivelMod(ppgDiff)
  const expB = teamB.goalkicks_avg * posesionMod(posA) * nivelMod(-ppgDiff)

  return {
    expA: +expA.toFixed(2),
    expB: +expB.toFixed(2),
    total: +(expA + expB).toFixed(2),
    posA: +(posA * 100).toFixed(0),
    posB: +(posB * 100).toFixed(0),
    weakerTeam: ppgDiff < -0.4 ? 'A' : ppgDiff > 0.4 ? 'B' : null,
  }
}

// ─── Expected Throw-ins (Saques de Banda) — spec v2 §6.4 ─────────────────────
// TI_avg × Tactical_K_TI × K_liga_TI × Clima × Tipo_partido
// Mundial 2026: K_liga_TI = 1.00 (neutro)
const TACTICAL_K_TI = {
  bandas: 1.22,
  'mixto-bandas': 1.10,
  mixto: 1.00,
  central: 0.88,
}

export function calcExpectedTI(teamA, teamB, { lluvia = false, rivalidad = false, kLiga = 1.00 } = {}) {
  const climaMod = lluvia ? 1.15 : 1.00
  const tipoMod = rivalidad ? 1.10 : 1.00

  const kA = TACTICAL_K_TI[teamA.style] ?? 1.00
  const kB = TACTICAL_K_TI[teamB.style] ?? 1.00

  const expA = teamA.throwins_avg * kA * kLiga * climaMod * tipoMod
  const expB = teamB.throwins_avg * kB * kLiga * climaMod * tipoMod

  return {
    expA: +expA.toFixed(2),
    expB: +expB.toFixed(2),
    total: +(expA + expB).toFixed(2),
    mods: { climaMod, tipoMod, kA, kB },
  }
}

// ─── Expected Goals con interacción defensiva — spec v2 §6.6 ─────────────────
// goals_pg_A × goals_against_mod_B — el promedio de liga normaliza la defensa rival
const LEAGUE_AVG_GA = 1.35 // promedio goles recibidos/partido (selecciones nivel Mundial)

export function calcExpectedGoals(teamA, teamB, altMod = 1.0) {
  const gaModB = teamB.ga_avg / LEAGUE_AVG_GA
  const gaModA = teamA.ga_avg / LEAGUE_AVG_GA

  // Ataque real = mezcla de goles anotados y xG (spec §6.6: usar xG cuando exista).
  // El xG corrige rachas: un equipo que generó mucho pero definió mal NO es un
  // equipo que no ataca — y viceversa con el que vive de pegadas.
  const atkA = teamA.xg_avg != null ? teamA.gf_avg * 0.5 + teamA.xg_avg * 0.5 : teamA.gf_avg
  const atkB = teamB.xg_avg != null ? teamB.gf_avg * 0.5 + teamB.xg_avg * 0.5 : teamB.gf_avg
  // Defensa real = mezcla de goles recibidos y xG concedido
  const defB = teamB.xga_avg != null ? (teamB.ga_avg * 0.5 + teamB.xga_avg * 0.5) / LEAGUE_AVG_GA : gaModB
  const defA = teamA.xga_avg != null ? (teamA.ga_avg * 0.5 + teamA.xga_avg * 0.5) / LEAGUE_AVG_GA : gaModA

  const expA = atkA * defB * altMod
  const expB = atkB * defA * altMod

  // BTTS solo si ambos marcan Y ambos conceden con frecuencia (spec: >60%/>60%)
  const bttsViable = teamA.btts_pct > 55 && teamB.btts_pct > 55 && expA > 0.8 && expB > 0.8

  return {
    expA: +expA.toFixed(2),
    expB: +expB.toFixed(2),
    total: +(expA + expB).toFixed(2),
    bttsViable,
    usaXG: teamA.xg_avg != null || teamB.xg_avg != null,
  }
}

// ─── Expected Tarjetas — modelo causal desde faltas (no promedio pelado) ─────
// Cadena real: fricción → faltas → tarjetas. El expected de faltas del cruce
// (que ya incluye la interacción entre equipos) se convierte a tarjetas con la
// tasa tarjeta-por-falta propia de cada equipo, y se mezcla 50/50 con su
// promedio directo para no perder la señal disciplinaria pura.
export function calcExpectedCards(teamA, teamB, expFoulsA, expFoulsB) {
  const RATE_DEFAULT = 0.18 // tasa típica: ~1 tarjeta cada 5.5 faltas

  const rateA = teamA.cardsPerFoul ?? RATE_DEFAULT
  const rateB = teamB.cardsPerFoul ?? RATE_DEFAULT

  const causalA = expFoulsA * rateA
  const causalB = expFoulsB * rateB

  const expA = causalA * 0.5 + teamA.cards_avg * 0.5
  const expB = causalB * 0.5 + teamB.cards_avg * 0.5

  return {
    expA: +expA.toFixed(2),
    expB: +expB.toFixed(2),
    total: +(expA + expB).toFixed(2),
    rateA: +rateA.toFixed(3),
    rateB: +rateB.toFixed(3),
  }
}

// ─── Expected Passes ─────────────────────────────────────────────────────────
export function calcExpectedPasses(teamA, teamB) {
  const expA = teamA.passes_avg * 0.65 + teamB.passes_against_avg * 0.35
  const expB = teamB.passes_avg * 0.65 + teamA.passes_against_avg * 0.35
  return {
    expPassesA: +expA.toFixed(0),
    expPassesB: +expB.toFixed(0),
    total: +(expA + expB).toFixed(0),
  }
}

// ─── Expected Fouls ───────────────────────────────────────────────────────────
export function calcExpectedFouls(teamA, teamB, motivModA = 1.0, motivModB = 1.0) {
  const expA = (teamA.fouls_avg * 0.6 + teamB.fouls_against_avg * 0.4) * motivModA
  const expB = (teamB.fouls_avg * 0.6 + teamA.fouls_against_avg * 0.4) * motivModB
  return {
    expFoulsA: +expA.toFixed(1),
    expFoulsB: +expB.toFixed(1),
    total: +(expA + expB).toFixed(1),
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
  gk: 60,
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
  gk: 28,
  ti: 30,
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
