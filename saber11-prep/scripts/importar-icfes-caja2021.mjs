// Importa los "Cuadernillo de preguntas Saber 11.º" de la Caja de herramientas oficial (edición junio 2021:
// 02_PRACTICA_LECTURA.pdf, 04_PRACTICA_MATEMATICAS.pdf, 06_PRACTICA_SOCIALES.pdf, 08_PRACTICA_CIENCIAS.pdf,
// enlazados desde https://www.icfes.gov.co/caja-de-herramientas-saber-11/practica/) a content/importados/<prefijo>.json.
// Variante de importar-icfes.mjs: NO modifica ese script. Diferencias de formato de la edición 2021:
//   - "RESPONDA LA PREGUNTA N / LAS PREGUNTAS N Y M / N A M DE ACUERDO CON LA SIGUIENTE INFORMACIÓN" (en 2026 es RESPONDE)
//   - "Tabla de respuestas correctas" a dos columnas ("1    B         26    C") y sin afirmación/competencia
//   - cabeceras y pies: "Prueba", "<nombre de la prueba>", "Cuadernillo de", "preguntas", "Saber 11.º  N", "2021"
//
// Uso: node scripts/importar-icfes-caja2021.mjs <pdf> --prueba sociales_ciudadanas --prefijo SOCO21 --url <url> --anio 2021 [--sin-duplicados]
//
// --sin-duplicados: descarta (y lista) las preguntas cuyo enunciado + opciones ya existen en content/importados o content/banco.
// Las preguntas quedan con estado "pendiente", sin explicaciones ni competencia (la tabla 2021 no la trae).
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const tax = JSON.parse(readFileSync(join(raiz, 'content/taxonomia.json'), 'utf8'))
const args = process.argv.slice(2)
const archivo = args.find(a => !a.startsWith('--'))
const opt = (k, d = null) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d }
const prueba = opt('prueba'), prefijo = (opt('prefijo') ?? '').toUpperCase(), url = opt('url'), anio = Number(opt('anio')) || null
if (!archivo || !tax.pruebas.some(p => p.id === prueba) || !prefijo || !url) {
  console.error('Uso: node scripts/importar-icfes-caja2021.mjs <pdf> --prueba <id> --prefijo <PREFIJO> --url <url> [--anio 2021] [--sin-duplicados]')
  process.exit(1)
}

