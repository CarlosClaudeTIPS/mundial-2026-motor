import { useEffect, useState } from 'react'
import { cicloActivo, listarCiclos, estadoCiclo, programa, formatoFecha } from '../../lib/ciclo'
import { Titulo, Badge, Barra } from '../ui'
import { Compass } from 'lucide-react'
import { modoCarreraActivo, prioridadesDeUsuario, horasPorPrueba, formatoMinutos, carreraPorId, NOMBRE_NIVEL } from '../../lib/carreras'
import { MATERIAS } from '../Login'
import { ir } from '../../lib/nav'

// ─── Mi ruta: el programa de ~6 meses aplicado al ciclo activo ───────────────

export default function MiRuta({ usuario }) {
  const [d, setD] = useState(null)
  useEffect(() => {
    (async () => {
      const ciclos = await listarCiclos()
      const ciclo = ciclos.find(c => c.id === usuario.ciclo_id) ?? await cicloActivo()
      const prog = await programa()
      setD({ ciclo, prog, estado: estadoCiclo(ciclo, prog) })
    })()
  }, [usuario.id])
  if (!d) return <p className="text-sm text-gray-400">Cargando…</p>
  const { ciclo, prog, estado } = d
  if (!ciclo) return <><Titulo>Mi ruta</Titulo><p className="text-sm text-gray-400">No hay un ciclo configurado. El administrador puede crearlo.</p></>

  return (
    <div className="space-y-4">
      <Titulo sub={`${ciclo.nombre} · examen el ${formatoFecha(ciclo.fecha_examen)}`}>Mi ruta</Titulo>
      {ciclo.fecha_provisional && <p className="text-xs text-brand-amber">La fecha del examen es provisional: el ICFES aún no publica el cronograma. Se actualizará desde Administración cuando salga la fecha oficial.</p>}
      <div className="card">
        <div className="flex justify-between text-sm mb-1"><span>Avance del ciclo</span><span className="text-gray-300">{Math.round(estado.progreso * 100)}%</span></div>
        <Barra valor={estado.progreso * 100} />
        <p className="text-xs text-gray-400 mt-2">
          {estado.estado === 'no_iniciado' ? `Empieza el ${formatoFecha(ciclo.fecha_inicio)}.` : `Semana ${estado.semanaActual} de ${estado.semanasTotales} · ${estado.diasRestantes} días para el examen.`}
          {estado.enPausa && ` Ahora: ${estado.pausaActual}.`}
          {(ciclo.pausas ?? []).length > 0 && ` Pausas: ${ciclo.pausas.map(p => `${p.nombre} (${formatoFecha(p.inicio)} – ${formatoFecha(p.fin)})`).join('; ')}.`}
          {' '}Dedicación sugerida: {prog.horas_estudiante_semana.clase} h de clase + {prog.horas_estudiante_semana.autonomo} h de práctica autónoma por semana.
        </p>
      </div>
      {usuario.rol === 'estudiante' && modoCarreraActivo(usuario) && <RutaCarrera usuario={usuario} horasAutonomas={prog.horas_estudiante_semana.autonomo} />}
      <div className="space-y-2">
        {estado.fases.map(f => {
          const actual = estado.fase?.id === f.id
          const pasada = estado.semanaActual > f.semana_fin
          return (
            <div key={f.id} className={`card ${actual ? 'border-brand-blue' : pasada ? 'opacity-70' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{f.nombre}</p>
                <div className="flex gap-1">{actual && <Badge tono="azul">ahora</Badge>}{pasada && <Badge tono="verde">hecha</Badge>}<Badge>sem. {f.semana_inicio}–{f.semana_fin}</Badge></div>
              </div>
              <p className="text-sm text-gray-300 mt-1">{f.objetivo}</p>
              <ul className="text-sm text-gray-400 mt-2 space-y-1 list-disc pl-5">{f.actividades.map(a => <li key={a}>{a}</li>)}</ul>
              <p className="text-xs text-gray-500 mt-2">Mini-prueba semanal: {f.mini_prueba.cantidad} preguntas en {f.mini_prueba.tiempo_min} min ({f.mini_prueba.enfoque}).{f.simulacro && ` Simulacro ${f.simulacro.tipo.replace('_', ' ')} al ${Math.round(f.simulacro.escala * 100)} %.`}</p>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-gray-500">{prog._estado}</p>
    </div>
  )
}

// Modo carrera: cómo repartir las horas de práctica autónoma de la semana entre las materias.
function RutaCarrera({ usuario, horasAutonomas }) {
  const filas = horasPorPrueba(prioridadesDeUsuario(usuario), horasAutonomas)
  const carreras = (usuario.carreras ?? []).map(carreraPorId).filter(Boolean)
  const tono = { alta: 'azul', media: 'ambar', base: 'gris' }
  return (
    <div className="card border-brand-blue/40">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium flex items-center gap-2"><Compass size={18} className="text-brand-blue" /> Tu semana en modo carrera</p>
        <button onClick={() => ir('carreras')} className="text-xs font-semibold text-brand-blue shrink-0">Cambiar</button>
      </div>
      <p className="text-xs text-gray-400 mt-1">{carreras.map(c => c.nombre).join(' · ')} · {horasAutonomas} h de práctica autónoma repartidas así:</p>
      <div className="mt-3 space-y-2">
        {filas.map(f => { const m = MATERIAS.find(x => x.id === f.prueba); return (
          <div key={f.prueba}>
            <div className="flex justify-between text-sm mb-1"><span className="flex items-center gap-2">{m.nombre} <Badge tono={tono[f.nivel]}>{NOMBRE_NIVEL[f.nivel]}</Badge></span><span className="text-gray-300">{formatoMinutos(f.minutos)}</span></div>
            <Barra valor={f.proporcion * 100 * 2.5} color={m.color} alto={6} />
          </div>) })}
      </div>
      <p className="text-[11px] text-gray-500 mt-2">Las horas de clase siguen el programa normal para las cinco pruebas. Lo que cambia es en qué inviertes tu tiempo de práctica por tu cuenta.</p>
    </div>
  )
}
