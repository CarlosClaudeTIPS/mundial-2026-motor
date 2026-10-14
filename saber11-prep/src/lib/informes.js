import referencia from '../../content/referencia-nacional.json'
import niveles from '../../content/niveles-desempeno.json'
import { nombrePrueba, nombreCompetencia, nombreTipoError, practicaParaError, taxonomia } from './taxonomia'

// ─── Informes de mejoramiento al estilo del reporte Saber 11 ─────────────────
// Puntajes ESTIMADOS a partir de las respuestas en la plataforma (el ICFES usa
// un modelo estadístico sobre la población nacional; aquí el puntaje de cada
// prueba es el porcentaje de aciertos y el global usa la ponderación oficial
// 3-3-3-3-1 llevada a 0-500). Los percentiles se comparan con dos referencias:
// la nacional (datos abiertos del ICFES, content/referencia-nacional.json) y
// la local (los demás estudiantes de la plataforma o del grupo).

export const PRUEBAS = ['lectura_critica', 'matematicas', 'sociales_ciudadanas', 'ciencias_naturales', 'ingles']
export const PONDERACION = { lectura_critica: 3, matematicas: 3, sociales_ciudadanas: 3, ciencias_naturales: 3, ingles: 1 }

// Rangos de los niveles de desempeño (Guía de interpretación de resultados Saber 11, ICFES).
// Inglés: niveles del MCER tal como los reporta el ICFES; los cortes salen de los datos abiertos 2022.
export const NIVELES = {
  lectura_critica: [[0, 35, '1'], [36, 50, '2'], [51, 65, '3'], [66, 100, '4']],
  matematicas: [[0, 35, '1'], [36, 50, '2'], [51, 70, '3'], [71, 100, '4']],
  sociales_ciudadanas: [[0, 40, '1'], [41, 55, '2'], [56, 70, '3'], [71, 100, '4']],
  ciencias_naturales: [[0, 40, '1'], [41, 55, '2'], [56, 70, '3'], [71, 100, '4']],
  ingles: [[0, 47, 'A-'], [48, 57, 'A1'], [58, 67, 'A2'], [68, 78, 'B1'], [79, 100, 'B+']],
}
export const NOMBRE_NIVEL = { 1: 'Insuficiente', 2: 'Mínimo', 3: 'Satisfactorio', 4: 'Avanzado', 'A-': 'Pre A1', A1: 'A1', A2: 'A2', B1: 'B1', 'B+': 'B+' }
export const ORDEN_NIVEL = { 1: 1, 2: 2, 3: 3, 4: 4, 'A-': 1, A1: 2, A2: 3, B1: 4, 'B+': 5 }

export function nivelDe(prueba, puntaje) {
  if (puntaje == null) return null
  const p = Math.max(0, Math.min(100, Math.round(puntaje)))
  const fila = (NIVELES[prueba] ?? NIVELES.lectura_critica).find(([a, b]) => p >= a && p <= b)
  return fila ? fila[2] : null
}

const pct = (a, b) => (b ? Math.round((a / b) * 100) : null)

// Puntaje estimado 0-100 de una prueba a partir de intentos de esa prueba.
export function puntajePrueba(intentos) {
  if (!intentos.length) return null
  return pct(intentos.filter(i => i.correcta).length, intentos.length)
}

// Global 0-500 con ponderación oficial, solo con las pruebas que tienen datos.
export function puntajeGlobal(porPrueba) {
  let suma = 0, peso = 0
  for (const prueba of PRUEBAS) {
    const v = porPrueba[prueba]
    if (v == null) continue
    suma += v * PONDERACION[prueba]; peso += PONDERACION[prueba]
  }
  if (!peso) return null
  return Math.round((suma / peso) * 5)
}

// Percentil nacional (0-100) de un puntaje en una escala ('global' o id de prueba).
export function percentilNacional(escala, puntaje) {
  const e = referencia.escalas[escala]
  if (!e || puntaje == null) return null
  const s = Math.max(0, Math.min(e.acumulado.length - 1, Math.round(puntaje)))
  return Math.round(e.acumulado[s] + e.frecuencia[s] / 2)
}

// ── Formato oficial ICFES: descriptores, desviación, comparaciones ─────────────
// Descriptores de nivel de desempeño (Guía de orientación Saber 11.°, transcripción en content/niveles-desempeno.json).
export function descriptorNivel(prueba, nivel) {
  const d = niveles[prueba]?.[nivel]
  return d ? { nivel, rango: d.rango, general: d.general, especificos: d.especificos } : null
}

