// Reparte las respuestas correctas entre A, B, C y D en cada archivo del banco.
// Uso: node scripts/balancear-banco.mjs           (solo informa)
//      node scripts/balancear-banco.mjs --aplicar (reescribe los archivos)
//
// Reordena las opciones de una pregunta solo cuando es seguro:
//  - sus textos no mencionan letras sueltas ("la B", "(C)", "A y B", "VERIFICAR: D…"),
//  - y las únicas referencias son de la forma "opción X" / "(opción X)", que se
//    reescriben con la nueva letra.
// Las demás se dejan como están y se listan para revisarlas a mano.
// Además evita que la misma letra se repita 3 veces seguidas dentro de un archivo.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const dirBanco = join(raiz, 'content/banco')
const aplicar = process.argv.includes('--aplicar')
const LETRAS = ['A', 'B', 'C', 'D']

// Campos de texto donde puede aparecer una referencia a la letra de una opción.
const camposPregunta = ['explicacion', 'que_identificar', 'que_revisar', 'enunciado', 'contexto']
const camposOpcion = ['texto', 'explicacion', 'razon_frecuente']
const textosDe = (p) => [...camposPregunta.map(c => p[c]), ...p.opciones.flatMap(o => camposOpcion.map(c => o[c]))].filter(Boolean).map(String)

const RE_OPCION = /\b(opci[oó]n)\s+([A-D])(?![A-Za-zÁÉÍÓÚáéíóúÑñ])/g
// Cualquier otra mención de una letra sola que podría ser una opción (o no: "vitamina A", "poblaciones A y B").
const RE_SUELTA = /(?:\b(?:la|el|respuesta|alternativa|literal|clave|letra)\s+\(?[A-D]\)?(?![A-Za-zÁÉÍÓÚáéíóúÑñ.])|\(\s*[A-D]\s*\)|\b[A-D]\s+[yo]\s+[A-D]\b|VERIFICAR:\s*[A-D]\b|\b[A-D]\)\s)/

function esSegura(p) {
  const textos = textosDe(p)
  if (textos.some(t => RE_SUELTA.test(t))) return false
  if (p.opciones.some(o => /anteriores|above|ninguna de las|todas las/i.test(o.texto))) return false
  return true
}

function reescribirLetras(texto, mapa) {
  return String(texto).replace(RE_OPCION, (m, palabra, letra) => `${palabra} ${mapa[letra] ?? letra}`)
}

// Permutación tal que la correcta queda en `destino` y las demás conservan su orden relativo rotado.
function permutar(p, destino) {
  const n = p.opciones.length
  const viejas = p.opciones.map(o => o.clave)
  const iCorrecta = p.opciones.findIndex(o => o.correcta)
  const iDestino = LETRAS.indexOf(destino)
  const desplazamiento = (iDestino - iCorrecta + n) % n
  const nuevas = Array(n)
  for (let i = 0; i < n; i++) nuevas[(i + desplazamiento) % n] = p.opciones[i]
  const mapa = {}
  nuevas.forEach((o, i) => { mapa[o.clave] = LETRAS[i] })
  const q = { ...p }
  for (const c of camposPregunta) if (q[c]) q[c] = reescribirLetras(q[c], mapa)
  q.opciones = nuevas.map((o, i) => { const r = { ...o, clave: LETRAS[i] }; for (const c of camposOpcion) if (r[c]) r[c] = reescribirLetras(r[c], mapa); return r })
  return { q, viejas: viejas.join(''), nuevas: q.opciones.map(o => o.clave).join('') }
}

const resumen = []
let fijas = []
for (const archivo of readdirSync(dirBanco).filter(f => f.endsWith('.json')).sort()) {
  const ruta = join(dirBanco, archivo)
  const lista = JSON.parse(readFileSync(ruta, 'utf8'))
  const letrasDe = (p) => LETRAS.slice(0, p.opciones.length)
  const antes = {}
  for (const p of lista) { const c = p.opciones.find(o => o.correcta)?.clave; antes[c] = (antes[c] ?? 0) + 1 }

  // Conteo objetivo: las fijas aportan lo suyo; las móviles van a la letra menos usada,
  // evitando repetir la letra de las dos anteriores.
  const conteo = Object.fromEntries(LETRAS.map(l => [l, 0]))
  const movil = lista.map(p => esSegura(p))
  lista.forEach((p, i) => { if (!movil[i]) conteo[p.opciones.find(o => o.correcta).clave]++ })
  const previas = []
  let cambios = 0
  const salida = lista.map((p, i) => {
    const actual = p.opciones.find(o => o.correcta).clave
    if (!movil[i]) { previas.push(actual); fijas.push(`${archivo} · ${p.id}`); return p }
    const posibles = letrasDe(p)
    // Solo cuenta lo que lleva el archivo hasta aquí (más las fijas), para que la secuencia quede pareja.
    const candidatas = [...posibles].sort((a, b) => conteo[a] - conteo[b] || (a === actual ? -1 : b === actual ? 1 : 0))
    let destino = candidatas.find(l => !(previas.length >= 2 && previas.at(-1) === l && previas.at(-2) === l)) ?? candidatas[0]
    conteo[destino]++
    previas.push(destino)
    if (destino === actual) return p
    const { q } = permutar(p, destino)
    cambios++
    return q
  })
  const despues = {}
  for (const p of salida) { const c = p.opciones.find(o => o.correcta)?.clave; despues[c] = (despues[c] ?? 0) + 1 }
  resumen.push({ archivo, preguntas: lista.length, cambiadas: cambios, fijas: movil.filter(m => !m).length, antes: JSON.stringify(antes), despues: JSON.stringify(despues) })
  if (aplicar && cambios) writeFileSync(ruta, formatear(salida), 'utf8')
}

// JSON con sangría de 2, pero con los arreglos de valores simples, las filas de
// tablas, los puntos de las series y `fuente` en una sola línea (como el banco original).
function formatear(lista) {
  const esSimple = (v) => v === null || typeof v !== 'object'
  // En una línea, con espacios después de ":" y ",", sin tocar el interior de las cadenas.
  const linea = (v) => esSimple(v) ? JSON.stringify(v)
    : Array.isArray(v) ? (v.length ? `[${v.map(linea).join(', ')}]` : '[]')
    : (Object.keys(v).length ? `{ ${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${linea(x)}`).join(', ')} }` : '{}')
  const ser = (v, nivel, clave) => {
    const sangria = '  '.repeat(nivel), interna = '  '.repeat(nivel + 1)
    if (esSimple(v)) return JSON.stringify(v)
    if (Array.isArray(v)) {
      if (!v.length) return '[]'
      if (v.every(esSimple) || v.every(x => Array.isArray(x) && x.every(esSimple))) return linea(v)
      return '[\n' + v.map(x => interna + ser(x, nivel + 1, clave)).join(',\n') + '\n' + sangria + ']'
    }
    if (clave === 'fuente' || (clave === 'series' && Object.keys(v).length <= 3)) return linea(v)
    const claves = Object.keys(v)
    if (!claves.length) return '{}'
    return '{\n' + claves.map(k => `${interna}${JSON.stringify(k)}: ${ser(v[k], nivel + 1, k)}`).join(',\n') + '\n' + sangria + '}'
  }
  return ser(lista, 0) + '\n'
}

console.table(resumen)
const total = resumen.reduce((a, r) => a + r.cambiadas, 0)
console.log(`${total} preguntas reordenadas${aplicar ? '' : ' (simulación: usa --aplicar para escribir)'}; ${fijas.length} se dejaron fijas porque sus textos citan letras sueltas:`)
for (const f of fijas) console.log(' -', f)
