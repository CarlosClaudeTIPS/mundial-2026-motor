import { useEffect, useState } from 'react'
import { UserCheck, Check, X } from 'lucide-react'
import { solicitudesPendientes, resolverSolicitud } from '../../lib/sesion'

// ─── Solicitudes de registro de estudiantes ──────────────────────────────────
// Los estudiantes se registran solos y quedan pendientes. Aquí el docente o el
// admin acepta (asignando un grupo) o rechaza.
export default function Solicitudes({ grupos, onCambio }) {
  const [lista, setLista] = useState(null)
  const [grupoDe, setGrupoDe] = useState({})
  const [error, setError] = useState('')

  const cargar = async () => { try { setLista(await solicitudesPendientes()) } catch (e) { setError(e.message); setLista([]) } }
  useEffect(() => { cargar() }, [])

  const resolver = async (p, aceptar) => {
    setError('')
    const grupo = grupos.find(g => g.id === (grupoDe[p.id] ?? grupos[0]?.id)) ?? null
    if (aceptar && !grupo) return setError('Crea primero un grupo para poder aceptar estudiantes.')
    try { await resolverSolicitud(p, { aceptar, grupo }); await cargar(); onCambio?.() } catch (e) { setError(e.message) }
  }

  const aceptarTodos = async () => { for (const p of lista) await resolver(p, true) }

  if (!lista || lista.length === 0) return error ? <p className="text-sm text-brand-red">{error}</p> : null
  return (
    <div className="card border-brand-blue">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="font-semibold flex items-center gap-2"><UserCheck size={18} className="text-brand-blue" /> Solicitudes de registro ({lista.length})</p>
        {lista.length > 1 && <button className="btn-secondary !py-1.5 text-xs" onClick={aceptarTodos}>Aceptar todas</button>}
      </div>
      <p className="text-xs text-gray-400 mb-3">Estudiantes que se registraron y esperan tu aprobación. Al aceptar quedan en el grupo que elijas.</p>
      <div className="divide-y divide-dark-700">
        {lista.map(p => (
          <div key={p.id} className="py-2 flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{p.nombre}</p>
              <p className="text-xs text-gray-500 font-mono">{p.usuario}</p>
            </div>
            <select className="input !w-auto !py-1.5 text-xs" value={grupoDe[p.id] ?? grupos[0]?.id ?? ''} onChange={e => setGrupoDe({ ...grupoDe, [p.id]: e.target.value })}>
              {grupos.length === 0 && <option value="">Sin grupos</option>}
              {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
            <button className="btn-primary !py-1.5 !px-3 text-xs" onClick={() => resolver(p, true)}><Check size={14} /> Aceptar</button>
            <button className="btn-ghost !py-1.5 !px-3 text-xs text-brand-red" onClick={() => resolver(p, false)}><X size={14} /> Rechazar</button>
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-brand-red mt-2">{error}</p>}
    </div>
  )
}