export function desviacion(vals) {
  const v = vals.filter(x => x != null)
  if (v.length < 2) return null
  const m = v.reduce((a, b) => a + b, 0) / v.length
  return Math.round(Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1)) * 10) / 10
}

// Comparación de un promedio contra un nivel de agregación, con la lógica del tamaño del efecto
// que usa el reporte del ICFES: ▲ considerablemente mayor, ▼ considerablemente menor, • similar.
// d de Cohen con la desviación del nivel de agregación de referencia; |d| < 0,2 se considera similar.
export function compararPromedio(media, mediaRef, sdRef) {
  if (media == null || mediaRef == null || !sdRef) return null
  const d = (media - mediaRef) / sdRef
  return d >= 0.2 ? '▲' : d <= -0.2 ? '▼' : '•'
}
// Desviación: ▲ resultados más dispersos que la referencia, ▼ más homogéneos, • similar (razón de desviaciones ±20 %).
export function compararDesviacion(sd, sdRef) {
  if (sd == null || !sdRef) return null
  const r = sd / sdRef
  return r >= 1.2 ? '▲' : r <= 0.8 ? '▼' : '•'
}
// Porcentajes por nivel: comparación directa, como en la Tabla 3.2 del reporte oficial.
export const compararPorcentaje = (a, b) => (a == null || b == null ? null : a > b ? '▲' : a < b ? '▼' : '•')
export const textoComparacion = { '▲': 'Mayor', '▼': 'Menor', '•': 'Similar' }

// Porcentaje nacional de estudiantes en cada nivel de desempeño (a partir de la distribución acumulada de datos abiertos).
export function distribucionNacionalNiveles(prueba) {
  const e = referencia.escalas[prueba]
  if (!e) return null
  const acumHasta = (s) => (s >= e.acumulado.length ? 100 : e.acumulado[s])
  return (NIVELES[prueba] ?? []).map(([a, b, n]) => ({ nivel: n, pct: Math.round(acumHasta(b + 1) - acumHasta(a)) }))
}
export const desviacionNacional = (escala) => referencia.escalas[escala]?.desviacion ?? null
export const nNacional = (escala) => referencia.escalas[escala]?.n ?? null

// Color del porcentaje de respuestas incorrectas por aprendizaje (Figura 3.4 del reporte oficial).
export const colorIncorrectas = (pctIncorrectas) => (pctIncorrectas == null ? 'gris' : pctIncorrectas < 20 ? 'verde' : pctIncorrectas < 40 ? 'amarillo' : pctIncorrectas < 70 ? 'naranja' : 'rojo')

// Percentil dentro de una población local (valores de los demás).
export function percentilLocal(valor, poblacion) {
  const vals = poblacion.filter(v => v != null)
  if (valor == null || vals.length < 2) return null
  const menores = vals.filter(v => v < valor).length, iguales = vals.filter(v => v === valor).length
  return Math.round(((menores + iguales / 2) / vals.length) * 100)
}

export const referenciaNacional = () => ({ periodo: referencia._periodo, fuente: referencia._fuente, medias: Object.fromEntries(Object.entries(referencia.escalas).map(([k, v]) => [k, v.media])) })

// Aprendizajes por afirmación/competencia: qué dominan y qué deben mejorar.
function aprendizajes(intentos, preguntasPorId, minimo = 3) {
  const porAfirmacion = {}
  for (const i of intentos) {
    const p = preguntasPorId[i.pregunta_id]
    if (!p) continue
    const clave = p.afirmacion || nombreCompetencia(p.competencia)
    const a = (porAfirmacion[clave] ??= { afirmacion: clave, prueba: p.prueba, competencia: p.competencia, total: 0, aciertos: 0, errores: {} })
    a.total++
    if (i.correcta) a.aciertos++
    else if (i.tipo_error) a.errores[i.tipo_error] = (a.errores[i.tipo_error] ?? 0) + 1
  }
  return Object.values(porAfirmacion).map(a => {
    const precision = pct(a.aciertos, a.total)
    const errorPrincipal = Object.entries(a.errores).sort((x, y) => y[1] - x[1])[0]?.[0] ?? null
    const practica = errorPrincipal ? taxonomia().tipoPracticaPorId[practicaParaError(errorPrincipal)] : null
    return {
      ...a, precision, pct_error: 100 - (precision ?? 0),
      estado: a.total < minimo ? 'pocos_datos' : precision >= 75 ? 'fortaleza' : precision < 50 ? 'por_mejorar' : 'en_proceso',
      error_principal: errorPrincipal ? nombreTipoError(errorPrincipal) : null,
      practica: practica ? `${practica.nombre}: ${practica.descripcion}` : null,
      nombre_competencia: nombreCompetencia(a.competencia),
    }
  }).sort((x, y) => (x.precision ?? 101) - (y.precision ?? 101))
}

