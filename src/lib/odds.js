// ─── Integración de Cuotas — Motor Mundial 2026 ───────────────────────────────
// Prioridad: 1) The Odds API  2) BetWinner proxy  3) null (fallo)

import { poissonOver } from './engine'

const ODDS_KEY = import.meta.env.VITE_ODDS_API_KEY

// ─── The Odds API ─────────────────────────────────────────────────────────────
async function fetchOddsAPI(teamAName, teamBName) {
  if (!ODDS_KEY) return null
  try {
    const url = `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds/?apiKey=${ODDS_KEY}&regions=eu&bookmakers=betwinner&markets=h2h,totals&oddsFormat=decimal`
    const res = await fetch(url)
    if (!res.ok) return null
    const events = await res.json()

    const normalize = s => s.toLowerCase().replace(/[^a-z]/g, '')
    const nA = normalize(teamAName)
    const nB = normalize(teamBName)

    const event = events.find(e => {
      const nh = normalize(e.home_team)
      const na = normalize(e.away_team)
      return (nh.includes(nA) || nA.includes(nh)) && (na.includes(nB) || nB.includes(na)) ||
             (nh.includes(nB) || nB.includes(nh)) && (na.includes(nA) || nA.includes(na))
    })
    if (!event) return null

    const bw = event.bookmakers.find(b => b.key === 'betwinner') || event.bookmakers[0]
    if (!bw) return null

    const result = { source: 'OddsAPI', extraido_en: new Date().toISOString(), mercados: {} }

    for (const mkt of bw.markets) {
      if (mkt.key === 'totals') {
        // Goals over/under
        result.mercados.goles_totales = mkt.outcomes
          .filter(o => o.name === 'Over')
          .map(o => ({
            linea: o.point,
            over: o.price,
            under: mkt.outcomes.find(x => x.name === 'Under' && x.point === o.point)?.price ?? null,
          }))
      }
      if (mkt.key === 'h2h') {
        result.mercados.ganador = mkt.outcomes.map(o => ({ nombre: o.name, cuota: o.price }))
      }
    }
    return result
  } catch {
    return null
  }
}

// ─── BetWinner proxy (Vercel serverless) ──────────────────────────────────────
async function fetchBetWinnerProxy(teamAName, teamBName) {
  try {
    const params = new URLSearchParams({ teamA: teamAName, teamB: teamBName })
    const res = await fetch(`/api/betwinner-odds?${params}`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// ─── Fetch principal con fallback ─────────────────────────────────────────────
export async function fetchAllOdds(teamAName, teamBName) {
  const [oddsApi, bwProxy] = await Promise.allSettled([
    fetchOddsAPI(teamAName, teamBName),
    fetchBetWinnerProxy(teamAName, teamBName),
  ])

  const apiData  = oddsApi.status  === 'fulfilled' ? oddsApi.value  : null
  const proxyData= bwProxy.status  === 'fulfilled' ? bwProxy.value  : null

  if (!apiData && !proxyData) return null

  // Merge: BetWinner proxy tiene prioridad para mercados de tiros/córners/tarjetas
  const merged = {
    source: [],
    extraido_en: new Date().toISOString(),
    mercados: {},
  }
  if (apiData)   { Object.assign(merged.mercados, apiData.mercados);   merged.source.push('OddsAPI')   }
  if (proxyData) { Object.assign(merged.mercados, proxyData.mercados); merged.source.push('BetWinner') }

  return merged
}

// ─── Calcular EV para una línea ───────────────────────────────────────────────
export function calcLineEV(expectedAdj, line, cuotaOver) {
  if (!cuotaOver || cuotaOver <= 1) return null
  const pOver   = poissonOver(expectedAdj, line)
  const ev      = pOver * cuotaOver - 1
  const pImpl   = 1 / cuotaOver
  return {
    pOver:  +(pOver * 100).toFixed(1),
    pImpl:  +(pImpl * 100).toFixed(1),
    ev:     +(ev * 100).toFixed(1),
    verdict: ev > 0.05 ? 'alto' : ev > 0.025 ? 'positivo' : ev > 0 ? 'marginal' : 'sin_valor',
  }
}

// ─── Buscar la línea más cercana en un array de líneas de BetWinner ───────────
export function findClosestLine(lines = [], target) {
  if (!lines.length) return null
  return lines.reduce((best, l) =>
    Math.abs(l.linea - target) < Math.abs(best.linea - target) ? l : best
  )
}
