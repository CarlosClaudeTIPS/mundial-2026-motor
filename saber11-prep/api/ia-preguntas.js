// Función de servidor (Vercel) — IA para el banco de preguntas.
// POST /api/ia-preguntas
//   { accion: "completar", prueba, pregunta: { enunciado, contexto, opciones:[{clave,texto}], correcta? } }
//   { accion: "generar",   prueba, texto, cantidad }
// Cabecera: Authorization: Bearer <access_token de Supabase del docente/admin>
// Variables en Vercel: ANTHROPIC_API_KEY (secreta), VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.
//
// "completar": a partir de una pregunta pegada (por ejemplo de un cuadernillo),
// devuelve la clasificación y las explicaciones de cada opción en el formato del banco.
// "generar": a partir de un texto fuente, redacta N preguntas nuevas estilo Saber 11.
// Todo lo que devuelve queda en estado "pendiente" hasta que el docente lo revise.

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'

const MODELO = 'claude-opus-5-5'

const TAXONOMIA = `
Pruebas y competencias (ids exactos):
- lectura_critica: LC1 "Identifica y entiende los contenidos locales que conforman un texto", LC2 "Comprende cómo se articulan las partes de un texto para darle un sentido global", LC3 "Reflexiona a partir de un texto y evalúa su contenido". Componentes: texto_continuo, texto_discontinuo.
- matematicas: M1 "Interpretación y representación", M2 "Formulación y ejecución", M3 "Argumentación". Componentes: algebra_calculo, geometria, estadistica.
- sociales_ciudadanas: S1 "Pensamiento social", S2 "Interpretación y análisis de perspectivas", S3 "Pensamiento reflexivo y sistémico". Componentes: espacio_territorio_ambiente, historia_cultura, etico_politico.
- ciencias_naturales: C1 "Uso comprensivo del conocimiento científico", C2 "Explicación de fenómenos", C3 "Indagación". Componentes: biologia, fisica, quimica, cts.
- ingles: I1 "Competencia lingüística (léxica y gramatical)", I2 "Competencia pragmática (comprensión de textos y situaciones)". Componentes: parte_1 (relacionar descripciones y palabras), parte_2 (avisos), parte_3 (conversaciones), parte_4 (texto con espacios de estructura), parte_5 (lectura literal), parte_6 (lectura inferencial), parte_7 (texto con espacios de léxico).
Habilidades del eje transversal (elige la que más pesa): leer, comprender, interpretar, representar, razonar, resolver, verificar.
Tipos de error (para cada distractor): comprension, interpretacion, inferencia, conocimiento, procedimiento, calculo, lectura_grafico, lectura_tabla, razonamiento, argumentacion, distractor, vocabulario, tiempo, descuido, verificacion.
diagnostico: "probable" solo si la opción se construyó para un error concreto y ese camino es el más plausible; si puede venir de varias causas, "insuficiente".
`

const OpcionSchema = z.object({
  clave: z.string(),
  texto: z.string(),
  correcta: z.boolean(),
  explicacion: z.string(),
  tipo_error: z.string().nullable(),
  diagnostico: z.string().nullable(),
  razon_frecuente: z.string().nullable(),
})

const PreguntaSchema = z.object({
  competencia: z.string(),
  componente: z.string().nullable(),
  afirmacion: z.string(),
  evidencia: z.string(),
  habilidad: z.string(),
  tema: z.string(),
  subtema: z.string(),
  dificultad: z.number(),
  contexto: z.string().nullable(),
  enunciado: z.string(),
  opciones: z.array(OpcionSchema),
  explicacion: z.string(),
  que_identificar: z.string(),
  que_revisar: z.string(),
  tiempo_sugerido_seg: z.number(),
  advertencias: z.array(z.string()),
})

const LoteSchema = z.object({ preguntas: z.array(PreguntaSchema) })

