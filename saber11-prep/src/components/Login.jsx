import { useMemo, useRef, useState , useEffect} from 'react'
import { BookOpenCheck, Timer, LineChart, Calculator, BookOpen, Globe2, FlaskConical, Languages, Star, ChevronLeft, ChevronRight } from 'lucide-react'
import { entrarLocal, entrarNube, pedirRecuperacion, registrarEstudiante, baseUsuario } from '../lib/sesion'
import { NUBE_DISPONIBLE } from '../lib/supabase'
import { USUARIOS_DEMO } from '../lib/demo'
import { contarPorPrueba, iniciarSiembra } from '../lib/banco'

// ─── Portada pública + acceso ────────────────────────────────────────────────

export const ICONO_PRUEBA = {
  lectura_critica: BookOpen, matematicas: Calculator, sociales_ciudadanas: Globe2, ciencias_naturales: FlaskConical, ingles: Languages,
}
export const MATERIAS = [
  { id: 'lectura_critica', nombre: 'Lectura Crítica', color: '#8B5CF6', fondo: '#F3EEFF', frase: 'Comprende, infiere y evalúa textos continuos y discontinuos.' },
  { id: 'matematicas', nombre: 'Matemáticas', color: '#1FA9EC', fondo: '#E6F6FE', frase: 'Interpreta datos, formula y resuelve, argumenta con números.' },
  { id: 'sociales_ciudadanas', nombre: 'Sociales y Ciudadanas', color: '#F59E0B', fondo: '#FFF6E5', frase: 'Analiza perspectivas, historia, territorio y ciudadanía.' },
  { id: 'ciencias_naturales', nombre: 'Ciencias Naturales', color: '#10B981', fondo: '#E7F8F1', frase: 'Explica fenómenos e indaga con datos de experimentos.' },
  { id: 'ingles', nombre: 'Inglés', color: '#EC4899', fondo: '#FDEBF4', frase: 'Avisos, conversaciones, vocabulario y lectura en inglés.' },
]

