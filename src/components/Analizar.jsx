import { useState, useMemo, useEffect, useCallback } from 'react'
import { TEAMS, SEDES, MATCHES } from '../lib/teams'
import { calcExpectedCorners, calcExpectedShots, altitudeCorrection, poissonOver } from '../lib/engine'
import {
  getJornadaMods, getDescansoMods, getMotivacionMods,
  getContextoMods, getMotivacionCombo, getMotivacionConfidenceDelta,
  getVolumeAlert, applyMods, DEFAULT_MODS,
} from '../lib/context'
import { fetchAllOdds, calcLineEV, findClosestLine } from '../lib/odds'
import ContextPanel from './ContextPanel'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function mulMod(a, b) {
  return {
    shots:   +(a.shots   * b.shots).toFixed(4),
    sot:     +(a.sot     * b.sot).toFixed(4),
    corners: +(a.corners * b.corners).toFixed(4),
    cards:   +(a.cards   * b.cards).toFixed(4),
    goals:   +(a.goals   * b.goals).toFixed(4),
  }
}

function recommend(expected, line) {
  const m = (expected - line) / line
  if (m > 0.08)  return { dir: 'OVER',  conf: 'alta',  icon: '✅', pct: Math.round(m * 100) }
  if (m > 0.03)  return { dir: 'OVER',  conf: 'media', icon: '⚠️', pct: Math.round(m * 100) }
  if (m < -0.08) return { dir: 'UNDER', conf: 'alta',  icon: '✅', pct: Math.round(m * 100) }
  if (m < -0.03) return { dir: 'UNDER', conf: 'media', icon: '⚠️', pct: Math.round(m * 100) }
  return { dir: null, conf: null, icon: '❌', pct: Math.round(m * 100) }
}

const EV_COLORS = {
  alto:      'text-green-400',
  positivo:  'text-green-300',
  marginal:  'text-yellow-400',
  sin_valor: 'text-red-400',
}
const EV_LABELS = {
  alto:      '✅ VALOR ALTO',
  positivo:  '⚠️ VALOR POSITIVO',
  marginal:  '〰️ MARGINAL',
  sin_valor: '❌ SIN VALOR',
}

// ─── ModBadge — muestra los factores aplicados ────────────────────────────────
function ModBadge({ label, value }) {
  const isNeutral = Math.abs(value - 1) < 0.005
  const isUp = value > 1
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-mono ${
      isNeutral ? 'text-gray-600' : isUp ? 'text-green-400' : 'text-red-400'
    }`}>
      {label}: ×{value.toFixed(2)}
    </span>
  )
}

// ─── ModBreakdown — desglose de modificadores ─────────────────────────────────
function ModBreakdown({ base, adj, modsA, modsB, statKey }) {
  const delta = adj - base
  const pct = base > 0 ? Math.round((delta / base) * 100) : 0
  return (
    <p className="text-xs text-gray-600 mt-1">
      Base: {base.toFixed(1)} →{' '}
      <ModBadge label="ModA" value={modsA[statKey]} />
      <ModBadge label="ModB" value={modsB[statKey]} />
      {' '}→ <span className={`font-bold ${delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-gray-500'}`}>
        {adj.toFixed(1)} ({pct > 0 ? '+' : ''}{pct}%)
      </span>
    </p>
  )
}

