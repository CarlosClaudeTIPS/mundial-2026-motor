import { nombreTipoError, nombreHabilidad, nombrePrueba, nombreCompetencia, practicaParaError, taxonomia } from './taxonomia'

// ─── Analítica ───────────────────────────────────────────────────────────────
// Funciones puras: reciben intentos (y opcionalmente el mapa de preguntas) y
// devuelven resúmenes. Se usan tanto para el estudiante como para el docente.

const pct = (a, b) => (b ? Math.round((a / b) * 100) : null)

function porClave(intentos, clave) {
  const grupos = {}
  for (const i of intentos) {
    const k = i[clave]
    if (k == null) continue
    const g = (grupos[k] ??= { id: k, total: 0, aciertos: 0, tiempo: 0, conTiempo: 0 })
    g.total++
    if (i.correcta) g.aciertos++
    if (i.tiempo_seg != null) { g.tiempo += i.tiempo_seg; g.conTiempo++ }
  }
  return Object.values(grupos).map(g => ({ ...g, precision: pct(g.aciertos, g.total), tiempo_prom: g.conTiempo ? Math.round(g.tiempo / g.conTiempo) : null }))
}

export function resumen(intentos, preguntasPorId = {}) {
  const total = intentos.length
  const aciertos = intentos.filter(i => i.correcta).length
  const errores = intentos.filter(i => !i.correcta)
  const conTiempo = intentos.filter(i => i.tiempo_seg != null)
  const porTipoError = {}
  for (const e of errores) if (e.tipo_error) porTipoError[e.tipo_error] = (porTipoError[e.tipo_error] ?? 0) + 1
  return {
    total, aciertos, errores: errores.length, precision: pct(aciertos, total),
    sin_responder: intentos.filter(i => i.opcion == null).length,
    tiempo_total_seg: conTiempo.reduce((a, i) => a + i.tiempo_seg, 0),
    tiempo_prom_seg: conTiempo.length ? Math.round(conTiempo.reduce((a, i) => a + i.tiempo_seg, 0) / conTiempo.length) : null,
    por_prueba: porClave(intentos, 'prueba').map(x => ({ ...x, nombre: nombrePrueba(x.id) })),
    por_competencia: porClave(intentos, 'competencia').map(x => ({ ...x, nombre: nombreCompetencia(x.id) })),
    por_habilidad: porClave(intentos, 'habilidad').map(x => ({ ...x, nombre: nombreHabilidad(x.id) })),
    por_tipo_error: Object.entries(porTipoError).map(([id, n]) => ({ id, nombre: nombreTipoError(id), n, pct: pct(n, errores.length), practica: practicaParaError(id) })).sort((a, b) => b.n - a.n),
    fortalezas: porClave(intentos, 'competencia').filter(x => x.total >= 3 && x.precision >= 75).map(x => nombreCompetencia(x.id)),
    dificultades: porClave(intentos, 'competencia').filter(x => x.total >= 3 && x.precision < 50).map(x => nombreCompetencia(x.id)),
  }
}

// Evolución semanal: precisión por semana (ISO) para ver tendencia.
export function evolucionSemanal(intentos) {
  const semanas = {}
  for (const i of intentos) {
    const d = new Date(i.fecha)
    const lunes = new Date(d); lunes.setDate(d.getDate() - ((d.getDay() + 6) % 7)); lunes.setHours(0, 0, 0, 0)
    const k = lunes.toISOString().slice(0, 10)
    const s = (semanas[k] ??= { semana: k, total: 0, aciertos: 0 })
    s.total++; if (i.correcta) s.aciertos++
  }
  return Object.values(semanas).sort((a, b) => (a.semana < b.semana ? -1 : 1)).map(s => ({ ...s, precision: pct(s.aciertos, s.total) }))
}

