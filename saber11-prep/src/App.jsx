import { useEffect, useState, lazy, Suspense } from 'react'
import { useSesion, iniciarSesionGuardada, LLEGO_POR_ENLACE } from './lib/sesion'
import { ir } from './lib/nav'
import CrearContrasena from './components/CrearContrasena'
import Pendiente from './components/Pendiente'
import { sembrarBanco, observarSiembra, estadoDeSiembra } from './lib/banco'
import { sembrarRecursos } from './lib/recursos'
import { asegurarCiclos } from './lib/ciclo'
import { asegurarDatosIniciales } from './lib/demo'
import { iniciarSync, descargarDeNube } from './lib/sync'
import { aplicarExtension } from './lib/taxonomia'
import { getConfig } from './lib/db'
import { useRuta } from './lib/nav'
import Login from './components/Login'
import Layout from './components/Layout'
import Inicio from './components/estudiante/Inicio'
import Practica from './components/estudiante/Practica'
import SesionPrueba from './components/estudiante/SesionPrueba'
import Simulacros from './components/estudiante/Simulacros'
import MisErrores from './components/estudiante/MisErrores'
import MiProgreso from './components/estudiante/MiProgreso'
import MiRuta from './components/estudiante/MiRuta'
// Carga perezosa con reintento: si una pantalla no se puede descargar (por ejemplo, la app se
// actualizó y el navegador aún tenía la página anterior en caché), se recarga una sola vez.
const cargar = (importar) => lazy(() => importar().catch((e) => {
  const clave = 'recarga_por_trozo'
  if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem(clave)) { sessionStorage.setItem(clave, '1'); window.location.reload(); return new Promise(() => {}) }
  throw e
}))
const Biblioteca = cargar(() => import('./components/Biblioteca'))
import Materias from './components/estudiante/Materias'
import Materia from './components/estudiante/Materia'
import Refuerzo from './components/estudiante/Refuerzo'
const Historial = cargar(() => import('./components/estudiante/Historial'))
import Carreras from './components/estudiante/Carreras'
const MiFuturo = cargar(() => import('./components/estudiante/MiFuturo'))
const Informe = cargar(() => import('./components/Informe'))
const Guia = cargar(() => import('./components/Guia'))
const PanelDocente = cargar(() => import('./components/docente/PanelDocente'))
const Grupo = cargar(() => import('./components/docente/Grupo'))
const EstudianteDetalle = cargar(() => import('./components/docente/EstudianteDetalle'))
const Banco = cargar(() => import('./components/docente/Banco'))
const Imprimir = cargar(() => import('./components/docente/Imprimir'))
const Admin = cargar(() => import('./components/admin/Admin'))

// El arranque se ejecuta una sola vez aunque React (en desarrollo, StrictMode)
// monte el componente dos veces.
let arranque = null
function arrancar() {
  arranque ??= (async () => {
    aplicarExtension(await getConfig('taxonomia_extension'))
    sembrarBanco() // en segundo plano: descarga los trozos del banco y los vuelca a IndexedDB sin bloquear la pantalla
    await sembrarRecursos()
    await asegurarCiclos()
    await asegurarDatosIniciales()
    await iniciarSesionGuardada()
    iniciarSync()
  })()
  return arranque
}

export default function App() {
  const sesion = useSesion()
  const { ruta, params } = useRuta()
  const [listo, setListo] = useState(false)
  const [errorArranque, setErrorArranque] = useState(null)
  const [contrasenaLista, setContrasenaLista] = useState(false)
  // Docente/admin: previsualizar la app como la ve un estudiante
  const [vistaEstudiante, setVistaEstudianteRaw] = useState(() => { try { return localStorage.getItem('vista_estudiante') === '1' } catch { return false } })
  const setVistaEstudiante = (v) => { setVistaEstudianteRaw(v); try { localStorage.setItem('vista_estudiante', v ? '1' : '0') } catch {} ; ir('inicio') }

  useEffect(() => {
    try { sessionStorage.removeItem('recarga_por_trozo') } catch {}
    arrancar().then(() => setListo(true)).catch(e => { console.error(e); setErrorArranque(e.message) })
  }, [])

  useEffect(() => { if (sesion.usuario) descargarDeNube(sesion.usuario) }, [sesion.usuario?.id])

  if (errorArranque) return <Pantalla>No se pudo iniciar la aplicación: {errorArranque}</Pantalla>
  if (!listo || sesion.cargando) return <Pantalla>Cargando…</Pantalla>
  if (!sesion.usuario) return <Login />
  if (LLEGO_POR_ENLACE && !contrasenaLista) return <CrearContrasena onLista={() => { setContrasenaLista(true); ir('inicio') }} />

  const u = sesion.usuario
  if (u.rol === 'estudiante' && u.estado && u.estado !== 'activo') return <Pendiente usuario={u} />
  const previsualizando = vistaEstudiante && (u.rol === 'docente' || u.rol === 'admin')
  const uVista = previsualizando ? { ...u, rol: 'estudiante', previsualizacion: true } : u
  // Primera vez: el estudiante elige sus carreras (o decide hacerlo después) antes de ver el inicio.
  if (u.rol === 'estudiante' && !u.carreras_definidas) return <Carreras usuario={u} inicial />
  const vista = elegirVista(uVista.rol, ruta, params, uVista)
  return <Layout usuario={u} rolVista={uVista.rol} ruta={ruta} vistaEstudiante={previsualizando} onVistaEstudiante={setVistaEstudiante}><BarraSiembra /><Suspense fallback={<p className="text-sm text-gray-400" role="status">Cargando…</p>}>{vista}</Suspense></Layout>
}

