import { useState, useEffect, useCallback } from 'react'
import { fetchFixtures, fetchLive, fetchFixtureStats, formatLocalTime, getLocalDateStr, todayBogota, isLive, isDone } from '../lib/football-api'
import { LEAGUES } from '../lib/leagues'
import { getPrediccion } from '../lib/predicciones'
import { fetchSofaSaques } from '../lib/sofascore'

// ─── Stats finales de un partido terminado ───────────────────────────────────
const STAT_ROWS = [
  ['Ball Possession', 'Posesión %'],
  ['Total Shots', 'Tiros'],
  ['Shots on Goal', 'Tiros a puerta'],
  ['Blocked Shots', 'Bloqueados'],
  ['Corner Kicks', 'Córners'],
  ['Fouls', 'Faltas'],
  ['Yellow Cards', 'Amarillas'],
  ['Red Cards', 'Rojas'],
  ['Offsides', 'Offsides'],
  ['Throw Ins', 'Saques de banda'],
  ['Goal Kicks', 'Saques de portería'],
  ['Goalkeeper Saves', 'Atajadas'],
]

function MatchStatsPanel({ fixture }) {
  const [stats, setStats] = useState(null)
  const [err, setErr] = useState(null)
  const [sofaUsed, setSofaUsed] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const r = await fetchFixtureStats(fixture.id, fixture.homeId, fixture.awayId)
        if (!alive) return
        if (!(r.ok && r.stats?.length && Object.keys(r.stats[0]?.stats ?? {}).length)) {
          setErr('La API aún no publica las stats de este partido — intenta en unos minutos')
          return
        }
        const home = r.stats[0].stats
        const away = r.stats[1].stats

        // Mostrar las stats de una vez
        if (alive) setStats([...r.stats])

        // Live-Score no trae Goal Kicks (y a veces tampoco TI) → completar con
        // Sofascore EN SEGUNDO PLANO y actualizar cuando llegue
        if (home['Goal Kicks'] == null || home['Throw Ins'] == null) {
          try {
            const sofa = await fetchSofaSaques(fixture.homeTeam, 12)
            if (!alive) return
            const d = (fixture.date ?? '').slice(0, 10)
            const s = sofa.byDate[d]
            if (s) {
              let touched = false
              if (home['Goal Kicks'] == null && s.gk != null) { home['Goal Kicks'] = s.gk; away['Goal Kicks'] = s.gkAg; touched = true }
              if (home['Throw Ins'] == null && s.ti != null) { home['Throw Ins'] = s.ti; away['Throw Ins'] = s.tiAg; touched = true }
              if (touched) { setSofaUsed(true); setStats([...r.stats]) }
            }
          } catch {}
        }
      } catch (e) {
        if (alive) setErr(e.message)
      }
    })()
    return () => { alive = false }
  }, [fixture.id])

  if (err) return <p className="text-xs text-yellow-600 px-3 pb-3">{err}</p>
  if (!stats) return <p className="text-xs text-gray-600 px-3 pb-3">Cargando stats...</p>

  const home = stats[0]?.stats ?? {}
  const away = stats[1]?.stats ?? {}
  const num = v => typeof v === 'string' ? parseFloat(v) : v

  return (
    <div className="px-3 pb-3 pt-1 border-t border-dark-600">
      <div className="grid grid-cols-3 text-[10px] text-gray-600 uppercase tracking-wide mb-1">
        <span>{fixture.homeTeam}</span>
        <span className="text-center">Stat</span>
        <span className="text-right">{fixture.awayTeam}</span>
      </div>
      {STAT_ROWS.map(([key, label]) => {
        const h = num(home[key]); const a = num(away[key])
        if (h == null && a == null) return null
        const hWin = h != null && a != null && h > a
        const aWin = h != null && a != null && a > h
        return (
          <div key={key} className="grid grid-cols-3 text-xs py-0.5 border-b border-dark-700/50 last:border-0 items-center">
            <span className={`font-mono font-bold ${hWin ? 'text-green-400' : 'text-gray-300'}`}>{h ?? '—'}</span>
            <span className="text-center text-gray-500">{label}</span>
            <span className={`text-right font-mono font-bold ${aWin ? 'text-green-400' : 'text-gray-300'}`}>{a ?? '—'}</span>
          </div>
        )
      })}
      {sofaUsed && <p className="text-[10px] text-gray-600 mt-1">Saques completados con Sofascore</p>}
      <PrediccionVsReal fixture={fixture} home={home} away={away} />
    </div>
  )
}

