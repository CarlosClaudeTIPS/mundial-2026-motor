// ─── GAME STATE ENGINE — EXPERIMENTAL (no reemplaza al baseline) ─────────────
//
// AUDITORÍA que lo motiva (2026-08-29):
// El motor live actual ajusta por marcador con getSituationS(goalDiff), que es
// función ÚNICAMENTE de la diferencia de goles:
//     -1 → ×1.18   ·   -2 → ×1.28   ·   +1 → ×0.93   ·   +2 → ×0.82
// Es decir, HOY el modelo NO distingue:
//   · 0-1 al minuto 20 de 0-1 al minuto 85 (no usa el tiempo restante)
//   · un favorito perdiendo de un colista perdiendo (no usa la fuerza)
//   · un equipo que pierde Y responde de uno que pierde y NO responde
//     (no compara la producción observada contra su propio baseline)
//
// Este módulo construye la representación explícita del estado y un factor de
// respuesta que SÍ combina esas cuatro cosas. Es EXPERIMENTAL: se calcula en
// paralelo y se registra para comparar contra el baseline. NO decide señales
// hasta que el backtest demuestre mejora (arquitectura congelada).
//
// Solo usa variables REALMENTE disponibles en nuestras fuentes:
//   Live-Score → marcador, minuto, tiros/SOT/córners/bloqueados por equipo,
//                ataques peligrosos, tarjetas, rojas
//   Priors     → PPG, volumen ofensivo/defensivo por equipo (buildTeamStats)
// Lo que NO tenemos (PPDA, zonas, xG en vivo, sustituciones fiables) queda
// declarado como NOT_AVAILABLE, nunca inventado.

import { getSituationS } from './engine'

export const GAME_STATE_STATUS = 'EXPERIMENTAL'

// Lo que las fuentes NO dan (para no crear supuestos silenciosos)
export const NOT_AVAILABLE = ['ppda', 'zonas de tiro', 'xG en vivo', 'sustituciones', 'toques en area', 'posesion territorial']

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// ─── Fuerza relativa desde el prior (lo único fiable que tenemos) ────────────
// Combina nivel (PPG) y capacidad de generar volumen (tiros esperados).
export function strengthGap(priorTeam, priorRival) {
  if (!priorTeam || !priorRival) return { gap: 0, disponible: false }
  const ppgT = priorTeam.ppg ?? 1.3
  const ppgR = priorRival.ppg ?? 1.3
  const volT = priorTeam.shots_avg ?? 12
  const volR = priorRival.shots_avg ?? 12
  // gap normalizado ~[-1, 1]: >0 el equipo es superior
  const gapPpg = clamp((ppgT - ppgR) / 1.2, -1, 1)
  const gapVol = clamp((volT - volR) / 8, -1, 1)
  return { gap: +(gapPpg * 0.65 + gapVol * 0.35).toFixed(3), disponible: true, ppgT, ppgR }
}

// ─── Respuesta observada vs el propio baseline del equipo ────────────────────
// ratio > 1 = está produciendo por encima de lo suyo · < 1 = por debajo.
// Se compara contra lo que ese equipo DEBERÍA llevar a esta altura del partido.
export function observedResponse(acum, minuto, priorTotalLado) {
  if (acum == null || !minuto || !priorTotalLado) return { ratio: null, disponible: false }
  const esperadoAhora = priorTotalLado * (minuto / 95)
  if (esperadoAhora <= 0.5) return { ratio: null, disponible: false } // muy temprano
  return {
    ratio: +(acum / esperadoAhora).toFixed(2),
    esperadoAhora: +esperadoAhora.toFixed(1),
    disponible: true,
  }
}

// ─── Ritmo multi-escala (corto / medio / partido) ────────────────────────────
// Evita que un pico de 5 minutos destruya el prior: se exige consistencia.
export function multiScalePace(snaps, key, acum, minuto) {
  const out = { corto: null, medio: null, partido: null, trend: 'sin datos', spike: false, disponible: false }
  if (!minuto || acum == null) return out
  out.partido = +(acum / minuto).toFixed(3)
  if (!snaps?.length) return out

  // El punto ACTUAL entra como último dato: si el snapshot más reciente es de
  // hace 10 minutos, medir la tendencia contra él daría un ritmo falso.
  const ultimo = snaps[snaps.length - 1]
  const serie = (ultimo?.min ?? 0) < minuto ? [...snaps, { min: minuto, [key]: acum }] : snaps
  const last = serie[serie.length - 1]
  const val = s => s[key]
  if (val(last) == null) return out
  snaps = serie

  const ventana = (min) => {
    let past = null
    for (const s of snaps) { if (val(s) != null && last.min - s.min >= min) past = s }
    if (!past) return null
    const span = last.min - past.min
    if (span < 3) return null
    return { rate: +((val(last) - val(past)) / span).toFixed(3), span }
  }
  const c = ventana(5)
  const m = ventana(15)
  out.corto = c?.rate ?? null
  out.medio = m?.rate ?? null
  out.disponible = out.corto != null || out.medio != null

  const base = out.partido || 0.001
  if (out.medio != null) {
    const r = out.medio / base
    out.trend = r >= 1.15 ? 'subiendo' : r <= 0.85 ? 'bajando' : 'estable'
  }
  // SPIKE: los últimos 5' se disparan muy por encima de los últimos 15' —
  // es un pico, no una tendencia (comparar corto vs medio, no vs el partido)
  if (out.corto != null && out.medio != null && out.corto > base * 1.6 && out.corto > out.medio * 2) {
    out.spike = true
    out.trend = 'pico puntual (no sostenido)'
  }
  return out
}

