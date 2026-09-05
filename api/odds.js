// Vercel Edge Function — proxy The Odds API
// La clave vive AQUÍ (ODDS_API_KEY, privada): nunca llega al navegador.
// El cliente pide /api/odds?sport=soccer_epl y recibe los eventos con cuotas.

export const config = { runtime: 'edge' }

const API_KEY = process.env.ODDS_API_KEY
const BASE = 'https://api.the-odds-api.com/v4'

// sport keys que la app usa (mercados-liga / odds.js del cliente)
const VALID_SPORTS = new Set([
  'soccer_spain_la_liga', 'soccer_epl', 'soccer_italy_serie_a',
  'soccer_germany_bundesliga', 'soccer_france_ligue_one',
  'soccer_brazil_campeonato', 'soccer_russia_premier_league',
  'soccer_argentina_primera_division', 'soccer_mexico_ligamx',
  'soccer_netherlands_eredivisie', 'soccer_portugal_primeira_liga',
  'soccer_japan_j_league', 'soccer_china_superleague', 'soccer_england_league1',
])

export default async function handler(req) {
  if (!API_KEY) return json({ ok: false, error: 'ODDS_API_KEY not configured' }, 503)

  const { searchParams } = new URL(req.url)
  const sport = searchParams.get('sport')
  if (!VALID_SPORTS.has(sport)) return json({ ok: false, error: 'sport inválido' }, 400)

  try {
    const url = `${BASE}/sports/${sport}/odds/?apiKey=${API_KEY}&regions=eu&markets=totals,spreads&oddsFormat=decimal`
    const r = await fetch(url)
    if (!r.ok) return json({ ok: false, error: `odds-api ${r.status}` }, 200)
    const eventos = await r.json()
    // créditos restantes del plan — para vigilar el consumo desde la app
    const restantes = r.headers.get('x-requests-remaining')
    return json({ ok: true, eventos, restantes }, 200, 1800) // caché CDN 30 min
  } catch (e) {
    return json({ ok: false, error: e.message }, 200)
  }
}

function json(data, status = 200, sMaxAge = 0) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // caché en el CDN de Vercel: todos los usuarios comparten la respuesta
      // → una sola llamada real cada 30 min por liga = créditos protegidos
      'Cache-Control': sMaxAge ? `s-maxage=${sMaxAge}, stale-while-revalidate=600` : 'no-store',
    },
  })
}