export default function Login() {
  const [tipo, setTipo] = useState('estudiante')
  const acceso = useRef(null)
  const [conteo, setConteo] = useState({})
  useEffect(() => { iniciarSiembra().then(contarPorPrueba).then(setConteo).catch(() => {}) }, [])
  const irAcceso = (t) => { setTipo(t); acceso.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }

  return (
    <div className="min-h-screen bg-dark-800">
      {/* Barra superior */}
      <header className="sticky top-0 z-30 bg-dark-800/95 backdrop-blur border-b border-dark-700">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <a href="#/" className="flex items-center gap-2">
            <img src="/icono.svg" alt="" className="w-9 h-9" />
            <span className="text-xl font-bold text-brand-blue">Saber<span className="text-brand-navy">11</span></span>
          </a>
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-brand-navy">
            <a href="#/" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Inicio</a>
            <a href="#/" onClick={e => { e.preventDefault(); document.getElementById('materias')?.scrollIntoView({ behavior: 'smooth' }) }}>Materias</a>
            <a href="#/" onClick={e => { e.preventDefault(); document.getElementById('como')?.scrollIntoView({ behavior: 'smooth' }) }}>¿Cómo funciona?</a>
            <button onClick={() => irAcceso('docente')}>Colegios y docentes</button>
          </nav>
          <div className="flex items-center gap-2">
            <button className="btn-primary !py-2 !px-4" onClick={() => irAcceso('estudiante')}>Soy estudiante</button>
            <button className="btn-secondary !py-2 !px-4 hidden sm:inline-flex" onClick={() => irAcceso('docente')}>Iniciar sesión</button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-dark-900">
        <div className="pointer-events-none absolute -right-40 top-1/2 -translate-y-1/2 hidden md:block">
          {[520, 440, 360, 280].map(s => <div key={s} className="absolute rounded-full border-2 border-rose-200/60" style={{ width: s, height: s, top: -s / 2, left: -s / 2 }} />)}
        </div>
        <div className="max-w-6xl mx-auto px-4 py-12 md:py-20 grid md:grid-cols-2 gap-10 items-center relative">
          <div>
            <p className="titulo-contorno text-6xl md:text-8xl font-extrabold leading-none">SABER 11°</p>
            <h1 className="mt-3 text-3xl md:text-5xl font-bold leading-tight">Estudia y practica para el examen ICFES Saber 11°</h1>
            <p className="mt-4 text-gray-300 text-base md:text-lg max-w-xl">Practica con preguntas estilo ICFES, entiende por qué fallaste cada opción y sigue tu progreso con tu docente. Gratis, desde el celular y también sin conexión.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button className="btn-primary !px-6 !py-3 text-base" onClick={() => irAcceso('estudiante')}>Entrar como estudiante</button>
              <button className="btn-secondary !px-6 !py-3 text-base" onClick={() => irAcceso('docente')}>Soy docente</button>
            </div>
          </div>
          <div className="relative flex justify-center">
            <div className="absolute right-6 top-4 w-20 h-20 rounded-full bg-orange-300/80" />
            <Celular />
          </div>
        </div>
      </section>

      {/* ¿Es posible? */}
      <section id="como" className="max-w-6xl mx-auto px-4 py-16 text-center">
        <p className="titulo-contorno text-3xl md:text-4xl font-extrabold">¿ES POSIBLE?</p>
        <h2 className="text-3xl md:text-4xl font-bold">Mejores puntajes</h2>
        <p className="mt-3 text-gray-400 max-w-2xl mx-auto">Un programa de seis meses con práctica diaria, retroalimentación de cada error y simulacros con la estructura real del examen.</p>
        <div className="mt-10 grid md:grid-cols-3 gap-5 text-left">
          {[
            { i: BookOpenCheck, t: 'Aprende de cada error', d: 'Cada opción incorrecta tiene su explicación: qué debías identificar y qué repasar.' },
            { i: Timer, t: 'Simulacros reales', d: 'Prueba diagnóstica, mini-pruebas y simulacros por sesión de 4 h 30 min, a la escala que necesites.' },
            { i: LineChart, t: 'Progreso con tu docente', d: 'Tu docente ve los errores más frecuentes del grupo y te asigna la práctica que necesitas.' },
          ].map(({ i: I, t, d }) => (
            <div key={t} className="card !p-6 text-center">
              <div className="mx-auto -mt-12 mb-4 w-14 h-14 rounded-2xl bg-brand-blue text-[#fff] flex items-center justify-center shadow-lg shadow-sky-200"><I size={26} /></div>
              <p className="text-lg font-semibold text-brand-navy">{t}</p>
              <p className="mt-2 text-sm text-gray-400">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Materias */}
      <section id="materias" className="bg-dark-900 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center">Las cinco pruebas</h2>
          <p className="mt-3 text-gray-400 text-center">Banco de preguntas explicadas, organizado por materia, competencia y habilidad.</p>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {MATERIAS.map(m => {
              const I = ICONO_PRUEBA[m.id]
              return (
                <div key={m.id} className="card !p-5 hover:-translate-y-1 transition-transform">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: m.fondo, color: m.color }}><I size={24} /></div>
                  <p className="mt-3 font-semibold text-brand-navy">{m.nombre}</p>
                  <p className="text-xs text-gray-400 mt-1">{m.frase}</p>
                  <p className="mt-3 text-sm font-semibold" style={{ color: m.color }}>{conteo[m.id] ?? 0} preguntas</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Acceso */}
      <section className="max-w-6xl mx-auto px-4 py-16 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold">Entra a tu cuenta</h2>
          <p className="mt-3 text-gray-400">Los estudiantes entran con el usuario y el PIN que les entrega su docente. Los docentes, con su correo.</p>
          <ul className="mt-5 space-y-2 text-sm text-gray-300">
            <li className="flex gap-2"><Star size={16} className="text-brand-amber mt-0.5" /> Empieza por la <b>prueba diagnóstica</b>: en 40 minutos sabrás dónde estás.</li>
            <li className="flex gap-2"><Star size={16} className="text-brand-amber mt-0.5" /> Practica 5 preguntas al día con explicación completa.</li>
            <li className="flex gap-2"><Star size={16} className="text-brand-amber mt-0.5" /> Revisa "Mis errores" antes de cada simulacro.</li>
          </ul>
        </div>
        <div ref={acceso}><FormularioAcceso tipo={tipo} setTipo={setTipo} /></div>
      </section>

      <footer className="border-t border-dark-700 py-8 text-center text-xs text-gray-500">
        Plataforma de preparación Saber 11° · Preguntas de elaboración propia en estilo ICFES (no oficiales) · Textos de dominio público con su fuente
      </footer>
    </div>
  )
}

function Celular() {
  return (
    <div className="relative w-60 md:w-64 rounded-[2.2rem] border-[10px] border-slate-200 bg-dark-800 shadow-2xl shadow-slate-300 rotate-6">
      <div className="mx-auto mt-2 mb-3 w-16 h-1.5 rounded-full bg-slate-200" />
      <div className="px-4 pb-5">
        <div className="rounded-2xl h-28 bg-gradient-to-br from-sky-400 via-indigo-500 to-fuchsia-500 flex items-end p-3">
          <span className="badge bg-emerald-400 text-[#fff]">ALTO</span>
        </div>
        <div className="flex items-center justify-between mt-3">
          <ChevronLeft size={18} className="text-brand-blue" />
          <div className="text-center"><p className="text-sm font-semibold text-brand-navy">Inglés</p><p className="text-xl font-bold text-brand-navy">78<span className="text-xs text-gray-500">/100</span></p></div>
          <ChevronRight size={18} className="text-brand-blue" />
        </div>
        <div className="flex justify-center gap-1.5 mt-2">{[1, 2, 3, 4, 5].map(i => <Star key={i} size={16} className={i < 5 ? 'text-emerald-500 fill-emerald-500' : 'text-gray-600'} />)}</div>
        <p className="text-[10px] text-center text-gray-500 mt-1">Simulacros realizados: 2</p>
        <div className="mt-3 rounded-xl bg-brand-blue text-[#fff] text-center text-sm font-semibold py-2">Ver</div>
      </div>
    </div>
  )
}

function FormularioAcceso({ tipo, setTipo }) {
  const [usuario, setUsuario] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [cargando, setCargando] = useState(false)
  const [registro, setRegistro] = useState(false)
  const [reg, setReg] = useState({ nombre: '', apellido: '', pin: '', pin2: '' })

  const registrar = async (e) => {
    e.preventDefault(); setError('')
    if (reg.pin !== reg.pin2) { setError('Los dos PIN no coinciden'); return }
    setCargando(true)
    try { await registrarEstudiante(reg) } catch (err) { setError(err.message) }
    finally { setCargando(false) }
  }

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
    <div className="card !p-6 max-w-md mx-auto">
      <div className="flex rounded-xl bg-dark-900 p-1 mb-5 text-sm font-medium">
        {['estudiante', 'docente'].map(t => (
          <button key={t} type="button" onClick={() => setTipo(t)}
            className={`flex-1 rounded-lg py-2 ${tipo === t ? 'bg-brand-blue text-[#fff] shadow' : 'text-gray-400'}`}>
            {t === 'docente' ? 'Docente / Admin' : 'Estudiante'}
          </button>
        ))}
      </div>
      {tipo === 'estudiante' && registro ? (
        <form onSubmit={registrar} className="space-y-4">
          <p className="text-sm text-gray-400">Regístrate con tu primer nombre y tu primer apellido. Tu docente debe aceptar el registro antes de que puedas empezar.</p>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Primer nombre</label><input className="input" value={reg.nombre} onChange={e => setReg({ ...reg, nombre: e.target.value })} autoComplete="given-name" /></div>
            <div><label className="label">Primer apellido</label><input className="input" value={reg.apellido} onChange={e => setReg({ ...reg, apellido: e.target.value })} autoComplete="family-name" /></div>
          </div>
          {baseUsuario(reg.nombre, reg.apellido).length >= 4 && <p className="text-xs text-gray-500">Tu usuario será <span className="font-mono font-semibold text-brand-blue">{baseUsuario(reg.nombre, reg.apellido)}</span> (si ya existe, se le agrega un número).</p>}
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">PIN (4 a 8 dígitos)</label><input className="input" type="password" inputMode="numeric" value={reg.pin} onChange={e => setReg({ ...reg, pin: e.target.value })} autoComplete="new-password" /></div>
            <div><label className="label">Repite el PIN</label><input className="input" type="password" inputMode="numeric" value={reg.pin2} onChange={e => setReg({ ...reg, pin2: e.target.value })} autoComplete="new-password" /></div>
          </div>
          {error && <p className="text-sm text-brand-red">{error}</p>}
          <button className="btn-primary w-full !py-3 text-base" disabled={cargando}>{cargando ? 'Registrando…' : 'Registrarme'}</button>
          <button type="button" className="btn-ghost w-full text-sm" onClick={() => { setRegistro(false); setError('') }}>Ya tengo usuario, quiero entrar</button>
        </form>
      ) : (
      <form onSubmit={entrar} className="space-y-4">
        <div>
          <label className="label">{NUBE_DISPONIBLE && tipo === 'docente' ? 'Correo' : 'Usuario'}</label>
          <input className="input" value={usuario} onChange={e => setUsuario(e.target.value)} autoCapitalize="none" autoComplete="username"
            placeholder={tipo === 'docente' ? (NUBE_DISPONIBLE ? 'correo@colegio.edu.co' : 'docente') : 'tu.usuario'} />
        </div>
        <div>
          <label className="label">{NUBE_DISPONIBLE && tipo === 'docente' ? 'Contraseña' : 'PIN'}</label>
          <input className="input" type="password" inputMode={NUBE_DISPONIBLE && tipo === 'docente' ? 'text' : 'numeric'} value={pin} onChange={e => setPin(e.target.value)} autoComplete="current-password" placeholder="••••••" />
        </div>
        {error && <p className="text-sm text-brand-red">{error}</p>}
        {aviso && <p className="text-sm text-brand-green">{aviso}</p>}
        <button className="btn-primary w-full !py-3 text-base" disabled={cargando}>{cargando ? 'Entrando…' : 'Iniciar sesión'}</button>
        {NUBE_DISPONIBLE && tipo === 'docente' && (
          <button type="button" className="btn-ghost w-full text-xs" onClick={async () => {
            setError(''); setAviso('')
            if (!/\S+@\S+\.\S+/.test(usuario)) { setError('Escribe tu correo para enviarte el enlace'); return }
            try { await pedirRecuperacion(usuario.trim()); setAviso('Te enviamos un enlace al correo para crear una contraseña nueva.') } catch (e) { setError(e.message) }
          }}>¿Olvidaste tu contraseña o aún no la tienes?</button>
        )}
        {tipo === 'estudiante' && <button type="button" className="btn-secondary w-full" onClick={() => { setRegistro(true); setError('') }}>No tengo usuario: registrarme</button>}
      </form>
      )}
      {!NUBE_DISPONIBLE && (
        <div className="mt-4 text-xs text-gray-500 leading-relaxed">
          <p className="mb-1"><span className="badge bg-dark-700 text-gray-300">Modo local</span> Los datos se guardan solo en este dispositivo.</p>
          <p>Usuarios de demostración (PIN 1234): {USUARIOS_DEMO.map(u => u.usuario).join(', ')}, est1 … est6.</p>
        </div>
      )}
      {NUBE_DISPONIBLE && tipo === 'estudiante' && (
        <p className="mt-4 text-xs text-gray-500">Si olvidaste tu usuario o tu PIN, pídele a tu docente que lo restablezca.</p>
      )}
    </div>
  )
}
