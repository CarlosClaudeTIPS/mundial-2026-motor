import { taxonomia, nombreTipoError, nombreHabilidad, nombrePrueba, practicaParaError } from './taxonomia'
import { getConfig } from './db'

// Reglas vigentes: las editadas en Administración (config.reglas) o las de por defecto.
export async function reglasVigentes() {
  const guardadas = await getConfig('reglas')
  if (!Array.isArray(guardadas) || !guardadas.length) return REGLAS_POR_DEFECTO
  return REGLAS_POR_DEFECTO.map(r => ({ ...r, ...(guardadas.find(g => g.id === r.id) ?? {}) }))
}

// ─── Reglas de recomendación (Fase 1: sin motor adaptativo) ─────────────────
// Entran los intentos recientes del estudiante; salen recomendaciones con el
// dato observado que las justifica. Cada regla es explícita y configurable.

export const REGLAS_POR_DEFECTO = [
  { id: 'error_repetido', activa: true, umbral: 3, ventana: 30,
    descripcion: 'Si falla ≥ umbral preguntas con el mismo tipo de error en la ventana (últimos N intentos), recomienda la práctica asociada a ese error y 5 preguntas relacionadas.' },
  { id: 'lento_pero_bien', activa: true, umbral: 0.5, minimo: 8,
    descripcion: 'Si acierta ≥ 70 % pero ≥ umbral de sus aciertos son lentos (más de 1,6× el tiempo sugerido), recomienda práctica cronometrada.' },
  { id: 'prueba_debil', activa: true, umbral: 0.5, minimo: 6,
    descripcion: 'Si en una prueba tiene precisión < umbral con al menos `minimo` intentos, recomienda lectura guiada en esa prueba.' },
  { id: 'habilidad_debil', activa: true, umbral: 0.5, minimo: 6,
    descripcion: 'Si una habilidad del eje transversal tiene precisión < umbral con al menos `minimo` intentos, recomienda práctica de esa habilidad.' },
  { id: 'sin_verificar', activa: true, umbral: 2, ventana: 30,
    descripcion: 'Si ≥ umbral errores son por descuido o falta de verificación, recomienda la lista de chequeo antes de enviar.' },
  { id: 'refuerzo_pendiente', activa: true,
    descripcion: 'Si hay preguntas falladas cuya pregunta de refuerzo aún no se intentó, propone resolverlas.' },
]

