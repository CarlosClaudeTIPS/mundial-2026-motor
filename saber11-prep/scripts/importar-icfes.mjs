// Importa un "Cuadernillo de preguntas Saber 11.º" oficial del ICFES (PDF) a content/importados/<prefijo>.json.
// Formato de esos cuadernillos: "RESPONDE LAS PREGUNTAS 1 A 3 DE ACUERDO CON LA SIGUIENTE INFORMACIÓN" +
// texto/estímulo, luego "Pregunta N", enunciado, opciones "A." "B." "C." "D.", y al final una
// "Tabla de respuestas correctas" con posición, afirmación (competencia) y letra.
//
// Uso: node scripts/importar-icfes.mjs <cuadernillo.pdf> --prueba lectura_critica --prefijo LCO26 --url <url> --anio 2026
//
// Las preguntas quedan con estado "pendiente" y sin explicaciones (las completa la IA o un revisor).
// Las que están en páginas con imágenes o con tablas en texto plano llevan la etiqueta
// "revisar_estimulo": hay que reconstruir el estímulo a mano (tabla/gráfico) o descartarlas.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
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
  console.error('Uso: node scripts/importar-icfes.mjs <pdf> --prueba <id> --prefijo <PREFIJO> --url <url> [--anio 2026]')
  process.exit(1)
}

// ── Texto por página ──────────────────────────────────────────────────────────
const texto = execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', archivo, '-'], { maxBuffer: 1 << 26 }).toString()
const paginas = texto.split('\f')
let paginasConImagen = new Set()
try {
  const lista = execFileSync('pdfimages', ['-list', archivo]).toString().split('\n').slice(2)
  const porPagina = {}
  for (const l of lista) { const m = /^\s*(\d+)\s+\d+\s+\S+\s+(\d+)\s+(\d+)/.exec(l); if (m) { const area = Number(m[2]) * Number(m[3]); porPagina[m[1]] = Math.max(porPagina[m[1]] ?? 0, area) } }
  // Logos y adornos pequeños se ignoran: solo cuentan imágenes de más de 150×150 px.
  paginasConImagen = new Set(Object.entries(porPagina).filter(([, a]) => a > 150 * 150).map(([p]) => Number(p)))
} catch {}

const esRuido = (l) => /^(Cuadernillo de preguntas|Prueba (Lectura Crítica|Matemáticas|Sociales y Ciudadanas|Ciencias Naturales|Inglés)|Saber 11\.º)$/i.test(l) || /^\d{1,3}$/.test(l)

// ── Recorrido ─────────────────────────────────────────────────────────────────
const preguntas = []
let contexto = null, rangoContexto = null, actual = null, opcion = null, enTabla = false
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
    const resp = /^RESPONDE LAS? PREGUNTAS? (\d+)(?: A (\d+))? DE ACUERDO/i.exec(l)
    if (resp) { cerrarPregunta(); rangoContexto = [Number(resp[1]), Number(resp[2] ?? resp[1])]; contexto = { lineas: [], paginas: new Set([numPag]) }; continue }
    if (/^CON LA SIGUIENTE INFORMACI[ÓO]N$/i.test(l)) continue
    const preg = /^Pregunta (\d+)$/i.exec(l)
    if (preg) {
      cerrarPregunta()
      const n = Number(preg[1])
      const enRango = rangoContexto && n >= rangoContexto[0] && n <= rangoContexto[1]
      if (!enRango) { contexto = null; rangoContexto = null }
      actual = { numero: n, enunciado: [], opciones: [], contexto: enRango ? contexto : null, paginas: new Set([numPag]) }
      continue
    }
    const op = actual && /^([A-D])\.\s+(.*)$/.exec(l)
    if (op) { cerrarOpcion(); opcion = { clave: op[1], texto: op[2] }; actual.paginas.add(numPag); continue }
    if (opcion) { opcion.texto += ' ' + l; continue }
    if (actual) { actual.enunciado.push(cruda.replace(/\s+$/, '')); actual.paginas.add(numPag); continue }
    if (contexto) { contexto.lineas.push(cruda.replace(/\s+$/, '')); contexto.paginas.add(numPag) }
  }
})
cerrarPregunta()

// ── Tabla de respuestas: posición, afirmación (varias líneas), letra ──────────
const clave = {}, afirmacionDe = {}
let pos = null, afirm = []
for (const l of lineasTabla) {
  if (/^(Posici[óo]n|Afirmaci[óo]n|Respuesta|correcta|Dificultad)$/i.test(l)) continue
  const fila = /^(\d{1,3})\s+(.*?)\s*([A-D])$/.exec(l) || /^(\d{1,3})\s+([A-D])$/.exec(l)
  if (fila) {
    if (fila.length === 4) { clave[Number(fila[1])] = fila[3]; afirm.push(fila[2]); afirmacionDe[Number(fila[1])] = limpiar(afirm.join(' ')); afirm = [] }
    else { clave[Number(fila[1])] = fila[2]; afirmacionDe[Number(fila[1])] = limpiar(afirm.join(' ')); afirm = [] }
    pos = Number(fila[1])
    continue
  }
  const soloNumero = /^(\d{1,3})$/.exec(l)
  if (soloNumero) { pos = Number(soloNumero[1]); continue }
  const soloLetra = /^([A-D])$/.exec(l)
  if (soloLetra && pos != null) { clave[pos] = soloLetra[1]; afirmacionDe[pos] = limpiar(afirm.join(' ')); afirm = []; pos = null; continue }
  afirm.push(l)
}

