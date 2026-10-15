// ─── Estímulos: tabla, gráfico de barras, gráfico de líneas, imagen ──────────
import { useEffect, useRef, useState } from 'react'
// Se dibujan con SVG propio (sin librerías) para que pesen poco y funcionen
// sin conexión e impresos.

export default function Estimulo({ estimulo }) {
  if (!estimulo) return null
  switch (estimulo.tipo) {
    case 'tabla': return <Tabla e={estimulo} />
    case 'barras': return <Grafico e={estimulo} tipo="barras" />
    case 'lineas': return <Grafico e={estimulo} tipo="lineas" />
    case 'imagen': return (
      <figure className="my-3">
        <img src={estimulo.url} alt={estimulo.alt} className="max-w-full rounded-lg border border-dark-700" />
        {estimulo.alt && <figcaption className="text-xs text-gray-500 mt-1">{estimulo.alt}</figcaption>}
      </figure>
    )
    default: return null
  }
}

function Tabla({ e }) {
  return (
    <div className="my-3 overflow-x-auto">
      {e.titulo && <p className="text-sm font-medium mb-1">{e.titulo}</p>}
      <table className="text-sm border-collapse min-w-[50%]">
        <thead>
          <tr>{e.columnas.map((c, i) => <th key={i} className="border border-dark-600 bg-dark-700 px-2 py-1 text-left font-medium">{c}</th>)}</tr>
        </thead>
        <tbody>
          {e.filas.map((f, i) => (
            <tr key={i}>{f.map((c, j) => <td key={j} className={`border border-dark-600 px-2 py-1 ${typeof c === 'number' ? 'text-right tabular-nums' : ''}`}>{typeof c === 'number' ? c.toLocaleString('es-CO') : c}</td>)}</tr>
          ))}
        </tbody>
      </table>
      {e.nota && <p className="text-xs text-gray-500 mt-1">{e.nota}</p>}
    </div>
  )
}

const COLORES = ["#1FA9EC", "#F59E0B", "#10B981", "#EC4899", "#8B5CF6"]
const FONDO = '#FFFFFF'
const TXT = '#2B2A63'

// Acepta números escritos como "3,5" o "1.050" (formato colombiano) además de 3.5.
export function numero(v) {
  if (typeof v === 'number') return v
  const t = String(v ?? '').trim().replace(/\s/g, '')
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'))
  return Number(t.replace(',', '.'))
}

const fmt = (v) => Number(v).toLocaleString('es-CO', { maximumFractionDigits: 2 })

// Parte un rótulo largo en varias líneas para que no se monte sobre el vecino.
function partir(texto, maxChars) {
  const palabras = String(texto).split(/\s+/)
  const lineas = []
  let actual = ''
  for (const pal of palabras) {
    if (!actual) actual = pal
    else if ((actual + ' ' + pal).length <= maxChars) actual += ' ' + pal
    else { lineas.push(actual); actual = pal }
  }
  if (actual) lineas.push(actual)
  return lineas.slice(0, 4)
}

// Texto con "halo" del color del fondo: las líneas y la cuadrícula nunca
// quedan encima de los números.
function Rotulo({ x, y, children, anchor = 'middle', size = 12, color = TXT, peso = 600 }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} fontWeight={peso} fill={color}
      stroke={FONDO} strokeWidth="4" strokeLinejoin="round" paintOrder="stroke" style={{ fontVariantNumeric: 'tabular-nums' }}>
      {children}
    </text>
  )
}

// El gráfico se dibuja al ancho real del contenedor (1 unidad = 1 px), así
// los números miden lo mismo en celular que en computador y no se encogen.
function useAncho(ref, inicial = 560) {
  const [ancho, setAncho] = useState(inicial)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const medir = () => { const a = Math.round(el.getBoundingClientRect().width); if (a > 0) setAncho(a) }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return ancho
}

