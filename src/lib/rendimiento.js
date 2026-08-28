// ─── MÓDULO DE RENDIMIENTO / HISTÓRICO / AUDITORÍA ───────────────────────────
//
// Análisis y aprendizaje sobre los registros congelados. Este módulo NO tiene
// permisos para modificar NINGÚN parámetro del modelo (PHI, K, tempo, clamps,
// roja, umbrales...). Solo: leer → comparar → clasificar → generar informes e
// hipótesis. resultado → diagnóstico → hipótesis → revisión humana.
//
// Principios duros:
//  - WIN ≠ evidencia de buen forecast · LOSS ≠ evidencia de mal forecast.
//  - Observación ≠ interpretación: describir ("tras el 2-0 al 68' la tasa
//    bajó"), no inventar causalidad ("dejó de atacar porque ganaba").
//  - Muestras chicas → INSUFFICIENT SAMPLE, nunca porcentajes como evidencia.

import { tiLogAll } from './throwins'
import { gkLogAll } from './goalkicks'
import { cornersLogAll } from './corners'
import { shotsLogAll, sotLogAll } from './shots'
import { cardsLogAll } from './cards'
import { listDecisiones, listCombos } from './market-engine'

export const MERCADOS_HIST = [
  { base: 'corners', label: 'Córners', all: cornersLogAll, marketKeys: ['corners_total', 'corners_local', 'corners_visitante'] },
  { base: 'shots', label: 'Tiros', all: shotsLogAll, marketKeys: ['shots_total', 'shots_local', 'shots_visitante'] },
  { base: 'sot', label: 'SOT', all: sotLogAll, marketKeys: ['sot_total', 'sot_local', 'sot_visitante'] },
  { base: 'cards', label: 'Tarjetas', all: cardsLogAll, marketKeys: ['cards_total', 'cards_local', 'cards_visitante'] },
  { base: 'ti', label: 'S. Banda', all: tiLogAll, marketKeys: ['ti'] },
  { base: 'gk', label: 'S. Portería', all: gkLogAll, marketKeys: ['gk'] },
]

const fechaDe = ts => ts ? new Date(ts).toLocaleDateString('sv-SE') : null // YYYY-MM-DD local

export function baseDeMarket(marketKey) {
  return MERCADOS_HIST.find(m => m.marketKeys.includes(marketKey))?.base ?? null
}

// ─── Fechas con registros ────────────────────────────────────────────────────
export function fechasConDatos() {
  const set = new Set()
  for (const d of listDecisiones()) { const f = fechaDe(d.ts); if (f) set.add(f) }
  for (const c of listCombos()) { const f = fechaDe(c.ts); if (f) set.add(f) }
  for (const m of MERCADOS_HIST) for (const e of m.all()) { const f = fechaDe(e.ts); if (f) set.add(f) }
  return [...set].sort()
}

// ─── Evaluar un pick contra el final real ────────────────────────────────────
// Devuelve null si no se puede resolver (sin final, sin lado, mercado por
// equipo sin finales por lado, etc.) — nunca adivinar.
export function evaluarPick(pick, matchLog) {
  if (!matchLog || matchLog.final == null || pick.line == null) return null
  let final = matchLog.final
  if (pick.market?.endsWith('_local')) {
    if (matchLog.finalH == null) return null
    final = matchLog.finalH
  } else if (pick.market?.endsWith('_visitante')) {
    if (matchLog.finalA == null) return null
    final = matchLog.finalA
  }
  // Sin lado (evaluación NO BET sin dirección): comparar contra el OVER
  const lado = pick.lado ?? 'OVER'
  const hit = lado === 'OVER' ? final > pick.line : final < pick.line
  const pnl = (pick.signal === 'PAPER BET' && pick.odds) ? (hit ? pick.odds - 1 : -1) : null
  return { final, hit, pnl }
}

