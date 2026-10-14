// Importa los "Ejemplos de preguntas explicadas" de la Caja de herramientas oficial Saber 11.º (PDF de 3 páginas por
// prueba: 01_EXPLICADAS_LECTURA.pdf, 03_EXPLICADAS_MATEMATICAS.pdf, 05_EXPLICADAS_SOCIALES.pdf, 07_EXPLICADAS_CIENCIAS.pdf,
// enlazados desde https://www.icfes.gov.co/caja-de-herramientas-saber-11/practica/). El de Inglés (partes 1, 3 y 6 con
// ejemplos sueltos y claves múltiples) no se procesa.
//
// Formato: "Pregunta N" + rótulo lateral (dificultad o competencia) + "Contexto" + "Enunciado" + "Opciones de respuesta"
// (A.-D.) + "Respuesta correcta: X" y justificación (o, en Matemáticas, "¿Cómo responder correctamente esta pregunta?" …
// "la respuesta correcta … se encuentra en la opción X") + "Opciones de respuesta no válidas:" (líneas "A …", "C …") +
// "¿Qué evalúa esta pregunta?" (afirmación/evidencia). Entre secciones hay comentarios didácticos en recuadros, que se
// conservan dentro de la explicación general.
//
// Las preguntas explicadas repiten ítems de los cuadernillos de práctica de la misma caja (SOCO21, CIEO21…): por eso el
// script, por defecto, ENRIQUECE la pregunta ya importada que tenga el mismo enunciado y opciones (explicacion,
// opciones[].explicacion, competencia, etiqueta "explicada_oficial") y solo crea una pregunta nueva en
// content/importados/<prefijo>.json cuando no encuentra pareja.
//
// Uso: node scripts/importar-icfes-explicadas.mjs <pdf> --prueba sociales_ciudadanas --prefijo EXP21-SOC --url <url> --anio 2021
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
  console.error('Uso: node scripts/importar-icfes-explicadas.mjs <pdf> --prueba <id> --prefijo <PREFIJO> --url <url> [--anio 2021]')
  process.exit(1)
}

const texto = execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', archivo, '-'], { maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] }).toString()
const paginas = texto.split('\f')
const lineas = []
paginas.forEach((pag, idx) => { for (const l of pag.split('\n')) lineas.push({ t: l.replace(/\s+$/, ''), pag: idx + 1 }) })

const limpiar = (t) => t.replace(/\s+/g, ' ').trim()
const esRuido = (l) => /^(Ejemplos de preguntas explicadas|Ejemplos de|preguntas explicadas|Prueba|Prueba (Lectura Crítica|Matemáticas|Sociales y Ciudadanas|Ciencias Naturales)|Dificultad (baja|media|alta)(\s+Dificultad (media|alta))*|[xyz])$/i.test(l.trim())
// Rótulo lateral (texto girado que pdftotext deja al margen izquierdo, sin sangría): dificultad o competencia.
const ROTULO = /^(Dificultad (baja|media|alta)|Interpretación y representación|Formulación y ejecución|Argumentación|Pensamiento social|Interpretación y análisis de perspectivas|Pensamiento reflexivo y sistémico|Uso comprensivo del conocimiento científico|Explicación de fenómenos|Indagación|Identifica.*|Comprende.*|Reflexiona.*)$/i

// ── 1. Segmentar por "Pregunta N" y por secciones ─────────────────────────────
const bloques = []
let b = null
for (const { t, pag } of lineas) {
  const l = t.trim()
  if (!l || esRuido(l)) continue
  const m = /^Pregunta (\d+)$/.exec(l)
  if (m) { b = { numero: Number(m[1]), pag, seccion: 'cabecera', partes: { cabecera: [], contexto: [], enunciado: [], opciones: [], correcta: [], novalidas: [], evalua: [] } }; bloques.push(b); continue }
  if (!b) continue
  if (/^Contexto$/i.test(l)) { b.seccion = 'contexto'; continue }
  if (/^Enunciado$/i.test(l)) { b.seccion = 'enunciado'; continue }
  if (/^Opciones de respuesta$/i.test(l)) { b.seccion = 'opciones'; continue }
  if (/^Respuesta correcta:\s*([A-D])\.?$/i.test(l)) { b.seccion = 'correcta'; b.clave = /([A-D])\.?$/.exec(l)[1]; continue }
  if (/^¿Cómo responder correctamente esta pregunta\?$/i.test(l)) { b.seccion = 'correcta'; continue }
  if (/^Opciones de respuesta no válidas:?$/i.test(l)) { b.seccion = 'novalidas'; continue }
  if (/^¿Qué evalúa esta pregunta\?$/i.test(l)) { b.seccion = 'evalua'; continue }
  if (b.seccion === 'cabecera' && ROTULO.test(l)) { b.rotulo = l; continue }
  b.partes[b.seccion].push({ t, l, pag })
}

