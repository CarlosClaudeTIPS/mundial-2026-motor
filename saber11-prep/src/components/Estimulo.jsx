// ─── Estímulos: tabla, gráfico de barras, gráfico de líneas, imagen ──────────
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

function Grafico({ e, tipo }) {
  const series = e.series ?? []
  const categorias = [...new Set(series.flatMap(s => s.valores.map(v => String(v[0]))))]
  const valores = series.flatMap(s => s.valores.map(v => Number(v[1])))
  const max = Math.max(1, ...valores)
  const min = Math.min(0, ...valores)
  const W = 520, H = 260, mL = 56, mR = 16, mT = 16, mB = 48
  const w = W - mL - mR, h = H - mT - mB
  const y = (v) => mT + h - ((v - min) / (max - min)) * h
  const nTicks = 5
  const paso = pasoBonito((max - min) / nTicks)
  const ticks = []
  for (let t = Math.ceil(min / paso) * paso; t <= max + 1e-9; t += paso) ticks.push(+t.toFixed(6))
  const grupoW = w / Math.max(1, categorias.length)

  return (
    <figure className="my-3">
      {e.titulo && <p className="text-sm font-medium mb-1">{e.titulo}</p>}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xl bg-dark-800 rounded-xl border border-dark-700" role="img" aria-label={e.titulo ?? 'Gráfico'}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={mL} x2={W - mR} y1={y(t)} y2={y(t)} stroke="#E2E8F0" strokeWidth="0.5" />
            <text x={mL - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#94A3B8">{t.toLocaleString('es-CO')}</text>
          </g>
        ))}
        <line x1={mL} x2={W - mR} y1={y(0)} y2={y(0)} stroke="#94A3B8" strokeWidth="1" />
        {categorias.map((c, i) => (
          <text key={c} x={mL + grupoW * i + grupoW / 2} y={H - mB + 16} textAnchor="middle" fontSize="11" fill="#434766">{c}</text>
        ))}
        {tipo === 'barras' && series.map((s, si) => {
          const barW = Math.min(40, (grupoW * 0.7) / series.length)
          return s.valores.map(([cat, val]) => {
            const ci = categorias.indexOf(String(cat))
            const x = mL + grupoW * ci + grupoW / 2 - (barW * series.length) / 2 + si * barW
            const v = Number(val)
            return (
              <g key={cat}>
                <rect x={x} y={Math.min(y(v), y(0))} width={barW - 2} height={Math.abs(y(0) - y(v))} fill={COLORES[si % COLORES.length]} rx="2" />
                <text x={x + (barW - 2) / 2} y={y(v) - 4} textAnchor="middle" fontSize="10" fill="#2B2A63">{v.toLocaleString('es-CO')}</text>
              </g>
            )
          })
        })}
        {tipo === 'lineas' && series.map((s, si) => {
          const pts = s.valores.map(([cat, val]) => [mL + grupoW * categorias.indexOf(String(cat)) + grupoW / 2, y(Number(val))])
          return (
            <g key={s.nombre}>
              <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={COLORES[si % COLORES.length]} strokeWidth="2" />
              {pts.map((p, i) => <g key={i}><circle cx={p[0]} cy={p[1]} r="3.5" fill={COLORES[si % COLORES.length]} /><text x={p[0]} y={p[1] - 8} textAnchor="middle" fontSize="10" fill="#2B2A63">{Number(s.valores[i][1]).toLocaleString('es-CO')}</text></g>)}
            </g>
          )
        })}
        {e.eje_y && <text x={12} y={mT + 8} fontSize="10" fill="#94A3B8">{e.eje_y}</text>}
        {e.eje_x && <text x={W - mR} y={H - 6} textAnchor="end" fontSize="10" fill="#94A3B8">{e.eje_x}</text>}
      </svg>
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
