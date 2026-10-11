// ─── CUOTAS REALES — Betano Colombia (la única casa que usa Carlos) ──────────
//
// Betano publica sus cuotas en JSON sin login. El proxy /api/betano (Edge) las
// reenvía ya filtradas a mercados de equipo/partido. Aquí se cruza ese catálogo
// con los picks del motor:
//   · si Betano ofrece la línea exacta → el pick lleva su cuota real y su EV
//   · si Betano NO ofrece esa línea (o ese mercado en ese partido) → el pick se
//     descarta: no se puede apostar, así que no se recomienda
//   · si Betano no tiene la liga / el partido → todo sigue como antes (cuota estimada)
//
// Verificado 2026-09-11 (Premier): remates, tiros al arco, córners (+hándicap),
// saques de banda, saques de meta, faltas, tarjetas, goles, hándicap asiático.
// Ligas menores (J.League, Colombia) prematch: solo córners, goles y hándicaps.
// Rusia NO está en Betano Colombia.

const ES_DEV = !!import.meta.env.DEV
// Betano solo responde a IPs colombianas (2026-10-10: 403 desde Vercel iad1 y
// gru1). Orden de intento:
//   1. relé local en el PC de Carlos (npm run betano → http://localhost:8787)
//   2. proxy de Vercel (por si algún día deja de bloquear)
// En dev no hay Functions locales: el 2º es el proxy de producción (CORS abierto).
const RELAY = 'http://localhost:8787/api/betano'
const PROXY_VERCEL = ES_DEV ? 'https://motor-apuestas-xi.vercel.app/api/betano' : '/api/betano'
let relayCaido = 0 // ts del último fallo del relé: no reintentar en 2 min

async function pedir(query) {
  const intentos = Date.now() - relayCaido > 2 * 60_000 ? [RELAY, PROXY_VERCEL] : [PROXY_VERCEL]
  for (const base of intentos) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), base === RELAY ? 2500 : 15000)
      const r = await fetch(`${base}?${query}`, { signal: ctrl.signal })
      clearTimeout(t)
      if (!r.ok) { if (base === RELAY) relayCaido = Date.now(); continue }
      const data = await r.json()
      if (data?.ok) return data
      // el proxy respondió pero Betano no (403 geo, etc.): probar el siguiente
    } catch {
      if (base === RELAY) relayCaido = Date.now()
    }
  }
  return null
}

// liga interna (leagues.js) → id de liga en Betano Colombia (ligas.txt 2026-09-11)
export const BETANO_LIGA = {
  39: '1', 140: '5', 78: '216', 135: '1635', 61: '215', 94: '17083', 88: '17067',
  253: '17103', 262: '17264', 239: '16940', 13: '436g', 11: '435g', 2: '432g', 3: '433g', 848: '434g',
  40: '2', 45: '218', 48: '10215', 71: '10016', 128: '195785', 203: '17093', 307: '17766',
  179: '1647', 144: '16849', 197: '1636', 207: '17122', 218: '16823',
  95: '10017', 256: '10008', 136: '10210', 141: '10000', 137: '10815', 258: '194888',
  98: '17058', 169: '16935', 41: '527', 131: '17244', 130: '17166', 263: '195435',
  265: '16932', 242: '17249', 268: '17105', 250: '17078', 255: '18090', 240: '17500',
  // 235 / 309 / 311 (Rusia): Betano Colombia no las ofrece
}

export const CASA = 'Betano'

// ── Cuota objetivo (preferencia del usuario, 2026-10-10: "priorizar cuotas 1.5") ──
const KEY_OBJ = 'motor_cuota_objetivo_v1'
export const CUOTA_OBJETIVO_DEFAULT = 1.50
export function getCuotaObjetivo() {
  try { const v = parseFloat(localStorage.getItem(KEY_OBJ)); return v >= 1.1 && v <= 5 ? v : CUOTA_OBJETIVO_DEFAULT } catch { return CUOTA_OBJETIVO_DEFAULT }
}
export function setCuotaObjetivo(v) {
  try { localStorage.setItem(KEY_OBJ, String(v)) } catch {}
}

// ── Caché corta en localStorage (las cuotas se mueven) ──
const CACHE_KEY = 'motor_betano_cache_v1'
const TTL_LIGA = 15 * 60_000
const TTL_EVENTO = 5 * 60_000
function getCache(k, ttl) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    const e = all[k]
    return e && Date.now() - e.ts < ttl ? e.data : null
  } catch { return null }
}
function setCache(k, data) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    for (const key of Object.keys(all)) if (Date.now() - all[key].ts > TTL_LIGA) delete all[key]
    all[k] = { ts: Date.now(), data }
    localStorage.setItem(CACHE_KEY, JSON.stringify(all))
  } catch {}
}