// ─── Predicción del motor vs resultado real — calibración ────────────────────
function PrediccionVsReal({ fixture, home, away }) {
  const pred = getPrediccion(fixture.leagueId, fixture.homeTeam, fixture.awayTeam)
  if (!pred) {
    return <p className="text-[10px] text-gray-600 mt-1.5">No analizaste este partido antes — analiza los próximos y aquí verás predicción vs realidad</p>
  }

  const num = v => typeof v === 'string' ? parseFloat(v) : v
  const sum = key => {
    const h = num(home[key]); const a = num(away[key])
    return h != null && a != null ? h + a : null
  }

  const reales = {
    goals: (fixture.homeGoals != null && fixture.awayGoals != null) ? fixture.homeGoals + fixture.awayGoals : null,
    shots: sum('Total Shots'),
    sot: sum('Shots on Goal'),
    corners: sum('Corner Kicks'),
    cards: (() => { const y = sum('Yellow Cards'); const r = sum('Red Cards'); return y != null ? y + (r ?? 0) : null })(),
    fouls: sum('Fouls'),
    ti: sum('Throw Ins'),
    gk: sum('Goal Kicks'),
  }

  const MERCADOS = [
    ['goals', 'Goles'], ['shots', 'Tiros'], ['sot', 'SOT'], ['corners', 'Córners'],
    ['cards', 'Tarjetas'], ['fouls', 'Faltas'], ['ti', 'TI'], ['gk', 'GK'],
  ]

  // Resolver los picks guardados contra la realidad
  const REAL_POR_MARKET = {
    goles_totales: reales.goals, shots_totales: reales.shots, sot_totales: reales.sot,
    corners_totales: reales.corners, tarjetas_totales: reales.cards,
    gk_totales: reales.gk, ti_totales: reales.ti,
    tiros_local: num(home['Total Shots']), tiros_visita: num(away['Total Shots']),
    gk_local: num(home['Goal Kicks']), gk_visita: num(away['Goal Kicks']),
  }

  return (
    <div className="mt-2 pt-2 border-t border-purple-900/50">
      <p className="text-[10px] text-purple-400 uppercase tracking-wide font-bold mb-1">
        🔮 Predicción del motor ({new Date(pred.ts).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}) vs realidad
      </p>
      <div className="grid grid-cols-4 gap-x-3 gap-y-0.5">
        {MERCADOS.map(([k, label]) => {
          const p = pred.expected?.[k]
          const r = reales[k]
          if (p == null || r == null) return null
          const errPct = p > 0 ? Math.abs((r - p) / p) : 1
          const icon = errPct <= 0.15 ? '✅' : errPct <= 0.30 ? '⚠️' : '❌'
          return (
            <div key={k} className="text-[11px]">
              <span className="text-gray-500">{label}: </span>
              <span className="text-purple-300">{p}</span>
              <span className="text-gray-600">→</span>
              <span className="text-white font-bold">{r}</span>
              <span className="ml-0.5">{icon}</span>
            </div>
          )
        })}
      </div>

      {pred.picks?.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {pred.picks.map((p, i) => {
            const real = REAL_POR_MARKET[p.marketKey]
            let resultado = null
            if (real != null) {
              const over = real > p.line
              resultado = (p.dir === 'OVER') === over && real !== p.line
            }
            return (
              <p key={i} className="text-[11px]">
                <span className={resultado == null ? 'text-gray-500' : resultado ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                  {resultado == null ? '·' : resultado ? '✅ GANADA' : '❌ FALLÓ'}
                </span>
                <span className="text-gray-300 ml-1.5">{p.label} {p.dir} {p.line}</span>
                {real != null && <span className="text-gray-500"> — salió {real}</span>}
                <span className="text-gray-600"> (conf {p.confidence})</span>
              </p>
            )
          })}
        </div>
      )}
      <p className="text-[10px] text-gray-600 mt-1">✅ error ≤15% · ⚠️ ≤30% · ❌ &gt;30% — así calibras cuánto confiar en cada mercado</p>
    </div>
  )
}

const FILTER_TABS = [
  { id: 'live',      label: '🔴 En Vivo' },
  { id: 'hoy',       label: '📅 Hoy' },
  { id: 'manana',    label: '➡️ Mañana' },
  { id: 'proximos',  label: '⏩ Próximos 3 días' },
  { id: 'recientes', label: '⏪ Últimos 3 días' },
]

const MIS_LIGAS_KEY = 'motor_mis_ligas'
const MODE_KEY = 'motor_fixture_mode'
const DEFAULT_MIS_LIGAS = [39, 140, 78, 135, 61] // las 5 grandes

function loadMisLigas() {
  try {
    const v = JSON.parse(localStorage.getItem(MIS_LIGAS_KEY))
    return Array.isArray(v) && v.length ? v : DEFAULT_MIS_LIGAS
  } catch { return DEFAULT_MIS_LIGAS }
}

