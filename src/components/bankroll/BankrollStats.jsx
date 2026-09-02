import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

function fmt(n) { return '$' + Math.round(n).toLocaleString('es-CO') }
function pct(n, total) { return total > 0 ? ((n / total) * 100).toFixed(0) + '%' : '--' }

// ─── Rango de fechas del filtro ──────────────────────────────────────────────
const PERIODOS = [
  { id: 'todo', label: 'Todo' },
  { id: 'hoy', label: 'Hoy' },
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
]
function enPeriodo(fecha, periodo) {
  if (periodo === 'todo' || !fecha) return true
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const f = new Date(fecha + 'T00:00:00')
  if (periodo === 'hoy') return f.getTime() === hoy.getTime()
  const dias = periodo === '7d' ? 7 : 30
  return (hoy - f) / 86400000 < dias
}

// Deporte / liga / mercado que representa una apuesta (las combinadas van juntas)
function deporteDe(a) { return a.tipo === 'multiple' ? 'Combinadas' : (a.deporte || 'Sin deporte') }
function ligaDe(a)    { return a.tipo === 'multiple' ? 'Combinadas' : (a.competicion || 'Sin liga') }
function mercadoDe(a) { return a.tipo === 'multiple' ? 'Combinadas' : (a.mercado || 'Sin mercado') }

// Agrupa apuestas resueltas por una clave y calcula rendimiento
function agrupar(apuestas, keyFn) {
  const g = {}
  for (const a of apuestas) {
    const k = keyFn(a)
    if (!g[k]) g[k] = { k, total: 0, gan: 0, perd: 0, stake: 0, retorno: 0 }
    g[k].total++
    g[k].stake += a.monto
    if (a.resultado === 'ganada') { g[k].gan++; g[k].retorno += a.ganancia_real }
    if (a.resultado === 'perdida') g[k].perd++
  }
  return Object.values(g)
    .map(d => ({ ...d, neto: d.retorno - d.stake, roi: d.stake > 0 ? ((d.retorno - d.stake) / d.stake) * 100 : 0 }))
    .sort((a, b) => b.total - a.total)
}

function TablaGrupo({ titulo, filas, emoji }) {
  if (!filas.length) return null
  return (
    <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">{emoji} {titulo}</p>
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1.5 text-xs items-center">
        <span className="text-gray-600">—</span>
        <span className="text-gray-600 text-center w-10">Ap.</span>
        <span className="text-gray-600 text-center w-12">Acierto</span>
        <span className="text-gray-600 text-right w-16">Neto</span>
        {filas.map(f => (
          <FilaGrupo key={f.k} f={f} />
        ))}
      </div>
    </div>
  )
}
function FilaGrupo({ f }) {
  return (
    <>
      <span className="text-gray-300 truncate" title={f.k}>{f.k}</span>
      <span className="text-center text-white w-10">{f.total}</span>
      <span className="text-center text-gray-300 w-12">{pct(f.gan, f.gan + f.perd)}</span>
      <span className={`text-right font-bold w-16 ${f.neto >= 0 ? 'text-green-400' : 'text-red-400'}`}>
        {f.neto >= 0 ? '+' : '−'}{fmt(Math.abs(f.neto)).replace('$', '')}
      </span>
    </>
  )
}

