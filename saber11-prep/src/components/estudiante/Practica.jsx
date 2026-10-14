import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { elegirPreguntas, obtenerPregunta, grupoTexto, preguntaVerificacion } from '../../lib/banco'
import { registrarIntento, preguntasVistas } from '../../lib/datos'
import { ir } from '../../lib/nav'
import PreguntaVista from '../PreguntaVista'
import Retro from '../Retro'
import { Titulo, formatoTiempo } from '../ui'
import { modoCarreraActivo, prioridadesDeUsuario, mezclaPorPrueba } from '../../lib/carreras'

// ─── Práctica libre / dirigida ───────────────────────────────────────────────
// Flujo: pregunta → elegir → (lista de verificación opcional) → enviar →
// retroalimentación → ¿por qué elegiste? → recurso → refuerzo → siguiente.

const CHEQUEO = [
  '¿Respondí exactamente lo que preguntan y no una pregunta parecida?',
  '¿Usé el dato correcto del contexto, la tabla o el gráfico?',
  '¿Las unidades y el tamaño de la respuesta tienen sentido?',
  '¿Puedo decir por qué las otras opciones no sirven?',
]

export default function Practica({ usuario, params }) {
  const [cola, setCola] = useState(null)   // preguntas pendientes
  const [actual, setActual] = useState(null)
  const [elegida, setElegida] = useState(null)
  const [resultado, setResultado] = useState(null) // { intento, evaluacion }
  const [hechas, setHechas] = useState([])
  const [anterior, setAnterior] = useState(null)
  const [chequeo, setChequeo] = useState(false)
  const inicio = useRef(Date.now())
  const conVerificacion = params.verificacion === '1'
  const modo = params.modo ?? 'practica'
  // refuerzoDe: uid del intento fallado que motiva esta pregunta (refuerzo o verificación).
  // Llega por params.de cuando se abre desde Resultados, Historial o Mis errores.
  const refuerzoDe = useRef(params.de ?? null)
  const modoActual = useRef(modo)
  const [sinVerificacion, setSinVerificacion] = useState(false)

  useEffect(() => {
    setCola(null); setActual(null); setElegida(null); setResultado(null); setHechas([]); setAnterior(null); setChequeo(false); setSinVerificacion(false)
    refuerzoDe.current = params.de ?? null; modoActual.current = modo
    ;(async () => {
      let lista
      if (params.ids) lista = (await Promise.all(params.ids.split(',').map(obtenerPregunta))).filter(Boolean)
      else {
        const filtros = {}
        for (const k of ['prueba', 'competencia', 'habilidad', 'componente', 'dificultad', 'tipo_error', 'tema']) if (params[k]) filtros[k] = params[k]
        const n = Number(params.n ?? 5)
        const vistas = await preguntasVistas(usuario.id)
        if (params.enfoque === 'carrera' && !filtros.prueba && modoCarreraActivo(usuario)) {
          // Práctica enfocada: reparte las preguntas entre materias según las prioridades de la carrera.
          const reparto = mezclaPorPrueba(prioridadesDeUsuario(usuario), n)
          const porPrueba = await Promise.all(Object.entries(reparto).filter(([, k]) => k > 0).map(([prueba, k]) => elegirPreguntas({ n: k, vistas, usuario, ...filtros, prueba })))
          lista = porPrueba.flat()
        } else lista = await elegirPreguntas({ n, vistas, usuario, ...filtros })
      }
      setCola(lista.slice(1)); setActual(lista[0] ?? null); inicio.current = Date.now()
    })()
  }, [JSON.stringify(params)]) // incluye _t: "Otra ronda" vuelve a cargar aunque los filtros no cambien

  // Si la ronda era de preguntas fijas (un refuerzo o un reintento), la siguiente trae preguntas nuevas de esa materia.
  const otraRonda = () => ir('practica', params.ids ? { prueba: hechas[0]?.prueba, n: 5, _t: Date.now() } : { ...params, _t: Date.now() })

  const enviar = async () => {
    if (!elegida || !actual) return
    if (conVerificacion && !chequeo) { setChequeo(true); return }
    const tiempo = Math.round((Date.now() - inicio.current) / 1000)
    const res = await registrarIntento({ estudiante_id: usuario.id, pregunta: actual, clave: elegida, tiempo_seg: tiempo, modo: modoActual.current, refuerzo_de: refuerzoDe.current })
    refuerzoDe.current = null; modoActual.current = modo === 'verificacion' || modo === 'refuerzo' ? 'practica' : modo
    setResultado(res)
    setHechas(h => [...h, res.intento])
  }

  const siguiente = (pregunta = null) => {
    let sig = pregunta, resto = cola
    if (!sig) { sig = cola[0] ?? null; resto = cola.slice(1) }
    setAnterior(actual); setActual(sig); setCola(resto); setElegida(null); setResultado(null); setChequeo(false); inicio.current = Date.now()
  }

  const refuerzo = async (id) => {
    const p = await obtenerPregunta(id)
    if (!p) return siguiente()
    refuerzoDe.current = resultado?.intento?.uid ?? null; modoActual.current = 'refuerzo'
    siguiente(p)
  }

  // Pregunta de verificación: una NUEVA de la misma competencia (primero las de refuerzo no vistas).
  // Se registra con modo 'verificacion' y refuerzo_de = intento fallado; así se mide aprendizaje real.
  const verificar = async (pregunta, intento) => {
    const vistas = await preguntasVistas(usuario.id)
    const p = await preguntaVerificacion(pregunta, { vistas, usuario })
    if (!p) { setSinVerificacion(true); return }
    refuerzoDe.current = intento?.uid ?? resultado?.intento?.uid ?? null; modoActual.current = 'verificacion'
    setSinVerificacion(false)
    siguiente(p)
  }

  if (cola === null) return <p className="text-sm text-gray-400">Preparando preguntas…</p>

  if (!actual) {
    const aciertos = hechas.filter(i => i.correcta).length
    return (
      <div className="space-y-4">
        <Titulo volver>Práctica terminada</Titulo>
        <div className="card text-center">
          <p className="text-4xl font-semibold">{aciertos}/{hechas.length}</p>
          <p className="text-sm text-gray-400 mt-1">aciertos en esta ronda</p>
          {hechas.length > 0 && <p className="text-xs text-gray-500 mt-2">Tiempo promedio: {formatoTiempo(hechas.reduce((a, i) => a + (i.tiempo_seg ?? 0), 0) / hechas.length)} por pregunta</p>}
          {hechas.some(i => i.modo === 'verificacion') && (() => { const v = hechas.filter(i => i.modo === 'verificacion'); const ok = v.filter(i => i.correcta).length; return <p className="text-sm mt-2">{ok === v.length ? '✅ ' : ''}Verificaciones con pregunta nueva: <b>{ok}/{v.length}</b>{ok === v.length ? ' · ya lo tienes' : ' · todavía hay que seguir trabajando lo que fallaste'}</p> })()}
        </div>
        <div className="flex gap-2">
          <button className="btn-primary flex-1" onClick={otraRonda}>Otra ronda</button>
          <button className="btn-secondary flex-1" onClick={() => ir('errores')}>Ver mis errores</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Titulo volver sub={`${resultado ? hechas.length : hechas.length + 1} de ${hechas.length + (resultado ? 0 : 1) + cola.length}${refuerzoDe.current ? (modoActual.current === 'verificacion' ? ' · pregunta de verificación' : ' · refuerzo') : ''}`}>Práctica</Titulo>

      <div className="card">
        <PreguntaVista pregunta={actual} elegida={resultado ? (resultado.intento.opcion) : elegida} onElegir={setElegida} modo={resultado ? 'revisar' : 'responder'} contextoRepetido={!!anterior && !!grupoTexto(actual) && grupoTexto(anterior) === grupoTexto(actual)} />
      </div>

      {!resultado && chequeo && (
        <div className="card border-brand-amber/40">
          <p className="text-sm font-medium mb-2">Antes de enviar, verifica:</p>
          <ul className="space-y-1.5 text-sm text-gray-300">{CHEQUEO.map(c => <li key={c} className="flex gap-2"><Check size={16} className="text-brand-amber shrink-0 mt-0.5" />{c}</li>)}</ul>
          <div className="flex gap-2 mt-3">
            <button className="btn-secondary flex-1" onClick={() => setChequeo(false)}>Revisar mi elección</button>
            <button className="btn-primary flex-1" onClick={enviar}>Enviar {elegida}</button>
          </div>
        </div>
      )}

      {!resultado && !chequeo && (
        <button className="btn-primary w-full" disabled={!elegida} onClick={enviar}>{elegida ? `Enviar respuesta ${elegida}` : 'Elige una opción'}</button>
      )}

      {resultado && (
        <>
          <div className="card">
            <Retro pregunta={actual} evaluacion={resultado.evaluacion} intento={resultado.intento} onRefuerzo={refuerzo} onVerificar={verificar} />
            {sinVerificacion && <p className="text-xs text-brand-amber mt-2">Ya respondiste todas las preguntas disponibles de esta competencia: no hay una nueva para verificar. Sigue con la siguiente.</p>}
          </div>
          <button className="btn-primary w-full" onClick={() => siguiente()}>{cola.length ? 'Siguiente pregunta' : 'Terminar'} <ArrowRight size={16} /></button>
        </>
      )}
    </div>
  )
}
