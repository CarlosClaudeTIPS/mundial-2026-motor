// Importa los "Ejemplos de preguntas" de las Guías de orientación Saber 11.º 2017-1 / 2017-2 del ICFES (PDF)
// a content/importados/<prefijo>-<prueba>.json (una salida por prueba). Variante de importar-icfes.mjs:
// NO modifica ese script; el formato de las guías es distinto al de los cuadernillos.
//
// Formato de las guías: cada prueba tiene una sección "N. Ejemplos de preguntas" ("...de la prueba de <X>...").
// Dentro, numeración que reinicia en 1 por prueba: opcional "Responda la(s) pregunta(s) N (a|y M) de acuerdo
// con la siguiente información:" + estímulo, luego "N." + enunciado, opciones "A." a "D.", un bloque de
// metadatos (Competencia[/Afirmación], Afirmación, Contenido, Componente, Tipo de texto, Nivel de desempeño,
// Respuesta correcta X) y la justificación en prosa. La sección de Inglés (partes con imágenes, texto
// superpuesto y claves múltiples "19: A, 21: A") no se procesa: se omite y se reporta.
//
// Uso: node scripts/importar-icfes-guia2017.mjs <guia.pdf> --prefijo G17-1 --url <url> --anio 2017 [--solo lectura_critica]
//
// Salida: estado "pendiente", origen "oficial", explicacion = justificación oficial (hay que redactar aún las
// explicaciones por opción). Páginas con imágenes grandes o tablas → etiqueta "revisar_estimulo".
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const tax = JSON.parse(readFileSync(join(raiz, 'content/taxonomia.json'), 'utf8'))
const args = process.argv.slice(2)
const archivo = args.find(a => !a.startsWith('--'))
const opt = (k, d = null) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d }
const prefijo = (opt('prefijo') ?? '').toUpperCase(), url = opt('url'), anio = Number(opt('anio')) || null, solo = opt('solo')
if (!archivo || !prefijo || !url) {
  console.error('Uso: node scripts/importar-icfes-guia2017.mjs <pdf> --prefijo <PREFIJO> --url <url> [--anio 2017] [--solo <prueba>]')
  process.exit(1)
}

const PRUEBAS = {
  'lectura crítica': 'lectura_critica', 'matemáticas': 'matematicas', 'sociales y ciudadanas': 'sociales_ciudadanas',
  'ciencias naturales': 'ciencias_naturales', 'inglés': 'ingles',
}
const SUFIJO = { lectura_critica: 'LC', matematicas: 'MAT', sociales_ciudadanas: 'SOC', ciencias_naturales: 'CIE', ingles: 'ING' }

