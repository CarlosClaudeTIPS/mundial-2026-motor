import { resumen } from './analitica'
import { taxonomia, nombreCompetencia, nombrePrueba } from './taxonomia'

// ─── Perfil de diagnóstico ───────────────────────────────────────────────────
// Convierte intentos (la prueba diagnóstica y todo lo respondido después) en un
// perfil legible: nivel por competencia y por prueba, y las 3 prioridades por
// las que conviene empezar. Es la base de Refuerzo y de "Mi ruta para mejorar".
//
// Niveles (mismos umbrales que Refuerzo): floja < 60 %, proceso < 75 %, fuerte ≥ 75 %,
// sin_datos con menos de 2 respuestas.

export const NIVELES_COMPETENCIA = {
  floja: { id: 'floja', nombre: 'Refuerzo prioritario', tono: 'rojo', orden: 0 },
  sin_datos: { id: 'sin_datos', nombre: 'Por evaluar', tono: 'gris', orden: 1 },
  proceso: { id: 'proceso', nombre: 'En proceso', tono: 'ambar', orden: 2 },
  fuerte: { id: 'fuerte', nombre: 'Fuerte', tono: 'verde', orden: 3 },
}

export function nivelCompetencia(precision, total) {
  if (total == null || total < 2 || precision == null) return 'sin_datos'
  return precision < 60 ? 'floja' : precision < 75 ? 'proceso' : 'fuerte'
}

const FACTOR_CARRERA = { alta: 1.3, media: 1.15, base: 1 }

// prioridadesCarrera: salida de carreras.prioridadesDe (opcional) → pondera las pruebas que pesan para la carrera.
export function perfilDiagnostico(intentos, { preguntasPorId = {}, prioridadesCarrera = null, minimoPrioridades = 3 } = {}) {
  const tax = taxonomia()
  const r = resumen(intentos, preguntasPorId)
  const nivelCarrera = Object.fromEntries((prioridadesCarrera ?? []).map(p => [p.prueba, p.nivel]))
  const factor = (prueba) => FACTOR_CARRERA[nivelCarrera[prueba] ?? 'base'] ?? 1

  const competencias = tax.competencias.map(c => {
    const x = r.por_competencia.find(y => y.id === c.id)
    const total = x?.total ?? 0, precision = x?.precision ?? null
    const nivel = nivelCompetencia(precision, total)
    // Puntaje de prioridad: cuanto más floja y más pesa para la carrera, más alto.
    const base = nivel === 'sin_datos' ? 45 : 100 - precision
    return { id: c.id, prueba: c.prueba, nombre: nombreCompetencia(c.id), total, aciertos: x?.aciertos ?? 0, precision, nivel, prioridad: Math.round(base * factor(c.prueba)) }
  })

  const pruebas = tax.pruebas.map(p => {
    const x = r.por_prueba.find(y => y.id === p.id)
    const total = x?.total ?? 0, precision = x?.precision ?? null
    return { id: p.id, nombre: nombrePrueba(p.id), total, aciertos: x?.aciertos ?? 0, precision, nivel: nivelCompetencia(precision, total), carrera: nivelCarrera[p.id] ?? 'base' }
  })

  // Prioridades: flojas primero (por puntaje), luego por evaluar, luego en proceso. Nunca las fuertes.
  const orden = (a, b) => NIVELES_COMPETENCIA[a.nivel].orden - NIVELES_COMPETENCIA[b.nivel].orden || b.prioridad - a.prioridad
  const prioridades = competencias.filter(c => c.nivel !== 'fuerte').sort(orden).slice(0, minimoPrioridades)

  const flojas = competencias.filter(c => c.nivel === 'floja').length
  const fuertes = competencias.filter(c => c.nivel === 'fuerte').length
  const sinDatos = competencias.filter(c => c.nivel === 'sin_datos').length
  const mensaje = !intentos.length ? 'Aún no hay respuestas: haz la prueba diagnóstica para saber de dónde partes.'
    : sinDatos > 7 ? 'Hay pocas respuestas todavía: el perfil se irá afinando con cada práctica.'
    : flojas === 0 ? 'No hay competencias flojas por ahora. Toca subir las que están en proceso y sostener las fuertes.'
    : `Tienes ${flojas} competencia(s) que necesitan refuerzo prioritario y ${fuertes} fuerte(s). Empieza por las prioridades.`

  return { n: intentos.length, precision: r.precision, competencias, pruebas, prioridades, conteo: { flojas, fuertes, sin_datos: sinDatos, proceso: competencias.length - flojas - fuertes - sinDatos }, mensaje }
}
