import { useState, useEffect, useCallback, Fragment } from 'react'
import { fetchStandings, fetchFixtures, parseForm, formatLocalDate, formatLocalTime } from '../lib/football-api'
import { buildTeamStats } from '../lib/league-stats'

// ─── Detalle de equipo: stats + próximo partido ──────────────────────────────
const RESULT_DOT = { W: 'bg-green-600', D: 'bg-gray-600', L: 'bg-red-600' }

function TeamDetail({ league, team, onAnalizar }) {
  const [stats, setStats] = useState(null)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState(null)
  const [nextMatch, setNextMatch] = useState(null)

  useEffect(() => {
    let alive = true
    setStats(null); setError(null)

    buildTeamStats(league, team.id, team.name, (msg, i, n) => alive && setProgress(`${msg}`))
      .then(s => alive && setStats(s))
      .catch(e => alive && setError(e.message))

    fetchFixtures(league.id).then(res => {
      if (!alive || !res.ok) return
      const next = (res.fixtures ?? [])
        .filter(f => f.status === 'NS' && (f.homeId === team.id || f.awayId === team.id))
        .sort((a, b) => new Date(a.date) - new Date(b.date))[0]
      setNextMatch(next ?? null)
    }).catch(() => {})

    return () => { alive = false }
  }, [league.id, team.id])

  if (error) return <div className="p-3 text-xs text-red-400">{error}</div>
  if (!stats) return (
    <div className="p-4 text-center">
      <div className="animate-spin w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full mx-auto mb-2" />
      <p className="text-xs text-gray-500">{progress || 'Cargando últimos 10 partidos...'}</p>
    </div>
  )

  const KPIS = [
    ['Goles/P', stats.gf_avg], ['Recibe/P', stats.ga_avg],
    ['Tiros/P', stats.shots_avg], ['SOT/P', stats.sot_avg],
    ['Córners/P', stats.corners_avg], ['Tarjetas/P', stats.cards_avg],
    ['Posesión', stats.possession_avg + '%'], ['Faltas/P', stats.fouls_avg],
    ['S.Banda/P' + (stats.estTi ? '*' : ''), stats.throwins_avg],
    ['S.Puerta/P' + (stats.estGk ? '*' : ''), stats.goalkicks_avg],
    ['PPG', stats.ppg], ['BTTS', stats.btts_pct + '%'],
  ]

  return (
    <div className="p-3 space-y-3 bg-dark-900/60">
      {/* Forma */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500">Últimos 10:</span>
        <div className="flex gap-0.5">
          {(stats.last10 ?? []).map((r, i) => (
            <span key={i} title={`${r.rival} ${r.gf}-${r.ga}`}
              className={`w-4 h-4 rounded-sm text-[10px] leading-4 text-center text-white font-bold ${RESULT_DOT[r.result] ?? 'bg-gray-700'}`}>
              {r.result}
            </span>
          ))}
        </div>
        {stats.tierAdj && <span className="text-[10px] text-orange-500">⬇️ incluye {stats.tierAdj.lowerTierCount} partidos de división inferior</span>}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 md:grid-cols-6 gap-1.5">
        {KPIS.map(([label, val]) => (
          <div key={label} className="bg-dark-800 rounded-lg p-1.5 text-center">
            <p className="text-[10px] text-gray-500">{label}</p>
            <p className="text-sm font-bold text-green-400">{val}</p>
          </div>
        ))}
      </div>
      {(stats.estTi || stats.estGk) && <p className="text-[10px] text-gray-600">* estimado — la API aún no trae ese dato para sus partidos</p>}

      {/* Próximo partido */}
      {nextMatch ? (
        <div className="flex items-center gap-3 bg-dark-800 border border-green-900/40 rounded-lg p-2.5">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Próximo partido</p>
            <p className="text-sm text-white font-semibold truncate">
              {nextMatch.homeTeam} vs {nextMatch.awayTeam}
            </p>
            <p className="text-xs text-gray-500">{formatLocalDate(nextMatch.date)} · {formatLocalTime(nextMatch.date)} (Bogotá)</p>
          </div>
          {onAnalizar && (
            <a
              href={`#analizar?${new URLSearchParams({ league: league.id, h: nextMatch.homeTeam, a: nextMatch.awayTeam }).toString()}`}
              target="_blank" rel="noopener"
              title="Se abre en una pestaña nueva — no pierdes donde vas"
              className="shrink-0 text-xs px-3 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-white font-bold transition-colors">
              Analizar ↗
            </a>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-600">Sin próximo partido en los siguientes 7 días</p>
      )}
    </div>
  )
}

export default function LeagueStandings({ league, onAnalizar }) {
  const [groups, setGroups] = useState(null)
  const [season, setSeason] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedTeam, setSelectedTeam] = useState(null)

  useEffect(() => { setSelectedTeam(null) }, [league.id])

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
                <Fragment key={t.id}>
                <tr
                  onClick={() => setSelectedTeam(selectedTeam === t.id ? null : t.id)}
                  className="border-t border-dark-700/60 hover:bg-dark-700/40 cursor-pointer">
                  <td className={`py-2 pr-2 font-bold ${t.rank <= 4 ? 'text-green-400' : t.rank >= group.length - 2 ? 'text-red-400' : 'text-gray-500'}`}>
                    {t.rank}
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      {t.logo && <img src={t.logo} alt="" className="w-5 h-5 object-contain" loading="lazy" />}
                      <span className="text-white font-medium truncate">{t.name}</span>
                      <span className="text-gray-600 text-[10px]">{selectedTeam === t.id ? '▲' : '▼'}</span>
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
                {selectedTeam === t.id && (
                  <tr>
                    <td colSpan={11} className="p-0 border-t border-green-900/40">
                      <TeamDetail league={league} team={t} onAnalizar={onAnalizar} />
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
