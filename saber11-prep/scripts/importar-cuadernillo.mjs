// Importa un cuadernillo (PDF o texto plano) de preguntas liberadas a content/importados/<prefijo>.json
// con estado "pendiente" y origen "oficial" (o el que se indique). Las preguntas quedan sin
// explicaciones ni clasificación: eso lo completa después la IA (api/ia-preguntas.js desde la app)
// o un revisor, y solo entonces pasan al banco (content/banco/) con estado "aprobada".
//
// Uso:
//   node scripts/importar-cuadernillo.mjs <archivo.pdf|.txt> --prueba lectura_critica --prefijo LCO24 \
//        --url https://www.icfes.gov.co/... --anio 2024 [--nombre "Cuadernillo Lectura Crítica Saber 11 2024"] [--origen oficial]
//
// Requiere `pdftotext` (poppler) para PDF. Reutiliza las reglas de detección de src/lib/importar.js.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const archivo = args.find(a => !a.startsWith('--'))
const opt = (k, d = null) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d }
const PRUEBAS = ['lectura_critica', 'matematicas', 'sociales_ciudadanas', 'ciencias_naturales', 'ingles']
if (!archivo || !PRUEBAS.includes(opt('prueba')) || !opt('prefijo')) {
  console.error('Uso: node scripts/importar-cuadernillo.mjs <archivo.pdf|.txt> --prueba <id> --prefijo <PREFIJO> [--url …] [--anio 2024] [--nombre …] [--origen oficial]')
  process.exit(1)
}

function textoDe(ruta) {
  if (ruta.toLowerCase().endsWith('.pdf')) return execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', ruta, '-'], { maxBuffer: 1 << 26 }).toString()
  return readFileSync(ruta, 'utf8')
}

// Misma lógica que detectarPreguntas() en src/lib/importar.js (duplicada aquí para correr en Node sin Vite).
export function detectarPreguntas(texto) {
  const lineas = texto.replace(/\r/g, '').replace(/\f/g, '\n').split('\n').map(l => l.replace(/\s+/g, ' ').trim())
  const preguntas = []
  let actual = null, opcionActual = null, buffer = [], enClave = false, claveTexto = []
  const esInicio = (l) => /^(?:pregunta\s*)?(\d{1,3})\s*[.)\-:]\s*(.*)$/i.exec(l)
  const esOpcion = (l) => /^\(?([A-Da-d])\s*[.)\-:]\s*(.*)$/.exec(l)
  const cerrar = () => {
    if (!actual) return
    if (opcionActual) { actual.opciones.push(opcionActual); opcionActual = null }
    if (actual.opciones.length >= 3) preguntas.push(actual)
    actual = null
  }
  for (const l of lineas) {
    if (!l) continue
    if (/^(hoja\s+de\s+)?(respuestas?|claves?|clave\s+de\s+respuestas?)(\s+correctas?)?\s*:?$/i.test(l)) { cerrar(); enClave = true; continue }
    if (enClave) { claveTexto.push(l); continue }
    if (/^\d{1,3}\s*[.)\-:]?\s*[A-D]$/i.test(l)) { claveTexto.push(l); continue }
    const ini = esInicio(l)
    if (ini && (!actual || actual.opciones.length >= 3 || opcionActual)) {
      cerrar()
      actual = { numero: Number(ini[1]), contexto: buffer.join('\n').trim() || null, enunciado: ini[2], opciones: [] }
      buffer = []
      continue
    }
    const op = actual && esOpcion(l)
    if (op) {
      if (opcionActual) actual.opciones.push(opcionActual)
      opcionActual = { clave: op[1].toUpperCase(), texto: op[2] }
      continue
    }
    if (opcionActual) opcionActual.texto += ' ' + l
    else if (actual) actual.enunciado += ' ' + l
    else buffer.push(l)
    if (buffer.length > 40) buffer = buffer.slice(-40)
  }
  cerrar()
  const clave = {}
  const fuenteClave = claveTexto.length ? claveTexto.join('\n') : texto
  const claves = fuenteClave.match(/(?:^|\s)(\d{1,3})\s*[.)\-:]?\s*([A-D])(?=\s|$)/g) ?? []
  if (claveTexto.length || claves.length >= Math.max(5, preguntas.length * 0.5)) {
    for (const c of claves) { const m = /(\d{1,3})\s*[.)\-:]?\s*([A-D])/.exec(c); if (m) clave[Number(m[1])] = m[2] }
  }
  for (const p of preguntas) {
    p.correcta = clave[p.numero] ?? null
    p.enunciado = p.enunciado.replace(/\s+/g, ' ').trim()
    for (const o of p.opciones) o.texto = o.texto.replace(/\s+/g, ' ').trim()
  }
  return preguntas
}

const prueba = opt('prueba'), prefijo = opt('prefijo').toUpperCase(), origen = opt('origen', 'oficial')
const fuente = { nombre: opt('nombre', `${basename(archivo)} (ICFES)`), url: opt('url'), anio: opt('anio') ? Number(opt('anio')) : null }
if (origen === 'oficial' && !fuente.url) { console.error('Una fuente oficial exige --url'); process.exit(1) }

const borradores = detectarPreguntas(textoDe(archivo))
const preguntas = borradores.map(b => ({
  id: `${prefijo}-${String(b.numero).padStart(3, '0')}`,
  prueba, origen, fuente: { ...fuente, referencia: `Pregunta ${b.numero}` },
  competencia: null, componente: null, afirmacion: '', evidencia: '', habilidad: 'comprender', tema: '', subtema: '', dificultad: 2,
  contexto: b.contexto, estimulo: null, enunciado: b.enunciado,
  opciones: b.opciones.map(o => ({ clave: o.clave, texto: o.texto, correcta: o.clave === b.correcta, explicacion: '', tipo_error: o.clave === b.correcta ? null : 'distractor', diagnostico: o.clave === b.correcta ? null : 'insuficiente', razon_frecuente: null })),
  explicacion: '', que_identificar: '', que_revisar: '', refuerzo_ids: [], recurso_ids: [], tiempo_sugerido_seg: 120,
  etiquetas: ['importada', ...(b.correcta ? [] : ['sin_clave'])], estado: 'pendiente',
}))

const dir = join(raiz, 'content/importados')
if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
const salida = join(dir, `${prefijo.toLowerCase()}.json`)
writeFileSync(salida, JSON.stringify(preguntas, null, 2) + '\n', 'utf8')
const conClave = preguntas.filter(p => p.opciones.some(o => o.correcta)).length
const sinContexto = preguntas.filter(p => !p.contexto).length
console.log(`${preguntas.length} preguntas detectadas (${conClave} con clave, ${sinContexto} sin contexto) → ${salida}`)
if (preguntas.length < 5) console.log('Pocas preguntas: revisa que el PDF tenga texto (no imágenes escaneadas) y que las opciones estén como "A." "B." …')
