import { db, uuid, ahora, encolar } from './db'
import { evaluar } from './feedback'
import { crearUsuario, claveDePin } from './sesion'
import { supabase, NUBE_DISPONIBLE } from './supabase'
import { sincronizar } from './sync'

// ─── Capa de datos: intentos, grupos, asignaciones, recursos ────────────────
// Todo se escribe primero en IndexedDB y se encola para sincronizar (sync.js).

// ── Intentos ──────────────────────────────────────────────────────────────────
export async function registrarIntento({ estudiante_id, pregunta, clave, tiempo_seg = null, razon = null, modo = 'practica', sesion_id = null, refuerzo_de = null }) {
  const ev = evaluar(pregunta, clave, { tiempoSeg: tiempo_seg, razon })
  const intento = {
    uid: uuid(), estudiante_id, pregunta_id: pregunta.id, prueba: pregunta.prueba,
    competencia: pregunta.competencia, componente: pregunta.componente ?? null, habilidad: pregunta.habilidad,
    dificultad: pregunta.dificultad, opcion: clave ?? null, correcta: ev.esCorrecta,
    tiempo_seg, lento: ev.lento, tipo_error: ev.tipoError, diagnostico: ev.diagnostico,
    razon: razon ? { id: razon.id, texto: razon.texto, tipo_error: razon.tipo_error } : null,
    modo, sesion_id, refuerzo_de, vio_explicacion: false, fecha: ahora(), sincronizado: 0,
  }
  await db.intentos.add(intento)
  await encolar('intentos', intento)
  return { intento, evaluacion: ev }
}

export async function actualizarIntento(uid, cambios) {
  const i = await db.intentos.get(uid)
  if (!i) return null
  const nuevo = { ...i, ...cambios, sincronizado: 0 }
  await db.intentos.put(nuevo)
  await encolar('intentos', nuevo)
  return nuevo
}

// El estudiante explica por qué eligió: se reevalúa el diagnóstico.
export async function explicarIntento(uid, pregunta, razon) {
  const i = await db.intentos.get(uid)
  if (!i) return null
  const ev = evaluar(pregunta, i.opcion, { tiempoSeg: i.tiempo_seg, razon })
  return actualizarIntento(uid, { razon: { id: razon.id, texto: razon.texto, tipo_error: razon.tipo_error }, tipo_error: ev.tipoError, diagnostico: ev.diagnostico })
}

export const intentosDe = (estudiante_id) => db.intentos.where('estudiante_id').equals(estudiante_id).toArray()

export async function intentosDeGrupo(grupo_id) {
  const miembros = await db.usuarios.where('grupo_id').equals(grupo_id).toArray()
  const ids = miembros.map(m => m.id)
  const intentos = await db.intentos.where('estudiante_id').anyOf(ids).toArray()
  return { miembros, intentos }
}

export async function preguntasVistas(estudiante_id) {
  const lista = await db.intentos.where('estudiante_id').equals(estudiante_id).toArray()
  return new Set(lista.map(i => i.pregunta_id))
}

// ── Grupos ────────────────────────────────────────────────────────────────────
function codigoGrupo() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => letras[Math.floor(Math.random() * letras.length)]).join('')
}

export async function crearGrupo({ nombre, docente_id, colegio = '', curso = '', ciclo_id = null, plan = 'completo', plan_inicio = null }) {
  const g = { id: uuid(), nombre: nombre.trim(), docente_id, colegio, curso, ciclo_id, codigo: codigoGrupo(), plan, plan_inicio: plan_inicio ?? ahora(), creado: ahora(), sincronizado: 0 }
  await db.grupos.add(g)
  await encolar('grupos', g)
  await sincronizar() // el grupo debe existir en la nube antes de asignarle estudiantes
  return g
}

// Cambia datos del grupo (plan de acceso, fechas, nombre…) y lo sube a la nube.
export async function actualizarGrupo(id, cambios) {
  const g = await db.grupos.get(id)
  if (!g) throw new Error('Grupo no encontrado')
  const nuevo = { ...g, ...cambios, sincronizado: 0 }
  await db.grupos.put(nuevo)
  await encolar('grupos', nuevo)
  return nuevo
}

// Pasa un estudiante a otro grupo (su historial de respuestas se va con él).
export async function moverEstudiante(estudiante, grupo) {
  const cambios = { grupo_id: grupo.id, colegio: grupo.colegio ?? null, curso: grupo.curso ?? null, ciclo_id: grupo.ciclo_id ?? null }
  if (NUBE_DISPONIBLE) {
    await sincronizar()
    const { error } = await supabase.from('perfiles').update(cambios).eq('id', estudiante.id)
    if (error) throw new Error(error.message)
  }
  await db.usuarios.update(estudiante.id, cambios)
}

export const gruposDe = (docente_id) => db.grupos.where('docente_id').equals(docente_id).toArray()
export const todosLosGrupos = () => db.grupos.toArray()
export const miembrosDe = (grupo_id) => db.usuarios.where('grupo_id').equals(grupo_id).toArray()

