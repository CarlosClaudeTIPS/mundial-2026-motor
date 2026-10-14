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

// Filtros: { prueba, competencia, habilidad, componente, dificultad, tipo_error, excluirIds, estado, usuario }
// `usuario`: si es un estudiante cuyo grupo tiene plan mensual, solo devuelve las preguntas ya liberadas.
export async function listarPreguntas(f = {}) {
  let col = db.preguntas.toCollection()
  if (f.prueba) col = db.preguntas.where('prueba').equals(f.prueba)
  let lista = await col.toArray()
  const estado = f.estado ?? 'aprobada'
  if (estado !== 'todas') lista = lista.filter(p => p.estado === estado)
  if (f.usuario) {
    const { filtrarParaUsuario } = await import('./acceso')
    lista = await filtrarParaUsuario(lista, f.usuario)
  }
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

// Etiqueta que agrupa las preguntas que comparten un mismo texto (texto:LC-T01, texto:ING-T05…).
export const grupoTexto = (p) => (p.etiquetas ?? []).find(e => e.startsWith('texto:')) ?? null

// Ordena de modo que las preguntas de un mismo texto queden juntas y en secuencia,
// como en el examen real (el texto se muestra una vez y las preguntas van seguidas).
export function ordenarPorTexto(lista) {
  const orden = new Map()
  const grupos = new Map()
  for (const p of lista) {
    const g = grupoTexto(p) ?? `solo:${p.id}`
    if (!grupos.has(g)) { grupos.set(g, []); orden.set(g, orden.size) }
    grupos.get(g).push(p)
  }
  const cmp = (a, b) => a.id.localeCompare(b.id, 'es', { numeric: true })
  return [...grupos.entries()].sort((a, b) => orden.get(a[0]) - orden.get(b[0])).flatMap(([, ps]) => ps.sort(cmp))
}

// Elige ~`n` preguntas respetando filtros y evitando repetir las ya vistas cuando se puede.
// Las preguntas de un mismo texto se toman como bloque (todas o ninguna) para no
// presentar sueltas preguntas que dependen de un texto compartido.
export async function elegirPreguntas({ n, vistas = new Set(), ...filtros }) {
  const todas = await listarPreguntas(filtros)
  const bloques = new Map()
  for (const p of todas) { const g = grupoTexto(p) ?? `solo:${p.id}`; (bloques.get(g) ?? bloques.set(g, []).get(g)).push(p) }
  const unidades = [...bloques.values()]
  const nuevas = unidades.filter(u => u.every(p => !vistas.has(p.id)))
  const vistasYa = unidades.filter(u => u.some(p => vistas.has(p.id)))
  const candidatas = [...mezclar(nuevas), ...mezclar(vistasYa)]
  const elegidas = []
  let total = 0
  for (const u of candidatas) {
    if (total >= n) break
    if (total > 0 && total + u.length > n + 1) continue // no desbordar mucho; bloques enteros
    elegidas.push(u); total += u.length
  }
  return ordenarPorTexto(elegidas.flat())
}

// ─── Pregunta de verificación ────────────────────────────────────────────────
// Después de fallar y explicar la razón, el estudiante comprueba con una pregunta
// NUEVA (no la misma): primero las de refuerzo que no haya visto, luego una de la
// misma competencia y habilidad (sin texto compartido, dificultad no mayor, tema
// igual si se puede). Devuelve null si no hay nada nuevo.
export function elegirVerificacion(pregunta, candidatas, vistas = new Set()) {
  const noVista = (p) => p && p.id !== pregunta.id && !vistas.has(p.id)
  const porId = Object.fromEntries(candidatas.map(p => [p.id, p]))
  for (const rid of pregunta.refuerzo_ids ?? []) if (noVista(porId[rid])) return porId[rid]
  const base = candidatas.filter(p => noVista(p) && p.competencia === pregunta.competencia && (p.estado ?? 'aprobada') === 'aprobada' && !grupoTexto(p) && (p.dificultad ?? 2) <= (pregunta.dificultad ?? 2))
  const puntaje = (p) => (p.habilidad === pregunta.habilidad ? 2 : 0) + (p.tema && p.tema === pregunta.tema ? 1 : 0) + (p.dificultad === pregunta.dificultad ? 0.5 : 0)
  const orden = mezclar(base).sort((a, b) => puntaje(b) - puntaje(a))
  if (orden.length) return orden[0]
  // Último recurso: cualquier pregunta no vista de la competencia (aunque tenga texto compartido o sea más difícil)
  const resto = mezclar(candidatas.filter(p => noVista(p) && p.competencia === pregunta.competencia && (p.estado ?? 'aprobada') === 'aprobada'))
  return resto[0] ?? null
}

export async function preguntaVerificacion(pregunta, { vistas = new Set(), usuario = null } = {}) {
  const refuerzos = (await Promise.all((pregunta.refuerzo_ids ?? []).map(obtenerPregunta))).filter(Boolean)
  const mismas = await listarPreguntas({ competencia: pregunta.competencia, usuario })
  return elegirVerificacion(pregunta, [...refuerzos, ...mismas], vistas)
}