// ─── MarketRow — una línea con recomendación + EV ────────────────────────────
function MarketRow({ expected, line, oddsLine, marketKey, topPicks, addTopPick }) {
  const { dir, conf, icon, pct } = recommend(expected, line)
  const ev = oddsLine?.over ? calcLineEV(expected, line, oddsLine.over) : null

  useEffect(() => {
    if (ev && ev.verdict !== 'sin_valor' && dir) {
      addTopPick?.({ marketKey, line, dir, conf, ev, cuota: oddsLine?.over })
    }
  }, [ev?.ev])

  return (
    <div className="grid grid-cols-12 gap-1 text-xs py-1 border-b border-dark-700 last:border-0 items-center">
      <span className="col-span-2 text-gray-500">O/U {line}</span>
      <span className={`col-span-3 ${conf === 'alta' ? 'text-green-400' : conf === 'media' ? 'text-yellow-400' : 'text-gray-500'}`}>
        {icon} {dir ?? 'Sin rec.'} {dir ? `${pct > 0 ? '+' : ''}${pct}%` : ''}
      </span>
      {oddsLine ? (
        <>
          <span className="col-span-2 text-center text-gray-300">{oddsLine.over?.toFixed(2) ?? '—'}</span>
          <span className="col-span-2 text-center text-gray-400">{ev?.pOver ?? '—'}%</span>
          <span className={`col-span-3 text-center font-semibold ${ev ? EV_COLORS[ev.verdict] : 'text-gray-600'}`}>
            {ev ? `${ev.ev > 0 ? '+' : ''}${ev.ev}% ${EV_LABELS[ev.verdict]}` : '—'}
          </span>
        </>
      ) : (
        <span className="col-span-7 text-gray-700 text-xs">sin cuota BetWinner</span>
      )}
    </div>
  )
}

function MarketHeader({ hasOdds }) {
  return (
    <div className="grid grid-cols-12 gap-1 text-xs text-gray-500 pb-1 border-b border-dark-600 uppercase tracking-wide">
      <span className="col-span-2">Línea</span>
      <span className="col-span-3">Motor</span>
      {hasOdds && <>
        <span className="col-span-2 text-center">Cuota BW</span>
        <span className="col-span-2 text-center">P_mod</span>
        <span className="col-span-3 text-center">EV</span>
      </>}
    </div>
  )
}

// ─── MarketTable ──────────────────────────────────────────────────────────────
function MarketTable({ label, expected, base, modsA, modsB, statKey, lines, odds, marketKey, addTopPick }) {
  const oddsLines = odds?.[marketKey] ?? []
  const hasOdds   = oddsLines.length > 0

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-white">{label}</p>
      {base !== undefined && modsA && (
        <ModBreakdown base={base} adj={expected} modsA={modsA} modsB={modsB} statKey={statKey} />
      )}
      <MarketHeader hasOdds={hasOdds} />
      {lines.map(line => {
        const closest = hasOdds ? findClosestLine(oddsLines, line) : null
        return (
          <MarketRow
            key={line}
            expected={expected}
            line={line}
            oddsLine={closest}
            marketKey={`${marketKey}_${line}`}
            addTopPick={addTopPick}
          />
        )
      })}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="card space-y-5">
      <h2 className="font-bold text-white border-b border-dark-600 pb-2 text-sm tracking-wide uppercase">{title}</h2>
      {children}
    </div>
  )
}