function statusBadge(status, elapsed) {
  if (isLive(status)) {
    return <span className="text-xs font-bold text-red-400 animate-pulse">{elapsed ?? 0}'</span>
  }
  if (status === 'HT') return <span className="text-xs font-bold text-yellow-400">HT</span>
  if (isDone(status)) return <span className="text-xs text-gray-500">FT</span>
  return <span className="text-xs text-gray-500">NS</span>
}

function FixtureCard({ fixture, onAnalizar, showLeague }) {
  const [statsOpen, setStatsOpen] = useState(false)
  const live = isLive(fixture.status)
  const done = isDone(fixture.status)
  const ns   = fixture.status === 'NS'

  return (
    <div className={`card rounded-lg !p-0 overflow-hidden text-sm ${live ? 'border border-red-700/60 bg-dark-800' : 'bg-dark-800'}`}>
      <div className="p-3 flex items-center gap-3">
        <div className="w-12 text-center shrink-0">
          {ns
            ? <span className="text-xs text-gray-400">{formatLocalTime(fixture.date)}</span>
            : statusBadge(fixture.status, fixture.elapsed)
          }
        </div>

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
          <p className="text-xs text-gray-600 mt-0.5">
            {showLeague && <span className="text-purple-400 mr-2">{fixture.leagueFlag} {fixture.leagueName}</span>}
            📍 {fixture.venue}
          </p>
        </div>

        <div className="flex flex-col gap-1.5 shrink-0">
          {onAnalizar && (
            <button
              onClick={() => onAnalizar(fixture.homeTeam, fixture.awayTeam, fixture.leagueId)}
              className="text-xs px-3 py-1.5 rounded bg-green-800/50 text-green-300 hover:bg-green-700/60 transition-colors border border-green-700/40"
            >
              Analizar →
            </button>
          )}
          {(done || live) && (
            <button
              onClick={() => setStatsOpen(o => !o)}
              className="text-xs px-3 py-1.5 rounded bg-blue-900/50 text-blue-300 hover:bg-blue-800/60 transition-colors border border-blue-800/40"
            >
              📊 Stats {statsOpen ? '▲' : '▼'}
            </button>
          )}
        </div>
      </div>

      {statsOpen && <MatchStatsPanel fixture={fixture} />}
    </div>
  )
}

