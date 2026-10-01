import { useEffect, useRef, useState } from 'react'
import { Clock, ChevronLeft, ChevronRight, Flag } from 'lucide-react'
import { obtenerSesion, responderEnSesion, acumularTiempo, guardarIndice, terminarSesion, sesion2DeCompleto, sesionesDeCompleto } from '../../lib/pruebas'
import { resumen } from '../../lib/analitica'
import { obtenerPregunta, grupoTexto } from '../../lib/banco'
import { db } from '../../lib/db'
import { estructuraExamen } from '../../lib/ciclo'
import { evaluar } from '../../lib/feedback'
import { ir } from '../../lib/nav'
import PreguntaVista from '../PreguntaVista'
import Retro from '../Retro'
import { Titulo, formatoTiempo, FilaMetrica, Metrica, Badge } from '../ui'
import { nombrePrueba } from '../../lib/taxonomia'

// ─── Sesión de prueba (mini-prueba o simulacro) ──────────────────────────────
// Sin retroalimentación hasta el final. Cronómetro persistente: si se cierra
// la app, al volver sigue contando desde la fecha de inicio.

export default function SesionPrueba({ usuario, params }) {
  const [sesion, setSesion] = useState(null)
  const [preguntas, setPreguntas] = useState([])
  const [indice, setIndice] = useState(0)
  const [restante, setRestante] = useState(null)
  const [confirmar, setConfirmar] = useState(false)
  const entradaPregunta = useRef(Date.now())

  useEffect(() => {
    (async () => {
      const s = await obtenerSesion(params.id)
      if (!s) return
      const ps = (await Promise.all(s.pregunta_ids.map(obtenerPregunta))).filter(Boolean)
      setSesion(s); setPreguntas(ps); setIndice(s.indice ?? 0); entradaPregunta.current = Date.now()
    })()
  }, [params.id])

  // Cronómetro
  useEffect(() => {
    if (!sesion || sesion.estado !== 'en_curso' || !sesion.config.tiempo_seg) return
    const tick = () => {
      const transcurrido = (Date.now() - new Date(sesion.fecha_inicio)) / 1000
      const r = Math.max(0, Math.round(sesion.config.tiempo_seg - transcurrido))
      setRestante(r)
      if (r <= 0) finalizar(true)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [sesion?.id, sesion?.estado])

  const segundosEnActual = () => { const s = (Date.now() - entradaPregunta.current) / 1000; entradaPregunta.current = Date.now(); return s }

  const responder = async (clave) => {
    const p = preguntas[indice]
    const nuevo = await responderEnSesion(sesion.id, p.id, sesion.respuestas[p.id] === clave ? null : clave, segundosEnActual())
    setSesion(nuevo)
  }

  const irA = async (i) => {
    const p = preguntas[indice]
    const nuevo = await acumularTiempo(sesion.id, p.id, segundosEnActual())
    if (nuevo) setSesion(nuevo)
    const j = Math.max(0, Math.min(preguntas.length - 1, i))
    setIndice(j); guardarIndice(sesion.id, j)
    window.scrollTo({ top: 0 })
  }

  const finalizar = async (agotado = false) => {
    if (!sesion || sesion.estado !== 'en_curso') return
    const p = preguntas[indice]
    if (p) await acumularTiempo(sesion.id, p.id, segundosEnActual())
    const cerrada = await terminarSesion(sesion.id, { agotado })
    setSesion(cerrada); setConfirmar(false)
    window.scrollTo({ top: 0 })
  }

  if (!sesion) return <p className="text-sm text-gray-400">Cargando…</p>
  if (sesion.estado === 'terminada') return <Resultados sesion={sesion} preguntas={preguntas} usuario={usuario} />

  const p = preguntas[indice]
  const respondidas = Object.keys(sesion.respuestas).length
  const esSimulacro = sesion.tipo === 'simulacro'

  return (
    <div className="space-y-3">
      <div className="sticky top-0 md:top-auto z-10 bg-dark-900 -mx-4 px-4 py-2 border-b border-dark-700 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{sesion.titulo}</p>
          <p className="text-xs text-gray-400">{respondidas}/{preguntas.length} respondidas{esSimulacro && ` · ${nombrePrueba(p.prueba)}`}</p>
        </div>
        {restante != null && (
          <div className={`flex items-center gap-1 font-mono text-lg ${restante < 60 ? 'text-brand-red' : restante < 300 ? 'text-brand-amber' : 'text-gray-200'}`}>
            <Clock size={18} /> {formatoTiempo(restante)}
          </div>
        )}
      </div>

      {esSimulacro && sesion.config.faltantes?.length > 0 && indice === 0 && (
        <p className="text-xs text-gray-500">Simulacro a escala {Math.round(sesion.config.escala * 100)} % de la sesión real ({sesion.config.tiempo_real_min} min). El banco aún no tiene suficientes preguntas en: {sesion.config.faltantes.map(f => nombrePrueba(f.prueba)).join(', ')}.</p>
      )}

      <div className="card">
        <PreguntaVista pregunta={p} numero={indice + 1} elegida={sesion.respuestas[p.id] ?? null} onElegir={responder} mostrarMeta={false} contextoRepetido={indice > 0 && !!grupoTexto(p) && grupoTexto(preguntas[indice - 1]) === grupoTexto(p)} />
      </div>

      <div className="flex items-center gap-2">
        <button className="btn-secondary" disabled={indice === 0} onClick={() => irA(indice - 1)}><ChevronLeft size={16} /> Anterior</button>
        <div className="flex-1" />
        {indice < preguntas.length - 1
          ? <button className="btn-primary" onClick={() => irA(indice + 1)}>Siguiente <ChevronRight size={16} /></button>
          : <button className="btn-primary" onClick={() => setConfirmar(true)}><Flag size={16} /> Terminar</button>}
      </div>

      <div className="card">
        <p className="text-xs text-gray-400 mb-2">Navegación (gris = sin responder)</p>
        <div className="flex flex-wrap gap-1.5">
          {preguntas.map((q, i) => (
            <button key={q.id} onClick={() => irA(i)} className={`w-8 h-8 rounded text-xs font-medium ${i === indice ? 'ring-2 ring-brand-blue' : ''} ${sesion.respuestas[q.id] ? 'bg-dark-600 text-white' : 'bg-dark-900 text-gray-500 border border-dark-700'}`}>{i + 1}</button>
          ))}
        </div>
        <button className="btn-ghost w-full mt-3 text-brand-amber" onClick={() => setConfirmar(true)}>Terminar y ver resultados</button>
      </div>

      {confirmar && (
        <div className="fixed inset-0 z-30 bg-black/70 flex items-end md:items-center justify-center p-4" onClick={() => setConfirmar(false)}>
          <div className="card w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <p className="font-medium">¿Terminar la prueba?</p>
            <p className="text-sm text-gray-400 mt-1">{preguntas.length - respondidas > 0 ? `Tienes ${preguntas.length - respondidas} pregunta(s) sin responder. Se contarán como no respondidas.` : 'Respondiste todas las preguntas.'}</p>
            <div className="flex gap-2 mt-4">
              <button className="btn-secondary flex-1" onClick={() => setConfirmar(false)}>Seguir</button>
              <button className="btn-primary flex-1" onClick={() => finalizar(false)}>Terminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Resultados({ sesion, preguntas, usuario }) {
  const r = sesion.resultado
  const [intentos, setIntentos] = useState([])
  const [abierta, setAbierta] = useState(null)
  const [completo, setCompleto] = useState(null) // { sesiones, combinado }
  useEffect(() => { db.intentos.where('sesion_id').equals(sesion.id).toArray().then(setIntentos) }, [sesion.id])
  useEffect(() => {
    if (!sesion.config?.completo_id) return
    (async () => {
      const ss = await sesionesDeCompleto(sesion.config.completo_id, sesion.estudiante_id)
      const terminadas = ss.filter(s => s.estado === 'terminada')
      let combinado = null
      if (terminadas.length === 2) {
        const todos = (await Promise.all(terminadas.map(s => db.intentos.where('sesion_id').equals(s.id).toArray()))).flat()
        combinado = resumen(todos)
      }
      // Puntaje global aproximado (0-500): promedio ponderado de las cinco pruebas × 5
      let global = null
      const pesos = (await estructuraExamen()).puntaje?.ponderacion_global
      if (combinado && pesos && Object.keys(pesos).every(k => combinado.por_prueba.some(x => x.id === k))) {
        const suma = Object.values(pesos).reduce((a, b) => a + b, 0)
        global = Math.round(combinado.por_prueba.reduce((a, x) => a + (pesos[x.id] ?? 0) * x.precision, 0) / suma * 5)
      }
      setCompleto({ sesiones: ss, combinado, global })
    })()
  }, [sesion.id])
  const porId = Object.fromEntries(intentos.map(i => [i.pregunta_id, i]))
  const esSesion1Completo = sesion.config?.completo_id && sesion.config.sesion_examen === 1
  const hayS2 = completo?.sesiones.some(s => s.config.sesion_examen === 2)

  return (
    <div className="space-y-4">
      <Titulo volver sub={`${sesion.titulo}${sesion.agotado ? ' · se agotó el tiempo' : ''}`}>Resultados</Titulo>

      {esSesion1Completo && !hayS2 && (
        <div className="card border-brand-blue/50">
          <p className="font-medium">Sesión 1 terminada</p>
          <p className="text-sm text-gray-400 mt-1">En el examen real hay un descanso entre las dos sesiones. Tómalo (30 a 60 minutos) y luego inicia la sesión 2 para completar el simulacro.</p>
          <button className="btn-primary w-full mt-3" onClick={async () => { const s2 = await sesion2DeCompleto(sesion); ir('sesion', { id: s2.id }) }}>Iniciar sesión 2</button>
        </div>
      )}
      {esSesion1Completo && hayS2 && (() => { const s2 = completo.sesiones.find(s => s.config.sesion_examen === 2); return s2.estado === 'en_curso' ? <button className="btn-primary w-full" onClick={() => ir('sesion', { id: s2.id })}>Continuar la sesión 2</button> : null })()}

      {completo?.combinado && (
        <div className="card border-brand-green/40">
          <p className="font-medium mb-2">Simulacro completo (sesión 1 + sesión 2)</p>
          <div className={`grid gap-2 mb-2 ${completo.global != null ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {completo.global != null && <Metrica etiqueta="Puntaje aprox." valor={completo.global} sufijo="/500" />}
            <Metrica etiqueta="Aciertos globales" valor={completo.combinado.precision} sufijo="%" />
            <Metrica etiqueta="Correctas" valor={`${completo.combinado.aciertos}/${completo.combinado.total}`} />
          </div>
          {completo.global != null && <p className="text-xs text-gray-500 mb-2">El puntaje sobre 500 es una aproximación a partir del porcentaje de aciertos por materia (Lectura, Matemáticas, Sociales y Ciencias pesan 3; Inglés pesa 1). El ICFES califica con un modelo estadístico distinto, así que úsalo para comparar tus simulacros entre sí, no como predicción exacta.</p>}
          {completo.combinado.por_prueba.map(x => <FilaMetrica key={x.id} nombre={x.nombre} valor={x.precision} detalle={`${x.aciertos}/${x.total}`} />)}
          <div className="flex gap-2 mt-2 text-xs">
            {completo.sesiones.map(s => <button key={s.id} className="btn-ghost !py-1" onClick={() => ir('sesion', { id: s.id })}>Ver sesión {s.config.sesion_examen}</button>)}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Metrica etiqueta="Aciertos" valor={r.precision} sufijo="%" />
        <Metrica etiqueta="Correctas" valor={`${r.aciertos}/${r.total}`} />
        <Metrica etiqueta="Tiempo" valor={formatoTiempo(sesion.duracion_seg)} />
      </div>

      {r.por_prueba.length > 1 && <div className="card"><p className="text-sm font-medium mb-1">Por prueba</p>{r.por_prueba.map(x => <FilaMetrica key={x.id} nombre={x.nombre} valor={x.precision} detalle={`${x.aciertos}/${x.total}`} />)}</div>}
      <div className="card"><p className="text-sm font-medium mb-1">Por competencia</p>{r.por_competencia.map(x => <FilaMetrica key={x.id} nombre={x.nombre} valor={x.precision} detalle={`${x.aciertos}/${x.total}`} />)}</div>
      <div className="card"><p className="text-sm font-medium mb-1">Por habilidad del eje transversal</p>{r.por_habilidad.map(x => <FilaMetrica key={x.id} nombre={x.nombre} valor={x.precision} detalle={`${x.aciertos}/${x.total}`} />)}</div>

      {r.por_tipo_error.length > 0 && (
        <div className="card">
          <p className="text-sm font-medium mb-1">Errores por tipo</p>
          <p className="text-xs text-gray-500 mb-2">Según la opción elegida. Es una lectura probable, no una certeza: revisa cada pregunta y cuenta por qué la elegiste.</p>
          {r.por_tipo_error.map(x => <FilaMetrica key={x.id} nombre={x.nombre} valor={x.pct} detalle={`${x.n}`} color="#F87171" />)}
        </div>
      )}
      {(r.fortalezas.length > 0 || r.dificultades.length > 0) && (
        <div className="card text-sm space-y-1">
          {r.fortalezas.length > 0 && <p><span className="text-brand-green">Fortalezas:</span> {r.fortalezas.join(', ')}</p>}
          {r.dificultades.length > 0 && <p><span className="text-brand-red">Dificultades:</span> {r.dificultades.join(', ')}</p>}
        </div>
      )}

      <div className="card">
        <p className="text-sm font-medium mb-2">Revisión pregunta por pregunta</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {preguntas.map((q, i) => {
            const it = porId[q.id]
            return <button key={q.id} onClick={() => setAbierta(abierta === q.id ? null : q.id)} className={`w-8 h-8 rounded text-xs font-medium ${abierta === q.id ? 'ring-2 ring-brand-blue' : ''} ${!it ? 'bg-dark-900' : it.correcta ? 'bg-emerald-100 text-emerald-800' : it.opcion ? 'bg-red-100 text-red-800' : 'bg-dark-700 text-gray-400'}`}>{i + 1}</button>
          })}
        </div>
        {abierta && (() => {
          const q = preguntas.find(x => x.id === abierta)
          const it = porId[abierta]
          const ev = evaluar(q, it?.opcion ?? null, { tiempoSeg: it?.tiempo_seg, razon: it?.razon })
          return (
            <div className="space-y-3 border-t border-dark-700 pt-3">
              <PreguntaVista pregunta={q} elegida={it?.opcion ?? null} modo="revisar" />
              <p className="text-xs text-gray-500">Tiempo en esta pregunta: {formatoTiempo(it?.tiempo_seg)} (sugerido {formatoTiempo(q.tiempo_sugerido_seg)})</p>
              <Retro pregunta={q} evaluacion={ev} intento={it} onRefuerzo={(id) => ir('practica', { ids: id, modo: 'refuerzo' })} />
            </div>
          )
        })()}
      </div>

      <div className="flex gap-2">
        {sesion.config?.diagnostico && <button className="btn-primary flex-1" onClick={() => ir('refuerzo')}>Ver mi plan de refuerzo</button>}
        <button className={sesion.config?.diagnostico ? 'btn-secondary flex-1' : 'btn-primary flex-1'} onClick={() => ir('errores')}>Ir a mis errores</button>
        <button className="btn-secondary flex-1" onClick={() => ir(usuario.rol === 'estudiante' ? 'inicio' : 'simulacros')}>Volver</button>
      </div>
    </div>
  )
}
