import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { db } from '../../lib/db'
import { intentosDe, preguntasVistas } from '../../lib/datos'
import { sesionesDe } from '../../lib/pruebas'
import { listarPreguntas, preguntaVerificacion } from '../../lib/banco'
import { evaluar } from '../../lib/feedback'
import { useSync } from '../../lib/sync'
import { ir } from '../../lib/nav'
import PreguntaVista from '../PreguntaVista'
import Retro from '../Retro'
import { Titulo, Badge, Vacio, fechaCorta, formatoTiempo } from '../ui'
import { nombrePrueba, taxonomia } from '../../lib/taxonomia'

// ─── Historial ───────────────────────────────────────────────────────────────
// Todo lo que el estudiante ha respondido: cada prueba (con su revisión) y cada
// pregunta con todos sus intentos, acertados o no. El docente lo abre para un
// estudiante suyo con ?id=.

const MODOS = { practica: 'práctica', refuerzo: 'refuerzo', verificacion: 'verificación', mini: 'mini-prueba', simulacro: 'simulacro', diagnostico: 'diagnóstica', papel: 'en papel' }
const PASO = 40

export default function Historial({ usuario, params }) {
  const [d, setD] = useState(null)
  const [pestana, setPestana] = useState(params.ver === 'preguntas' ? 'preguntas' : 'pruebas')
  const [materia, setMateria] = useState('')
  const [resultado, setResultado] = useState('')
  const [abierta, setAbierta] = useState(null)
  const [limite, setLimite] = useState(PASO)
  const { descargado } = useSync()
  const ajeno = params.id && params.id !== usuario.id && usuario.rol !== 'estudiante'
  const id = ajeno ? params.id : usuario.id

  useEffect(() => {
    (async () => {
      const [intentos, preguntas, sesiones, quien] = await Promise.all([intentosDe(id), listarPreguntas({ estado: 'todas' }), sesionesDe(id), ajeno ? db.usuarios.get(id) : usuario])
      const porId = Object.fromEntries(preguntas.map(p => [p.id, p]))
      const grupos = {}
      for (const i of intentos) if (porId[i.pregunta_id]) (grupos[i.pregunta_id] ??= []).push(i)
      const porPregunta = Object.entries(grupos).map(([pid, lista]) => {
        lista.sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
        return { pregunta: porId[pid], intentos: lista, ultimo: lista[0] }
      }).sort((a, b) => (a.ultimo.fecha < b.ultimo.fecha ? 1 : -1))
      setD({ porPregunta, sesiones, total: intentos.length, nombre: quien?.nombre })
    })()
  }, [id, descargado])

  if (!d) return <p className="text-sm text-gray-400">Cargando…</p>
  const lista = d.porPregunta.filter(x => (!materia || x.pregunta.prueba === materia) && (!resultado || (resultado === 'bien') === x.ultimo.correcta))
  const terminadas = d.sesiones.filter(s => s.estado === 'terminada')
  const pestanas = [['pruebas', `Pruebas (${d.sesiones.length})`], ['preguntas', `Preguntas (${d.porPregunta.length})`]]

  return (
    <div className="space-y-4">
      <Titulo volver={ajeno} sub={`${terminadas.length} pruebas terminadas · ${d.porPregunta.length} preguntas distintas · ${d.total} respuestas`}>{ajeno ? `Historial de ${d.nombre ?? 'estudiante'}` : 'Mi historial'}</Titulo>

      <div className="flex gap-1.5">
        {pestanas.map(([k, n]) => <button key={k} onClick={() => setPestana(k)} className={`badge border px-3 py-1 ${pestana === k ? 'border-brand-blue text-white' : 'border-dark-600 text-gray-400'}`}>{n}</button>)}
      </div>

      {pestana === 'pruebas' && (
        d.sesiones.length === 0 ? <Vacio>Aún no hay pruebas. La diagnóstica, las mini-pruebas y los simulacros quedan guardados aquí con su revisión pregunta por pregunta.</Vacio> : (
          <div className="card divide-y divide-dark-700 !py-1">
            {d.sesiones.map(s => (
              <button key={s.id} onClick={() => (s.estado === 'terminada' || !ajeno) && ir('sesion', { id: s.id })} className="w-full text-left py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.titulo}</p>
                  <p className="text-xs text-gray-500">{fechaCorta(s.fecha_inicio)} · {s.pregunta_ids.length} preguntas{s.resultado ? ` · ${s.resultado.aciertos}/${s.resultado.total} correctas` : ''}{s.duracion_seg ? ` · ${formatoTiempo(s.duracion_seg)}` : ''}</p>
                </div>
                {s.estado === 'terminada' ? <Badge tono={s.resultado.precision >= 70 ? 'verde' : s.resultado.precision >= 50 ? 'ambar' : 'rojo'}>{s.resultado.precision}%</Badge> : <Badge tono="azul">en curso</Badge>}
              </button>
            ))}
          </div>
        )
      )}

      {pestana === 'preguntas' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={materia} onChange={e => { setMateria(e.target.value); setLimite(PASO) }}>
              <option value="">Todas las materias</option>{taxonomia().pruebas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <select className="input" value={resultado} onChange={e => { setResultado(e.target.value); setLimite(PASO) }}>
              <option value="">Acertadas y falladas</option><option value="bien">Acertadas la última vez</option><option value="mal">Falladas la última vez</option>
            </select>
          </div>
          {lista.length === 0 && <Vacio>{d.porPregunta.length ? 'Ninguna pregunta con ese filtro.' : 'Aún no hay preguntas respondidas.'}</Vacio>}
          <div className="space-y-2">
            {lista.slice(0, limite).map(({ pregunta: p, intentos, ultimo }) => (
              <div key={p.id} className="card p-3">
                <button className="w-full text-left" onClick={() => setAbierta(abierta === p.id ? null : p.id)}>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs mb-1">
                    <Badge tono="morado">{nombrePrueba(p.prueba)}</Badge>
                    <Badge tono={ultimo.correcta ? 'verde' : 'rojo'}>{ultimo.correcta ? 'acertada' : ultimo.opcion ? 'fallada' : 'sin responder'}</Badge>
                    {intentos.length > 1 && <span className="flex items-center gap-0.5 text-gray-500">{intentos.length} intentos {[...intentos].reverse().map(i => i.correcta ? <Check key={i.uid} size={13} className="text-brand-green" /> : <X key={i.uid} size={13} className="text-brand-red" />)}</span>}
                    <span className="text-gray-500 ml-auto">{fechaCorta(ultimo.fecha)}</span>
                  </div>
                  <p className="text-sm text-gray-200 line-clamp-2">{p.enunciado}</p>
                </button>
                {abierta === p.id && (
                  <div className="mt-3 border-t border-dark-700 pt-3 space-y-3">
                    <div className="text-xs text-gray-400 space-y-0.5">
                      {intentos.map(i => (
                        <p key={i.uid} className="flex items-center gap-1.5">
                          {i.correcta ? <Check size={13} className="text-brand-green shrink-0" /> : <X size={13} className="text-brand-red shrink-0" />}
                          <span>{fechaCorta(i.fecha)} · {MODOS[i.modo] ?? i.modo} · {i.opcion ? `marcó ${i.opcion}` : 'sin responder'}{i.tiempo_seg ? ` · ${formatoTiempo(i.tiempo_seg)}` : ''}</span>
                          {i.sesion_id && <button className="underline text-brand-blue" onClick={() => ir('sesion', { id: i.sesion_id })}>ver prueba</button>}
                        </p>
                      ))}
                    </div>
                    <PreguntaVista pregunta={p} elegida={ultimo.opcion} modo="revisar" mostrarMeta={false} />
                    <Retro pregunta={p} evaluacion={evaluar(p, ultimo.opcion, { tiempoSeg: ultimo.tiempo_seg, razon: ultimo.razon })} intento={ultimo} onRefuerzo={ajeno ? null : (rid) => ir('practica', { ids: rid, modo: 'refuerzo', de: ultimo.uid })} onVerificar={ajeno ? null : async (q, it) => { const nueva = await preguntaVerificacion(q, { vistas: await preguntasVistas(usuario.id), usuario }); if (!nueva) return alert('Ya respondiste todas las preguntas disponibles de esta competencia.'); ir('practica', { ids: nueva.id, modo: 'verificacion', de: it?.uid }) }} />
                    {!ajeno && <button className="btn-secondary w-full" onClick={() => ir('practica', { ids: p.id, modo: 'refuerzo' })}>Volver a intentar esta pregunta</button>}
                  </div>
                )}
              </div>
            ))}
          </div>
          {lista.length > limite && <button className="btn-secondary w-full" onClick={() => setLimite(limite + PASO)}>Ver más ({lista.length - limite} restantes)</button>}
        </>
      )}
    </div>
  )
}
