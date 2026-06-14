import { useState, useEffect } from 'react'
import { getPicks, updatePickResult, deletePick, calcROI, hitRate } from '../lib/storage'

const RESULT_COLORS = {
  ganado: 'text-green-400',
  perdido: 'text-red-400',
  void: 'text-gray-400',
}

export default function Historial() {
  const [picks, setPicks] = useState([])
  const [filterMarket, setFilterMarket] = useState('ALL')

  useEffect(() => { setPicks(getPicks()) }, [])

  function handleResult(id, resultado) {
    updatePickResult(id, resultado)
    setPicks(getPicks())
  }

  function handleDelete(id) {
    deletePick(id)
    setPicks(getPicks())
  }

  const markets = ['ALL', ...new Set(picks.map(p => p.mercado))]
  const filtered = filterMarket === 'ALL' ? picks : picks.filter(p => p.mercado === filterMarket)
  const settled = filtered.filter(p => p.resultado && p.resultado !== 'void')
  const roi = calcROI(filtered)
  const hr = hitRate(filtered)

  // ROI by market
  const byMarket = {}
  picks.forEach(p => {
    if (!byMarket[p.mercado]) byMarket[p.mercado] = []
    byMarket[p.mercado].push(p)
  })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Historial de Picks</h1>
        <p className="text-gray-400 text-sm">{picks.length} picks registrados</p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card text-center">
          <p className="text-xs text-gray-400">Total picks</p>
          <p className="text-3xl font-bold text-white">{picks.length}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-400">Hit Rate</p>
          <p className={`text-3xl font-bold ${hr >= 55 ? 'text-green-400' : hr >= 45 ? 'text-yellow-400' : 'text-red-400'}`}>{hr}%</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-400">ROI</p>
          <p className={`text-3xl font-bold ${roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>{roi > 0 ? '+' : ''}{roi}%</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-400">Liquidados</p>
          <p className="text-3xl font-bold text-white">{settled.length}</p>
        </div>
      </div>

      {/* ROI por mercado */}
      {Object.keys(byMarket).length > 0 && (
        <div className="card space-y-3">
          <h2 className="font-semibold text-white">ROI por mercado</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(byMarket).map(([market, mPicks]) => {
              const mRoi = calcROI(mPicks)
              const mHr = hitRate(mPicks)
              return (
                <div key={market} className="bg-dark-700 rounded-lg p-3">
                  <p className="text-xs text-gray-400 font-medium">{market}</p>
                  <p className={`text-lg font-bold ${mRoi >= 0 ? 'text-green-400' : 'text-red-400'}`}>{mRoi > 0 ? '+' : ''}{mRoi}%</p>
                  <p className="text-xs text-gray-500">HR: {mHr}% · {mPicks.length} picks</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {markets.map(m => (
          <button
            key={m}
            onClick={() => setFilterMarket(m)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              filterMarket === m ? 'bg-green-600 text-white' : 'bg-dark-700 text-gray-400 hover:text-white'
            }`}
          >
            {m === 'ALL' ? 'Todos' : m}
          </button>
        ))}
      </div>

      {/* Tabla */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          No hay picks. Analiza un partido y guarda tus picks.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-dark-600 uppercase tracking-wide">
                <th className="text-left py-2 px-2">Partido</th>
                <th className="text-center py-2 px-2">Mercado</th>
                <th className="text-center py-2 px-2">Línea</th>
                <th className="text-center py-2 px-2">Cuota</th>
                <th className="text-center py-2 px-2">P_mod%</th>
                <th className="text-center py-2 px-2">EV%</th>
                <th className="text-center py-2 px-2">Conf</th>
                <th className="text-center py-2 px-2">Risk</th>
                <th className="text-center py-2 px-2">Resultado</th>
                <th className="text-center py-2 px-2">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(pick => (
                <tr key={pick.id} className="border-b border-dark-700 hover:bg-dark-700/20">
                  <td className="py-2 px-2 text-white max-w-[140px] truncate">{pick.partido}</td>
                  <td className="py-2 px-2 text-center text-gray-300">{pick.mercado}</td>
                  <td className="py-2 px-2 text-center text-gray-300">O{pick.linea}</td>
                  <td className="py-2 px-2 text-center text-gray-300">{pick.cuota}</td>
                  <td className="py-2 px-2 text-center text-gray-300">{pick.pModelo}%</td>
                  <td className={`py-2 px-2 text-center font-semibold ${pick.ev > 2.5 ? 'text-green-400' : pick.ev > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {pick.ev > 0 ? '+' : ''}{pick.ev}%
                  </td>
                  <td className="py-2 px-2 text-center text-gray-300">{pick.confidence}</td>
                  <td className="py-2 px-2 text-center text-gray-300">{pick.risk}</td>
                  <td className="py-2 px-2 text-center">
                    {pick.resultado ? (
                      <span className={`font-semibold ${RESULT_COLORS[pick.resultado]}`}>{pick.resultado}</span>
                    ) : (
                      <div className="flex gap-1 justify-center">
                        {['ganado', 'perdido', 'void'].map(r => (
                          <button
                            key={r}
                            onClick={() => handleResult(pick.id, r)}
                            className={`px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${
                              r === 'ganado' ? 'bg-green-900/50 text-green-400 hover:bg-green-700'
                              : r === 'perdido' ? 'bg-red-900/50 text-red-400 hover:bg-red-700'
                              : 'bg-dark-600 text-gray-400 hover:bg-dark-500'
                            }`}
                          >
                            {r[0].toUpperCase()}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <button onClick={() => handleDelete(pick.id)} className="text-gray-600 hover:text-red-400 transition-colors">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