// ── 2. Interpretar cada bloque ───────────────────────────────────────────────
// Dentro de Contexto/Enunciado, el PDF intercala comentarios didácticos muy sangrados (recuadros). Se separan por
// sangría: el texto del ítem va con sangría ≈ mínima del bloque; los comentarios, bastante más adentro.
function separar(partes) {
  if (!partes.length) return { texto: '', comentarios: [] }
  const sangrias = partes.map(p => p.t.length - p.t.trimStart().length)
  const base = Math.min(...sangrias)
  const item = [], comentarios = []
  for (let i = 0; i < partes.length; i++) (sangrias[i] - base > 12 ? comentarios : item).push(partes[i].l)
  return { texto: limpiar(item.join(' ')), comentarios: comentarios.length ? [limpiar(comentarios.join(' '))] : [] }
}
const competencias = tax.competencias.filter(c => c.prueba === prueba)
const palabras = (t) => new Set(limpiar(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z]+/).filter(w => w.length > 3))
function competenciaPara(txt) {
  if (!txt) return null
  const a = palabras(txt); let mejor = null, puntaje = 0
  for (const c of competencias) { const bb = palabras(`${c.nombre} ${c.descripcion ?? ''}`); const comun = [...a].filter(w => bb.has(w)).length / Math.max(1, a.size); if (comun > puntaje) { puntaje = comun; mejor = c.id } }
  return puntaje >= 0.25 ? mejor : null
}

const salida = []
for (const b of bloques) {
  const ctx = separar(b.partes.contexto), enun = separar(b.partes.enunciado)
  // Opciones: "A. texto" (continuación en líneas sin marcador); "A.    B." solas = figuras.
  const opciones = []
  for (const { l, pag } of b.partes.opciones) {
    if (/^(?:[A-D]\.\s*){2,}$/.test(l)) { for (const m of l.matchAll(/([A-D])\./g)) opciones.push({ clave: m[1], texto: `[Opción ${m[1]}: figura, ver PDF p. ${pag}]`, figura: true }); continue }
    const m = /^([A-D])\.(?:\s+(.*))?$/.exec(l)
    if (m) { opciones.push({ clave: m[1], texto: m[2] ?? '' }); continue }
    if (opciones.length) opciones[opciones.length - 1].texto += ' ' + l
  }
  for (const o of opciones) { o.texto = limpiar(o.texto); if (!o.texto) { o.texto = `[Opción ${o.clave}: figura, ver PDF p. ${b.pag}]`; o.figura = true } }
  // Clave: "Respuesta correcta: X" o, en Matemáticas, "... se encuentra en la opción X."
  const textoCorrecta = limpiar(b.partes.correcta.map(p => p.l).join(' '))
  const clave = b.clave ?? /opci[óo]n ([A-D])\.?(?:\s|$)/.exec(textoCorrecta)?.[1] ?? null
  // Opciones no válidas: líneas que empiezan por la letra sola ("B No es válida…").
  const noValidas = {}
  let letra = null
  for (const { l } of b.partes.novalidas) { const m = /^([A-D])\s+(.*)$/.exec(l); if (m) { letra = m[1]; noValidas[letra] = m[2] } else if (letra) noValidas[letra] += ' ' + l }
  const evalua = limpiar(b.partes.evalua.map(p => p.l).join(' '))
  const rotulo = b.rotulo ?? ''
  const dificultad = /baja/i.test(rotulo) ? 1 : /alta/i.test(rotulo) ? 3 : 2
  const explicacion = [textoCorrecta, ...ctx.comentarios.map(c => `Sobre el contexto: ${c}`), ...enun.comentarios.map(c => `Sobre el enunciado: ${c}`), evalua ? `Qué evalúa: ${evalua}` : ''].filter(Boolean).join('\n\n')
  const etiquetas = ['importada', 'icfes', 'explicada_oficial']
  if (!clave) etiquetas.push('sin_clave')
  if (opciones.some(o => o.figura) || b.partes.contexto.some(p => /(\S+\s{3,}){3,}\S+/.test(p.t))) etiquetas.push('revisar_estimulo')
  salida.push({
    id: `${prefijo}-${String(b.numero).padStart(3, '0')}`,
    prueba, origen: 'oficial',
    fuente: { nombre: `Ejemplos de preguntas explicadas Saber 11.º – Caja de herramientas (ICFES, ${anio ?? 's. f.'})`, url, anio, referencia: `Pregunta ${b.numero}` },
    competencia: competenciaPara(/^Dificultad/i.test(rotulo) ? evalua : rotulo) ?? competenciaPara(evalua), componente: null,
    afirmacion: evalua, evidencia: '', habilidad: 'comprender', tema: '', subtema: '', dificultad,
    contexto: ctx.texto || null, estimulo: null,
    enunciado: enun.texto,
    opciones: opciones.map(o => ({ clave: o.clave, texto: o.texto, correcta: o.clave === clave, explicacion: o.clave === clave ? textoCorrecta : limpiar(noValidas[o.clave] ?? ''), tipo_error: o.clave === clave ? null : 'distractor', diagnostico: o.clave === clave ? null : 'insuficiente', razon_frecuente: null })),
    explicacion, que_identificar: '', que_revisar: '', refuerzo_ids: [], recurso_ids: [], tiempo_sugerido_seg: 120,
    etiquetas, estado: 'pendiente',
  })
}

