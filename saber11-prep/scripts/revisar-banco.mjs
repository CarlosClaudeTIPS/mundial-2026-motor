// Revisión de calidad del banco (heurísticas, no sustituye la lectura humana).
// Uso: node scripts/revisar-banco.mjs [archivo.json …]   (sin argumentos: todo content/banco)
// Sale con código 1 si algún archivo supera los umbrales marcados con ✖.
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const dirBanco = join(raiz, 'content/banco')
const args = process.argv.slice(2)
const archivos = args.length ? args : readdirSync(dirBanco).filter(f => f.endsWith('.json')).sort().map(f => join(dirBanco, f))

const RE_SUELTA = /(?:\b(?:la|el|respuesta|alternativa|literal|clave|letra)\s+\(?[A-D]\)?(?![A-Za-zÁÉÍÓÚáéíóúÑñ.])|\(\s*[A-D]\s*\)|\b[A-D]\s+[yo]\s+[A-D]\b|VERIFICAR:\s*[A-D]\b)/
const PASOS = ['LEER', 'COMPRENDER', 'INTERPRETAR', 'RAZONAR', 'RESOLVER', 'VERIFICAR']
let fallo = false
const todas = []

for (const ruta of archivos) {
  const lista = JSON.parse(readFileSync(ruta, 'utf8'))
  const n = lista.length
  const letras = {}, avisos = []
  let masLarga = 0, citanLetra = 0, sinPasos = 0, opcionesCortas = 0, explCortas = 0, racha = 1, maxRacha = 1, prev = null
  for (const p of lista) {
    todas.push(p)
    const c = p.opciones.find(o => o.correcta)
    letras[c.clave] = (letras[c.clave] ?? 0) + 1
    racha = c.clave === prev ? racha + 1 : 1; maxRacha = Math.max(maxRacha, racha); prev = c.clave
    const lens = p.opciones.map(o => o.texto.length)
    if (c.texto.length === Math.max(...lens) && c.texto.length > Math.min(...lens) * 1.4) masLarga++
    const textos = [p.explicacion, p.que_identificar, p.que_revisar, ...p.opciones.flatMap(o => [o.explicacion, o.razon_frecuente])].filter(Boolean).join(' | ')
    if (RE_SUELTA.test(textos)) citanLetra++
    const pasos = PASOS.filter(s => new RegExp(s, 'i').test(p.explicacion)).length
    if (pasos < 4) sinPasos++
    if (p.opciones.some(o => o.texto.trim().length < 2)) opcionesCortas++
    if (p.opciones.some(o => !o.correcta && (o.explicacion ?? '').length < 60)) explCortas++
    const dupTexto = new Set(p.opciones.map(o => o.texto.trim().toLowerCase())).size !== p.opciones.length
    if (dupTexto) avisos.push(`${p.id}: opciones repetidas`)
    if (/\b(todas|ninguna) de las anteriores\b/i.test(p.opciones.map(o => o.texto).join(' '))) avisos.push(`${p.id}: "todas/ninguna de las anteriores"`)
    if (p.prueba === 'lectura_critica' && (!p.contexto || p.contexto.split(/\s+/).length < 60)) avisos.push(`${p.id}: lectura sin contexto suficiente`)
  }
  const pct = (k) => Math.round(k / n * 100)
  const [letraMax, nMax] = Object.entries(letras).sort((a, b) => b[1] - a[1])[0]
  const mal = (cond) => { if (cond) fallo = true; return cond ? '✖' : '✔' }
  console.log(`\n${basename(ruta)} · ${n} preguntas`)
  console.log(`  ${mal(nMax / n > 0.4 && n >= 10)} letras: ${JSON.stringify(letras)} (máx. ${letraMax} ${pct(nMax)} %, racha ${maxRacha})`)
  console.log(`  ${mal(masLarga / n > 0.4)} correcta es la más larga: ${pct(masLarga)} % (meta ≤ 35 %)`)
  console.log(`  ${mal(citanLetra / n > 0.2)} citan letras sueltas en explicaciones: ${pct(citanLetra)} %`)
  console.log(`  ${mal(sinPasos > 0)} explicación sin los pasos LEER…VERIFICAR: ${sinPasos}`)
  console.log(`  ${mal(explCortas / n > 0.2)} distractores con explicación corta (< 60 car.): ${explCortas}`)
  if (opcionesCortas) console.log(`  · opciones de 1 carácter: ${opcionesCortas}`)
  for (const a of avisos) console.log('  ·', a)
}

// Duplicados entre archivos: mismo enunciado + mismas opciones
const vistos = new Map()
for (const p of todas) {
  const k = (p.enunciado + '|' + p.opciones.map(o => o.texto).join('|')).toLowerCase().replace(/\s+/g, ' ')
  if (vistos.has(k)) { console.log(`\n✖ ${p.id} duplica a ${vistos.get(k)}`); fallo = true } else vistos.set(k, p.id)
}
console.log(fallo ? '\nHay archivos fuera de los umbrales (✖).' : '\nTodo dentro de los umbrales ✔')
process.exit(fallo ? 1 : 0)
