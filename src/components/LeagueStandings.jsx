import { useState, useEffect, useCallback } from 'react'
import { fetchStandings, parseForm } from '../lib/football-api'

export default function LeagueStandings({ league }) {
  const [groups, setGroups] = useState(null)
  const [season, setSeason] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchStandings(league.id)
      if (res.ok && res.groups?.length) {
        setGroups(res.groups)
        setSeason(res.season)
      } else {
        setError(res.error || 'Sin datos de standings — verifica la API key')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [league.id])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{league.flag} {league.name}</h1>
          <p className="text-gray-400 text-xs mt-1">
            {season ? `Temporada ${season}${league.type === 'league' ? `-${(season + 1) % 100}` : ''}` : 'Tabla de posiciones'}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="text-xs px-3 py-1.5 rounded bg-dark-700 text-gray-300 hover:bg-dark-600 transition-colors disabled:opacity-50">
          {loading ? '⏳' : '🔄'} Actualizar
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-900/30 border border-red-700/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && !groups && (
        <div className="text-center text-gray-500 py-12 text-sm">Cargando tabla...</div>
      )}

      {groups?.map((group, gi) => (
        <div key={gi} className="card overflow-x-auto">
          {groups.length > 1 && (
            <p className="text-sm font-bold text-green-400 mb-2">{group[0]?.group ?? `Grupo ${gi + 1}`}</p>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase">
                <th className="text-left py-2 pr-2 w-8">#</th>
                <th className="text-left py-2">Equipo</th>
                <th className="text-center py-2 px-1">PJ</th>
                <th className="text-center py-2 px-1">G</th>
                <th className="text-center py-2 px-1">E</th>
                <th className="text-center py-2 px-1">P</th>
                <th className="text-center py-2 px-1 hidden sm:table-cell">GF</th>
                <th className="text-center py-2 px-1 hidden sm:table-cell">GC</th>
                <th className="text-center py-2 px-1">DG</th>
                <th className="text-center py-2 px-1 font-bold">Pts</th>
                <th className="text-center py-2 pl-2 hidden md:table-cell">Forma</th>
              </tr>
            </thead>
            <tbody>
              {group.map(t => (
                <tr key={t.id} className="border-t border-dark-700/60 hover:bg-dark-700/40">
                  <td className={`py-2 pr-2 font-bold ${t.rank <= 4 ? 'text-green-400' : t.rank >= group.length - 2 ? 'text-red-400' : 'text-gray-500'}`}>
                    {t.rank}
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      {t.logo && <img src={t.logo} alt="" className="w-5 h-5 object-contain" loading="lazy" />}
                      <span className="text-white font-medium truncate">{t.name}</span>
                    </div>
                  </td>
                  <td className="text-center text-gray-300 px-1">{t.pj}</td>
                  <td className="text-center text-gray-300 px-1">{t.pg}</td>
                  <td className="text-center text-gray-300 px-1">{t.pe}</td>
                  <td className="text-center text-gray-300 px-1">{t.pp}</td>
                  <td className="text-center text-gray-400 px-1 hidden sm:table-cell">{t.gf}</td>
                  <td className="text-center text-gray-400 px-1 hidden sm:table-cell">{t.gc}</td>
                  <td className={`text-center px-1 ${t.gd > 0 ? 'text-green-400' : t.gd < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                    {t.gd > 0 ? '+' : ''}{t.gd}
                  </td>
                  <td className="text-center font-bold text-white px-1">{t.pts}</td>
                  <td className="text-center pl-2 hidden md:table-cell">
                    <div className="flex gap-0.5 justify-center">
                      {parseForm(t.form).map((f, i) => (
                        <span key={i} className={`w-4 h-4 rounded-sm text-[10px] leading-4 text-white font-bold ${f.color}`}>{f.label}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
