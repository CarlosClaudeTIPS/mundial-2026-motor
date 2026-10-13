// Construye content/referencia-nacional.json con la distribución nacional de puntajes
// Saber 11 (datos abiertos del ICFES en datos.gov.co, conjunto "Resultados únicos Saber 11",
// id kgxf-xxbe) para calcular percentiles en los informes.
//
// Uso: node scripts/referencia-nacional.mjs [periodo]   (por defecto 20224 = aplicación 2022, calendario A)
// Necesita internet. Guarda, por escala, el porcentaje acumulado de evaluados con puntaje
// MENOR que cada valor (0-100 por prueba, 0-500 global) y media/desviación.
import { writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const periodo = process.argv[2] ?? '20224'
const BASE = 'https://www.datos.gov.co/resource/kgxf-xxbe.json'
const ESCALAS = {
  global: { col: 'punt_global', max: 500 },
  lectura_critica: { col: 'punt_lectura_critica', max: 100 },
  matematicas: { col: 'punt_matematicas', max: 100 },
  sociales_ciudadanas: { col: 'punt_sociales_ciudadanas', max: 100 },
  ciencias_naturales: { col: 'punt_c_naturales', max: 100 },
  ingles: { col: 'punt_ingles', max: 100 },
}

async function histograma(col) {
  const url = `${BASE}?$select=${col},count(*)&$group=${col}&$order=${col}&$limit=1000&$where=periodo='${periodo}'`
  // curl respeta HTTPS_PROXY (el fetch de Node no), así funciona en cualquier entorno.
  const filas = JSON.parse(execFileSync('curl', ['-sS', '-m', '180', url], { maxBuffer: 1 << 26 }).toString())
  const h = new Map()
  for (const f of filas) { const v = Number(f[col]); if (Number.isFinite(v)) h.set(v, Number(f.count)) }
  return h
}

const salida = {
  _fuente: 'ICFES, Resultados únicos Saber 11 (datos abiertos, datos.gov.co/kgxf-xxbe)',
  _periodo: periodo,
  _generado: new Date().toISOString().slice(0, 10),
  _nota: 'acumulado[s] = porcentaje de evaluados con puntaje menor que s. Percentil(s) ≈ acumulado[s] + frecuencia[s]/2.',
  escalas: {},
}
for (const [id, { col, max }] of Object.entries(ESCALAS)) {
  const h = await histograma(col)
  const n = [...h.values()].reduce((a, b) => a + b, 0)
  const acumulado = [], frecuencia = []
  let acum = 0, suma = 0, suma2 = 0
  for (let s = 0; s <= max; s++) {
    const c = h.get(s) ?? 0
    acumulado.push(Math.round((acum / n) * 10000) / 100)
    frecuencia.push(Math.round((c / n) * 10000) / 100)
    acum += c; suma += s * c; suma2 += s * s * c
  }
  const media = suma / n, desv = Math.sqrt(suma2 / n - media * media)
  salida.escalas[id] = { n, media: Math.round(media * 10) / 10, desviacion: Math.round(desv * 10) / 10, acumulado, frecuencia }
  console.log(`${id}: n=${n} media=${media.toFixed(1)} desv=${desv.toFixed(1)}`)
}
const ruta = join(raiz, 'content/referencia-nacional.json')
writeFileSync(ruta, JSON.stringify(salida) + '\n')
console.log('→', ruta)
