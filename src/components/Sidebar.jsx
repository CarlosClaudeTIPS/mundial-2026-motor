import { BarChart2, Globe, Target, Zap, Clock, List, Sliders } from 'lucide-react'

const TABS = [
  { id: 'grupos',   label: 'Grupos',    icon: Globe },
  { id: 'stats',    label: 'Stats',     icon: BarChart2 },
  { id: 'tiros',    label: 'Tiros',     icon: Target },
  { id: 'corners',  label: 'Córners',   icon: Zap },
  { id: 'goles',    label: 'Goles',     icon: Target },
  { id: 'tarjetas', label: 'Tarjetas',  icon: Sliders },
  { id: 'saques',   label: 'Saques',    icon: List },
  { id: 'analizar', label: 'Analizar',  icon: BarChart2 },
  { id: 'vivo',     label: 'En Vivo',   icon: Clock },
  { id: 'historial',label: 'Historial', icon: List },
]

export default function Sidebar({ active, onChange }) {
  return (
    <aside className="hidden md:flex flex-col w-52 bg-dark-800 border-r border-dark-600 min-h-screen pt-4">
      <div className="px-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚽</span>
          <div>
            <p className="font-bold text-white text-sm leading-tight">Motor</p>
            <p className="text-green-400 text-xs font-semibold">Mundial 2026</p>
          </div>
        </div>
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
    </aside>
  )
}
