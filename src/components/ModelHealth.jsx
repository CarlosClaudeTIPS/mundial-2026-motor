import { useMemo, useState } from 'react'
import { tiBacktestSummary, tiFinalsMap } from '../lib/throwins'
import { gkBacktestSummary, gkFinalsMap } from '../lib/goalkicks'
import { cornersBacktestSummary, cornersFinalsMap } from '../lib/corners'
import { shotsBacktestSummary, shotsFinalsMap, sotBacktestSummary, sotFinalsMap } from '../lib/shots'
import { cardsBacktestSummary, cardsFinalsMap } from '../lib/cards'
import { listDecisiones, listCombos, estadoPorMuestra, ARQUITECTURA } from '../lib/market-engine'

// ─── MODEL HEALTH — laboratorio de forecasting (v5.1 §17) ────────────────────
// Panel de INVESTIGACIÓN: muestra por mercado la salud del modelo contra sus
// benchmarks. Las alertas dicen INVESTIGATE — NUNCA ajustan nada solas.
// Unidad estadística = PARTIDO; los snapshots son diagnóstico.

const MERCADOS = [
  { key: 'corners', label: '🚩 Córners', summary: cornersBacktestSummary, finals: cornersFinalsMap, marketKeys: ['corners_total'] },
  { key: 'shots', label: '🎯 Tiros', summary: shotsBacktestSummary, finals: shotsFinalsMap, marketKeys: ['shots_total'] },
  { key: 'sot', label: '🎯 SOT', summary: sotBacktestSummary, finals: sotFinalsMap, marketKeys: ['sot_total'] },
  { key: 'cards', label: '🟨 Tarjetas', summary: cardsBacktestSummary, finals: cardsFinalsMap, marketKeys: ['cards_total'] },
  { key: 'ti', label: '🧮 S. Banda', summary: tiBacktestSummary, finals: tiFinalsMap, marketKeys: ['ti'] },
  { key: 'gk', label: '🥅 S. Portería', summary: gkBacktestSummary, finals: gkFinalsMap, marketKeys: ['gk'] },
]

// ROI PAPER: cruza las PAPER BET del audit log con los finales resueltos
function roiPaper(finals, marketKeys, decisiones) {
  const bets = decisiones.filter(d =>
    d.signal === 'PAPER BET' && d.lado && d.odds && d.line != null &&
    marketKeys.includes(d.market) && finals[d.matchId] != null
  )
  if (!bets.length) return null
  let pnl = 0; let wins = 0
  for (const b of bets) {
    const final = finals[b.matchId]
    const win = b.lado === 'OVER' ? final > b.line : final < b.line
    pnl += win ? b.odds - 1 : -1
    if (win) wins++
  }
  return { n: bets.length, wins, roi: +((pnl / bets.length) * 100).toFixed(1) }
}

