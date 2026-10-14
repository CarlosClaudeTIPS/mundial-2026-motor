import { db, setConfig, getConfig } from './db'
import { supabase, NUBE_DISPONIBLE } from './supabase'
import { refrescarUsuario } from './sesion'
import { nombreCompetencia } from './taxonomia'

// ─── Mi ruta para mejorar ────────────────────────────────────────────────────
// Plan semanal PERSONAL: parte del perfil de diagnóstico (diagnostico.js), del
// tiempo que el estudiante dice tener, de su meta y de la fecha del examen, y
// reparte sesiones cortas por día reutilizando lo que ya existe (práctica
// dirigida, repaso de errores con verificación, mini-pruebas, simulacros,
// lecciones de Refuerzo). Lo "hecho" no se guarda: se deduce de los intentos y
// sesiones de cada día, así funciona sin conexión y sin tablas nuevas.

export const RUTA_POR_DEFECTO = { grado: 11, fecha_examen: null, minutos_dia: 30, dias_semana: 5, meta_global: 300 }
export const LIMITES = { minutos_dia: [15, 120], dias_semana: [2, 7], meta_global: [200, 500] }

const DIA = 86400000
const clave = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }
const aFecha = (iso) => new Date(iso.length === 10 ? iso + 'T00:00:00' : iso)
const clamp = (v, [a, b]) => Math.min(b, Math.max(a, Number(v) || a))

export function normalizarConfig(c = {}, ciclo = null) {
  return {
    grado: [9, 10, 11].includes(Number(c.grado)) ? Number(c.grado) : RUTA_POR_DEFECTO.grado,
    fecha_examen: c.fecha_examen || ciclo?.fecha_examen || null,
    minutos_dia: clamp(c.minutos_dia ?? RUTA_POR_DEFECTO.minutos_dia, LIMITES.minutos_dia),
    dias_semana: clamp(c.dias_semana ?? RUTA_POR_DEFECTO.dias_semana, LIMITES.dias_semana),
    meta_global: clamp(c.meta_global ?? RUTA_POR_DEFECTO.meta_global, LIMITES.meta_global),
    definida: Boolean(c.definida),
  }
}

// Qué días de la semana se estudia según cuántos días eligió (0 = lunes … 6 = domingo).
export function diasDeEstudio(n) {
  return { 2: [1, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] }[clamp(n, LIMITES.dias_semana)]
}

export function lunesDe(hoy = new Date()) {
  const d = new Date(hoy); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d
}

// Preguntas que caben en una sesión: ~2,5 min por pregunta más 5 min de lectura de la explicación/lección.
export const preguntasPorSesion = (minutos) => Math.max(3, Math.min(15, Math.floor((minutos - 5) / 2.5)))

