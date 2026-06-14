// Vercel Serverless Function — proxy BetWinner odds
// Evita CORS al hacer el fetch desde el servidor

export const config = { runtime: 'edge' }

const BW_API = 'https://bw-cdn.amd.bwinner.com/service-api/LineFeed'

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z]/g, '')
}

// Intentar obtener cuotas de la API interna de BetWinner (plataforma 1xBet)
async function fetchBWEvent(teamA, teamB) {
  const nA = normalize(teamA)
  const nB = normalize(teamB)

  // Paso 1: buscar todos los eventos de FIFA World Cup
  const r1 = await fetch(
    `${BW_API}/GetSports?LanguageId=8&sportId=1&tf=0&tz=-5`,
    { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } }
  )
  if (!r1.ok) return null
  const sports = await r1.json()

  // Buscar campeonato FIFA World Cup
  const football = sports?.Value?.find(s => s.Id === 1)
  if (!football) return null

  const wc = football.L?.find(l =>
    normalize(l.L ?? '').includes('worldcup') ||
    normalize(l.L ?? '').includes('mundial') ||
    normalize(l.L ?? '').includes('fifaworld')
  )
  if (!wc) return null

  // Paso 2: obtener partidos del campeonato
  const r2 = await fetch(
    `${BW_API}/GetEventsV2?chId=${wc.LI}&tz=-5&tf=0&lng=8`,
    { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } }
  )
  if (!r2.ok) return null
  const events = await r2.json()

  // Buscar el partido por nombre de equipos
  const match = events?.Value?.find(e => {
    const teams = normalize(e.E ?? '')
    return (teams.includes(nA) || nA.slice(0, 4) === teams.slice(0, 4)) &&
           (teams.includes(nB) || nB.slice(0, 4) === teams.slice(0, 4))
  })
  return match || null
}

function parseMarkets(bwEvent) {
  if (!bwEvent) return {}
  const markets = {}

  // BetWinner devuelve los grupos de mercados en bwEvent.SG[]
  // Cada grupo tiene SG[n].G (nombre) y SG[n].E[] (outcomes)
  const groups = bwEvent.SG ?? []

  for (const g of groups) {
    const name = normalize(g.G ?? '')
    const lines = (g.E ?? []).map(e => ({
      linea: e.P,
      over:  e.C?.find(c => normalize(c.T) === 'over')?.C ?? null,
      under: e.C?.find(c => normalize(c.T) === 'under')?.C ?? null,
    })).filter(l => l.linea && (l.over || l.under))

    if (!lines.length) continue

    if (name.includes('cornertotal') || name.includes('corners'))          markets.corners_totales  = lines
    else if (name.includes('corner1h') || name.includes('cornersfirsthalf'))markets.corners_1h      = lines
    else if (name.includes('corner2h') || name.includes('cornerssecond'))  markets.corners_2h       = lines
    else if (name.includes('shotstotal') || name.includes('totalshots'))   markets.tiros_totales    = lines
    else if (name.includes('shots1h') || name.includes('shotsfirsthalf'))  markets.tiros_1h         = lines
    else if (name.includes('shots2h') || name.includes('shotssecond'))     markets.tiros_2h         = lines
    else if (name.includes('targetstotal') || name.includes('shotsontarget')) markets.sot_totales   = lines
    else if (name.includes('cards') || name.includes('bookings'))          markets.tarjetas_totales = lines
    else if (name.includes('cards1h') || name.includes('bookingshalf'))    markets.tarjetas_1h      = lines
    else if (name.includes('totaltotalgoal') || name.includes('goaltotal'))markets.goles_totales    = lines
    else if (name.includes('goal1h') || name.includes('goalsfirsthalf'))   markets.goles_1h         = lines
  }
  return markets
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url)
  const teamA = searchParams.get('teamA') ?? ''
  const teamB = searchParams.get('teamB') ?? ''

  if (!teamA || !teamB) {
    return new Response(JSON.stringify({ error: 'Faltan equipos' }), { status: 400 })
  }

  try {
    const bwEvent = await fetchBWEvent(teamA, teamB)
    if (!bwEvent) {
      return new Response(JSON.stringify({ available: false, error: 'Partido no encontrado en BetWinner' }), { status: 200 })
    }

    const mercados = parseMarkets(bwEvent)
    return new Response(JSON.stringify({
      available: true,
      source: 'BetWinner',
      extraido_en: new Date().toISOString(),
      mercados,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ available: false, error: e.message }), { status: 200 })
  }
}
