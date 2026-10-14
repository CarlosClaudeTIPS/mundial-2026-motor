import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, BookOpen, RotateCcw, GraduationCap, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react'
import { razonesPosibles, textoDiagnostico, consejoPorRazon, leccionDe } from '../lib/feedback'
import { explicarIntento, recursoParaError, actualizarIntento } from '../lib/datos'
import { Md, Badge } from './ui'
import { nombreDiagnostico, nombreCompetencia, nombreHabilidad } from '../lib/taxonomia'

// ─── Retroalimentación de una pregunta ───────────────────────────────────────
// Muestra los bloques que construye feedback.js, pide la razón de la elección
// (sin adivinar), da un consejo según esa razón, ofrece la lección "desde cero",
// un recurso y una pregunta de VERIFICACIÓN nueva (no la misma pregunta).
//
//   onVerificar(preguntaOriginal, intento) → la pantalla que la usa busca una
//   pregunta nueva (banco.preguntaVerificacion) y la registra con modo
//   'verificacion' y refuerzo_de = uid del intento fallado.

export default function Retro({ pregunta, evaluacion, intento = null, onRefuerzo = null, onVerificar = null, onActualizado = null, compacto = false }) {
  const ev0 = evaluacion
  const [ev, setEv] = useState(ev0)
  const [razon, setRazon] = useState(intento?.razon ?? null)
  const [recurso, setRecurso] = useState(null)
  const [otro, setOtro] = useState('')
  const [leccionAbierta, setLeccionAbierta] = useState(false)
  useEffect(() => { setEv(ev0); setRazon(intento?.razon ?? null); setLeccionAbierta(false) }, [ev0, intento?.uid])
  // Registrar que el estudiante vio la explicación (sirve para el seguimiento del docente)
  useEffect(() => { if (intento?.uid && !intento.vio_explicacion) actualizarIntento(intento.uid, { vio_explicacion: true }) }, [intento?.uid])
  useEffect(() => {
    if (ev.esCorrecta) { setRecurso(null); return }
    recursoParaError({ prueba: pregunta.prueba, tipo_error: ev.tipoError, habilidad: pregunta.habilidad }).then(setRecurso)
  }, [ev.tipoError, pregunta.id])

  const elegirRazon = async (r) => {
    setRazon(r)
    if (intento?.uid) {
      const nuevo = await explicarIntento(intento.uid, pregunta, r)
      if (nuevo) {
        setEv(e => ({ ...e, tipoError: nuevo.tipo_error, diagnostico: nuevo.diagnostico, bloques: e.bloques.map(b => b.titulo === 'Tipo de error' ? { ...b, texto: textoDiagnostico(nuevo.tipo_error, nuevo.diagnostico), tono: nuevo.diagnostico === 'insuficiente' ? 'neutro' : 'aviso' } : b) }))
        onActualizado?.(nuevo)
      }
    }
  }

  const consejo = !ev.esCorrecta ? consejoPorRazon(razon, pregunta) : null
  const leccion = leccionDe(pregunta)
  const refuerzoId = (pregunta.refuerzo_ids ?? [])[0]
  const verificar = onVerificar ? () => onVerificar(pregunta, intento) : (onRefuerzo && refuerzoId ? () => onRefuerzo(refuerzoId) : null)

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 text-lg font-semibold ${ev.esCorrecta ? 'text-brand-green' : 'text-brand-red'}`}>
        {ev.esCorrecta ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
        {ev.esCorrecta ? 'Correcto' : ev.clave ? 'Incorrecto' : 'Sin responder'}
        {!ev.esCorrecta && ev.diagnostico && <Badge tono={ev.diagnostico === 'confirmado' ? 'rojo' : ev.diagnostico === 'probable' ? 'ambar' : 'gris'}>{nombreDiagnostico(ev.diagnostico)}</Badge>}
      </div>

      {ev.bloques.map((b, i) => (
        <div key={i} className={`rounded-lg p-3 text-sm ${tono(b.tono)}`}>
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">{b.titulo}</p>
          <Md texto={b.texto} className="[&_p:last-child]:mb-0" />
        </div>
      ))}

      {!ev.esCorrecta && ev.clave && !compacto && (
        <div className="card bg-dark-900">
          <p className="text-sm font-medium mb-2">¿Por qué me equivoqué? Elige lo que más se parece a lo que pasó con {ev.clave}:</p>
          <p className="text-xs text-gray-500 mb-2">Esto no cambia tu resultado. Sirve para que la plataforma no adivine: solo tú sabes qué pasó.</p>
          <div className="flex flex-wrap gap-2">
            {razonesPosibles(pregunta, ev.elegida).map(r => (
              <button key={r.id} onClick={() => elegirRazon(r)} className={`badge border px-2.5 py-1 ${razon?.id === r.id ? 'border-brand-blue bg-dark-700 text-white' : 'border-dark-600 text-gray-300 hover:border-gray-400'}`}>{r.texto}</button>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <input className="input" placeholder="Otra razón (opcional)" value={otro} onChange={e => setOtro(e.target.value)} />
            <button className="btn-secondary shrink-0" onClick={() => otro.trim() && elegirRazon({ id: 'otra', texto: otro.trim(), tipo_error: null })}>Guardar</button>
          </div>
          {razon && <p className="text-xs text-gray-400 mt-2">Registrado: “{razon.texto}”.</p>}
        </div>
      )}

      {consejo && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="text-xs uppercase tracking-wide text-amber-700 mb-1 flex items-center gap-1"><Lightbulb size={12} /> {consejo.titulo}</p>
          <p>{consejo.consejo}</p>
          <p className="mt-2 text-gray-700"><span className="font-medium">Para la próxima:</span> {consejo.estrategia}</p>
          {consejo.consejo_habilidad && <p className="mt-1 text-xs text-gray-600">Habilidad a trabajar: {nombreHabilidad(consejo.habilidad).toLowerCase()}. {consejo.consejo_habilidad}</p>}
        </div>
      )}

      {leccion && !compacto && (
        <div className="rounded-lg border border-dark-600 text-sm">
          <button className="w-full flex items-center justify-between p-3 text-left" onClick={() => setLeccionAbierta(v => !v)}>
            <span className="font-medium flex items-center gap-2"><GraduationCap size={16} className="text-brand-blue" /> Explícame desde cero: {nombreCompetencia(pregunta.competencia)}</span>
            {leccionAbierta ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {leccionAbierta && (
            <div className="px-3 pb-3 space-y-3 border-t border-dark-700 pt-3">
              {leccion.que_evalua && <div><p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Qué evalúa</p><p>{leccion.que_evalua}</p></div>}
              {leccion.como_se_pregunta && <div><p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Cómo lo preguntan</p><p className="text-gray-300">{leccion.como_se_pregunta}</p></div>}
              {leccion.pasos?.length > 0 && <div><p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Paso a paso</p><ol className="list-decimal pl-5 space-y-1">{leccion.pasos.map(p => <li key={p}>{p}</li>)}</ol></div>}
              {leccion.errores_tipicos?.length > 0 && <div><p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Errores típicos</p><ul className="list-disc pl-5 space-y-1 text-gray-300">{leccion.errores_tipicos.map(e => <li key={e}>{e}</li>)}</ul></div>}
              {leccion.ejemplo && <div className="rounded-lg bg-sky-50 border border-sky-200 p-3"><p className="text-xs uppercase tracking-wide text-sky-700 mb-1">Ejemplo</p><p>{leccion.ejemplo}</p></div>}
              {leccion.habilidad_consejo && <p className="text-xs text-gray-500">Hábito ({nombreHabilidad(pregunta.habilidad).toLowerCase()}): {leccion.habilidad_consejo}</p>}
            </div>
          )}
        </div>
      )}

      {recurso && (
        <div className="rounded-lg border border-dark-600 p-3 text-sm">
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-1 flex items-center gap-1"><BookOpen size={12} /> Si quieres reforzar esta habilidad</p>
          <p className="font-medium">{recurso.titulo}</p>
          {recurso.descripcion && <p className="text-gray-300 mt-1">{recurso.descripcion}</p>}
          {recurso.url && <a href={recurso.url} target="_blank" rel="noreferrer" className="text-brand-blue text-xs mt-1 inline-block">Abrir recurso ↗</a>}
          <p className="text-[11px] text-gray-500 mt-1">Fuente: {recurso.fuente?.nombre ?? '—'}</p>
        </div>
      )}

      {!ev.esCorrecta && verificar && (
        <button className={`w-full ${razon ? 'btn-primary' : 'btn-secondary'}`} onClick={verificar}>
          <RotateCcw size={16} /> {razon ? 'Comprobar que ya lo entendí con una pregunta nueva' : 'Intentar una pregunta parecida (nueva)'}
        </button>
      )}
    </div>
  )
}

function tono(t) {
  switch (t) {
    case 'ok': return 'bg-emerald-50 border border-emerald-200'
    case 'error': return 'bg-red-50 border border-red-200'
    case 'aviso': return 'bg-amber-50 border border-amber-200'
    case 'meta': return 'bg-sky-50 border border-sky-200'
    default: return 'bg-dark-800 border border-dark-700'
  }
}
