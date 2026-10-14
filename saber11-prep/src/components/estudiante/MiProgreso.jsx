import { useEffect, useState } from 'react'
import { intentosDe } from '../../lib/datos'
import { listarPreguntas } from '../../lib/banco'
import { resumen, evolucionSemanal } from '../../lib/analitica'
import { recomendar, reglasVigentes } from '../../lib/reglas'
import { Titulo, FilaMetrica, Metrica, Vacio, formatoTiempo } from '../ui'
import { lanzarAccion } from './Inicio'

export default function MiProgreso({ usuario }) {
  const [d, setD] = useState(null)
  useEffect(() => {
    (async () => {
      const [intentos, preguntas] = await Promise.all([intentosDe(usuario.id), listarPreguntas()])
      const porId = Object.fromEntries(preguntas.map(p => [p.id, p]))
      setD({ r: resumen(intentos, porId), evo: evolucionSemanal(intentos), recs: recomendar(intentos, { preguntasPorId: porId, reglas: await reglasVigentes() }), n: intentos.length })
    })()
  }, [usuario.id])
  if (!d) return <p className="text-sm text-gray-400">Cargando…</p>
  if (!d.n) return <><Titulo>Mi progreso</Titulo><Vacio>Aún no hay respuestas registradas. Empieza con una práctica.</Vacio></>
  const { r } = d
  return (
    <div className="space-y-4">
      <Titulo sub="Precisión, tiempo y evolución por prueba, competencia y habilidad">Mi progreso</Titulo>
      <div className="grid grid-cols-3 gap-2">
        <Metrica etiqueta="Aciertos" valor={r.precision} sufijo="%" />
        <Metrica etiqueta="Respuestas" valor={r.total} />
        <Metrica etiqueta="Tiempo prom." valor={formatoTiempo(r.tiempo_prom_seg)} />
      </div>
      {d.evo.length > 1 && (
        <div className="card">
          <p className="text-sm font-medium mb-2">Evolución semanal</p>
          <div className="flex items-end gap-1 h-24">
            {d.evo.slice(-12).map(s => (
              <div key={s.semana} className="flex-1 flex flex-col items-center gap-1" title={`${s.semana}: ${s.precision}% (${s.total})`}>
                <span className="text-[10px] text-gray-400">{s.precision}</span>
                <div className="w-full rounded-t bg-brand-blue" style={{ height: `${Math.max(4, s.precision)}%` }} />
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Porcentaje de aciertos por semana (últimas {Math.min(12, d.evo.length)}).</p>
        </div>
      )}
      <div className="card"><p className="text-sm font-medium mb-1">Por prueba</p>{r.por_prueba.map(x => <FilaMetrica key={x.id} nombre={x.nombre} valor={x.precision} detalle={`${x.aciertos}/${x.total} · ${formatoTiempo(x.tiempo_prom)}`} />)}</div>
      <div className="card"><p className="text-sm font-medium mb-1">Por competencia</p>{r.por_competencia.map(x => <FilaMetrica key={x.id} nombre={x.nombre} valor={x.precision} detalle={`${x.aciertos}/${x.total}`} />)}</div>
      <div className="card"><p className="text-sm font-medium mb-1">Por habilidad (leer → verificar)</p>{r.por_habilidad.map(x => <FilaMetrica key={x.id} nombre={x.nombre} valor={x.precision} detalle={`${x.aciertos}/${x.total}`} />)}</div>
      {r.por_tipo_error.length > 0 && <div className="card"><p className="text-sm font-medium mb-1">Errores por tipo</p>{r.por_tipo_error.map(x => <FilaMetrica key={x.id} nombre={x.nombre} valor={x.pct} detalle={`${x.n}`} color="#F87171" />)}</div>}
      <div className="card">
        <p className="text-sm font-medium mb-2">Qué practicar ahora</p>
        {d.recs.slice(0, 3).map((rec, i) => (
          <div key={i} className="rounded-lg bg-dark-900 p-3 mb-2">
            <p className="text-sm font-medium">{rec.titulo}</p>
            <p className="text-xs text-gray-400">{rec.dato}</p>
            <button className="btn-secondary mt-2 !py-1.5 text-xs" onClick={() => lanzarAccion(rec.accion, usuario)}>{rec.nombre_practica}</button>
          </div>
        ))}
      </div>
    </div>
  )
}
