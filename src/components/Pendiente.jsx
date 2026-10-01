import { useState } from 'react'
import { Clock, XCircle, RefreshCw } from 'lucide-react'
import { revisarAprobacion, salir } from '../lib/sesion'

// ─── Registro pendiente de aprobación (o rechazado) ──────────────────────────
export default function Pendiente({ usuario }) {
  const [revisando, setRevisando] = useState(false)
  const [msg, setMsg] = useState('')
  const rechazado = usuario.estado === 'rechazado'

  const revisar = async () => {
    setRevisando(true); setMsg('')
    const u = await revisarAprobacion()
    if (u?.estado === 'pendiente') setMsg('Todavía no ha sido aprobado. Avísale a tu docente.')
    setRevisando(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-md text-center !p-8">
        <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center ${rechazado ? 'bg-red-100 text-brand-red' : 'bg-sky-50 text-brand-blue'}`}>
          {rechazado ? <XCircle size={32} /> : <Clock size={32} />}
        </div>
        <h1 className="text-2xl font-bold mt-4">{rechazado ? 'Registro no aceptado' : 'Registro enviado'}</h1>
        <p className="text-gray-400 mt-2">{rechazado ? 'Tu docente no aceptó este registro. Si crees que es un error, habla con él.' : `Hola, ${usuario.nombre}. Tu docente debe aceptar tu registro para que puedas empezar.`}</p>

        <div className="mt-5 rounded-2xl bg-dark-900 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Tu usuario para entrar</p>
          <p className="text-3xl font-bold text-brand-blue mt-1 font-mono">{usuario.usuario}</p>
          <p className="text-xs text-gray-500 mt-1">Anótalo. Entras con este usuario y el PIN que elegiste.</p>
        </div>

        {msg && <p className="text-sm text-brand-amber mt-3">{msg}</p>}
        <div className="flex gap-2 mt-5">
          {!rechazado && <button className="btn-primary flex-1" onClick={revisar} disabled={revisando}><RefreshCw size={16} className={revisando ? 'animate-spin' : ''} /> Ya me aceptaron</button>}
          <button className="btn-secondary flex-1" onClick={salir}>Salir</button>
        </div>
      </div>
    </div>
  )
}
