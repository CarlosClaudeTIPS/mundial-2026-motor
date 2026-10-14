import { useEffect, useState } from 'react'
import { intentosDe } from '../../lib/datos'
import { listarPreguntas } from '../../lib/banco'
import { resumen, evolucionSemanal } from '../../lib/analitica'
import { recomendar, reglasVigentes } from '../../lib/reglas'
import { Titulo, FilaMetrica, Metrica, Vacio, formatoTiempo } from '../ui'
import { lanzarAccion } from './Inicio'
import { medirAprendizaje, constancia } from '../../lib/aprendizaje'
import { Badge } from '../ui'
import { ir } from '../../lib/nav'

export default function MiProgreso({ usuario }) {
  const [d, setD] = useState(null)
  useEffect(() => {
    (async () => {
      const [intentos, preguntas] = await Promise.all([intentosDe(usuario.id), listarPreguntas({ usuario })])
      const porId = Object.fromEntries(preguntas.map(p => [p.id, p]))
      setD({ r: resumen(intentos, porId), evo: evolucionSemanal(intentos), recs: recomendar(intentos, { preguntasPorId: porId, reglas: await reglasVigentes() }), n: intentos.length, ap: medirAprendizaje(intentos), cons: constancia(intentos) })
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
      <div className="card">
        <p className="text-sm font-medium mb-1">Constancia</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><p className="text-xl font-medium">{d.cons.racha}</p><p className="text-xs text-gray-500">días seguidos</p></div>
          <div><p className="text-xl font-medium">{d.cons.ultimos_7}/7</p><p className="text-xs text-gray-500">días esta semana</p></div>
          <div><p className="text-xl font-medium">{d.cons.ultimos_30}/30</p><p className="text-xs text-gray-500">días este mes</p></div>
        </div>
      </div>
      <AprendizajeReal ap={d.ap} />
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

// Aprendizaje real: un error cuenta como superado solo si después acertó preguntas NUEVAS de esa competencia.
export function AprendizajeReal({ ap, compacto = false }) {
  if (!ap || !ap.competencias.length) return null
  const tono = { superado: 'verde', en_proceso: 'ambar', sin_verificar: 'gris' }
  const nombre = { superado: 'superado', en_proceso: 'en proceso', sin_verificar: 'sin verificar' }
  return (
    <div className="card">
      <p className="text-sm font-medium">¿Estás aprendiendo de verdad?</p>
      <p className="text-xs text-gray-500 mb-2">Un error se considera superado cuando después aciertas preguntas nuevas de esa competencia (repetir la misma pregunta no cuenta).</p>
      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        <div className="rounded-xl bg-dark-900 p-2"><p className="text-xl font-semibold text-brand-green">{ap.conteo.superado}</p><p className="text-[11px] text-gray-500">superadas</p></div>
        <div className="rounded-xl bg-dark-900 p-2"><p className="text-xl font-semibold text-brand-amber">{ap.conteo.en_proceso}</p><p className="text-[11px] text-gray-500">en proceso</p></div>
        <div className="rounded-xl bg-dark-900 p-2"><p className="text-xl font-semibold text-gray-400">{ap.conteo.sin_verificar}</p><p className="text-[11px] text-gray-500">sin verificar</p></div>
      </div>
      {ap.verificaciones.total > 0 && <p className="text-sm mb-2">Preguntas de verificación: <b>{ap.verificaciones.correctas}/{ap.verificaciones.total}</b> correctas ({ap.verificaciones.pct} %).</p>}
      {!compacto && (
        <div className="space-y-1.5">
          {ap.competencias.slice(0, 8).map(c => (
            <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0"><p className="leading-tight truncate">{c.nombre}</p><p className="text-[11px] text-gray-500">{c.nombre_prueba} · {c.errores} error(es) · {c.nuevosDespues ? `${c.aciertosNuevos}/${c.nuevosDespues} nuevas bien` : 'sin preguntas nuevas después'}</p></div>
              <div className="flex items-center gap-1 shrink-0"><Badge tono={tono[c.estado]}>{nombre[c.estado]}</Badge>{c.estado !== 'superado' && <button className="text-xs text-brand-blue font-semibold" onClick={() => ir('practica', { competencia: c.id, n: 5 })}>Practicar</button>}</div>
            </div>
          ))}
        </div>
      )}
      {ap.tipos_error.some(t => t.tendencia !== 'pocos_datos') && (
        <div className="mt-3 border-t border-dark-700 pt-2">
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Tipos de error: ¿van bajando?</p>
          <div className="flex flex-wrap gap-1.5">{ap.tipos_error.slice(0, 6).map(t => <Badge key={t.id} tono={t.tendencia === 'baja' ? 'verde' : t.tendencia === 'sube' ? 'rojo' : 'gris'}>{t.nombre.toLowerCase()} {t.tendencia === 'baja' ? '↓' : t.tendencia === 'sube' ? '↑' : '='}</Badge>)}</div>
        </div>
      )}
    </div>
  )
}
