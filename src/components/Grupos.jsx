import { useState, useEffect, useCallback } from 'react'
import { GRUPOS, TEAMS_BY_ID, STANDINGS_DATA } from '../lib/teams'
import { fetchStandings, getTeamBadge, parseForm } from '../lib/football-api'

const STANDINGS_KEY = 'mundial2026_standings'

function loadLocalStandings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STANDINGS_KEY) || '{}')
    return { ...STANDINGS_DATA, ...saved }
  } catch {
    return STANDINGS_DATA
  }
}

function defaultStanding(rank) {
  return { pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0, gd: 0, form: '', rank: rank + 1 }
}

function teamId(name) {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

function FormBadges({ formStr }) {
  if (!formStr) return null
  const badges = parseForm(formStr)
  return (
    <div className="flex gap-0.5">
      {badges.map((b, i) => (
        <span key={i} className={`w-4 h-4 rounded-sm text-white text-xs flex items-center justify-center font-bold ${b.color}`}>
          {b.label}
        </span>
      ))}
    </div>
  )
}

function ClassBadge({ badge }) {
  if (!badge) return null
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${badge.color}`}>
      {badge.label}
    </span>
  )
}

export default function Grupos() {
  const [apiGroups, setApiGroups]   = useState(null) // array of groups from API
  const [usingApi, setUsingApi]     = useState(false)
  const [loading, setLoading]       = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)

  const localStandings = loadLocalStandings()

  const loadApi = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchStandings()
      if (res?.ok && res.groups?.length > 0) {
        setApiGroups(res.groups)
        setUsingApi(true)
        setLastUpdate(new Date())
      }
    } catch {
      // silently fall back to local
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadApi() }, [loadApi])

  // Build display data — either from API or local
  function buildGroupRows(groupName, teamNames) {
    if (usingApi && apiGroups) {
      // Find matching group from API by name
      const apiGroup = apiGroups.find(g => g.some(t => t.group === `Group ${groupName}`))
      if (apiGroup) {
        return apiGroup
          .map(t => ({
            name:  t.name,
            id:    teamId(t.name),
            rank:  t.rank,
            pj:    t.pj,
            pg:    t.pg,
            pe:    t.pe,
            pp:    t.pp,
            gf:    t.gf,
            gc:    t.gc,
            gd:    t.gd,
            pts:   t.pts,
            form:  t.form,
            badge: getTeamBadge(t),
          }))
          .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
      }
    }

    // Fallback local
    return teamNames.map((name, i) => {
      const id = teamId(name)
      const s  = localStandings[id] || defaultStanding(i)
      return {
        name, id,
        rank: i + 1,
        pj: s.pj, pg: s.pg, pe: s.pe, pp: s.pp,
        gf: s.gf, gc: s.gc, gd: s.gf - s.gc,
        pts: s.pts,
        form: '',
        badge: getTeamBadge({ ...s, gd: s.gf - s.gc, rank: i + 1 }),
      }
    }).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
  }

  const jornada = (() => {
    const today = new Date().toISOString().slice(0, 10)
    if (today <= '2026-06-17') return 'Jornada 1'
    if (today <= '2026-06-23') return 'Jornada 2'
    return 'Jornada 3'
  })()

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Grupos Mundial 2026</h1>
          <p className="text-gray-400 text-sm mt-1">
            48 equipos · 12 grupos · EE.UU., Canadá y México · {jornada}
            {usingApi && lastUpdate && (
              <span className="ml-2 text-green-400 text-xs">✓ API {lastUpdate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
            )}
            {!usingApi && (
              <span className="ml-2 text-yellow-500 text-xs">⚠️ datos locales</span>
            )}
          </p>
        </div>
        <button onClick={loadApi} disabled={loading}
          className="text-xs px-3 py-1.5 rounded bg-dark-700 text-gray-300 hover:bg-dark-600 transition-colors disabled:opacity-50">
          {loading ? '⏳' : '🔄'} Actualizar standings
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {Object.entries(GRUPOS).map(([group, teams]) => {
          const rows = buildGroupRows(group, teams)

          return (
            <div key={group} className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-white text-lg">Grupo {group}</h2>
                <span className="text-xs text-gray-500 uppercase tracking-wide">3 partidos</span>
              </div>

              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-dark-600">
                    <th className="text-left pb-2 font-medium">Equipo</th>
                    <th className="text-center pb-2 font-medium w-7">PJ</th>
                    <th className="text-center pb-2 font-medium w-7">PG</th>
                    <th className="text-center pb-2 font-medium w-7">PE</th>
                    <th className="text-center pb-2 font-medium w-7">PP</th>
                    <th className="text-center pb-2 font-medium w-12">GD</th>
                    <th className="text-center pb-2 font-medium w-8 text-green-400">PTS</th>
                    {usingApi && <th className="text-center pb-2 font-medium w-16">Forma</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s, i) => (
                    <tr key={s.name} className={`border-b border-dark-700 last:border-0 ${i < 3 ? 'text-white' : 'text-gray-400'}`}>
                      <td className="py-2 font-medium">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {i < 3 && <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block shrink-0" />}
                          <span className="truncate">{s.name}</span>
                          {TEAMS_BY_ID[s.id]?.est && <span className="text-yellow-600 text-xs shrink-0">*</span>}
                          {s.badge && <ClassBadge badge={s.badge} />}
                        </div>
                      </td>
                      <td className="text-center py-2">{s.pj}</td>
                      <td className="text-center py-2">{s.pg}</td>
                      <td className="text-center py-2">{s.pe}</td>
                      <td className="text-center py-2">{s.pp}</td>
                      <td className="text-center py-2">{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
                      <td className="text-center py-2 font-bold text-green-400">{s.pts}</td>
                      {usingApi && (
                        <td className="py-2">
                          <div className="flex justify-center">
                            <FormBadges formStr={s.form} />
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="text-xs text-gray-600 mt-2">🟢 clasifica · * datos estimados</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
