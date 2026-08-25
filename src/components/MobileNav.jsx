import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { LEAGUES, getLeague } from '../lib/leagues'

const TABS = [
  { id: 'fixture',  label: 'Fixture' },
  { id: 'tabla',    label: 'Tabla' },
  { id: 'analizar', label: 'Analizar' },
  { id: 'vivo',     label: 'En Vivo' },
  { id: 'historial',label: 'Historial' },
  { id: 'predicciones', label: 'Predicciones' },
  { id: 'bankroll', label: 'Bankroll' },
]

export default function MobileNav({ active, onChange, leagueId, onLeagueChange }) {
  const [open, setOpen] = useState(false)
  const league = getLeague(leagueId)

  return (
    <div className="md:hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-dark-800 border-b border-dark-600">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚽</span>
          <span className="font-bold text-white text-sm">{league.flag} {league.name}</span>
        </div>
        <button onClick={() => setOpen(!open)} className="text-gray-400 hover:text-white">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="bg-dark-800 border-b border-dark-600 px-2 py-2 space-y-2">
          <select
            value={leagueId}
            onChange={e => { onLeagueChange(e.target.value) }}
            className="w-full bg-dark-700 border border-dark-500 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-green-500"
          >
            {LEAGUES.filter(l => l.main).map(l => (
              <option key={l.id} value={l.id}>{l.flag} {l.name}</option>
            ))}
            {Object.entries(
              LEAGUES.filter(l => !l.main).reduce((acc, l) => {
                (acc[l.country] = acc[l.country] ?? []).push(l)
                return acc
              }, {})
            ).sort(([a], [b]) => a.localeCompare(b)).map(([country, leagues]) => (
              <optgroup key={country} label={`▾ ${country}`}>
                {leagues.map(l => (
                  <option key={l.id} value={l.id}>{l.flag} {l.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-1">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => { onChange(id); setOpen(false) }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active === id
                    ? 'bg-green-600/20 text-green-400'
                    : 'text-gray-400 hover:text-white hover:bg-dark-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
