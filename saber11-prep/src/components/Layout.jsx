import { Home, BookOpen, GraduationCap, AlertCircle, BarChart3, Map, Users, Library, Printer, Settings, LogOut, Wifi, WifiOff, RefreshCw, Timer, LayoutGrid, Eye, EyeOff, History, UserCheck, Compass, FileBarChart, BookOpenCheck, Rocket } from 'lucide-react'
import { useEffect, useState } from 'react'
import { salir, solicitudesPendientes } from '../lib/sesion'
import { useSync, sincronizar } from '../lib/sync'
import { NUBE_DISPONIBLE } from '../lib/supabase'
import { ir } from '../lib/nav'
import BarraPortal from './BarraPortal'
import { esRevisor } from '../lib/roles'

const MENU = {
  estudiante: [
    { ruta: 'inicio', nombre: 'Inicio', icono: Home },
    { ruta: 'materias', nombre: 'Materias', icono: LayoutGrid },
    { ruta: 'simulacros', nombre: 'Pruebas', icono: Timer },
    { ruta: 'refuerzo', nombre: 'Refuerzo', icono: GraduationCap },
    { ruta: 'errores', nombre: 'Errores', icono: AlertCircle },
    { ruta: 'historial', nombre: 'Historial', icono: History },
  ],
  docente: [
    { ruta: 'inicio', nombre: 'Grupos', icono: Users },
    { ruta: 'materias', nombre: 'Materias', icono: LayoutGrid },
    { ruta: 'banco', nombre: 'Banco', icono: BookOpen },
    { ruta: 'biblioteca', nombre: 'Biblioteca', icono: Library },
    { ruta: 'imprimir', nombre: 'Papel', icono: Printer },
  ],
  revisor: [
    { ruta: 'inicio', nombre: 'Grupos', icono: Users },
    { ruta: 'materias', nombre: 'Materias', icono: LayoutGrid },
    { ruta: 'banco', nombre: 'Banco', icono: BookOpen },
    { ruta: 'biblioteca', nombre: 'Biblioteca', icono: Library },
  ],
  admin: [
    { ruta: 'admin', nombre: 'Admin', icono: Settings },
    { ruta: 'inicio', nombre: 'Grupos', icono: Users, params: { vista: 'docente' } },
    { ruta: 'materias', nombre: 'Materias', icono: LayoutGrid },
    { ruta: 'banco', nombre: 'Banco', icono: BookOpen },
    { ruta: 'biblioteca', nombre: 'Biblioteca', icono: Library },
  ],
}
const EXTRA_ESCRITORIO = {
  estudiante: [{ ruta: 'progreso', nombre: 'Progreso', icono: BarChart3 }, { ruta: 'biblioteca', nombre: 'Biblioteca', icono: Library }, { ruta: 'ruta', nombre: 'Mi ruta', icono: Map }, { ruta: 'carreras', nombre: 'Mi carrera', icono: Compass }, { ruta: 'futuro', nombre: 'Mi futuro', icono: Rocket }, { ruta: 'informe', nombre: 'Mi informe', icono: FileBarChart }, { ruta: 'guia', nombre: 'Guía ICFES', icono: BookOpenCheck }],
  docente: [{ ruta: 'ruta', nombre: 'Programa', icono: Map }, { ruta: 'guia', nombre: 'Guía ICFES', icono: BookOpenCheck }],
  admin: [{ ruta: 'ruta', nombre: 'Programa', icono: Map }, { ruta: 'guia', nombre: 'Guía ICFES', icono: BookOpenCheck }],
  revisor: [{ ruta: 'ruta', nombre: 'Programa', icono: Map }, { ruta: 'guia', nombre: 'Guía ICFES', icono: BookOpenCheck }],
}

