import Estimulo from './Estimulo'
import { Md, Badge } from './ui'
import { nombrePrueba, nombreCompetencia, nombreHabilidad } from '../lib/taxonomia'

// ─── Vista de una pregunta ───────────────────────────────────────────────────
// modo: 'responder' (elige opción), 'revisar' (muestra correcta/incorrecta), 'papel' (impresión)

export default function PreguntaVista({ pregunta, elegida = null, onElegir = null, modo = 'responder', numero = null, mostrarMeta = true, mostrarContexto = true }) {
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
      {mostrarContexto && p.contexto && <Md texto={p.contexto} className="text-[15px] text-gray-200 bg-dark-900 rounded-lg p-3 border border-dark-700" />}
      {mostrarContexto && <Estimulo estimulo={p.estimulo} />}
      <Md texto={p.enunciado} className="text-[15px] font-medium text-white" />
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
