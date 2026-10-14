
// ─── Importar preguntas desde PDF / texto ────────────────────────────────────

// Extrae el texto de un PDF en el navegador (pdf.js).
export async function textoDePdf(archivo) {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const datos = new Uint8Array(await archivo.arrayBuffer())
  const pdf = await pdfjs.getDocument({ data: datos }).promise
  const paginas = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const pagina = await pdf.getPage(i)
    const contenido = await pagina.getTextContent()
    // Reconstruye líneas a partir de las posiciones verticales
    let lineas = [], actual = [], ultimoY = null
    for (const it of contenido.items) {
      const y = Math.round(it.transform[5])
      if (ultimoY !== null && Math.abs(y - ultimoY) > 3) { lineas.push(actual.join('')); actual = [] }
      actual.push(it.str + (it.hasEOL ? '' : ' '))
      ultimoY = y
    }
    if (actual.length) lineas.push(actual.join(''))
    paginas.push(lineas.map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n'))
  }
  return paginas.join('\n\n')
}

// Detecta preguntas numeradas con opciones A-D en un texto plano (cuadernillos, guías, documentos).
// Devuelve borradores { numero, contexto, enunciado, opciones:[{clave,texto}], correcta }.
export function detectarPreguntas(texto) {
  const lineas = texto.replace(/\r/g, '').split('\n').map(l => l.trim())
  const preguntas = []
  let actual = null, opcionActual = null, buffer = [], enClave = false, claveTexto = []
  const esInicio = (l) => /^(?:pregunta\s*)?(\d{1,3})\s*[.)\-:]\s*(.*)$/i.exec(l)
  const esOpcion = (l) => /^\(?([A-Da-d])\s*[.)\-:]\s*(.*)$/.exec(l)

  const cerrar = () => {
    if (!actual) return
    if (opcionActual) { actual.opciones.push(opcionActual); opcionActual = null }
    if (actual.opciones.length >= 3) preguntas.push(actual)
    actual = null
  }

  for (const l of lineas) {
    if (!l) continue
    // Sección de respuestas ("Hoja de respuestas", "Claves", "Respuestas correctas"): se deja de leer preguntas
    if (/^(hoja\s+de\s+)?(respuestas?|claves?|clave\s+de\s+respuestas?)(\s+correctas?)?\s*:?$/i.test(l)) { cerrar(); enClave = true; continue }
    if (enClave) { claveTexto.push(l); continue }
    // Línea de clave suelta tipo "12 C" o "12. C" (sin texto de opción): no pertenece a la pregunta
    if (/^\d{1,3}\s*[.)\-:]?\s*[A-D]$/i.test(l)) { claveTexto.push(l); continue }
    const ini = esInicio(l)
    if (ini && (!actual || actual.opciones.length >= 3 || opcionActual)) {
      cerrar()
      actual = { numero: Number(ini[1]), contexto: buffer.join('\n').trim() || null, enunciado: ini[2], opciones: [] }
      buffer = []
      continue
    }
    const op = actual && esOpcion(l)
    if (op) {
      if (opcionActual) actual.opciones.push(opcionActual)
      opcionActual = { clave: op[1].toUpperCase(), texto: op[2] }
      continue
    }
    if (opcionActual) opcionActual.texto += ' ' + l
    else if (actual) actual.enunciado += ' ' + l
    else buffer.push(l)
    if (buffer.length > 40) buffer = buffer.slice(-40)
  }
  cerrar()

  // Hoja de respuestas: "1. C  2. A" o "1 C" en bloque
  const clave = {}
  const fuenteClave = claveTexto.length ? claveTexto.join('\n') : texto
  const claves = fuenteClave.match(/(?:^|\s)(\d{1,3})\s*[.)\-:]?\s*([A-D])(?=\s|$)/g) ?? []
  if (claveTexto.length || claves.length >= Math.max(5, preguntas.length * 0.5)) {
    for (const c of claves) { const m = /(\d{1,3})\s*[.)\-:]?\s*([A-D])/.exec(c); if (m) clave[Number(m[1])] = m[2] }
  }
  for (const p of preguntas) {
    p.correcta = clave[p.numero] ?? null
    p.enunciado = p.enunciado.replace(/\s+/g, ' ').trim()
    for (const o of p.opciones) o.texto = o.texto.replace(/\s+/g, ' ').trim()
  }
  return preguntas
}

// Convierte un borrador detectado en una pregunta del banco (estado pendiente).
export function borradorAPregunta(b, { prueba, origen, fuente, prefijo }) {
  const claves = b.opciones.map(o => o.clave)
  return {
    id: `${prefijo}-${String(b.numero).padStart(3, '0')}`,
    prueba, origen, fuente: { nombre: fuente.nombre, url: fuente.url || null, anio: fuente.anio || null, referencia: `Pregunta ${b.numero}` },
    competencia: null, componente: null, afirmacion: '', evidencia: '', habilidad: 'comprender', tema: '', subtema: '', dificultad: 2,
    contexto: b.contexto, estimulo: null, enunciado: b.enunciado,
    opciones: b.opciones.map(o => ({ clave: o.clave, texto: o.texto, correcta: o.clave === b.correcta, explicacion: '', tipo_error: o.clave === b.correcta ? null : 'distractor', diagnostico: o.clave === b.correcta ? null : 'insuficiente', razon_frecuente: null })),
    explicacion: '', que_identificar: '', que_revisar: '', refuerzo_ids: [], recurso_ids: [], tiempo_sugerido_seg: 120,
    etiquetas: ['importada', ...(b.correcta ? [] : ['sin_clave'])], estado: 'pendiente', claves_detectadas: claves,
  }
}