// ─── CLASIFICACIÓN forecast × outcome (§14-16) ───────────────────────────────
// GOOD FORECAST = el resultado cayó dentro del intervalo 10-90 que el modelo
// tenía EN el minuto del pick (no si ganó). Sin snapshot comparable → null.
export function clasificarPick(pick, matchLog, evalR) {
  if (!evalR || !matchLog?.snaps?.length) return null
  // snapshot más cercano al minuto del pick (o el del medio si no hay minuto)
  const objetivo = pick.minuto ?? 45
  let snap = matchLog.snaps[0]
  for (const s of matchLog.snaps) if (Math.abs(s.min - objetivo) < Math.abs(snap.min - objetivo)) snap = s
  if (snap.i10 == null || snap.i90 == null) return null
  // Para mercados por equipo no hay intervalo por lado → no clasificar
  if (pick.market?.endsWith('_local') || pick.market?.endsWith('_visitante')) return null
  const goodForecast = matchLog.final >= snap.i10 && matchLog.final <= snap.i90
  return {
    etiqueta: `${goodForecast ? 'GOOD' : 'BAD'} FORECAST — ${evalR.hit ? 'GOOD' : 'BAD'} OUTCOME`,
    goodForecast, snapMin: snap.min,
    nota: goodForecast && !evalR.hit
      ? 'Resultado dentro de la distribución del modelo: mala suerte plausible, no evidencia de error estructural'
      : !goodForecast && evalR.hit
        ? 'GANÓ pero el resultado quedó FUERA del intervalo del modelo: win ≠ buen forecast'
        : goodForecast
          ? 'Resultado dentro de la distribución — consistente con el modelo'
          : 'Resultado fuera del intervalo 10-90 — revisar en la descomposición del error',
  }
}

// ─── TURNING POINT (§18): primer snapshot cuyo intervalo ya no contuvo el final
export function turningPoint(matchLog) {
  if (!matchLog?.snaps?.length || matchLog.final == null) return null
  for (const s of matchLog.snaps) {
    if (s.i10 == null || s.i90 == null) continue
    if (matchLog.final < s.i10 || s.i90 < matchLog.final) {
      const restNecesario = matchLog.final - s.acum
      const restProyectado = +(s.proj - s.acum).toFixed(1)
      return {
        min: s.min,
        proj: s.proj,
        detalle: `Al ${s.min}' el modelo proyectaba ${s.proj} (intervalo ${s.i10}–${s.i90}); el final real ${matchLog.final} ya estaba fuera. Restante proyectado ${restProyectado} vs restante real ${restNecesario}.`,
      }
    }
  }
  return null // 'No identificado' — el final siempre estuvo dentro del intervalo
}

// ─── DESCOMPOSICIÓN DEL ERROR (§11) — conservadora, sin inventar causalidad ──
export function descomponerError(matchLog) {
  if (!matchLog?.snaps?.length || matchLog.final == null) return { cat: 'I', texto: 'INDETERMINADO — sin datos suficientes' }
  const final = matchLog.final
  const mid = matchLog.snaps.filter(s => s.min >= 25 && s.min <= 60)
  const ref = mid.length ? mid[Math.floor(mid.length / 2)] : matchLog.snaps[Math.floor(matchLog.snaps.length / 2)]
  const extras = []
  if (matchLog.hayRoja) extras.push(`D. CAMBIO DE ESTADO: roja al ${matchLog.rojaMin ?? '?'}'${matchLog.rojaDiff != null ? ` con marcador ${matchLog.rojaDiff > 0 ? '+' : ''}${matchLog.rojaDiff}` : ''} — régimen distinto al esperado`)

  if (ref?.i10 != null && final >= ref.i10 && final <= ref.i90) {
    return { cat: 'A', texto: `A. VARIACIÓN ALEATORIA — el final (${final}) cayó dentro del intervalo que el modelo tenía al ${ref.min}' (${ref.i10}–${ref.i90})`, extras }
  }
  const err = ref ? ref.proj - final : null
  if (err != null && Math.abs(err) > 0) {
    // ¿reaccionó tarde? — snapshots tardíos (≥70') aún lejos del final
    const tardios = matchLog.snaps.filter(s => s.min >= 70)
    const tardioErr = tardios.length ? Math.abs(tardios[tardios.length - 1].proj - final) : null
    const cat = err > 0 ? 'B' : 'C'
    const base = err > 0
      ? `B. RITMO SOBREESTIMADO — al ${ref.min}' proyectaba ${ref.proj} y el final fue ${final} (${err > 0 ? '+' : ''}${err.toFixed(1)})`
      : `C. RITMO SUBESTIMADO — al ${ref.min}' proyectaba ${ref.proj} y el final fue ${final} (${err.toFixed(1)})`
    if (tardioErr != null && tardioErr > Math.abs(err) * 0.6 && Math.abs(err) >= 3) {
      extras.push(`E. POSIBLE REACCIÓN TARDÍA — al ${tardios[tardios.length - 1].min}' la proyección seguía a ${tardioErr.toFixed(1)} del final (descriptivo, no concluyente)`)
    }
    return { cat, texto: base, extras }
  }
  return { cat: 'I', texto: 'INDETERMINADO — no hay evidencia suficiente para atribuir causa', extras }
}

