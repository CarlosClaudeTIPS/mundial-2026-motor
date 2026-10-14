import { nombreHabilidad, nombreTipoError, practicaParaError } from './taxonomia'
import lecciones from '../../content/lecciones.json'

// ─── Retroalimentación ───────────────────────────────────────────────────────
// Construye lo que se le muestra al estudiante después de responder. Nunca
// afirma "tú pensaste…": el nivel de diagnóstico dice cuánta evidencia hay.
//
//   confirmado   → el estudiante explicó su razón y coincide con el error de la opción
//   probable     → la opción se construyó para un error concreto (lo dice el banco)
//   insuficiente → no hay base para inferir un error específico

export function evaluar(pregunta, clave, { tiempoSeg = null, razon = null } = {}) {
  const elegida = pregunta.opciones.find(o => o.clave === clave) ?? null
  const correcta = pregunta.opciones.find(o => o.correcta)
  const esCorrecta = !!elegida && elegida.correcta === true

  let diagnostico = null
  let tipoError = null
  if (!esCorrecta) {
    if (!elegida) {
      // Sin responder (tiempo agotado o pregunta saltada)
      tipoError = 'tiempo'
      diagnostico = 'insuficiente'
    } else {
      tipoError = elegida.tipo_error ?? 'distractor'
      diagnostico = elegida.diagnostico ?? 'insuficiente'
      if (razon) {
        // Si el estudiante explicó y su razón coincide con el error asociado, se confirma.
        if (razon.tipo_error === tipoError) diagnostico = 'confirmado'
        else if (razon.tipo_error) { tipoError = razon.tipo_error; diagnostico = 'confirmado' }
        else if (razon.tipo_error === null && razon.texto === 'azar') { tipoError = 'distractor'; diagnostico = 'insuficiente' }
      }
    }
  }

  // Lentitud marcada aunque la respuesta sea correcta: se registra como señal, no como error.
  const lento = tiempoSeg != null && pregunta.tiempo_sugerido_seg && tiempoSeg > pregunta.tiempo_sugerido_seg * 1.6

  return {
    esCorrecta,
    clave: clave ?? null,
    claveCorrecta: correcta.clave,
    elegida,
    correcta,
    tipoError,
    diagnostico,
    lento,
    habilidad: pregunta.habilidad,
    practicaSugerida: tipoError ? practicaParaError(tipoError) : (lento ? 'cronometrada' : null),
    bloques: bloquesFeedback(pregunta, elegida, correcta, esCorrecta, tipoError, diagnostico, lento),
  }
}

function bloquesFeedback(p, elegida, correcta, esCorrecta, tipoError, diagnostico, lento) {
  const b = []
  if (esCorrecta) {
    b.push({ titulo: 'Respuesta correcta', texto: `${correcta.clave}. ${correcta.texto}`, tono: 'ok' })
    b.push({ titulo: 'Por qué es correcta', texto: correcta.explicacion })
    b.push({ titulo: 'Razonamiento completo', texto: p.explicacion })
    b.push({ titulo: 'Habilidad evaluada', texto: nombreHabilidad(p.habilidad) })
    if (lento) b.push({ titulo: 'Tiempo', texto: 'Acertaste, pero tardaste bastante más del tiempo sugerido. Vale la pena practicar este tipo de pregunta con cronómetro.', tono: 'aviso' })
    b.push({ titulo: 'Comprobación', texto: 'Acertar no siempre significa comprender. ¿Podrías explicar por qué las otras opciones no sirven?', tono: 'meta' })
  } else {
    b.push({ titulo: 'Tu respuesta', texto: elegida ? `${elegida.clave}. ${elegida.texto}` : 'Sin responder', tono: 'error' })
    b.push({ titulo: 'Respuesta correcta', texto: `${correcta.clave}. ${correcta.texto}`, tono: 'ok' })
    if (elegida) b.push({ titulo: `Por qué ${elegida.clave} no funciona`, texto: elegida.explicacion })
    b.push({ titulo: 'Qué debías identificar', texto: p.que_identificar })
    b.push({ titulo: 'Por qué la correcta es la correcta', texto: correcta.explicacion })
    b.push({ titulo: 'Habilidad involucrada', texto: nombreHabilidad(p.habilidad) })
    b.push({ titulo: 'Qué debes revisar', texto: p.que_revisar })
    b.push({
      titulo: 'Tipo de error',
      texto: textoDiagnostico(tipoError, diagnostico),
      tono: diagnostico === 'insuficiente' ? 'neutro' : 'aviso',
    })
  }
  return b
}

