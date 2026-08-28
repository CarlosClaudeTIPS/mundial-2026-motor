// ─── MATCH STATE ENGINE — estado único del partido para TODOS los módulos ────
//
// Regla arquitectónica (spec separación prematch/live §9-§10): minuto, marcador,
// rojas, ritmo, presión y régimen se calculan UNA vez aquí y todos los módulos
// (tiros, córners, saques, tarjetas, futuros) los consumen. Nada de que cada
// módulo recalcule lo mismo por su lado → cero inconsistencias.
//
// También concentra los CAMBIOS ESTRUCTURALES (§8): la tarjeta roja no es "una
// variable más" — reconfigura el partido. El equipo con 10 pierde volumen
// ofensivo (~20-30%, efecto muy replicado en fútbol) y el rival gana territorio.
// Factores conservadores, acotados y RECALIBRABLES con el live-backtest local
// (los partidos con roja quedan marcados en el registro para ajustarlos).

const numv = v => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return (n == null || isNaN(n)) ? null : n
}

// ── Minutos efectivos restantes (añadido incluido) ───────────────────────────
export function restanteEfectivo(minuto) {
  const addedLeft = minuto <= 45 ? 5 : minuto <= 90 ? Math.max(0, 5 - Math.max(0, minuto - 90)) : 0
  return Math.max(0, (minuto > 90 ? 120 - minuto : 90 - minuto) + addedLeft)
}

// ── Cambio de régimen: ritmo reciente vs ritmo del partido ───────────────────
// snaps: [{min, <key>}] acumulados. Genérico para cualquier stat.
export function regimeOf(snaps, key, acum, minuto, { span = 8, clamp = [0.85, 1.15], soft = 0.5 } = {}) {
  if (!snaps || snaps.length < 2 || !minuto || acum == null) return { factor: 1, detected: false }
  const last = snaps[snaps.length - 1]
  let past = null
  for (const s of snaps) {
    if (s[key] == null) continue
    if (last.min - s.min >= span) past = s
  }
  if (!past || last[key] == null) return { factor: 1, detected: false }
  const realSpan = last.min - past.min
  if (realSpan < span) return { factor: 1, detected: false }
  const recentRate = (last[key] - past[key]) / realSpan
  const matchRate = acum / minuto
  if (matchRate <= 0) return { factor: 1, detected: false }
  const [lo, hi] = clamp
  const raw = Math.min(hi, Math.max(lo, recentRate / matchRate))
  return {
    factor: Math.pow(raw, soft),
    detected: raw <= 0.90 || raw >= 1.10,
    dir: raw >= 1.10 ? 'up' : raw <= 0.90 ? 'down' : 'flat',
    recentRate: +recentRate.toFixed(3),
    matchRate: +matchRate.toFixed(3),
    span: realSpan,
  }
}

// ── Presión sostenida: ataques peligrosos/min vs baseline ────────────────────
export function pressureFactor(daTotal, minuto, { base = 1.1, clamp = [0.88, 1.12], soft = 0.5, minMin = 12 } = {}) {
  if (daTotal == null || !minuto || minuto < minMin) return { factor: 1, obs: null }
  const obs = daTotal / minuto
  const [lo, hi] = clamp
  return { factor: Math.pow(Math.min(hi, Math.max(lo, obs / base)), soft), obs: +obs.toFixed(2) }
}

// ── TARJETA ROJA — cambio estructural (§8) ───────────────────────────────────
// Devuelve el multiplicador de GENERACIÓN OFENSIVA de un lado según las rojas.
// ownReds: rojas propias · rivalReds: rojas del rival.
//   con 10 → genera ×0.80 (se mete atrás) · rival con 10 → genera ×1.08
//   (domina, aunque el bloque bajo rival frena parte del beneficio).
// Para SAQUES DE PORTERÍA es al revés: el de 10 despeja y saca MÁS (×1.12),
// el que domina saca menos (×0.92) — usar redCardFactorGk.
// RECALIBRABLE: los logs marcan partidos con roja para validar estas magnitudes.
export const RED_CARD = { OWN_GEN: 0.80, RIVAL_GEN: 1.08, OWN_GK: 1.12, RIVAL_GK: 0.92 }

export function redCardFactor(ownReds = 0, rivalReds = 0) {
  let f = 1
  if (ownReds > 0) f *= Math.pow(RED_CARD.OWN_GEN, Math.min(2, ownReds))
  if (rivalReds > 0) f *= Math.pow(RED_CARD.RIVAL_GEN, Math.min(2, rivalReds))
  return +f.toFixed(3)
}

export function redCardFactorGk(ownReds = 0, rivalReds = 0) {
  let f = 1
  if (ownReds > 0) f *= RED_CARD.OWN_GK
  if (rivalReds > 0) f *= RED_CARD.RIVAL_GK
  return +f.toFixed(3)
}

// ── ESTADO COMPLETO DEL PARTIDO ──────────────────────────────────────────────
// Construido UNA vez por refresco en EnVivo y pasado a todos los paneles.
export function buildMatchState({ minuto, golesA = 0, golesB = 0, raw = null, snaps = [] }) {
  const g = (side, key) => raw ? numv(raw[side]?.[key]) : null

  const redH = g('home', 'Red Cards') ?? 0
  const redA = g('away', 'Red Cards') ?? 0
  const daH = g('home', 'Dangerous Attacks')
  const daA = g('away', 'Dangerous Attacks')
  const daTotal = (daH != null || daA != null) ? (daH ?? 0) + (daA ?? 0) : null
  const blkH = g('home', 'Blocked Shots')
  const blkA = g('away', 'Blocked Shots')
  const posH = g('home', 'Ball Possession')

  const pressure = pressureFactor(daTotal, minuto)

  return {
    minuto,
    restEff: restanteEfectivo(minuto ?? 0),
    golesA, golesB,
    goalDiff: golesA - golesB,
    // Rojas → cambio estructural: factores de generación por lado
    redH, redA,
    hayRoja: redH > 0 || redA > 0,
    redGenH: redCardFactor(redH, redA),   // multiplicador ofensivo del local
    redGenA: redCardFactor(redA, redH),   // multiplicador ofensivo del visitante
    redGkH: redCardFactorGk(redH, redA),  // multiplicador de GK del local
    redGkA: redCardFactorGk(redA, redH),
    // Presión / tempo compartidos
    daTotal, daH, daA,
    pressure,               // { factor, obs }
    tempo: pressure.obs == null ? null : pressure.obs >= 1.35 ? 'alto' : pressure.obs <= 0.85 ? 'bajo' : 'normal',
    blkH, blkA,
    blkTotal: (blkH != null || blkA != null) ? (blkH ?? 0) + (blkA ?? 0) : null,
    possessionH: posH,
    snaps,
  }
}
