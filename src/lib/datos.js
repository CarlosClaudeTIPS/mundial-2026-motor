import { db, uuid, ahora, encolar } from './db'
import { evaluar } from './feedback'
import { crearUsuario } from './sesion'

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

export async function crearGrupo({ nombre, docente_id, colegio = '', curso = '', ciclo_id = null }) {
  const g = { id: uuid(), nombre: nombre.trim(), docente_id, colegio, curso, ciclo_id, codigo: codigoGrupo(), creado: ahora(), sincronizado: 0 }
  await db.grupos.add(g)
  await encolar('grupos', g)
  return g
}

export const gruposDe = (docente_id) => db.grupos.where('docente_id').equals(docente_id).toArray()
export const todosLosGrupos = () => db.grupos.toArray()
export const miembrosDe = (grupo_id) => db.usuarios.where('grupo_id').equals(grupo_id).toArray()

export async function agregarEstudiante(grupo, { nombre, usuario, pin }) {
  return crearUsuario({ nombre, usuario, pin, rol: 'estudiante', grupo_id: grupo.id, colegio: grupo.colegio, curso: grupo.curso, ciclo_id: grupo.ciclo_id })
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
  const rec = { id: r.id ?? uuid(), estado: 'pendiente', version: 1, categoria: 'refuerzo', habilidades: [], tipos_error: [], ...r, actualizado: ahora(), sincronizado: 0 }
  await db.recursos.put(rec)
  await encolar('recursos', rec)
  return rec
}

export async function cambiarEstadoRecurso(id, estado, usuario_id) {
  const r = await db.recursos.get(id)
  if (!r) return
  const nuevo = { ...r, estado, aprobado_por: estado === 'aprobado' ? usuario_id : r.aprobado_por, fecha_incorporacion: estado === 'aprobado' ? ahora() : r.fecha_incorporacion, version: (r.version ?? 1) + 1, sincronizado: 0 }
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