export function ligaEnBetano(leagueId) { return !!BETANO_LIGA[leagueId] }

export async function fetchEventosBetano(leagueId) {
  const id = BETANO_LIGA[leagueId]
  if (!id) return null
  const cached = getCache(`liga_${id}`, TTL_LIGA)
  if (cached) return cached
  const data = await pedir(`liga=${id}`)
  if (!data) return null
  setCache(`liga_${id}`, data.eventos)
  return data.eventos
}

export async function fetchMercadosBetano(evUrl) {
  const cached = getCache(`ev_${evUrl}`, TTL_EVENTO)
  if (cached) return cached
  const data = await pedir(`evento=${encodeURIComponent(evUrl)}`)
  if (!data) return null
  const out = { evento: data.evento, mercados: data.mercados }
  setCache(`ev_${evUrl}`, out)
  return out
}

// ── Emparejar nombres (Live-Score en inglés vs Betano en español/local) ──
const GENERICOS = new Set(['fc', 'cf', 'afc', 'sc', 'ac', 'as', 'us', 'ss', 'ud', 'cd', 'sd', 'rc', 'rcd', 'ca', 'cs',
  'club', 'de', 'la', 'el', 'los', 'las', 'del', 'the', 'and', 'y', 'e', 'rj', 'sp', 'mg', 'fk', 'sk', 'bk', 'if', 'nk',
  'calcio', 'futebol', 'futbol', 'deportivo', 'atletico', 'athletic', 'sporting', 'real', 'racing', 'united', 'city', 'town', 'ii', 'b'])
export const tokens = (s) => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w && !GENERICOS.has(w))

function afinidad(a, b) {
  const ta = tokens(a); const tb = tokens(b)
  if (!ta.length || !tb.length) return 0
  let n = 0
  for (const w of ta) if (tb.some(x => x === w || (w.length > 4 && x.length > 4 && (x.startsWith(w) || w.startsWith(x))))) n++
  return n / Math.max(ta.length, tb.length)
}

// Elige el evento de Betano que corresponde al partido (nombres + fecha si hay)
export function buscarEventoBetano(eventos, homeName, awayName, fechaIso = null) {
  if (!eventos?.length) return null
  const ts = fechaIso ? new Date(fechaIso).getTime() : null
  let mejor = null
  for (const e of eventos) {
    const sH = afinidad(e.home, homeName); const sA = afinidad(e.away, awayName)
    if (sH <= 0 || sA <= 0) continue
    let score = sH + sA
    if (ts && e.startTime) {
      const dh = Math.abs(e.startTime - ts) / 3600_000
      if (dh > 36) continue       // otro partido (ida/vuelta, otra jornada)
      score += dh < 3 ? 0.5 : 0
    }
    if (!mejor || score > mejor.score) mejor = { ...e, score }
  }
  return mejor
}

// ── Oferta completa de Betano para un partido (o null si no está) ──
export async function ofertaBetano(leagueId, homeName, awayName, fechaIso = null) {
  try {
    if (!BETANO_LIGA[leagueId]) return { estado: 'sin-liga' }
    const eventos = await fetchEventosBetano(leagueId)
    if (!eventos) return { estado: 'error' }
    const ev = buscarEventoBetano(eventos, homeName, awayName, fechaIso)
    if (!ev) return { estado: 'sin-partido' }
    const m = await fetchMercadosBetano(ev.url)
    if (!m) return { estado: 'error', evento: ev }
    return { estado: 'ok', evento: m.evento?.name ? m.evento : ev, mercados: m.mercados, ts: Date.now() }
  } catch { return { estado: 'error' } }
}

// ── Mapa marketKey del motor → mercado Betano ──
const TOTALES = {
  shots_totales: '4159', sot_totales: 'X002', corners_totales: 'CNOU', goles_totales: 'HCTG',
  tarjetas_totales: 'TCOU', ti_totales: 'X128', gk_totales: 'X328',
  corners_1h: 'COU1', corners_2h: 'COU2', sot_1h: '4108', tarjetas_1h: '1COU',
}
// [local, visita]
const EQUIPO = {
  tiros: ['4160', '4161'], sot: ['X133', 'X134'], corners: ['XOF2', 'YOF2'], goles: ['OUHG', 'OUAG'],
  tarjetas: ['HCOU', 'ACOU'], ti: ['4167', '4168'], gk: ['4165', '4166'],
}
const HANDICAPS = { handicap: 'AHRF', handicap_corners: 'FCH2' }

const esOver = (nombre) => /^m[aá]s/i.test(nombre.trim())
const esUnder = (nombre) => /^menos/i.test(nombre.trim())
// "Brentford FC Remates totales" contiene los tokens del equipo; el rival no
const empiezaCon = (nombre, equipo) => afinidad(nombre, equipo) > 0

