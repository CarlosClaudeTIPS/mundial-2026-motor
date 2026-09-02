// Vercel Edge Function — lee el pantallazo de una apuesta con Claude.
// La clave ANTHROPIC_API_KEY vive AQUÍ (privada): nunca llega al navegador.
// El cliente manda { base64, mimeType } y recibe el JSON con los datos.

export const config = { runtime: 'edge' }

const API_KEY = process.env.ANTHROPIC_API_KEY

const PROMPT = `Analiza este pantallazo de un cupón/boleto de apuesta deportiva y extrae la información en JSON.

REGLAS IMPORTANTES para no confundir los campos:
- "partido": son los DOS EQUIPOS que se enfrentan. Casi siempre están en NEGRILLA y con formato "Equipo A - Equipo B" o "Equipo A vs Equipo B" (ej: "Destroyer - Green Salvador"). Cópialos tal cual, cambiando el "-" por "vs". ESTO NO ES LA CASA.
- "casa": es la MARCA de la casa de apuestas (BetPlay, BetWinner, Rushbet, Codere, Wplay, Bwin, 1xBet, etc.), normalmente por su logo o color de marca. Si no se ve ninguna marca, usa null. NUNCA pongas los equipos aquí.
- "deporte": dedúcelo del contexto. Si menciona "cuarto"/"1er cuarto"/"3.er cuarto" o tiene ícono de balón de básquet 🏀 → "Baloncesto". Si dice "set"/"juego" o ícono de tenis → "Tenis". Si dice "gol"/"córner"/"tiempo"/"medio tiempo" o balón de fútbol → "Fútbol". Si dice "entrada"/"inning" → "Béisbol".
- "mercado": la descripción del mercado apostado (ej: "Total 3er cuarto: menos de 37.5", "Más de 2.5 goles").
- "seleccion": "Over" si dice "más de"/"over"/"+", "Under" si dice "menos de"/"under"/"-". Si es 1X2 usa "Local"/"Empate"/"Visitante".
- "cuota": el número decimal de la cuota (ej: 1.72).
- "monto": lo apostado. Ignora "COP"/"$"/puntos de miles (35.041,91 COP → 35041.91). Devuelve solo el número.
- "ganancia_potencial": las "ganancias posibles". Mismo formato numérico.

Si un dato realmente no está visible usa null. Responde SOLO con JSON válido, sin texto adicional:

{
  "deporte": "Baloncesto",
  "casa": null,
  "partido": "Destroyer vs Green Salvador",
  "mercado": "Total 3er cuarto: menos de 37.5",
  "seleccion": "Under",
  "cuota": 1.72,
  "monto": 35041.91,
  "ganancia_potencial": 60272.09
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
