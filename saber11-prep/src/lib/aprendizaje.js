import { nombreCompetencia, nombreTipoError, nombrePrueba } from './taxonomia'

// ─── Medición del aprendizaje real ───────────────────────────────────────────
// Un error se considera SUPERADO cuando, después de fallar, el estudiante
// responde bien preguntas NUEVAS (otros ids) de la misma competencia. Repetir la
// misma pregunta no cuenta: eso mide memoria. También se contabilizan las
// preguntas de verificación (modo 'verificacion', refuerzo_de = intento fallado).

const fechaLocal = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const pct = (a, b) => (b ? Math.round((a / b) * 100) : null)

export function medirAprendizaje(intentos) {
  const orden = [...intentos].sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
  const vistos = new Set()
  const porComp = {}
  for (const i of orden) {
    const c = i.competencia
    if (!c) { vistos.add(i.pregunta_id); continue }
    const g = (porComp[c] ??= { id: c, prueba: i.prueba, errores: 0, primerError: null, nuevosDespues: 0, aciertosNuevos: 0, verificaciones: 0, verificacionesOk: 0, ultimo: null })
    const esNueva = !vistos.has(i.pregunta_id)
    if (g.primerError && esNueva) { g.nuevosDespues++; if (i.correcta) g.aciertosNuevos++ }
    if (!i.correcta) { g.errores++; g.primerError ??= i.fecha }
    if (i.modo === 'verificacion') { g.verificaciones++; if (i.correcta) g.verificacionesOk++ }
    g.ultimo = i.fecha
    vistos.add(i.pregunta_id)
  }
  const competencias = Object.values(porComp).filter(g => g.errores > 0).map(g => {
    const precisionNuevas = pct(g.aciertosNuevos, g.nuevosDespues)
    const estado = g.nuevosDespues === 0 ? 'sin_verificar' : (g.nuevosDespues >= 2 && precisionNuevas >= 70) ? 'superado' : 'en_proceso'
    return { ...g, nombre: nombreCompetencia(g.id), nombre_prueba: nombrePrueba(g.prueba), precision_nuevas: precisionNuevas, estado }
  }).sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado] || b.errores - a.errores)

  // Tipos de error: ¿bajan con el tiempo? Compara la primera mitad de los intentos con la segunda.
  const mitad = Math.floor(orden.length / 2)
  const tasa = (lista, tipo) => (lista.length ? lista.filter(i => !i.correcta && i.tipo_error === tipo).length / lista.length : 0)
  const tipos = [...new Set(orden.filter(i => !i.correcta && i.tipo_error).map(i => i.tipo_error))].map(t => {
    const antes = tasa(orden.slice(0, mitad), t), despues = tasa(orden.slice(mitad), t)
    const n = orden.filter(i => !i.correcta && i.tipo_error === t).length
    const tendencia = orden.length < 10 ? 'pocos_datos' : despues < antes * 0.7 ? 'baja' : despues > antes * 1.3 ? 'sube' : 'igual'
    return { id: t, nombre: nombreTipoError(t), n, antes: Math.round(antes * 100), despues: Math.round(despues * 100), tendencia }
  }).sort((a, b) => b.n - a.n)

  const verif = orden.filter(i => i.modo === 'verificacion')
  const verificaciones = { total: verif.length, correctas: verif.filter(i => i.correcta).length, pct: pct(verif.filter(i => i.correcta).length, verif.length) }
  const conteo = { superado: 0, en_proceso: 0, sin_verificar: 0 }
  for (const c of competencias) conteo[c.estado]++
  return { competencias, tipos_error: tipos, verificaciones, conteo, n: orden.length }
}
const ORDEN = { superado: 0, en_proceso: 1, sin_verificar: 2 }

// Constancia: días con actividad y racha actual.
export function constancia(intentos, hoy = new Date()) {
  const dias = new Set(intentos.map(i => fechaLocal(i.fecha)))
  const h = new Date(hoy); h.setHours(0, 0, 0, 0)
  const clave = (d) => fechaLocal(d.toISOString())
  const enRango = (n) => { let c = 0; for (let k = 0; k < n; k++) { const d = new Date(h); d.setDate(h.getDate() - k); if (dias.has(clave(d))) c++ } return c }
  // Racha: días consecutivos hasta hoy (o hasta ayer, si hoy aún no ha practicado)
  let racha = 0
  const d = new Date(h)
  if (!dias.has(clave(d))) d.setDate(d.getDate() - 1)
  while (dias.has(clave(d))) { racha++; d.setDate(d.getDate() - 1) }
  return { dias_total: dias.size, ultimos_7: enRango(7), ultimos_30: enRango(30), racha, hoy: dias.has(clave(h)) }
}
