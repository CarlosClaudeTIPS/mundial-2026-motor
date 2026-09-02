import { useState, useEffect } from 'react'
import { NUBE_DISPONIBLE, getSesion, onSesion, enviarCodigo, verificarCodigo, cerrarSesion } from '../lib/nube'

// ─── Cuenta: login por código al correo + estado de sincronización ───────────
// Sin contraseñas: correo → código de 6 dígitos → sesión permanente.
// Con sesión activa, el bankroll (y lo que se vaya sumando) viaja a la nube
// y aparece igual en cualquier dispositivo.

export default function Cuenta({ compacto = false }) {
  const [sesion, setSesion] = useState(null)
  const [paso, setPaso] = useState('inicio') // inicio | codigo | enviando
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    getSesion().then(setSesion)
    return onSesion(setSesion)
  }, [])

  if (!NUBE_DISPONIBLE) return null

  const mandarCodigo = async () => {
    setError('')
    if (!/\S+@\S+\.\S+/.test(email)) { setError('Correo inválido'); return }
    setPaso('enviando')
    try {
      await enviarCodigo(email.trim())
      setPaso('codigo')
    } catch (e) {
      setError(e.message)
      setPaso('inicio')
    }
  }

  const confirmar = async () => {
    setError('')
    try {
      const s = await verificarCodigo(email.trim(), codigo)
      setSesion(s)
      setPaso('inicio'); setCodigo(''); setAbierto(false)
    } catch (e) { setError(e.message) }
  }

  // ── Con sesión: indicador + salir ──
  if (sesion) {
    return (
      <div className={compacto ? 'px-3 py-2' : 'px-3 py-2 border-t border-dark-600 mt-auto'}>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-green-400 font-semibold leading-tight">Sincronizado ☁️</p>
            <p className="text-gray-500 truncate">{sesion.user?.email}</p>
          </div>
          <button onClick={() => cerrarSesion()} className="text-gray-600 hover:text-gray-400 shrink-0">salir</button>
        </div>
      </div>
    )
  }

  // ── Sin sesión ──
  return (
    <div className={compacto ? 'px-3 py-2' : 'px-3 py-2 border-t border-dark-600 mt-auto'}>
      {!abierto ? (
        <button onClick={() => setAbierto(true)}
          className="w-full text-xs px-2 py-2 rounded-lg bg-dark-700 text-gray-400 hover:text-white border border-dark-500 text-left flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-gray-600 shrink-0" />
          Iniciar sesión — guardar mis datos ☁️
        </button>
      ) : paso === 'codigo' ? (
        <div className="space-y-1.5">
          <p className="text-[11px] text-gray-400">Correo enviado a <span className="text-white">{email}</span> (revisa spam).</p>
          <p className="text-[11px] text-green-400 font-semibold">👉 Dale clic al enlace del correo — vuelves aquí ya con la sesión iniciada.</p>
          <p className="text-[10px] text-gray-500">¿El correo trae un código de 6 dígitos? Escríbelo aquí:</p>
          <input value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="123456"
            inputMode="numeric" maxLength={6}
            onKeyDown={e => e.key === 'Enter' && confirmar()}
            className="w-full bg-dark-700 border border-dark-500 rounded-lg px-2 py-1.5 text-sm text-white text-center tracking-[0.3em] focus:outline-none focus:border-green-500" />
          <button onClick={confirmar} className="w-full text-xs py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-white font-semibold">Entrar con código</button>
          <button onClick={() => { setPaso('inicio'); setCodigo(''); setError('') }} className="w-full text-[10px] text-gray-600 hover:text-gray-400">otro correo / pedir de nuevo</button>
          {error && <p className="text-[10px] text-red-400">{error}</p>}
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="text-[11px] text-gray-400">Te llega un código al correo — sin contraseña</p>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com"
            type="email" autoFocus
            onKeyDown={e => e.key === 'Enter' && mandarCodigo()}
            className="w-full bg-dark-700 border border-dark-500 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-green-500" />
          <button onClick={mandarCodigo} disabled={paso === 'enviando'}
            className="w-full text-xs py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-white font-semibold disabled:opacity-60">
            {paso === 'enviando' ? 'Enviando…' : 'Enviarme el código'}
          </button>
          <button onClick={() => { setAbierto(false); setError('') }} className="w-full text-[10px] text-gray-600 hover:text-gray-400">cancelar</button>
          {error && <p className="text-[10px] text-red-400">{error}</p>}
        </div>
      )}
    </div>
  )
}