// Afirmación de la tabla → competencia de la taxonomía (por similitud de palabras).
const competencias = tax.competencias.filter(c => c.prueba === prueba)
const palabras = (t) => new Set(limpiar(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z]+/).filter(w => w.length > 3))
function competenciaPara(afirmacion) {
  if (!afirmacion) return null
  const a = palabras(afirmacion)
  let mejor = null, puntaje = 0
  for (const c of competencias) {
    const b = palabras(`${c.nombre} ${c.descripcion ?? ''}`)
    const comun = [...a].filter(w => b.has(w)).length / Math.max(1, a.size)
    if (comun > puntaje) { puntaje = comun; mejor = c.id }
  }
  return puntaje >= 0.3 ? mejor : null
}

// ── Salida ────────────────────────────────────────────────────────────────────
const pareceTabla = (t) => /(\S+\s{3,}){3,}\S+/.test(t) // columnas alineadas con espacios
const salida = preguntas.map(p => {
  const ctx = p.contexto ? p.contexto.lineas.join('\n').replace(/\n{3,}/g, '\n\n').trim() : null
  const enunciado = p.enunciado.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  const correcta = clave[p.numero] ?? null
  const pags = new Set([...p.paginas, ...(p.contexto ? p.contexto.paginas : [])])
  const conImagen = [...pags].some(n => paginasConImagen.has(n))
  const conTabla = pareceTabla(ctx ?? '') || pareceTabla(enunciado)
  const etiquetas = ['importada', 'icfes']
  if (!correcta) etiquetas.push('sin_clave')
  if (conImagen || conTabla) etiquetas.push('revisar_estimulo')
  const fuenteTexto = /Tomado (y adaptado )?de:?\s*(.+)$/im.exec(ctx ?? '')?.[2]
  return {
    id: `${prefijo}-${String(p.numero).padStart(3, '0')}`,
    prueba, origen: 'oficial',
    fuente: { nombre: `Cuadernillo de preguntas Saber 11.º (ICFES, ${anio ?? 's. f.'})`, url, anio, referencia: `Pregunta ${p.numero}`, ...(fuenteTexto ? { texto_base: limpiar(fuenteTexto) } : {}) },
    competencia: competenciaPara(afirmacionDe[p.numero]), componente: null,
    afirmacion: afirmacionDe[p.numero] ?? '', evidencia: '', habilidad: 'comprender', tema: '', subtema: '', dificultad: 2,
    contexto: ctx ? limpiarParrafos(ctx) : null, estimulo: null,
    enunciado: limpiarParrafos(enunciado),
    opciones: p.opciones.map(o => ({ clave: o.clave, texto: o.texto, correcta: o.clave === correcta, explicacion: '', tipo_error: o.clave === correcta ? null : 'distractor', diagnostico: o.clave === correcta ? null : 'insuficiente', razon_frecuente: null })),
    explicacion: '', que_identificar: '', que_revisar: '', refuerzo_ids: [], recurso_ids: [], tiempo_sugerido_seg: 120,
    etiquetas, estado: 'pendiente',
  }
})

// Párrafos: une líneas partidas por el PDF, conserva saltos dobles; las tablas alineadas se dejan tal cual.
function limpiarParrafos(t) {
  return t.split(/\n\s*\n/).map(b => pareceTabla(b) ? b.replace(/[ \t]+$/gm, '') : limpiar(b)).join('\n\n')
}

const dir = join(raiz, 'content/importados')
if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
const ruta = join(dir, `${prefijo.toLowerCase()}.json`)
writeFileSync(ruta, JSON.stringify(salida, null, 2) + '\n', 'utf8')
const n = (f) => salida.filter(f).length
console.log(`${salida.length} preguntas → ${ruta}`)
console.log(`  con clave: ${n(p => p.opciones.some(o => o.correcta))} · con competencia: ${n(p => p.competencia)} · con contexto: ${n(p => p.contexto)} · revisar_estimulo: ${n(p => p.etiquetas.includes('revisar_estimulo'))}`)
const faltan = [...Array(Math.max(...Object.keys(clave).map(Number), 0)).keys()].map(i => i + 1).filter(i => !salida.some(p => p.id.endsWith(String(i).padStart(3, '0'))))
if (faltan.length) console.log(`  no detectadas (revisar a mano): ${faltan.join(', ')}`)
