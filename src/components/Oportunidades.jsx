import { useState, useEffect } from 'react'
import { listarOportunidades, avisosCorrelacion } from '../lib/market-engine'

// ─── OPPORTUNITY RANKING (spec maestro §47) ──────────────────────────────────
// Junta las evaluaciones activas de TODOS los módulos del partido (las que
// tienen línea+cuota ingresadas) y las ordena por calidad → edge.
// Incluye el aviso de correlación (§46): dos BET del mismo grupo causal no
// son apuestas independientes.

const Q_STYLE = {
  A: 'bg-green-700 text-white',
  B: 'bg-yellow-700 text-white',
  C: 'bg-orange-800 text-orange-100',
}

export default function Oportunidades({ matchId }) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10_000)
    return () => clearInterval(id)
  }, [])

  if (!matchId) return null
  const ops = listarOportunidades(matchId) // eslint-disable-line no-unused-vars
  void tick
  if (!ops.length) return null

  const bets = ops.filter(o => o.signal === 'BET')
  const avisos = avisosCorrelacion(bets)

  return (
    <div className="rounded-2xl border-2 border-emerald-700/60 bg-gradient-to-b from-emerald-950/40 to-dark-800 p-4 space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-black text-emerald-300 tracking-wide">📊 OPORTUNIDADES DEL PARTIDO</h2>
        <span className="text-[10px] text-gray-500">solo mercados con línea y cuota ingresadas · orden: calidad → edge</span>
      </div>

      {ops.map((o, i) => (
        <div key={o.label + o.line} className={`flex items-center gap-3 flex-wrap rounded-lg px-3 py-2 border ${
          o.signal === 'BET' ? 'bg-dark-800/80 border-emerald-800/50' : 'bg-dark-800/40 border-dark-700 opacity-70'
        }`}>
          <span className="text-lg font-black text-gray-600 w-5">{i + 1}</span>
          {o.signal === 'BET'
            ? <span className={`text-xs font-black px-2 py-0.5 rounded ${Q_STYLE[o.quality] ?? 'bg-dark-600'}`}>Calidad {o.quality}</span>
            : <span className="text-xs font-bold px-2 py-0.5 rounded bg-dark-600 text-gray-400">NO BET</span>}
          <span className="text-white font-bold text-sm">{o.label}</span>
          <div className="ml-auto flex items-center gap-3 text-xs">
            {o.edgeLado != null && <span className={o.edgeLado > 0 ? 'text-green-400 font-bold' : 'text-red-400'}>edge {o.edgeLado > 0 ? '+' : ''}{o.edgeLado} pp</span>}
            {o.evPct != null && <span className="text-emerald-300">EV {o.evPct > 0 ? '+' : ''}{o.evPct}%</span>}
            <span className="text-gray-500">conf {o.conf}</span>
            <span className="text-gray-600">min {o.minuto}'</span>
          </div>
        </div>
      ))}

      {avisos.map((a, i) => (
        <p key={i} className="text-[11px] text-yellow-500/90 bg-yellow-950/30 border border-yellow-900/40 rounded-lg px-3 py-2">{a}</p>
      ))}
      <p className="text-[10px] text-gray-600">La calidad A/B/C es provisional hasta calibrarla con el live-backtest — y recuerda las reglas del bankroll: máx $25k por apuesta, 4 al día.</p>
    </div>
  )
}
