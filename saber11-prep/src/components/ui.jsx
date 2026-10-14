import { ArrowLeft } from 'lucide-react'
import { atras } from '../lib/nav'

// ─── Piezas pequeñas reutilizables ───────────────────────────────────────────

export function Titulo({ children, volver = false, accion = null, sub = null }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-start gap-2 min-w-0">
        {volver && <button onClick={atras} aria-label="Volver" className="no-print mt-0.5 text-gray-400 hover:text-white"><ArrowLeft size={20} /></button>}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-tight">{children}</h1>
          {sub && <p className="text-sm text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </div>
      {accion}
    </div>
  )
}

export function Barra({ valor, color = '#38BDF8', alto = 8 }) {
  const v = Math.max(0, Math.min(100, valor ?? 0))
  return (
    <div className="w-full rounded-full bg-dark-700 overflow-hidden" style={{ height: alto }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${v}%`, background: color }} />
    </div>
  )
}

export function colorPrecision(p) {
  if (p == null) return '#64748B'
  if (p >= 70) return '#34D399'
  if (p >= 50) return '#FBBF24'
  return '#F87171'
}

export function FilaMetrica({ nombre, valor, total, sufijo = '%', detalle = null, color }) {
  return (
    <div className="py-1.5">
      <div className="flex justify-between text-sm mb-1">
        <span className="truncate pr-2">{nombre}</span>
        <span className="text-gray-300 shrink-0">{valor == null ? '—' : `${valor}${sufijo}`}{detalle && <span className="text-gray-500 text-xs ml-1">{detalle}</span>}</span>
      </div>
      <Barra valor={valor} color={color ?? colorPrecision(valor)} alto={6} />
    </div>
  )
}

export function Metrica({ etiqueta, valor, sufijo = '' }) {
  return (
    <div className="rounded-lg bg-dark-900 p-3">
      <p className="text-xs text-gray-500">{etiqueta}</p>
      <p className="text-2xl font-medium mt-0.5">{valor ?? '—'}<span className="text-sm text-gray-400">{valor != null ? sufijo : ''}</span></p>
    </div>
  )
}

export function Badge({ children, tono = 'gris' }) {
  const cls = {
    gris: 'bg-dark-700 text-gray-300', azul: 'bg-sky-100 text-sky-800', verde: 'bg-emerald-100 text-emerald-800',
    ambar: 'bg-amber-100 text-amber-800', rojo: 'bg-red-100 text-red-800', morado: 'bg-violet-100 text-violet-800',
  }[tono]
  return <span className={`badge ${cls}`}>{children}</span>
}

export function Vacio({ children }) {
  return <div className="card text-center text-sm text-gray-400 py-8">{children}</div>
}

// Markdown mínimo: párrafos, saltos de línea, **negrita**, *cursiva*, listas con "- ".
export function Md({ texto, className = '' }) {
  if (!texto) return null
  const bloques = String(texto).split(/\n\s*\n/)
  return (
    <div className={`prosa ${className}`}>
      {bloques.map((b, i) => {
        const lineas = b.split('\n')
        if (lineas.every(l => /^\s*[-•]\s+/.test(l))) {
          return <ul key={i} className="list-disc pl-5 mb-2 space-y-0.5">{lineas.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-•]\s+/, ''))}</li>)}</ul>
        }
        return <p key={i}>{lineas.map((l, j) => <span key={j}>{inline(l)}{j < lineas.length - 1 && <br />}</span>)}</p>
      })}
    </div>
  )
}

function inline(t) {
  const partes = t.split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|https?:\/\/[^\s)]+|\(\d{1,2}\)\s*_{3,})/g)
  return partes.map((p, i) => {
    if (/^https?:\/\//.test(p)) return <a key={i} href={p} target="_blank" rel="noreferrer" className="text-brand-blue underline">ver fuente ↗</a>
    // Espacios numerados de los textos con huecos: (3) ______ → se resaltan para ubicarlos rápido
    if (/^\(\d{1,2}\)\s*_{3,}$/.test(p)) return <span key={i} className="inline-block rounded-md bg-amber-100 text-amber-900 font-semibold px-1.5 mx-0.5">{p.replace(/\s+/g, ' ')}</span>
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i}>{inline(p.slice(2, -2))}</strong>
    if (/^\*[^*]+\*$/.test(p) || /^_[^_]+_$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>
    return p
  })
}

export function formatoTiempo(seg) {
  if (seg == null) return '—'
  const s = Math.max(0, Math.round(seg))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  return `${m}:${String(r).padStart(2, '0')}`
}

export function fechaCorta(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}
