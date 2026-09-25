import programaBase from '../../content/programa.json'
import estructuraBase from '../../content/estructura-examen.json'
import { db, getConfig } from './db'

// ─── Motor de ciclos ─────────────────────────────────────────────────────────
// Un ciclo = una preparación de ~6 meses hacia una fecha de examen concreta.
// Calendario B → examen en el primer semestre (marzo). Calendario A → segundo
// semestre (julio/agosto). El mismo programa y el mismo banco sirven para ambos.

const DIA = 86400000

// Fechas de referencia OFICIALES conocidas (aplicación del examen).
export const FECHAS_REFERENCIA = [
  { anio: 2025, calendario: 'B', fecha: '2025-04-06', oficial: true },
  { anio: 2026, calendario: 'B', fecha: '2026-03-15', oficial: true },
  { anio: 2026, calendario: 'A', fecha: '2026-07-26', oficial: true },
  // 2027: el ICFES no había publicado el cronograma al 25-sep-2026. Estimación a
  // partir del patrón de años anteriores (sitios secundarios proyectan B 2027 = 14-mar-2027).
  { anio: 2027, calendario: 'B', fecha: '2027-03-14', oficial: false },
  { anio: 2027, calendario: 'A', fecha: '2027-07-25', oficial: false },
]

export function ciclosPorDefecto() {
  return FECHAS_REFERENCIA.filter(f => f.anio >= 2027).map(f => {
    const examen = new Date(f.fecha + 'T00:00:00')
    const inicio = new Date(examen.getTime() - programaBase.semanas_totales * 7 * DIA)
    return {
      id: `saber11-${f.calendario}-${f.anio}`,
      nombre: `Saber 11° Calendario ${f.calendario} ${f.anio}`,
      calendario: f.calendario,
      anio: f.anio,
      fecha_inicio: inicio.toISOString().slice(0, 10),
      fecha_examen: f.fecha,
      fecha_provisional: !f.oficial,
      semanas: programaBase.semanas_totales,
      activo: f.calendario === 'B',
    }
  })
}

export async function asegurarCiclos() {
  if ((await db.ciclos.count()) === 0) await db.ciclos.bulkPut(ciclosPorDefecto())
}

export const listarCiclos = () => db.ciclos.toArray()
export const guardarCiclo = (c) => db.ciclos.put(c)

export async function cicloActivo() {
  const todos = await db.ciclos.toArray()
  return todos.find(c => c.activo) ?? todos[0] ?? null
}

export async function programa() {
  return (await getConfig('programa')) ?? programaBase
}

export async function estructuraExamen() {
  return (await getConfig('estructura_examen')) ?? estructuraBase
}

// Estado del ciclo en una fecha dada: semana actual, fase, tiempo restante.
export function estadoCiclo(ciclo, prog = programaBase, hoy = new Date()) {
  if (!ciclo) return null
  const inicio = new Date(ciclo.fecha_inicio + 'T00:00:00')
  const examen = new Date(ciclo.fecha_examen + 'T00:00:00')
  const h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const semanasTotales = Math.max(1, Math.round((examen - inicio) / (7 * DIA)))
  const diasTranscurridos = Math.floor((h - inicio) / DIA)
  const semanaActual = Math.min(semanasTotales, Math.max(0, Math.floor(diasTranscurridos / 7) + 1))
  const diasRestantes = Math.ceil((examen - h) / DIA)
  const semanasRestantes = Math.max(0, Math.ceil(diasRestantes / 7))

  // Las fases del programa se escalan proporcionalmente si el ciclo no dura exactamente 24 semanas.
  const factor = semanasTotales / prog.semanas_totales
  const fases = prog.fases.map(f => ({
    ...f,
    semana_inicio: Math.max(1, Math.round((f.semanas[0] - 1) * factor) + 1),
    semana_fin: Math.min(semanasTotales, Math.round(f.semanas[1] * factor)),
  }))
  const fase = fases.find(f => semanaActual >= f.semana_inicio && semanaActual <= f.semana_fin)
    ?? (semanaActual < 1 ? null : fases[fases.length - 1])

  let estado = 'en_curso'
  if (diasTranscurridos < 0) estado = 'no_iniciado'
  else if (diasRestantes < 0) estado = 'terminado'
  else if (diasRestantes === 0) estado = 'dia_examen'

  return {
    estado, semanaActual, semanasTotales, semanasRestantes, diasRestantes, diasTranscurridos,
    fase, fases,
    progreso: Math.min(1, Math.max(0, diasTranscurridos / Math.max(1, (examen - inicio) / DIA))),
    simulacrosRecomendados: fases.filter(f => f.simulacro).map(f => ({ fase: f.nombre, semana_fin: f.semana_fin, ...f.simulacro })),
  }
}

export function formatoFecha(iso) {
  if (!iso) return ''
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso)
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
}
