import { useEffect, useState } from 'react'
import { intentosDe, preguntasVistas } from '../../lib/datos'
import { listarPreguntas, preguntaVerificacion } from '../../lib/banco'
import { evaluar } from '../../lib/feedback'
import { ir } from '../../lib/nav'
import PreguntaVista from '../PreguntaVista'
import Retro from '../Retro'
import { Titulo, Badge, Vacio, fechaCorta } from '../ui'
import { nombreTipoError, nombreHabilidad, nombrePrueba, nombreDiagnostico, taxonomia } from '../../lib/taxonomia'

// ─── Bitácora "Mis errores" ──────────────────────────────────────────────────
// Qué fallé, cuándo, por qué (según la evidencia disponible), qué habilidad,
// qué recurso, y si después resolví algo similar.

export default function MisErrores({ usuario }) {
  const [datos, setDatos] = useState(null)
  const [filtro, setFiltro] = useState('')
  const [abierto, setAbierto] = useState(null)

  useEffect(() => {
    (async () => {
      const [intentos, preguntas] = await Promise.all([intentosDe(usuario.id), listarPreguntas({ estado: 'todas' })])
      const porId = Object.fromEntries(preguntas.map(p => [p.id, p]))
      const ordenados = [...intentos].sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
      // Último intento por pregunta: si la última vez acertó, el error está "superado"
      const ultimo = {}
      for (const i of ordenados) if (!ultimo[i.pregunta_id]) ultimo[i.pregunta_id] = i
      const errores = ordenados.filter(i => !i.correcta && porId[i.pregunta_id]).map(i => {
        const p = porId[i.pregunta_id]
        const refuerzoOk = (p.refuerzo_ids ?? []).some(r => ultimo[r]?.correcta)
        return { intento: i, pregunta: p, superado: ultimo[i.pregunta_id]?.correcta === true, refuerzoOk }
      })
      setDatos({ errores, porId })
    })()
  }, [usuario.id])

  if (!datos) return <p className="text-sm text-gray-400">Cargando…</p>
  const tipos = [...new Set(datos.errores.map(e => e.intento.tipo_error).filter(Boolean))]
  const lista = filtro ? datos.errores.filter(e => e.intento.tipo_error === filtro) : datos.errores
  const pendientes = datos.errores.filter(e => !e.superado).length

  return (
    <div className="space-y-4">
      <Titulo sub={`${datos.errores.length} errores registrados · ${pendientes} sin superar`}>Mis errores</Titulo>

      {tipos.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4">
          <button onClick={() => setFiltro('')} className={`badge shrink-0 border ${!filtro ? 'border-brand-blue text-white' : 'border-dark-600 text-gray-400'}`}>Todos</button>
          {tipos.map(t => <button key={t} onClick={() => setFiltro(t)} className={`badge shrink-0 border ${filtro === t ? 'border-brand-blue text-white' : 'border-dark-600 text-gray-400'}`}>{nombreTipoError(t)} ({datos.errores.filter(e => e.intento.tipo_error === t).length})</button>)}
        </div>
      )}

      {lista.length === 0 && <Vacio>{datos.errores.length ? 'Sin errores de este tipo.' : 'Todavía no hay errores registrados. Cuando falles una pregunta, aquí quedará la explicación para volver a revisarla.'}</Vacio>}

      <div className="space-y-2">
        {lista.map(({ intento: i, pregunta: p, superado, refuerzoOk }) => (
          <div key={i.uid} className="card p-3">
            <button className="w-full text-left" onClick={() => setAbierto(abierto === i.uid ? null : i.uid)}>
              <div className="flex flex-wrap items-center gap-1.5 text-xs mb-1">
                <Badge tono="morado">{nombrePrueba(p.prueba)}</Badge>
                {i.tipo_error && <Badge tono={i.diagnostico === 'confirmado' ? 'rojo' : i.diagnostico === 'probable' ? 'ambar' : 'gris'}>{nombreTipoError(i.tipo_error)} · {nombreDiagnostico(i.diagnostico).toLowerCase()}</Badge>}
                <Badge tono="azul">{nombreHabilidad(p.habilidad)}</Badge>
                {superado && <Badge tono="verde">superado</Badge>}
                {!superado && refuerzoOk && <Badge tono="verde">refuerzo resuelto</Badge>}
                <span className="text-gray-500 ml-auto">{fechaCorta(i.fecha)} · {i.modo}</span>
              </div>
              <p className="text-sm text-gray-200 line-clamp-2">{p.enunciado}</p>
              <p className="text-xs text-gray-500 mt-1">Elegiste {i.opcion ?? '—'} · correcta {p.opciones.find(o => o.correcta).clave}{i.razon ? ` · “${i.razon.texto}”` : ''}</p>
            </button>
            {abierto === i.uid && (
              <div className="mt-3 border-t border-dark-700 pt-3 space-y-3">
                <PreguntaVista pregunta={p} elegida={i.opcion} modo="revisar" mostrarMeta={false} />
                <Retro pregunta={p} evaluacion={evaluar(p, i.opcion, { tiempoSeg: i.tiempo_seg, razon: i.razon })} intento={i} onRefuerzo={(id) => ir('practica', { ids: id, modo: 'refuerzo', de: i.uid })} onVerificar={async (q, it) => { const nueva = await preguntaVerificacion(q, { vistas: await preguntasVistas(usuario.id), usuario }); if (!nueva) return alert('Ya respondiste todas las preguntas disponibles de esta competencia.'); ir('practica', { ids: nueva.id, modo: 'verificacion', de: it?.uid }) }} />
                <button className="btn-secondary w-full" onClick={() => ir('practica', { ids: p.id, modo: 'refuerzo' })}>Volver a intentar esta pregunta</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {pendientes > 0 && (
        <button className="btn-primary w-full" onClick={() => ir('practica', { ids: [...new Set(datos.errores.filter(e => !e.superado).map(e => e.pregunta.id))].slice(0, 8).join(','), modo: 'refuerzo' })}>
          Repasar {Math.min(8, pendientes)} errores sin superar
        </button>
      )}
    </div>
  )
}
