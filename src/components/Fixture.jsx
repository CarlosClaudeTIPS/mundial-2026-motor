import { useState, useEffect, useCallback } from 'react'
import { fetchFixtures, fetchLive, formatLocalTime, formatLocalDate, getLocalDateStr, todayBogota, isLive, isDone } from '../lib/football-api'
import { MATCHES } from '../lib/teams'

const FILTER_TABS = [
  { id: 'live',     label: '🔴 En Vivo' },
  { id: 'hoy',      label: '📅 Hoy' },
  { id: 'ayer',     label: '⏪ Ayer' },
  { id: 'proximos', label: '⏩ Próximos 3 días' },
]

function statusBadge(status, elapsed) {
  if (isLive(status)) {
    return <span className="text-xs font-bold text-red-400 animate-pulse">{elapsed ?? 0}'</span>
  }
  if (status === 'HT') return <span className="text-xs font-bold text-yellow-400">HT</span>
  if (isDone(status)) return <span className="text-xs text-gray-500">FT</span>
  return <span className="text-xs text-gray-500">NS</span>
}

function FixtureCard({ fixture, onAnalizar }) {
  const live = isLive(fixture.status)
  const done = isDone(fixture.status)
  const ns   = fixture.status === 'NS'

  return (
    <div className={`card rounded-lg p-3 flex items-center gap-3 text-sm ${live ? 'border border-red-700/60 bg-dark-800' : 'bg-dark-800'}`}>
      {/* Tiempo / Estado */}
      <div className="w-12 text-center shrink-0">
        {ns
          ? <span className="text-xs text-gray-400">{formatLocalTime(fixture.date)}</span>
          : statusBadge(fixture.status, fixture.elapsed)
        }
      </div>

      {/* Equipos + score */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 justify-between">
          <span className={`font-medium truncate ${fixture.homeWinner ? 'text-green-400' : 'text-white'}`}>{fixture.homeTeam}</span>
          {(live || done) ? (
            <span className="text-white font-bold text-base shrink-0">{fixture.homeGoals ?? 0}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 justify-between mt-0.5">
          <span className={`text-gray-300 truncate ${fixture.awayWinner ? 'text-green-400' : ''}`}>{fixture.awayTeam}</span>
          {(live || done) ? (
            <span className="text-white font-bold text-base shrink-0">{fixture.awayGoals ?? 0}</span>
          ) : null}
        </div>
        <p className="text-xs text-gray-600 mt-0.5">📍 {fixture.venue}</p>
      </div>

      {/* Analizar button */}
      {onAnalizar && (
        <button
          onClick={() => onAnalizar(fixture.homeTeam, fixture.awayTeam)}
          className="shrink-0 text-xs px-3 py-1.5 rounded bg-green-800/50 text-green-300 hover:bg-green-700/60 transition-colors border border-green-700/40"
        >
          Analizar →
        </button>
      )}
    </div>
  )
}

function StaticFixtureCard({ match, onAnalizar }) {
  return (
    <div className="card rounded-lg p-3 flex items-center gap-3 text-sm bg-dark-800">
      <div className="w-12 text-center shrink-0">
        <span className="text-xs text-gray-400">{match.date}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-white truncate">{match.teamA.replace(/_/g, ' ')}</div>
        <div className="text-gray-300 truncate mt-0.5">{match.teamB.replace(/_/g, ' ')}</div>
        <p className="text-xs text-gray-600 mt-0.5">📍 {match.ciudad} · Grupo {match.group}</p>
      </div>
      {onAnalizar && (
        <button
          onClick={() => onAnalizar(match.teamA, match.teamB)}
          className="shrink-0 text-xs px-3 py-1.5 rounded bg-green-800/50 text-green-300 hover:bg-green-700/60 transition-colors border border-green-700/40"
        >
          Analizar →
        </button>
      )}
    </div>
  )
}

// Fallback estático desde MATCHES local
function getStaticFixtures(filter) {
  const today = todayBogota()
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const in3days = new Date(Date.now() + 3 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

  return MATCHES.filter(m => {
    if (filter === 'hoy')      return m.date === today
    if (filter === 'ayer')     return m.date === yesterday
    if (filter === 'proximos') return m.date > today && m.date <= in3days
    return false
  })
}

export default function Fixture({ onAnalizar }) {
  const [filter, setFilter]     = useState('hoy')
  const [apiData, setApiData]   = useState(null)
  const [liveData, setLiveData] = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [usingApi, setUsingApi] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [fixtRes, liveRes] = await Promise.allSettled([fetchFixtures(), fetchLive()])

      if (fixtRes.status === 'fulfilled' && fixtRes.value?.ok) {
        setApiData(fixtRes.value.fixtures)
        setUsingApi(true)
      } else {
        setUsingApi(false)
      }

      if (liveRes.status === 'fulfilled' && liveRes.value?.ok) {
        setLiveData(liveRes.value.live)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Auto-refresh live data cada 60s si hay partidos en curso
  useEffect(() => {
    if (!liveData?.length) return
    const id = setInterval(async () => {
      try {
        const res = await fetchLive()
        if (res?.ok) setLiveData(res.live)
      } catch {}
    }, 60_000)
    return () => clearInterval(id)
  }, [liveData?.length])

  // Filtrar desde API data
  const today     = todayBogota()
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const in3days   = new Date(Date.now() + 3 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

  function getApiFiltered() {
    if (!apiData) return []
    const all = apiData
    if (filter === 'live')     return all.filter(f => isLive(f.status))
    if (filter === 'hoy')      return all.filter(f => getLocalDateStr(f.date) === today)
    if (filter === 'ayer')     return all.filter(f => getLocalDateStr(f.date) === yesterday)
    if (filter === 'proximos') return all.filter(f => {
      const d = getLocalDateStr(f.date)
      return d > today && d <= in3days
    })
    return []
  }

  const liveCount = liveData?.length ?? (apiData ? apiData.filter(f => isLive(f.status)).length : 0)

  const apiFiltered = getApiFiltered()
  const staticFallback = !usingApi ? getStaticFixtures(filter) : []

  const showLiveTab = filter === 'live'

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Fixture</h1>
          <p className="text-gray-400 text-xs mt-1">
            {usingApi
              ? <span className="text-green-400">✓ API-Football en vivo</span>
              : <span className="text-yellow-400">⚠️ Datos estáticos (sin API key)</span>
            }
          </p>
        </div>
        <button onClick={loadData} disabled={loading}
          className="text-xs px-3 py-1.5 rounded bg-dark-700 text-gray-300 hover:bg-dark-600 transition-colors disabled:opacity-50">
          {loading ? '⏳' : '🔄'} Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_TABS.map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors relative ${
              filter === t.id
                ? 'bg-green-700/40 text-green-300 border border-green-600/40'
                : 'bg-dark-700 text-gray-400 hover:text-white hover:bg-dark-600'
            }`}>
            {t.label}
            {t.id === 'live' && liveCount > 0 && (
              <span className="ml-1 bg-red-600 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">{liveCount}</span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-red-900/30 border border-red-700/40 px-4 py-3 text-sm text-red-300">
          Error al cargar datos: {error}
        </div>
      )}

      {loading && (
        <div className="text-center text-gray-500 py-12 text-sm">Cargando partidos...</div>
      )}

      {!loading && (
        <>
          {/* Live desde live endpoint */}
          {showLiveTab && liveData && liveData.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs text-red-400 font-semibold uppercase tracking-wide">🔴 En Curso</h2>
              {liveData.map(f => (
                <FixtureCard key={f.id} fixture={f} onAnalizar={onAnalizar} />
              ))}
            </div>
          )}

          {/* API data filtrada */}
          {usingApi && apiFiltered.length > 0 && (
            <div className="space-y-2">
              {apiFiltered.map(f => (
                <FixtureCard key={f.id} fixture={f} onAnalizar={onAnalizar} />
              ))}
            </div>
          )}

          {/* Fallback estático */}
          {!usingApi && staticFallback.length > 0 && (
            <div className="space-y-2">
              {staticFallback.map((m, i) => (
                <StaticFixtureCard key={i} match={m} onAnalizar={onAnalizar} />
              ))}
            </div>
          )}

          {/* Sin resultados */}
          {(usingApi ? apiFiltered.length === 0 : staticFallback.length === 0) && !loading && !(showLiveTab && liveData?.length > 0) && (
            <div className="text-center text-gray-600 py-12 text-sm">
              {filter === 'live' ? 'No hay partidos en curso' : 'No hay partidos para este filtro'}
            </div>
          )}
        </>
      )}
    </div>
  )
}