function elegirVista(rol, ruta, params, usuario) {
  // Rutas comunes
  if (ruta === 'biblioteca') return <Biblioteca usuario={usuario} params={params} />
  if (ruta === 'practica') return <Practica usuario={usuario} params={params} />
  if (ruta === 'sesion') return <SesionPrueba usuario={usuario} params={params} />
  if (ruta === 'materias') return <Materias usuario={usuario} params={params} />
  if (ruta === 'materia') return <Materia usuario={usuario} params={params} />
  if (ruta === 'historial') return <Historial usuario={usuario} params={params} />
  if (ruta === 'informe') return <Informe usuario={usuario} params={params} />
  if (ruta === 'guia') return <Guia usuario={usuario} params={params} />

  if (rol === 'estudiante') {
    switch (ruta) {
      case 'simulacros': return <Simulacros usuario={usuario} params={params} />
      case 'refuerzo': return <Refuerzo usuario={usuario} params={params} />
      case 'errores': return <MisErrores usuario={usuario} params={params} />
      case 'progreso': return <MiProgreso usuario={usuario} params={params} />
      case 'ruta': return <MiRuta usuario={usuario} params={params} />
      case 'carreras': return <Carreras usuario={usuario} params={params} />
      case 'futuro': return <MiFuturo usuario={usuario} params={params} />
      default: return <Inicio usuario={usuario} params={params} />
    }
  }
  if (rol === 'docente' || rol === 'admin' || rol === 'revisor') {
    switch (ruta) {
      case 'grupo': return <Grupo usuario={usuario} params={params} />
      case 'estudiante': return <EstudianteDetalle usuario={usuario} params={params} />
      case 'banco': return <Banco usuario={usuario} params={params} />
      case 'imprimir': return <Imprimir usuario={usuario} params={params} />
      case 'admin': return rol === 'admin' ? <Admin usuario={usuario} params={params} /> : <PanelDocente usuario={usuario} params={params} />
      case 'simulacros': return <Simulacros usuario={usuario} params={params} />
      case 'ruta': return <MiRuta usuario={usuario} params={params} />
      default: return rol === 'admin' && ruta === 'inicio' && params.vista !== 'docente' ? <Admin usuario={usuario} params={params} /> : <PanelDocente usuario={usuario} params={params} />
    }
  }
  return <Pantalla>Rol desconocido</Pantalla>
}

// Estado de la siembra del banco (descarga de los trozos y volcado a IndexedDB), visible pero sin bloquear.
function BarraSiembra() {
  const [s, setS] = useState(estadoDeSiembra())
  useEffect(() => observarSiembra(setS), [])
  if (s.fase === 'lista' || s.fase === 'pendiente') return null
  if (s.fase === 'error') return <div className="no-print rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs px-3 py-2 mb-3 flex items-center justify-between gap-2" role="alert"><span>No se pudo descargar el banco de preguntas ({s.error}). Si tienes conexión, reintenta.</span><button className="font-semibold underline" onClick={() => sembrarBanco()}>Reintentar</button></div>
  const pct = s.total ? Math.round((s.hechos / s.total) * 100) : 0
  return (
    <div className="no-print rounded-xl border border-sky-200 bg-sky-50 text-xs text-brand-navy px-3 py-2 mb-3" role="status" aria-live="polite">
      <div className="flex justify-between"><span>{s.fase === 'guardando' ? 'Guardando el banco de preguntas en tu dispositivo…' : `Preparando el banco de preguntas (${s.hechos} de ${s.total})…`}</span><span>{s.fase === 'guardando' ? '' : `${pct} %`}</span></div>
      <div className="h-1.5 rounded-full bg-sky-100 mt-1 overflow-hidden"><div className="h-full bg-brand-blue transition-all" style={{ width: `${s.fase === 'guardando' ? 100 : pct}%` }} /></div>
    </div>
  )
}

function Pantalla({ children }) {
  return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm p-6 text-center">{children}</div>
}
