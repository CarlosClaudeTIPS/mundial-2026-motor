// ─── Módulo de Contexto Situacional — Motor Mundial 2026 ──────────────────────
// Todos los modificadores se multiplican sobre el expected base.
// Expected_final = Expected_base × mod_jornada × mod_descanso × mod_motivacion × mod_contexto

// ─── Estructura de modificadores ─────────────────────────────────────────────
// { shots, sot, corners, cards, goals }
// Cada valor es un multiplicador. 1.0 = sin cambio.

export const DEFAULT_MODS = { shots: 1, sot: 1, corners: 1, cards: 1, goals: 1 }

// ─── BLOQUE 1: Jornada ────────────────────────────────────────────────────────
export const JORNADA_OPTIONS = [
  { value: 'J1', label: 'J1 — Primera jornada' },
  { value: 'J2', label: 'J2 — Segunda jornada' },
  { value: 'J3', label: 'J3 — Última jornada' },
]

export function getJornadaMods(jornada) {
  if (jornada === 'J1') return { shots: 0.95, sot: 0.95, corners: 0.97, cards: 0.90, goals: 0.95 }
  if (jornada === 'J3') return { shots: 1.05, sot: 1.02, corners: 1.02, cards: 1.15, goals: 1.05 }
  return DEFAULT_MODS // J2
}

// ─── BLOQUE 2: Descanso ───────────────────────────────────────────────────────
export const DESCANSO_OPTIONS = [
  { value: 3, label: '3 días' },
  { value: 4, label: '4 días' },
  { value: 5, label: '5 días' },
  { value: 6, label: '6+ días' },
]

export function getDescansoMods(dias, viajeL = false) {
  let m
  if (dias <= 3)      m = { shots: 0.88, sot: 0.88, corners: 0.92, cards: 1.05, goals: 0.90 }
  else if (dias === 4) m = { shots: 0.95, sot: 0.95, corners: 0.97, cards: 1.00, goals: 0.97 }
  else if (dias === 5) m = { ...DEFAULT_MODS }
  else                 m = { shots: 1.03, sot: 1.03, corners: 1.01, cards: 0.95, goals: 1.02 }

  if (viajeL) {
    m = { ...m, shots: +(m.shots * 0.92).toFixed(4), sot: +(m.sot * 0.92).toFixed(4), corners: +(m.corners * 0.95).toFixed(4) }
  }
  return m
}

// ─── BLOQUE 3: Motivación ─────────────────────────────────────────────────────
export const MOTIVACION_OPTIONS = [
  { value: 'necesita_ganar',   label: '🔥 Necesita ganar sí o sí' },
  { value: 'ganar_o_empatar',  label: '⚡ Ganar o empatar clasifica' },
  { value: 'cualquier_result', label: '🎯 Cualquier resultado clasifica' },
  { value: 'ya_clasificado',   label: '😴 Ya clasificado, puede rotar' },
  { value: 'ya_eliminado',     label: '💀 Ya eliminado, sin nada que perder' },
  { value: 'incierto',         label: '❓ Situación incierta / depende de otro' },
]

export function getMotivacionMods(situacion) {
  switch (situacion) {
    case 'necesita_ganar':
      return { shots: 1.20, sot: 1.15, corners: 1.18, cards: 1.25, goals: 1.15 }
    case 'ganar_o_empatar':
      return { shots: 1.08, sot: 1.05, corners: 1.05, cards: 1.10, goals: 1.05 }
    case 'cualquier_result':
      return { ...DEFAULT_MODS }
    case 'ya_clasificado':
      return { shots: 0.85, sot: 0.82, corners: 0.88, cards: 0.80, goals: 0.82 }
    case 'ya_eliminado':
      return { shots: 1.05, sot: 1.02, corners: 1.02, cards: 1.10, goals: 1.03 }
    case 'incierto':
      return { ...DEFAULT_MODS } // mods neutros, pero baja confidence
    default:
      return { ...DEFAULT_MODS }
  }
}