function mercadoDe(oferta, pick) {
  const ms = oferta.mercados ?? []
  const key = pick.marketKey ?? ''
  if (TOTALES[key]) return ms.find(m => m.type === TOTALES[key]) ?? null
  const mLado = key.match(/^(tiros|sot|corners|goles|tarjetas|ti|gk)_(local|visita)$/)
  if (mLado) {
    const [codLocal, codVisita] = EQUIPO[mLado[1]]
    const lado = mLado[2]
    const equipo = lado === 'local' ? oferta.evento?.home : oferta.evento?.away
    const candidatos = ms.filter(m => m.type === codLocal || m.type === codVisita)
    // Por nombre del equipo (más fiable); si no, por el código (1º local, 2º visita)
    return candidatos.find(m => equipo && empiezaCon(m.name, equipo))
      ?? candidatos.find(m => m.type === (lado === 'local' ? codLocal : codVisita)) ?? null
  }
  if (pick.category === 'handicap' || pick.category === 'handicap_corners') {
    return ms.find(m => m.type === HANDICAPS[pick.category]) ?? null
  }
  return null
}

// Escalera de líneas de un mercado Más/Menos: [{line, over, under}]
export function escalera(mercado) {
  if (!mercado) return []
  const porLinea = {}
  for (const s of mercado.selections ?? []) {
    const l = s.handicap
    if (l == null) continue
    porLinea[l] ??= { line: l }
    if (esOver(s.name)) porLinea[l].over = s.price
    else if (esUnder(s.name)) porLinea[l].under = s.price
  }
  return Object.values(porLinea).sort((a, b) => a.line - b.line)
}

// Cuota de Betano para un pick concreto. Devuelve:
//   { cuota, lineas }  → línea ofrecida
//   { cuota: null, lineas, motivo }  → mercado ofrecido pero no esa línea / lado
//   null → Betano no ofrece ese mercado en este partido
export function cuotaBetanoParaPick(oferta, pick) {
  if (oferta?.estado !== 'ok') return undefined // sin información: no tocar el pick
  const m = mercadoDe(oferta, pick)
  if (!m) return null
  if (pick.dir === 'CUBRE') {
    const H = pick.hSide === 'local' ? -pick.hLine : pick.hLine
    const equipo = pick.hSide === 'local' ? oferta.evento?.home : oferta.evento?.away
    const sel = (m.selections ?? []).find(s => Number(s.handicap) === Number(H) && equipo && empiezaCon(s.name, equipo))
    const lineas = (m.selections ?? []).map(s => ({ sel: s.name, cuota: s.price }))
    return sel ? { cuota: sel.price, lineas } : { cuota: null, lineas, motivo: `Betano no ofrece ${pick.line}` }
  }
  const lineas = escalera(m)
  const fila = lineas.find(l => Number(l.line) === Number(pick.line))
  const cuota = fila ? (pick.dir === 'OVER' ? fila.over : fila.under) : null
  if (cuota) return { cuota, lineas }
  const disponibles = lineas.map(l => l.line).join(', ')
  return { cuota: null, lineas, motivo: lineas.length ? `Betano solo ofrece ${disponibles}` : 'sin líneas' }
}

// Aplica la oferta a los candidatos del motor:
//   · línea ofrecida → cuota real, EV y casa
//   · mercado ofrecido pero no la línea → fuera (no se puede apostar)
//   · mercado NO ofrecido en este partido → fuera
//   · sin información de Betano → candidatos intactos
export function aplicarOfertaBetano(candidates, oferta) {
  if (oferta?.estado !== 'ok') return candidates
  const out = []
  for (const c of candidates) {
    const r = cuotaBetanoParaPick(oferta, c)
    if (!r || !r.cuota) continue
    const p = (c.pMod ?? 0) / 100
    const ev = p > 0 ? +((p * r.cuota - 1) * 100).toFixed(1) : null
    out.push({ ...c, cuota: r.cuota, casaCuota: CASA, ev, evNum: ev ?? -999, lineasBetano: r.lineas })
  }
  return out
}

// Resumen humano del estado de Betano para la UI
export function textoOferta(oferta) {
  if (!oferta) return null
  switch (oferta.estado) {
    case 'sin-liga': return 'Esta liga no está en Betano Colombia'
    case 'sin-partido': return 'Betano aún no publicó este partido'
    case 'error': return 'Sin cuotas de Betano: enciende el relé (npm run betano) — Betano solo responde desde Colombia'
    case 'ok': return `Cuotas reales de Betano · ${oferta.mercados?.length ?? 0} mercados`
    default: return null
  }
}