function Grafico({ e, tipo }) {
  const cont = useRef(null)
  const ancho = useAncho(cont)
  const series = (e.series ?? []).map(s => ({ ...s, valores: (s.valores ?? []).map(([c, v]) => [String(c), numero(v)]).filter(([, v]) => Number.isFinite(v)) }))
  const categorias = [...new Set(series.flatMap(s => s.valores.map(v => v[0])))]
  const valores = series.flatMap(s => s.valores.map(v => v[1]))
  if (!categorias.length || !valores.length) return null
  const maxDato = Math.max(...valores), minDato = Math.min(0, ...valores)
  const nTicks = 5
  const paso = pasoBonito(Math.max(1e-9, (maxDato - minDato) / nTicks))
  const max = Math.max(paso, Math.ceil(maxDato / paso) * paso)
  const min = Math.floor(minDato / paso) * paso
  const ticks = []
  for (let t = min; t <= max + 1e-9; t += paso) ticks.push(+t.toFixed(6))

  const W = Math.max(300, Math.min(640, ancho))
  const maxCharsCat = Math.max(4, Math.floor((W * 0.8 / categorias.length) / 7))
  // Si algún rótulo tiene una palabra que no cabe (p. ej. en celular), el eje
  // muestra números y la equivalencia va en una leyenda debajo del gráfico.
  const leyendaNumerada = categorias.some(c => String(c).split(/\s+/).some(p => p.length > maxCharsCat))
  const catLineas = leyendaNumerada ? categorias.map((_, i) => [String(i + 1)]) : categorias.map(c => partir(c, maxCharsCat))
  const nLineasCat = Math.max(...catLineas.map(l => l.length))
  const anchoTick = Math.max(...ticks.map(t => fmt(t).length)) * 7.5 + 14
  const mL = Math.max(44, anchoTick), mR = 18
  const ejeYLineas = e.eje_y ? partir(e.eje_y, Math.floor((W - mL - mR) / 6.2)) : []
  const mT = (ejeYLineas.length ? 8 + ejeYLineas.length * 14 : 8) + 18   // banda del título del eje y + espacio del valor más alto
  const mB = 10 + nLineasCat * 14 + (e.eje_x ? 16 : 0)
  const H = 200 + mT + mB
  const w = W - mL - mR, h = H - mT - mB
  const y = (v) => mT + h - ((v - min) / (max - min)) * h
  const grupoW = w / categorias.length
  const xCat = (i) => mL + grupoW * i + grupoW / 2

  // Posición de cada valor: arriba del punto, salvo que otra serie tenga un
  // punto justo encima; entonces va debajo. Siempre dentro del área del gráfico.
  const puntos = series.map((s, si) => s.valores.map(([cat, val]) => ({ si, cat, val, x: xCat(categorias.indexOf(cat)), y: y(val) })))
  const posRotulo = (p) => {
    const otros = puntos.flat().filter(q => q !== p && q.cat === p.cat)
    const hayArriba = otros.some(q => q.y < p.y && p.y - q.y < 22)
    const hayAbajo = otros.some(q => q.y > p.y && q.y - p.y < 22)
    let yy = hayArriba && !hayAbajo ? p.y + 17 : p.y - 8
    if (yy < mT + 10) yy = p.y + 17
    if (yy > mT + h - 2) yy = p.y - 8
    return yy
  }

  return (
    <figure className="my-3">
      {e.titulo && <p className="text-sm font-medium mb-1">{e.titulo}</p>}
      <div ref={cont} className="max-w-2xl">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full rounded-xl border border-dark-700" style={{ background: FONDO }} role="img" aria-label={e.titulo ?? 'Gráfico'}>
          {/* Cuadrícula y eje y */}
          {ticks.map(t => (
            <g key={t}>
              <line x1={mL} x2={W - mR} y1={y(t)} y2={y(t)} stroke="#E2E8F0" strokeWidth="1" strokeDasharray={t === 0 ? undefined : '3 3'} />
              <text x={mL - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill="#64748B" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(t)}</text>
            </g>
          ))}
          <line x1={mL} x2={mL} y1={mT - 4} y2={mT + h} stroke="#94A3B8" strokeWidth="1" />
          <line x1={mL} x2={W - mR} y1={y(0)} y2={y(0)} stroke="#64748B" strokeWidth="1.2" />
          {/* Rótulos de categorías */}
          {catLineas.map((lineas, i) => lineas.map((l, k) => (
            <text key={`${i}-${k}`} x={xCat(i)} y={mT + h + 16 + k * 14} textAnchor="middle" fontSize="12" fill="#434766">{l}</text>
          )))}
          {/* Barras */}
          {tipo === 'barras' && series.map((s, si) => {
            const barW = Math.min(44, (grupoW * 0.72) / series.length)
            return s.valores.map(([cat, v]) => {
              const ci = categorias.indexOf(cat)
              const x = xCat(ci) - (barW * series.length) / 2 + si * barW
              return <rect key={cat} x={x + 1} y={Math.min(y(v), y(0))} width={Math.max(1, barW - 2)} height={Math.abs(y(0) - y(v))} fill={COLORES[si % COLORES.length]} rx="2" />
            })
          })}
          {/* Líneas y puntos */}
          {tipo === 'lineas' && puntos.map((pts, si) => (
            <g key={si}>
              <polyline points={pts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={COLORES[si % COLORES.length]} strokeWidth="2.5" strokeLinejoin="round" />
              {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill={COLORES[si % COLORES.length]} stroke={FONDO} strokeWidth="1.5" />)}
            </g>
          ))}
          {/* Valores: se dibujan de últimos para que nada quede encima */}
          {tipo === 'barras' && series.map((s, si) => {
            const barW = Math.min(44, (grupoW * 0.72) / series.length)
            return s.valores.map(([cat, v]) => {
              const ci = categorias.indexOf(cat)
              const x = xCat(ci) - (barW * series.length) / 2 + si * barW + barW / 2
              const yy = v >= 0 ? Math.max(mT + 10, y(v) - 6) : Math.min(mT + h - 2, y(v) + 14)
              return <Rotulo key={cat} x={x} y={yy} size={11}>{fmt(v)}</Rotulo>
            })
          })}
          {tipo === 'lineas' && puntos.flat().map((p, i) => <Rotulo key={i} x={p.x} y={posRotulo(p)} size={11}>{fmt(p.val)}</Rotulo>)}
          {/* Títulos de los ejes en su propia banda, sin tocar los números */}
          {ejeYLineas.map((l, k) => <text key={k} x={mL} y={14 + k * 14} fontSize="11" fill="#64748B">{l}</text>)}
          {e.eje_x && <text x={W - mR} y={H - 6} textAnchor="end" fontSize="11" fill="#64748B">{e.eje_x}</text>}
        </svg>
      </div>
      {leyendaNumerada && (
        <ol className="mt-1 text-xs text-gray-400 grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          {categorias.map((c, i) => <li key={c}><span className="font-semibold text-brand-navy">{i + 1}</span> = {c}</li>)}
        </ol>
      )}
      {series.length > 1 && (
        <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-300">
          {series.map((s, i) => <span key={s.nombre} className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: COLORES[i % COLORES.length] }} />{s.nombre}</span>)}
        </div>
      )}
      {e.nota && <p className="text-xs text-gray-500 mt-1">{e.nota}</p>}
    </figure>
  )
}

function pasoBonito(x) {
  if (x <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(x)))
  const r = x / p
  return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * p
}
