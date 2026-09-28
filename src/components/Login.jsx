import { useState } from 'react'
import { entrarLocal, entrarNube, pedirRecuperacion } from '../lib/sesion'
import { NUBE_DISPONIBLE } from '../lib/supabase'
import { USUARIOS_DEMO } from '../lib/demo'

export default function Login() {
  const [tipo, setTipo] = useState('estudiante') // estudiante | docente
  const [usuario, setUsuario] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [cargando, setCargando] = useState(false)

  const entrar = async (e) => {
    e.preventDefault()
    setError('')
    if (!usuario.trim()) { setError('Escribe tu usuario'); return }
    setCargando(true)
    try {
      if (NUBE_DISPONIBLE) {
        if (tipo === 'docente') await entrarNube({ correo: usuario.trim(), contrasena: pin })
        else await entrarNube({ codigo: usuario.trim(), pin })
      } else {
        await entrarLocal(usuario, pin)
      }
    } catch (err) { setError(err.message) }
    finally { setCargando(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <img src="/icono.svg" alt="" className="w-14 h-14 mx-auto mb-3" />
          <h1 className="text-2xl font-semibold">Saber 11 · Preparación</h1>
          <p className="text-sm text-gray-400 mt-1">Practica, entiende tus errores, mejora.</p>
        </div>

        <div className="card">
          <div className="flex rounded-lg bg-dark-900 p-1 mb-4 text-sm">
            {['estudiante', 'docente'].map(t => (
              <button key={t} type="button" onClick={() => setTipo(t)}
                className={`flex-1 rounded-md py-1.5 capitalize ${tipo === t ? 'bg-dark-700 text-white' : 'text-gray-400'}`}>
                {t === 'docente' ? 'Docente / Admin' : 'Estudiante'}
              </button>
            ))}
          </div>

          <form onSubmit={entrar} className="space-y-3">
            <div>
              <label className="label">{NUBE_DISPONIBLE && tipo === 'docente' ? 'Correo' : 'Usuario'}</label>
              <input className="input" value={usuario} onChange={e => setUsuario(e.target.value)} autoCapitalize="none" autoComplete="username"
                placeholder={tipo === 'docente' ? (NUBE_DISPONIBLE ? 'correo@colegio.edu.co' : 'docente') : 'tu.usuario'} />
            </div>
            <div>
              <label className="label">{NUBE_DISPONIBLE && tipo === 'docente' ? 'Contraseña' : 'PIN'}</label>
              <input className="input" type="password" inputMode={NUBE_DISPONIBLE && tipo === 'docente' ? 'text' : 'numeric'} value={pin} onChange={e => setPin(e.target.value)} autoComplete="current-password" placeholder="••••" />
            </div>
            {error && <p className="text-sm text-brand-red">{error}</p>}
            {aviso && <p className="text-sm text-brand-green">{aviso}</p>}
            <button className="btn-primary w-full" disabled={cargando}>{cargando ? 'Entrando…' : 'Entrar'}</button>
            {NUBE_DISPONIBLE && tipo === 'docente' && (
              <button type="button" className="btn-ghost w-full text-xs" onClick={async () => {
                setError(''); setAviso('')
                if (!/\S+@\S+\.\S+/.test(usuario)) { setError('Escribe tu correo para enviarte el enlace'); return }
                try { await pedirRecuperacion(usuario.trim()); setAviso('Te enviamos un enlace al correo para crear una contraseña nueva.') } catch (e) { setError(e.message) }
              }}>¿Olvidaste tu contraseña o aún no la tienes?</button>
            )}
          </form>
        </div>

        {!NUBE_DISPONIBLE && (
          <div className="mt-4 text-xs text-gray-500 leading-relaxed">
            <p className="mb-1"><span className="badge bg-dark-700 text-gray-300">Modo local</span> Los datos se guardan solo en este dispositivo.</p>
            <p>Usuarios de demostración (PIN 1234): {USUARIOS_DEMO.map(u => u.usuario).join(', ')}, est1 … est6.</p>
          </div>
        )}
        {NUBE_DISPONIBLE && tipo === 'estudiante' && (
          <p className="mt-4 text-xs text-gray-500">Tu docente te entrega el código y el PIN. Si los olvidaste, pídele que los restablezca.</p>
        )}
      </div>
    </div>
  )
}
