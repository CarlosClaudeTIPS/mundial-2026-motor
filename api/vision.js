// Vercel Edge Function — lee el pantallazo de una apuesta con Claude.
// La clave ANTHROPIC_API_KEY vive AQUÍ (privada): nunca llega al navegador.
// El cliente manda { base64, mimeType } y recibe el JSON con los datos.

export const config = { runtime: 'edge' }

const API_KEY = process.env.ANTHROPIC_API_KEY

const PROMPT = `Analiza este pantallazo de un cupón/boleto de apuesta deportiva y extrae la información en JSON.

SIMPLE vs MÚLTIPLE: un boleto puede tener UNA sola selección (apuesta simple) o VARIAS (apuesta múltiple / combinada / parlay). En una múltiple hay varios partidos y varias cuotas, pero UN solo monto apostado y UNA ganancia posible total (y a veces una "cuota total" = producto de las cuotas). Devuelve SIEMPRE un arreglo "selecciones" con una entrada por cada partido apostado (en una simple, el arreglo tiene 1 entrada).

REGLAS IMPORTANTES para no confundir los campos:
- "partido": son los DOS EQUIPOS que se enfrentan. Casi siempre están en NEGRILLA y con formato "Equipo A - Equipo B" o "Equipo A vs Equipo B" (ej: "Destroyer - Green Salvador"). Cópialos tal cual, cambiando el "-" por "vs". ESTO NO ES LA CASA.
- "competicion": el torneo/liga, normalmente JUSTO ARRIBA de los equipos (ej: "El Salvador. LNB Segunda", "España. LaLiga"). Quita códigos numéricos al inicio (ej: "192159. El Salvador. LNB Segunda" → "El Salvador. LNB Segunda"). Si no se ve, usa null.
- "casa": es la MARCA de la casa de apuestas (BetPlay, BetWinner, Rushbet, Codere, Wplay, Bwin, 1xBet, etc.), normalmente por su logo o color de marca. Si no se ve ninguna marca, usa null. NUNCA pongas los equipos aquí.
- "deporte": dedúcelo del contexto. Si menciona "cuarto"/"1er cuarto"/"3.er cuarto" o tiene ícono de balón de básquet 🏀 → "Baloncesto". Si dice "set"/"juego" o ícono de tenis → "Tenis". Si dice "gol"/"córner"/"tiempo"/"medio tiempo" o balón de fútbol → "Fútbol". Si dice "entrada"/"inning" → "Béisbol".
- "mercado": la descripción del mercado apostado (ej: "Total 3er cuarto: menos de 37.5", "Más de 2.5 goles").
- "seleccion": "Over" si dice "más de"/"over"/"+", "Under" si dice "menos de"/"under"/"-". Si es 1X2 usa "Local"/"Empate"/"Visitante".
- "cuota": el número decimal de la cuota (ej: 1.72).
- "monto": lo apostado. IMPORTANTE con los números de esta casa: el PUNTO (.) es el separador DECIMAL, no de miles. La coma (,) —si aparece— es el separador de miles. Ejemplos: "35041.91 COP" → 35041.91 (treinta y cinco mil, NO tres millones). "1,250.50" → 1250.50. "10000" → 10000. Quita solo "COP"/"$" y las comas de miles; CONSERVA el punto decimal tal cual. NUNCA borres el punto ni lo trates como separador de miles.
- "ganancia_potencial": las "ganancias posibles". Mismo formato: punto = decimal.

Si un dato realmente no está visible usa null. Responde SOLO con JSON válido, sin texto adicional.

- "tipo": "simple" si hay UNA selección, "multiple" si hay dos o más.
- "casa", "monto", "ganancia_potencial": van UNA vez (a nivel del boleto).
- "cuota_total": la cuota total del boleto. En simple es la cuota de la única selección; en múltiple es la cuota combinada (suele mostrarse como "Cuota total" o es el producto de las cuotas).
- "selecciones": arreglo; cada entrada es un partido apostado con sus propios deporte/competicion/partido/mercado/seleccion/cuota.

Ejemplo MÚLTIPLE:
{
  "tipo": "multiple",
  "casa": null,
  "monto": 10000,
  "cuota_total": 3.18,
  "ganancia_potencial": 31800,
  "selecciones": [
    { "deporte": "Baloncesto", "competicion": "El Salvador. LNB Segunda", "partido": "Destroyer vs Green Salvador", "mercado": "Total 3er cuarto: menos de 37.5", "seleccion": "Under", "cuota": 1.72 },
    { "deporte": "Fútbol", "competicion": "Japón. J.League", "partido": "Cerezo Osaka vs Kashiwa Reysol", "mercado": "Más de 2.5 goles", "seleccion": "Over", "cuota": 1.85 }
  ]
}

Ejemplo SIMPLE:
{
  "tipo": "simple",
  "casa": null,
  "monto": 35041.91,
  "cuota_total": 1.72,
  "ganancia_potencial": 60272.09,
  "selecciones": [
    { "deporte": "Baloncesto", "competicion": "El Salvador. LNB Segunda", "partido": "Destroyer vs Green Salvador", "mercado": "Total 3er cuarto: menos de 37.5", "seleccion": "Under", "cuota": 1.72 }
  ]
}

(En el ejemplo simple, "35041.91 COP" apostados = 35041.91 pesos, con .91 de decimales — nunca 3504191.)`

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
