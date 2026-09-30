import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { elegirPreguntas, obtenerPregunta, grupoTexto } from '../../lib/banco'
import { registrarIntento, preguntasVistas } from '../../lib/datos'
import { ir } from '../../lib/nav'
import PreguntaVista from '../PreguntaVista'
import Retro from '../Retro'
import { Titulo, formatoTiempo } from '../ui'

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
  const refuerzoDe = useRef(null)

  useEffect(() => {
    (async () => {
      let lista
      if (params.ids) lista = (await Promise.all(params.ids.split(',').map(obtenerPregunta))).filter(Boolean)
      else {
        const filtros = {}
        for (const k of ['prueba', 'competencia', 'habilidad', 'componente', 'dificultad', 'tipo_error', 'tema']) if (params[k]) filtros[k] = params[k]
        lista = await elegirPreguntas({ n: Number(params.n ?? 5), vistas: await preguntasVistas(usuario.id), ...filtros })
      }
      setCola(lista.slice(1)); setActual(lista[0] ?? null); inicio.current = Date.now()
    })()
  }, [params.ids, params.n, params.prueba, params.tipo_error, params.habilidad])

  const enviar = async () => {
    if (!elegida || !actual) return
    if (conVerificacion && !chequeo) { setChequeo(true); return }
    const tiempo = Math.round((Date.now() - inicio.current) / 1000)
    const res = await registrarIntento({ estudiante_id: usuario.id, pregunta: actual, clave: elegida, tiempo_seg: tiempo, modo, refuerzo_de: refuerzoDe.current })
    refuerzoDe.current = null
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
    refuerzoDe.current = resultado?.intento?.uid ?? null
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
        </div>
        <div className="flex gap-2">
          <button className="btn-primary flex-1" onClick={() => ir('practica', { ...params, _t: Date.now() })}>Otra ronda</button>
          <button className="btn-secondary flex-1" onClick={() => ir('errores')}>Ver mis errores</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Titulo volver sub={`${resultado ? hechas.length : hechas.length + 1} de ${hechas.length + (resultado ? 0 : 1) + cola.length}${refuerzoDe.current ? ' · refuerzo' : ''}`}>Práctica</Titulo>

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
            <Retro pregunta={actual} evaluacion={resultado.evaluacion} intento={resultado.intento} onRefuerzo={refuerzo} />
          </div>
          <button className="btn-primary w-full" onClick={() => siguiente()}>{cola.length ? 'Siguiente pregunta' : 'Terminar'} <ArrowRight size={16} /></button>
        </>
      )}
    </div>
  )
}