export default function BankrollStats({ hook }) {
  const { state } = hook
  const { apuestas, configuracion } = state
  const [periodo, setPeriodo] = useState('todo')

  if (apuestas.length === 0) {
    return (
      <div className="p-4 text-center py-16 text-gray-600">
        <p className="text-4xl mb-3">📊</p>
        <p>Aún no hay apuestas registradas</p>
      </div>
    )
  }

  const delPeriodo = apuestas.filter(a => enPeriodo(a.fecha, periodo))
  const resueltas = delPeriodo.filter(a => a.resultado !== 'pendiente')
  const conResultado = resueltas.filter(a => a.resultado !== 'devuelta')
  const ganadas = conResultado.filter(a => a.resultado === 'ganada')
  const perdidas = conResultado.filter(a => a.resultado === 'perdida')
  const devueltas = resueltas.filter(a => a.resultado === 'devuelta')

  const stakeTotal = conResultado.reduce((s, a) => s + a.monto, 0)
  const retorno = ganadas.reduce((s, a) => s + a.ganancia_real, 0)
  const gananciaNet = retorno - stakeTotal
  const roi = stakeTotal > 0 ? ((gananciaNet / stakeTotal) * 100).toFixed(1) : '--'
  const hitRate = conResultado.length > 0 ? ((ganadas.length / conResultado.length) * 100).toFixed(0) : '--'
  const cuotaPromedio = conResultado.length > 0
    ? (conResultado.reduce((s, a) => s + a.cuota, 0) / conResultado.length).toFixed(2) : '--'

  const porDeporte = agrupar(conResultado, deporteDe)
  const porLiga = agrupar(conResultado, ligaDe)
  const porMercado = agrupar(conResultado, mercadoDe)
  const porCasa = agrupar(conResultado, a => a.casa || 'Otra')

  // Lo mejor y lo peor (mínimo 2 apuestas para que signifique algo)
  const candidatos = [
    ...porDeporte.map(d => ({ ...d, tipo: 'deporte' })),
    ...porMercado.map(d => ({ ...d, tipo: 'mercado' })),
    ...porLiga.map(d => ({ ...d, tipo: 'liga' })),
  ].filter(d => d.total >= 2)
  const mejor = candidatos.length ? candidatos.reduce((a, b) => b.roi > a.roi ? b : a) : null
  const peor = candidatos.length ? candidatos.reduce((a, b) => b.roi < a.roi ? b : a) : null

  // Evolución del bank (historia completa, no filtrada)
  const bankEvo = [{ fecha: 'Inicio', bank: configuracion.bank_inicial }]
  let acum = configuracion.bank_inicial
  for (const a of apuestas) {
    if (a.resultado === 'ganada') acum += a.ganancia_real - a.monto
    else if (a.resultado === 'perdida') acum -= a.monto
    if (a.resultado === 'ganada' || a.resultado === 'perdida') bankEvo.push({ fecha: a.fecha?.slice(5) ?? '', bank: acum })
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-black text-white">📊 Informe</h2>
        <div className="flex gap-1 bg-dark-800 border border-dark-600 rounded-lg p-1">
          {PERIODOS.map(p => (
            <button key={p.id} onClick={() => setPeriodo(p.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                periodo === p.id ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {conResultado.length === 0 ? (
        <p className="text-center text-gray-600 py-10">Sin apuestas resueltas en este periodo</p>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Ganancia neta', val: (gananciaNet >= 0 ? '+' : '−') + fmt(Math.abs(gananciaNet)), sub: `${conResultado.length} apuestas`, color: gananciaNet >= 0 ? 'text-green-400' : 'text-red-400' },
              { label: 'ROI', val: (gananciaNet >= 0 ? '+' : '') + roi + '%', sub: `stake ${fmt(stakeTotal)}`, color: gananciaNet >= 0 ? 'text-green-400' : 'text-red-400' },
              { label: 'Acierto', val: hitRate + '%', sub: `${ganadas.length}G / ${perdidas.length}P${devueltas.length ? ` / ${devueltas.length}D` : ''}` },
              { label: 'Cuota media', val: cuotaPromedio, sub: 'apuestas resueltas' },
            ].map(({ label, val, sub, color }) => (
              <div key={label} className="bg-dark-800 border border-dark-600 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className={`text-xl font-black ${color || 'text-white'}`}>{val}</p>
                <p className="text-xs text-gray-600 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {/* Lo mejor / lo peor */}
          {(mejor || peor) && (
            <div className="grid grid-cols-2 gap-3">
              {mejor && (
                <div className="bg-green-950/30 border border-green-800/40 rounded-xl p-4">
                  <p className="text-xs text-green-500 uppercase tracking-widest mb-1">🏆 Tu fuerte</p>
                  <p className="text-white font-bold text-sm truncate" title={mejor.k}>{mejor.k}</p>
                  <p className="text-[11px] text-gray-500 capitalize">{mejor.tipo} · {mejor.total} apuestas</p>
                  <p className="text-green-400 font-black mt-1">{mejor.roi >= 0 ? '+' : ''}{mejor.roi.toFixed(0)}% ROI</p>
                </div>
              )}
              {peor && peor.k !== mejor?.k && (
                <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-4">
                  <p className="text-xs text-red-500 uppercase tracking-widest mb-1">🩹 Tu punto débil</p>
                  <p className="text-white font-bold text-sm truncate" title={peor.k}>{peor.k}</p>
                  <p className="text-[11px] text-gray-500 capitalize">{peor.tipo} · {peor.total} apuestas</p>
                  <p className="text-red-400 font-black mt-1">{peor.roi >= 0 ? '+' : ''}{peor.roi.toFixed(0)}% ROI</p>
                </div>
              )}
            </div>
          )}

          <TablaGrupo titulo="Por deporte" emoji="🏅" filas={porDeporte} />
          <TablaGrupo titulo="Por liga / competición" emoji="🌍" filas={porLiga} />
          <TablaGrupo titulo="Por mercado" emoji="🎯" filas={porMercado} />
          <TablaGrupo titulo="Por casa de apuestas" emoji="🏠" filas={porCasa} />
        </>
      )}

      {/* Evolución del bank (histórico completo) */}
      {bankEvo.length > 1 && (
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Evolución del bankroll (todo)</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={bankEvo}>
              <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#9ca3af' }}
                formatter={v => [fmt(v), 'Bank']}
              />
              <ReferenceLine y={configuracion.bank_inicial} stroke="#4b5563" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="bank" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Violaciones */}
      {state.violaciones.length > 0 && (
        <div className="bg-dark-800 border border-red-900/40 rounded-xl p-4">
          <p className="text-xs text-red-500 uppercase tracking-widest mb-2">Intentos de saltarte tus reglas</p>
          <p className="text-2xl font-black text-red-400">{state.violaciones.length}</p>
        </div>
      )}
    </div>
  )
}
