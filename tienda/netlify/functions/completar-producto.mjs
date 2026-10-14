/**
 * Función serverless (Netlify) que completa la ficha de un producto con Claude.
 * Variables de entorno necesarias en Netlify → Site configuration → Environment variables:
 *   ANTHROPIC_API_KEY  clave de la API de Anthropic (console.anthropic.com)
 *   ADMIN_SECRET       clave que el dueño escribe en el panel admin para poder usar esta función
 * Sin esas variables la función responde 503 y el panel usa la vía manual (copiar prompt / pegar JSON).
 * La IA solo recibe los datos escritos en el formulario; marca como "Pendiente de confirmar"
 * lo que no pueda saber y no inventa materiales, medidas, certificaciones ni reseñas.
 */
import Anthropic from "@anthropic-ai/sdk";

const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: ["descripcionCorta", "descripcion", "problema", "beneficios", "especificaciones", "incluye", "instrucciones", "precauciones", "preguntas", "palabrasClave", "pendientes"],
  properties: {
    descripcionCorta: { type: "string", description: "Una frase de máximo 110 caracteres" },
    descripcion: { type: "string", description: "2 a 4 párrafos cortos, tono comercial honesto, sin afirmaciones no verificables" },
    problema: { type: "string", description: "Qué problema o necesidad cotidiana resuelve, 1 a 2 frases" },
    beneficios: { type: "array", items: { type: "string" }, description: "3 a 5 beneficios concretos y verificables para este tipo de producto" },
    especificaciones: { type: "array", items: { type: "object", additionalProperties: false, required: ["clave", "valor"], properties: { clave: { type: "string" }, valor: { type: "string" } } }, description: "Características relevantes. Si el valor no se conoce, escribir exactamente 'Pendiente de confirmar'" },
    incluye: { type: "array", items: { type: "string" } },
    instrucciones: { type: "array", items: { type: "string" }, description: "Pasos de uso típicos para este tipo de producto" },
    precauciones: { type: "array", items: { type: "string" } },
    preguntas: { type: "array", items: { type: "object", additionalProperties: false, required: ["p", "r"], properties: { p: { type: "string" }, r: { type: "string" } } }, description: "3 a 5 preguntas frecuentes del producto con respuesta honesta; si depende de datos desconocidos, decir que se confirma por WhatsApp" },
    palabrasClave: { type: "array", items: { type: "string" }, description: "6 a 12 términos de búsqueda en español de Colombia" },
    pendientes: { type: "array", items: { type: "string" }, description: "Lista de datos que el vendedor debe confirmar antes de publicar" }
  }
};

const SISTEMA = `Eres el copywriter de una tienda colombiana que vende productos económicos y útiles por WhatsApp. Escribes en español de Colombia, tono cercano y claro, sin exagerar.
Reglas estrictas:
- Usa SOLO los datos entregados y el conocimiento general sobre ese tipo de producto.
- No inventes materiales, medidas, capacidades, compatibilidades, certificaciones, resultados, descuentos, reseñas ni testimonios. Cuando una característica sea específica del modelo concreto y no la conozcas, pon el valor exacto "Pendiente de confirmar" y añádela a "pendientes".
- No prometas envío gratis, garantías ni tiempos de entrega.
- No uses frases como "el más vendido", "últimas unidades" ni "calidad premium".
- Los beneficios deben ser consecuencias prácticas y verificables del uso normal del producto.
- Las precauciones deben ser sensatas para el tipo de producto (electricidad, niños, humedad, pesos, etc.).
- Respuestas de preguntas frecuentes: si dependen de datos del vendedor (envíos, pagos, stock, garantía), responde que se confirma por WhatsApp antes de comprar.`;

const json = (status, body) => ({ statusCode: status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, body: JSON.stringify(body) });

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Método no permitido" });
  if (!process.env.ANTHROPIC_API_KEY || !process.env.ADMIN_SECRET) return json(503, { error: "La función no está configurada (faltan ANTHROPIC_API_KEY o ADMIN_SECRET en Netlify)." });
  const clave = event.headers["x-admin-secret"] || event.headers["X-Admin-Secret"];
  if (!clave || clave !== process.env.ADMIN_SECRET) return json(401, { error: "Clave de administración incorrecta." });

  let datos;
  try { datos = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "Cuerpo inválido" }); }
  const nombre = String(datos.nombre || "").trim().slice(0, 200);
  if (!nombre) return json(400, { error: "Falta el nombre del producto" });
  const campos = {
    nombre,
    categoria: String(datos.categoria || "").slice(0, 100),
    precio: Number(datos.precio) || null,
    descripcionCorta: String(datos.descripcionCorta || "").slice(0, 300),
    descripcion: String(datos.descripcion || "").slice(0, 2000),
    variantes: Array.isArray(datos.variantes) ? datos.variantes.slice(0, 10) : [],
    notasVendedor: String(datos.notas || "").slice(0, 2000)
  };
  const contenido = [];
  const imagen = typeof datos.imagenUrl === "string" && /^https:\/\//.test(datos.imagenUrl) ? datos.imagenUrl : null;
  if (imagen) contenido.push({ type: "image", source: { type: "url", url: imagen } });
  contenido.push({ type: "text", text: `Completa la ficha comercial de este producto. Datos del vendedor (JSON):\n${JSON.stringify(campos, null, 2)}\n${imagen ? "Usa la foto solo para describir lo que se ve; no deduzcas materiales ni medidas exactas." : ""}` });

  const client = new Anthropic();
  try {
    const respuesta = await client.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 8000,
      output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
      system: SISTEMA,
      messages: [{ role: "user", content: contenido }]
    });
    if (respuesta.stop_reason === "refusal") return json(422, { error: "La IA no pudo procesar esta solicitud." });
    const texto = respuesta.content.find(b => b.type === "text")?.text || "{}";
    const ficha = JSON.parse(texto);
    return json(200, { ficha, uso: { entrada: respuesta.usage.input_tokens, salida: respuesta.usage.output_tokens } });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return json(503, { error: "Clave de API inválida." });
    if (err instanceof Anthropic.RateLimitError) return json(429, { error: "Demasiadas solicitudes; intenta en un minuto." });
    if (err instanceof Anthropic.APIError) return json(502, { error: `Error de la API (${err.status}).` });
    return json(500, { error: "Error inesperado al generar la ficha." });
  }
};