export function textoDiagnostico(tipoError, diagnostico) {
  const nombre = nombreTipoError(tipoError)
  if (diagnostico === 'confirmado') return `${nombre} (confirmado por tu propia explicación).`
  if (diagnostico === 'probable') return `Probablemente ${nombre.toLowerCase()}: esta opción suele elegirse por esa razón, pero solo tú sabes si fue así.`
  return `No hay información suficiente para saber qué tipo de error fue. Si quieres, cuéntanos por qué elegiste esa opción.`
}

// Opciones que se le ofrecen al estudiante para explicar su elección.
export function razonesPosibles(pregunta, elegida) {
  const base = []
  if (elegida?.razon_frecuente) base.push({ id: 'frecuente', texto: elegida.razon_frecuente, tipo_error: elegida.tipo_error })
  base.push(
    { id: 'no_entendi', texto: 'No entendí bien qué preguntaban', tipo_error: 'comprension' },
    { id: 'no_lei', texto: 'No leí todo el contexto o el gráfico', tipo_error: 'comprension' },
    { id: 'no_sabia', texto: 'No conocía el tema', tipo_error: 'conocimiento' },
    { id: 'calculo', texto: 'Me equivoqué al calcular o al hacer el procedimiento', tipo_error: 'calculo' },
    { id: 'descuido', texto: 'Sabía la respuesta pero marqué otra', tipo_error: 'descuido' },
    { id: 'tiempo', texto: 'Me faltó tiempo', tipo_error: 'tiempo' },
    { id: 'azar', texto: 'Adiviné', tipo_error: null },
  )
  return base
}

// ─── Consejo según la razón que dio el estudiante ────────────────────────────
// La razón la elige el estudiante (razonesPosibles). Aquí se traduce en un
// mensaje corto, una estrategia y qué habilidad del eje transversal trabajar.
// El texto vive en content/lecciones.json (clave `razones`) para poder editarlo.

export function consejoPorRazon(razon, pregunta = null) {
  if (!razon) return null
  const base = lecciones.razones?.[razon.id] ?? lecciones.razones?.otra
  if (!base) return null
  const hab = lecciones.habilidades?.[base.habilidad]
  return {
    id: razon.id, titulo: base.titulo, consejo: base.consejo, estrategia: base.estrategia,
    habilidad: base.habilidad, consejo_habilidad: hab?.consejo ?? null, practica_habilidad: hab?.practica ?? null,
    tipo_error: razon.tipo_error ?? null, practica: razon.tipo_error ? practicaParaError(razon.tipo_error) : (base.habilidad === 'verificar' ? 'verificacion' : 'ejercitacion'),
    competencia: pregunta?.competencia ?? null,
  }
}

// Lección "desde cero" para la competencia y la habilidad de una pregunta (sin conexión).
export function leccionDe(pregunta) {
  if (!pregunta) return null
  const comp = lecciones.competencias?.[pregunta.competencia] ?? null
  const hab = lecciones.habilidades?.[pregunta.habilidad] ?? null
  if (!comp && !hab) return null
  return { competencia: pregunta.competencia, habilidad: pregunta.habilidad, ...(comp ?? {}), habilidad_consejo: hab?.consejo ?? null, habilidad_practica: hab?.practica ?? null }
}