// Plan de la semana que contiene `hoy`.
//  perfil: salida de perfilDiagnostico (o null)      hayDiagnostico: hay una sesión diagnóstica terminada
//  intentos / sesiones: del estudiante (para marcar lo hecho)   erroresPendientes: ids de preguntas falladas no superadas
export function planSemana({ config, perfil = null, hayDiagnostico = false, intentos = [], sesiones = [], erroresPendientes = [], puntajeActual = null, hoy = new Date() }) {
  const cfg = normalizarConfig(config)
  const lunes = lunesDe(hoy)
  const diasEstudio = diasDeEstudio(cfg.dias_semana)
  const examen = cfg.fecha_examen ? aFecha(cfg.fecha_examen) : null
  const diasRestantes = examen ? Math.max(0, Math.ceil((examen - new Date(new Date(hoy).setHours(0, 0, 0, 0))) / DIA)) : null
  const semanaIndice = Math.floor((lunes - lunesDe(examen ? new Date(examen - 365 * DIA) : lunes)) / (7 * DIA)) // paridad estable para alternar
  const rectaFinal = diasRestantes != null && diasRestantes <= 42
  const m = cfg.minutos_dia
  const n = preguntasPorSesion(m)

  // Objetivos de la semana: hasta 3 competencias prioritarias del perfil.
  const sinDatos = !hayDiagnostico && (perfil?.n ?? 0) < 10
  // Sin datos no hay objetivos por competencia (serían arbitrarios): el objetivo es el diagnóstico.
  const prioridades = sinDatos ? [] : (perfil?.prioridades ?? []).slice(0, 3)
  const objetivos = prioridades.map(c => ({ competencia: c.id, prueba: c.prueba, nombre: c.nombre, nivel: c.nivel, precision: c.precision, meta: c.nivel === 'floja' ? 'Subir de refuerzo prioritario a en proceso (≥ 60 %)' : c.nivel === 'sin_datos' ? 'Responder al menos 5 preguntas para saber cómo vas' : 'Pasar a fuerte (≥ 75 %)' }))

  // Sesiones ya hechas por día (para marcar).
  const intentosPorDia = {}, sesionesPorDia = {}
  for (const i of intentos) (intentosPorDia[clave(i.fecha)] ??= []).push(i)
  for (const s of sesiones) if (s.estado === 'terminada') (sesionesPorDia[clave(s.fecha_fin ?? s.fecha_inicio)] ??= []).push(s)
  const diagnosticoHecho = sesiones.some(s => s.config?.diagnostico && s.estado === 'terminada')

  const dias = []
  let k = 0
  for (let d = 0; d < 7; d++) {
    const fecha = new Date(lunes); fecha.setDate(lunes.getDate() + d)
    const key = clave(fecha)
    const esEstudio = diasEstudio.includes(d)
    const pasado = fecha < new Date(new Date(hoy).setHours(0, 0, 0, 0))
    const esHoy = key === clave(hoy)
    if (!esEstudio) { dias.push({ fecha: key, dia: d, descanso: true, hoy: esHoy, pasado }); continue }
    const ultimoEstudio = d === diasEstudio[diasEstudio.length - 1]
    let s
    if (sinDatos && k === 0 && !diagnosticoHecho) {
      s = { tipo: 'diagnostico', titulo: 'Prueba diagnóstica', detalle: `25 preguntas · 40 min${m < 40 ? ' (puedes hacerla en dos partes: se guarda donde la dejes)' : ''}. Con ella se arma el resto de tu ruta.`, minutos: 40, accion: { tipo: 'diagnostico' } }
    } else if (ultimoEstudio && (rectaFinal || semanaIndice % 2 === 0) && m >= 30) {
      const escala = Math.min(0.5, Math.max(0.1, Math.round((m / 260) * 20) / 20))
      s = { tipo: 'simulacro', titulo: rectaFinal ? 'Simulacro cronometrado (recta final)' : 'Simulacro cronometrado', detalle: `Sesión ${semanaIndice % 4 < 2 ? 1 : 2} del examen a escala ${Math.round(escala * 100)} %, con el tiempo real por pregunta.`, minutos: Math.round(escala * 260), accion: { tipo: 'simulacro', sesion_examen: semanaIndice % 4 < 2 ? 1 : 2, escala } }
    } else {
      const ciclo = k % 4
      const obj = objetivos[ciclo === 0 ? 0 : ciclo === 1 ? 1 : 2] ?? objetivos[0] ?? null
      if (ciclo === 2) {
        s = erroresPendientes.length
          ? { tipo: 'errores', titulo: 'Repasar mis errores y verificar', detalle: `Vuelve a ${Math.min(erroresPendientes.length, Math.max(3, Math.floor(n / 2)))} errores pendientes, explica por qué te equivocaste y comprueba con una pregunta nueva de cada uno.`, minutos: m, accion: { tipo: 'errores', ids: erroresPendientes.slice(0, Math.max(3, Math.floor(n / 2))) } }
          : { tipo: 'mini', titulo: 'Mini-prueba cronometrada', detalle: `${Math.min(n, 10)} preguntas variadas en ${Math.min(m, 25)} min, sin explicación hasta el final: así entrenas el ritmo del examen.`, minutos: Math.min(m, 25), accion: { tipo: 'mini', config: { cantidad: Math.min(n, 10), tiempo_min: Math.min(m, 25) } } }
      } else if (ciclo === 3 && !obj) {
        s = { tipo: 'mini', titulo: 'Mini-prueba cronometrada', detalle: `${Math.min(n, 10)} preguntas variadas en ${Math.min(m, 25)} min.`, minutos: Math.min(m, 25), accion: { tipo: 'mini', config: { cantidad: Math.min(n, 10), tiempo_min: Math.min(m, 25) } } }
      } else if (obj) {
        const dificultad = obj.nivel === 'floja' ? 1 : undefined
        s = { tipo: 'practica', competencia: obj.competencia, titulo: `Practicar: ${obj.nombre}`, detalle: `Lee primero la lección (3 min, «Explícame desde cero») y resuelve ${n} preguntas${dificultad ? ' de dificultad básica' : ''} con explicación. En cada error, di por qué y verifica con una nueva.`, minutos: m, accion: { tipo: 'practica', filtros: { competencia: obj.competencia, dificultad }, n } }
      } else {
        s = { tipo: 'practica', titulo: 'Práctica variada', detalle: `${n} preguntas de todas las materias con explicación.`, minutos: m, accion: { tipo: 'practica', filtros: {}, n } }
      }
    }
    s.hecho = estaHecha(s, intentosPorDia[key] ?? [], sesionesPorDia[key] ?? [], diagnosticoHecho)
    dias.push({ fecha: key, dia: d, hoy: esHoy, pasado, ...s })
    k++
  }

  const planeadas = dias.filter(d => !d.descanso)
  const hechas = planeadas.filter(d => d.hecho).length
  const meta = { global: cfg.meta_global, actual: puntajeActual, brecha: puntajeActual != null ? cfg.meta_global - puntajeActual : null, semanas_restantes: diasRestantes != null ? Math.max(1, Math.ceil(diasRestantes / 7)) : null }
  meta.puntos_por_semana = meta.brecha != null && meta.brecha > 0 && meta.semanas_restantes ? Math.round((meta.brecha / meta.semanas_restantes) * 10) / 10 : null

  return { config: cfg, semana: { inicio: clave(lunes), fin: clave(new Date(lunes.getTime() + 6 * DIA)) }, dias_restantes: diasRestantes, recta_final: rectaFinal, objetivos, dias, resumen: { planeadas: planeadas.length, hechas, minutos_semana: planeadas.reduce((a, d) => a + (d.minutos ?? 0), 0) }, meta, sin_datos: sinDatos, hoy: dias.find(d => d.hoy) ?? null }
}