export async function agregarEstudiante(grupo, { nombre, usuario, pin }) {
  if (NUBE_DISPONIBLE) {
    const { creados, errores } = await inscribirEnNube(grupo, [{ nombre, usuario, pin }])
    if (errores.length) throw new Error(errores[0])
    return creados[0]
  }
  return crearUsuario({ nombre, usuario, pin, rol: 'estudiante', grupo_id: grupo.id, colegio: grupo.colegio, curso: grupo.curso, ciclo_id: grupo.ciclo_id })
}

// Con nube: se crea la cuenta de Auth de cada estudiante desde el navegador del
// docente con un cliente auxiliar (correo sintético <usuario>@estudiantes.saber11.local
// y PIN como contraseña; requiere "Confirm email" desactivado en Supabase Auth) y
// luego la fila en `perfiles` (política RLS: el docente inserta perfiles de sus grupos).
// No necesita clave secreta en ningún servidor. Límite de Supabase: ~30 registros
// por hora por IP; para grupos grandes, importar en tandas.
const DOMINIO_ESTUDIANTES = 'estudiantes.saber11.local'

async function inscribirEnNube(grupo, estudiantes) {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Inicia sesión en la nube para inscribir estudiantes')
  const { createClient } = await import('@supabase/supabase-js')
  const aux = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const creados = [], errores = []
  for (const e of estudiantes) {
    const usuario = String(e.usuario ?? '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
    const pin = String(e.pin ?? '').trim()
    if (!e.nombre || !usuario || pin.length < 4) { errores.push(`${e.nombre ?? '?'}: datos incompletos (el PIN debe tener al menos 4 dígitos)`); continue }
    const { data: reg, error } = await aux.auth.signUp({ email: `${usuario}@${DOMINIO_ESTUDIANTES}`, password: claveDePin(pin), options: { data: { nombre: e.nombre, rol: 'estudiante' } } })
    if (error || !reg?.user) { errores.push(`${e.nombre}: ${error?.message ?? 'no se creó la cuenta'}`); continue }
    const fila = { id: reg.user.id, rol: 'estudiante', estado: 'activo', nombre: e.nombre, usuario, grupo_id: grupo.id, colegio: grupo.colegio, curso: grupo.curso, ciclo_id: grupo.ciclo_id }
    const { error: errPerfil } = await supabase.from('perfiles').upsert(fila)
    if (errPerfil) { errores.push(`${e.nombre}: cuenta creada pero sin perfil (${errPerfil.message})`); continue }
    await db.usuarios.put({ ...fila, sincronizado: 1 })
    creados.push({ ...fila, pin })
  }
  return { creados, errores }
}

// Importación por texto: una línea por estudiante "Nombre Apellido; usuario; pin"
// (el usuario y el pin son opcionales: se generan a partir del nombre).
export async function importarEstudiantes(grupo, texto) {
  const filas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const creados = [], errores = []
  for (const fila of filas) {
    const [nombre, usuario, pin] = fila.split(/[;,\t]/).map(s => (s ?? '').trim())
    if (!nombre) continue
    const handle = usuario || generarHandle(nombre)
    const pinFinal = pin || String(1000 + Math.floor(Math.random() * 9000))
    try {
      const u = await agregarEstudiante(grupo, { nombre, usuario: handle, pin: pinFinal })
      creados.push({ ...u, pin: pinFinal })
    } catch (e) { errores.push(`${nombre}: ${e.message}`) }
  }
  return { creados, errores }
}

function generarHandle(nombre) {
  const partes = nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/\s+/)
  const base = (partes[0] ?? 'est') + '.' + (partes[1] ?? '') + Math.floor(Math.random() * 90 + 10)
  return base.replace(/[^a-z0-9.]/g, '')
}

// ── Asignaciones ──────────────────────────────────────────────────────────────
export async function crearAsignacion({ grupo_id, docente_id, tipo, titulo, config = {}, fecha_limite = null, nota = '' }) {
  const a = { id: uuid(), grupo_id, docente_id, tipo, titulo, config, nota, fecha_limite, fecha_creacion: ahora(), estado: 'activa', sincronizado: 0 }
  await db.asignaciones.add(a)
  await encolar('asignaciones', a)
  return a
}

export const asignacionesDeGrupo = (grupo_id) => db.asignaciones.where('grupo_id').equals(grupo_id).reverse().sortBy('fecha_creacion')

export async function asignacionesPendientes(estudiante) {
  if (!estudiante.grupo_id) return []
  const lista = await db.asignaciones.where('grupo_id').equals(estudiante.grupo_id).toArray()
  const hechas = await db.sesiones.where('estudiante_id').equals(estudiante.id).toArray()
  const hechasIds = new Set(hechas.filter(s => s.estado === 'terminada').map(s => s.asignacion_id))
  return lista.filter(a => a.estado === 'activa' && !hechasIds.has(a.id)).sort((a, b) => (a.fecha_creacion < b.fecha_creacion ? 1 : -1))
}

