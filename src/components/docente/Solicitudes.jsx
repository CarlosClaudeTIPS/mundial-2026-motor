import { useEffect, useState } from 'react'
import { UserCheck, Check, X, Plus } from 'lucide-react'
import { solicitudesPendientes, resolverSolicitud } from '../../lib/sesion'
import { crearGrupo } from '../../lib/datos'
import { cicloActivo } from '../../lib/ciclo'

// ─── Solicitudes de registro de estudiantes ──────────────────────────────────
// Los estudiantes se registran solos y quedan pendientes. Aquí el docente o el
// admin acepta (asignando un grupo) o rechaza.
export default function Solicitudes({ usuario, grupos, onCambio }) {
  const [lista, setLista] = useState(null)
  const [grupoDe, setGrupoDe] = useState({})
  const [porDefecto, setPorDefecto] = useState(null) // grupo recién creado aquí
  const [nuevo, setNuevo] = useState(null)
  const [error, setError] = useState('')

  const cargar = async () => { try { setLista(await solicitudesPendientes()) } catch (e) { setError(e.message); setLista([]) } }
  // Se vuelve a consultar cada 30 s y al volver a la pestaña: los registros llegan mientras el panel está abierto.
  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 30_000)
    window.addEventListener('focus', cargar)
    return () => { clearInterval(t); window.removeEventListener('focus', cargar) }
  }, [])

  const elegido = (p) => grupoDe[p.id] ?? porDefecto ?? grupos[0]?.id ?? ''

  const crear = async () => {
    if (!nuevo.nombre.trim()) return
    setError('')
    try {
      const g = await crearGrupo({ nombre: nuevo.nombre, curso: nuevo.nombre.trim(), colegio: nuevo.colegio, docente_id: usuario.id, ciclo_id: (await cicloActivo())?.id ?? null })
      setPorDefecto(g.id); setGrupoDe({}); setNuevo(null); onCambio?.()
    } catch (e) { setError(e.message) }
  }

  const resolver = async (p, aceptar) => {
    setError('')
    const grupo = grupos.find(g => g.id === elegido(p)) ?? null
    if (aceptar && !grupo) { setNuevo(nuevo ?? { nombre: '', colegio: '' }); return setError('Crea primero un grupo (por ejemplo el curso 11-02) para poder aceptar estudiantes.') }
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
      <p className="text-xs text-gray-400 mb-2">Estudiantes que se registraron y esperan tu aprobación. Al aceptar quedan en el grupo (curso) que elijas, y ahí les haces el seguimiento.</p>
      {nuevo ? (
        <div className="flex flex-wrap gap-2 mb-2">
          <input className="input !w-auto flex-1 !py-1.5 text-sm" autoFocus placeholder="Nombre del grupo o curso (p. ej. 11-02)" value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} onKeyDown={e => e.key === 'Enter' && crear()} />
          <input className="input !w-auto flex-1 !py-1.5 text-sm" placeholder="Colegio (opcional)" value={nuevo.colegio} onChange={e => setNuevo({ ...nuevo, colegio: e.target.value })} onKeyDown={e => e.key === 'Enter' && crear()} />
          <button className="btn-primary !py-1.5 !px-3 text-xs" onClick={crear}>Crear grupo</button>
          <button className="btn-ghost !py-1.5 !px-3 text-xs" onClick={() => setNuevo(null)}>Cancelar</button>
        </div>
      ) : (
        <button className="btn-ghost !py-1 !px-2 text-xs mb-2" onClick={() => setNuevo({ nombre: '', colegio: '' })}><Plus size={14} /> Crear grupo nuevo</button>
      )}
      <div className="divide-y divide-dark-700">
        {lista.map(p => (
          <div key={p.id} className="py-2 flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{p.nombre}</p>
              <p className="text-xs text-gray-500 font-mono">{p.usuario}</p>
            </div>
            <select className="input !w-auto !py-1.5 text-xs" value={elegido(p)} onChange={e => setGrupoDe({ ...grupoDe, [p.id]: e.target.value })}>
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