// ─── Dominio: ¿ritmo alto de partido o dominio unilateral? ───────────────────
export function dominance(eventosH, eventosA) {
  if (eventosH == null || eventosA == null) return { tipo: 'sin datos', disponible: false }
  const tot = eventosH + eventosA
  if (tot < 4) return { tipo: 'muestra corta', disponible: false }
  const share = eventosH / tot
  return {
    disponible: true,
    shareLocal: +share.toFixed(2),
    tipo: share >= 0.68 ? 'dominio local' : share <= 0.32 ? 'dominio visitante' : 'repartido',
  }
}

// ─── FACTOR DE ESTADO EXPERIMENTAL ───────────────────────────────────────────
// Parte del efecto base del marcador (getSituationS, ya en el motor) y lo
// MODULA por tres cosas que el baseline ignora. Todas las magnitudes son
// HEURÍSTICAS ACOTADAS y declaradas — su validación depende del backtest.
//
//   modTiempo    el marcador aprieta más cuando queda poco (pero muy temprano
//                el equipo aún no cambia su plan)
//   modFuerza    un favorito perdiendo tiene más capacidad de responder que un
//                colista perdiendo; y un favorito ganando administra más
//   modRespuesta si el equipo NO está respondiendo por encima de su baseline,
//                el efecto del marcador se atenúa fuerte (caso clave: "pierde
//                pero no reacciona"). Esta es la corrección más importante.
export const STATE_EXP = {
  T_TEMPRANO: 0.70,   // antes del 25' el efecto del marcador va al 70%
  T_TARDE: 1.25,      // desde el 75' va al 125%
  F_CLAMP: [0.65, 1.30],
  R_CLAMP: [0.30, 1.35],
  MOD_CLAMP: [0.25, 1.60],   // techo/piso conjunto (anti sobrerreacción, §50)
}

export function stateResponseExp({ scoreDiff, minuto, gap = 0, responseRatio = null }) {
  const sBase = getSituationS(scoreDiff)          // efecto base del marcador
  const efecto = sBase - 1                        // desviación respecto a neutro
  if (Math.abs(efecto) < 0.001) {
    return { factor: 1, sBase, modTiempo: 1, modFuerza: 1, modRespuesta: 1, contribuciones: [] }
  }

  // 1) Tiempo: urgencia creciente
  const modTiempo = minuto == null ? 1
    : minuto < 25 ? STATE_EXP.T_TEMPRANO
    : minuto >= 75 ? STATE_EXP.T_TARDE
    : 0.70 + (minuto - 25) * (1.25 - 0.70) / 50   // rampa lineal 25'→75'

  // 2) Fuerza: perder siendo superior empuja más; ganar siendo superior
  //    administra más. Si el equipo es inferior, ambos efectos se atenúan.
  const perdiendo = scoreDiff < 0
  const modFuerza = clamp(perdiendo ? 1 + gap * 0.35 : 1 + gap * 0.20, ...STATE_EXP.F_CLAMP)

  // 3) Respuesta observada (SOLO cuando va perdiendo: es donde importa
  //    distinguir "reacciona" de "no reacciona"). Exponente >1 para que la
  //    ausencia de respuesta pese de verdad: producir el 40% de lo suyo
  //    prácticamente ANULA el empujón del marcador.
  let modRespuesta = 1
  if (perdiendo && responseRatio != null) {
    modRespuesta = clamp(Math.pow(responseRatio, 1.3), ...STATE_EXP.R_CLAMP)
  }

  // Los tres modificadores se acotan EN CONJUNTO: sin este techo, tiempo y
  // fuerza podrían multiplicarse y disparar la proyección (el error inverso
  // que el propio usuario pidió evitar en §50).
  const mod = clamp(modTiempo * modFuerza * modRespuesta, 0.25, 1.60)
  const factor = 1 + efecto * mod
  const contribuciones = [
    { factor: 'Marcador', valor: +(sBase - 1).toFixed(3), nota: `diferencia ${scoreDiff > 0 ? '+' : ''}${scoreDiff}` },
    { factor: 'Tiempo restante', valor: +(modTiempo - 1).toFixed(3), nota: `minuto ${minuto}` },
    { factor: 'Fuerza relativa', valor: +(modFuerza - 1).toFixed(3), nota: gap > 0.15 ? 'superior al rival' : gap < -0.15 ? 'inferior al rival' : 'parejos' },
    { factor: 'Respuesta observada', valor: +(modRespuesta - 1).toFixed(3), nota: responseRatio == null ? 'sin dato' : responseRatio >= 1.15 ? `respondiendo (${responseRatio}× su baseline)` : responseRatio <= 0.85 ? `SIN respuesta (${responseRatio}× su baseline)` : `en su nivel (${responseRatio}×)` },
  ]
  return { factor: +factor.toFixed(3), sBase, modTiempo: +modTiempo.toFixed(2), modFuerza: +modFuerza.toFixed(2), modRespuesta: +modRespuesta.toFixed(2), contribuciones }
}