export function recomendar(intentos, { reglas = REGLAS_POR_DEFECTO, preguntasPorId = {} } = {}) {
  const activas = Object.fromEntries(reglas.filter(r => r.activa).map(r => [r.id, r]))
  const recs = []
  const ordenados = [...intentos].sort((a, b) => (a.fecha < b.fecha ? 1 : -1))

  // Regla: error repetido
  if (activas.error_repetido) {
    const r = activas.error_repetido
    const ventana = ordenados.slice(0, r.ventana)
    const conteo = {}
    for (const i of ventana) if (!i.correcta && i.tipo_error && i.tipo_error !== 'tiempo') conteo[i.tipo_error] = (conteo[i.tipo_error] ?? 0) + 1
    for (const [tipo, n] of Object.entries(conteo).sort((a, b) => b[1] - a[1])) {
      if (n >= r.umbral) recs.push({
        regla: 'error_repetido', prioridad: 1 + (10 - Math.min(n, 9)) / 10,
        practica: practicaParaError(tipo), tipo_error: tipo,
        titulo: `Practicar: ${nombreTipoError(tipo).toLowerCase()}`,
        dato: `${n} de tus últimos ${ventana.length} intentos fallaron por ${nombreTipoError(tipo).toLowerCase()}.`,
        accion: { tipo: 'practica', filtros: { tipo_error: tipo }, n: 5 },
      })
    }
  }

  // Regla: lento pero bien
  if (activas.lento_pero_bien) {
    const r = activas.lento_pero_bien
    const aciertos = ordenados.filter(i => i.correcta && i.tiempo_seg != null)
    if (aciertos.length >= r.minimo) {
      const lentos = aciertos.filter(i => i.lento).length
      const precision = ordenados.filter(i => i.correcta).length / Math.max(1, ordenados.length)
      if (precision >= 0.7 && lentos / aciertos.length >= r.umbral) recs.push({
        regla: 'lento_pero_bien', prioridad: 3, practica: 'cronometrada',
        titulo: 'Práctica cronometrada',
        dato: `Aciertas (${Math.round(precision * 100)} %), pero ${lentos} de ${aciertos.length} aciertos tardaron mucho más del tiempo sugerido.`,
        accion: { tipo: 'mini', config: { cantidad: 8, cronometro: true } },
      })
    }
  }

  // Regla: prueba débil
  if (activas.prueba_debil) {
    const r = activas.prueba_debil
    const porPrueba = agrupar(ordenados, i => i.prueba)
    for (const [prueba, lista] of Object.entries(porPrueba)) {
      const prec = lista.filter(i => i.correcta).length / lista.length
      if (lista.length >= r.minimo && prec < r.umbral) recs.push({
        regla: 'prueba_debil', prioridad: 2 + prec, practica: 'lectura_guiada', prueba,
        titulo: `Lectura guiada en ${nombrePrueba(prueba)}`,
        dato: `${Math.round(prec * 100)} % de aciertos en ${lista.length} preguntas de ${nombrePrueba(prueba)}.`,
        accion: { tipo: 'practica', filtros: { prueba, dificultad: 1 }, n: 5 },
      })
    }
  }

  // Regla: habilidad débil
  if (activas.habilidad_debil) {
    const r = activas.habilidad_debil
    const porHab = agrupar(ordenados, i => i.habilidad)
    for (const [hab, lista] of Object.entries(porHab)) {
      const prec = lista.filter(i => i.correcta).length / lista.length
      if (hab && lista.length >= r.minimo && prec < r.umbral) recs.push({
        regla: 'habilidad_debil', prioridad: 2.5 + prec, practica: 'representacion', habilidad: hab,
        titulo: `Trabajar la habilidad: ${nombreHabilidad(hab).toLowerCase()}`,
        dato: `${Math.round(prec * 100)} % de aciertos en ${lista.length} preguntas donde pesa "${nombreHabilidad(hab).toLowerCase()}".`,
        accion: { tipo: 'practica', filtros: { habilidad: hab }, n: 5 },
      })
    }
  }

  // Regla: sin verificar
  if (activas.sin_verificar) {
    const r = activas.sin_verificar
    const ventana = ordenados.slice(0, r.ventana)
    const n = ventana.filter(i => !i.correcta && ['descuido', 'verificacion'].includes(i.tipo_error)).length
    if (n >= r.umbral) recs.push({
      regla: 'sin_verificar', prioridad: 1.5, practica: 'verificacion',
      titulo: 'Verificar antes de enviar',
      dato: `${n} errores recientes fueron por descuido o por no verificar la respuesta.`,
      accion: { tipo: 'practica', filtros: {}, n: 5, verificacion: true },
    })
  }

  // Regla: refuerzo pendiente
  if (activas.refuerzo_pendiente) {
    const intentadas = new Set(ordenados.map(i => i.pregunta_id))
    const pendientes = []
    for (const i of ordenados) {
      if (i.correcta) continue
      const p = preguntasPorId[i.pregunta_id]
      for (const rid of p?.refuerzo_ids ?? []) if (!intentadas.has(rid) && !pendientes.includes(rid)) pendientes.push(rid)
    }
    if (pendientes.length) recs.push({
      regla: 'refuerzo_pendiente', prioridad: 4, practica: 'ejercitacion',
      titulo: 'Preguntas de refuerzo pendientes',
      dato: `Tienes ${pendientes.length} pregunta(s) de refuerzo asociadas a errores anteriores.`,
      accion: { tipo: 'ids', ids: pendientes.slice(0, 5) },
    })
  }

  // Sin datos suficientes: recomendación neutra
  if (!recs.length) recs.push({
    regla: 'inicio', prioridad: 9, practica: 'ejercitacion',
    titulo: ordenados.length < 10 ? 'Empieza con práctica variada' : 'Sigue con práctica variada',
    dato: ordenados.length < 10 ? 'Aún hay pocos intentos para detectar patrones.' : 'No se detectan patrones de error marcados en tus intentos recientes.',
    accion: { tipo: 'practica', filtros: {}, n: 5 },
  })

  return recs.sort((a, b) => a.prioridad - b.prioridad).map(r => ({
    ...r, nombre_practica: taxonomia().tipoPracticaPorId[r.practica]?.nombre ?? r.practica,
    descripcion_practica: taxonomia().tipoPracticaPorId[r.practica]?.descripcion ?? '',
  }))
}

function agrupar(lista, clave) {
  const out = {}
  for (const x of lista) { const k = clave(x); if (k == null) continue; (out[k] ??= []).push(x) }
  return out
}
