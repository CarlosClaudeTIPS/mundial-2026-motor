// Valida todos los archivos content/banco/*.json contra el esquema y la taxonomía.
// Uso: node scripts/validar-banco.mjs   (o: npm run validar-banco)
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const tax = JSON.parse(readFileSync(join(raiz, 'content/taxonomia.json'), 'utf8'))
const dirBanco = join(raiz, 'content/banco')

const ids = (arr) => new Set(arr.map(x => x.id))
const PRUEBAS = ids(tax.pruebas)
const COMPETENCIAS = new Map(tax.competencias.map(c => [c.id, c.prueba]))
const COMPONENTES = new Map(tax.componentes.map(c => [c.id, c.prueba]))
const HABILIDADES = ids(tax.habilidades)
const TIPOS_ERROR = ids(tax.tipos_error)
const ORIGENES = new Set(['oficial', 'estilo', 'generada'])
const ESTADOS = new Set(['borrador', 'pendiente', 'aprobada', 'archivada'])
const DIAG = new Set(['probable', 'insuficiente'])
const ESTIMULOS = new Set(['tabla', 'barras', 'lineas', 'imagen'])

const errores = []
const todosIds = new Map()
const todas = []

function err(archivo, id, msg) { errores.push(`${archivo} · ${id ?? '?'} · ${msg}`) }

for (const archivo of readdirSync(dirBanco).filter(f => f.endsWith('.json'))) {
  let lista
  try { lista = JSON.parse(readFileSync(join(dirBanco, archivo), 'utf8')) }
  catch (e) { err(archivo, null, `JSON inválido: ${e.message}`); continue }
  if (!Array.isArray(lista)) { err(archivo, null, 'el archivo debe ser un arreglo'); continue }

  for (const p of lista) {
    const id = p.id
    if (!id || typeof id !== 'string') { err(archivo, id, 'falta id'); continue }
    if (todosIds.has(id)) err(archivo, id, `id repetido (también en ${todosIds.get(id)})`)
    todosIds.set(id, archivo)
    todas.push(p)

    if (!PRUEBAS.has(p.prueba)) err(archivo, id, `prueba desconocida: ${p.prueba}`)
    if (!ORIGENES.has(p.origen)) err(archivo, id, `origen inválido: ${p.origen}`)
    if (p.origen === 'oficial' && !p.fuente?.url) err(archivo, id, 'una pregunta oficial exige fuente.url')
    if (!p.fuente?.nombre) err(archivo, id, 'falta fuente.nombre')
    if (!COMPETENCIAS.has(p.competencia)) err(archivo, id, `competencia desconocida: ${p.competencia}`)
    else if (COMPETENCIAS.get(p.competencia) !== p.prueba) err(archivo, id, `la competencia ${p.competencia} no pertenece a ${p.prueba}`)
    if (p.componente != null) {
      if (!COMPONENTES.has(p.componente)) err(archivo, id, `componente desconocido: ${p.componente}`)
      else if (COMPONENTES.get(p.componente) !== p.prueba) err(archivo, id, `el componente ${p.componente} no pertenece a ${p.prueba}`)
    }
    if (!HABILIDADES.has(p.habilidad)) err(archivo, id, `habilidad desconocida: ${p.habilidad}`)
    if (![1, 2, 3].includes(p.dificultad)) err(archivo, id, `dificultad debe ser 1, 2 o 3`)
    if (!p.enunciado || p.enunciado.length < 10) err(archivo, id, 'enunciado vacío o muy corto')
    if (!p.explicacion || p.explicacion.length < 40) err(archivo, id, 'explicacion vacía o muy corta')
    if (!p.que_identificar) err(archivo, id, 'falta que_identificar')
    if (!p.que_revisar) err(archivo, id, 'falta que_revisar')
    if (!ESTADOS.has(p.estado)) err(archivo, id, `estado inválido: ${p.estado}`)
    if (typeof p.tiempo_sugerido_seg !== 'number') err(archivo, id, 'tiempo_sugerido_seg debe ser número')
    if (!p.tema) err(archivo, id, 'falta tema')

    if (p.estimulo != null) {
      const e = p.estimulo
      if (!ESTIMULOS.has(e.tipo)) err(archivo, id, `estimulo.tipo inválido: ${e.tipo}`)
      if (e.tipo === 'tabla' && (!Array.isArray(e.columnas) || !Array.isArray(e.filas))) err(archivo, id, 'tabla sin columnas/filas')
      if (e.tipo === 'tabla' && Array.isArray(e.filas) && e.filas.some(f => f.length !== e.columnas.length)) err(archivo, id, 'tabla con filas de distinto tamaño que columnas')
      if ((e.tipo === 'barras' || e.tipo === 'lineas') && !Array.isArray(e.series)) err(archivo, id, 'gráfico sin series')
      if (e.tipo === 'imagen' && !e.alt) err(archivo, id, 'imagen sin alt')
    }

    const ops = p.opciones
    if (!Array.isArray(ops) || ops.length < 3 || ops.length > 4) { err(archivo, id, 'debe tener 3 o 4 opciones'); continue }
    if (ops.length === 3 && p.prueba !== 'ingles') err(archivo, id, 'solo Inglés puede tener 3 opciones')
    const correctas = ops.filter(o => o.correcta === true)
    if (correctas.length !== 1) err(archivo, id, `debe haber exactamente 1 opción correcta (hay ${correctas.length})`)
    const claves = ops.map(o => o.clave).join('')
    if (!['ABC', 'ABCD'].includes(claves)) err(archivo, id, `claves de opciones deben ser A,B,C(,D) en orden; hay ${claves}`)
    for (const o of ops) {
      if (!o.texto) err(archivo, id, `opción ${o.clave} sin texto`)
      if (!o.explicacion || o.explicacion.length < 15) err(archivo, id, `opción ${o.clave} sin explicación suficiente`)
      if (!o.correcta) {
        if (!TIPOS_ERROR.has(o.tipo_error)) err(archivo, id, `opción ${o.clave}: tipo_error desconocido: ${o.tipo_error}`)
        if (!DIAG.has(o.diagnostico)) err(archivo, id, `opción ${o.clave}: diagnostico debe ser probable|insuficiente`)
      }
    }
  }
}

