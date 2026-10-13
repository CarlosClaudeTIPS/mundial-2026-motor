import { db } from './db'

// ─── Plan de acceso al banco por grupo ───────────────────────────────────────
// Cada grupo tiene un plan:
//  - "completo": sus estudiantes ven todo el banco aprobado.
//  - "mensual": cada mes se le libera un lote nuevo de LOTE_MENSUAL preguntas
//    POR CADA PRUEBA (500 en total con el valor por defecto), acumulando lo
//    anterior y sin repetir. El lote se calcula de forma determinista a partir del orden
//    del banco (por prueba: primero las propias por número de id, luego las
//    oficiales), así no hace falta guardar nada y funciona sin conexión.
//    Las preguntas nuevas que se agreguen al banco quedan al final del orden,
//    de modo que lo ya liberado no cambia.

export const PLANES = {
  completo: { id: 'completo', nombre: 'Completo', descripcion: 'Acceso a todo el banco desde el primer día.' },
  mensual: { id: 'mensual', nombre: 'Mensual', descripcion: 'Cada mes se liberan 100 preguntas nuevas por asignatura (500 en total), acumulando las anteriores.' },
}
export const LOTE_MENSUAL = 100 // por prueba y por mes
export const PRUEBAS = ['lectura_critica', 'matematicas', 'sociales_ciudadanas', 'ciencias_naturales', 'ingles']

// Meses completos transcurridos entre dos fechas (0 el primer mes).
export function mesesTranscurridos(inicio, hoy = new Date()) {
  const a = new Date(inicio), b = new Date(hoy)
  if (isNaN(a) || b < a) return 0
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  if (b.getDate() < a.getDate()) m--
  return Math.max(0, m)
}

// Fecha en que se libera el lote número n (n = 1 es el inicio).
export function fechaLote(inicio, n) {
  const d = new Date(inicio)
  const dia = d.getDate()
  d.setDate(1); d.setMonth(d.getMonth() + (n - 1))
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(dia, ultimo))
  return d
}

const numeroId = (id) => { const n = parseInt(String(id).split('-').pop(), 10); return Number.isFinite(n) ? n : 0 }
// Orden de liberación dentro de una prueba: propias por número, luego oficiales por id.
const ordenar = (a, b) => (a.origen === 'oficial') - (b.origen === 'oficial') || numeroId(a.id) - numeroId(b.id) || (a.id < b.id ? -1 : 1)

// Estado de liberación para un grupo: null si ve todo.
export function estadoLiberacion(preguntas, grupo, hoy = new Date()) {
  if (!grupo || grupo.plan !== 'mensual') return null
  const inicio = grupo.plan_inicio ?? grupo.creado ?? hoy
  const lote = Number(grupo.plan_lote) || LOTE_MENSUAL
  const cupo = Math.max(1, lote) // preguntas por prueba y por mes
  const meses = mesesTranscurridos(inicio, hoy)
  const liberadas = new Set(), nuevas = new Set()
  let total = 0, agotado = true
  for (const prueba of PRUEBAS) {
    const lista = preguntas.filter(p => p.prueba === prueba && (p.estado ?? 'aprobada') === 'aprobada').sort(ordenar)
    total += lista.length
    const hasta = (meses + 1) * cupo
    lista.slice(0, hasta).forEach(p => liberadas.add(p.id))
    lista.slice(meses * cupo, hasta).forEach(p => nuevas.add(p.id))
    if (lista.length > hasta) agotado = false
  }
  return {
    plan: 'mensual', meses, lote, lote_total: cupo * PRUEBAS.length, inicio: new Date(inicio), liberadas, nuevas, total,
    proximo: agotado ? null : fechaLote(inicio, meses + 2),
    agotado,
  }
}

// Ids liberados para un grupo (null = sin restricción).
export function idsLiberados(preguntas, grupo, hoy = new Date()) {
  const e = estadoLiberacion(preguntas, grupo, hoy)
  return e ? e.liberadas : null
}

// Filtra una lista de preguntas según el usuario (solo estudiantes con grupo en plan mensual).
export async function filtrarParaUsuario(preguntas, usuario) {
  if (!usuario || usuario.rol !== 'estudiante' || !usuario.grupo_id) return preguntas
  const grupo = await db.grupos.get(usuario.grupo_id)
  const ids = idsLiberados(preguntas, grupo)
  return ids ? preguntas.filter(p => ids.has(p.id)) : preguntas
}

export const grupoDe = (usuario) => (usuario?.grupo_id ? db.grupos.get(usuario.grupo_id) : Promise.resolve(null))
