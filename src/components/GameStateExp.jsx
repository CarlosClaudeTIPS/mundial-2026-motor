import { useMemo } from 'react'
import { explicacionLive, queCambio } from '../lib/live-explain'

// ─── Bloque EXPERIMENTAL dentro de cada panel live (tiros, córners) ──────────
// Muestra: baseline vs experimental, contribuciones reales, explicación
// estructurada (§60) y "qué cambió" (§43). NO decide señales: el texto lo dice.

export default function GameStateExp({ gs, model, lado = 'T', mercado, nombres, edge, baseline, prevSnap, prevGs }) {
  const ex = useMemo(() => explicacionLive({ gs, model, lado, mercado, nombres, edge, baseline }), [gs, model, lado, mercado, nombres, edge, baseline])
  const cambio = useMemo(() => {
    if (!model || !prevSnap) return null
    const lineCentral = Math.floor(model.expectedFinal) + 0.5
    return queCambio(prevSnap, {
      min: model.minuto, acum: model.acum, proj: model.expectedFinal, projExp: model.expectedFinalExp,
      lineCentral, pCentral: model.pOver?.(lineCentral), pCentralExp: model.pOverExp?.(lineCentral), gs,
    }, prevGs)
  }, [model, prevSnap, prevGs, gs])

  if (!gs || !model) return null
  if (!model.gsUsado) return (
    <p className="text-[11px] text-gray-500 bg-dark-800/50 rounded-lg px-2 py-1.5 border border-dark-600">
      🧠 Estado del partido: sin prior de fuerza para ambos equipos → la proyección experimental no aplica (no se inventa).
    </p>
  )

  return (
    <div className="rounded-xl border border-violet-800/50 bg-violet-950/20 p-3 space-y-2 text-[11px]">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="font-bold text-violet-300">🧠 Estado del partido — proyección EXPERIMENTAL (en paralelo)</p>
        <span className="text-[10px] text-yellow-600/90">no decide señales · se registra para el backtest comparado</span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span className="text-gray-400">Baseline: <strong className="text-white">{ex.proyBase}</strong></span>
        <span className="text-gray-400">Experimental: <strong className={ex.difPct > 3 ? 'text-orange-300' : ex.difPct < -3 ? 'text-blue-300' : 'text-white'}>{ex.proyExp}</strong>
          {ex.difPct != null && <span className="text-gray-500"> ({ex.difPct > 0 ? '+' : ''}{ex.difPct}%)</span>}</span>
        <span className="text-gray-500">ajuste por estado ×{ex.factorBase.toFixed(2)} → ×{ex.factorExp.toFixed(2)} sobre {ex.foco}</span>
      </div>

      <div className="flex flex-wrap gap-1.5 text-[10px]">
        {ex.contribuciones.map(c => (
          <span key={c.factor} className={`px-2 py-0.5 rounded border ${
            c.valor > 0.01 ? 'bg-green-950/40 border-green-900/50 text-green-300'
              : c.valor < -0.01 ? 'bg-orange-950/40 border-orange-900/50 text-orange-300'
              : 'bg-dark-700 border-dark-600 text-gray-400'}`}>
            {c.factor}: {c.valor > 0 ? '+' : ''}{Math.round(c.valor * 100)}% <span className="opacity-70">({c.nota})</span>
          </span>
        ))}
      </div>

      <div className="space-y-0.5 text-gray-300">
        <p><b className="text-gray-500">SITUACIÓN</b> · {ex.situacion}</p>
        <p><b className="text-gray-500">RESPUESTA</b> · {ex.respuesta}</p>
        <p><b className="text-gray-500">RITMO</b> · {ex.ritmo}</p>
        <p><b className="text-gray-500">TIEMPO</b> · {ex.tiempo}{ex.chasing?.chasing ? ` Persecución efectiva: ${ex.chasing.nivel} (${ex.chasing.score}/100).` : ''} Cierre: {ex.cierre?.nivel}.</p>
        <p><b className="text-gray-500">OPONENTE</b> · {ex.oponente}</p>
        <p className="text-violet-300"><b className="text-gray-500">PROYECCIÓN</b> · {ex.proyeccion}</p>
        <p className="text-yellow-500/90"><b className="text-gray-500">RIESGO</b> · {ex.riesgo}</p>
        <p><b className="text-gray-500">DECISIÓN</b> · {ex.decision}</p>
      </div>

      {cambio && (
        <div className="border-t border-violet-900/40 pt-2">
          <p className="text-gray-400 font-semibold mb-1">Qué cambió desde el snapshot del {prevSnap.min}'</p>
          <div className="flex flex-wrap gap-1.5">
            {cambio.items.map(it => (
              <span key={it.label} className="bg-dark-800/70 rounded px-2 py-0.5 text-gray-300">
                {it.label}: <span className="text-gray-500">{it.antes}</span> → <strong className="text-white">{it.ahora}</strong>
              </span>
            ))}
          </div>
          {cambio.principal && <p className="text-gray-500 mt-1">Factor que más pesa ahora: <strong className="text-gray-300">{cambio.principal.factor}</strong> ({cambio.principal.nota})</p>}
        </div>
      )}
    </div>
  )
}
