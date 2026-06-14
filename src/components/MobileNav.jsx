import { useState } from 'react'
import { Menu, X } from 'lucide-react'

const TABS = [
  'grupos','stats','tiros','corners','goles','tarjetas','saques','analizar','vivo','historial'
]

export default function MobileNav({ active, onChange }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="md:hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-dark-800 border-b border-dark-600">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚽</span>
          <span className="font-bold text-white text-sm">Motor Mundial 2026</span>
        </div>
        <button onClick={() => setOpen(!open)} className="text-gray-400 hover:text-white">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="bg-dark-800 border-b border-dark-600 px-2 py-2 grid grid-cols-2 gap-1">
          {TABS.map(id => (
            <button
              key={id}
              onClick={() => { onChange(id); setOpen(false) }}
              className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                active === id
                  ? 'bg-green-600/20 text-green-400'
                  : 'text-gray-400 hover:text-white hover:bg-dark-700'
              }`}
            >
              {id === 'corners' ? 'Córners' : id === 'vivo' ? 'En Vivo' : id === 'analizar' ? 'Analizar' : id === 'historial' ? 'Historial' : id.charAt(0).toUpperCase() + id.slice(1)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