// ── 3. Enriquecer las ya importadas (misma firma) o guardar las nuevas ────────
const norm = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const firma = (p) => norm(p.enunciado) + '|' + (p.opciones || []).map(o => norm(o.texto)).join('|')
// Las explicadas traen contexto y enunciado separados; en los cuadernillos de práctica suelen ir juntos: se comparan ambas formas.
const firmas = (p) => [firma(p), firma({ enunciado: `${p.contexto ?? ''} ${p.enunciado}`, opciones: p.opciones })]
const dir = join(raiz, 'content/importados')
if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
const ruta = join(dir, `${prefijo.toLowerCase()}.json`)
const enriquecidas = [], nuevas = []
const archivos = readdirSync(dir).filter(f => f.endsWith('.json') && join(dir, f) !== ruta)
const indice = new Map()
for (const f of archivos) { try { const arr = JSON.parse(readFileSync(join(dir, f), 'utf8')); arr.forEach((p, i) => { if (p?.enunciado) indice.set(firma(p), { f, i, arr }) }) } catch {} }
const modificados = new Map()
for (const p of salida) {
  const hit = firmas(p).map(s => indice.get(s)).find(Boolean)
  if (!hit) { nuevas.push(p); continue }
  const q = hit.arr[hit.i]
  q.explicacion = p.explicacion
  q.opciones.forEach(o => { const e = p.opciones.find(x => x.clave === o.clave); if (e?.explicacion) o.explicacion = e.explicacion })
  if (!q.competencia && p.competencia) q.competencia = p.competencia
  if (!q.afirmacion && p.afirmacion) q.afirmacion = p.afirmacion
  if (!q.etiquetas.includes('explicada_oficial')) q.etiquetas.push('explicada_oficial')
  q.fuente.explicacion_url = url
  q.fuente.explicacion_referencia = `Ejemplos de preguntas explicadas, Pregunta ${p.fuente.referencia.replace('Pregunta ', '')}`
  enriquecidas.push(`${p.id}→${q.id}`)
  modificados.set(hit.f, hit.arr)
}
for (const [f, arr] of modificados) writeFileSync(join(dir, f), JSON.stringify(arr, null, 2) + '\n', 'utf8')
if (nuevas.length) writeFileSync(ruta, JSON.stringify(nuevas, null, 2) + '\n', 'utf8')
console.log(`${salida.length} ejemplos explicados detectados (${salida.filter(p => p.opciones.some(o => o.correcta)).length} con clave, ${salida.filter(p => p.competencia).length} con competencia)`)
if (enriquecidas.length) console.log(`  enriquecidas (ya importadas; se les añadió la explicación oficial): ${enriquecidas.join(', ')}`)
console.log(`  nuevas: ${nuevas.length}${nuevas.length ? ` → ${ruta}` : ' (no se crea archivo)'}`)