export default function ModelHealth() {
  const [open, setOpen] = useState(false)

  const data = useMemo(() => {
    if (!open) return null
    const decisiones = listDecisiones()
    const combos = listCombos()
    const rows = MERCADOS.map(m => {
      const s = m.summary()
      const gate = estadoPorMuestra(s?.matches ?? 0)
      const roi = s ? roiPaper(m.finals(), m.marketKeys, decisiones) : null
      // MAE global (promedio de tramos, ponderado por n)
      const maeW = s?.rows?.length
        ? +(s.rows.reduce((a, r) => a + r.mae * r.n, 0) / s.rows.reduce((a, r) => a + r.n, 0)).toFixed(1)
        : null
      const naiveW = s?.rows?.filter(r => r.maeNaive != null).length
        ? +(s.rows.filter(r => r.maeNaive != null).reduce((a, r) => a + r.maeNaive * r.n, 0) /
            s.rows.filter(r => r.maeNaive != null).reduce((a, r) => a + r.n, 0)).toFixed(1)
        : null
      return { ...m, s, gate, roi, maeW, naiveW }
    })
    return { rows, decisiones: decisiones.length, combos: combos.length }
  }, [open])

  return (
    <div className="card border border-indigo-800/40 space-y-2">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between text-left">
        <span className="font-bold text-indigo-300 text-sm">🔬 MODEL HEALTH — laboratorio de forecasting</span>
        <span className="text-xs text-gray-500">{ARQUITECTURA} · {open ? '▴' : '▸'}</span>
      </button>

      {open && data && (
        <div className="space-y-3">
          <p className="text-[11px] text-gray-500">
            Arquitectura CONGELADA: las alertas dicen INVESTIGAR, nunca ajustan solas. Unidad = PARTIDO.
            Registradas: {data.decisiones} evaluaciones individuales · {data.combos} combinadas.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-gray-600 uppercase text-[9px]">
                  <th className="text-left py-1">Mercado</th>
                  <th className="text-center px-1.5">Estado</th>
                  <th className="text-center px-1.5">Partidos</th>
                  <th className="text-center px-1.5">Snaps</th>
                  <th className="text-center px-1.5">MAE</th>
                  <th className="text-center px-1.5">Naive</th>
                  <th className="text-center px-1.5">Bias</th>
                  <th className="text-center px-1.5">CRPS</th>
                  <th className="text-center px-1.5">LogLoss</th>
                  <th className="text-center px-1.5">Cob.</th>
                  <th className="text-center px-1.5">Ancho</th>
                  <th className="text-center px-1.5">Sharp</th>
                  <th className="text-center px-1.5">ROI 📝</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map(r => (
                  <tr key={r.key} className="border-t border-dark-700/60">
                    <td className="py-1 text-white font-semibold">{r.label}</td>
                    <td className="text-center px-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${r.gate.estado === 'INSUFFICIENT_DATA' ? 'bg-dark-600 text-gray-400' : 'bg-yellow-900/60 text-yellow-300'}`}>
                        {r.gate.estado === 'INSUFFICIENT_DATA' ? 'INSUF.' : 'BASELINE'}
                      </span>
                    </td>
                    <td className="text-center px-1.5 font-mono text-white">{r.s?.matches ?? 0}</td>
                    <td className="text-center px-1.5 font-mono text-gray-500">{r.s?.snapsTotal ?? 0}</td>
                    <td className="text-center px-1.5 font-mono">{r.maeW != null ? `±${r.maeW}` : '—'}</td>
                    <td className={`text-center px-1.5 font-mono ${r.maeW != null && r.naiveW != null ? (r.maeW <= r.naiveW ? 'text-green-400' : 'text-red-400') : 'text-gray-600'}`}>{r.naiveW != null ? `±${r.naiveW}` : '—'}</td>
                    <td className="text-center px-1.5 font-mono">{r.s?.bias != null ? (r.s.bias > 0 ? '+' : '') + r.s.bias : '—'}</td>
                    <td className="text-center px-1.5 font-mono">{r.s?.dist?.crps ?? '—'}</td>
                    <td className="text-center px-1.5 font-mono">{r.s?.dist?.logloss ?? '—'}</td>
                    <td className="text-center px-1.5 font-mono">{r.s?.dist?.coverage != null ? `${r.s.dist.coverage}%` : '—'}</td>
                    <td className="text-center px-1.5 font-mono">{r.s?.dist?.width ?? '—'}</td>
                    <td className="text-center px-1.5 font-mono">{r.s?.dist?.sharpness ?? '—'}</td>
                    <td className={`text-center px-1.5 font-mono ${r.roi ? (r.roi.roi >= 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-600'}`}>
                      {r.roi ? `${r.roi.roi > 0 ? '+' : ''}${r.roi.roi}% (${r.roi.wins}/${r.roi.n})` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Alertas abiertas por mercado */}
          {data.rows.some(r => r.s?.alertas?.length) ? (
            <div className="space-y-1">
              <p className="text-[10px] text-red-400 font-bold uppercase">Alertas abiertas (INVESTIGAR — no auto-ajustar)</p>
              {data.rows.flatMap(r => (r.s?.alertas ?? []).map((a, i) => (
                <p key={r.key + i} className="text-[11px] text-yellow-500/90 bg-yellow-950/30 border border-yellow-900/40 rounded px-2 py-1">{r.label}: {a}</p>
              )))}
            </div>
          ) : (
            <p className="text-[11px] text-gray-600">Sin alertas abiertas — o sin muestra suficiente para generarlas (mínimo 15 partidos por mercado).</p>
          )}

          <p className="text-[10px] text-gray-600">
            ROI 📝 = ROI hipotético de las PAPER BET registradas con línea+cuota (no es evidencia con muestra chica).
            Métrica de éxito real, en orden: ¿supera benchmarks? → ¿probabilidades calibradas? → ¿CLV? → ¿ROI?
          </p>
        </div>
      )}
    </div>
  )
}