function estaHecha(s, intentosDia, sesionesDia, diagnosticoHecho) {
  const n = s.accion?.n ?? s.accion?.config?.cantidad ?? 5
  switch (s.tipo) {
    case 'diagnostico': return diagnosticoHecho
    case 'practica': return s.competencia ? intentosDia.filter(i => i.competencia === s.competencia).length >= Math.ceil(n / 2) || intentosDia.length >= n : intentosDia.length >= n
    case 'errores': return intentosDia.some(i => i.modo === 'verificacion' || i.modo === 'refuerzo') || intentosDia.length >= 3
    case 'mini': return sesionesDia.some(x => x.tipo === 'mini' && !x.config?.diagnostico)
    case 'simulacro': return sesionesDia.some(x => x.tipo === 'simulacro')
    default: return false
  }
}

export const NOMBRE_DIA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const nombreObjetivo = (o) => o?.nombre ?? nombreCompetencia(o?.competencia)

// ── Persistencia de la configuración ─────────────────────────────────────────
// En la nube va en perfiles.ruta_config (migración 005, función guardar_ruta).
// Si la nube no tiene la migración, queda en este dispositivo (db.config) y se avisa.
export async function leerRutaConfig(usuario, ciclo = null) {
  const local = await getConfig(`ruta:${usuario.id}`)
  return normalizarConfig(usuario.ruta_config ?? local ?? {}, ciclo)
}

export async function guardarRutaConfig(usuario, config) {
  const cfg = { ...normalizarConfig(config), definida: true }
  let aviso = null
  if (NUBE_DISPONIBLE && !usuario.previsualizacion) {
    const { error } = await supabase.rpc('guardar_ruta', { p_config: cfg })
    if (error && /guardar_ruta|function|schema cache/i.test(error.message)) aviso = 'Tu ruta quedó guardada en este dispositivo. La nube todavía no tiene esta función (migración 005): avísale a tu docente.'
    else if (error) throw new Error('No se pudo guardar tu ruta: ' + error.message)
  }
  await setConfig(`ruta:${usuario.id}`, cfg)
  await db.usuarios.update(usuario.id, { ruta_config: cfg })
  await refrescarUsuario().catch(() => {})
  return { ...cfg, aviso }
}
