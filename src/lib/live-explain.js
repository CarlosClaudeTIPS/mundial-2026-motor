// ─── EXPLICACIÓN ESTRUCTURADA DEL PICK LIVE (§37-§44, §60) ────────────────────
//
// Regla dura: NADA aquí se inventa. Cada frase sale de una variable que el
// modelo realmente usó (vector de estado + contribuciones + proyecciones).
// Si un dato no existe en las fuentes, se dice "sin dato", no se rellena.
//
// Devuelve un objeto con secciones fijas: SITUACIÓN · RESPUESTA OBSERVADA ·
// RITMO · TIEMPO · OPONENTE · PROYECCIÓN · RIESGO · DECISIÓN, listo para
// pintarse tal cual. También "qué cambió" contra el snapshot anterior.

import { explicarEstado } from './game-state'

const pct = (a, b) => (a == null || !b) ? null : Math.round((a - b) / b * 100)

// gs: buildGameState() · model: shotsLiveModel/cornersLiveModel · lado: 'H'|'A'|'T'
// edge: resultado de evaluarMercado (puede ser null) · nombres: {h, a}
export function explicacionLive({ gs, model, lado = 'T', mercado = 'tiros', nombres = {}, edge = null, baseline = null }) {
  if (!gs || !model) return null
  const tn = { h: nombres.h ?? 'Local', a: nombres.a ?? 'Visitante' }
  // Foco: el equipo del mercado; para el total, el que persigue (o el que domina)
  const foco = lado === 'H' ? 'H' : lado === 'A' ? 'A'
    : gs.diffH < 0 ? 'H' : gs.diffH > 0 ? 'A' : (gs.dominio?.shareLocal >= 0.5 ? 'H' : 'A')
  const nomFoco = foco === 'H' ? tn.h : tn.a
  const nomRival = foco === 'H' ? tn.a : tn.h
  const ex = explicarEstado(gs, foco, nomFoco, nomRival)
  const st = foco === 'H' ? gs.stateExpH : gs.stateExpA
  const base = foco === 'H' ? gs.stateBaseH : gs.stateBaseA
  const resp = foco === 'H' ? gs.respuestaH : gs.respuestaA
  const pace = foco === 'H' ? gs.paceH : gs.paceA
  const rivalResp = foco === 'H' ? gs.respuestaA : gs.respuestaH

  const side = lado === 'H' ? model.home : lado === 'A' ? model.away : null
  const proyBase = side ? side.expectedFinal : model.expectedFinal
  const proyExp = side ? side.expectedFinalExp : model.expectedFinalExp
  const dif = pct(proyExp, proyBase)

  const situacion = `${ex.situacion} ${ex.fuerza}`
  const respuesta = ex.respuesta
  const ritmo = pace?.disponible
    ? `Ritmo de ${nomFoco}: ${pace.trend}${pace.corto != null ? ` (últimos 5': ${pace.corto}/min · partido: ${pace.partido}/min)` : ''}${pace.spike ? ' — pico corto, no sostenido' : ''}.`
    : 'Ritmo reciente: sin ventanas suficientes para medirlo.'
  const tiempo = `Quedan ~${gs.restante} minutos efectivos.`
  const oponente = rivalResp?.disponible
    ? `${nomRival} produce ${rivalResp.ratio}× lo que le correspondería a esta altura${gs.dominio?.disponible ? ` · reparto de tiros ${Math.round(gs.dominio.shareLocal * 100)}% local (${gs.dominio.tipo})` : ''}.`
    : 'Oponente: sin muestra suficiente para juzgar su producción.'

  const proyeccion = proyExp == null
    ? `Proyección baseline de ${mercado}: ${proyBase}. (Sin prior de fuerza: el experimental no aplica.)`
    : `Baseline proyecta ${proyBase} ${mercado}; el experimental (estado del partido) proyecta ${proyExp} (${dif > 0 ? '+' : ''}${dif}%). Ajuste por estado: baseline ×${base.toFixed(2)} → experimental ×${st.factor.toFixed(2)}.`

  const contras = st.contribuciones.filter(c => (st.factor >= base ? c.valor < -0.01 : c.valor > 0.01))
  const riesgo = contras.length
    ? `Lo que más juega en contra: ${contras.map(c => `${c.factor.toLowerCase()} (${c.nota})`).join(' · ')}.`
    : (gs.diffH !== 0 && resp?.disponible && resp.ratio <= 0.85)
      ? `${nomFoco} va perdiendo pero NO está respondiendo (${resp.ratio}× su baseline): el marcador solo no sostiene una subida.`
      : 'Sin factores relevantes en contra dentro de las variables usadas.'

  const decision = edge
    ? `${edge.signal}${edge.lado ? ` ${edge.lado} ${edge.line}` : ''} — decidido por el BASELINE (el experimental no decide todavía).`
    : 'Sin línea de la casa ingresada — no hay decisión que explicar.'

  return {
    foco: nomFoco,
    situacion, respuesta, ritmo, tiempo, oponente, proyeccion, riesgo, decision,
    contribuciones: st.contribuciones,          // factor · valor · nota (reales)
    factorBase: base, factorExp: st.factor,
    proyBase, proyExp, difPct: dif,
    chasing: foco === 'H' ? gs.chasingH : gs.chasingA,
    cierre: gs.cierre,
    baselinePrematch: baseline ?? null,
  }
}

// ─── QUÉ CAMBIÓ desde la última evaluación (§43) ─────────────────────────────
// prev: último snapshot del live-log {min, acum, proj, projExp, pCentral,
// pCentralExp, lineCentral} · now: {min, acum, proj, projExp, pCentral, gs}
export function queCambio(prev, now, prevGs = null) {
  if (!prev || !now || prev.min == null || now.min == null || now.min <= prev.min) return null
  const items = []
  const add = (label, a, b, fmt = v => v) => {
    if (a == null || b == null || a === b) return
    items.push({ label, antes: fmt(a), ahora: fmt(b) })
  }
  add('Minuto', prev.min, now.min, v => `${v}'`)
  add('Acumulado', prev.acum, now.acum)
  add('Proyección baseline', prev.proj, now.proj)
  add('Proyección experimental', prev.projExp, now.projExp)
  if (prev.lineCentral != null && prev.lineCentral === now.lineCentral) {
    add(`P(Over ${prev.lineCentral}) baseline`, prev.pCentral, now.pCentral, v => `${Math.round(v * 100)}%`)
    add(`P(Over ${prev.lineCentral}) experimental`, prev.pCentralExp, now.pCentralExp, v => `${Math.round(v * 100)}%`)
  }
  if (prevGs && now.gs) {
    add('Marcador', prevGs.marcador, now.gs.marcador)
    add('Respuesta local', prevGs.respuestaH?.ratio, now.gs.respuestaH?.ratio, v => `${v}×`)
    add('Respuesta visitante', prevGs.respuestaA?.ratio, now.gs.respuestaA?.ratio, v => `${v}×`)
    add('Tendencia local', prevGs.paceH?.trend, now.gs.paceH?.trend)
    add('Tendencia visitante', prevGs.paceA?.trend, now.gs.paceA?.trend)
    add('Cierre', prevGs.cierre?.nivel, now.gs.cierre?.nivel)
  }
  // Factor que más contribuyó al cambio experimental (si hay contribuciones)
  let principal = null
  if (now.gs) {
    const st = now.gs.diffH < 0 ? now.gs.stateExpH : now.gs.diffH > 0 ? now.gs.stateExpA : null
    if (st?.contribuciones?.length) {
      principal = [...st.contribuciones].sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor))[0]
    }
  }
  return items.length ? { items, principal } : null
}
