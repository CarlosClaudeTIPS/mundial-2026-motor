// Importa el "Cuadernillo de preguntas Saber 11.º – Prueba Inglés" de la Caja de herramientas oficial (edición junio 2021,
// 10_PRACTICA_INGLES.pdf, enlazado desde https://www.icfes.gov.co/caja-de-herramientas-saber-11/practica/).
// Variante de importar-icfes-ingles.mjs (NO lo modifica): misma estructura (dos exámenes × 25 preguntas, siete partes),
// pero con otros rótulos: "Examen 1" (no "EXAMEN 1"), "PARTE N" (no "· Parte N ·"), "RESPONDA LAS PREGUNTAS…" (no RESPONDE),
// la tabla de respuestas en dos líneas ("Tabla de respuestas correctas" + "Examen N   Dificultad") y cabeceras decorativas
// ("Cuadernillo de", "preguntas", "Módulo de", "Prueba", "Inglés", "En g / l i / s / h", "Saber 11.º  N", "2021").
//
// Uso: node scripts/importar-icfes-ingles2021.mjs <pdf> --prefijo INGO21 --url <url> --anio 2021 [--sin-duplicados]
// Ids: INGO21-E1-006… Estado "pendiente", sin explicaciones. Parte 1 (emparejamiento A-H) no se importa.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const tax = JSON.parse(readFileSync(join(raiz, 'content/taxonomia.json'), 'utf8'))
const args = process.argv.slice(2)
const archivo = args.find(a => !a.startsWith('--'))
const opt = (k, d = null) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d }
const prefijo = (opt('prefijo') ?? '').toUpperCase(), url = opt('url'), anio = Number(opt('anio')) || null
if (!archivo || !prefijo || !url) { console.error('Uso: node scripts/importar-icfes-ingles2021.mjs <pdf> --prefijo <PREFIJO> --url <url> [--anio 2024]'); process.exit(1) }

