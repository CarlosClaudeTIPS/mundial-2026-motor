// ─── CUOTAS REALES — The Odds API (the-odds-api.com) ─────────────────────────
//
// Plan gratis: 500 créditos/mes. Da h2h, totals (goles) y spreads (hándicap)
// de decenas de casas. NO da tiros/córners/saques en el plan gratis — para
// esos mercados la app sigue mostrando la cuota mínima estimada (1.025/p).
//
// PRODUCCIÓN: llama a /api/odds (Edge Function) — la clave vive en Vercel
// (ODDS_API_KEY, privada) y el CDN cachea 30 min, así los créditos rinden.
// DESARROLLO: usa VITE_ODDS_API_KEY del .env local y llama directo.
//
// Créditos: 1 región × 2 mercados = 2 créditos por llamada de liga. Con caché
// de 30 min, un día normal gasta <20 créditos.

const DEV_KEY = import.meta.env.VITE_ODDS_API_KEY ?? null
const ES_DEV = !!import.meta.env.DEV
const BASE = 'https://api.the-odds-api.com/v4'

// En prod se asume que el proxy está configurado; si no, responde 503 y se
// cae con gracia a la cuota estimada.
export const ODDS_DISPONIBLE = ES_DEV ? !!DEV_KEY : true

// liga interna → sport key de The Odds API
const SPORT_KEY = {
  140: 'soccer_spain_la_liga',
  39:  'soccer_epl',
  135: 'soccer_italy_serie_a',
  78:  'soccer_germany_bundesliga',
  61:  'soccer_france_ligue_one',
  71:  'soccer_brazil_campeonato',
  235: 'soccer_russia_premier_league',
  128: 'soccer_argentina_primera_division',
  262: 'soccer_mexico_ligamx',
  88:  'soccer_netherlands_eredivisie',
  94:  'soccer_portugal_primeira_liga',
}

const CACHE_KEY = 'motor_odds_cache_v1'
const TTL = 30 * 60_000 // 30 min: las cuotas se mueven, la caché corta

function getCache(k) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    const e = all[k]
    return e && Date.now() - e.ts < TTL ? e.data : null
  } catch { return null }
}
function setCache(k, data) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    // limpiar entradas viejas para no llenar localStorage
    for (const key of Object.keys(all)) if (Date.now() - all[key].ts > TTL) delete all[key]
    all[k] = { ts: Date.now(), data }
    localStorage.setItem(CACHE_KEY, JSON.stringify(all))
  } catch {}
}

// ─── Cuotas de una liga: goles (totals) y hándicap (spreads) ─────────────────
export async function fetchOddsLiga(leagueId) {
  const sport = SPORT_KEY[leagueId]
  if (!sport) return null
  if (ES_DEV && !DEV_KEY) return null

  const cached = getCache(sport)
  if (cached) return cached

  const url = ES_DEV
    ? `${BASE}/sports/${sport}/odds/?apiKey=${DEV_KEY}&regions=eu&markets=totals,spreads&oddsFormat=decimal`
    : `/api/odds?sport=${sport}`
  const r = await fetch(url)
  if (!r.ok) return null
  const data = await r.json()
  const eventos = ES_DEV ? data : (data.ok ? data.eventos : null)
  if (!eventos) return null
  setCache(sport, eventos)
  return eventos
}

const norm = s => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

// Match difuso de nombres (la API usa nombres en inglés)
function mismoEquipo(a, b) {
  const na = norm(a); const nb = norm(b)
  if (na === nb) return true
  const pa = na.split(' ').filter(w => w.length > 3)
  const pb = nb.split(' ').filter(w => w.length > 3)
  return pa.some(w => nb.includes(w)) || pb.some(w => na.includes(w))
}

// ─── Buscar la cuota real para un pick de goles o hándicap ───────────────────
// Devuelve { cuota, casa, linea } o null si la API no cubre ese mercado/línea.
export function cuotaRealParaPick(eventos, homeName, awayName, pick) {
  if (!eventos?.length) return null
  const ev = eventos.find(e => mismoEquipo(e.home_team, homeName) && mismoEquipo(e.away_team, awayName))
  if (!ev) return null

  const esGoles = pick.category === 'goals' && pick.marketKey === 'goles_totales'
  const esHand = pick.category === 'handicap'
  if (!esGoles && !esHand) return null // el plan gratis no trae tiros/córners/saques

  let mejor = null
  for (const bm of ev.bookmakers ?? []) {
    const mercado = (bm.markets ?? []).find(m => m.key === (esGoles ? 'totals' : 'spreads'))
    if (!mercado) continue
    for (const o of mercado.outcomes ?? []) {
      if (esGoles) {
        // outcome: { name: 'Over'|'Under', point: 2.5, price }
        if (o.point !== pick.line) continue
        if (norm(o.name) !== norm(pick.dir === 'OVER' ? 'Over' : 'Under')) continue
      } else {
        // outcome: { name: <equipo>, point: -0.5, price } — point es el hándicap del equipo
        const equipo = pick.hSide === 'local' ? ev.home_team : ev.away_team
        if (norm(o.name) !== norm(equipo)) continue
        if (o.point !== parseFloat(pick.line)) continue
      }
      if (!mejor || o.price > mejor.cuota) mejor = { cuota: o.price, casa: bm.title, linea: o.point }
    }
  }
  return mejor
}

// Anotar cuotas reales en una lista de picks (muta copias, no el original)
export async function anotarCuotas(leagueId, homeName, awayName, picks) {
  try {
    const eventos = await fetchOddsLiga(leagueId)
    if (!eventos) return picks
    return picks.map(p => {
      const real = cuotaRealParaPick(eventos, homeName, awayName, p)
      return real ? { ...p, cuota: real.cuota, casaCuota: real.casa } : p
    })
  } catch { return picks }
}
