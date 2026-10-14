import { useEffect, useState } from 'react'
import { useSesion, iniciarSesionGuardada, LLEGO_POR_ENLACE } from './lib/sesion'
import { ir } from './lib/nav'
import CrearContrasena from './components/CrearContrasena'
import Pendiente from './components/Pendiente'
import { iniciarSiembra } from './lib/banco'
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
import Biblioteca from './components/Biblioteca'
import Materias from './components/estudiante/Materias'
import Materia from './components/estudiante/Materia'
import Refuerzo from './components/estudiante/Refuerzo'
import Historial from './components/estudiante/Historial'
import Carreras from './components/estudiante/Carreras'
import PanelDocente from './components/docente/PanelDocente'
import Grupo from './components/docente/Grupo'
import EstudianteDetalle from './components/docente/EstudianteDetalle'
import Banco from './components/docente/Banco'
import Imprimir from './components/docente/Imprimir'
import Admin from './components/admin/Admin'

// El arranque se ejecuta una sola vez aunque React (en desarrollo, StrictMode)
// monte el componente dos veces.
let arranque = null
function arrancar() {
  arranque ??= (async () => {
    aplicarExtension(await getConfig('taxonomia_extension'))
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
  const [bancoOk, setBancoOk] = useState(false)
  const [contrasenaLista, setContrasenaLista] = useState(false)
  // Docente/admin: previsualizar la app como la ve un estudiante
  const [vistaEstudiante, setVistaEstudianteRaw] = useState(() => { try { return localStorage.getItem('vista_estudiante') === '1' } catch { return false } })
  const setVistaEstudiante = (v) => { setVistaEstudianteRaw(v); try { localStorage.setItem('vista_estudiante', v ? '1' : '0') } catch {} ; ir('inicio') }

  useEffect(() => {
    arrancar().then(() => {
      setListo(true)
      // El banco se siembra después del primer dibujado para no retrasar la portada.
      setTimeout(() => iniciarSiembra().then(() => setBancoOk(true)).catch(e => { console.error(e); setErrorArranque(e.message) }), 600)
    }).catch(e => { console.error(e); setErrorArranque(e.message) })
  }, [])

  useEffect(() => { if (sesion.usuario) descargarDeNube(sesion.usuario) }, [sesion.usuario?.id])

  if (errorArranque) return <Pantalla>No se pudo iniciar la aplicación: {errorArranque}</Pantalla>
  if (!listo || sesion.cargando) return <Pantalla>Cargando…</Pantalla>
  if (!sesion.usuario) return <Login />
  if (!bancoOk) return <Pantalla>Preparando el banco de preguntas…</Pantalla>
  if (LLEGO_POR_ENLACE && !contrasenaLista) return <CrearContrasena onLista={() => { setContrasenaLista(true); ir('inicio') }} />

  const u = sesion.usuario
  if (u.rol === 'estudiante' && u.estado && u.estado !== 'activo') return <Pendiente usuario={u} />
  const previsualizando = vistaEstudiante && (u.rol === 'docente' || u.rol === 'admin')
  const uVista = previsualizando ? { ...u, rol: 'estudiante', previsualizacion: true } : u
  // Primera vez: el estudiante elige sus carreras (o decide hacerlo después) antes de ver el inicio.
  if (u.rol === 'estudiante' && !u.carreras_definidas) return <Carreras usuario={u} inicial />
  const vista = elegirVista(uVista.rol, ruta, params, uVista)
  return <Layout usuario={u} rolVista={uVista.rol} ruta={ruta} vistaEstudiante={previsualizando} onVistaEstudiante={setVistaEstudiante}>{vista}</Layout>
}

function elegirVista(rol, ruta, params, usuario) {
  // Rutas comunes
  if (ruta === 'biblioteca') return <Biblioteca usuario={usuario} params={params} />
  if (ruta === 'practica') return <Practica usuario={usuario} params={params} />
  if (ruta === 'sesion') return <SesionPrueba usuario={usuario} params={params} />
  if (ruta === 'materias') return <Materias usuario={usuario} params={params} />
  if (ruta === 'materia') return <Materia usuario={usuario} params={params} />
  if (ruta === 'historial') return <Historial usuario={usuario} params={params} />

  if (rol === 'estudiante') {
    switch (ruta) {
      case 'simulacros': return <Simulacros usuario={usuario} params={params} />
      case 'refuerzo': return <Refuerzo usuario={usuario} params={params} />
      case 'errores': return <MisErrores usuario={usuario} params={params} />
      case 'progreso': return <MiProgreso usuario={usuario} params={params} />
      case 'ruta': return <MiRuta usuario={usuario} params={params} />
      case 'carreras': return <Carreras usuario={usuario} params={params} />
      default: return <Inicio usuario={usuario} params={params} />
    }
  }
  if (rol === 'docente' || rol === 'admin') {
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

function Pantalla({ children }) {
  return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm p-6 text-center">{children}</div>
}