const REGLAS = `Reglas del banco:
- Exactamente una opción correcta. Cada distractor debe construirse para un error concreto y su "explicacion" dice exactamente por qué NO responde la pregunta, citando el dato o pasaje que lo descarta. "razon_frecuente": en una frase, el camino que lleva a esa opción.
- "explicacion" general: razonamiento completo siguiendo los pasos LEER → COMPRENDER → INTERPRETAR → REPRESENTAR → RAZONAR → RESOLVER → VERIFICAR (escribe "Leer: … Comprender: …" etc.).
- "que_identificar": la información relevante que había que ubicar. "que_revisar": concepto o estrategia para repasar.
- "afirmacion" y "evidencia": las de la Guía de orientación Saber 11 del ICFES para esa competencia; si no estás seguro del texto literal, redáctalas fielmente y añade la advertencia "afirmacion_por_verificar".
- dificultad: 1 básica, 2 media, 3 alta. tiempo_sugerido_seg: entre 60 y 240.
- Si la pregunta original tiene errores, ambigüedad o no puedes determinar la clave con certeza, dilo en "advertencias" (el docente revisará).
- Español claro; en Inglés, enunciado y opciones en inglés y explicaciones en español.
- Varía la letra de la opción correcta entre preguntas (A, B, C y D por igual; nunca todas en la misma letra) y procura que la correcta no sea sistemáticamente la opción más larga.
- En explicaciones y razones cita la opción por su contenido o como "opción X"; evita letras sueltas ("la B", "(C)", "A y D") para que las opciones se puedan reordenar después.
- No inventes datos ni fuentes.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })
  const url = process.env.VITE_SUPABASE_URL, anon = process.env.VITE_SUPABASE_ANON_KEY
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Falta ANTHROPIC_API_KEY en Vercel (Settings → Environment Variables)' })
  if (!url || !anon) return res.status(500).json({ error: 'Supabase no configurado en el servidor' })

  // Solo docentes/admin con sesión válida
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Inicia sesión como docente' })
  const sb = createClient(url, anon, { auth: { persistSession: false } })
  const { data: quien, error: errTok } = await sb.auth.getUser(token)
  if (errTok || !quien?.user) return res.status(401).json({ error: 'Sesión inválida' })
  const { data: perfil } = await sb.from('perfiles').select('rol').eq('id', quien.user.id).single()
  if (!perfil || !['docente', 'admin'].includes(perfil.rol)) return res.status(403).json({ error: 'Solo docentes o administradores' })

  const { accion, prueba, pregunta, texto, cantidad = 5 } = req.body ?? {}
  if (!prueba) return res.status(400).json({ error: 'Falta la prueba' })
  const client = new Anthropic()

  try {
    if (accion === 'completar') {
      if (!pregunta?.enunciado || !Array.isArray(pregunta.opciones)) return res.status(400).json({ error: 'Pregunta incompleta' })
      const r = await client.messages.parse({
        model: MODELO, max_tokens: 8000,
        system: `Eres un diseñador de ítems experto en la prueba Saber 11° del ICFES (Colombia).\n${TAXONOMIA}\n${REGLAS}`,
        messages: [{ role: 'user', content: `Prueba: ${prueba}.\nClasifica y completa esta pregunta en el formato del banco. Conserva el enunciado, el contexto y el texto de las opciones tal cual (corrige solo errores evidentes de OCR).${pregunta.correcta ? ` La clave indicada por la fuente es ${pregunta.correcta}.` : ' La fuente no indica la clave: determínala con cuidado y adviértelo.'}\n\nCONTEXTO:\n${pregunta.contexto ?? '(ninguno)'}\n\nENUNCIADO:\n${pregunta.enunciado}\n\nOPCIONES:\n${pregunta.opciones.map(o => `${o.clave}. ${o.texto}`).join('\n')}` }],
        output_config: { format: zodOutputFormat(PreguntaSchema) },
      })
      if (r.stop_reason === 'refusal') return res.status(422).json({ error: 'La IA declinó esta solicitud' })
      return res.status(200).json({ pregunta: r.parsed_output, usage: r.usage })
    }
    if (accion === 'generar') {
      if (!texto || texto.length < 80) return res.status(400).json({ error: 'Pega un texto fuente de al menos 80 caracteres' })
      const n = Math.min(10, Math.max(1, Number(cantidad) || 5))
      const r = await client.messages.parse({
        model: MODELO, max_tokens: 16000,
        system: `Eres un diseñador de ítems experto en la prueba Saber 11° del ICFES (Colombia).\n${TAXONOMIA}\n${REGLAS}`,
        messages: [{ role: 'user', content: `Prueba: ${prueba}.\nA partir del siguiente material, redacta ${n} preguntas nuevas estilo Saber 11 (4 opciones; 3 en las partes 1-4 y 7 de Inglés). Si el material es un texto para leer, úsalo como "contexto" (transcríbelo o resúmelo fielmente; no inventes datos). Varía competencias y dificultad. Respeta las reglas del banco.\n\nMATERIAL:\n${texto.slice(0, 20000)}` }],
        output_config: { format: zodOutputFormat(LoteSchema) },
      })
      if (r.stop_reason === 'refusal') return res.status(422).json({ error: 'La IA declinó esta solicitud' })
      return res.status(200).json({ preguntas: r.parsed_output?.preguntas ?? [], usage: r.usage })
    }
    return res.status(400).json({ error: 'Acción desconocida' })
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return res.status(500).json({ error: 'ANTHROPIC_API_KEY inválida' })
    if (e instanceof Anthropic.RateLimitError) return res.status(429).json({ error: 'Límite de la IA alcanzado, intenta en un minuto' })
    if (e instanceof Anthropic.APIError) return res.status(502).json({ error: `Error de la IA (${e.status}): ${e.message}` })
    return res.status(500).json({ error: e.message })
  }
}
