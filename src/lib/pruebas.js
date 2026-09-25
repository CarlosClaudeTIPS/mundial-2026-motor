import { db, uuid, ahora, encolar } from './db'
import { elegirPreguntas, obtenerPregunta } from './banco'
import { estructuraExamen } from './ciclo'
import { registrarIntento, preguntasVistas } from './datos'
import { resumen } from './analitica'

// ─── Mini-pruebas y simulacros ───────────────────────────────────────────────
// Una "sesión de prueba" agrupa varias preguntas que se responden seguidas,
// sin retroalimentación hasta el final. El simulacro reproduce la estructura
// del examen (bloques por prueba, tiempo) a la escala que permita el banco.

export async function crearMiniPrueba({ estudiante, cantidad = 10, tiempo_min = null, filtros = {}, asignacion_id = null, titulo = null, ids = null }) {
  let preguntas
  if (ids?.length) preguntas = (await Promise.all(ids.map(obtenerPregunta))).filter(Boolean)
  else preguntas = await elegirPreguntas({ n: cantidad, vistas: await preguntasVistas(estudiante.id), ...filtros })
  if (!preguntas.length) throw new Error('No hay preguntas disponibles con esos filtros')
  const s = {
    id: uuid(), estudiante_id: estudiante.id, tipo: 'mini', titulo: titulo ?? 'Mini-prueba',
    config: { cantidad: preguntas.length, tiempo_seg: tiempo_min ? tiempo_min * 60 : null, filtros },
    pregunta_ids: preguntas.map(p => p.id), respuestas: {}, tiempos: {}, indice: 0,
    estado: 'en_curso', fecha_inicio: ahora(), fecha_fin: null, asignacion_id, sincronizado: 0,
  }
  await db.sesiones.add(s)
  return s
}

// sesion_examen: 1 | 2. escala: 1 = tamaño real; 0.25 = un cuarto (misma proporción y mismo tiempo por pregunta).
export async function crearSimulacro({ estudiante, sesion_examen = 1, escala = 0.25, asignacion_id = null, titulo = null }) {
  const est = await estructuraExamen()
  const ses = est.sesiones.find(s => s.numero === Number(sesion_examen)) ?? est.sesiones[0]
  const vistas = await preguntasVistas(estudiante.id)
  const bloques = []
  let faltantes = []
  for (const b of ses.bloques) {
    const objetivo = Math.max(1, Math.round(b.preguntas * escala))
    const elegidas = await elegirPreguntas({ n: objetivo, vistas, prueba: b.prueba })
    if (elegidas.length < objetivo) faltantes.push({ prueba: b.prueba, objetivo, disponibles: elegidas.length })
    bloques.push({ prueba: b.prueba, ids: elegidas.map(p => p.id) })
  }
  const totalReal = ses.bloques.reduce((a, b) => a + b.preguntas, 0)
  const total = bloques.reduce((a, b) => a + b.ids.length, 0)
  if (!total) throw new Error('El banco no tiene preguntas para este simulacro')
  const segPorPregunta = (est.duracion_sesion_min * 60) / totalReal
  const s = {
    id: uuid(), estudiante_id: estudiante.id, tipo: 'simulacro', titulo: titulo ?? `Simulacro · ${ses.nombre}`,
    config: { sesion_examen: ses.numero, escala, cantidad: total, tiempo_seg: Math.round(segPorPregunta * total), bloques, faltantes, tiempo_real_min: est.duracion_sesion_min },
    pregunta_ids: bloques.flatMap(b => b.ids), respuestas: {}, tiempos: {}, indice: 0,
    estado: 'en_curso', fecha_inicio: ahora(), fecha_fin: null, asignacion_id, sincronizado: 0,
  }
  await db.sesiones.add(s)
  return s
}

export const obtenerSesion = (id) => db.sesiones.get(id)
export const sesionesDe = (estudiante_id) => db.sesiones.where('estudiante_id').equals(estudiante_id).reverse().sortBy('fecha_inicio')

export async function responderEnSesion(id, pregunta_id, clave, segundosEnPregunta = 0) {
  const s = await db.sesiones.get(id)
  if (!s || s.estado !== 'en_curso') return s
  const respuestas = { ...s.respuestas }
  if (clave == null) delete respuestas[pregunta_id]; else respuestas[pregunta_id] = clave
  const tiempos = { ...s.tiempos, [pregunta_id]: (s.tiempos[pregunta_id] ?? 0) + segundosEnPregunta }
  const nuevo = { ...s, respuestas, tiempos }
  await db.sesiones.put(nuevo)
  return nuevo
}

export async function acumularTiempo(id, pregunta_id, segundos) {
  const s = await db.sesiones.get(id)
  if (!s || s.estado !== 'en_curso' || !segundos) return s
  const nuevo = { ...s, tiempos: { ...s.tiempos, [pregunta_id]: (s.tiempos[pregunta_id] ?? 0) + segundos } }
  await db.sesiones.put(nuevo)
  return nuevo
}

export async function guardarIndice(id, indice) {
  const s = await db.sesiones.get(id)
  if (!s) return
  await db.sesiones.put({ ...s, indice })
}

// Cierra la sesión: crea un intento por pregunta (respondida o no) y calcula el resultado.
export async function terminarSesion(id, { agotado = false } = {}) {
  const s = await db.sesiones.get(id)
  if (!s || s.estado === 'terminada') return s
  const intentos = []
  for (const pid of s.pregunta_ids) {
    const pregunta = await obtenerPregunta(pid)
    if (!pregunta) continue
    const { intento } = await registrarIntento({
      estudiante_id: s.estudiante_id, pregunta, clave: s.respuestas[pid] ?? null,
      tiempo_seg: Math.round(s.tiempos[pid] ?? 0), modo: s.tipo, sesion_id: s.id,
    })
    intentos.push(intento)
  }
  const preguntas = Object.fromEntries((await Promise.all(s.pregunta_ids.map(obtenerPregunta))).filter(Boolean).map(p => [p.id, p]))
  const resultado = resumen(intentos, preguntas)
  const fin = ahora()
  const nuevo = { ...s, estado: 'terminada', fecha_fin: fin, agotado, resultado, duracion_seg: Math.round((new Date(fin) - new Date(s.fecha_inicio)) / 1000), sincronizado: 0 }
  await db.sesiones.put(nuevo)
  await encolar('sesiones', nuevo)
  return nuevo
}