// ─── Default context state ────────────────────────────────────────────────────
const DEFAULT_CTX = {
  jornada:  'J1',
  descansoA: 5,
  descansoB: 5,
  viajeA: false,
  viajeB: false,
  motA: 'cualquier_result',
  motB: 'cualquier_result',
  checks: {},
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Analizar() {
  const [teamAId, setTeamAId] = useState('')
  const [teamBId, setTeamBId] = useState('')
  const [sedeId,  setSedeId]  = useState('')
  const [ctx,     setCtx]     = useState(DEFAULT_CTX)
  const [ctxOpen, setCtxOpen] = useState(false)
  const [odds,    setOdds]    = useState(null)
  const [oddsStatus, setOddsStatus] = useState('idle') // idle | loading | ok | error
  const [topPicks, setTopPicks] = useState([])

  const teamA = TEAMS.find(t => t.id === teamAId)
  const teamB = TEAMS.find(t => t.id === teamBId)

  const matchInfo = useMemo(() => {
    if (!teamAId || !teamBId) return null
    return MATCHES.find(m =>
      (m.teamA === teamAId && m.teamB === teamBId) ||
      (m.teamA === teamBId && m.teamB === teamAId)
    ) || null
  }, [teamAId, teamBId])

  const sameGroup = matchInfo != null

  useEffect(() => {
    if (matchInfo) setSedeId(matchInfo.ciudad)
  }, [matchInfo])

  // Auto-detect jornada desde fecha
  useEffect(() => {
    if (!matchInfo) return
    const d = new Date(matchInfo.date)
    const day = d.getUTCDate()
    if      (day <= 17) setCtx(c => ({ ...c, jornada: 'J1' }))
    else if (day <= 23) setCtx(c => ({ ...c, jornada: 'J2' }))
    else                setCtx(c => ({ ...c, jornada: 'J3' }))
  }, [matchInfo])

  const sede   = SEDES.find(s => s.ciudad === sedeId)
  const altMod = sede ? altitudeCorrection(sede.altitud) : 1

  // ─── Calcular modificadores situacionales ──────────────────────────────────
  const { modsA, modsB, comboAlerts, confidenceDelta } = useMemo(() => {
    const jornadaMod  = getJornadaMods(ctx.jornada)
    const descansoA   = getDescansoMods(ctx.descansoA, ctx.viajeA)
    const descansoB   = getDescansoMods(ctx.descansoB, ctx.viajeB)
    const motivA      = getMotivacionMods(ctx.motA)
    const motivB      = getMotivacionMods(ctx.motB)
    const contextoMod = getContextoMods(ctx.checks ?? {})
    const { extraA, extraB, extraGlobal, alerts } = getMotivacionCombo(ctx.motA, ctx.motB)
    const confDelta   = getMotivacionConfidenceDelta(ctx.motA, ctx.motB)

    const mA = applyMods(DEFAULT_MODS, jornadaMod, descansoA, motivA, extraA, extraGlobal, contextoMod)
    const mB = applyMods(DEFAULT_MODS, jornadaMod, descansoB, motivB, extraB, extraGlobal, contextoMod)

    return { modsA: mA, modsB: mB, comboAlerts: alerts, confidenceDelta: confDelta }
  }, [ctx])

  // ─── Calcular expected base y ajustado ────────────────────────────────────
  const calc = useMemo(() => {
    if (!teamA || !teamB) return null

    const shots   = calcExpectedShots(teamA, teamB, altMod)
    const corners = calcExpectedCorners(teamA, teamB)

    // Base por equipo
    const base = {
      shotsA:  shots.expShotsA,
      shotsB:  shots.expShotsB,
      sotA:    shots.expSOTA,
      sotB:    shots.expSOTB,
      cornA:   corners.expA,
      cornB:   corners.expB,
      goalsA:  +(teamA.gf_avg * altMod).toFixed(2),
      goalsB:  +(teamB.gf_avg * altMod).toFixed(2),
      cardsA:  +teamA.cards_avg.toFixed(2),
      cardsB:  +teamB.cards_avg.toFixed(2),
      shots1hA: +(teamA.shots_1h * altMod).toFixed(2),
      shots1hB: +(teamB.shots_1h * altMod).toFixed(2),
      shots2hA: +(teamA.shots_2h * altMod).toFixed(2),
      shots2hB: +(teamB.shots_2h * altMod).toFixed(2),
      sot1hA:  +teamA.sot_1h.toFixed(2),
      sot1hB:  +teamB.sot_1h.toFixed(2),
      corn1hA: +teamA.corners_1h.toFixed(2),
      corn1hB: +teamB.corners_1h.toFixed(2),
      corn2hA: +teamA.corners_2h.toFixed(2),
      corn2hB: +teamB.corners_2h.toFixed(2),
      goals1hA: +teamA.goals_1h.toFixed(2),
      goals1hB: +teamB.goals_1h.toFixed(2),
      goals2hA: +teamA.goals_2h.toFixed(2),
      goals2hB: +teamB.goals_2h.toFixed(2),
      cards1hA: +teamA.cards_1h.toFixed(2),
      cards1hB: +teamB.cards_1h.toFixed(2),
      gkA:     +teamA.goalkicks_avg.toFixed(2),
      gkB:     +teamB.goalkicks_avg.toFixed(2),
      tiA:     +teamA.throwins_avg.toFixed(2),
      tiB:     +teamB.throwins_avg.toFixed(2),
    }

    // Ajustados × modificadores
    const adj = {
      shotsA:   +(base.shotsA  * modsA.shots).toFixed(2),
      shotsB:   +(base.shotsB  * modsB.shots).toFixed(2),
      sotA:     +(base.sotA    * modsA.sot).toFixed(2),
      sotB:     +(base.sotB    * modsB.sot).toFixed(2),
      cornA:    +(base.cornA   * modsA.corners).toFixed(2),
      cornB:    +(base.cornB   * modsB.corners).toFixed(2),
      goalsA:   +(base.goalsA  * modsA.goals).toFixed(2),
      goalsB:   +(base.goalsB  * modsB.goals).toFixed(2),
      cardsA:   +(base.cardsA  * modsA.cards).toFixed(2),
      cardsB:   +(base.cardsB  * modsB.cards).toFixed(2),
      shots1hA: +(base.shots1hA * modsA.shots).toFixed(2),
      shots1hB: +(base.shots1hB * modsB.shots).toFixed(2),
      shots2hA: +(base.shots2hA * modsA.shots).toFixed(2),
      shots2hB: +(base.shots2hB * modsB.shots).toFixed(2),
      sot1hA:  +(base.sot1hA  * modsA.sot).toFixed(2),
      sot1hB:  +(base.sot1hB  * modsB.sot).toFixed(2),
      corn1hA: +(base.corn1hA * modsA.corners).toFixed(2),
      corn1hB: +(base.corn1hB * modsB.corners).toFixed(2),
      corn2hA: +(base.corn2hA * modsA.corners).toFixed(2),
      corn2hB: +(base.corn2hB * modsB.corners).toFixed(2),
      goals1hA: +(base.goals1hA * modsA.goals).toFixed(2),
      goals1hB: +(base.goals1hB * modsB.goals).toFixed(2),
      goals2hA: +(base.goals2hA * modsA.goals).toFixed(2),
      goals2hB: +(base.goals2hB * modsB.goals).toFixed(2),
      cards1hA: +(base.cards1hA * modsA.cards).toFixed(2),
      cards1hB: +(base.cards1hB * modsB.cards).toFixed(2),
      gkA:     +(base.gkA * ((modsA.shots + modsA.corners) / 2)).toFixed(2),
      gkB:     +(base.gkB * ((modsB.shots + modsB.corners) / 2)).toFixed(2),
      tiA:     +(base.tiA * modsA.shots).toFixed(2),
      tiB:     +(base.tiB * modsB.shots).toFixed(2),
    }

    // Totales ajustados
    const t = {
      shots:    +(adj.shotsA  + adj.shotsB).toFixed(2),
      sot:      +(adj.sotA    + adj.sotB).toFixed(2),
      corners:  +(adj.cornA   + adj.cornB).toFixed(2),
      goals:    +(adj.goalsA  + adj.goalsB).toFixed(2),
      cards:    +(adj.cardsA  + adj.cardsB).toFixed(2),
      shots1h:  +(adj.shots1hA + adj.shots1hB).toFixed(2),
      shots2h:  +(adj.shots2hA + adj.shots2hB).toFixed(2),
      sot1h:    +(adj.sot1hA  + adj.sot1hB).toFixed(2),
      corn1h:   +(adj.corn1hA + adj.corn1hB).toFixed(2),
      corn2h:   +(adj.corn2hA + adj.corn2hB).toFixed(2),
      goals1h:  +(adj.goals1hA + adj.goals1hB).toFixed(2),
      goals2h:  +(adj.goals2hA + adj.goals2hB).toFixed(2),
      cards1h:  +(adj.cards1hA + adj.cards1hB).toFixed(2),
      gk:       +(adj.gkA + adj.gkB).toFixed(2),
      ti:       +(adj.tiA + adj.tiB).toFixed(2),
    }

    // Totales base (para desglose)
    const bTot = {
      shots:   +(base.shotsA + base.shotsB).toFixed(2),
      corners: +(base.cornA  + base.cornB).toFixed(2),
    }

    const volumeAlert = getVolumeAlert(bTot.shots, t.shots)

    return { base, adj, t, bTot, volumeAlert }
  }, [teamA, teamB, altMod, modsA, modsB])

  // ─── Fetch odds ──────────────────────────────────────────────────────────
  const fetchOdds = useCallback(async () => {
    if (!teamA || !teamB) return
    setOddsStatus('loading')
    setTopPicks([])
    try {
      const data = await fetchAllOdds(teamA.name, teamB.name)
      setOdds(data)
      setOddsStatus(data ? 'ok' : 'error')
    } catch {
      setOddsStatus('error')
    }
  }, [teamA, teamB])

  // Registro de top picks (se popula desde MarketRow via addTopPick)
  const [picksMap, setPicksMap] = useState({})
  const addTopPick = useCallback((pick) => {
    setPicksMap(m => ({ ...m, [`${pick.marketKey}`]: pick }))
  }, [])

  useEffect(() => { setPicksMap({}) }, [teamAId, teamBId, ctx])

  const sortedTopPicks = useMemo(() =>
    Object.values(picksMap)
      .filter(p => p.ev?.verdict !== 'sin_valor')
      .sort((a, b) => b.ev.ev - a.ev.ev)
      .slice(0, 10)
  , [picksMap])

  const ready = !!calc

  return (
    <div className="p-6 space-y-6 max-w-5xl">

      {/* ── Selección de equipos ── */}
      <div className="card">
        <h1 className="text-xl font-bold text-white mb-4">Analizador de Partido</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Equipo Local</label>
            <select className="input-dark w-full" value={teamAId}
              onChange={e => { setTeamAId(e.target.value); setTeamBId(''); setOdds(null); setOddsStatus('idle') }}>
              <option value="">Seleccionar...</option>
              {TEAMS.map(t => <option key={t.id} value={t.id}>{t.name} ({t.group})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Equipo Visitante</label>
            <select className="input-dark w-full" value={teamBId}
              onChange={e => { setTeamBId(e.target.value); setOdds(null); setOddsStatus('idle') }}>
              <option value="">Seleccionar...</option>
              {TEAMS.filter(t => t.id !== teamAId).map(t => <option key={t.id} value={t.id}>{t.name} ({t.group})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">
              Sede {matchInfo ? <span className="text-green-500">(auto)</span> : ''}
            </label>
            <select className="input-dark w-full" value={sedeId} onChange={e => setSedeId(e.target.value)}>
              <option value="">Sin sede</option>
              {SEDES.map(s => <option key={s.ciudad} value={s.ciudad}>{s.ciudad} — {s.estadio}{s.altitud > 1800 ? ' ⛰️' : ''}</option>)}
            </select>
          </div>
        </div>
        {matchInfo && (
          <div className="mt-3 text-xs text-gray-400 flex gap-4 flex-wrap">
            <span>📅 {matchInfo.date}</span>
            <span>📍 {sede?.estadio || matchInfo.ciudad}</span>
            <span>🏆 Grupo {matchInfo.group}</span>
            {sede?.altitud > 1800 && <span className="text-yellow-400">⛰️ Altitud {sede.altitud}m — corrección ×{altMod}</span>}
          </div>
        )}
      </div>

      {/* ── Panel de Contexto Situacional ── */}
      {ready && (
        <div className="card border border-dark-600">
          <button
            onClick={() => setCtxOpen(o => !o)}
            className="w-full flex items-center justify-between text-left"
          >
            <span className="font-semibold text-white text-sm">⚙️ Contexto del partido — ajusta el análisis</span>
            <span className="text-gray-400 text-lg">{ctxOpen ? '▲' : '▼'}</span>
          </button>

          {ctxOpen && (
            <div className="mt-4 border-t border-dark-600 pt-4">
              <ContextPanel
                ctx={ctx}
                onChange={setCtx}
                teamAName={teamA?.name}
                teamBName={teamB?.name}
                sameGroup={sameGroup}
              />
            </div>
          )}

          {/* Resumen de mods siempre visible */}
          {!ctxOpen && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              <span>Jornada: <strong className="text-white">{ctx.jornada}</strong></span>
              <span>Descanso {teamA?.name}: <strong className="text-white">{ctx.descansoA}d</strong></span>
              <span>Descanso {teamB?.name}: <strong className="text-white">{ctx.descansoB}d</strong></span>
              <span>Mot.Local: <strong className="text-white">{ctx.motA?.replace('_', ' ')}</strong></span>
              <span>Mot.Visit: <strong className="text-white">{ctx.motB?.replace('_', ' ')}</strong></span>
            </div>
          )}
        </div>
      )}

      {!ready && (
        <div className="card text-center text-gray-500 py-12">
          Selecciona los dos equipos para ver el análisis completo
        </div>
      )}

      {ready && (
        <>
          {/* ── Alertas de combinación motivacional ── */}
          {comboAlerts.map((a, i) => (
            <div key={i} className={`rounded-lg px-4 py-3 text-sm font-medium ${
              a.type === 'success' ? 'bg-green-900/40 text-green-300 border border-green-700' :
              a.type === 'danger'  ? 'bg-red-900/40  text-red-300  border border-red-700'   :
              a.type === 'warning' ? 'bg-yellow-900/40 text-yellow-300 border border-yellow-700' :
                                     'bg-blue-900/40 text-blue-300 border border-blue-700'
            }`}>{a.msg}</div>
          ))}
          {calc.volumeAlert && (
            <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
              calc.volumeAlert.type === 'success'
                ? 'bg-green-900/40 text-green-300 border border-green-700'
                : 'bg-yellow-900/40 text-yellow-300 border border-yellow-700'
            }`}>{calc.volumeAlert.msg}</div>
          )}

          {/* ── Resumen Expected ── */}
          <div className="card bg-dark-700">
            <h2 className="text-xs text-gray-400 uppercase tracking-wide mb-3">
              Expected Ajustado — {teamA.name} vs {teamB.name}
              {confidenceDelta !== 0 && (
                <span className={`ml-3 font-bold ${confidenceDelta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  Confianza: {confidenceDelta > 0 ? '+' : ''}{confidenceDelta} pts
                </span>
              )}
            </h2>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3 text-center">
              {[
                ['Tiros',     calc.t.shots],
                ['SOT',       calc.t.sot],
                ['Córners',   calc.t.corners],
                ['Goles',     calc.t.goals],
                ['Tarjetas',  calc.t.cards],
              ].map(([label, val]) => (
                <div key={label} className="bg-dark-800 rounded-lg p-2">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-lg font-bold text-green-400">{val}</p>
                </div>
              ))}
            </div>
            {teamA.est && <p className="text-xs text-yellow-600 mt-2">⚠️ {teamA.name}: datos estimados</p>}
            {teamB.est && <p className="text-xs text-yellow-600 mt-1">⚠️ {teamB.name}: datos estimados</p>}
          </div>

          {/* ── Botón fetch odds ── */}
          <div className="flex items-center gap-4">
            <button
              onClick={fetchOdds}
              disabled={oddsStatus === 'loading'}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-800 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {oddsStatus === 'loading' ? '⏳ Buscando cuotas...' : '🔄 Buscar cuotas BetWinner'}
            </button>
            {oddsStatus === 'ok' && odds && (
              <span className="text-xs text-green-400">
                ✓ Cuotas de {odds.source?.join(' + ')} — {new Date(odds.extraido_en).toLocaleTimeString()}
              </span>
            )}
            {oddsStatus === 'error' && (
              <span className="text-xs text-red-400">No se pudo conectar a BetWinner. Revisa manualmente.</span>
            )}
          </div>

          {/* ── Top Picks ── */}
          {sortedTopPicks.length > 0 && (
            <div className="card bg-dark-700 border border-green-800">
              <h2 className="font-bold text-white text-sm mb-3">⚡ Top Picks por EV — {teamA.name} vs {teamB.name}</h2>
              <div className="space-y-2">
                {sortedTopPicks.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <span className="text-gray-500 w-4">{i + 1}.</span>
                    <span className="text-white font-medium flex-1">{p.marketKey.replace(/_/g, ' ')}</span>
                    <span className={p.conf === 'alta' ? 'text-green-400' : 'text-yellow-400'}>{p.dir}</span>
                    <span className="text-gray-300">Cuota {p.cuota?.toFixed(2)}</span>
                    <span className={`font-bold ${EV_COLORS[p.ev.verdict]}`}>EV +{p.ev.ev}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 1. TIROS ── */}
          <Section title="Tiros — Partido Completo">
            <MarketTable label="Tiros Totales" expected={calc.t.shots}
              base={calc.bTot.shots} modsA={modsA} modsB={modsB} statKey="shots"
              lines={[19.5, 21.5, 23.5, 25.5, 27.5]}
              odds={odds} marketKey="tiros_totales" addTopPick={addTopPick} />
            <MarketTable label="SOT Totales" expected={calc.t.sot}
              lines={[6.5, 7.5, 8.5, 9.5, 10.5]}
              odds={odds} marketKey="sot_totales" addTopPick={addTopPick} />
          </Section>

          {/* ── 2. TIROS POR EQUIPO ── */}
          <Section title="Tiros — Por Equipo">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MarketTable label={`Tiros ${teamA.name}`} expected={calc.adj.shotsA}
                lines={[4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5]}
                odds={odds} marketKey="tiros_local" addTopPick={addTopPick} />
              <MarketTable label={`Tiros ${teamB.name}`} expected={calc.adj.shotsB}
                lines={[4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5]}
                odds={odds} marketKey="tiros_visita" addTopPick={addTopPick} />
            </div>
          </Section>

          {/* ── 3. TIROS POR TIEMPO ── */}
          <Section title="Tiros — Por Tiempo">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MarketTable label="Tiros Totales 1H" expected={calc.t.shots1h}
                lines={[5.5, 7.5, 9.5, 11.5, 13.5]}
                odds={odds} marketKey="tiros_1h" addTopPick={addTopPick} />
              <MarketTable label="Tiros Totales 2H" expected={calc.t.shots2h}
                lines={[5.5, 7.5, 9.5, 11.5, 13.5]}
                odds={odds} marketKey="tiros_2h" addTopPick={addTopPick} />
              <MarketTable label="SOT 1H" expected={calc.t.sot1h}
                lines={[2.5, 3.5, 4.5, 5.5]}
                odds={odds} marketKey="sot_1h" addTopPick={addTopPick} />
              <MarketTable label={`Tiros ${teamA.name} 1H`} expected={calc.adj.shots1hA}
                lines={[2.5, 3.5, 4.5, 5.5, 6.5, 7.5]}
                odds={odds} marketKey="tiros_local_1h" addTopPick={addTopPick} />
              <MarketTable label={`Tiros ${teamB.name} 1H`} expected={calc.adj.shots1hB}
                lines={[2.5, 3.5, 4.5, 5.5, 6.5, 7.5]}
                odds={odds} marketKey="tiros_visita_1h" addTopPick={addTopPick} />
            </div>
          </Section>

          {/* ── 4. CÓRNERS ── */}
          <Section title="Córners">
            <MarketTable label="Córners Totales" expected={calc.t.corners}
              base={calc.bTot.corners} modsA={modsA} modsB={modsB} statKey="corners"
              lines={[7.5, 8.5, 9.5, 10.5, 11.5]}
              odds={odds} marketKey="corners_totales" addTopPick={addTopPick} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MarketTable label="Córners 1H" expected={calc.t.corn1h}
                lines={[3.5, 4.5, 5.5]}
                odds={odds} marketKey="corners_1h" addTopPick={addTopPick} />
              <MarketTable label="Córners 2H" expected={calc.t.corn2h}
                lines={[4.5, 5.5, 6.5]}
                odds={odds} marketKey="corners_2h" addTopPick={addTopPick} />
              <MarketTable label={`Córners ${teamA.name}`} expected={calc.adj.cornA}
                lines={[3.5, 4.5, 5.5, 6.5]}
                odds={odds} marketKey="corners_local" addTopPick={addTopPick} />
              <MarketTable label={`Córners ${teamB.name}`} expected={calc.adj.cornB}
                lines={[3.5, 4.5, 5.5, 6.5]}
                odds={odds} marketKey="corners_visita" addTopPick={addTopPick} />
            </div>
          </Section>

          {/* ── 5. GOLES ── */}
          <Section title="Goles">
            <MarketTable label="Goles Totales" expected={calc.t.goals}
              lines={[0.5, 1.5, 2.5, 3.5]}
              odds={odds} marketKey="goles_totales" addTopPick={addTopPick} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MarketTable label="Goles 1H" expected={calc.t.goals1h}
                lines={[0.5, 1.5]}
                odds={odds} marketKey="goles_1h" addTopPick={addTopPick} />
              <MarketTable label="Goles 2H" expected={calc.t.goals2h}
                lines={[0.5, 1.5]}
                odds={odds} marketKey="goles_2h" addTopPick={addTopPick} />
              <MarketTable label={`Goles ${teamA.name}`} expected={calc.adj.goalsA}
                lines={[0.5, 1.5]}
                odds={odds} marketKey="goles_local" addTopPick={addTopPick} />
              <MarketTable label={`Goles ${teamB.name}`} expected={calc.adj.goalsB}
                lines={[0.5, 1.5]}
                odds={odds} marketKey="goles_visita" addTopPick={addTopPick} />
            </div>
          </Section>

          {/* ── 6. TARJETAS ── */}
          <Section title="Tarjetas">
            <MarketTable label="Tarjetas Totales" expected={calc.t.cards}
              lines={[1.5, 2.5, 3.5, 4.5, 5.5]}
              odds={odds} marketKey="tarjetas_totales" addTopPick={addTopPick} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MarketTable label="Tarjetas 1H" expected={calc.t.cards1h}
                lines={[0.5, 1.5, 2.5]}
                odds={odds} marketKey="tarjetas_1h" addTopPick={addTopPick} />
              <MarketTable label={`Tarjetas ${teamA.name}`} expected={calc.adj.cardsA}
                lines={[0.5, 1.5, 2.5, 3.5]}
                odds={odds} marketKey="tarjetas_local" addTopPick={addTopPick} />
              <MarketTable label={`Tarjetas ${teamB.name}`} expected={calc.adj.cardsB}
                lines={[0.5, 1.5, 2.5, 3.5]}
                odds={odds} marketKey="tarjetas_visita" addTopPick={addTopPick} />
            </div>
          </Section>

          {/* ── 7. SAQUES ── */}
          <Section title="Saques de Portería y Banda">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MarketTable label="Saques de Portería Totales" expected={calc.t.gk}
                lines={[18.5, 20.5, 22.5, 24.5, 26.5]}
                odds={odds} marketKey="saques_porteria" addTopPick={addTopPick} />
              <MarketTable label="Throw-ins Totales" expected={calc.t.ti}
                lines={[49.5, 54.5, 59.5, 64.5, 69.5]}
                odds={odds} marketKey="throw_ins" addTopPick={addTopPick} />
            </div>
          </Section>
        </>
      )}
    </div>
  )
}