export default function Fixture({ league, onAnalizar }) {
  const [filter, setFilter]     = useState('hoy')
  const [mode, setMode]         = useState(() => localStorage.getItem(MODE_KEY) || 'mis')
  const [misLigas, setMisLigas] = useState(loadMisLigas)
  const [configOpen, setConfigOpen] = useState(false)
  const [apiData, setApiData]   = useState([])   // fixtures con leagueId/leagueName
  const [liveData, setLiveData] = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  const activeLeagueIds = mode === 'mis' ? misLigas : [league.id]

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const ligas = activeLeagueIds
        .map(id => LEAGUES.find(l => l.id === id))
        .filter(Boolean)

      const results = await Promise.allSettled(
        ligas.flatMap(l => [
          fetchFixtures(l.id).then(r => ({ tipo: 'fix', liga: l, r })),
          fetchLive(l.id).then(r => ({ tipo: 'live', liga: l, r })),
        ])
      )

      const fixtures = []
      const live = []
      for (const res of results) {
        if (res.status !== 'fulfilled') continue
        const { tipo, liga, r } = res.value
        if (!r?.ok) continue
        const tag = f => ({ ...f, leagueId: liga.id, leagueName: liga.name, leagueFlag: liga.flag })
        if (tipo === 'fix') fixtures.push(...(r.fixtures ?? []).map(tag))
        else live.push(...(r.live ?? []).map(tag))
      }

      fixtures.sort((a, b) => new Date(a.date) - new Date(b.date))
      setApiData(fixtures)
      setLiveData(live)
      if (!fixtures.length && !live.length) setError('Sin datos — verifica la API key o el trial de Live-Score')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [activeLeagueIds.join(',')])

  useEffect(() => { loadData() }, [loadData])

  // Auto-refresh live cada 60s si hay partidos en curso
  useEffect(() => {
    if (!liveData.length) return
    const id = setInterval(loadData, 60_000)
    return () => clearInterval(id)
  }, [liveData.length, loadData])

  function setModePersist(m) {
    setMode(m)
    try { localStorage.setItem(MODE_KEY, m) } catch {}
  }

  function toggleLiga(id) {
    setMisLigas(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      const final = next.length ? next : prev // nunca vacío
      try { localStorage.setItem(MIS_LIGAS_KEY, JSON.stringify(final)) } catch {}
      return final
    })
  }

  // Filtros de fecha
  const today     = todayBogota()
  const tomorrow  = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const in3days   = new Date(Date.now() + 3 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

  function getFiltered() {
    if (filter === 'live') return apiData.filter(f => isLive(f.status))
    if (filter === 'hoy')  return apiData.filter(f => getLocalDateStr(f.date) === today)
    if (filter === 'manana') return apiData.filter(f => getLocalDateStr(f.date) === tomorrow)
    if (filter === 'proximos') return apiData.filter(f => {
      const d = getLocalDateStr(f.date)
      return d > today && d <= in3days
    })
    if (filter === 'recientes') {
      const back3 = new Date(Date.now() - 3 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
      return apiData.filter(f => {
        const d = getLocalDateStr(f.date)
        return d < today && d >= back3
      }).reverse() // más recientes primero
    }
    return []
  }

  const filtered = getFiltered()
  const liveCount = liveData.length || apiData.filter(f => isLive(f.status)).length
  const showLiveTab = filter === 'live'
  const multiLiga = activeLeagueIds.length > 1

  // Agrupar por liga cuando hay varias
  const grouped = multiLiga
    ? Object.entries(filtered.reduce((acc, f) => {
        (acc[f.leagueName] = acc[f.leagueName] ?? []).push(f)
        return acc
      }, {}))
    : [[null, filtered]]

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {mode === 'mis' ? '⭐ Fixture — Mis Ligas' : `${league.flag} Fixture — ${league.name}`}
          </h1>
          <p className="text-gray-400 text-xs mt-1">
            {mode === 'mis'
              ? `${misLigas.length} ligas seguidas · partidos ordenados por hora`
              : 'Solo la competición seleccionada en el menú'}
          </p>
        </div>
        <button onClick={loadData} disabled={loading}
          className="text-xs px-3 py-1.5 rounded bg-dark-700 text-gray-300 hover:bg-dark-600 transition-colors disabled:opacity-50">
          {loading ? '⏳' : '🔄'} Actualizar
        </button>
      </div>

      {/* Modo + configuración de mis ligas */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border border-dark-500">
          <button onClick={() => setModePersist('mis')}
            className={`px-3 py-1.5 text-xs font-medium ${mode === 'mis' ? 'bg-green-700 text-white' : 'bg-dark-700 text-gray-400'}`}>
            ⭐ Mis ligas
          </button>
          <button onClick={() => setModePersist('liga')}
            className={`px-3 py-1.5 text-xs font-medium ${mode === 'liga' ? 'bg-green-700 text-white' : 'bg-dark-700 text-gray-400'}`}>
            {league.flag} Solo {league.name}
          </button>
        </div>
        {mode === 'mis' && (
          <button onClick={() => setConfigOpen(o => !o)}
            className="text-xs px-3 py-1.5 rounded-lg bg-dark-700 text-gray-400 hover:text-white border border-dark-500">
            ⚙️ Elegir ligas ({misLigas.length})
          </button>
        )}
      </div>

      {configOpen && mode === 'mis' && (
        <div className="card border border-dark-600">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Qué ligas aparecen en "Mis ligas"</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
            {LEAGUES.map(l => (
              <label key={l.id} className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer hover:text-white">
                <input type="checkbox" checked={misLigas.includes(l.id)}
                  onChange={() => toggleLiga(l.id)} className="accent-green-500" />
                {l.flag} {l.name}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Filtros de fecha */}
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
          {error}
        </div>
      )}

      {loading && !apiData.length && (
        <div className="text-center text-gray-500 py-12 text-sm">Cargando partidos de {activeLeagueIds.length} liga(s)...</div>
      )}

      {!loading || apiData.length ? (
        <>
          {/* Live desde live endpoint */}
          {showLiveTab && liveData.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs text-red-400 font-semibold uppercase tracking-wide">🔴 En Curso</h2>
              {liveData.map(f => (
                <FixtureCard key={f.id} fixture={f} onAnalizar={onAnalizar} showLeague={multiLiga} />
              ))}
            </div>
          )}

          {/* Agrupado por liga */}
          {grouped.map(([ligaName, items]) => items.length > 0 && (
            <div key={ligaName ?? 'única'} className="space-y-2">
              {ligaName && (
                <h2 className="text-xs text-purple-400 font-semibold uppercase tracking-wide pt-2">
                  {items[0].leagueFlag} {ligaName}
                </h2>
              )}
              {items.map(f => (
                <FixtureCard key={f.id} fixture={f} onAnalizar={onAnalizar} showLeague={false} />
              ))}
            </div>
          ))}

          {filtered.length === 0 && !loading && !(showLiveTab && liveData.length > 0) && (
            <div className="text-center text-gray-600 py-12 text-sm">
              {filter === 'live' ? 'No hay partidos en curso en tus ligas' : 'No hay partidos para este filtro en tus ligas'}
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