// ── Grupo ─────────────────────────────────────────────────────────────────────
export function resumenGrupo(miembros, intentos, preguntasPorId = {}) {
  const porEstudiante = miembros.map(m => {
    const propios = intentos.filter(i => i.estudiante_id === m.id)
    return { estudiante: m, resumen: resumen(propios, preguntasPorId), ultimo: propios.reduce((a, i) => (i.fecha > a ? i.fecha : a), '') }
  })
  const activos = porEstudiante.filter(e => e.resumen.total > 0)
  const promedio = activos.length ? Math.round(activos.reduce((a, e) => a + e.resumen.precision, 0) / activos.length) : null

  // Errores frecuentes: % de estudiantes con ≥2 errores de ese tipo
  const tipos = {}
  for (const e of activos) {
    const conteo = {}
    for (const i of intentos.filter(i => i.estudiante_id === e.estudiante.id && !i.correcta && i.tipo_error)) conteo[i.tipo_error] = (conteo[i.tipo_error] ?? 0) + 1
    for (const [t, n] of Object.entries(conteo)) {
      const x = (tipos[t] ??= { id: t, nombre: nombreTipoError(t), estudiantes: 0, errores: 0, practica: practicaParaError(t) })
      x.errores += n
      if (n >= 2) x.estudiantes++
    }
  }
  const erroresFrecuentes = Object.values(tipos).map(t => ({ ...t, pct_estudiantes: pct(t.estudiantes, activos.length) })).sort((a, b) => b.estudiantes - a.estudiantes || b.errores - a.errores)

  const competencias = porClave(intentos, 'competencia').map(x => ({ ...x, nombre: nombreCompetencia(x.id) })).sort((a, b) => a.precision - b.precision)
  const habilidades = porClave(intentos, 'habilidad').map(x => ({ ...x, nombre: nombreHabilidad(x.id) })).sort((a, b) => a.precision - b.precision)
  const pruebas = porClave(intentos, 'prueba').map(x => ({ ...x, nombre: nombrePrueba(x.id) }))

  const conDificultad = activos.filter(e => e.resumen.total >= 8 && e.resumen.precision < 50).map(e => e.estudiante)
  const inactivos = porEstudiante.filter(e => e.resumen.total === 0).map(e => e.estudiante)

  return {
    n_estudiantes: miembros.length, n_activos: activos.length, promedio, porEstudiante, erroresFrecuentes, competencias, habilidades, pruebas, conDificultad, inactivos,
    total_intentos: intentos.length,
    acciones: accionesSugeridas({ erroresFrecuentes, competencias, habilidades, n_activos: activos.length, conDificultad, inactivos }),
  }
}

