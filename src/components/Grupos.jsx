import { GRUPOS, TEAMS_BY_ID } from '../lib/teams'

const STANDINGS_KEY = 'mundial2026_standings'

function loadStandings() {
  try { return JSON.parse(localStorage.getItem(STANDINGS_KEY) || '{}') } catch { return {} }
}

function defaultStanding(teamId) {
  return { pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0, teamId }
}

export default function Grupos() {
  const standings = loadStandings()

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Grupos Mundial 2026</h1>
        <p className="text-gray-400 text-sm mt-1">48 equipos · 12 grupos · EE.UU., Canadá y México</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {Object.entries(GRUPOS).map(([group, teams]) => (
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
                </tr>
              </thead>
              <tbody>
                {teams.map((name, i) => {
                  const id = name.toLowerCase().replace(/\s+/g, '_')
                  const s = standings[id] || defaultStanding(id)
                  const gd = s.gf - s.gc
                  return (
                    <tr key={name} className={`border-b border-dark-700 last:border-0 ${i < 3 ? 'text-white' : 'text-gray-400'}`}>
                      <td className="py-2 font-medium flex items-center gap-2">
                        {i < 3 && <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />}
                        {name}
                      </td>
                      <td className="text-center py-2">{s.pj}</td>
                      <td className="text-center py-2">{s.pg}</td>
                      <td className="text-center py-2">{s.pe}</td>
                      <td className="text-center py-2">{s.pp}</td>
                      <td className="text-center py-2">{gd > 0 ? `+${gd}` : gd}</td>
                      <td className="text-center py-2 font-bold text-green-400">{s.pts}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <p className="text-xs text-gray-600 mt-2">🟢 = clasifica a octavos</p>
          </div>
        ))}
      </div>
    </div>
  )
}