// ── Texto por página + páginas con imágenes grandes ──────────────────────────
const texto = execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', archivo, '-'], { maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] }).toString()
const paginas = texto.split('\f')
let paginasConImagen = new Set()
try {
  const lista = execFileSync('pdfimages', ['-list', archivo], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().split('\n').slice(2)
  // Las guías llevan una franja decorativa del mismo tamaño en casi todas las páginas: se ignoran los tamaños
  // que se repiten en más del 30 % de las páginas; solo cuentan imágenes "únicas" de más de 150×150 px.
  const filas = lista.map(l => /^\s*(\d+)\s+\d+\s+\S+\s+(\d+)\s+(\d+)/.exec(l)).filter(Boolean).map(m => ({ pag: Number(m[1]), tam: `${m[2]}x${m[3]}`, area: Number(m[2]) * Number(m[3]) }))
  const pagsPorTam = {}
  for (const f of filas) (pagsPorTam[f.tam] ??= new Set()).add(f.pag)
  const decorativo = new Set(Object.entries(pagsPorTam).filter(([, s]) => s.size > paginas.length * 0.3).map(([t]) => t))
  paginasConImagen = new Set(filas.filter(f => f.area > 150 * 150 && !decorativo.has(f.tam)).map(f => f.pag))
} catch {}

const lineas = [] // { t: texto crudo sin fin, pag }
paginas.forEach((pag, idx) => { for (const l of pag.split('\n')) lineas.push({ t: l.replace(/\s+$/, ''), pag: idx + 1 }) })

const esRuido = (l) => /^(Guía de orientación|Saber 11\.°\s*\d*|\d{1,3})$/i.test(l.trim())
const LABEL = /^\s*(Competencia\/Afirmación|Competencia|Afirmación|Contenido|Componente|Tipo de texto|Nivel de desempeño|Respuesta correcta)\s*:?\s*(.*)$/i
const limpiar = (t) => t.replace(/\s+/g, ' ').trim()
const pareceTabla = (t) => /(\S+\s{3,}){3,}\S+/.test(t)
const limpiarParrafos = (t) => t.split(/\n\s*\n/).map(b => pareceTabla(b) ? b.replace(/[ \t]+$/gm, '') : limpiar(b)).join('\n\n')

// ── 1. Localizar secciones "Ejemplos de preguntas" y su prueba ───────────────
const secciones = [] // { prueba, desde, hasta }
for (let i = 0; i < lineas.length; i++) {
  if (!/^\s*\d\.\s*Ejemplos de preguntas\s*$/i.test(lineas[i].t)) continue
  const cabecera = lineas.slice(i, i + 5).map(l => l.t).join(' ').toLowerCase()
  const nombre = Object.keys(PRUEBAS).find(n => cabecera.includes(`prueba de ${n}`) || cabecera.includes(`prueba ${n}`))
  // Si la cabecera no nombra la prueba (Inglés: "Los ejemplos que se presentan..."), se toma la última "Prueba de X"
  // vista en el capítulo; la sección se registra igual para que acote la anterior.
  let prueba = nombre ? PRUEBAS[nombre] : null
  if (!prueba) for (let j = i - 1; j > Math.max(0, i - 400) && !prueba; j--) { const m = /^\s*(?:\d\.\s*)?Prueba de (.+?)\s*$/i.exec(lineas[j].t); if (m) prueba = PRUEBAS[m[1].toLowerCase()] ?? null }
  secciones.push({ prueba, desde: i })
}
secciones.forEach((s, k) => { s.hasta = k + 1 < secciones.length ? secciones[k + 1].desde : lineas.length })

// ── 2. Recorrer cada sección ─────────────────────────────────────────────────
const salidaPorPrueba = {}
const omitidas = []
for (const sec of secciones) {
  if (solo && sec.prueba !== solo) continue
  if (sec.prueba === 'ingles') { omitidas.push('Inglés: formato por partes con imágenes y claves múltiples; no se procesa'); continue }
  if (!sec.prueba) { omitidas.push(`sección "Ejemplos de preguntas" (línea ${sec.desde}) sin prueba identificable; no se procesa`); continue }
  const preguntas = []
  let esperado = 1, contexto = null, rangoCtx = null, candidato = null, actual = null, opcion = null, fase = 'buscar'
  // fase: buscar (contexto/candidato) · enunciado · opciones · meta · justificacion
  const cerrar = () => {
    if (opcion && actual) { actual.opciones.push({ clave: opcion.clave, texto: limpiar(opcion.texto) }); opcion = null }
    if (actual && (actual.opciones.length >= 3 || actual.meta)) {
      // Opciones en figuras (dos columnas, texto superpuesto): se dejan marcadores para reconstruir a mano.
      if (actual.figuras || actual.opciones.length < 3) {
        actual.figuras = true
        const pag = [...actual.paginas].pop()
        actual.opciones = ['A', 'B', 'C', 'D'].map(c => ({ clave: c, texto: `[Opción ${c}: figura, ver PDF p. ${pag}]` }))
      }
      preguntas.push(actual); esperado = actual.numero + 1
    }
    actual = null; candidato = null; fase = 'buscar'
  }
  // Marcadores de opción "X." al inicio de línea o tras 2+ espacios (opciones en columnas/figuras).
  const MARCADOR = /(?:^\s*|\s{2,})([A-D])\.(?=\s|$)/g
  const procesarMarcadores = (cruda, pag) => {
    const marcas = [...cruda.matchAll(MARCADOR)]
    if (!marcas.length) return false
    const indent = cruda.length - cruda.trimStart().length
    if (marcas.length > 1 || marcas[0].index > indent) actual.figuras = true
    marcas.forEach((m, k) => {
      if (opcion) actual.opciones.push({ clave: opcion.clave, texto: limpiar(opcion.texto) })
      const ini = m.index + m[0].length, fin = k + 1 < marcas.length ? marcas[k + 1].index : cruda.length
      opcion = { clave: m[1], texto: cruda.slice(ini, fin).trim(), col: m.index + m[0].indexOf(m[1]) }
    })
    actual.paginas.add(pag)
    return true
  }
  for (let i = sec.desde + 1; i < sec.hasta; i++) {
    const cruda = lineas[i].t, l = cruda.trim(), pag = lineas[i].pag
    if (esRuido(l)) continue
    if (process.env.DEBUG_GUIA === sec.prueba && /^\d{1,2}\./.test(l)) console.error(`[${fase} esperado=${esperado} actual=${actual?.numero ?? '-'}] ${l.slice(0, 60)}`)
    const resp = /^RESPONDA LAS? PREGUNTAS? (\d+)(?: (?:A|Y) (\d+))? DE ACUERDO/i.exec(l)
    if (resp) { cerrar(); rangoCtx = [Number(resp[1]), Number(resp[2] ?? resp[1])]; contexto = { lineas: [], paginas: new Set([pag]) }; continue }
    if (/^CON LA SIGUIENTE INFORMACI[ÓO]N:?$/i.test(l)) continue

    if (fase === 'justificacion') {
      // Un nuevo candidato de pregunta (número siguiente) o un nuevo contexto cierra la justificación.
      const cand = /^(\d{1,2})\.\s*(.*)$/.exec(l)
      if (cand && Number(cand[1]) === actual.numero + 1) { cerrar(); /* cae al flujo de "buscar" más abajo */ }
      else { if (l) actual.justificacion.push(l); continue }
    }
    if (fase === 'meta') {
      const m = LABEL.exec(cruda)
      if (m) { actual.meta.push({ label: m[1].toLowerCase(), valor: m[2].trim() }); if (/^respuesta correcta/i.test(m[1])) actual.vistaClave = true; continue }
      if (actual.vistaClave) { fase = 'justificacion'; actual.justificacion = []; if (l) actual.justificacion.push(l); continue }
      actual.meta.push({ label: null, valor: l }); continue
    }
    if (fase === 'opciones') {
      const m = LABEL.exec(cruda)
      const indent = cruda.length - cruda.trimStart().length
      if (m) {
        // Fin de las opciones: empieza el bloque de metadatos. La línea inmediatamente anterior a la etiqueta puede
        // ser la primera mitad de la afirmación (sin etiqueta, muy sangrada): se saca de la opción y pasa a "sueltos".
        fase = 'meta'; actual.meta = []; actual.vistaClave = false
        if (!actual.figuras && opcion && opcion.extra?.length && opcion.extra.at(-1).indent > opcion.col + 6) {
          const suelta = opcion.extra.pop(); opcion.texto = opcion.texto.slice(0, -(suelta.texto.length + 1)); actual.meta.push({ label: null, valor: suelta.texto })
        }
        if (opcion) { actual.opciones.push({ clave: opcion.clave, texto: limpiar(opcion.texto) }); opcion = null }
        actual.meta.push({ label: m[1].toLowerCase(), valor: m[2].trim() }); if (/^respuesta correcta/i.test(m[1])) actual.vistaClave = true
        continue
      }
      if (procesarMarcadores(cruda, pag)) continue
      if (opcion && l) { opcion.texto += ' ' + l; (opcion.extra ??= []).push({ texto: l, indent }) }
      continue
    }
    if (fase === 'enunciado') {
      if (/(?:^\s*|\s{2,})A\.(?=\s|$)/.test(cruda)) {
        fase = 'opciones'
        const antes = cruda.slice(0, cruda.search(/(?:^\s*|\s{2,})A\.(?=\s|$)/)).trim()
        if (antes) actual.enunciado.push(antes)
        procesarMarcadores(cruda, pag); continue
      }
      const cand = /^(\d{1,2})\.\s*(.*)$/.exec(l)
      if (cand && Number(cand[1]) === esperado) { // candidato más reciente gana: lo anterior era estímulo
        if (contexto) contexto.lineas.push(...actual.enunciado.map(x => x)); actual = { ...actual, enunciado: [cand[2]], paginas: new Set([pag]) }; continue
      }
      actual.enunciado.push(cruda); actual.paginas.add(pag); continue
    }
    // fase === 'buscar'
    const cand = /^(\d{1,2})\.\s*(.*)$/.exec(l)
    if (cand && Number(cand[1]) === esperado) {
      const n = Number(cand[1])
      const enRango = rangoCtx && n >= rangoCtx[0] && n <= rangoCtx[1]
      if (!enRango) { contexto = null; rangoCtx = null }
      actual = { numero: n, enunciado: cand[2] ? [cand[2]] : [], opciones: [], contexto: enRango ? contexto : null, paginas: new Set([pag]) }
      fase = 'enunciado'; continue
    }
    if (contexto) { contexto.lineas.push(cruda); contexto.paginas.add(pag) }
  }
  cerrar()
  salidaPorPrueba[sec.prueba] = preguntas
}

// ── 3. Metadatos → taxonomía ─────────────────────────────────────────────────
const palabras = (t) => new Set(limpiar(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z]+/).filter(w => w.length > 3))
function competenciaPara(prueba, texto) {
  if (!texto) return null
  const a = palabras(texto); let mejor = null, puntaje = 0
  for (const c of tax.competencias.filter(c => c.prueba === prueba)) {
    const b = palabras(c.nombre); const comun = [...a].filter(w => b.has(w)).length / Math.max(1, Math.min(a.size, b.size))
    if (comun > puntaje) { puntaje = comun; mejor = c.id }
  }
  return puntaje >= 0.5 ? mejor : null
}
function componentePara(prueba, meta) {
  const v = (k) => meta.filter(m => m.label === k).map(m => m.valor).join(' ').toLowerCase()
  if (prueba === 'ciencias_naturales') { const c = v('componente'); if (/biol/.test(c)) return 'biologia'; if (/f[ií]s/.test(c)) return 'fisica'; if (/qu[ií]m/.test(c)) return 'quimica'; if (/cts|tecnolog/.test(c)) return 'cts' }
  if (prueba === 'matematicas') { const c = v('contenido'); if (/geom/.test(c)) return 'geometria'; if (/estad|aleat|probab/.test(c)) return 'estadistica'; if (/[áa]lgebra|c[áa]lculo|num[ée]rico|variaci/.test(c)) return 'algebra_calculo' }
  if (prueba === 'lectura_critica') { const c = v('tipo de texto'); if (/discontinuo/.test(c)) return 'texto_discontinuo'; if (/continuo/.test(c)) return 'texto_continuo' }
  if (prueba === 'sociales_ciudadanas') { const c = v('componente') + ' ' + v('contenido'); if (/espac|territ|ambient/.test(c)) return 'espacio_territorio_ambiente'; if (/hist|cultur|tiempo/.test(c)) return 'historia_cultura'; if (/pol[ií]t|econ|poder|organiz|[ée]tic/.test(c)) return 'etico_politico' }
  return null
}

