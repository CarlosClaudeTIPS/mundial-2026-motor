import { useState } from 'react'
import { crearContrasena, useSesion } from '../lib/sesion'

// ─── Crear contraseña (llegada por invitación o recuperación) ────────────────
export default function CrearContrasena({ onLista }) {
  const { usuario } = useSesion()
  const [c1, setC1] = useState('')
  const [c2, setC2] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    if (c1.length < 8) { setError('Usa al menos 8 caracteres'); return }
    if (c1 !== c2) { setError('Las dos contraseñas no coinciden'); return }
    setCargando(true)
    try { await crearContrasena(c1); onLista() }
    catch (err) { setError(err.message) }
    finally { setCargando(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={guardar} className="card w-full max-w-sm space-y-3">
        <h1 className="text-xl font-semibold">Crea tu contraseña</h1>
        <p className="text-sm text-gray-400">Cuenta: <span className="text-gray-200">{usuario?.usuario ?? usuario?.nombre}</span>. Con ella entrarás como {usuario?.rol ?? 'docente'} desde cualquier dispositivo.</p>
        <div><label className="label">Nueva contraseña</label><input className="input" type="password" value={c1} onChange={e => setC1(e.target.value)} autoComplete="new-password" /></div>
        <div><label className="label">Repítela</label><input className="input" type="password" value={c2} onChange={e => setC2(e.target.value)} autoComplete="new-password" /></div>
        {error && <p className="text-sm text-brand-red">{error}</p>}
        <button className="btn-primary w-full" disabled={cargando}>{cargando ? 'Guardando…' : 'Guardar y entrar'}</button>
      </form>
    </div>
  )
}
