import catalogo from '../../content/carreras.json'
import { db } from './db'
import { supabase, NUBE_DISPONIBLE } from './supabase'
import { refrescarUsuario } from './sesion'

// ─── Modo carrera ────────────────────────────────────────────────────────────
// El estudiante elige hasta 3 carreras que le gustan. Con eso se calcula qué
// pruebas pesan más para él y la app prioriza (orden de materias, práctica
// enfocada, distribución de horas en la ruta). La meta sigue siendo subir
// las cinco pruebas: ninguna materia desaparece, solo cambia la proporción.

export const PRUEBAS = catalogo.pruebas
export const AREAS = catalogo.areas
export const CARRERAS = AREAS.flatMap(a => a.carreras.map(c => ({ ...c, area: a.id, area_nombre: a.nombre })))
const porId = Object.fromEntries(CARRERAS.map(c => [c.id, c]))
export const carreraPorId = (id) => porId[id] ?? null
export const MAX_CARRERAS = 3

// Proporción de práctica por nivel de peso. Con las cinco en nivel base la
// mezcla es uniforme (20 % cada una); una prueba "fundamental" recibe el doble
// de práctica que una "base".
const FACTOR = { 1: 1, 2: 1.5, 3: 2 }

// Prioridades a partir de las carreras elegidas.
// Devuelve [{ prueba, peso (1-3), nivel: 'alta'|'media'|'base', proporcion (0-1), orden }]
// ordenadas de mayor a menor peso (y, a igualdad, en el orden oficial de las pruebas).
export function prioridadesDe(ids = []) {
  const carreras = (ids ?? []).map(carreraPorId).filter(Boolean)
  const filas = PRUEBAS.map((prueba, i) => {
    // Peso = promedio entre el máximo (si una carrera la necesita, cuenta) y la
    // media de las carreras elegidas (fundamental en las tres pesa más que en una).
    // Con carreras muy distintas entre sí, las prioridades se aplanan: es normal.
    const pesos = carreras.map(c => c.pesos[prueba] ?? 1)
    const max = pesos.length ? Math.max(...pesos) : 1
    const prom = pesos.length ? pesos.reduce((a, b) => a + b, 0) / pesos.length : 1
    const peso = pesos.length ? Math.round(((max + prom) / 2) * 100) / 100 : 1
    return { prueba, peso, nivel: peso >= 2.5 ? 'alta' : peso >= 1.75 ? 'media' : 'base', orden_oficial: i }
  })
  const factorDe = (f) => FACTOR[f.nivel === 'alta' ? 3 : f.nivel === 'media' ? 2 : 1]
  const suma = filas.reduce((a, f) => a + factorDe(f), 0)
  for (const f of filas) f.proporcion = factorDe(f) / suma
  return filas.sort((a, b) => b.peso - a.peso || a.orden_oficial - b.orden_oficial).map((f, i) => ({ ...f, orden: i }))
}

// ¿Tiene el estudiante el modo carrera activo (con carreras elegidas)?
export const modoCarreraActivo = (usuario) => Boolean(usuario?.modo_carrera && (usuario.carreras ?? []).length)

// Prioridades de un usuario: las de sus carreras si el modo está activo; si no, todas base (orden oficial).
export const prioridadesDeUsuario = (usuario) => modoCarreraActivo(usuario) ? prioridadesDe(usuario.carreras) : prioridadesDe([])

// Reparte n preguntas entre las pruebas según la proporción, garantizando al
// menos 1 por prueba cuando n ≥ 5 (todo en 100: ninguna materia queda fuera).
export function mezclaPorPrueba(prioridades, n) {
  const reparto = {}
  if (n <= 0) return reparto
  // Parte proporcional redondeada hacia abajo; el resto, a las de mayor parte fraccionaria (y mayor peso).
  const filas = prioridades.map(p => { const exacto = p.proporcion * n; const k = Math.floor(exacto); return { prueba: p.prueba, k, resto: exacto - k, peso: p.peso } })
  let restante = n - filas.reduce((a, f) => a + f.k, 0)
  for (const f of [...filas].sort((a, b) => b.resto - a.resto || b.peso - a.peso)) { if (restante <= 0) break; f.k += 1; restante-- }
  // Todo en 100: con n ≥ 5 ninguna prueba queda en cero; se toma de la que más tiene.
  if (n >= filas.length) for (const f of filas) if (f.k === 0) { const mayor = filas.reduce((a, b) => (b.k > a.k ? b : a)); mayor.k -= 1; f.k = 1 }
  for (const f of filas) reparto[f.prueba] = f.k
  return reparto
}

// Tiempo semanal sugerido por prueba (en minutos, de 5 en 5) a partir de las horas de práctica autónoma del programa.
export function horasPorPrueba(prioridades, horasSemana) {
  return prioridades.map(p => ({ ...p, minutos: Math.round(p.proporcion * horasSemana * 60 / 5) * 5 }))
}

export function formatoMinutos(min) {
  const h = Math.floor(min / 60), m = min % 60
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`
}

export const NOMBRE_NIVEL = { alta: 'Prioridad alta', media: 'Prioridad media', base: 'Base' }

// Guarda carreras y modo. En nube el estudiante no puede editar su perfil
// (política de migración 002), así que va por la función guardar_carreras.
export async function guardarCarreras(usuario, { carreras = [], modo_carrera = false }) {
  const limpias = [...new Set((carreras ?? []).filter(id => porId[id]))].slice(0, MAX_CARRERAS)
  const cambios = { carreras: limpias, modo_carrera: Boolean(modo_carrera && limpias.length), carreras_definidas: true }
  let aviso = null
  if (NUBE_DISPONIBLE && !usuario.previsualizacion) {
    const { error } = await supabase.rpc('guardar_carreras', { p_carreras: cambios.carreras, p_modo: cambios.modo_carrera })
    // Si la nube aún no tiene la migración 003 (función inexistente) se guarda solo en este
    // dispositivo y se avisa; cualquier otro error sí se reporta.
    if (error && /guardar_carreras|function|schema cache/i.test(error.message)) aviso = 'Tus carreras quedaron guardadas en este dispositivo. La nube todavía no tiene esta función: avísale a tu docente.'
    else if (error) throw new Error('No se pudieron guardar tus carreras: ' + error.message)
  }
  await db.usuarios.update(usuario.id, cambios)
  await refrescarUsuario()
  return { ...cambios, aviso }
}