// ── Informe individual ────────────────────────────────────────────────────────
// poblacion: { global: [..], lectura_critica: [..], … } con los puntajes de los demás estudiantes (opcional).
export function informeEstudiante({ intentos, preguntasPorId = {}, poblacion = null, sesiones = [] }) {
  const porPrueba = {}
  const pruebas = PRUEBAS.map(prueba => {
    const propios = intentos.filter(i => i.prueba === prueba)
    const puntaje = puntajePrueba(propios)
    porPrueba[prueba] = puntaje
    const aps = aprendizajes(propios, preguntasPorId)
    return {
      prueba, nombre: nombrePrueba(prueba), respuestas: propios.length, puntaje,
      nivel: nivelDe(prueba, puntaje), nombre_nivel: NOMBRE_NIVEL[nivelDe(prueba, puntaje)] ?? null,
      percentil_nacional: percentilNacional(prueba, puntaje),
      percentil_local: poblacion ? percentilLocal(puntaje, poblacion[prueba] ?? []) : null,
      media_nacional: referencia.escalas[prueba]?.media ?? null,
      descriptor: descriptorNivel(prueba, nivelDe(prueba, puntaje)),
      aprendizajes: aps,
      por_mejorar: aps.filter(a => a.estado === 'por_mejorar'),
      fortalezas: aps.filter(a => a.estado === 'fortaleza'),
    }
  })
  const global = puntajeGlobal(porPrueba)
  // Evolución: cada simulacro/mini-prueba terminada, con su puntaje global estimado
  const evolucion = sesiones.filter(s => s.estado === 'terminada' && s.resultado).map(s => {
    const pp = {}
    for (const x of s.resultado.por_prueba ?? []) pp[x.id] = x.precision
    return { id: s.id, titulo: s.titulo, fecha: s.fecha_fin ?? s.fecha_inicio, precision: s.resultado.precision, global: puntajeGlobal(pp), por_prueba: pp }
  }).sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
  const conDatos = pruebas.filter(p => p.puntaje != null)
  return {
    respuestas: intentos.length,
    global, pruebas_con_datos: conDatos.length, global_parcial: conDatos.length > 0 && conDatos.length < PRUEBAS.length,
    nivel_global: global == null ? null : global >= 350 ? 'alto' : global >= 250 ? 'medio' : 'bajo',
    percentil_nacional: percentilNacional('global', global),
    percentil_local: poblacion ? percentilLocal(global, poblacion.global ?? []) : null,
    media_nacional_global: referencia.escalas.global.media,
    pruebas,
    mas_fuerte: conDatos.length ? conDatos.reduce((a, b) => (b.puntaje > a.puntaje ? b : a)) : null,
    mas_debil: conDatos.length ? conDatos.reduce((a, b) => (b.puntaje < a.puntaje ? b : a)) : null,
    prioridades: pruebas.flatMap(p => p.por_mejorar.map(a => ({ ...a, nombre_prueba: p.nombre }))).sort((a, b) => b.pct_error - a.pct_error).slice(0, 8),
    evolucion,
    referencia: referenciaNacional(),
  }
}

