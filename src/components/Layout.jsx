import { Home, BookOpen, AlertCircle, BarChart3, Map, Users, Library, Printer, Settings, LogOut, Wifi, WifiOff, RefreshCw, Timer } from 'lucide-react'
import { salir } from '../lib/sesion'
import { useSync, sincronizar } from '../lib/sync'
import { NUBE_DISPONIBLE } from '../lib/supabase'
import { ir } from '../lib/nav'

const MENU = {
  estudiante: [
    { ruta: 'inicio', nombre: 'Inicio', icono: Home },
    { ruta: 'simulacros', nombre: 'Pruebas', icono: Timer },
    { ruta: 'errores', nombre: 'Mis errores', icono: AlertCircle },
    { ruta: 'progreso', nombre: 'Progreso', icono: BarChart3 },
    { ruta: 'biblioteca', nombre: 'Biblioteca', icono: Library },
  ],
  docente: [
    { ruta: 'inicio', nombre: 'Grupos', icono: Users },
    { ruta: 'banco', nombre: 'Banco', icono: BookOpen },
    { ruta: 'biblioteca', nombre: 'Biblioteca', icono: Library },
    { ruta: 'imprimir', nombre: 'Papel', icono: Printer },
    { ruta: 'ruta', nombre: 'Programa', icono: Map },
  ],
  admin: [
    { ruta: 'admin', nombre: 'Admin', icono: Settings },
    { ruta: 'inicio', nombre: 'Grupos', icono: Users, params: { vista: 'docente' } },
    { ruta: 'banco', nombre: 'Banco', icono: BookOpen },
    { ruta: 'biblioteca', nombre: 'Biblioteca', icono: Library },
    { ruta: 'ruta', nombre: 'Programa', icono: Map },
  ],
}

export default function Layout({ usuario, ruta, children }) {
  const items = MENU[usuario.rol] ?? MENU.estudiante
  const activo = (it) => ruta === it.ruta || (ruta === 'inicio' && it.ruta === 'inicio')
  return (
    <div className="min-h-screen md:flex">
      {/* Barra lateral (escritorio) */}
      <aside className="no-print hidden md:flex md:flex-col w-56 shrink-0 border-r border-dark-700 bg-dark-800 p-3">
        <div className="flex items-center gap-2 px-2 py-2 mb-2">
          <img src="/icono.svg" alt="" className="w-7 h-7" />
          <span className="font-semibold">Saber 11</span>
        </div>
        <nav className="space-y-1">
          {items.map(it => (
            <button key={it.ruta + it.nombre} onClick={() => ir(it.ruta, it.params)}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${activo(it) ? 'bg-dark-700 text-white' : 'text-gray-400 hover:bg-dark-700 hover:text-white'}`}>
              <it.icono size={18} /> {it.nombre}
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-3 border-t border-dark-700">
          <EstadoSync />
          <div className="flex items-center justify-between px-2 mt-2">
            <div className="min-w-0">
              <p className="text-sm truncate">{usuario.nombre}</p>
              <p className="text-xs text-gray-500 capitalize">{usuario.rol}{usuario.curso ? ` · ${usuario.curso}` : ''}</p>
            </div>
            <button onClick={salir} className="text-gray-500 hover:text-white" title="Salir"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Barra superior (móvil) */}
        <header className="no-print md:hidden sticky top-0 z-20 bg-dark-900/95 backdrop-blur border-b border-dark-700 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/icono.svg" alt="" className="w-6 h-6" />
            <span className="font-semibold text-sm">Saber 11</span>
          </div>
          <div className="flex items-center gap-3">
            <EstadoSync compacto />
            <button onClick={salir} className="text-gray-500" title="Salir"><LogOut size={16} /></button>
          </div>
        </header>

        <main className="flex-1 p-4 pb-24 md:pb-6 max-w-4xl w-full mx-auto">{children}</main>

        {/* Navegación inferior (móvil) */}
        <nav className="no-print md:hidden fixed bottom-0 inset-x-0 z-20 bg-dark-800 border-t border-dark-700 flex" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {items.map(it => (
            <button key={it.ruta + it.nombre} onClick={() => ir(it.ruta, it.params)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] ${activo(it) ? 'text-brand-blue' : 'text-gray-500'}`}>
              <it.icono size={20} /> {it.nombre}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}

function EstadoSync({ compacto = false }) {
  const s = useSync()
  if (!NUBE_DISPONIBLE) {
    return compacto
      ? <span className="text-[10px] text-gray-500">local</span>
      : <p className="text-xs text-gray-500 px-2">Modo local · sin nube</p>
  }
  const Icono = s.enLinea ? Wifi : WifiOff
  const texto = !s.enLinea ? `Sin conexión · ${s.pendientes} por sincronizar` : s.pendientes ? `${s.pendientes} por sincronizar` : 'Sincronizado'
  return (
    <button onClick={sincronizar} className={`flex items-center gap-1.5 text-xs ${s.enLinea ? 'text-gray-400' : 'text-brand-amber'} ${compacto ? '' : 'px-2'}`} title={s.error ?? texto}>
      {s.sincronizando ? <RefreshCw size={14} className="animate-spin" /> : <Icono size={14} />}
      {!compacto && <span>{texto}</span>}
      {compacto && s.pendientes > 0 && <span>{s.pendientes}</span>}
    </button>
  )
}
