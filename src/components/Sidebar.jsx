import { BarChart2, Clock, List, Calendar, Table, DollarSign, Target } from 'lucide-react'
import { LEAGUES } from '../lib/leagues'
import Cuenta from './Cuenta'

const TABS = [
  { id: 'fixture',  label: 'Fixture',   icon: Calendar },
  { id: 'tabla',    label: 'Tabla',     icon: Table },
  { id: 'analizar', label: 'Analizar',  icon: BarChart2 },
  { id: 'vivo',     label: 'En Vivo',   icon: Clock },
  { id: 'buscar',   label: 'Buscar',    icon: Target },
  { id: 'rendimiento', label: 'Rendimiento', icon: BarChart2 },
  { id: 'historial',label: 'Historial', icon: List },
  { id: 'predicciones', label: 'Predicciones', icon: Target },
  { id: 'bankroll', label: 'Bankroll',  icon: DollarSign },
]

export default function Sidebar({ active, onChange, leagueId, onLeagueChange }) {
  return (
    <aside className="hidden md:flex flex-col w-56 bg-dark-800 border-r border-dark-600 min-h-screen pt-4">
      <div className="px-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚽</span>
          <div>
            <p className="font-bold text-white text-sm leading-tight">Motor de Apuestas</p>
            <p className="text-green-400 text-xs font-semibold">Ligas 2026-27</p>
          </div>
        </div>
      </div>

      {/* Selector de liga — principales arriba, resto agrupado por país */}
      <div className="px-3 mb-4">
        <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1 px-1">Competición</label>
        <select
          value={leagueId}
          onChange={e => onLeagueChange(e.target.value)}
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
      </div>

      <nav className="flex flex-col gap-0.5 px-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full text-left ${
              active === id
                ? 'bg-green-600/20 text-green-400 border border-green-600/30'
                : 'text-gray-400 hover:text-white hover:bg-dark-700'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>

      {/* Sesión / sincronización en la nube — pegado abajo */}
      <Cuenta />
    </aside>
  )
}