// ─── PICKS DE UNA FECHA (audit log + resolución vía live-logs) ───────────────
export function picksDelDia(fecha) {
  const logsPorBase = {}
  for (const m of MERCADOS_HIST) logsPorBase[m.base] = Object.fromEntries(m.all().map(e => [String(e.id), e]))

  const picks = listDecisiones()
    .filter(d => fechaDe(d.ts) === fecha)
    .map(d => {
      const base = baseDeMarket(d.market)
      const matchLog = base ? logsPorBase[base][String(d.matchId)] : null
      const evalR = evaluarPick(d, matchLog)
      return { ...d, base, matchLog, evalR, clasif: evalR ? clasificarPick(d, matchLog, evalR) : null }
    })

  const combos = listCombos().filter(c => fechaDe(c.ts) === fecha)
  return { picks, combos }
}

// ─── RESUMEN DEL DÍA (§3) ────────────────────────────────────────────────────
export function resumenDia(fecha) {
  const { picks, combos } = picksDelDia(fecha)
  const partidos = new Set(picks.map(p => String(p.matchId))).size
  const paper = picks.filter(p => p.signal === 'PAPER BET')
  const nobet = picks.filter(p => p.signal === 'NO BET')
  const resueltos = picks.filter(p => p.evalR)
  const paperRes = resueltos.filter(p => p.signal === 'PAPER BET' && p.evalR.pnl != null)
  const aciertos = paperRes.filter(p => p.evalR.hit).length
  const pnl = paperRes.reduce((s, p) => s + p.evalR.pnl, 0)
  const avg = (arr, f) => arr.length ? +(arr.reduce((s, x) => s + f(x), 0) / arr.length).toFixed(2) : null

  const porMercado = MERCADOS_HIST.map(m => {
    const del = picks.filter(p => p.base === m.base)
    const res = del.filter(p => p.signal === 'PAPER BET' && p.evalR?.pnl != null)
    return {
      base: m.base, label: m.label,
      n: del.length, paper: del.filter(p => p.signal === 'PAPER BET').length,
      resueltos: res.length,
      aciertos: res.filter(p => p.evalR.hit).length,
      pnl: res.length ? +res.reduce((s, p) => s + p.evalR.pnl, 0).toFixed(2) : null,
      insuficiente: res.length > 0 && res.length < 10,
    }
  }).filter(m => m.n > 0)

  return {
    fecha, partidos,
    evaluaciones: picks.length,
    paper: paper.length, nobet: nobet.length,
    resueltos: paperRes.length, aciertos, fallos: paperRes.length - aciertos,
    hitRate: paperRes.length ? Math.round(aciertos / paperRes.length * 100) : null,
    pnl: +pnl.toFixed(2),
    roi: paperRes.length ? +((pnl / paperRes.length) * 100).toFixed(1) : null,
    cuotaProm: avg(paper, p => p.odds ?? 0),
    edgeProm: avg(paper, p => p.edge ?? 0),
    insuficiente: paperRes.length > 0 && paperRes.length < 10,
    porMercado, combos: combos.length,
  }
}

// ─── LECCIONES DEL DÍA (§30) — descriptivas, jamás ajustes ───────────────────
export function leccionesDia(fecha) {
  const r = resumenDia(fecha)
  const { picks } = picksDelDia(fecha)
  const funciono = []; const fallo = []; const investigar = []; const noConcluir = []

  for (const m of r.porMercado) {
    if (m.resueltos >= 2 && m.aciertos === m.resueltos) funciono.push(`${m.label}: ${m.aciertos}/${m.resueltos} aciertos`)
    if (m.resueltos >= 2 && m.aciertos === 0) fallo.push(`${m.label}: 0/${m.resueltos}`)
    if (m.insuficiente) noConcluir.push(`${m.label}: n=${m.resueltos} — INSUFFICIENT SAMPLE, ningún porcentaje de hoy es evidencia`)
  }
  const conRoja = picks.filter(p => p.matchLog?.hayRoja)
  if (conRoja.length) investigar.push(`${new Set(conRoja.map(p => p.matchId)).size} partido(s) con roja — revisar el error post-roja en el detalle`)
  const badForecasts = picks.filter(p => p.clasif && !p.clasif.goodForecast)
  if (badForecasts.length >= 2) investigar.push(`${badForecasts.length} picks con el final FUERA del intervalo del modelo — mirar la descomposición de cada uno`)
  noConcluir.push('Ningún resultado de UN día modifica parámetros: hipótesis sí, ajustes no (arquitectura congelada).')

  return { funciono, fallo, investigar, noConcluir }
}