// Acciones sugeridas al docente: generadas por reglas explícitas, siempre con el dato que las motiva.
export function accionesSugeridas({ erroresFrecuentes, competencias, habilidades, n_activos, conDificultad, inactivos }) {
  const acciones = []
  if (n_activos < 3) {
    acciones.push({ tipo: 'info', titulo: 'Aún hay pocos datos', dato: `${n_activos} estudiante(s) con intentos registrados.`, sugerencia: 'Asigna una mini-prueba diagnóstica de 10 preguntas para tener una primera lectura del grupo.', accion: { tipo: 'mini', config: { cantidad: 10, tiempo_min: 20 } } })
    return acciones
  }
  for (const e of erroresFrecuentes.slice(0, 3)) {
    if (e.pct_estudiantes >= 40) {
      const practica = taxonomia().tipoPracticaPorId[e.practica]
      acciones.push({
        tipo: 'error', titulo: `Trabajar "${e.nombre.toLowerCase()}"`,
        dato: `${e.pct_estudiantes} % de los estudiantes activos (${e.estudiantes} de ${n_activos}) acumulan 2 o más errores de este tipo.`,
        sugerencia: `${practica?.nombre ?? 'Práctica'}: ${practica?.descripcion ?? ''} Asigna una mini-prueba de 8 preguntas con este tipo de error y una sesión corta de ejemplo resuelto en clase.`,
        accion: { tipo: 'mini', config: { cantidad: 8, tiempo_min: 16, filtros: { tipo_error: e.id } }, titulo: `Mini-prueba · ${e.nombre}` },
      })
    }
  }
  const compDebil = competencias.find(c => c.total >= 10 && c.precision < 50)
  if (compDebil) acciones.push({
    tipo: 'competencia', titulo: `Competencia débil: ${compDebil.nombre}`,
    dato: `${compDebil.precision} % de aciertos en ${compDebil.total} respuestas del grupo.`,
    sugerencia: 'Dedica la próxima sesión a esta competencia con lectura guiada: qué pregunta, qué datos sirven, qué opción responde exactamente lo preguntado.',
    accion: { tipo: 'mini', config: { cantidad: 8, tiempo_min: 16, filtros: { competencia: compDebil.id } }, titulo: `Mini-prueba · ${compDebil.nombre}` },
  })
  const habDebil = habilidades.find(h => h.total >= 10 && h.precision < 50)
  if (habDebil) acciones.push({
    tipo: 'habilidad', titulo: `Habilidad transversal débil: ${habDebil.nombre}`,
    dato: `${habDebil.precision} % de aciertos en ${habDebil.total} preguntas donde pesa "${habDebil.nombre.toLowerCase()}".`,
    sugerencia: 'Trabaja la habilidad dentro de cada área (no como taller aparte): en cada pregunta de clase, pide primero decir qué se pregunta y qué información sirve.',
    accion: { tipo: 'mini', config: { cantidad: 8, tiempo_min: 16, filtros: { habilidad: habDebil.id } }, titulo: `Mini-prueba · ${habDebil.nombre}` },
  })
  if (conDificultad.length) acciones.push({ tipo: 'estudiantes', titulo: 'Estudiantes con dificultades marcadas', dato: `${conDificultad.length} estudiante(s) con menos del 50 % de aciertos y al menos 8 intentos.`, sugerencia: 'Revisa su bitácora de errores individual y asígnales práctica de dificultad 1 en su prueba más débil.', estudiantes: conDificultad })
  if (inactivos.length) acciones.push({ tipo: 'inactivos', titulo: 'Estudiantes sin actividad', dato: `${inactivos.length} estudiante(s) no han registrado intentos.`, sugerencia: 'Verifica acceso (usuario y PIN) o usa el modo papel para no dejarlos por fuera.', estudiantes: inactivos })
  return acciones
}

// ── Preguntas ─────────────────────────────────────────────────────────────────
export function estadisticasPreguntas(intentos, preguntasPorId) {
  const porPregunta = {}
  for (const i of intentos) {
    const p = (porPregunta[i.pregunta_id] ??= { id: i.pregunta_id, total: 0, aciertos: 0, opciones: {}, tiempo: 0, conTiempo: 0 })
    p.total++; if (i.correcta) p.aciertos++
    if (i.opcion) p.opciones[i.opcion] = (p.opciones[i.opcion] ?? 0) + 1
    if (i.tiempo_seg != null) { p.tiempo += i.tiempo_seg; p.conTiempo++ }
  }
  return Object.values(porPregunta).map(p => {
    const preg = preguntasPorId[p.id]
    const ordenadas = Object.entries(p.opciones).sort((a, b) => b[1] - a[1])
    const distractor = ordenadas.find(([k]) => k !== preg?.opciones.find(o => o.correcta)?.clave)
    const alertas = []
    if (p.total >= 10 && p.aciertos / p.total < 0.2) alertas.push('Muy pocos aciertos')
    if (p.total >= 10 && ordenadas.length >= 2 && Math.abs(ordenadas[0][1] - ordenadas[1][1]) <= Math.max(1, p.total * 0.05)) alertas.push('Dos opciones casi igual de elegidas')
    if (preg?.tiempo_sugerido_seg && p.conTiempo >= 5 && p.tiempo / p.conTiempo > preg.tiempo_sugerido_seg * 2.5) alertas.push('Tiempo muy alto')
    return {
      ...p, pregunta: preg, precision: pct(p.aciertos, p.total),
      distractor: distractor ? { clave: distractor[0], n: distractor[1] } : null,
      tiempo_prom: p.conTiempo ? Math.round(p.tiempo / p.conTiempo) : null,
      revisar: alertas.length > 0, alertas,
    }
  }).sort((a, b) => (a.precision ?? 100) - (b.precision ?? 100))
}
