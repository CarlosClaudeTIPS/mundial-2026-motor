import { useState } from 'react'
import { TEAMS, GRUPOS } from '../lib/teams'

const COLS = {
  stats: [
    { key: 'ppg', label: 'PPG' },
    { key: 'gf_avg', label: 'GF/P' },
    { key: 'ga_avg', label: 'GC/P' },
    { key: 'cs_pct', label: 'CS%' },
    { key: 'btts_pct', label: 'BTTS%' },
    { key: 'shots_avg', label: 'Tiros/P' },
    { key: 'sot_avg', label: 'SOT/P' },
  ],
  tiros: [
    { key: 'shots_avg', label: 'Tiros/P' },
    { key: 'sot_avg', label: 'SOT/P' },
    { key: 'shots_against_avg', label: 'Tiros contra/P' },
    { key: 'shots_1h', label: 'Tiros 1H' },
    { key: 'shots_2h', label: 'Tiros 2H' },
    { key: 'sot_1h', label: 'SOT 1H' },
    { key: 'sot_2h', label: 'SOT 2H' },
  ],
  corners: [
    { key: 'corners_avg', label: 'Córners/P' },
    { key: 'corners_against_avg', label: 'Córners contra/P' },
    { key: 'corners_1h', label: 'Córners 1H' },
    { key: 'corners_2h', label: 'Córners 2H' },
  ],
  goles: [
    { key: 'gf_avg', label: 'GF/P' },
    { key: 'ga_avg', label: 'GC/P' },
    { key: 'goals_1h', label: 'Goles 1H' },
    { key: 'goals_2h', label: 'Goles 2H' },
    { key: 'cs_pct', label: 'CS%' },
    { key: 'btts_pct', label: 'BTTS%' },
  ],
  tarjetas: [
    { key: 'cards_avg', label: 'Tarjetas/P' },
    { key: 'cards_1h', label: 'Tarjetas 1H' },
    { key: 'cards_2h', label: 'Tarjetas 2H' },
  ],
  saques: [
    { key: 'throwins_avg', label: 'Saques banda/P' },
    { key: 'goalkicks_avg', label: 'Saques portería/P' },
    { key: 'freekicks_avg', label: 'Tiros libres/P' },
  ],
}

const OU_MARKET = {
  corners: [7.5, 8.5, 9.5, 10.5],
  goles: [1.5, 2.5, 3.5],
  tiros: [7.5, 8.5, 9.5],
  tarjetas: [1.5, 2.5, 3.5, 4.5],
}

export default function StatsTable({ tab }) {
  const [groupFilter, setGroupFilter] = useState('ALL')
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('desc')

  const cols = COLS[tab] || COLS.stats
  const ouKey = { corners: 'corners', goles: 'goals', tiros: 'sot', tarjetas: 'cards' }[tab]
  const ouLines = ouKey ? OU_MARKET[tab] : null

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  let teams = groupFilter === 'ALL' ? TEAMS : TEAMS.filter(t => t.group === groupFilter)
  if (sortKey) {
    teams = [...teams].sort((a, b) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-white capitalize">{tab === 'corners' ? 'Córners' : tab}</h1>
        <div className="flex gap-1 flex-wrap">
          {['ALL', ...Object.keys(GRUPOS)].map(g => (
            <button
              key={g}
              onClick={() => setGroupFilter(g)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                groupFilter === g ? 'bg-green-600 text-white' : 'bg-dark-700 text-gray-400 hover:text-white'
              }`}
            >
              {g === 'ALL' ? 'Todos' : `Grupo ${g}`}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dark-600 text-gray-400 text-xs uppercase tracking-wide">
              <th className="text-left py-3 px-3 font-medium">Equipo</th>
              <th className="text-center py-3 px-2 font-medium">Grupo</th>
              {cols.map(c => (
                <th
                  key={c.key}
                  className="text-center py-3 px-3 font-medium cursor-pointer hover:text-white"
                  onClick={() => handleSort(c.key)}
                >
                  {c.label} {sortKey === c.key ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </th>
              ))}
              {ouLines && ouLines.map(line => (
                <th key={line} className="text-center py-3 px-3 font-medium text-purple-400">
                  O{line}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.map(team => (
              <tr key={team.id} className="border-b border-dark-700 hover:bg-dark-700/30 transition-colors">
                <td className="py-3 px-3 font-medium text-white">{team.name}</td>
                <td className="py-3 px-2 text-center">
                  <span className="text-xs bg-dark-600 px-1.5 py-0.5 rounded font-mono">{team.group}</span>
                </td>
                {cols.map(c => (
                  <td key={c.key} className="py-3 px-3 text-center text-gray-300">
                    {typeof team[c.key] === 'number'
                      ? c.key.endsWith('_pct') ? `${team[c.key]}%` : team[c.key].toFixed(1)
                      : '—'}
                  </td>
                ))}
                {ouLines && ouLines.map(line => {
                  const mKey = { corners: 'corners', goles: 'goals', tiros: 'sot', tarjetas: 'cards' }[tab]
                  const val = team.ou?.[mKey]?.[line]
                  return (
                    <td key={line} className="py-3 px-3 text-center">
                      {val !== undefined ? (
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                          val >= 60 ? 'text-green-400 bg-green-900/30'
                          : val >= 40 ? 'text-yellow-400 bg-yellow-900/30'
                          : 'text-red-400 bg-red-900/30'
                        }`}>
                          {val}%
                        </span>
                      ) : '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