// ─── Chasing efectivo: ¿persigue de verdad o solo va perdiendo? ──────────────
export function effectiveChasing({ scoreDiff, minuto, responseRatio, pace }) {
  if (scoreDiff >= 0) return { chasing: false, nivel: 'no persigue', score: 0 }
  let s = 0
  if (responseRatio != null) s += clamp((responseRatio - 1) * 100, -45, 45)
  if (pace?.trend === 'subiendo') s += 20
  else if (pace?.trend === 'bajando') s -= 20
  if (pace?.spike) s -= 10                      // pico ≠ tendencia
  s += Math.abs(scoreDiff) >= 2 ? 5 : 10        // 0-2 desmoraliza más que 0-1
  if (minuto != null && minuto >= 70) s += 10   // urgencia final
  const score = Math.round(clamp(s + 50, 0, 100))
  return {
    chasing: true,
    score,
    nivel: score >= 65 ? 'ALTO' : score >= 40 ? 'MEDIO' : 'BAJO',
  }
}

// ─── Cierre del partido: no es solo "diferencia ≥ 2" ─────────────────────────
export function matchClosure({ scoreDiff, minuto, responseRatioPerdedor, pace }) {
  if (minuto == null) return { nivel: 'sin datos' }
  const ad = Math.abs(scoreDiff)
  if (ad === 0) return { nivel: 'abierto', nota: 'empate' }
  let s = 0
  s += ad >= 3 ? 45 : ad === 2 ? 30 : 12
  s += minuto >= 80 ? 35 : minuto >= 65 ? 20 : minuto >= 50 ? 8 : 0
  if (responseRatioPerdedor != null) s += responseRatioPerdedor <= 0.8 ? 15 : responseRatioPerdedor >= 1.2 ? -20 : 0
  if (pace?.trend === 'bajando') s += 10
  else if (pace?.trend === 'subiendo') s -= 10
  const score = Math.round(clamp(s, 0, 100))
  return { score, nivel: score >= 65 ? 'CERRADO' : score >= 40 ? 'encaminado' : 'abierto' }
}

// ─── VECTOR DE ESTADO COMPLETO ───────────────────────────────────────────────
export function buildGameState({
  minuto, golesH = 0, golesA = 0,
  priorH = null, priorA = null,
  shotsH = null, shotsA = null,
  priorShotsH = null, priorShotsA = null,
  snaps = [], redH = 0, redA = 0,
}) {
  const diffH = golesH - golesA
  const gapH = strengthGap(priorH, priorA)
  const gapA = strengthGap(priorA, priorH)
  const respH = observedResponse(shotsH, minuto, priorShotsH)
  const respA = observedResponse(shotsA, minuto, priorShotsA)
  const paceH = multiScalePace(snaps, 'sh', shotsH, minuto)
  const paceA = multiScalePace(snaps, 'sa', shotsA, minuto)
  const dom = dominance(shotsH, shotsA)
  const restante = minuto == null ? null : Math.max(0, (minuto > 90 ? 120 : 95) - minuto)

  const perdedorResp = diffH < 0 ? respH.ratio : diffH > 0 ? respA.ratio : null
  const paceComb = { trend: paceH.trend === paceA.trend ? paceH.trend : 'mixto', spike: paceH.spike || paceA.spike }

  return {
    status: GAME_STATE_STATUS,
    minuto, restante,
    marcador: `${golesH}-${golesA}`,
    diffH, diffA: -diffH,
    favorito: gapH.disponible ? (gapH.gap > 0.12 ? 'LOCAL' : gapH.gap < -0.12 ? 'VISITANTE' : 'parejos') : 'sin prior',
    strengthGapH: gapH.gap, strengthGapA: gapA.gap,
    respuestaH: respH, respuestaA: respA,
    paceH, paceA, dominio: dom,
    chasingH: effectiveChasing({ scoreDiff: diffH, minuto, responseRatio: respH.ratio, pace: paceH }),
    chasingA: effectiveChasing({ scoreDiff: -diffH, minuto, responseRatio: respA.ratio, pace: paceA }),
    cierre: matchClosure({ scoreDiff: diffH, minuto, responseRatioPerdedor: perdedorResp, pace: paceComb }),
    rojas: { h: redH, a: redA },
    // Factores experimentales por lado (para comparar con el baseline)
    stateExpH: stateResponseExp({ scoreDiff: diffH, minuto, gap: gapH.gap, responseRatio: respH.ratio }),
    stateExpA: stateResponseExp({ scoreDiff: -diffH, minuto, gap: gapA.gap, responseRatio: respA.ratio }),
    // Baseline actual, para ver la diferencia
    stateBaseH: getSituationS(diffH),
    stateBaseA: getSituationS(-diffH),
    noDisponible: NOT_AVAILABLE,
  }
}

