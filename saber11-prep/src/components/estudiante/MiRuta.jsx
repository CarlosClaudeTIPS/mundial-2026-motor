import { useEffect, useState } from 'react'
import { cicloActivo, listarCiclos, estadoCiclo, programa, formatoFecha } from '../../lib/ciclo'
import { Titulo, Badge, Barra } from '../ui'

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
