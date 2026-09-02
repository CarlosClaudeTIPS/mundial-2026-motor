// Vercel Edge Function — lee el pantallazo de una apuesta con Claude.
// La clave ANTHROPIC_API_KEY vive AQUÍ (privada): nunca llega al navegador.
// El cliente manda { base64, mimeType } y recibe el JSON con los datos.

export const config = { runtime: 'edge' }

const API_KEY = process.env.ANTHROPIC_API_KEY

const PROMPT = `Analiza este pantallazo de una apuesta deportiva y extrae la información en JSON.
Si un dato no está visible usa null. Responde SOLO con JSON válido, sin texto adicional:

{
  "deporte": "deporte (Fútbol/Baloncesto/Tenis/etc)",
  "casa": "nombre de la casa (BetWinner/Betplay/Rushbet/etc)",
  "partido": "Equipo A vs Equipo B",
  "mercado": "descripción del mercado (ej: Tiros totales Over 23.5, Córners Over 9.5)",
  "seleccion": "selección exacta (ej: Over, Under, Local)",
  "cuota": 1.75,
  "monto": 25000,
  "ganancia_potencial": 43750
}`

export default async function handler(req) {
  if (!API_KEY) return json({ ok: false, error: 'ANTHROPIC_API_KEY not configured' }, 503)
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405)

  let body
  try { body = await req.json() } catch { return json({ ok: false, error: 'body' }, 400) }
  const { base64, mimeType } = body ?? {}
  if (!base64 || !mimeType) return json({ ok: false, error: 'falta imagen' }, 400)

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      return json({ ok: false, error: e?.error?.message || `Claude ${res.status}` }, 200)
    }
    const data = await res.json()
    const texto = data.content?.[0]?.text ?? ''
    const match = texto.match(/\{[\s\S]*\}/)
    if (!match) return json({ ok: false, error: 'sin JSON en la respuesta' }, 200)
    return json({ ok: true, datos: JSON.parse(match[0]) }, 200)
  } catch (e) {
    return json({ ok: false, error: e.message }, 200)
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
