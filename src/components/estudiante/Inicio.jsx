import { useEffect, useState } from 'react'
import { Play, Timer, AlertCircle, BarChart3, Map, Library, ClipboardList } from 'lucide-react'
import { intentosDe, asignacionesPendientes } from '../../lib/datos'
import { cicloActivo, estadoCiclo, programa, formatoFecha } from '../../lib/ciclo'
import { recomendar, reglasVigentes } from '../../lib/reglas'
import { listarPreguntas } from '../../lib/banco'
import { resumen } from '../../lib/analitica'
import { ir } from '../../lib/nav'
import { Barra, Badge } from '../ui'
import { crearMiniPrueba, crearSimulacro } from '../../lib/pruebas'

export default function Inicio({ usuario }) {
  const [datos, setDatos] = useState(null)

  useEffect(() => {
    (async () => {
      const [intentos, ciclo, prog, preguntas, pendientes] = await Promise.all([intentosDe(usuario.id), cicloActivo(), programa(), listarPreguntas(), asignacionesPendientes(usuario)])
      const preguntasPorId = Object.fromEntries(preguntas.map(p => [p.id, p]))
      setDatos({
        intentos, ciclo, estado: estadoCiclo(ciclo, prog), pendientes,
        resumen: resumen(intentos, preguntasPorId),
        recs: recomendar(intentos, { preguntasPorId, reglas: await reglasVigentes() }).slice(0, 2),
        totalBanco: preguntas.length,
      })
    })()
  }, [usuario.id])

  if (!datos) return <p className="text-gray-400 text-sm">Cargando…</p>
  const { estado, ciclo, resumen: r, recs, pendientes } = datos
  const vistas = new Set(datos.intentos.map(i => i.pregunta_id)).size
  const progresoBanco = Math.round((vistas / Math.max(1, datos.totalBanco)) * 100)
  const errores = datos.intentos.filter(i => !i.correcta).length

  const abrirAsignacion = async (a) => {
    try {
      const s = a.tipo === 'simulacro'
        ? await crearSimulacro({ estudiante: usuario, ...a.config, asignacion_id: a.id, titulo: a.titulo })
        : await crearMiniPrueba({ estudiante: usuario, ...a.config, asignacion_id: a.id, titulo: a.titulo })
      ir('sesion', { id: s.id })
    } catch (e) { alert(e.message) }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Hola, {usuario.nombre.split(' ')[0]}</h1>
        {ciclo && estado && (
          <p className="text-sm text-gray-400 mt-1">
            {estado.estado === 'no_iniciado' && `El ciclo ${ciclo.nombre} empieza el ${formatoFecha(ciclo.fecha_inicio)}.`}
            {estado.estado === 'en_curso' && <>Semana {estado.semanaActual} de {estado.semanasTotales} · {estado.fase?.nombre} · faltan {estado.diasRestantes} días para el examen</>}
            {estado.estado === 'dia_examen' && '¡Hoy es el examen! Lee con calma y verifica cada respuesta.'}
            {estado.estado === 'terminado' && `El ciclo ${ciclo.nombre} ya terminó.`}
            {ciclo.fecha_provisional && <Badge tono="ambar">fecha provisional</Badge>}
          </p>
        )}
      </div>

      <div className="card">
        <div className="flex justify-between text-sm mb-1">
          <span>Tu progreso en el banco</span><span className="text-gray-300">{progresoBanco}%</span>
        </div>
        <Barra valor={progresoBanco} />
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <div><p className="text-xl font-medium">{r.total}</p><p className="text-xs text-gray-500">respuestas</p></div>
          <div><p className="text-xl font-medium">{r.precision ?? '—'}{r.precision != null && '%'}</p><p className="text-xs text-gray-500">aciertos</p></div>
          <div><p className="text-xl font-medium">{errores}</p><p className="text-xs text-gray-500">errores para revisar</p></div>
        </div>
      </div>

      {pendientes.length > 0 && (
        <div className="card border-brand-blue/40">
          <p className="text-sm font-medium flex items-center gap-2 mb-2"><ClipboardList size={16} /> Tu docente te asignó</p>
          <div className="space-y-2">
            {pendientes.map(a => (
              <button key={a.id} onClick={() => abrirAsignacion(a)} className="w-full text-left rounded-lg bg-dark-900 border border-dark-600 p-3 hover:border-gray-400">
                <p className="text-sm font-medium">{a.titulo}</p>
                <p className="text-xs text-gray-400">{a.tipo === 'simulacro' ? 'Simulacro' : 'Mini-prueba'}{a.config?.cantidad ? ` · ${a.config.cantidad} preguntas` : ''}{a.config?.tiempo_min ? ` · ${a.config.tiempo_min} min` : ''}{a.fecha_limite ? ` · hasta ${formatoFecha(a.fecha_limite)}` : ''}</p>
                {a.nota && <p className="text-xs text-gray-500 mt-1">{a.nota}</p>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Accion icono={Play} titulo="Continuar práctica" sub="5 preguntas con explicación" onClick={() => ir('practica', { n: 5 })} destacada />
        <Accion icono={Timer} titulo="Mini-prueba" sub={`${estado?.fase?.mini_prueba?.cantidad ?? 10} preguntas · ${estado?.fase?.mini_prueba?.tiempo_min ?? 20} min`} onClick={async () => { const f = estado?.fase?.mini_prueba; const s = await crearMiniPrueba({ estudiante: usuario, cantidad: f?.cantidad ?? 10, tiempo_min: f?.tiempo_min ?? 20, titulo: 'Mini-prueba de la semana' }); ir('sesion', { id: s.id }) }} />
        <Accion icono={AlertCircle} titulo="Mis errores" sub={`${errores} para revisar`} onClick={() => ir('errores')} />
        <Accion icono={BarChart3} titulo="Mi progreso" sub="por prueba y habilidad" onClick={() => ir('progreso')} />
        <Accion icono={Timer} titulo="Simulacros" sub="por sesión, cronometrados" onClick={() => ir('simulacros')} />
        <Accion icono={Map} titulo="Mi ruta" sub="programa de 6 meses" onClick={() => ir('ruta')} />
      </div>

      <div className="card">
        <p className="text-sm font-medium mb-2">Recomendado para ti</p>
        <div className="space-y-2">
          {recs.map((rec, i) => (
            <div key={i} className="rounded-lg bg-dark-900 p-3">
              <p className="text-sm font-medium">{rec.titulo}</p>
              <p className="text-xs text-gray-400 mt-0.5">{rec.dato}</p>
              <p className="text-xs text-gray-500 mt-0.5">{rec.nombre_practica}: {rec.descripcion_practica}</p>
              <button className="btn-secondary mt-2 !py-1.5 text-xs" onClick={() => lanzarAccion(rec.accion, usuario)}>Practicar</button>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-500 mt-2">Las recomendaciones salen de reglas simples sobre tus últimos intentos, no de un modelo que adivina.</p>
      </div>

      <button className="btn-ghost w-full" onClick={() => ir('biblioteca')}><Library size={16} /> Biblioteca de recursos</button>
    </div>
  )
}

export async function lanzarAccion(accion, usuario) {
  if (!accion) return
  if (accion.tipo === 'practica') return ir('practica', { ...accion.filtros, n: accion.n ?? 5, verificacion: accion.verificacion ? '1' : undefined })
  if (accion.tipo === 'ids') return ir('practica', { ids: accion.ids.join(',') })
  if (accion.tipo === 'mini') {
    const s = await crearMiniPrueba({ estudiante: usuario, cantidad: accion.config?.cantidad ?? 8, tiempo_min: accion.config?.cronometro ? Math.round((accion.config?.cantidad ?? 8) * 1.5) : accion.config?.tiempo_min ?? null, filtros: accion.config?.filtros ?? {}, titulo: 'Mini-prueba recomendada' })
    return ir('sesion', { id: s.id })
  }
}

function Accion({ icono: Icono, titulo, sub, onClick, destacada = false }) {
  return (
    <button onClick={onClick} className={`text-left rounded-xl border p-3 transition-colors ${destacada ? 'border-brand-blue bg-dark-800' : 'border-dark-700 bg-dark-800 hover:border-gray-500'}`}>
      <Icono size={20} className={destacada ? 'text-brand-blue' : 'text-gray-300'} />
      <p className="text-sm font-medium mt-2">{titulo}</p>
      <p className="text-xs text-gray-400">{sub}</p>
    </button>
  )
}
