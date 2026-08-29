import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { getSituationS, getTacticalK, calcLiveExpected, poissonOver } from '../lib/engine'
import { bestRealisticLine } from '../lib/picks'
import { fetchLive } from '../lib/football-api'
import { fetchFixtureStats, hasLivescore, fetchLiveGlobal } from '../lib/livescore-api'
import { LEAGUES } from '../lib/leagues'
import { buildTeamStats } from '../lib/league-stats'
import { TeamStatsRef } from './Analizar'
import RecentResults from './RecentResults'
import TiQuant from './TiQuant'
import GkQuant from './GkQuant'
import CornersQuant from './CornersQuant'
import ShotsQuant from './ShotsQuant'
import ContextoPartido from './ContextoPartido'
import { tiLogPending, resolveTiLog } from '../lib/throwins'
import { gkLogPending, resolveGkLog } from '../lib/goalkicks'
import { cornersLogPending, resolveCornersLog } from '../lib/corners'
import { shotsLogPending, resolveShotsLog, sotLogPending, resolveSotLog } from '../lib/shots'
import CardsQuant from './CardsQuant'
import { cardsLogPending, resolveCardsLog } from '../lib/cards'
import Oportunidades from './Oportunidades'
import { fetchSofaSaques } from '../lib/sofascore'

// Misma lista de ligas seguidas que usa el Fixture
const MIS_LIGAS_KEY = 'motor_mis_ligas'
const DEFAULT_MIS_LIGAS = [39, 140, 78, 135, 61]

function loadMisLigas() {
  try {
    const v = JSON.parse(localStorage.getItem(MIS_LIGAS_KEY))
    return Array.isArray(v) && v.length ? v : DEFAULT_MIS_LIGAS
  } catch { return DEFAULT_MIS_LIGAS }
}

function recommend(projected, line) {
  const margin = (projected - line) / line
  if (margin > 0.08)  return { dir: 'OVER',  conf: 'alta',  icon: '✅', pct: Math.round(margin * 100) }
  if (margin > 0.03)  return { dir: 'OVER',  conf: 'media', icon: '⚠️', pct: Math.round(margin * 100) }
  if (margin < -0.08) return { dir: 'UNDER', conf: 'alta',  icon: '✅', pct: Math.round(margin * 100) }
  if (margin < -0.03) return { dir: 'UNDER', conf: 'media', icon: '⚠️', pct: Math.round(margin * 100) }
  return { dir: null, conf: null, icon: '❌', pct: Math.round(margin * 100) }
}

