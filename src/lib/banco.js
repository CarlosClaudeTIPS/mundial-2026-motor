import { db, ahora, encolar } from './db'

// ─── Banco de preguntas ──────────────────────────────────────────────────────
// Los archivos content/banco/*.json se empaquetan con la app y se cargan en
// IndexedDB la primera vez (y cada vez que cambia su contenido). Así el banco
// está disponible sin conexión. Preguntas creadas o editadas en la app quedan
// marcadas con `editada_local` y no se sobreescriben con la semilla.
const archivos = import.meta.glob('../../content/banco/*.json', { eager: true, import: 'default' })

export function preguntasSemilla() {
  return Object.values(archivos).flat()
}

function huella(texto) {
  let h = 0
  for (let i = 0; i < texto.length; i++) h = (Math.imul(31, h) + texto.charCodeAt(i)) | 0
  return String(h)
}

export async function sembrarBanco() {
  const lista = preguntasSemilla()
  const version = huella(JSON.stringify(lista))
  const previa = await db.config.get('banco_version')
  if (previa?.valor === version) return { cargadas: 0, total: await db.preguntas.count() }

  let cargadas = 0
  await db.transaction('rw', db.preguntas, db.config, async () => {
    for (const p of lista) {
      const existente = await db.preguntas.get(p.id)
      if (existente?.editada_local) continue
      await db.preguntas.put({ ...p, semilla: true, fecha_carga: ahora() })
      cargadas++
    }
    await db.config.put({ clave: 'banco_version', valor: version })
  })
  return { cargadas, total: await db.preguntas.count() }
}

// Filtros: { prueba, competencia, habilidad, componente, dificultad, tipo_error, excluirIds, estado }
export async function listarPreguntas(f = {}) {
  let col = db.preguntas.toCollection()
  if (f.prueba) col = db.preguntas.where('prueba').equals(f.prueba)
  let lista = await col.toArray()
  const estado = f.estado ?? 'aprobada'
  if (estado !== 'todas') lista = lista.filter(p => p.estado === estado)
  if (f.competencia) lista = lista.filter(p => p.competencia === f.competencia)
  if (f.habilidad) lista = lista.filter(p => p.habilidad === f.habilidad)
  if (f.componente) lista = lista.filter(p => p.componente === f.componente)
  if (f.dificultad) lista = lista.filter(p => p.dificultad === Number(f.dificultad))
  if (f.tema) lista = lista.filter(p => p.tema === f.tema)
  if (f.tipo_error) lista = lista.filter(p => p.opciones.some(o => o.tipo_error === f.tipo_error))
  if (f.excluirIds?.length) { const ex = new Set(f.excluirIds); lista = lista.filter(p => !ex.has(p.id)) }
  if (f.buscar) {
    const q = f.buscar.toLowerCase()
    lista = lista.filter(p => [p.id, p.enunciado, p.tema, p.subtema, p.contexto ?? ''].join(' ').toLowerCase().includes(q))
  }
  return lista
}

export const obtenerPregunta = (id) => db.preguntas.get(id)

export async function guardarPregunta(p) {
  const fila = { ...p, editada_local: true, fecha_edicion: ahora() }
  await db.preguntas.put(fila)
  await encolar('preguntas', fila)
}

export function mezclar(arr, semilla = Date.now()) {
  // Fisher-Yates con generador determinista (para reproducir una prueba)
  let s = semilla >>> 0 || 1
  const rnd = () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296 }
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

// Elige `n` preguntas respetando filtros y evitando repetir las ya vistas cuando se puede.
export async function elegirPreguntas({ n, vistas = new Set(), ...filtros }) {
  const todas = await listarPreguntas(filtros)
  const nuevas = todas.filter(p => !vistas.has(p.id))
  const base = nuevas.length >= n ? nuevas : [...nuevas, ...mezclar(todas.filter(p => vistas.has(p.id)))]
  return mezclar(base).slice(0, n)
}