export default function Layout({ usuario, rolVista, ruta, children, vistaEstudiante = false, onVistaEstudiante = null }) {
  const rol = rolVista ?? usuario.rol
  const items = MENU[rol] ?? MENU.estudiante
  const extra = EXTRA_ESCRITORIO[rol] ?? []
  const activo = (it) => ruta === it.ruta || (ruta === 'materia' && it.ruta === 'materias')
  const puedePrevisualizar = usuario.rol === 'admin' || usuario.rol === 'docente'
  // El logo siempre lleva al inicio del rol que se está viendo.
  const irInicio = () => { ir('inicio', rol === 'docente' ? { vista: 'docente' } : {}); window.scrollTo({ top: 0 }) }
  const enInicio = ruta === 'inicio' || ruta === '' || ruta == null

  return (
    <div className="min-h-screen md:flex">
      {/* Barra lateral (escritorio) */}
      <aside className="no-print hidden md:flex md:flex-col w-60 shrink-0 border-r border-dark-700 bg-dark-800 p-4">
        <button onClick={irInicio} className="flex items-center gap-2 px-2 py-2 mb-4 rounded-xl hover:bg-dark-900 text-left" title="Ir al inicio" aria-label="Ir al inicio">
          <img src="/icono.svg" alt="" className="w-9 h-9" />
          <span className="text-xl font-bold text-brand-blue">Saber<span className="text-brand-navy">11</span></span>
        </button>
        <nav className="space-y-1">
          {[...items, ...extra].map(it => (
            <button key={it.ruta + it.nombre} onClick={() => ir(it.ruta, it.params)}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${activo(it) ? 'bg-sky-50 text-brand-blue' : 'text-gray-400 hover:bg-dark-900 hover:text-brand-navy'}`}>
              <it.icono size={19} /> {it.nombre}
            </button>
          ))}
        </nav>
        {puedePrevisualizar && (
          <button onClick={() => onVistaEstudiante?.(!vistaEstudiante)} className={`mt-4 w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold border ${vistaEstudiante ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-dark-600 text-brand-navy hover:border-brand-blue'}`}>
            {vistaEstudiante ? <EyeOff size={18} /> : <Eye size={18} />} {vistaEstudiante ? 'Volver a mi vista' : 'Ver como estudiante'}
          </button>
        )}
        <div className="mt-auto pt-3 border-t border-dark-700">
          <EstadoSync />
          <div className="flex items-center justify-between px-2 mt-2">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate text-brand-navy">{usuario.nombre}</p>
              <p className="text-xs text-gray-500 capitalize">{usuario.rol}{usuario.curso ? ` · ${usuario.curso}` : ''}</p>
            </div>
            <button onClick={salir} className="text-gray-500 hover:text-brand-red" title="Salir" aria-label="Salir"><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {vistaEstudiante && (
          <div className="no-print sticky top-0 z-30 bg-amber-100 border-b border-amber-300 text-amber-800 text-sm px-4 py-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2"><Eye size={16} /> Estás viendo la app como la ven tus estudiantes. Tus respuestas de prueba quedan en tu cuenta.</span>
            <button onClick={() => onVistaEstudiante?.(false)} className="font-semibold underline shrink-0">Salir de esta vista</button>
          </div>
        )}
        {enInicio && <BarraPortal />}
        {esRevisor(usuario) && (
          <div className="no-print bg-sky-50 border-b border-sky-200 text-brand-navy text-xs px-4 py-1.5 flex items-center gap-2"><Eye size={14} /> Cuenta de revisión: puedes ver todo, pero no modificar nada.</div>
        )}
        {/* Barra superior (móvil) */}
        <header className="no-print md:hidden sticky top-0 z-20 bg-dark-800/95 backdrop-blur border-b border-dark-700 px-4 py-2.5 flex items-center justify-between">
          <button onClick={irInicio} className="flex items-center gap-2" title="Ir al inicio" aria-label="Ir al inicio">
            <img src="/icono.svg" alt="" className="w-7 h-7" />
            <span className="font-bold text-brand-blue">Saber<span className="text-brand-navy">11</span></span>
          </button>
          <div className="flex items-center gap-3">
            {puedePrevisualizar && (
              <button onClick={() => onVistaEstudiante?.(!vistaEstudiante)} className="text-brand-blue" title={vistaEstudiante ? 'Volver a mi vista' : 'Ver como estudiante'}>{vistaEstudiante ? <EyeOff size={19} /> : <Eye size={19} />}</button>
            )}
            <EstadoSync compacto />
            <button onClick={salir} className="text-gray-500" title="Salir" aria-label="Salir"><LogOut size={17} /></button>
          </div>
        </header>

        {puedePrevisualizar && !vistaEstudiante && <AvisoSolicitudes ruta={ruta} esAdmin={usuario.rol === 'admin'} />}
        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 max-w-5xl w-full mx-auto">{children}</main>

        {/* Navegación inferior (móvil) */}
        <nav className="no-print md:hidden fixed bottom-0 inset-x-0 z-20 bg-dark-800 border-t border-dark-700 flex shadow-[0_-4px_12px_rgba(15,23,42,0.06)]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {items.map(it => (
            <button key={it.ruta + it.nombre} onClick={() => ir(it.ruta, it.params)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${activo(it) ? 'text-brand-blue' : 'text-gray-500'}`}>
              <it.icono size={21} /> {it.nombre}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}

// Aviso para docente/admin, en cualquier pantalla, de que hay estudiantes esperando aprobación.
function AvisoSolicitudes({ ruta, esAdmin }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const contar = () => solicitudesPendientes().then(l => setN(l.length)).catch(() => {})
    contar()
    const t = setInterval(contar, 30_000)
    window.addEventListener('focus', contar)
    return () => { clearInterval(t); window.removeEventListener('focus', contar) }
  }, [ruta])
  // En el panel de grupos ya se ve la tarjeta de solicitudes
  const enPanel = ruta === 'inicio' && (!esAdmin || window.location.hash.includes('vista=docente'))
  if (!n || enPanel) return null
  return (
    <button onClick={() => ir('inicio', { vista: 'docente' })} className="no-print w-full bg-sky-50 border-b border-sky-200 text-brand-navy text-sm px-4 py-2.5 flex items-center justify-center gap-2 font-medium">
      <UserCheck size={17} className="text-brand-blue" /> {n === 1 ? 'Hay 1 estudiante esperando' : `Hay ${n} estudiantes esperando`} que aceptes su registro <span className="underline text-brand-blue">Revisar</span>
    </button>
  )
}

function EstadoSync({ compacto = false }) {
  const s = useSync()
  if (!NUBE_DISPONIBLE) {
    // Sin nube también se avisa cuando no hay conexión: la app sigue funcionando con IndexedDB.
    const off = !s.enLinea
    return compacto
      ? <span className={`text-[10px] ${off ? 'text-brand-amber' : 'text-gray-500'}`} role="status">{off ? 'Sin conexión' : 'local'}</span>
      : <p className={`text-xs px-2 ${off ? 'text-brand-amber' : 'text-gray-500'}`} role="status">{off ? 'Sin conexión · todo se guarda en este dispositivo' : 'Modo local · sin nube'}</p>
  }
  const Icono = s.enLinea ? Wifi : WifiOff
  const texto = !s.enLinea ? `Sin conexión · ${s.pendientes} por sincronizar` : s.pendientes ? `${s.pendientes} por sincronizar` : 'Sincronizado'
  const conError = Boolean(s.error) && s.pendientes > 0
  return (
    <div className={compacto ? '' : 'px-2'}>
      <button onClick={sincronizar} className={`flex items-center gap-1.5 text-xs ${conError ? 'text-brand-red' : s.enLinea ? 'text-gray-400' : 'text-brand-amber'}`} title={s.error ?? texto}>
        {s.sincronizando ? <RefreshCw size={14} className="animate-spin" /> : <Icono size={14} />}
        {!compacto && <span>{conError ? `${s.pendientes} sin subir · toca para reintentar` : texto}</span>}
        {compacto && s.pendientes > 0 && <span>{s.pendientes}</span>}
      </button>
      {!compacto && conError && <p className="text-[10px] text-brand-red mt-1 break-words">{s.error}</p>}
    </div>
  )
}