function LiveMarket({ label, acum, projected, lines }) {
  const already = lines.filter(l => acum > l)
  const active  = lines.filter(l => acum <= l)

  return (
    <div>
      <p className="text-xs font-semibold text-white mb-1">
        {label} <span className="text-gray-500 font-normal">— actual: {acum} · proy: <span className="text-blue-400">{projected}</span></span>
      </p>
      <div className="space-y-0.5">
        {already.map(l => (
          <div key={l} className="flex items-center gap-3 text-xs py-0.5 opacity-40">
            <span className="w-16 text-gray-500 shrink-0">O/U {l}</span>
            <span className="text-green-400">✅ OVER — ya superado</span>
          </div>
        ))}
        {active.map(l => {
          const { dir, conf, icon, pct } = recommend(projected, l)
          const label2 = dir
            ? `${icon} ${dir} — ${conf === 'alta' ? 'Alta confianza' : 'Media confianza'} (${pct > 0 ? '+' : ''}${pct}%)`
            : `${icon} Sin recomendación clara (${pct > 0 ? '+' : ''}${pct}%)`
          return (
            <div key={l} className="flex items-center gap-3 text-xs py-0.5">
              <span className="w-16 text-gray-500 shrink-0">O/U {l}</span>
              <span className={
                conf === 'alta' ? 'text-green-400' :
                conf === 'media' ? 'text-yellow-400' :
                'text-gray-500'
              }>{label2}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tablero de stats ACTUALES del partido en vivo ───────────────────────────
const LIVE_STAT_ROWS = [
  ['Ball Possession', 'Posesión %'],
  ['Expected Goals', 'xG'],
  ['Big Chances', 'Grandes ocasiones'],
  ['Total Shots', 'Tiros'],
  ['Shots on Goal', 'A puerta'],
  ['Corner Kicks', 'Córners'],
  ['Dangerous Attacks', 'At. peligrosos'],
  ['Attacks', 'Ataques'],
  ['Throw Ins', 'Saques banda'],
  ['Goal Kicks', 'Saques portería'],
  ['Fouls', 'Faltas'],
  ['Yellow Cards', 'Amarillas'],
  ['Red Cards', 'Rojas'],
  ['Offsides', 'Offsides'],
]

function LiveStatsBoard({ raw, homeName, awayName, minuto }) {
  const num = v => typeof v === 'string' ? parseFloat(v) : v
  const rows = LIVE_STAT_ROWS
    .map(([key, label]) => ({ label, h: num(raw.home[key]), a: num(raw.away[key]) }))
    .filter(r => r.h != null || r.a != null)

  // Qué stats NO reporta la API en este partido — el usuario debe saberlo
  const missing = LIVE_STAT_ROWS
    .filter(([key]) => num(raw.home[key]) == null && num(raw.away[key]) == null)
    .map(([, label]) => label)

  if (!rows.length) return null

  return (
    <div className="card border border-red-800/40 space-y-1">
      <div className="flex items-center justify-between mb-1">
        <p className="font-semibold text-white text-sm">📊 Stats actuales — min {minuto}'</p>
        <span className="text-[10px] text-gray-600">se refrescan cada 60s</span>
      </div>
      <div className="grid grid-cols-3 text-[10px] text-gray-600 uppercase tracking-wide">
        <span className="truncate">{homeName}</span>
        <span className="text-center">Stat</span>
        <span className="text-right truncate">{awayName}</span>
      </div>
      {rows.map(r => {
        const total = (r.h ?? 0) + (r.a ?? 0)
        const hPct = total > 0 ? ((r.h ?? 0) / total) * 100 : 50
        return (
          <div key={r.label}>
            <div className="grid grid-cols-3 text-xs items-center">
              <span className={`font-mono font-bold ${r.h > r.a ? 'text-green-400' : 'text-gray-300'}`}>{r.h ?? '—'}</span>
              <span className="text-center text-gray-500">{r.label}</span>
              <span className={`text-right font-mono font-bold ${r.a > r.h ? 'text-green-400' : 'text-gray-300'}`}>{r.a ?? '—'}</span>
            </div>
            <div className="flex h-1 rounded-full overflow-hidden bg-dark-700 mb-1">
              <div className="bg-green-600/70" style={{ width: `${hPct}%` }} />
              <div className="bg-blue-600/70" style={{ width: `${100 - hPct}%` }} />
            </div>
          </div>
        )
      })}
      {missing.length > 0 && (
        <p className="text-[11px] text-yellow-600/90 pt-1 border-t border-dark-700">
          ⚠️ La API no reporta en este partido: {missing.join(', ')} — los mercados sin dato no se recomiendan
        </p>
      )}
    </div>
  )
}

// Suma "home + away" de un stat, null si ninguno existe
function sumStat(stats, name) {
  if (!stats?.length) return null
  const h = stats[0]?.stats?.[name]
  const a = stats[1]?.stats?.[name]
  const hn = typeof h === 'string' ? parseFloat(h) : h
  const an = typeof a === 'string' ? parseFloat(a) : a
  if (hn == null && an == null) return null
  return (hn ?? 0) + (an ?? 0)
}

const numv = v => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return (n == null || isNaN(n)) ? null : n
}

// Stats por equipo desde el tablero crudo
function perTeamFromRaw(raw) {
  if (!raw) return null
  const g = (side, key) => numv(raw[side]?.[key])
  const cards = side => {
    const y = g(side, 'Yellow Cards'); const r = g(side, 'Red Cards')
    return (y != null || r != null) ? (y ?? 0) + (r ?? 0) : null
  }
  const mk = side => ({
    shots:   g(side, 'Total Shots'),
    sot:     g(side, 'Shots on Goal'),
    corners: g(side, 'Corner Kicks'),
    cards:   cards(side),
    ti:      g(side, 'Throw Ins'),
    gk:      g(side, 'Goal Kicks'),
    da:      g(side, 'Dangerous Attacks'),
    att:     g(side, 'Attacks'),
  })
  return { h: mk('home'), a: mk('away') }
}

// ─── Drive de ataque por equipo: estado del partido × perfil prepartido ──────
// La proyección NO es lineal: un equipo que va ganando 2-0 y no acostumbra
// golear suele frenar; un dominante que va perdiendo sigue empujando.
function attackDrive({ diff, minuto, pre, preRival }) {
  let f = 1
  if (diff < 0)       f = diff <= -2 ? 1.14 : 1.10   // perdiendo → empuja
  else if (diff > 0)  f = diff >= 2 ? 0.85 : 0.94    // ganando → administra
  // Tramo final amplifica el estado
  if (minuto >= 70) f = diff < 0 ? f * 1.05 : diff > 0 ? f * 0.95 : f
  // Perfil prepartido (si ya cargó):
  if (pre) {
    // Equipo ganando que NO acostumbra ganar/golear → asegura el resultado
    if (diff > 0 && (pre.ppg < 1.2 || pre.gf_avg < 1.2)) f *= 0.92
    // Equipo perdiendo que es dominante (genera mucho volumen) → sigue pateando
    if (diff < 0 && preRival && pre.shots_avg >= preRival.shots_avg + 2) f *= 1.06
    // Equipo perdiendo con poca pólvora histórica → no esperes avalancha
    if (diff < 0 && pre.shots_avg < 10) f *= 0.94
  }
  return Math.min(1.25, Math.max(0.78, f))
}

export default function EnVivo({ league }) {
  // Partidos en vivo de TODAS las ligas seguidas (misma lista que el Fixture)
  const [misLigas] = useState(loadMisLigas)
  const [vista, setVista] = useState('mis') // 'mis' = ligas seguidas · 'otras' = el resto de la app
  const [liveMatches, setLiveMatches] = useState([])
  const [loadingLive, setLoadingLive] = useState(false)
  const [liveError, setLiveError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [closedGroups, setClosedGroups] = useState({}) // secciones por liga cerradas
  const [manualOpen, setManualOpen] = useState(false)
  const [statsInfo, setStatsInfo] = useState('') // feedback de auto-fill

  const toggleGroup = (key) => setClosedGroups(p => ({ ...p, [key]: !p[key] }))

  // Datos del análisis (auto-llenados al seleccionar, editables)
  const [teamAName,  setTeamAName]  = useState('')
  const [teamBName,  setTeamBName]  = useState('')
  const [minuto,     setMinuto]     = useState(45)
  const [golesA,     setGolesA]     = useState(0)
  const [golesB,     setGolesB]     = useState(0)
  const [cornersAc,  setCornersAc]  = useState(4)
  const [tirosAc,    setTirosAc]    = useState(8)
  const [sotAc,      setSotAc]      = useState(3)
  const [tarjetasAc, setTarjetasAc] = useState(1)
  const [tiAc,       setTiAc]       = useState(null) // null = sin dato en vivo
  const [tiFuente,   setTiFuente]   = useState(null) // 'api' | 'sofa' | 'manual'
  const [gkAc,       setGkAc]       = useState(null) // saques de portería acumulados
  const [gkFuente,   setGkFuente]   = useState(null)
  const [cornersFuente, setCornersFuente] = useState('manual') // córners: 'api' | 'manual'
  const [shotsFuente,   setShotsFuente]   = useState('manual') // tiros: 'api' | 'manual'
  const [cardsFuente,   setCardsFuente]   = useState('manual') // tarjetas: 'api' | 'manual'
  const [dangAtk,    setDangAtk]    = useState(null) // { h, a } ataques peligrosos si la API los da
  const [liveStatsRaw, setLiveStatsRaw] = useState(null) // stats actuales crudas por equipo
  const [zona,       setZona]       = useState('mixto')

  // Historial de snapshots del partido seleccionado → momentum (¿se calienta o se enfría?)
  const snapsRef = useRef([])

  // Prepartido: promedios de los últimos 10 por equipo (como en Analizar)
  const [preA, setPreA] = useState(null)
  const [preB, setPreB] = useState(null)
  const [preLoading, setPreLoading] = useState(false)
  const [preProgress, setPreProgress] = useState('')
  const [preError, setPreError] = useState(null)
  const prematchFor = useRef(null)

  const loadPrematch = useCallback(async (match) => {
    if (prematchFor.current === match.id) return // ya cargado o cargando para este partido
    prematchFor.current = match.id
    setPreA(null); setPreB(null); setPreError(null); setPreProgress('')
    if (!match.homeId || !match.awayId) {
      setPreError('Este partido no trae IDs de equipos para buscar su historial')
      return
    }
    if (match.sinConfigurar) {
      // Sin liga configurada no hay baseline ni tier: un prematch con la liga
      // equivocada daría priors falsos. Mejor decirlo que inventarlo.
      setPreError('Liga no configurada en la app: el análisis EN VIVO (ritmo, proyecciones) funciona, pero no hay historial ni prior prepartido para este partido')
      return
    }
    const lg = LEAGUES.find(l => l.id === match.leagueId) ?? league
    setPreLoading(true)
    const onProgress = (name, i, n) => {
      if (prematchFor.current === match.id) setPreProgress(`${name}: partido ${i}/${n}`)
    }
    try {
      const a = await buildTeamStats(lg, match.homeId, match.homeTeam, onProgress)
      if (prematchFor.current !== match.id) return
      setPreA(a)
      const b = await buildTeamStats(lg, match.awayId, match.awayTeam, onProgress)
      if (prematchFor.current !== match.id) return
      setPreB(b)
    } catch (e) {
      if (prematchFor.current === match.id) setPreError(e.message)
    } finally {
      if (prematchFor.current === match.id) { setPreLoading(false); setPreProgress('') }
    }
  }, [league])

  // ── Cargar partidos en vivo ──
  // vista 'mis' = tus ligas seguidas (una llamada por liga)
  // vista 'otras' = TODAS las demás ligas de la app vía el feed GLOBAL (1 sola
  // llamada, filtrada por competition_id → no gasta el trial)
  const loadLive = useCallback(async () => {
    setLoadingLive(true)
    setLiveError(null)
    try {
      const all = []
      if (vista === 'otras') {
        const r = await fetchLiveGlobal()
        if (r?.ok) {
          const porLsId = Object.fromEntries(LEAGUES.filter(l => l.lsId).map(l => [l.lsId, l]))
          const misLsIds = new Set(LEAGUES.filter(l => misLigas.includes(l.id)).map(l => l.lsId))
          for (const m of r.live ?? []) {
            if (misLsIds.has(m.competitionId)) continue // esos están en "Mis ligas"
            const liga = porLsId[m.competitionId]
            if (liga) {
              all.push({ ...m, leagueId: liga.id, leagueName: liga.name, leagueFlag: liga.flag })
            } else {
              // Liga NO configurada en la app: se muestra igual para no perder
              // partidos, pero sin prior prepartido (no hay baseline de liga)
              all.push({
                ...m,
                leagueId: null,
                leagueName: m.competition || m.country || `Competición ${m.competitionId}`,
                leagueFlag: '🌐',
                sinConfigurar: true,
              })
            }
          }
        } else if (r?.error) setLiveError(r.error)
      } else {
        const ligas = misLigas.map(id => LEAGUES.find(l => l.id === id)).filter(Boolean)
        const results = await Promise.allSettled(
          ligas.map(l => fetchLive(l.id).then(r => ({ liga: l, r })))
        )
        for (const res of results) {
          if (res.status !== 'fulfilled') continue
          const { liga, r } = res.value
          if (!r?.ok) continue
          for (const m of r.live ?? []) {
            all.push({ ...m, leagueId: liga.id, leagueName: liga.name, leagueFlag: liga.flag })
          }
        }
      }
      setLiveMatches(all)
      return all
    } catch (e) {
      setLiveError(e.message)
      return []
    } finally {
      setLoadingLive(false)
    }
  }, [misLigas, vista])

  // ── Resolver logs de TI de partidos que ya terminaron (live-backtest) ──
  // Solo se intenta cuando el partido salió de la lista en vivo; máx 2 llamadas
  // por ciclo y reintento cada 10 min para no gastar el límite del trial.
  const resolveAttempts = useRef({})
  const resolverTiPendientes = useCallback(async (liveNow) => {
    let done = 0
    const enVivoAhora = (id) => (liveNow ?? []).some(m => String(m.id) === String(id))
    const intentado = (key) => {
      const lastTry = resolveAttempts.current[key] ?? 0
      if (Date.now() - lastTry < 10 * 60_000) return true
      resolveAttempts.current[key] = Date.now()
      return false
    }

    // TI: Live-Score trae el dato final en el historial
    for (const p of tiLogPending()) {
      if (done >= 2) break
      if (enVivoAhora(p.id) || intentado(`ti_${p.id}`)) continue
      try {
        const r = await fetchFixtureStats(p.id, p.homeId, p.awayId)
        const h = numv(r.stats?.[0]?.stats?.['Throw Ins'])
        const a = numv(r.stats?.[1]?.stats?.['Throw Ins'])
        if (h != null || a != null) { resolveTiLog(p.id, (h ?? 0) + (a ?? 0), { h, a }); done++ }
      } catch {}
    }

    // Córners: Live-Score trae el dato final por equipo en el historial
    for (const p of cornersLogPending()) {
      if (done >= 2) break
      if (enVivoAhora(p.id) || intentado(`c_${p.id}`)) continue
      try {
        const r = await fetchFixtureStats(p.id, p.homeId, p.awayId)
        const h = numv(r.stats?.[0]?.stats?.['Corner Kicks'])
        const a = numv(r.stats?.[1]?.stats?.['Corner Kicks'])
        if (h != null || a != null) { resolveCornersLog(p.id, (h ?? 0) + (a ?? 0), { h, a }); done++ }
      } catch {}
    }

    // Tiros y SOT: dato final por equipo en el historial de Live-Score
    for (const p of shotsLogPending()) {
      if (done >= 2) break
      if (enVivoAhora(p.id) || intentado(`s_${p.id}`)) continue
      try {
        const r = await fetchFixtureStats(p.id, p.homeId, p.awayId)
        const h = numv(r.stats?.[0]?.stats?.['Total Shots'])
        const a = numv(r.stats?.[1]?.stats?.['Total Shots'])
        if (h != null || a != null) { resolveShotsLog(p.id, (h ?? 0) + (a ?? 0), { h, a }); done++ }
        const sh = numv(r.stats?.[0]?.stats?.['Shots on Goal'])
        const sa = numv(r.stats?.[1]?.stats?.['Shots on Goal'])
        if (sh != null || sa != null) resolveSotLog(p.id, (sh ?? 0) + (sa ?? 0), { h: sh, a: sa })
      } catch {}
    }
    // Tarjetas: amarillas + rojas finales por equipo en el historial de LS
    for (const p of cardsLogPending()) {
      if (done >= 2) break
      if (enVivoAhora(p.id) || intentado(`crd_${p.id}`)) continue
      try {
        const r = await fetchFixtureStats(p.id, p.homeId, p.awayId)
        const g = (i, k) => numv(r.stats?.[i]?.stats?.[k])
        const tot = [g(0, 'Yellow Cards'), g(1, 'Yellow Cards'), g(0, 'Red Cards'), g(1, 'Red Cards')]
        if (tot.some(v => v != null)) {
          const hSide = (g(0, 'Yellow Cards') ?? 0) + (g(0, 'Red Cards') ?? 0)
          const aSide = (g(1, 'Yellow Cards') ?? 0) + (g(1, 'Red Cards') ?? 0)
          resolveCardsLog(p.id, tot.reduce((s, v) => s + (v ?? 0), 0), { h: hSide, a: aSide }); done++
        }
      } catch {}
    }

    for (const p of sotLogPending()) {
      if (done >= 2) break
      if (enVivoAhora(p.id) || intentado(`sot_${p.id}`)) continue
      try {
        const r = await fetchFixtureStats(p.id, p.homeId, p.awayId)
        const sh = numv(r.stats?.[0]?.stats?.['Shots on Goal'])
        const sa = numv(r.stats?.[1]?.stats?.['Shots on Goal'])
        if (sh != null || sa != null) { resolveSotLog(p.id, (sh ?? 0) + (sa ?? 0), { h: sh, a: sa }); done++ }
      } catch {}
    }

    // GK: Live-Score nunca lo trae → resolver con Sofascore por fecha
    for (const p of gkLogPending()) {
      if (done >= 2) break
      if (enVivoAhora(p.id) || intentado(`gk_${p.id}`)) continue
      try {
        const sofa = await fetchSofaSaques(p.home, 8)
        const dUtc = new Date(p.ts).toISOString().slice(0, 10)
        const dBog = new Date(p.ts - 5 * 3600_000).toISOString().slice(0, 10)
        const s = sofa.byDate[dUtc] ?? sofa.byDate[dBog]
        if (s && s.gk != null && s.gkAg != null) { resolveGkLog(p.id, s.gk + s.gkAg, { h: s.gk, a: s.gkAg }); done++ }
      } catch {}
    }
  }, [])

  useEffect(() => { loadLive().then(resolverTiPendientes) }, [loadLive, resolverTiPendientes])

  // ── Auto-llenar al seleccionar un partido (clic de nuevo = contraer) ──
  const fillFromMatch = useCallback(async (match, toggle = true) => {
    if (toggle && selectedId === match.id) {
      setSelectedId(null)
      setLiveStatsRaw(null)
      setStatsInfo('')
      prematchFor.current = null
      snapsRef.current = []
      setPreA(null); setPreB(null); setPreError(null)
      return
    }
    if (selectedId !== match.id) snapsRef.current = [] // partido nuevo → historial limpio
    setSelectedId(match.id)
    loadPrematch(match) // corre en paralelo; no bloquea las stats en vivo
    setTeamAName(match.homeTeam)
    setTeamBName(match.awayTeam)
    if (match.elapsed) setMinuto(match.elapsed)
    setGolesA(match.homeGoals ?? 0)
    setGolesB(match.awayGoals ?? 0)
    setStatsInfo('Cargando stats en vivo...')

    if (!hasLivescore()) {
      setStatsInfo('Sin proveedor de stats en vivo — llena los acumulados a mano')
      return
    }

    try {
      const res = await fetchFixtureStats(match.id, match.homeId, match.awayId, { noCache: true })
      const corners = sumStat(res.stats, 'Corner Kicks')
      const shots   = sumStat(res.stats, 'Total Shots')
      const sot     = sumStat(res.stats, 'Shots on Goal')
      const yellow  = sumStat(res.stats, 'Yellow Cards')
      const red     = sumStat(res.stats, 'Red Cards')
      const ti      = sumStat(res.stats, 'Throw Ins')
      const gk      = sumStat(res.stats, 'Goal Kicks')

      let filled = []
      if (corners != null) { setCornersAc(corners); setCornersFuente('api'); filled.push('córners') }
      else setCornersFuente('manual')
      if (shots != null)   { setTirosAc(shots); setShotsFuente('api'); filled.push('tiros') }
      else setShotsFuente('manual')
      if (sot != null)     { setSotAc(sot);         filled.push('SOT') }
      if (yellow != null || red != null) { setTarjetasAc((yellow ?? 0) + (red ?? 0)); setCardsFuente('api'); filled.push('tarjetas') }
      else setCardsFuente('manual')
      setTiAc(ti) // null si no hay dato
      setTiFuente(ti != null ? 'api' : null)
      setGkAc(gk)
      setGkFuente(gk != null ? 'api' : null)

      // Ataques peligrosos por equipo (si la API los reporta en este partido)
      const daH = res.stats?.[0]?.stats?.['Dangerous Attacks']
      const daA = res.stats?.[1]?.stats?.['Dangerous Attacks']
      setDangAtk(daH != null || daA != null ? { h: daH ?? '—', a: daA ?? '—' } : null)

      // Tablero de stats actuales por equipo
      const raw = {
        home: res.stats?.[0]?.stats ?? {},
        away: res.stats?.[1]?.stats ?? {},
        homeName: match.homeTeam,
        awayName: match.awayTeam,
      }

      // Live-Score casi nunca trae saques EN VIVO → completar con Sofascore
      let sofaSaques = false
      if (raw.home['Goal Kicks'] == null || raw.home['Throw Ins'] == null) {
        try {
          const { fetchSofaPartidoActual } = await import('../lib/sofascore')
          const sofa = await fetchSofaPartidoActual(match.homeTeam)
          if (sofa?.rows?.length && sofa.estado === 'inprogress') {
            const take = (label, key) => {
              const r = sofa.rows.find(x => x.label === label)
              if (!r) return
              const h = parseFloat(r.h); const a = parseFloat(r.a)
              if (!isNaN(h) && raw.home[key] == null) { raw.home[key] = h; sofaSaques = true }
              if (!isNaN(a) && raw.away[key] == null) { raw.away[key] = a; sofaSaques = true }
            }
            take('Saques banda', 'Throw Ins')
            take('Saques portería', 'Goal Kicks')
            take('xG', 'Expected Goals')
            take('Grandes ocasiones', 'Big Chances')
          }
        } catch {}
      }
      setLiveStatsRaw(raw)

      // Si Sofascore trajo los saques, alimentar también los acumulados totales
      if (ti == null && sofaSaques) {
        const th = parseFloat(raw.home['Throw Ins']); const ta = parseFloat(raw.away['Throw Ins'])
        if (!isNaN(th) && !isNaN(ta)) { setTiAc(th + ta); setTiFuente('sofa'); filled.push('saques banda (Sofascore)') }
      }
      if (gk == null && sofaSaques) {
        const gh = parseFloat(raw.home['Goal Kicks']); const ga = parseFloat(raw.away['Goal Kicks'])
        if (!isNaN(gh) && !isNaN(ga)) { setGkAc(gh + ga); setGkFuente('sofa'); filled.push('saques portería (Sofascore)') }
      }

      // Snapshot para el momentum (solo si avanzó el minuto)
      const min = match.elapsed ?? 0
      const pt = perTeamFromRaw(raw)
      const last = snapsRef.current[snapsRef.current.length - 1]
      if (min > 0 && (!last || min > last.min)) {
        snapsRef.current.push({ min, h: pt.h, a: pt.a })
        if (snapsRef.current.length > 30) snapsRef.current.shift()
      }

      setStatsInfo(filled.length
        ? `✓ Auto-llenado: ${filled.join(', ')}${ti != null ? ', throw-ins' : ''}`
        : 'El partido aún no reporta stats — llena los acumulados a mano')
    } catch {
      setStatsInfo('No se pudieron cargar las stats — llena los acumulados a mano')
    }
  }, [selectedId, loadPrematch])

  // ── Auto-refresh cada 60s (lista completa + partido seleccionado) ──
  useEffect(() => {
    if (!liveMatches.length && !selectedId) return
    const id = setInterval(async () => {
      const all = await loadLive()
      if (selectedId) {
        const m = all.find(x => x.id === selectedId)
        if (m) fillFromMatch(m, false)
      }
      resolverTiPendientes(all)
    }, 60_000)
    return () => clearInterval(id)
  }, [selectedId, liveMatches.length, loadLive, fillFromMatch, resolverTiPendientes])

  // Prórroga (copas/playoffs): si va más allá del 90', el partido termina al 120'
  const minutosRestantes = minuto > 90 ? Math.max(0, 120 - minuto) : Math.max(0, 90 - minuto)

  // Stats por equipo del partido en vivo (null si la API no las da)
  const perTeam = useMemo(() => perTeamFromRaw(liveStatsRaw), [liveStatsRaw])

  // ── Datos para el módulo cuantitativo de saques de banda ──
  const selMatch = liveMatches.find(m => m.id === selectedId) ?? null
  const selLeague = selMatch ? (LEAGUES.find(l => l.id === selMatch.leagueId) ?? league) : league
  const tiSnaps = useMemo(() => snapsRef.current.map(s => {
    const h = s.h?.ti; const a = s.a?.ti
    return (h != null || a != null) ? { min: s.min, ti: (h ?? 0) + (a ?? 0) } : null
  }).filter(Boolean), [liveStatsRaw]) // eslint-disable-line react-hooks/exhaustive-deps

  const gkSnaps = useMemo(() => snapsRef.current.map(s => {
    const h = s.h?.gk; const a = s.a?.gk
    return (h != null || a != null) ? { min: s.min, gk: (h ?? 0) + (a ?? 0) } : null
  }).filter(Boolean), [liveStatsRaw]) // eslint-disable-line react-hooks/exhaustive-deps

  const cornersSnaps = useMemo(() => snapsRef.current.map(s => {
    const h = s.h?.corners; const a = s.a?.corners
    return (h != null || a != null) ? { min: s.min, ch: h ?? 0, ca: a ?? 0 } : null
  }).filter(Boolean), [liveStatsRaw]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tiros bloqueados por lado (generador del córner + split coherente de tiros)
  const blkSides = useMemo(() => {
    if (!liveStatsRaw) return { h: null, a: null, total: null }
    const h = numv(liveStatsRaw.home?.['Blocked Shots'])
    const a = numv(liveStatsRaw.away?.['Blocked Shots'])
    return { h, a, total: (h != null || a != null) ? (h ?? 0) + (a ?? 0) : null }
  }, [liveStatsRaw])
  const blkTotal = blkSides.total

  // Rojas por lado (cambio estructural para los módulos cuantitativos)
  const reds = useMemo(() => {
    if (!liveStatsRaw) return null
    const h = numv(liveStatsRaw.home?.['Red Cards'])
    const a = numv(liveStatsRaw.away?.['Red Cards'])
    return (h != null || a != null) ? { h: h ?? 0, a: a ?? 0 } : null
  }, [liveStatsRaw])

  const shotsSnaps = useMemo(() => snapsRef.current.map(s => {
    const h = s.h?.shots; const a = s.a?.shots
    return (h != null || a != null) ? { min: s.min, sh: h ?? 0, sa: a ?? 0 } : null
  }).filter(Boolean), [liveStatsRaw]) // eslint-disable-line react-hooks/exhaustive-deps

  const cardsSnaps = useMemo(() => snapsRef.current.map(s => {
    const h = s.h?.cards; const a = s.a?.cards
    return (h != null || a != null) ? { min: s.min, c: (h ?? 0) + (a ?? 0) } : null
  }).filter(Boolean), [liveStatsRaw]) // eslint-disable-line react-hooks/exhaustive-deps

  // Amarillas/rojas/faltas por lado (para el módulo de tarjetas)
  const cardsSides = useMemo(() => {
    if (!liveStatsRaw) return null
    const g = (side, key) => numv(liveStatsRaw[side]?.[key])
    return {
      yH: g('home', 'Yellow Cards'), yA: g('away', 'Yellow Cards'),
      rH: g('home', 'Red Cards') ?? 0, rA: g('away', 'Red Cards') ?? 0,
      foulsH: g('home', 'Fouls'), foulsA: g('away', 'Fouls'),
    }
  }, [liveStatsRaw])

  // Tiros desviados acumulados (driver causal de los GK): tiros − a puerta.
  // Con datos de la API por equipo, o con los acumulados manuales como fallback.
  const offAcum = useMemo(() => {
    if (perTeam && (perTeam.h.shots != null || perTeam.a.shots != null)) {
      const off = side => (side.shots != null && side.sot != null) ? side.shots - side.sot : null
      const oh = off(perTeam.h); const oa = off(perTeam.a)
      if (oh != null || oa != null) return (oh ?? 0) + (oa ?? 0)
    }
    if (tirosAc != null && sotAc != null && tirosAc >= sotAc) return tirosAc - sotAc
    return null
  }, [perTeam, tirosAc, sotAc])

  // ── MOMENTUM: ¿el partido se calienta o se enfría? ──
  // Compara el ritmo reciente (ventana ~12 min) contra el ritmo promedio del
  // partido, usando ataques peligrosos (o tiros si no hay). Esto corrige la
  // extrapolación lineal ingenua: 5 tiros en 20 min NO son "1 cada 4 min para
  // siempre" — depende de cómo viene evolucionando el juego.
  const momentum = useMemo(() => {
    const snaps = snapsRef.current
    if (snaps.length < 2) return { global: 1, h: 1, a: 1, base: null }
    const last = snaps[snaps.length - 1]
    // snapshot ~12 min atrás (el más cercano)
    let past = snaps[0]
    for (const s of snaps) { if (last.min - s.min >= 8) past = s }
    const span = last.min - past.min
    if (span < 5) return { global: 1, h: 1, a: 1, base: null }

    const rate = (side) => {
      const key = last[side].da != null ? 'da' : (last[side].shots != null ? 'shots' : null)
      if (!key) return null
      const total = last[side][key]; const prev = past[side][key]
      if (total == null || prev == null || last.min <= 0) return null
      const recent = (total - prev) / span
      const avg = total / last.min
      if (avg <= 0) return null
      return { f: recent / avg, key }
    }
    const rh = rate('h'); const ra = rate('a')
    const clamp = f => Math.min(1.30, Math.max(0.75, f))
    const h = rh ? clamp(rh.f) : 1
    const a = ra ? clamp(ra.f) : 1
    const global = rh || ra ? clamp(((rh?.f ?? 1) + (ra?.f ?? 1)) / 2) : 1
    return { global, h, a, base: rh?.key ?? ra?.key ?? null, span }
  }, [liveStatsRaw]) // eslint-disable-line react-hooks/exhaustive-deps

  const calc = useMemo(() => {
    if (!teamAName.trim() || !teamBName.trim() || minuto <= 0) return null

    const goalDiff   = golesA - golesB
    const situationS = getSituationS(goalDiff)
    const tacticalK  = getTacticalK(zona)

    // Intensidad global (ataques peligrosos/min vs ritmo típico 1.1/min)
    const daTotal = dangAtk ? (parseFloat(dangAtk.h) || 0) + (parseFloat(dangAtk.a) || 0) : null
    const intensity = (daTotal && minuto >= 15)
      ? Math.min(1.20, Math.max(0.85, (daTotal / minuto) / 1.1))
      : 1

    // Drives por equipo: estado del partido × perfil prepartido × momentum propio
    const driveH = attackDrive({ diff: goalDiff,  minuto, pre: preA, preRival: preB }) * momentum.h
    const driveA = attackDrive({ diff: -goalDiff, minuto, pre: preB, preRival: preA }) * momentum.a

    // ── Proyección por equipo cuando hay dato de la API ──
    const projTeam = (acum, drive, k = 1) => {
      if (acum == null) return null
      const r = calcLiveExpected({ statAcumulada: acum, minutos: minuto, minutosRestantes, situationS: 1, tacticalK: drive * k })
      return { acum, proy: +(acum + r.lambda).toFixed(1) }
    }

    // ── Córners: NO es solo ritmo/minuto ──
    // Mezcla (a) el ritmo de córners del propio partido con (b) los córners
    // IMPLÍCITOS en la presión real: quien acumula tiros genera córners aunque
    // todavía no le hayan salido (≈0.38 córners por tiro en fútbol de élite).
    // Un equipo con 9 tiros y 1 córner está "debiendo" córners → regresión al alza.
    const projCorners = (side, drive) => {
      const c = perTeam?.[side]?.corners
      if (c == null) return null
      const rateProj = c + calcLiveExpected({ statAcumulada: c, minutos: minuto, minutosRestantes, situationS: 1, tacticalK: drive * tacticalK * intensity }).lambda
      const sh = perTeam[side].shots
      let proy = rateProj
      if (sh != null && minuto >= 20) {
        const pressureRate = (sh / minuto) * 0.38 // córners/min que implica su volumen de tiros
        const pressureProj = c + pressureRate * minutosRestantes * drive * tacticalK
        proy = rateProj * 0.55 + pressureProj * 0.45
      }
      return { acum: c, proy: +proy.toFixed(1) }
    }

    const team = perTeam ? {
      h: {
        shots:   projTeam(perTeam.h.shots,   driveH, intensity),
        sot:     projTeam(perTeam.h.sot,     driveH, intensity),
        corners: projCorners('h', driveH),
        cards:   projTeam(perTeam.h.cards,   goalDiff < 0 ? 1.08 : 1, minuto >= 60 ? 1.1 : 1),
        ti:      projTeam(perTeam.h.ti,      1, intensity),
        gk:      projTeam(perTeam.h.gk,      1, 1),
      },
      a: {
        shots:   projTeam(perTeam.a.shots,   driveA, intensity),
        sot:     projTeam(perTeam.a.sot,     driveA, intensity),
        corners: projCorners('a', driveA),
        cards:   projTeam(perTeam.a.cards,   goalDiff > 0 ? 1.08 : 1, minuto >= 60 ? 1.1 : 1),
        ti:      projTeam(perTeam.a.ti,      1, intensity),
        gk:      projTeam(perTeam.a.gk,      1, 1),
      },
    } : null

    // ── Totales: si hay per-equipo, el total = suma de las dos proyecciones
    //    (cada una con SU drive); si no, extrapolación clásica con factores globales
    const totalFrom = (key, acumTotal, fallbackK) => {
      const th = team?.h?.[key]; const ta = team?.a?.[key]
      if (th && ta) return { proy: +(th.proy + ta.proy).toFixed(1) }
      if (acumTotal == null) return null
      const r = calcLiveExpected({ statAcumulada: acumTotal, minutos: minuto, minutosRestantes, situationS, tacticalK: fallbackK })
      return { proy: +(acumTotal + r.lambda).toFixed(1) }
    }

    const corners = totalFrom('corners', cornersAc, tacticalK * intensity * momentum.global)
    const shots   = totalFrom('shots',   tirosAc,   intensity * momentum.global)
    const sot     = totalFrom('sot',     sotAc,     intensity * momentum.global)
    const cards   = totalFrom('cards',   tarjetasAc, 1)
    const ti      = totalFrom('ti',      tiAc,      intensity)

    return {
      situationS, tacticalK, intensity: +intensity.toFixed(2), daTotal,
      driveH: +driveH.toFixed(2), driveA: +driveA.toFixed(2),
      momentum,
      team,
      corners: corners ? { proy: corners.proy } : null,
      shots:   shots   ? { proy: shots.proy } : null,
      sot:     sot     ? { proy: sot.proy } : null,
      cards:   cards   ? { proy: cards.proy } : null,
      ti:      ti      ? { proy: ti.proy } : null,
    }
  }, [teamAName, teamBName, minuto, golesA, golesB, cornersAc, tirosAc, sotAc, tarjetasAc, tiAc, zona, dangAtk, perTeam, preA, preB, momentum, minutosRestantes])

  const ready = !!calc

  // ─── RECOMENDADOS EN VIVO — totales Y por equipo, solo con dato real ──────
  const liveRecs = useMemo(() => {
    if (!calc) return []
    const mkts = []
    const push = (label, proyObj, acum, step, extra, meta = {}) => {
      if (!proyObj || acum == null) return
      mkts.push({ label, proy: proyObj.proy, acum, step, extra, ...meta })
    }
    // Totales
    push('Córners',  calc.corners, cornersAc, 1, `Situation S ×${calc.situationS} por el marcador ${golesA}-${golesB}`)
    push('Tiros',    calc.shots,   tirosAc,   2, null)
    push('SOT',      calc.sot,     sotAc,     1, null)
    push('Tarjetas', calc.cards,   tarjetasAc, 1, minuto >= 60 ? 'Tramo 60-90: donde más tarjetas caen' : null)
    push('Saques banda', calc.ti,     tiAc,      2, 'Dato real en vivo de la API')
    // Por equipo (solo si la API da el dato de ese equipo)
    const tn = { h: teamAName || 'Local', a: teamBName || 'Visitante' }
    for (const side of ['h', 'a']) {
      const t = calc.team?.[side]
      if (!t) continue
      const drive = side === 'h' ? calc.driveH : calc.driveA
      const dtxt = drive > 1.04 ? `Drive ×${drive}: empujando` : drive < 0.96 ? `Drive ×${drive}: administrando` : null
      const shSide = perTeam?.[side]?.shots
      const cornPresion = shSide != null && t.corners
        ? `Proyección = ritmo de córners + presión por tiros (${shSide} tiros → córners implícitos)${dtxt ? ` · ${dtxt}` : ''}`
        : dtxt
      push(`Córners ${tn[side]}`,  t.corners, t.corners?.acum, 1, cornPresion, { side, statKey: 'corners' })
      push(`Tiros ${tn[side]}`,    t.shots,   t.shots?.acum,   1, dtxt, { side, statKey: 'shots' })
      push(`SOT ${tn[side]}`,      t.sot,     t.sot?.acum,     1, dtxt, { side, statKey: 'sot' })
      push(`Tarjetas ${tn[side]}`, t.cards,   t.cards?.acum,   1, null, { side, statKey: 'cards' })
      push(`Saques banda ${tn[side]}`, t.ti,     t.ti?.acum,      1, null, { side, statKey: 'ti' })
      push(`Saques puerta ${tn[side]}`, t.gk, t.gk?.acum,      1, null, { side, statKey: 'gk' })
    }

    // Mejor línea del mercado dentro de un rango de margen dado
    const pickLine = (m, minM, maxM) => {
      let best = null
      const c = Math.floor(m.proy) + 0.5
      for (let i = -2; i <= 2; i++) {
        const line = +(c + i * m.step).toFixed(2)
        if (line <= 0) continue
        const margin = (m.proy - line) / line
        const abs = Math.abs(margin)
        if (abs < minM || abs > maxM) continue
        const dir = margin > 0 ? 'OVER' : 'UNDER'
        if (dir === 'OVER' && m.acum > line) continue
        if (!best || abs > Math.abs(best.margin)) best = { line, dir, margin }
      }
      return best
    }

    const mkRec = (m, rec, soft) => {
      const ritmo = minuto > 0 ? m.acum / minuto : 0
      const pOver = poissonOver(m.proy, rec.line)
      const p = rec.dir === 'OVER' ? pOver : 1 - pOver
      let confidence = Math.min(90, Math.round(
        30 + (minuto / 90) * 35 + Math.min(15, Math.abs(rec.margin) * 100) + (p > 0.7 ? 8 : 0)
      ))
      if (soft) confidence = Math.min(confidence, 55)
      return {
        ...m, rec, soft, p: Math.round(p * 100), confidence, ritmo: +ritmo.toFixed(2),
        faltan: +(m.proy - m.acum).toFixed(1),
      }
    }

    // Pase estricto (margen 4-15%, el ideal)
    const recs = []
    const conRec = new Set()
    for (const m of mkts) {
      const rec = pickLine(m, 0.04, 0.15)
      if (!rec) continue
      conRec.add(m.label)
      recs.push(mkRec(m, rec, false))
    }
    // Si hay pocos picks fuertes → completar con señales débiles (margen 1.5-35%),
    // marcadas como tales. NUNCA dejar la sección vacía sin explicación.
    if (recs.length < 3) {
      for (const m of mkts) {
        if (conRec.has(m.label)) continue
        const rec = pickLine(m, 0.015, 0.35)
        if (!rec) continue
        recs.push(mkRec(m, rec, true))
      }
    }
    return recs.sort((a, b) => b.confidence - a.confidence)
  }, [calc, cornersAc, tirosAc, sotAc, tarjetasAc, tiAc, minuto, golesA, golesB, teamAName, teamBName])

  // ─── Panel de análisis (se renderiza inline debajo del partido elegido) ───
  function renderAnalysis() {
    const tn = { h: teamAName || 'Local', a: teamBName || 'Visitante' }
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-red-800/40 bg-dark-900/50 p-4">
        {statsInfo && (
          <p className={`text-xs ${statsInfo.startsWith('✓') ? 'text-green-400' : 'text-yellow-500'}`}>{statsInfo}</p>
        )}
        {dangAtk && (
          <p className="text-xs text-orange-300">⚔️ Ataques peligrosos: {teamAName} {dangAtk.h} · {teamBName} {dangAtk.a} — quien acumula más presiona el próximo córner/gol</p>
        )}
        {calc?.momentum?.base && calc.momentum.global !== 1 && (
          <p className="text-xs text-blue-300">
            📈 Momentum (últimos ~{calc.momentum.span ?? 10} min vs promedio del partido): {tn.h} ×{calc.momentum.h.toFixed(2)} · {tn.a} ×{calc.momentum.a.toFixed(2)}
            <span className="text-gray-500"> — medido con {calc.momentum.base === 'da' ? 'ataques peligrosos' : 'tiros'}; el partido {calc.momentum.global > 1.05 ? 'se está calentando 🔥' : calc.momentum.global < 0.95 ? 'se está enfriando ❄️' : 'mantiene el ritmo'}</span>
          </p>
        )}
        {selectedId && (
          <p className="text-xs text-gray-600">Marcador, minuto y stats se actualizan solos cada 60 segundos</p>
        )}

        {/* Stats actuales del partido seleccionado */}
        {liveStatsRaw && (
          <LiveStatsBoard raw={liveStatsRaw} homeName={liveStatsRaw.homeName} awayName={liveStatsRaw.awayName} minuto={minuto} />
        )}

        {/* ── OPORTUNIDADES DEL PARTIDO (ranking cross-mercado + correlación) ── */}
        {selectedId && <Oportunidades matchId={selectedId} />}

        {/* ── Módulo cuantitativo de CÓRNERS ── */}
        <CornersQuant
          minuto={minuto}
          goalDiff={golesA - golesB}
          cH={perTeam?.h?.corners} cA={perTeam?.a?.corners}
          cTotal={cornersAc}
          daTotal={dangAtk ? (parseFloat(dangAtk.h) || 0) + (parseFloat(dangAtk.a) || 0) : null}
          blkTotal={blkTotal}
          reds={reds}
          fuente={cornersFuente}
          snaps={cornersSnaps}
          preA={preA} preB={preB}
          league={selLeague}
          matchInfo={selMatch ? {
            id: selMatch.id, home: selMatch.homeTeam, away: selMatch.awayTeam,
            homeId: selMatch.homeId, awayId: selMatch.awayId, leagueId: selMatch.leagueId,
          } : null}
          homeName={teamAName} awayName={teamBName}
        />

        {/* ── Módulo cuantitativo de TIROS ── */}
        <ShotsQuant
          minuto={minuto}
          goalDiff={golesA - golesB}
          sH={perTeam?.h?.shots} sA={perTeam?.a?.shots}
          sotH={perTeam?.h?.sot} sotA={perTeam?.a?.sot}
          blkH={blkSides.h} blkA={blkSides.a}
          daTotal={dangAtk ? (parseFloat(dangAtk.h) || 0) + (parseFloat(dangAtk.a) || 0) : null}
          reds={reds}
          fuente={shotsFuente}
          snaps={shotsSnaps}
          preA={preA} preB={preB}
          matchInfo={selMatch ? {
            id: selMatch.id, home: selMatch.homeTeam, away: selMatch.awayTeam,
            homeId: selMatch.homeId, awayId: selMatch.awayId, leagueId: selMatch.leagueId,
          } : null}
          homeName={teamAName} awayName={teamBName}
        />

        {/* ── Módulo cuantitativo de TARJETAS ── */}
        <CardsQuant
          minuto={minuto}
          goalDiff={golesA - golesB}
          cH={perTeam?.h?.cards} cA={perTeam?.a?.cards}
          yH={cardsSides?.yH} yA={cardsSides?.yA}
          rH={cardsSides?.rH ?? 0} rA={cardsSides?.rA ?? 0}
          foulsH={cardsSides?.foulsH} foulsA={cardsSides?.foulsA}
          fuente={cardsFuente}
          snaps={cardsSnaps}
          preA={preA} preB={preB}
          matchInfo={selMatch ? {
            id: selMatch.id, home: selMatch.homeTeam, away: selMatch.awayTeam,
            homeId: selMatch.homeId, awayId: selMatch.awayId, leagueId: selMatch.leagueId,
          } : null}
          homeName={teamAName} awayName={teamBName}
        />

        {/* ── Módulo cuantitativo de SAQUES DE BANDA ── */}
        <TiQuant
          minuto={minuto}
          goalDiff={golesA - golesB}
          tiAc={tiAc}
          tiH={perTeam?.h?.ti} tiA={perTeam?.a?.ti}
          fuente={tiFuente}
          snaps={tiSnaps}
          preA={preA} preB={preB}
          league={selLeague}
          matchInfo={selMatch ? {
            id: selMatch.id, home: selMatch.homeTeam, away: selMatch.awayTeam,
            homeId: selMatch.homeId, awayId: selMatch.awayId, leagueId: selMatch.leagueId,
          } : null}
          homeName={teamAName} awayName={teamBName}
        />

        {/* ── Módulo cuantitativo de SAQUES DE PORTERÍA ── */}
        <GkQuant
          minuto={minuto}
          goalDiff={golesA - golesB}
          gkAc={gkAc}
          gkH={perTeam?.h?.gk} gkA={perTeam?.a?.gk}
          offAcum={offAcum}
          reds={reds}
          fuente={gkFuente}
          snaps={gkSnaps}
          preA={preA} preB={preB}
          league={selLeague}
          matchInfo={selMatch ? {
            id: selMatch.id, home: selMatch.homeTeam, away: selMatch.awayTeam,
            homeId: selMatch.homeId, awayId: selMatch.awayId, leagueId: selMatch.leagueId,
          } : null}
          homeName={teamAName} awayName={teamBName}
        />

        {/* ── Contexto: alineaciones, árbitro, estadio, clima (fuentes gratis) ── */}
        {selectedId && <ContextoPartido homeTeam={teamAName} awayTeam={teamBName} />}

        {/* ── Datos del partido (editables) — va DESPUÉS de los recomendados ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 order-1">
          <div className="card space-y-3">
            <h2 className="font-semibold text-white text-sm">Marcador y Minuto</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Equipo A (local)</label>
                <input type="text" className="input-dark w-full" placeholder="ej. Arsenal"
                  value={teamAName} onChange={e => setTeamAName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Equipo B (visitante)</label>
                <input type="text" className="input-dark w-full" placeholder="ej. Chelsea"
                  value={teamBName} onChange={e => setTeamBName(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs text-gray-400">Goles A</label>
                <input type="number" min="0" className="input-dark w-full mt-1" value={golesA} onChange={e => setGolesA(+e.target.value)} />
              </div>
              <span className="text-gray-500 text-xl mt-4">–</span>
              <div className="flex-1">
                <label className="text-xs text-gray-400">Goles B</label>
                <input type="number" min="0" className="input-dark w-full mt-1" value={golesB} onChange={e => setGolesB(+e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-400">Minuto</label>
                <input type="number" min="1" max="90" className="input-dark w-full mt-1" value={minuto} onChange={e => setMinuto(+e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400">Zona de ataque dominante</label>
              <select className="input-dark w-full mt-1" value={zona} onChange={e => setZona(e.target.value)}>
                <option value="bandas">Bandas</option>
                <option value="mixto-bandas">Mixto-Bandas</option>
                <option value="mixto">Mixto</option>
                <option value="central">Central</option>
              </select>
            </div>
          </div>

          {/* Stats acumuladas */}
          <div className="card space-y-3">
            <h2 className="font-semibold text-white text-sm">Stats Acumuladas</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Córners', cornersAc, v => { setCornersAc(v); setCornersFuente('manual') }],
                ['Tiros totales', tirosAc, setTirosAc],
                ['SOT', sotAc, setSotAc],
                ['Tarjetas', tarjetasAc, setTarjetasAc],
              ].map(([label, val, setter]) => (
                <div key={label}>
                  <label className="text-xs text-gray-400">{label}</label>
                  <input type="number" min="0" className="input-dark w-full mt-1" value={val} onChange={e => setter(+e.target.value)} />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-400">Saques de banda {tiAc == null && <span className="text-gray-600">(sin dato)</span>}</label>
                <input type="number" min="0" className="input-dark w-full mt-1" value={tiAc ?? ''}
                  placeholder="—"
                  onChange={e => { setTiAc(e.target.value === '' ? null : +e.target.value); setTiFuente('manual') }} />
              </div>
              <div>
                <label className="text-xs text-gray-400">Saques de portería {gkAc == null && <span className="text-gray-600">(sin dato)</span>}</label>
                <input type="number" min="0" className="input-dark w-full mt-1" value={gkAc ?? ''}
                  placeholder="—"
                  onChange={e => { setGkAc(e.target.value === '' ? null : +e.target.value); setGkFuente('manual') }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Prepartido (el ANTES): promedios últimos 10 + detalle por partido — al final ── */}
        {selectedId && (
          <div className="space-y-3 order-2">
            {preLoading && (
              <p className="text-xs text-blue-300">📚 Cargando prepartido (promedios de los últimos 10 por equipo)... <span className="text-gray-500">{preProgress}</span></p>
            )}
            {preError && (
              <p className="text-xs text-yellow-500">Prepartido no disponible: {preError}</p>
            )}
            {preA && preB && (
              <>
                <TeamStatsRef teamA={preA} teamB={preB} />
                <RecentResults teamA={preA} teamB={preB} />
              </>
            )}
          </div>
        )}

        {!ready && (
          <div className="card text-center text-gray-500 py-10">
            Escribe los equipos y datos del partido para ver el análisis
          </div>
        )}

        {ready && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
          <div className="space-y-5">
            {/* ── RECOMENDADOS EN VIVO — siempre visible ── */}
            <div className="rounded-2xl border-2 border-red-700/60 bg-gradient-to-b from-red-950/50 to-dark-800 p-5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="text-xl font-black text-red-300 tracking-wide">🏆 RECOMENDADOS EN VIVO — min {minuto}'</h2>
                  <span className="text-xs text-gray-500">orden: confianza · incluye mercados por equipo · solo mercados con dato real</span>
                </div>
                {liveRecs.length === 0 && (
                  <p className="text-sm text-gray-400 py-3">
                    ⚖️ Ahora mismo las proyecciones caen justo sobre las líneas — no hay desviación que aprovechar. Es información útil: <strong className="text-gray-300">no apostar también es una decisión</strong>. Se recalcula solo cada 60 segundos.
                  </p>
                )}

                {/* ── EL PICK, literal y sin rodeos ── */}
                {liveRecs[0] && (
                  <div className={`rounded-xl px-4 py-3 border-2 ${liveRecs[0].soft ? 'bg-orange-950/40 border-orange-700/60' : 'bg-green-950/50 border-green-600/70'}`}>
                    <p className="text-xs font-bold text-green-300/80 uppercase tracking-widest mb-1">🎯 Te recomiendo esta apuesta:</p>
                    <p className="text-xl font-black text-white">
                      <span className={liveRecs[0].rec.dir === 'OVER' ? 'text-green-400' : 'text-blue-400'}>
                        {liveRecs[0].rec.dir === 'OVER' ? 'MÁS' : 'MENOS'} de {liveRecs[0].rec.line}
                      </span> {liveRecs[0].label}
                      <span className="text-sm font-semibold text-gray-400 ml-2">P {liveRecs[0].p}% · Confianza {liveRecs[0].confidence}{liveRecs[0].soft ? ' · 🔸 señal débil, stake mínimo' : ''}</span>
                    </p>
                  </div>
                )}
                {liveRecs.map((r, i) => (
                  <div key={r.label}
                    className={`rounded-xl p-4 border ${i === 0 ? 'bg-red-900/30 border-red-600/60' : 'bg-dark-800/80 border-dark-600'}`}>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`text-2xl font-black w-8 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : 'text-gray-600'}`}>{i + 1}</span>
                      <span className={`text-lg font-black px-3 py-1 rounded-lg ${
                        r.rec.dir === 'OVER' ? 'bg-green-700 text-white' : 'bg-blue-700 text-white'
                      }`}>{r.rec.dir} {r.rec.line}</span>
                      <span className="text-white font-bold text-lg">{r.label}</span>
                      <div className="ml-auto flex items-center gap-3 text-sm">
                        <span className={`font-bold px-2 py-0.5 rounded ${
                          r.confidence >= 70 ? 'bg-green-800 text-green-200' :
                          r.confidence >= 55 ? 'bg-yellow-800 text-yellow-200' : 'bg-orange-900 text-orange-300'
                        }`}>Confianza {r.confidence}</span>
                        <span className="text-green-300 font-semibold">P {r.p}%</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-300 mt-2">
                      Ya van {r.acum} ({r.ritmo}/min) → proyección final {r.proy}. {r.rec.dir === 'OVER'
                        ? `Faltan ${(r.rec.line - r.acum).toFixed(1)} para pasar la línea y el ritmo proyecta ${r.faltan} más.`
                        : `El ritmo proyecta solo ${r.faltan} más — la línea ${r.rec.line} queda lejos.`}
                    </p>
                    {r.extra && <p className="text-xs text-gray-400 mt-1">• {r.extra}</p>}
                    {/* Contexto prepartido del pick: promedio propio, rival y nivel */}
                    {preA && preB && r.side && (() => {
                      const t = r.side === 'h' ? preA : preB
                      const riv = r.side === 'h' ? preB : preA
                      const SK = {
                        corners: ['corners_avg', 'corners_against_avg', 'córners'],
                        shots:   ['shots_avg', 'shots_against_avg', 'tiros'],
                        sot:     ['sot_avg', 'sot_against_avg', 'SOT'],
                        cards:   ['cards_avg', null, 'tarjetas'],
                        ti:      ['throwins_avg', 'ti_against_avg', 'saques de banda'],
                        gk:      ['goalkicks_avg', 'gk_against_avg', 'saques de portería'],
                      }[r.statKey]
                      if (!SK) return null
                      const own = t[SK[0]]; const ag = SK[1] ? riv[SK[1]] : null
                      const dif = (t.ppg ?? 1.3) - (riv.ppg ?? 1.3)
                      return (
                        <p className="text-xs text-blue-200/80 mt-1">
                          📊 {t.name} promedia <strong>{own}</strong> {SK[2]}/partido en sus últimos 10
                          {ag != null && <> · {riv.name} concede <strong>{ag}</strong> a sus rivales</>}
                          {' '}· nivel: PPG {t.ppg} vs {riv.ppg}
                          {dif <= -0.5 ? ' — rival claramente superior: le cuesta más generar' : dif >= 0.5 ? ' — rival inferior: línea más alcanzable' : ' — nivel parejo'}
                        </p>
                      )
                    })()}
                    {minuto < 30 && <p className="text-xs text-yellow-600 mt-1">⚠️ Pocos minutos jugados — el ritmo aún es poco fiable</p>}
                    {r.soft && (
                      <p className="text-xs text-orange-400 mt-1">🔸 Señal débil: el margen está fuera del rango ideal (4-15%) — si apuestas, hazlo con stake mínimo</p>
                    )}
                    {r.p > 5 && (
                      <p className="text-sm font-bold text-green-300 mt-2 bg-green-950/60 border border-green-800/50 rounded-lg px-3 py-1.5 inline-block">
                        💰 Apuesta si la cuota en vivo está entre <span className="text-white">{(1.025 / (r.p / 100)).toFixed(2)}</span> y <span className="text-white">{(1.25 / (r.p / 100)).toFixed(2)}</span>
                      </p>
                    )}
                  </div>
                ))}
            </div>

          </div>

          <div className="space-y-5">
            {/* ── Resumen proyecciones (totales y por equipo) ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-center">
              {[
                ['Córners proy.', calc.corners?.proy, cornersAc],
                ['Tiros proy.',   calc.shots?.proy,   tirosAc],
                ['SOT proy.',     calc.sot?.proy,     sotAc],
                ['Tarjetas proy.',calc.cards?.proy,   tarjetasAc],
                ...(calc.ti ? [['S. banda proy.', calc.ti.proy, tiAc]] : []),
              ].filter(([, proy]) => proy != null).map(([label, proy, acum]) => (
                <div key={label} className="card text-center bg-dark-700">
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="text-2xl font-bold text-blue-400">{proy}</p>
                  <p className="text-xs text-gray-600">actual: {acum} · restante: {+(proy - acum).toFixed(1)}</p>
                </div>
              ))}
            </div>

            {/* Desglose por equipo */}
            {calc.team && (
              <div className="card space-y-1">
                <p className="font-semibold text-white text-sm mb-2">🆚 Proyección por equipo <span className="text-gray-500 font-normal text-xs">— actual → proyectado</span></p>
                <div className="grid grid-cols-3 text-[10px] text-gray-600 uppercase tracking-wide mb-1">
                  <span className="truncate">{tn.h} <span className="text-gray-700">(drive ×{calc.driveH})</span></span>
                  <span className="text-center">Stat</span>
                  <span className="text-right truncate">{tn.a} <span className="text-gray-700">(drive ×{calc.driveA})</span></span>
                </div>
                {[
                  ['shots', 'Tiros'], ['sot', 'SOT'], ['corners', 'Córners'],
                  ['cards', 'Tarjetas'], ['ti', 'Saques banda'], ['gk', 'Saques puerta'],
                ].map(([key, label]) => {
                  const th = calc.team.h[key]; const ta = calc.team.a[key]
                  if (!th && !ta) return null
                  return (
                    <div key={key} className="grid grid-cols-3 text-xs items-center py-0.5 border-b border-dark-700/50 last:border-0">
                      <span className="font-mono text-gray-200">{th ? `${th.acum} → ` : '—'}<strong className="text-blue-400">{th?.proy ?? ''}</strong></span>
                      <span className="text-center text-gray-500">{label}</span>
                      <span className="font-mono text-right text-gray-200">{ta ? `${ta.acum} → ` : '—'}<strong className="text-blue-400">{ta?.proy ?? ''}</strong></span>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
              <span>Min. restantes: <strong className="text-white">{minutosRestantes}'</strong></span>
              <span>Situation S: <strong className={calc.situationS > 1 ? 'text-green-400' : calc.situationS < 1 ? 'text-red-400' : 'text-white'}>{calc.situationS}</strong></span>
              <span>Tactical K: <strong className="text-white">{calc.tacticalK}</strong></span>
              {calc.daTotal != null && (
                <span>Intensidad de ataque: <strong className={calc.intensity > 1.05 ? 'text-orange-400' : calc.intensity < 0.95 ? 'text-blue-400' : 'text-white'}>
                  ×{calc.intensity}</strong> <span className="text-gray-600">({calc.daTotal} at. peligrosos en {minuto}')</span>
                </span>
              )}
            </div>

            {/* ── Recomendaciones por mercado (totales) ── */}
            <div className="card space-y-5">
              <h2 className="font-bold text-white border-b border-dark-600 pb-2 text-sm tracking-wide uppercase">Recomendaciones En Vivo</h2>
              {calc.corners && <LiveMarket label="Córners"  acum={cornersAc}  projected={calc.corners.proy} lines={[7.5, 8.5, 9.5, 10.5, 11.5]} />}
              {calc.shots && <LiveMarket label="Tiros"    acum={tirosAc}    projected={calc.shots.proy}   lines={[19.5, 21.5, 23.5, 25.5, 27.5]} />}
              {calc.sot && <LiveMarket label="SOT"      acum={sotAc}      projected={calc.sot.proy}     lines={[6.5, 7.5, 8.5, 9.5, 10.5]} />}
              {calc.cards && <LiveMarket label="Tarjetas" acum={tarjetasAc} projected={calc.cards.proy}   lines={[1.5, 2.5, 3.5, 4.5, 5.5]} />}
              {calc.ti && (
                <LiveMarket label="Saques banda" acum={tiAc} projected={calc.ti.proy} lines={[28.5, 32.5, 36.5, 40.5, 44.5]} />
              )}
            </div>
          </div>
          </div>
        )}
      </div>
    )
  }

  // Agrupar partidos en vivo por liga
  const grouped = Object.entries(liveMatches.reduce((acc, m) => {
    (acc[m.leagueName] = acc[m.leagueName] ?? []).push(m)
    return acc
  }, {}))

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <h1 className="text-2xl font-bold text-white">Análisis En Vivo — {vista === 'mis' ? '⭐ Mis Ligas' : '🌍 Las demás'}</h1>
        </div>
        <button onClick={loadLive} disabled={loadingLive}
          className="text-xs px-3 py-1.5 rounded bg-dark-700 text-gray-300 hover:bg-dark-600 transition-colors disabled:opacity-50">
          {loadingLive ? '⏳' : '🔄'} Actualizar
        </button>
      </div>

      {/* Pestañas: mis ligas vs todas las demás de la app */}
      <div className="flex items-center gap-2 -mt-2">
        <div className="flex rounded-lg overflow-hidden border border-dark-500">
          <button onClick={() => { setVista('mis'); setSelectedId(null) }}
            className={`px-3 py-1.5 text-xs font-medium ${vista === 'mis' ? 'bg-red-700 text-white' : 'bg-dark-700 text-gray-400'}`}>
            ⭐ Mis ligas ({misLigas.length})
          </button>
          <button onClick={() => { setVista('otras'); setSelectedId(null) }}
            className={`px-3 py-1.5 text-xs font-medium ${vista === 'otras' ? 'bg-red-700 text-white' : 'bg-dark-700 text-gray-400'}`}>
            🌍 Las demás ({LEAGUES.filter(l => !misLigas.includes(l.id)).length})
          </button>
        </div>
      </div>
      <p className="text-gray-400 text-xs -mt-2">
        {vista === 'mis'
          ? `Partidos en curso de tus ${misLigas.length} ligas seguidas (las eliges en Fixture → ⚙️ Elegir ligas)`
          : 'Partidos en curso del RESTO de ligas de la app (feed global, 1 sola llamada — no gasta el trial)'}
        {' '}· toca un partido para analizarlo ahí mismo, tócalo de nuevo para contraerlo
      </p>

      {liveError && (
        <p className="text-xs text-red-400">{liveError}</p>
      )}

      {loadingLive && !liveMatches.length && (
        <p className="text-sm text-gray-500 py-6 text-center">Buscando partidos en vivo en {misLigas.length} ligas...</p>
      )}

      {!loadingLive && liveMatches.length === 0 && !liveError && (
        <div className="card text-center py-8">
          <p className="text-sm text-gray-500">
            No hay partidos en juego ahora en tus ligas seguidas.
          </p>
          <p className="text-xs text-gray-600 mt-1">Agrega más ligas en Fixture → ⚙️ Elegir ligas, o usa el modo manual abajo.</p>
        </div>
      )}

      {/* ── Partidos agrupados por competición, plegables ── */}
      {grouped.map(([ligaName, items]) => {
        const cerrado = !!closedGroups[ligaName]
        return (
          <div key={ligaName} className="space-y-2">
            <button onClick={() => toggleGroup(ligaName)}
              className="w-full flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-red-300 hover:text-white bg-dark-800/60 border border-red-900/40 rounded-lg px-3 py-2 transition-colors">
              <span>{cerrado ? '▸' : '▾'}</span>
              <span>{items[0].leagueFlag} {ligaName}</span>
              <span className="ml-auto bg-red-600 text-white rounded-full px-1.5 py-0.5 font-bold normal-case">{items.length}</span>
            </button>
            {!cerrado && items.map(m => (
              <div key={m.id} className="space-y-2">
                <button
                  onClick={() => fillFromMatch(m)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                    selectedId === m.id
                      ? 'border-red-600 bg-red-900/20'
                      : 'border-dark-600 bg-dark-800 hover:border-red-800'
                  }`}
                >
                  <span className="text-xs font-bold text-red-400 animate-pulse w-10 shrink-0">
                    {m.status === 'HT' ? 'HT' : `${m.elapsed ?? '?'}'`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="text-white text-sm font-medium truncate">{m.homeTeam}</span>
                      <span className="text-white font-bold">{m.homeGoals ?? 0}</span>
                    </div>
                    <div className="flex justify-between items-center mt-0.5">
                      <span className="text-gray-300 text-sm truncate">{m.awayTeam}</span>
                      <span className="text-white font-bold">{m.awayGoals ?? 0}</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">
                    {selectedId === m.id ? '▴ Contraer' : 'Analizar ▾'}
                  </span>
                </button>

                {/* Análisis inline debajo del partido elegido */}
                {selectedId === m.id && renderAnalysis()}
              </div>
            ))}
          </div>
        )
      })}

      {/* ── Modo manual (partido que no está en la lista) ── */}
      <div className="pt-2">
        <button onClick={() => { setManualOpen(o => !o); setSelectedId(null); setLiveStatsRaw(null); setStatsInfo('') }}
          className="text-xs px-3 py-1.5 rounded-lg bg-dark-700 text-gray-400 hover:text-white border border-dark-500">
          {manualOpen ? '▴ Cerrar modo manual' : '✍️ Modo manual — analizar un partido a mano'}
        </button>
        {manualOpen && !selectedId && (
          <div className="mt-3">{renderAnalysis()}</div>
        )}
      </div>
    </div>
  )
}
