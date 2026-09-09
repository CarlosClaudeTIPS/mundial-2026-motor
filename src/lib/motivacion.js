// ─── MOTIVACIÓN AUTOMÁTICA DESDE LA TABLA (2026-09-09) ───────────────────────
//
// Pedido de Carlos: "con la misma tabla tú analizas: el que va 16º a 2 puntos
// del 18º necesita jugarse todo". Este módulo lee la clasificación (ya cargada
// en Analizar) y el tipo de competición, y deduce POR EQUIPO:
//   · zona (título / europa / media tabla / riesgo / descenso)
//   · distancia en puntos a lo que le importa
//   · fase de la temporada (por partidos jugados, no por fecha)
//   · motivación en la escala que ya usa context.js (necesita_ganar, …)
//   · urgencia 0..1 para el estado LIVE experimental
//
// Todo son HEURÍSTICAS DECLARADAS y acotadas; el usuario puede sobrescribir la
// motivación en el panel de contexto. Peso final lo dan los mods existentes.

const norm = s => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')

export function filaDe(tabla, team) {
  if (!tabla?.length || !team) return null
  return tabla.find(t => t.id === team.id || t.id === team.apiId)
    ?? tabla.find(t => norm(t.name) === norm(team.name))
    ?? tabla.find(t => norm(t.name).includes(norm(team.name)) || norm(team.name).includes(norm(t.name)))
    ?? null
}

// Cuántos bajan / cuántos van a Europa según el tamaño de la liga (defaults
// razonables; ligas raras se pueden ajustar aquí sin tocar el motor)
function zonasDe(n) {
  return {
    desc: n >= 20 ? 3 : n >= 16 ? 2 : 1,        // puestos de descenso
    europa: n >= 18 ? 4 : n >= 12 ? 3 : 2,      // puestos "de arriba"
  }
}

export function situacionTabla(tabla, team, { type = 'league' } = {}) {
  const fila = filaDe(tabla, team)
  if (!fila || !tabla?.length) return { disponible: false, motivacion: null, urgencia: 0.5, nota: 'sin tabla' }

  const n = tabla.length
  const pj = fila.pj ?? 0
  const totales = 2 * (n - 1)                           // liga a doble vuelta
  const restantes = Math.max(0, totales - pj)
  const fraccion = totales ? pj / totales : 0
  const fase = type === 'cup' ? 'ko' : fraccion < 0.2 ? 'inicio' : fraccion > 0.8 ? 'final' : 'mitad'
  const { desc, europa } = zonasDe(n)
  const ordenada = [...tabla].sort((a, b) => a.rank - b.rank)
  const pts = fila.pts ?? 0
  const ptsEn = pos => ordenada[pos - 1]?.pts ?? null  // pos 1-based

  const pos = fila.rank
  const primeroDesc = n - desc + 1                      // primer puesto que baja
  const ultimoSalvado = primeroDesc - 1
  const enDescenso = pos >= primeroDesc
  const ptsAlLider = (ptsEn(1) ?? pts) - pts
  const ptsAEuropa = pos <= europa ? 0 : (ptsEn(europa) ?? pts) - pts
  // Si está en descenso: cuánto le falta para salvarse. Si no: colchón sobre el descenso.
  const ptsSalvacion = enDescenso ? (ptsEn(ultimoSalvado) ?? pts) - pts : null
  const colchon = enDescenso ? null : pts - (ptsEn(primeroDesc) ?? pts)

  // ── Zona ──
  let zona, motivacion, urgencia, nota
  if (type === 'cup') {
    zona = 'copa'; motivacion = 'cualquier_result'; urgencia = 0.6
    nota = 'Copa: eliminación directa (el check de partido decisivo ya aplica)'
  } else if (fase === 'inicio') {
    zona = 'inicio'; motivacion = 'cualquier_result'; urgencia = 0.4
    nota = `Inicio de temporada (${pj} de ${totales} jugados): la tabla aún no dice mucho`
  } else if (enDescenso) {
    zona = 'descenso'
    motivacion = 'necesita_ganar'
    urgencia = fase === 'final' ? 1 : 0.85
    nota = `${pos}º de ${n}, EN DESCENSO, a ${ptsSalvacion} pts de salvarse con ${restantes} partidos por jugar`
  } else if (colchon <= 3) {
    zona = 'riesgo'
    motivacion = fase === 'final' ? 'necesita_ganar' : 'ganar_o_empatar'
    urgencia = fase === 'final' ? 0.9 : 0.7
    nota = `${pos}º de ${n}, a solo ${colchon} pts del descenso (${restantes} partidos por jugar)`
  } else if (pos === 1 || ptsAlLider <= 3) {
    zona = 'titulo'
    motivacion = fase === 'final' ? 'necesita_ganar' : 'ganar_o_empatar'
    urgencia = fase === 'final' ? 0.9 : 0.65
    nota = pos === 1 ? `Líder (${n > 1 ? `+${(pts - (ptsEn(2) ?? pts))} sobre el 2º` : ''})` : `${pos}º, a ${ptsAlLider} pts del líder`
  } else if (ptsAEuropa <= 3) {
    zona = 'europa'
    motivacion = 'ganar_o_empatar'
    urgencia = fase === 'final' ? 0.75 : 0.6
    nota = `${pos}º, a ${ptsAEuropa} pts de los puestos de arriba (top ${europa})`
  } else if (fase === 'final' && colchon >= 8 && ptsAEuropa >= 8) {
    zona = 'nada'
    motivacion = 'ya_clasificado'
    urgencia = 0.25
    nota = `${pos}º, recta final sin nada en juego (${colchon} pts sobre el descenso, ${ptsAEuropa} de Europa)`
  } else {
    zona = 'media'
    motivacion = 'cualquier_result'
    urgencia = 0.5
    nota = `${pos}º de ${n}, media tabla (${colchon} pts sobre el descenso, ${ptsAEuropa} de Europa)`
  }

  return {
    disponible: true,
    pos, n, pj, totales, restantes, fase,
    pts, ptsAlLider, ptsAEuropa, ptsSalvacion, colchon, enDescenso,
    zona, motivacion, urgencia: +urgencia.toFixed(2), nota,
  }
}

// Fase de temporada para el ctx (mismos valores que JORNADA_OPTIONS)
export function jornadaDe(sitA, sitB, type) {
  if (type === 'cup') return 'ko'
  const f = sitA?.fase ?? sitB?.fase
  return f === 'inicio' ? 'inicio' : f === 'final' ? 'final' : 'mitad'
}
