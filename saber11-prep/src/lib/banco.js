import { db, ahora, encolar } from './db'

// ─── Banco de preguntas ──────────────────────────────────────────────────────
// Los archivos content/banco/*.json se publican como archivos aparte (con hash
// en el nombre) y se descargan SOLO cuando hay que sembrar IndexedDB: la primera
// vez y cada vez que cambia su contenido. Así la app arranca liviana y el banco
// sigue disponible sin conexión desde IndexedDB. Preguntas creadas o editadas en
// la app quedan marcadas con `editada_local` y no se sobreescriben con la semilla.
const urls = import.meta.glob('../../content/banco/*.json', { eager: true, query: '?url', import: 'default' })

export async function preguntasSemilla() {
  const listas = await Promise.all(Object.values(urls).map(u => fetch(u).then(r => {
    if (!r.ok) throw new Error(`No se pudo cargar el banco: ${u}`)
    return r.json()
  })))
  return listas.flat()
}

// Conteo de preguntas aprobadas por prueba, leído de IndexedDB (para la portada).
export async function contarPorPrueba() {
  const c = {}
  await db.preguntas.each(p => { if (p.estado === 'aprobada' || !p.estado) c[p.prueba] = (c[p.prueba] ?? 0) + 1 })
  return c
}

function huella(texto) {
  let h = 0
  for (let i = 0; i < texto.length; i++) h = (Math.imul(31, h) + texto.charCodeAt(i)) | 0
  return String(h)
}

export async function sembrarBanco() {
  // En producción los nombres de archivo llevan hash de contenido: basta con
  // ellos para saber si el banco cambió, sin descargar nada. En desarrollo no
  // hay hash, así que se descarga y se compara el contenido.
  const previa = await db.config.get('banco_version')
  let version = huella(JSON.stringify(Object.values(urls).sort()))
  let lista = null
  if (import.meta.env.DEV) { lista = await preguntasSemilla(); version = huella(JSON.stringify(lista)) }
  if (previa?.valor === version) return { cargadas: 0, total: await db.preguntas.count() }
  lista ??= await preguntasSemilla()

  let cargadas = 0
  await db.transaction('rw', db.preguntas, db.config, async () => {
    const editadas = new Set(await db.preguntas.filter(p => !!p.editada_local).primaryKeys())
    const fecha = ahora()
    const nuevas = lista.filter(p => !editadas.has(p.id)).map(p => ({ ...p, semilla: true, fecha_carga: fecha }))
    await db.preguntas.bulkPut(nuevas)
    cargadas = nuevas.length
    await db.config.put({ clave: 'banco_version', valor: version })
  })
  return { cargadas, total: await db.preguntas.count() }
}

// Siembra en segundo plano (no bloquea la pantalla de entrada). Quien necesite
// el banco completo espera `iniciarSiembra()`.
let bancoListo = null
export function iniciarSiembra() { bancoListo ??= sembrarBanco(); return bancoListo }

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
