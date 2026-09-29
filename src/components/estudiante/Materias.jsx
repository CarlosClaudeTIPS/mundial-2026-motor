import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { listarPreguntas } from '../../lib/banco'
import { intentosDe } from '../../lib/datos'
import { ir } from '../../lib/nav'
import { MATERIAS, ICONO_PRUEBA } from '../Login'
import { Titulo, Barra } from '../ui'

// ─── Materias: las cinco pruebas por separado ────────────────────────────────
export default function Materias({ usuario }) {
  const [d, setD] = useState(null)
  useEffect(() => {
    (async () => {
      const [preguntas, intentos] = await Promise.all([listarPreguntas(), usuario.rol === 'estudiante' ? intentosDe(usuario.id) : []])
      const est = {}
      for (const m of MATERIAS) {
        const ps = preguntas.filter(p => p.prueba === m.id)
        const its = intentos.filter(i => i.prueba === m.id)
        const vistas = new Set(its.map(i => i.pregunta_id))
        est[m.id] = { total: ps.length, vistas: vistas.size, respuestas: its.length, precision: its.length ? Math.round(its.filter(i => i.correcta).length / its.length * 100) : null }
      }
      setD(est)
    })()
  }, [usuario.id])
  if (!d) return <p className="text-sm text-gray-400">Cargando…</p>
  return (
    <div className="space-y-4">
      <Titulo sub="Elige una materia para practicar, ver su banco de preguntas y tu avance">Materias</Titulo>
      <div className="grid sm:grid-cols-2 gap-3">
        {MATERIAS.map(m => {
          const I = ICONO_PRUEBA[m.id]; const e = d[m.id]
          return (
            <button key={m.id} onClick={() => ir('materia', { id: m.id })} className="card !p-5 text-left hover:-translate-y-0.5 transition-transform">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: m.fondo, color: m.color }}><I size={24} /></div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-brand-navy">{m.nombre}</p>
                  <p className="text-xs text-gray-400">{e.total} preguntas explicadas{usuario.rol === 'estudiante' ? ` · ${e.vistas} resueltas` : ''}</p>
                </div>
                <ChevronRight className="text-gray-500" size={20} />
              </div>
              {usuario.rol === 'estudiante' && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1"><span>Avance en el banco</span><span>{e.precision != null ? `${e.precision}% de aciertos` : 'sin respuestas'}</span></div>
                  <Barra valor={e.total ? e.vistas / e.total * 100 : 0} color={m.color} />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