// ─── Explicación en lenguaje natural DERIVADA de los factores reales ─────────
// No es un texto inventado: cada frase sale de una contribución calculada.
export function explicarEstado(gs, lado = 'H', nombreEquipo = 'El equipo', nombreRival = 'el rival') {
  if (!gs) return null
  const esH = lado === 'H'
  const diff = esH ? gs.diffH : gs.diffA
  const st = esH ? gs.stateExpH : gs.stateExpA
  const resp = esH ? gs.respuestaH : gs.respuestaA
  const chas = esH ? gs.chasingH : gs.chasingA
  const pace = esH ? gs.paceH : gs.paceA
  const gap = esH ? gs.strengthGapH : gs.strengthGapA

  const situacion = diff === 0
    ? `Empate ${gs.marcador} al ${gs.minuto}'.`
    : `${nombreEquipo} va ${diff > 0 ? 'ganando' : 'perdiendo'} ${gs.marcador} al ${gs.minuto}'.`
  const fuerza = gap > 0.12 ? `Era favorito prepartido sobre ${nombreRival}.`
    : gap < -0.12 ? `Prepartido era inferior a ${nombreRival}.`
    : 'Prepartido eran parejos.'

  const respuesta = !resp.disponible ? 'Aún no hay muestra para juzgar su respuesta ofensiva.'
    : resp.ratio >= 1.15 ? `Está produciendo ${resp.ratio}× lo que le correspondería a esta altura (${resp.esperadoAhora} esperados): SÍ está respondiendo.`
    : resp.ratio <= 0.85 ? `Solo produce ${resp.ratio}× lo que le correspondería (${resp.esperadoAhora} esperados): NO está respondiendo.`
    : `Produce en su nivel normal (${resp.ratio}×).`

  const ritmo = pace.disponible
    ? `Ritmo reciente ${pace.trend}${pace.spike ? ' (ojo: pico corto, no sostenido)' : ''}.`
    : 'Sin ventanas suficientes para medir tendencia.'

  // El veredicto sale del factor calculado, no de una opinión
  const pct = Math.round((st.factor - 1) * 100)
  const proyeccion = Math.abs(pct) < 2
    ? 'El modelo experimental deja la expectativa prácticamente igual.'
    : `El modelo experimental ${pct > 0 ? 'sube' : 'baja'} la expectativa de eventos restantes un ${Math.abs(pct)}%.`

  // Riesgo: el factor que más juega en contra de la dirección del ajuste
  const contras = st.contribuciones.filter(c => (pct > 0 ? c.valor < 0 : c.valor > 0))
  const riesgo = contras.length
    ? `Principal riesgo: ${contras.map(c => `${c.factor.toLowerCase()} (${c.nota})`).join(' · ')}.`
    : diff < 0 && chas.nivel === 'BAJO'
      ? 'Principal riesgo: va perdiendo pero su persecución es débil — el marcador solo no sostiene la proyección.'
      : 'Sin factores relevantes en contra dentro de las variables usadas.'

  return {
    situacion, fuerza, respuesta, ritmo,
    tiempo: `Quedan ~${gs.restante} minutos efectivos.`,
    dominio: gs.dominio.disponible ? `Reparto de tiros: ${Math.round(gs.dominio.shareLocal * 100)}% local (${gs.dominio.tipo}).` : 'Sin datos de dominio.',
    chasing: diff < 0 ? `Persecución efectiva: ${chas.nivel} (${chas.score}/100).` : null,
    cierre: `Cierre del partido: ${gs.cierre.nivel}.`,
    proyeccion, riesgo,
    contribuciones: st.contribuciones,
    baselineVsExperimental: `Baseline actual aplicaría ×${(esH ? gs.stateBaseH : gs.stateBaseA).toFixed(2)}; el experimental ×${st.factor.toFixed(2)}.`,
  }
}