// Referencias de refuerzo
for (const p of todas) {
  for (const r of p.refuerzo_ids ?? []) {
    if (!todosIds.has(r)) err(todosIds.get(p.id), p.id, `refuerzo_ids apunta a ${r}, que no existe`)
    if (r === p.id) err(todosIds.get(p.id), p.id, 'refuerzo_ids se apunta a sí misma')
  }
}

// Distribución de la letra correcta: ninguna letra debe dominar un archivo ni
// repetirse muchas veces seguidas (los estudiantes lo notan y responden por patrón).
// Para repartirlas: node scripts/balancear-banco.mjs --aplicar
const porArchivo = new Map()
for (const p of todas) { const a = todosIds.get(p.id); (porArchivo.get(a) ?? porArchivo.set(a, []).get(a)).push(p) }
for (const [archivo, lista] of porArchivo) {
  const letras = lista.map(p => p.opciones?.find(o => o.correcta)?.clave).filter(Boolean)
  if (letras.length < 8) continue
  const conteo = {}
  for (const l of letras) conteo[l] = (conteo[l] ?? 0) + 1
  const [letra, n] = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0]
  if (n / letras.length > 0.6) err(archivo, null, `la respuesta correcta es "${letra}" en ${n} de ${letras.length} preguntas: reparte las letras`)
  let racha = 1
  for (let i = 1; i < letras.length; i++) { racha = letras[i] === letras[i - 1] ? racha + 1 : 1; if (racha === 5) err(archivo, lista[i].id, `cinco preguntas seguidas con la correcta en "${letras[i]}"`) }
}

// Resumen
const porPrueba = {}
for (const p of todas) porPrueba[p.prueba] = (porPrueba[p.prueba] ?? 0) + 1
console.log('Preguntas por prueba:', porPrueba, '· total:', todas.length)

if (errores.length) {
  console.error(`\n${errores.length} error(es):`)
  for (const e of errores) console.error(' -', e)
  process.exit(1)
} else {
  console.log('Banco válido ✔')
}