// ── Texto por página + páginas con imágenes grandes ──────────────────────────
const texto = execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', archivo, '-'], { maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] }).toString()
const paginas = texto.split('\f')
let paginasConImagen = new Set()
try {
  const lista = execFileSync('pdfimages', ['-list', archivo], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().split('\n').slice(2)
  const porPagina = {}
  for (const l of lista) { const m = /^\s*(\d+)\s+\d+\s+\S+\s+(\d+)\s+(\d+)/.exec(l); if (m) porPagina[m[1]] = Math.max(porPagina[m[1]] ?? 0, Number(m[2]) * Number(m[3])) }
  paginasConImagen = new Set(Object.entries(porPagina).filter(([, a]) => a > 150 * 150).map(([p]) => Number(p)))
} catch {}

const NOMBRES = 'Lectura Crítica|Matemáticas|Sociales y Ciudadanas|Ciencias Naturales|Inglés'
// Cabeceras decorativas de Matemáticas: "Cuadernillo de        y", "preguntas", "Módulo de        x", "z" (ejes de un plano).
const esRuido = (l) => new RegExp(`^(Cuadernillo de preguntas|Cuadernillo de|preguntas|Módulo de|Prueba|Prueba (${NOMBRES})|${NOMBRES}|Saber 11\\.[º°](\\s+\\d{1,3})?|\\d{1,4})(\\s+[xyz])?$|^[xyz]$`, 'i').test(l)

// ── Recorrido ─────────────────────────────────────────────────────────────────
const preguntas = []
let contexto = null, rangoContexto = null, actual = null, opcion = null, enTabla = false, enPreguntas = false
const lineasTabla = []
const limpiar = (t) => t.replace(/\s+/g, ' ').trim()
const cerrarOpcion = () => { if (opcion && actual) { actual.opciones.push({ clave: opcion.clave, texto: limpiar(opcion.texto) }); opcion = null } }
const cerrarPregunta = () => { cerrarOpcion(); if (actual && actual.opciones.length >= 3) preguntas.push(actual); actual = null }

paginas.forEach((pag, idx) => {
  const numPag = idx + 1
  for (const cruda of pag.split('\n')) {
    const l = cruda.trim()
    if (!l || esRuido(l)) continue
    if (/^Tabla de respuestas correctas/i.test(l)) { cerrarPregunta(); enTabla = true; continue }
    if (enTabla) { lineasTabla.push(l); continue }
    const resp = /^RESPOND[AE] LAS? PREGUNTAS? (\d+)(?: (?:A|Y) (\d+))? DE ACUERDO/i.exec(l)
    if (resp) { cerrarPregunta(); enPreguntas = true; rangoContexto = [Number(resp[1]), Number(resp[2] ?? resp[1])]; contexto = { lineas: [], paginas: new Set([numPag]) }; continue }
    if (/^CON LA SIGUIENTE INFORMACI[ÓO]N\.?$/i.test(l)) continue
    const preg = /^Pregunta (\d+)$/i.exec(l)
    if (preg) {
      cerrarPregunta(); enPreguntas = true
      const n = Number(preg[1])
      const enRango = rangoContexto && n >= rangoContexto[0] && n <= rangoContexto[1]
      if (!enRango) { contexto = null; rangoContexto = null }
      actual = { numero: n, enunciado: [], opciones: [], contexto: enRango ? contexto : null, paginas: new Set([numPag]) }
      continue
    }
    if (!enPreguntas) continue // portada, créditos, términos de uso y "¿Qué contiene este cuadernillo?"
    // Solo marcadores sin texto ("A.          B." / "A.   B.   C.   D."): opciones que son figuras.
    if (actual && /^(?:[A-D]\.\s*){2,}$/.test(l)) {
      cerrarOpcion()
      for (const m of l.matchAll(/([A-D])\./g)) actual.opciones.push({ clave: m[1], texto: '' })
      actual.opcionVacia = true; actual.paginas.add(numPag); continue
    }
    // Varias opciones en una línea ("A. 12    B. 12    C. 5    D. 13": fracciones en dos renglones; "A.  Temperatura (°C)   B.  Temperatura (°C)": gráficas) → una por marcador.
    const enLinea = actual && [...l.matchAll(/(?:^|\s{2,})([A-D])\.\s+(\S.*?)(?=\s{2,}[A-D]\.\s|$)/g)]
    if (enLinea && enLinea.length >= 2) {
      cerrarOpcion()
      for (const m of enLinea) actual.opciones.push({ clave: m[1], texto: limpiar(m[2]) })
      actual.enLinea = true; actual.paginas.add(numPag); continue
    }
    // "A." sin texto: la opción es una figura o un bloque en columnas (se marca revisar_estimulo).
    const op = actual && /^([A-D])\.(?:\s+(.*))?$/.exec(l)
    if (op) { cerrarOpcion(); opcion = { clave: op[1], texto: op[2] ?? '' }; if (!op[2]) actual.opcionVacia = true; actual.paginas.add(numPag); continue }
    if (opcion) { opcion.texto += ' ' + l; continue }
    if (actual && actual.opciones.length >= 4) continue // rótulos bajo opciones-figura ("Gas  Líquido …")
    if (actual) { actual.enunciado.push(cruda.replace(/\s+$/, '')); actual.paginas.add(numPag); continue }
    if (contexto) { contexto.lineas.push(cruda.replace(/\s+$/, '')); contexto.paginas.add(numPag) }
  }
})
cerrarPregunta()

// ── Tabla de respuestas a varias columnas: "1    B         26    C" ──────────
const clave = {}
for (const l of lineasTabla) for (const m of l.matchAll(/(\d{1,3})\s+([A-D])(?=\s|$)/g)) clave[Number(m[1])] = m[2]

// ── Salida ────────────────────────────────────────────────────────────────────
const pareceTabla = (t) => /(\S+\s{3,}){3,}\S+/.test(t)
function limpiarParrafos(t) {
  return t.split(/\n\s*\n/).map(b => pareceTabla(b) ? b.replace(/[ \t]+$/gm, '') : limpiar(b)).join('\n\n')
}
const salida = preguntas.map(p => {
  const ctx = p.contexto ? p.contexto.lineas.join('\n').replace(/\n{3,}/g, '\n\n').trim() : null
  const enunciado = p.enunciado.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  const correcta = clave[p.numero] ?? null
  const pags = new Set([...p.paginas, ...(p.contexto ? p.contexto.paginas : [])])
  const conImagen = [...pags].some(n => paginasConImagen.has(n))
  const conTabla = pareceTabla(ctx ?? '') || pareceTabla(enunciado)
  const etiquetas = ['importada', 'icfes']
  if (!correcta) etiquetas.push('sin_clave')
  if (conImagen || conTabla || p.opcionVacia || p.enLinea) etiquetas.push('revisar_estimulo')
  const pagOpc = Math.max(...p.paginas)
  for (const o of p.opciones) if (!o.texto) o.texto = `[Opción ${o.clave}: figura, ver PDF p. ${pagOpc}]`
  const fuenteTexto = /Tomado (y adaptado )?de:?\s*(.+)$/im.exec(ctx ?? enunciado)?.[2]
  return {
    id: `${prefijo}-${String(p.numero).padStart(3, '0')}`,
    prueba, origen: 'oficial',
    fuente: { nombre: `Cuadernillo de preguntas Saber 11.º – Caja de herramientas (ICFES, ${anio ?? 's. f.'})`, url, anio, referencia: `Pregunta ${p.numero}`, ...(fuenteTexto ? { texto_base: limpiar(fuenteTexto) } : {}) },
    competencia: null, componente: null,
    afirmacion: '', evidencia: '', habilidad: 'comprender', tema: '', subtema: '', dificultad: 2,
    contexto: ctx ? limpiarParrafos(ctx) : null, estimulo: null,
    enunciado: limpiarParrafos(enunciado),
    opciones: p.opciones.map(o => ({ clave: o.clave, texto: o.texto, correcta: o.clave === correcta, explicacion: '', tipo_error: o.clave === correcta ? null : 'distractor', diagnostico: o.clave === correcta ? null : 'insuficiente', razon_frecuente: null })),
    explicacion: '', que_identificar: '', que_revisar: '', refuerzo_ids: [], recurso_ids: [], tiempo_sugerido_seg: 120,
    etiquetas, estado: 'pendiente',
  }
})

const dir = join(raiz, 'content/importados')
if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
const ruta = join(dir, `${prefijo.toLowerCase()}.json`)

// --sin-duplicados: misma firma (enunciado + opciones normalizados) que importar-icfes-guia2017.mjs
let final = salida
if (args.includes('--sin-duplicados')) {
  const norm = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
  const firma = (p) => norm(p.enunciado) + '|' + (p.opciones || []).map(o => norm(o.texto)).join('|')
  const existentes = new Map()
  for (const d of ['content/importados', 'content/banco']) {
    if (!existsSync(join(raiz, d))) continue
    for (const f of readdirSync(join(raiz, d)).filter(f => f.endsWith('.json') && join(raiz, d, f) !== ruta)) {
      try { for (const p of JSON.parse(readFileSync(join(raiz, d, f), 'utf8'))) if (p?.enunciado) existentes.set(firma(p), p.id) } catch {}
    }
  }
  const dups = salida.filter(p => existentes.has(firma(p)))
  final = salida.filter(p => !existentes.has(firma(p)))
  if (dups.length) console.log(`  duplicadas (no importadas): ${dups.map(p => `${p.id}=${existentes.get(firma(p))}`).join(', ')}`)
}
writeFileSync(ruta, JSON.stringify(final, null, 2) + '\n', 'utf8')
const n = (f) => final.filter(f).length
console.log(`${final.length} preguntas → ${ruta}`)
console.log(`  con clave: ${n(p => p.opciones.some(o => o.correcta))} · con contexto: ${n(p => p.contexto)} · revisar_estimulo: ${n(p => p.etiquetas.includes('revisar_estimulo'))}`)
const faltan = [...Array(Math.max(...Object.keys(clave).map(Number), 0)).keys()].map(i => i + 1).filter(i => !salida.some(p => p.id.endsWith(String(i).padStart(3, '0'))))
if (faltan.length) console.log(`  no detectadas (revisar a mano): ${faltan.join(', ')}`)
