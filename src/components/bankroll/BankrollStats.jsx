import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

function fmt(n) { return '$' + n.toLocaleString('es-CO') }
function pct(n, total) { return total > 0 ? ((n / total) * 100).toFixed(0) + '%' : '--' }

export default function BankrollStats({ hook }) {
  const { state } = hook
  const { apuestas, configuracion } = state

  const resueltas = apuestas.filter(a => a.resultado !== 'pendiente')
  const ganadas = resueltas.filter(a => a.resultado === 'ganada')
  const perdidas = resueltas.filter(a => a.resultado === 'perdida')
  const devueltas = resueltas.filter(a => a.resultado === 'devuelta')
  const conResultado = resueltas.filter(a => a.resultado !== 'devuelta')

  const stakeTotal = conResultado.reduce((s, a) => s + a.monto, 0)
  const retorno = ganadas.reduce((s, a) => s + a.ganancia_real, 0)
  const gananciaNet = retorno - stakeTotal
  const roi = stakeTotal > 0 ? ((gananciaNet / stakeTotal) * 100).toFixed(1) : '--'
  const hitRate = conResultado.length > 0 ? ((ganadas.length / conResultado.length) * 100).toFixed(0) : '--'
  const cuotaPromedio = conResultado.length > 0
    ? (conResultado.reduce((s, a) => s + a.cuota, 0) / conResultado.length).toFixed(2) : '--'

  // Racha actual
  let rachaActual = 0
  let rachaDir = null
  for (let i = resueltas.length - 1; i >= 0; i--) {
    const r = resueltas[i].resultado
    if (r === 'devuelta') continue
    if (rachaDir === null) rachaDir = r
    if (resueltas[i].resultado === rachaDir) rachaActual++
    else break
  }

  // Evolución del bank
  let bankEvo = [{ fecha: 'Inicio', bank: configuracion.bank_inicial }]
  let acum = configuracion.bank_inicial
  for (const a of apuestas) {
    if (a.resultado === 'ganada') acum += a.ganancia_real - a.monto
    else if (a.resultado === 'perdida') acum -= a.monto
    bankEvo.push({ fecha: a.fecha?.slice(5) ?? '', bank: acum })
  }

  // Por mercado
  const porMercado = {}
  for (const a of conResultado) {
    const k = a.mercado
    if (!porMercado[k]) porMercado[k] = { total: 0, gan: 0, stake: 0, retorno: 0 }
    porMercado[k].total++
    if (a.resultado === 'ganada') { porMercado[k].gan++; porMercado[k].retorno += a.ganancia_real }
    porMercado[k].stake += a.monto
  }
  const mercados = Object.entries(porMercado)
    .map(([m, d]) => ({ m, ...d, roi: d.stake > 0 ? (((d.retorno - d.stake) / d.stake) * 100).toFixed(0) : 0 }))
    .sort((a, b) => b.total - a.total)

  // Por casa
  const porCasa = {}
  for (const a of conResultado) {
    const k = a.casa || 'Otra'
    if (!porCasa[k]) porCasa[k] = { total: 0, gan: 0, stake: 0, retorno: 0 }
    porCasa[k].total++
    if (a.resultado === 'ganada') { porCasa[k].gan++; porCasa[k].retorno += a.ganancia_real }
    porCasa[k].stake += a.monto
  }
  const casas = Object.entries(porCasa)
    .map(([c, d]) => ({ c, ...d, roi: d.stake > 0 ? (((d.retorno - d.stake) / d.stake) * 100).toFixed(0) : 0 }))
    .sort((a, b) => b.total - a.total)

  if (apuestas.length === 0) {
    return (
      <div className="p-4 text-center py-16 text-gray-600">
        <p className="text-4xl mb-3">📊</p>
        <p>Aún no hay apuestas registradas</p>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-5">
      <h2 className="text-xl font-black text-white">Estadísticas</h2>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Hit rate', val: hitRate + '%', sub: `${ganadas.length}G / ${perdidas.length}P / ${devueltas.length}D` },
          { label: 'ROI', val: (gananciaNet >= 0 ? '+' : '') + roi + '%', sub: `stake: ${fmt(stakeTotal)}`, color: gananciaNet >= 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'Ganancia neta', val: (gananciaNet >= 0 ? '+' : '') + fmt(gananciaNet), sub: `de ${resueltas.length} apuestas`, color: gananciaNet >= 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'Cuota promedio', val: cuotaPromedio, sub: 'apuestas resueltas' },
        ].map(({ label, val, sub, color }) => (
          <div key={label} className="bg-dark-800 border border-dark-600 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`text-xl font-black ${color || 'text-white'}`}>{val}</p>
            <p className="text-xs text-gray-600 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Racha */}
      {rachaActual > 0 && (
        <div className={`rounded-xl p-4 border ${rachaDir === 'ganada' ? 'bg-green-900/20 border-green-800/40' : 'bg-red-900/20 border-red-800/40'}`}>
          <p className="text-xs text-gray-500 mb-1">Racha actual</p>
          <p className={`text-lg font-black ${rachaDir === 'ganada' ? 'text-green-400' : 'text-red-400'}`}>
            {rachaActual} {rachaDir === 'ganada' ? 'victorias' : 'pérdidas'} seguidas
            {rachaDir === 'ganada' && rachaActual >= 3 ? ' 🔥' : ''}
            {rachaDir === 'perdida' && rachaActual >= 2 ? ' ⚠️' : ''}
          </p>
        </div>
      )}

      {/* Gráfica evolución */}
      {bankEvo.length > 1 && (
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Evolución del bankroll</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={bankEvo}>
              <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#9ca3af' }}
                formatter={v => [fmt(v), 'Bank']}
              />
              <ReferenceLine y={700000} stroke="#f97316" strokeDasharray="3 3" />
              <ReferenceLine y={configuracion.bank_inicial} stroke="#4b5563" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="bank" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 text-xs text-gray-600">
            <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-green-500 inline-block" /> Bank</span>
            <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-orange-500 inline-block border-dashed border-t border-orange-500" /> Peligro $700k</span>
          </div>
        </div>
      )}

      {/* Por mercado */}
      {mercados.length > 0 && (
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Por mercado</p>
          <div className="space-y-2">
            <div className="grid grid-cols-4 text-xs text-gray-600 px-1 mb-1">
              <span>Mercado</span><span className="text-center">Picks</span><span className="text-center">Aciertos</span><span className="text-center">ROI</span>
            </div>
            {mercados.map(({ m, total, gan, roi: r }) => (
              <div key={m} className="grid grid-cols-4 text-sm items-center bg-dark-700 rounded-lg px-3 py-2">
                <span className="text-gray-300 text-xs truncate">{m}</span>
                <span className="text-center text-white font-medium">{total}</span>
                <span className="text-center text-white font-medium">{pct(gan, total)}</span>
                <span className={`text-center font-bold text-xs ${Number(r) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {Number(r) >= 0 ? '+' : ''}{r}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Por casa */}
      {casas.length > 0 && (
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Por casa de apuestas</p>
          <div className="space-y-2">
            {casas.map(({ c, total, gan, roi: r }) => (
              <div key={c} className="grid grid-cols-4 text-sm items-center bg-dark-700 rounded-lg px-3 py-2">
                <span className="text-gray-300 text-xs">{c}</span>
                <span className="text-center text-white font-medium">{total}</span>
                <span className="text-center text-white font-medium">{pct(gan, total)}</span>
                <span className={`text-center font-bold text-xs ${Number(r) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {Number(r) >= 0 ? '+' : ''}{r}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Violaciones */}
      {state.violaciones.length > 0 && (
        <div className="bg-dark-800 border border-red-900/40 rounded-xl p-4">
          <p className="text-xs text-red-500 uppercase tracking-widest mb-3">Intentos de violación de reglas</p>
          <p className="text-2xl font-black text-red-400">{state.violaciones.length}</p>
          <p className="text-xs text-gray-600">veces que intentaste saltarte tus reglas</p>
        </div>
      )}
    </div>
  )
}
