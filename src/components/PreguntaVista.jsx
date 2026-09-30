import Estimulo from './Estimulo'
import { Md, Badge } from './ui'
import { nombrePrueba, nombreCompetencia, nombreHabilidad } from '../lib/taxonomia'

// ─── Vista de una pregunta ───────────────────────────────────────────────────
// modo: 'responder' (elige opción), 'revisar' (muestra correcta/incorrecta), 'papel' (impresión)

export default function PreguntaVista({ pregunta, elegida = null, onElegir = null, modo = 'responder', numero = null, mostrarMeta = true, mostrarContexto = true, contextoRepetido = false }) {
  const p = pregunta
  const claseOpcion = (o) => {
    if (modo === 'revisar') {
      if (o.correcta) return 'opcion opcion-correcta'
      if (o.clave === elegida) return 'opcion opcion-incorrecta'
      return 'opcion opacity-70'
    }
    return `opcion ${o.clave === elegida ? 'opcion-elegida' : ''}`
  }
  return (
    <div className="space-y-3">
      {mostrarMeta && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {numero != null && <span className="text-gray-400">Pregunta {numero}</span>}
          <Badge tono="morado">{nombrePrueba(p.prueba)}</Badge>
          <Badge>{nombreCompetencia(p.competencia)}</Badge>
          <Badge tono="azul">{nombreHabilidad(p.habilidad)}</Badge>
          {p.origen === 'oficial' ? <Badge tono="verde">Oficial ICFES</Badge> : p.origen === 'generada' ? <Badge tono="ambar">Generada por IA</Badge> : <Badge>Estilo Saber 11</Badge>}
        </div>
      )}
      {mostrarContexto && p.contexto && !contextoRepetido && <Md texto={p.contexto} className="text-[16px] text-gray-200 bg-dark-900 rounded-xl p-4 border border-dark-700" />}
      {mostrarContexto && p.contexto && contextoRepetido && (
        <details className="rounded-xl border border-dark-700 bg-dark-900">
          <summary className="cursor-pointer px-4 py-2 text-sm text-brand-blue font-medium">Mismo texto de la pregunta anterior (toca para verlo otra vez)</summary>
          <div className="px-4 pb-3"><Md texto={p.contexto} className="text-[16px] text-gray-200" /></div>
        </details>
      )}
      {mostrarContexto && !contextoRepetido && <Estimulo estimulo={p.estimulo} />}
      <Md texto={p.enunciado} className="text-[17px] font-semibold text-brand-navy" />
      <div className="space-y-2">
        {p.opciones.map(o => (
          <button key={o.clave} type="button" disabled={modo !== 'responder'} onClick={() => onElegir?.(o.clave)} className={claseOpcion(o)}>
            <span className="font-semibold mr-2">{o.clave}.</span><span className="align-top inline-block max-w-[calc(100%-2rem)]"><Md texto={o.texto} className="[&_p]:mb-0 [&_p]:inline" /></span>
          </button>
        ))}
      </div>
    </div>
  )
}