// ── Recursos (biblioteca) ─────────────────────────────────────────────────────
export async function guardarRecurso(r) {
  const rec = { id: r.id ?? uuid(), estado: 'pendiente', version: 1, categoria: 'refuerzo', habilidades: [], tipos_error: [], ...r, editado_local: true, actualizado: ahora(), sincronizado: 0 }
  await db.recursos.put(rec)
  await encolar('recursos', rec)
  return rec
}

export async function cambiarEstadoRecurso(id, estado, usuario_id) {
  const r = await db.recursos.get(id)
  if (!r) return
  const nuevo = { ...r, estado, aprobado_por: estado === 'aprobado' ? usuario_id : r.aprobado_por, fecha_incorporacion: estado === 'aprobado' ? ahora() : r.fecha_incorporacion, version: (r.version ?? 1) + 1, editado_local: true, sincronizado: 0 }
  await db.recursos.put(nuevo)
  await encolar('recursos', nuevo)
}

export const listarRecursos = async (f = {}) => {
  let lista = await db.recursos.toArray()
  if (f.estado) lista = lista.filter(r => r.estado === f.estado)
  if (f.prueba) lista = lista.filter(r => r.prueba === f.prueba)
  if (f.tipo_error) lista = lista.filter(r => (r.tipos_error ?? []).includes(f.tipo_error))
  if (f.habilidad) lista = lista.filter(r => (r.habilidades ?? []).includes(f.habilidad))
  return lista.sort((a, b) => (a.categoria === 'esencial' ? -1 : 1) - (b.categoria === 'esencial' ? -1 : 1))
}

// Recurso recomendado tras un error: por tipo de error y prueba, luego por habilidad.
export async function recursoParaError({ prueba, tipo_error, habilidad }) {
  const aprobados = await listarRecursos({ estado: 'aprobado' })
  return aprobados.find(r => r.prueba === prueba && (r.tipos_error ?? []).includes(tipo_error))
    ?? aprobados.find(r => (r.tipos_error ?? []).includes(tipo_error))
    ?? aprobados.find(r => r.prueba === prueba && (r.habilidades ?? []).includes(habilidad))
    ?? null
}

// ── Sesiones del docente (cada ~21 días) ──────────────────────────────────────
// Snapshot del periodo desde la sesión anterior: errores frecuentes, habilidades
// débiles, acciones sugeridas, preguntas más falladas y recursos relacionados.
export const sesionesDocenteDe = (grupo_id) => db.sesiones_docente.where('grupo_id').equals(grupo_id).reverse().sortBy('fecha')

export async function prepararSesionDocente({ grupo, docente_id, resumenGrupoFn, estadisticasPreguntasFn, preguntasPorId }) {
  const previas = await sesionesDocenteDe(grupo.id)
  const desde = previas[0]?.fecha ? new Date(previas[0].fecha + 'T00:00:00') : new Date(Date.now() - 21 * 86400000)
  const { miembros, intentos } = await intentosDeGrupo(grupo.id)
  const periodo = intentos.filter(i => new Date(i.fecha) >= desde)
  const r = resumenGrupoFn(miembros, periodo, preguntasPorId)
  const preguntas = estadisticasPreguntasFn(periodo, preguntasPorId).filter(q => q.total >= 2 && (q.precision ?? 100) < 60).slice(0, 5)
  const tiposTop = r.erroresFrecuentes.slice(0, 3).map(e => e.id)
  const recursos = (await listarRecursos({ estado: 'aprobado' })).filter(rec => (rec.tipos_error ?? []).some(t => tiposTop.includes(t))).slice(0, 4)
  return {
    id: uuid(), grupo_id: grupo.id, docente_id, fecha: new Date().toISOString().slice(0, 10),
    titulo: `Sesión ${previas.length + 1} · ${grupo.nombre}`, notas: '',
    resumen: {
      periodo_inicio: desde.toISOString().slice(0, 10), n_intentos: periodo.length, n_activos: r.n_activos, promedio: r.promedio,
      errores_frecuentes: r.erroresFrecuentes.slice(0, 5), habilidades_debiles: r.habilidades.filter(h => h.total >= 5 && h.precision < 60).slice(0, 3),
      acciones: r.acciones, preguntas_recomendadas: preguntas.map(q => ({ id: q.id, precision: q.precision, distractor: q.distractor })),
      recursos: recursos.map(x => ({ id: x.id, titulo: x.titulo })), con_dificultad: r.conDificultad.map(e => e.nombre),
    },
    creada: ahora(), sincronizado: 0,
  }
}

export async function guardarSesionDocente(s) {
  await db.sesiones_docente.put(s)
  await encolar('sesiones_docente', s)
  return s
}

// ── Resultados en papel ───────────────────────────────────────────────────────
// El docente registra las respuestas de una prueba impresa: "usuario: A B C D ..."
export async function registrarPapel({ estudiante_id, preguntas, claves, sesion_id = null }) {
  const out = []
  for (let i = 0; i < preguntas.length; i++) {
    const clave = (claves[i] ?? '').toUpperCase() || null
    out.push(await registrarIntento({ estudiante_id, pregunta: preguntas[i], clave, modo: 'papel', sesion_id }))
  }
  return out
}
