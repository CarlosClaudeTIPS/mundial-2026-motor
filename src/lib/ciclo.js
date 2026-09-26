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
      // Pausas: semanas que no cuentan para el programa (vacaciones). Ajustar al calendario del colegio.
      pausas: f.calendario === 'B'
        ? [{ nombre: 'Vacaciones de fin de año (ajustar al calendario del colegio)', inicio: `${f.anio - 1}-12-18`, fin: `${f.anio}-01-10` }]
        : [],
    }
  })
}

const fechaLocal = (iso) => new Date(iso + 'T00:00:00')

// Semanas del ciclo (lunes a domingo desde la fecha de inicio) marcando cuáles caen en pausa.
export function semanasDelCiclo(ciclo) {
  const inicio = fechaLocal(ciclo.fecha_inicio)
  const examen = fechaLocal(ciclo.fecha_examen)
  const pausas = (ciclo.pausas ?? []).map(p => ({ ...p, ini: fechaLocal(p.inicio), fin: fechaLocal(p.fin) }))
  const semanas = []
  let numero = 0
  for (let t = inicio.getTime(); t < examen.getTime() + DIA; t += 7 * DIA) {
    const desde = new Date(t), hasta = new Date(t + 6 * DIA)
    // Una semana es de pausa si al menos 4 de sus 7 días caen dentro de alguna pausa.
    let diasPausa = 0
    for (let d = 0; d < 7; d++) {
      const dia = t + d * DIA
      if (pausas.some(p => dia >= p.ini.getTime() && dia <= p.fin.getTime())) diasPausa++
    }
    const pausa = diasPausa >= 4 ? pausas.find(p => hasta >= p.ini && desde <= p.fin) : null
    if (!pausa) numero++
    semanas.push({ desde, hasta, pausa: pausa ? pausa.nombre : null, numero: pausa ? null : numero })
  }
  return semanas
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
  const semanas = semanasDelCiclo(ciclo)
  const semanasTotales = Math.max(1, semanas.filter(s => !s.pausa).length)
  const diasTranscurridos = Math.floor((h - inicio) / DIA)
  const semanaHoy = semanas.find(s => h >= s.desde && h <= s.hasta) ?? null
  const enPausa = !!semanaHoy?.pausa
  // Semana del programa: cuenta solo semanas sin pausa; durante una pausa se mantiene la última cumplida.
  let semanaActual = 0
  if (diasTranscurridos >= 0) {
    const cumplidas = semanas.filter(s => !s.pausa && s.desde <= h)
    semanaActual = Math.min(semanasTotales, cumplidas.length)
  }
  const diasRestantes = Math.ceil((examen - h) / DIA)
  const semanasRestantes = Math.max(0, semanas.filter(s => !s.pausa && s.hasta >= h).length)

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
  else if (enPausa) estado = 'pausa'

  return {
    estado, semanaActual, semanasTotales, semanasRestantes, diasRestantes, diasTranscurridos,
    enPausa, pausaActual: semanaHoy?.pausa ?? null, semanas,
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