// ─── Combinaciones especiales motivación ─────────────────────────────────────
export function getMotivacionCombo(sitA, sitB) {
  const alerts = []
  let extraA = { ...DEFAULT_MODS }
  let extraB = { ...DEFAULT_MODS }
  let extraGlobal = { ...DEFAULT_MODS }

  if (sitA === 'ya_clasificado' && sitB === 'ya_clasificado') {
    extraGlobal = { shots: 0.80, sot: 0.78, corners: 0.82, cards: 0.70, goals: 0.80 }
    alerts.push({ type: 'danger', msg: '⚠️ Partido sin motivación real — Under en todos los mercados de volumen' })
  } else if (sitA === 'ya_eliminado' && sitB === 'ya_eliminado') {
    extraGlobal = { shots: 1.08, sot: 1.05, corners: 1.05, cards: 1.15, goals: 1.05 }
    alerts.push({ type: 'info', msg: 'Partidos de equipos eliminados suelen ser más abiertos de lo esperado' })
  } else if (sitA === 'necesita_ganar' && sitB === 'necesita_ganar') {
    extraGlobal = { shots: 1.15, sot: 1.12, corners: 1.10, cards: 1.30, goals: 1.10 }
    alerts.push({ type: 'success', msg: '🔥 Partido de máxima intensidad — Over en todos los mercados' })
  } else if (sitA === 'necesita_ganar' && sitB === 'ya_clasificado') {
    extraA = { shots: 1.20, sot: 1.15, corners: 1.10, cards: 1.15, goals: 1.10 }
    extraB = { shots: 0.85, sot: 0.85, corners: 0.90, cards: 1.15, goals: 0.88 }
    alerts.push({ type: 'warning', msg: 'Partido muy asimétrico — el equipo motivado generará volumen, el otro cerrará' })
  } else if (sitB === 'necesita_ganar' && sitA === 'ya_clasificado') {
    extraB = { shots: 1.20, sot: 1.15, corners: 1.10, cards: 1.15, goals: 1.10 }
    extraA = { shots: 0.85, sot: 0.85, corners: 0.90, cards: 1.15, goals: 0.88 }
    alerts.push({ type: 'warning', msg: 'Partido muy asimétrico — el equipo motivado generará volumen, el otro cerrará' })
  }

  if (sitA === 'incierto' || sitB === 'incierto') {
    alerts.push({ type: 'warning', msg: 'El planteamiento puede cambiar según el resultado del otro partido del grupo' })
  }

  return { extraA, extraB, extraGlobal, alerts }
}

// ─── Confidence delta por motivación ─────────────────────────────────────────
export function getMotivacionConfidenceDelta(sitA, sitB) {
  let delta = 0
  if (sitA === 'necesita_ganar' && sitB === 'necesita_ganar') delta += 8
  else if (sitA !== sitB && sitA !== 'incierto' && sitB !== 'incierto') delta += 5
  if (sitA === 'incierto' || sitB === 'incierto') delta -= 5
  if (sitA === 'ya_clasificado' || sitB === 'ya_clasificado') delta -= 10
  if (sitA === 'ya_clasificado' && sitB === 'ya_clasificado') delta -= 15
  return delta
}

// ─── BLOQUE 4: Contexto adicional ─────────────────────────────────────────────
export const CONTEXTO_CHECKS = [
  { key: 'rivalidad',    label: 'Clásico regional o rivalidad histórica',     mods: { shots: 1, sot: 1, corners: 1, cards: 1.20, goals: 1 } },
  { key: 'calor',        label: 'Calor extremo pronosticado (>32°C)',          mods: { shots: 0.94, sot: 0.94, corners: 0.95, cards: 1.05, goals: 0.94 } },
  { key: 'lluvia',       label: 'Lluvia intensa pronosticada',                 mods: { shots: 0.90, sot: 0.90, corners: 0.92, cards: 1.00, goals: 0.95 } },
  { key: 'arbitro_alto', label: 'Árbitro con historial de muchas tarjetas',   mods: { shots: 1, sot: 1, corners: 1, cards: 1.15, goals: 1 } },
  { key: 'arbitro_bajo', label: 'Árbitro con historial de pocas tarjetas',    mods: { shots: 1, sot: 1, corners: 1, cards: 0.85, goals: 1 } },
]

export function getContextoMods(checks) {
  return CONTEXTO_CHECKS
    .filter(c => checks[c.key])
    .reduce((acc, c) => ({
      shots:   acc.shots   * c.mods.shots,
      sot:     acc.sot     * c.mods.sot,
      corners: acc.corners * c.mods.corners,
      cards:   acc.cards   * c.mods.cards,
      goals:   acc.goals   * c.mods.goals,
    }), { ...DEFAULT_MODS })
}

// ─── Combinar todos los modificadores para un equipo ─────────────────────────
export function applyMods(base, ...mods) {
  return mods.reduce((acc, m) => ({
    shots:   +(acc.shots   * (m.shots   ?? 1)).toFixed(4),
    sot:     +(acc.sot     * (m.sot     ?? 1)).toFixed(4),
    corners: +(acc.corners * (m.corners ?? 1)).toFixed(4),
    cards:   +(acc.cards   * (m.cards   ?? 1)).toFixed(4),
    goals:   +(acc.goals   * (m.goals   ?? 1)).toFixed(4),
  }), base)
}

// ─── Alerta de volumen global ─────────────────────────────────────────────────
export function getVolumeAlert(baseTotal, adjTotal) {
  if (baseTotal <= 0) return null
  const delta = (adjTotal - baseTotal) / baseTotal
  if (delta < -0.20) return {
    type: 'warning',
    msg: '⚠️ El contexto situacional sugiere partido de bajo volumen. Under en tiros, córners y goles tiene valor contextual fuerte.',
  }
  if (delta > 0.15) return {
    type: 'success',
    msg: '🔥 El contexto situacional eleva el volumen esperado. Over en tiros y tarjetas tiene soporte adicional al estadístico.',
  }
  return null
}