const texto = execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', archivo, '-'], { maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] }).toString().replace(/\t/g, '    ')
const paginas = texto.split('\f')
let paginasConImagen = new Set()
try {
  const lista = execFileSync('pdfimages', ['-list', archivo], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().split('\n').slice(2)
  const porPagina = {}
  for (const l of lista) { const m = /^\s*(\d+)\s+\d+\s+\S+\s+(\d+)\s+(\d+)/.exec(l); if (m) porPagina[m[1]] = Math.max(porPagina[m[1]] ?? 0, Number(m[2]) * Number(m[3])) }
  paginasConImagen = new Set(Object.entries(porPagina).filter(([, a]) => a > 150 * 150).map(([p]) => Number(p)))
} catch {}
const lineas = []
paginas.forEach((pag, idx) => { for (const l of pag.split('\n')) lineas.push({ t: l.replace(/\s+$/, ''), pag: idx + 1 }) })

const limpiar = (t) => t.replace(/\s+/g, ' ').trim()
const esRuido = (l) => /^(Cuadernillo de preguntas|Cuadernillo de|preguntas|Módulo de|Prueba|Inglés(\s+En g)?|Prueba Inglés(, Examen \d|\s+h)?|En g|l i|s|h|Saber 11\.[º°](\s+\d{1,3})?|\d{1,4})$/i.test(l.trim())
const COMPONENTE = { 1: 'parte_1', 2: 'parte_2', 3: 'parte_3', 4: 'parte_4', 5: 'parte_5', 6: 'parte_6', 7: 'parte_7' }
const COMPETENCIA = { 1: 'I1', 2: 'I2', 3: 'I2', 4: 'I1', 5: 'I2', 6: 'I2', 7: 'I1' }

// ── 1. Segmentar: examen → parte → bloques de líneas; tablas de respuestas ───
const partes = [] // { examen, parte, desde, hasta, rango }
const claves = {} // claves[examen][pos] = { letra, nivel }
let examen = 0, enTabla = null
for (let i = 0; i < lineas.length; i++) {
  const l = lineas[i].t.trim()
  const ex = /^Examen (\d)$/i.exec(l); if (ex) { examen = Number(ex[1]); enTabla = null; continue }
  if (/^Tabla de respuestas correctas/i.test(l)) { enTabla = 'pendiente'; if (partes.length) partes[partes.length - 1].hasta ??= i; continue }
  if (enTabla === 'pendiente') { const te = /^Examen (\d)\b/i.exec(l); if (te) { enTabla = Number(te[1]); claves[enTabla] ??= {} } continue }
  if (enTabla) { const f = /^(\d{1,2})\s+([A-H])\s+(.+)$/.exec(l); if (f) claves[enTabla][Number(f[1])] = { letra: f[2], nivel: limpiar(f[3]) }; continue }
  const pt = /^(?:·\s*)?PARTE (\d)(?:\s*·)?$/i.exec(l)
  if (pt) { if (partes.length) partes[partes.length - 1].hasta ??= i; partes.push({ examen, parte: Number(pt[1]), desde: i }); continue }
  const r = /^RESPOND[AE] LAS? PREGUNTAS? (\d+)(?: (?:A|Y) (\d+))? DE ACUERDO/i.exec(l)
  if (r && partes.length) partes[partes.length - 1].rango = [Number(r[1]), Number(r[2] ?? r[1])]
}
if (partes.length) partes[partes.length - 1].hasta ??= lineas.length

// ── 2. Parsear cada parte ────────────────────────────────────────────────────
const preguntas = [], omitidas = []
for (const p of partes) {
  const [ini, fin] = p.rango ?? [1, 25]
  const enRango = (n) => n >= ini && n <= fin
  const cuerpo = lineas.slice(p.desde + 1, p.hasta).filter(x => !esRuido(x.t))
  // Quitar la cabecera de instrucciones (hasta la línea "Ejemplo:" inclusive) y el ejemplo "0." con su "Respuesta:".
  const idxEj = cuerpo.findIndex(x => /^\s*Ejemplo:?\s*$/.test(x.t))
  // Sin "Ejemplo:" (Parte 6), el texto base son las líneas anteriores al primer ítem numerado.
  const idxPrimerItem = cuerpo.findIndex(x => /^\s*\d{1,2}\.\s+\S/.test(x.t))
  const antesEjemplo = idxEj >= 0 ? cuerpo.slice(0, idxEj) : cuerpo.slice(0, idxPrimerItem >= 0 ? idxPrimerItem : 0)
  let resto = idxEj >= 0 ? cuerpo.slice(idxEj + 1) : cuerpo
  const idxResp = resto.findIndex(x => /Respuesta:\s*0\./.test(x.t))
  // El ejemplo "0." y sus opciones van desde el inicio hasta "Respuesta: 0." (en partes 5-7 el texto base va ANTES de "Ejemplo:")
  const textoBase = antesEjemplo.filter(x => !/^\s*(RESPOND[AE]|Lea |En las? preguntas?|¿Dónde|Complete|La opción H|Lea las descripciones)/i.test(x.t.trim())).map(x => x.t)
  if (idxResp >= 0) resto = resto.slice(idxResp + 1)
  resto = resto.filter(x => !/Respuesta:\s*0\./.test(x.t))
  const paginasParte = new Set(cuerpo.map(x => x.pag))

  if (p.parte === 1) { omitidas.push(`Examen ${p.examen} parte 1 (preguntas ${ini}-${fin}): emparejamiento A-H, no cabe en 3-4 opciones`); continue }

  const contexto = (p.parte >= 4) ? textoBase.join('\n').replace(/\n{3,}/g, '\n\n').trim() : null

  if (p.parte === 4 || p.parte === 7) {
    // "N.   A. x   B. y   C. z [D. w]" en una sola línea (a veces la letra y la palabra quedan separadas por muchos espacios)
    for (const x of resto) {
      const m = /^\s*(\d{1,2})\.\s+(.*)$/.exec(x.t); if (!m || !enRango(Number(m[1]))) continue
      const ops = [...m[2].matchAll(/([A-D])\.\s+(\S+(?:\s(?!\s)[^\s]+)*)/g)].map(o => ({ clave: o[1], texto: limpiar(o[2]) }))
      if (ops.length >= 3) preguntas.push({ examen: p.examen, parte: p.parte, numero: Number(m[1]), enunciado: `Complete the gap (${m[1]}) in the text.`, opciones: ops, contexto, paginas: new Set([x.pag]) })
    }
    continue
  }

  // Partes 2, 3, 5, 6: enunciado a la izquierda, opciones a la derecha. Columna de opciones = posición mínima de "X. " (X=A-D) a la derecha del número.
  let actual = null, opcion = null
  const cerrar = () => { if (opcion && actual) actual.opciones.push({ clave: opcion.clave, texto: limpiar(opcion.texto) }); opcion = null; if (actual && actual.opciones.length >= 3) preguntas.push(actual); actual = null }
  for (const x of resto) {
    const t = x.t
    const ini2 = /^\s*(\d{1,2})\.(?:\s+(.*))?$/.exec(t); if (ini2) ini2[2] ??= ''
    // Se aceptan números fuera del rango de la cabecera (el PDF puede traer un error de numeración; se corrige abajo).
    if (ini2 && Number(ini2[1]) >= 1 && Number(ini2[1]) <= 30 && (!actual || actual.opciones.length + (opcion ? 1 : 0) >= 3 || Number(ini2[1]) === actual.numero + 1)) {
      cerrar()
      actual = { examen: p.examen, parte: p.parte, numero: Number(ini2[1]), enunciado: [], opciones: [], contexto, paginas: new Set([x.pag]), col: null }
    }
    if (!actual) continue
    actual.paginas.add(x.pag)
    // Buscar un marcador de opción en la línea (a la derecha del número de pregunta si lo hay)
    const desde = ini2 && Number(ini2[1]) === actual.numero ? t.indexOf('.') + 1 : 0
    const mo = /(?:^|\s{2,})([A-D])\.\s+(.*)$/.exec(t.slice(desde))
    if (mo) {
      const col = desde + t.slice(desde).indexOf(mo[0].trimStart())
      if (actual.col == null) actual.col = col
      const izq = t.slice(0, col).trim(); const izqSinNum = ini2 && Number(ini2[1]) === actual.numero ? ini2[2].slice(0, Math.max(0, col - (t.indexOf(ini2[2])))).trim() : izq
      if (izqSinNum) actual.enunciado.push(izqSinNum)
      if (opcion) actual.opciones.push({ clave: opcion.clave, texto: limpiar(opcion.texto) })
      opcion = { clave: mo[1], texto: mo[2] }
      continue
    }
    // Sin marcador: parte izquierda (hasta col) → enunciado; derecha → continuación de opción
    const col = actual.col ?? t.length
    const izq = (ini2 && Number(ini2[1]) === actual.numero ? ini2[2] : t.slice(0, col)).trim(), der = t.slice(col).trim()
    if (izq) actual.enunciado.push(izq)
    if (der && opcion) opcion.texto += ' ' + der
  }
  cerrar()
  // El PDF puede traer un error de numeración en una parte (p. ej. Examen 1, Parte 3: ítems "6." y "7." bajo
  // "RESPONDE LAS PREGUNTAS 7 Y 8"). Si la cantidad de ítems coincide con el rango pero los números no, se
  // renumeran en orden según el rango de la cabecera (la clave de la tabla va por posición) y se etiquetan.
  const deParte = preguntas.filter(q => q.examen === p.examen && q.parte === p.parte)
  const esperados = Array.from({ length: fin - ini + 1 }, (_, k) => ini + k)
  if (deParte.length === esperados.length && deParte.some((q, k) => q.numero !== esperados[k])) {
    deParte.forEach((q, k) => { q.numeroOriginal = q.numero; q.numero = esperados[k]; q.renumerada = true })
  }
  for (const q of preguntas) if (q.parte === 2 && [...paginasParte].some(n => paginasConImagen.has(n))) q.imagen = true
}

// ── 3. Salida ────────────────────────────────────────────────────────────────
const salida = preguntas.sort((a, b) => a.examen - b.examen || a.numero - b.numero).map(q => {
  const clave = claves[q.examen]?.[q.numero]
  const correcta = clave?.letra ?? null
  const etiquetas = ['importada', 'icfes']
  if (!correcta) etiquetas.push('sin_clave')
  if (q.parte === 2 || q.imagen || [...q.paginas].some(n => paginasConImagen.has(n))) etiquetas.push('revisar_estimulo')
  if (q.renumerada) etiquetas.push('renumerada')
  const enunciado = Array.isArray(q.enunciado) ? limpiar(q.enunciado.join(' ')) : q.enunciado
  const nivel = clave?.nivel ?? null
  return {
    id: `${prefijo}-E${q.examen}-${String(q.numero).padStart(3, '0')}`,
    prueba: 'ingles', origen: 'oficial',
    fuente: { nombre: `Cuadernillo de preguntas Saber 11.º – Inglés, Caja de herramientas (ICFES, ${anio ?? 's. f.'})`, url, anio, referencia: `Examen ${q.examen}, Parte ${q.parte}, Pregunta ${q.numero}${q.renumerada ? ` (impresa como ${q.numeroOriginal})` : ''}` },
    competencia: COMPETENCIA[q.parte], componente: COMPONENTE[q.parte],
    afirmacion: nivel ? `Nivel ${nivel} (MCER)` : '', evidencia: '', habilidad: 'comprender', tema: '', subtema: '',
    dificultad: nivel ? (/^Pre A1|^A1/.test(nivel) ? 1 : /^A2/.test(nivel) ? 2 : 3) : 2,
    contexto: q.contexto || null, estimulo: null,
    enunciado: q.parte === 2 ? `Where can you see this notice? ${enunciado ? `"${enunciado}"` : '[aviso en imagen: ver PDF]'}` : enunciado,
    opciones: q.opciones.map(o => ({ clave: o.clave, texto: o.texto, correcta: o.clave === correcta, explicacion: '', tipo_error: o.clave === correcta ? null : 'distractor', diagnostico: o.clave === correcta ? null : 'insuficiente', razon_frecuente: null })),
    explicacion: '', que_identificar: '', que_revisar: '', refuerzo_ids: [], recurso_ids: [], tiempo_sugerido_seg: 90,
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
console.log(`  con clave: ${n(p => p.opciones.some(o => o.correcta))} · con contexto: ${n(p => p.contexto)} · revisar_estimulo: ${n(p => p.etiquetas.includes('revisar_estimulo'))} · por parte: ${JSON.stringify(Object.fromEntries([2, 3, 4, 5, 6, 7].map(k => [k, preguntas.filter(q => q.parte === k).length])))}`)
for (const o of omitidas) console.log(`  omitido → ${o}`)
for (const ex of Object.keys(claves)) {
  const faltan = Object.keys(claves[ex]).map(Number).filter(k => !salida.some(p => p.id === `${prefijo}-E${ex}-${String(k).padStart(3, '0')}`))
  if (faltan.length) console.log(`  Examen ${ex}: no detectadas: ${faltan.join(', ')}`)
}
