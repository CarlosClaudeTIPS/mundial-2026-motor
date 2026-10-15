import { ExternalLink } from 'lucide-react'
import { MARCA, SECCIONES, urlPortal, urlSeccion } from '../lib/portal'

// Franja superior que muestra las tres secciones del portal. Se ve en la
// portada y en el inicio de cada rol; desde cualquier otra pantalla el
// logo lleva al inicio y ahí vuelve a aparecer.
export default function BarraPortal({ className = '' }) {
  return (
    <nav aria-label="Secciones del portal" className={`no-print bg-brand-navy text-[#ffffff] text-xs ${className}`}>
      <div className="max-w-6xl mx-auto px-4 h-8 flex items-center gap-1 overflow-x-auto whitespace-nowrap">
        <a href={urlPortal()} className="hidden sm:inline font-semibold opacity-90 hover:opacity-100 mr-2 shrink-0">{MARCA}</a>
        {SECCIONES.map(s => s.actual ? (
          <span key={s.id} aria-current="page" className="px-2.5 py-1 rounded-full bg-[#ffffff]/15 font-semibold shrink-0 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: s.color }} /> {s.nombre}
          </span>
        ) : (
          <a key={s.id} href={urlSeccion(s)} className="px-2.5 py-1 rounded-full opacity-85 hover:opacity-100 hover:bg-[#ffffff]/10 shrink-0 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: s.color }} /> {s.nombre} <ExternalLink size={11} className="opacity-70 hidden sm:inline" />
          </a>
        ))}
      </div>
    </nav>
  )
}