// ── Informe de grupo ──────────────────────────────────────────────────────────
export function informeGrupo({ miembros, intentos, preguntasPorId = {} }) {
  const individuales = miembros.map(m => ({ estudiante: m, informe: informeEstudiante({ intentos: intentos.filter(i => i.estudiante_id === m.id), preguntasPorId }) }))
  const activos = individuales.filter(x => x.informe.respuestas > 0)
  // Percentil local de cada estudiante dentro del grupo
  const poblacion = { global: activos.map(x => x.informe.global) }
  for (const prueba of PRUEBAS) poblacion[prueba] = activos.map(x => x.informe.pruebas.find(p => p.prueba === prueba).puntaje)
  for (const x of activos) {
    x.informe.percentil_local = percentilLocal(x.informe.global, poblacion.global)
    for (const p of x.informe.pruebas) p.percentil_local = percentilLocal(p.puntaje, poblacion[p.prueba])
  }
  const promedio = (vals) => { const v = vals.filter(x => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null }
  const pruebas = PRUEBAS.map(prueba => {
    const puntajes = activos.map(x => x.informe.pruebas.find(p => p.prueba === prueba)).filter(p => p.puntaje != null)
    const media = promedio(puntajes.map(p => p.puntaje))
    const niveles = {}
    for (const p of puntajes) niveles[p.nivel] = (niveles[p.nivel] ?? 0) + 1
    const aps = aprendizajes(intentos.filter(i => i.prueba === prueba), preguntasPorId, 6)
    const sd = desviacion(puntajes.map(p => p.puntaje))
    const nacional = distribucionNacionalNiveles(prueba) ?? []
    return {
      prueba, nombre: nombrePrueba(prueba), evaluados: puntajes.length, media, desviacion: sd,
      nivel_medio: nivelDe(prueba, media), percentil_nacional: percentilNacional(prueba, media), media_nacional: referencia.escalas[prueba]?.media ?? null,
      desviacion_nacional: desviacionNacional(prueba),
      comparacion_media: compararPromedio(media, referencia.escalas[prueba]?.media, desviacionNacional(prueba)),
      comparacion_desviacion: compararDesviacion(sd, desviacionNacional(prueba)),
      distribucion_niveles: (NIVELES[prueba] ?? []).map(([, , n]) => { const pctGrupo = pct(niveles[n] ?? 0, puntajes.length); const pctNal = nacional.find(x => x.nivel === n)?.pct ?? null; return { nivel: n, nombre: NOMBRE_NIVEL[n], n: niveles[n] ?? 0, pct: pctGrupo, pct_nacional: pctNal, comparacion: compararPorcentaje(pctGrupo, pctNal) } }),
      aprendizajes: aps, por_mejorar: aps.filter(a => a.estado === 'por_mejorar'), fortalezas: aps.filter(a => a.estado === 'fortaleza'),
      estudiantes_bajos: puntajes.filter(p => ORDEN_NIVEL[p.nivel] <= 2).length,
    }
  })
  const globales = activos.map(x => x.informe.global)
  const mediaGlobal = promedio(globales)
  const sdGlobal = desviacion(globales)
  return {
    n_estudiantes: miembros.length, n_activos: activos.length,
    // Ficha técnica (equivalente a matriculados / inscritos / presentes / con resultados publicados)
    ficha: { matriculados: miembros.length, inscritos: miembros.filter(m => (m.estado ?? 'activo') === 'activo').length, presentes: activos.length, con_resultados: activos.filter(x => x.informe.pruebas_con_datos === PRUEBAS.length).length, n_nacional: nNacional('global') },
    global: mediaGlobal, desviacion_global: sdGlobal, percentil_nacional: percentilNacional('global', mediaGlobal), media_nacional_global: referencia.escalas.global.media,
    desviacion_nacional_global: desviacionNacional('global'),
    comparacion_global: compararPromedio(mediaGlobal, referencia.escalas.global.media, desviacionNacional('global')),
    comparacion_desviacion_global: compararDesviacion(sdGlobal, desviacionNacional('global')),
    pruebas,
    prioridades: pruebas.flatMap(p => p.por_mejorar.map(a => ({ ...a, nombre_prueba: p.nombre }))).sort((a, b) => b.pct_error - a.pct_error).slice(0, 10),
    estudiantes: individuales.map(x => ({ id: x.estudiante.id, nombre: x.estudiante.nombre, usuario: x.estudiante.usuario, respuestas: x.informe.respuestas, global: x.informe.global, percentil_local: x.informe.percentil_local, percentil_nacional: x.informe.percentil_nacional, pruebas: Object.fromEntries(x.informe.pruebas.map(p => [p.prueba, { puntaje: p.puntaje, nivel: p.nivel }])), mas_debil: x.informe.mas_debil?.nombre ?? null }))
      .sort((a, b) => (b.global ?? -1) - (a.global ?? -1)),
    referencia: referenciaNacional(),
  }
}

// CSV del informe de grupo (para Excel).
export function csvInformeGrupo(inf) {
  const cab = ['Estudiante', 'Usuario', 'Respuestas', 'Global (est.)', 'Percentil grupo', 'Percentil nacional', ...PRUEBAS.flatMap(p => [`${nombrePrueba(p)} puntaje`, `${nombrePrueba(p)} nivel`]), 'Prueba más débil']
  const filas = inf.estudiantes.map(e => [e.nombre, e.usuario, e.respuestas, e.global ?? '', e.percentil_local ?? '', e.percentil_nacional ?? '', ...PRUEBAS.flatMap(p => [e.pruebas[p].puntaje ?? '', e.pruebas[p].nivel ?? '']), e.mas_debil ?? ''])
  return [cab, ...filas].map(f => f.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
}