// ── 4. Salida ────────────────────────────────────────────────────────────────
const dir = join(raiz, 'content/importados')
if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
for (const [prueba, preguntas] of Object.entries(salidaPorPrueba)) {
  const salida = preguntas.map(p => {
    const meta = p.meta ?? []
    const valor = (k) => meta.filter(m => m.label === k).map(m => m.valor).filter(Boolean).join(' ')
    const sueltos = meta.filter(m => m.label === null).map(m => m.valor)
    const clave = (valor('respuesta correcta').match(/\b([A-D])\b/) ?? [])[1] ?? null
    const competenciaTxt = limpiar(valor('competencia/afirmación') || valor('competencia'))
    const afirmacion = limpiar([valor('afirmación') || valor('competencia/afirmación'), ...sueltos].join(' '))
    const nivel = Number((valor('nivel de desempeño').match(/\d/) ?? [])[0]) || null
    const ctx = p.contexto ? p.contexto.lineas.join('\n').replace(/\n{3,}/g, '\n\n').trim() : null
    const enunciado = p.enunciado.join('\n').replace(/\n{3,}/g, '\n\n').trim()
    const pags = new Set([...p.paginas, ...(p.contexto ? p.contexto.paginas : [])])
    const conImagen = [...pags].some(n => paginasConImagen.has(n))
    const etiquetas = ['importada', 'icfes', 'explicada_oficial']
    if (!clave) etiquetas.push('sin_clave')
    if (conImagen || pareceTabla(ctx ?? '') || pareceTabla(enunciado)) etiquetas.push('revisar_estimulo')
    const fuenteTexto = /Tomado (y adaptado )?de:?\s*(.+)$/im.exec(ctx ?? '')?.[2]
    const explicacion = limpiar((p.justificacion ?? []).join(' ')).replace(/^[“"]|[”"]$/g, '')
    return {
      id: `${prefijo}-${SUFIJO[prueba]}-${String(p.numero).padStart(3, '0')}`,
      prueba, origen: 'oficial',
      fuente: { nombre: `Guía de orientación Saber 11.º ${anio ?? ''} (ICFES) · ejemplos de preguntas explicadas`.replace(/\s+/g, ' '), url, anio, referencia: `${tax.pruebas.find(x => x.id === prueba)?.nombre ?? prueba}, ejemplo ${p.numero}`, ...(fuenteTexto ? { texto_base: limpiar(fuenteTexto) } : {}) },
      competencia: competenciaPara(prueba, competenciaTxt) ?? competenciaPara(prueba, afirmacion), componente: componentePara(prueba, meta),
      afirmacion, evidencia: '', habilidad: 'comprender', tema: '', subtema: '', dificultad: nivel ? (nivel <= 2 ? 1 : nivel === 3 ? 2 : 3) : 2,
      contexto: ctx ? limpiarParrafos(ctx) : null, estimulo: null,
      enunciado: limpiarParrafos(enunciado),
      opciones: p.opciones.map(o => ({ clave: o.clave, texto: o.texto, correcta: o.clave === clave, explicacion: '', tipo_error: o.clave === clave ? null : 'distractor', diagnostico: o.clave === clave ? null : 'insuficiente', razon_frecuente: null })),
      explicacion, que_identificar: '', que_revisar: '', refuerzo_ids: [], recurso_ids: [], tiempo_sugerido_seg: 120,
      etiquetas, estado: 'pendiente',
      _meta_oficial: Object.fromEntries(meta.filter(m => m.label).map(m => [m.label, m.valor])),
    }
  })
  const ruta = join(dir, `${prefijo.toLowerCase()}-${SUFIJO[prueba].toLowerCase()}.json`)
  // --sin-duplicados: descarta las preguntas (mismo enunciado + opciones) ya presentes en otros archivos de importados/banco.
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
  console.log(`${prueba}: ${final.length} preguntas → ${ruta}`)
  console.log(`  con clave: ${n(p => p.opciones.some(o => o.correcta))} · con competencia: ${n(p => p.competencia)} · con explicación: ${n(p => p.explicacion.length >= 40)} · con contexto: ${n(p => p.contexto)} · revisar_estimulo: ${n(p => p.etiquetas.includes('revisar_estimulo'))}`)
}
for (const o of omitidas) console.log(`  omitido → ${o}`)
if (!secciones.length) console.log('No se encontraron secciones "Ejemplos de preguntas": ¿es una guía 2017?')
