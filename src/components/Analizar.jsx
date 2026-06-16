import { useState, useMemo, useEffect } from 'react'
import { TEAMS, SEDES, MATCHES } from '../lib/teams'
import { calcExpectedCorners, calcExpectedShots, calcExpectedPasses, calcExpectedFouls, altitudeCorrection } from '../lib/engine'
import {
  getJornadaMods, getDescansoMods, getMotivacionMods,
  getContextoMods, getMotivacionCombo, getMotivacionConfidenceDelta,
  getVolumeAlert, applyMods, DEFAULT_MODS,
} from '../lib/context'
import ContextPanel from './ContextPanel'
import { generateCandidates, selectTopPicks, suggestCombo, generateExplanation } from '../lib/picks'
import { generateLast5 } from '../lib/last5'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function recommend(expected, line) {
  const m = (expected - line) / line
  if (m > 0.08)  return { dir: 'OVER',  conf: 'alta',  icon: '✅', pct: Math.round(m * 100) }
  if (m > 0.03)  return { dir: 'OVER',  conf: 'media', icon: '⚠️', pct: Math.round(m * 100) }
  if (m < -0.08) return { dir: 'UNDER', conf: 'alta',  icon: '✅', pct: Math.round(m * 100) }
  if (m < -0.03) return { dir: 'UNDER', conf: 'media', icon: '⚠️', pct: Math.round(m * 100) }
  return { dir: null, conf: null, icon: '❌', pct: Math.round(m * 100) }
}

// ─── ModBadge ────────────────────────────────────────────────────────────────
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

// ─── ModBreakdown ─────────────────────────────────────────────────────────────
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

// ─── MarketRow ───────────────────────────────────────────────────────────────
function MarketRow({ expected, line }) {
  const { dir, conf, icon, pct } = recommend(expected, line)
  return (
    <div className="flex items-center gap-3 text-xs py-1 border-b border-dark-700 last:border-0">
      <span className="text-gray-500 w-16">O/U {line}</span>
      <span className={`flex-1 ${conf === 'alta' ? 'text-green-400' : conf === 'media' ? 'text-yellow-400' : 'text-gray-500'}`}>
        {icon} {dir ?? 'Sin rec.'} {dir ? `${pct > 0 ? '+' : ''}${pct}%` : ''}
      </span>
    </div>
  )
}

// ─── MarketTable ──────────────────────────────────────────────────────────────
function MarketTable({ label, expected, base, modsA, modsB, statKey, lines }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-semibold text-white">{label}
        <span className="ml-2 text-green-400 font-bold">{expected}</span>
      </p>
      {base !== undefined && modsA && (
        <ModBreakdown base={base} adj={expected} modsA={modsA} modsB={modsB} statKey={statKey} />
      )}
      <div className="flex items-center gap-3 text-xs text-gray-500 pb-1 border-b border-dark-600 uppercase tracking-wide mt-1">
        <span className="w-16">Línea</span>
        <span>Motor</span>
      </div>
      {lines.map(line => <MarketRow key={line} expected={expected} line={line} />)}
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

// ─── TeamStatsRef — tabla comparativa de stats de referencia ─────────────────
function StatRow({ label, valA, valB, higherIsBetter = true, fmt = v => v }) {
  const aNum = parseFloat(valA)
  const bNum = parseFloat(valB)
  const aWins = higherIsBetter ? aNum > bNum : aNum < bNum
  const bWins = higherIsBetter ? bNum > aNum : bNum < aNum
  return (
    <div className="grid grid-cols-7 gap-1 text-xs py-1 border-b border-dark-700/60 last:border-0 items-center">
      <span className={`col-span-2 text-right font-mono ${aWins ? 'text-green-400 font-bold' : 'text-gray-300'}`}>{fmt(valA)}</span>
      <span className="col-span-3 text-center text-gray-500 text-xs">{label}</span>
      <span className={`col-span-2 text-left font-mono ${bWins ? 'text-green-400 font-bold' : 'text-gray-300'}`}>{fmt(valB)}</span>
    </div>
  )
}

function TeamStatsRef({ teamA, teamB }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card border border-dark-600">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between text-left">
        <span className="font-semibold text-white text-sm">📊 Stats de Referencia — últimos 15 partidos</span>
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="mt-4 border-t border-dark-600 pt-3">
          {/* Headers */}
          <div className="grid grid-cols-7 gap-1 text-xs text-center mb-2">
            <span className="col-span-2 text-green-400 font-semibold truncate">{teamA.name}</span>
            <span className="col-span-3 text-gray-600 uppercase tracking-wide">Estadística</span>
            <span className="col-span-2 text-blue-400 font-semibold truncate">{teamB.name}</span>
          </div>
          {/* Ataque */}
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1 mt-2">⚽ Ataque</p>
          <StatRow label="Goles/P"        valA={teamA.gf_avg.toFixed(2)}  valB={teamB.gf_avg.toFixed(2)} />
          <StatRow label="Tiros/P"        valA={teamA.shots_avg.toFixed(1)} valB={teamB.shots_avg.toFixed(1)} />
          <StatRow label="SOT/P"          valA={teamA.sot_avg.toFixed(1)}  valB={teamB.sot_avg.toFixed(1)} />
          <StatRow label="Córners/P"      valA={teamA.corners_avg.toFixed(1)} valB={teamB.corners_avg.toFixed(1)} />
          <StatRow label="Pases/P"        valA={teamA.passes_avg} valB={teamB.passes_avg} />
          {/* Defensa */}
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1 mt-3">🛡️ Defensa</p>
          <StatRow label="Goles en contra/P" valA={teamA.ga_avg.toFixed(2)} valB={teamB.ga_avg.toFixed(2)} higherIsBetter={false} />
          <StatRow label="Tiros recibidos/P" valA={teamA.shots_against_avg.toFixed(1)} valB={teamB.shots_against_avg.toFixed(1)} higherIsBetter={false} />
          <StatRow label="Córners vs/P"      valA={teamA.corners_against_avg.toFixed(1)} valB={teamB.corners_against_avg.toFixed(1)} higherIsBetter={false} />
          <StatRow label="Pases rival/P"     valA={teamA.passes_against_avg} valB={teamB.passes_against_avg} higherIsBetter={false} />
          {/* Disciplina */}
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1 mt-3">🟨 Disciplina</p>
          <StatRow label="Tarjetas/P"   valA={teamA.cards_avg.toFixed(1)} valB={teamB.cards_avg.toFixed(1)} higherIsBetter={false} />
          <StatRow label="Faltas/P"     valA={teamA.fouls_avg.toFixed(1)} valB={teamB.fouls_avg.toFixed(1)} higherIsBetter={false} />
          <StatRow label="Faltas recib/P" valA={teamA.fouls_against_avg.toFixed(1)} valB={teamB.fouls_against_avg.toFixed(1)} />
          {/* Saques */}
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1 mt-3">🔄 Saques</p>
          <StatRow label="Saque portería/P" valA={teamA.goalkicks_avg.toFixed(1)} valB={teamB.goalkicks_avg.toFixed(1)} />
          <StatRow label="Throw-ins/P"      valA={teamA.throwins_avg.toFixed(1)} valB={teamB.throwins_avg.toFixed(1)} />
          {/* Partidos */}
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1 mt-3">📈 Historial ({teamA.matches ?? 15} partidos)</p>
          <StatRow label="Pts/partido" valA={teamA.ppg.toFixed(2)} valB={teamB.ppg.toFixed(2)} />
          <StatRow label="CS%"         valA={`${teamA.cs_pct}%`} valB={`${teamB.cs_pct}%`} />
          <StatRow label="BTTS%"       valA={`${teamA.btts_pct}%`} valB={`${teamB.btts_pct}%`} />
          <p className="text-xs text-gray-600 mt-2">🟩 verde = mejor valor</p>
        </div>
      )}
    </div>
  )
}

// ─── Last5Panel — últimos 5 partidos por equipo ──────────────────────────────
const RESULT_STYLE = { W: 'bg-green-900/60 text-green-300', D: 'bg-gray-700 text-gray-300', L: 'bg-red-900/60 text-red-300' }
const L5_COLS = [
  { key: 'result', label: 'R',    fmt: v => v },
  { key: 'gf',     label: 'G+',   fmt: v => v },
  { key: 'ga',     label: 'G-',   fmt: v => v },
  { key: 'shots',  label: 'Tiros', fmt: v => v },
  { key: 'sot',    label: 'SOT',  fmt: v => v },
  { key: 'corners',label: 'Cors', fmt: v => v },
  { key: 'cards',  label: 'Tarj', fmt: v => v },
  { key: 'fouls',  label: 'Falt', fmt: v => v },
  { key: 'passes', label: 'Pases', fmt: v => v },
]

function L5Table({ team }) {
  const matches = generateLast5(team)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left text-gray-500 pb-1 pr-2 font-normal">Rival</th>
            {L5_COLS.map(c => (
              <th key={c.key} className="text-center text-gray-500 pb-1 px-1 font-normal whitespace-nowrap">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matches.map((m, i) => (
            <tr key={i} className="border-t border-dark-700/60">
              <td className="text-gray-400 py-1 pr-2 whitespace-nowrap">{m.rival}</td>
              {L5_COLS.map(c => (
                <td key={c.key} className="text-center py-1 px-1">
                  {c.key === 'result'
                    ? <span className={`inline-block w-5 h-5 rounded text-center leading-5 text-xs font-bold ${RESULT_STYLE[m.result]}`}>{m.result}</span>
                    : <span className="text-gray-200">{c.fmt(m[c.key])}</span>
                  }
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-dark-600">
            <td className="text-gray-600 py-1 pr-2 text-xs">Prom</td>
            {L5_COLS.map(c => {
              if (c.key === 'result') return <td key={c.key} />
              const avg = matches.reduce((s, m) => s + (m[c.key] ?? 0), 0) / matches.length
              return <td key={c.key} className="text-center py-1 px-1 text-green-400 font-bold">{avg.toFixed(1)}</td>
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function Last5Panel({ teamA, teamB }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('a')
  return (
    <div className="card border border-dark-600">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between text-left">
        <span className="font-semibold text-white text-sm">📋 Últimos 5 partidos — por estadística</span>
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="mt-3 border-t border-dark-600 pt-3">
          <p className="text-xs text-gray-600 mb-3">Proyección basada en promedios de campaña con varianza por partido</p>
          <div className="flex gap-2 mb-3">
            <button onClick={() => setTab('a')}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${tab === 'a' ? 'bg-green-700 border-green-600 text-white font-semibold' : 'border-dark-600 text-gray-400 hover:border-green-600 hover:text-green-400'}`}>
              {teamA.name}
            </button>
            <button onClick={() => setTab('b')}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${tab === 'b' ? 'bg-blue-700 border-blue-600 text-white font-semibold' : 'border-dark-600 text-gray-400 hover:border-blue-600 hover:text-blue-400'}`}>
              {teamB.name}
            </button>
          </div>
          {tab === 'a' ? <L5Table team={teamA} /> : <L5Table team={teamB} />}
        </div>
      )}
    </div>
  )
}

// ─── Default context ──────────────────────────────────────────────────────────
const DEFAULT_CTX = {
  jornada: 'J1', descansoA: 5, descansoB: 5,
  viajeA: false, viajeB: false,
  motA: 'cualquier_result', motB: 'cualquier_result',
  checks: {},
}

// ─── PickCard ─────────────────────────────────────────────────────────────────
function PickCard({ pick, rank, teamA, teamB, ctx, calc, modsA, modsB }) {
  const [open, setOpen] = useState(false)
  const exp = open ? generateExplanation(pick, teamA, teamB, ctx, calc, modsA, modsB) : null

  const rankColors = ['text-yellow-400', 'text-gray-300', 'text-orange-400']
  const rankLabels = ['Principal', 'Secundario', 'Alternativo']

  return (
    <div className="rounded-lg border border-dark-600 bg-dark-700/60 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-dark-700 transition-colors"
      >
        <span className={`text-xs font-bold w-20 shrink-0 ${rankColors[rank] ?? 'text-gray-400'}`}>
          {rankLabels[rank] ?? `Pick ${rank + 1}`}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-semibold text-sm">{pick.label}</span>
            <span className={`text-xs font-bold ${pick.dir === 'OVER' ? 'text-green-400' : 'text-blue-400'}`}>
              {pick.dir} {pick.line}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
            <span>Expected: <strong className="text-white">{pick.expected}</strong></span>
            <span>P_mod: <strong className="text-green-300">{pick.pMod}%</strong></span>
            <span className={`${pick.confidence >= 70 ? 'text-green-400' : pick.confidence >= 55 ? 'text-yellow-400' : 'text-red-400'}`}>
              Conf {pick.confidence}
            </span>
          </div>
        </div>
        <span className="text-gray-500 text-xs shrink-0">{open ? '▲' : '▼'} Detalle</span>
      </button>

      {open && exp && (
        <div className="px-4 pb-4 pt-1 border-t border-dark-600 space-y-3 text-xs">
          <p className="text-gray-300">{exp.summary}</p>

          {exp.pushUp.length > 0 && (
            <div>
              <p className="text-green-400 font-semibold mb-1">Factores que empujan ARRIBA</p>
              {exp.pushUp.map((f, i) => (
                <div key={i} className="flex gap-2 items-start mb-0.5">
                  <span>{f.icon}</span>
                  <span className="text-gray-200 flex-1">{f.text}</span>
                  <span className="text-gray-500 shrink-0">{f.weight}</span>
                </div>
              ))}
            </div>
          )}

          {exp.pushDown.length > 0 && (
            <div>
              <p className="text-red-400 font-semibold mb-1">Factores de riesgo</p>
              {exp.pushDown.map((f, i) => (
                <div key={i} className="flex gap-2 items-start mb-0.5">
                  <span>{f.icon}</span>
                  <span className="text-gray-300 flex-1">{f.text}</span>
                  <span className="text-gray-500 shrink-0">{f.weight}</span>
                </div>
              ))}
            </div>
          )}

          <div>
            <p className="text-gray-500 font-semibold mb-1">Variables clave</p>
            <div className="grid grid-cols-2 gap-1">
              {exp.keyVars.map((v, i) => (
                <div key={i} className="bg-dark-800 rounded p-1.5">
                  <p className="text-gray-500">{v.label}</p>
                  <p className="text-white font-bold">{v.value}</p>
                  <p className="text-gray-600">{v.weight}</p>
                </div>
              ))}
            </div>
          </div>

          {exp.risks.length > 0 && (
            <div className="bg-yellow-900/20 border border-yellow-800/30 rounded p-2">
              <p className="text-yellow-400 font-semibold mb-1">⚠️ Riesgos a considerar</p>
              {exp.risks.map((r, i) => <p key={i} className="text-yellow-300">• {r}</p>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── ComboCard ────────────────────────────────────────────────────────────────
function ComboCard({ combo }) {
  return (
    <div className="rounded-lg border border-purple-700/40 bg-purple-900/20 p-3 text-xs">
      <p className="text-purple-300 font-bold text-sm mb-2">🎯 Combinada sugerida</p>
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="text-white">{combo.p1.label} {combo.p1.dir} {combo.p1.line}</span>
        <span className="text-gray-500">+</span>
        <span className="text-white">{combo.p2.label} {combo.p2.dir} {combo.p2.line}</span>
      </div>
      <div className="flex gap-4 text-gray-300">
        <span>P_comb: <strong className="text-purple-300">{combo.pCombo}%</strong></span>
        <span className="text-gray-500">Correlación: {combo.correlation}</span>
      </div>
      <p className="text-gray-600 mt-1">Picks relativamente independientes — correlación baja</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Analizar({ preloadTeams }) {
  const [teamAId, setTeamAId] = useState('')
  const [teamBId, setTeamBId] = useState('')
  const [sedeId,  setSedeId]  = useState('')
  const [ctx,     setCtx]     = useState(DEFAULT_CTX)
  const [ctxOpen, setCtxOpen] = useState(false)

  // Apply preloaded teams from Fixture → Analizar navigation
  useEffect(() => {
    if (!preloadTeams?.teamAId && !preloadTeams?.teamBId) return
    setTeamAId(preloadTeams.teamAId ?? '')
    setTeamBId(preloadTeams.teamBId ?? '')
  }, [preloadTeams?.teamAId, preloadTeams?.teamBId])

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

  // ─── Modificadores situacionales ─────────────────────────────────────────
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

  // ─── Expected ────────────────────────────────────────────────────────────
  const calc = useMemo(() => {
    if (!teamA || !teamB) return null

    const shots   = calcExpectedShots(teamA, teamB, altMod)
    const corners = calcExpectedCorners(teamA, teamB)
    const passes  = calcExpectedPasses(teamA, teamB)
    const fouls   = calcExpectedFouls(teamA, teamB, modsA.cards, modsB.cards)

    const base = {
      shotsA:   shots.expShotsA,    shotsB:  shots.expShotsB,
      sotA:     shots.expSOTA,      sotB:    shots.expSOTB,
      cornA:    corners.expA,       cornB:   corners.expB,
      goalsA:   +(teamA.gf_avg * altMod).toFixed(2),
      goalsB:   +(teamB.gf_avg * altMod).toFixed(2),
      cardsA:   +teamA.cards_avg.toFixed(2),
      cardsB:   +teamB.cards_avg.toFixed(2),
      shots1hA: +(teamA.shots_1h * altMod).toFixed(2),
      shots1hB: +(teamB.shots_1h * altMod).toFixed(2),
      shots2hA: +(teamA.shots_2h * altMod).toFixed(2),
      shots2hB: +(teamB.shots_2h * altMod).toFixed(2),
      sot1hA:   +teamA.sot_1h.toFixed(2),     sot1hB:  +teamB.sot_1h.toFixed(2),
      corn1hA:  +teamA.corners_1h.toFixed(2), corn1hB: +teamB.corners_1h.toFixed(2),
      corn2hA:  +teamA.corners_2h.toFixed(2), corn2hB: +teamB.corners_2h.toFixed(2),
      goals1hA: +teamA.goals_1h.toFixed(2),   goals1hB:+teamB.goals_1h.toFixed(2),
      goals2hA: +teamA.goals_2h.toFixed(2),   goals2hB:+teamB.goals_2h.toFixed(2),
      cards1hA: +teamA.cards_1h.toFixed(2),   cards1hB:+teamB.cards_1h.toFixed(2),
      gkA:      +teamA.goalkicks_avg.toFixed(2),
      gkB:      +teamB.goalkicks_avg.toFixed(2),
      tiA:      +teamA.throwins_avg.toFixed(2),
      tiB:      +teamB.throwins_avg.toFixed(2),
    }

    const adj = {
      shotsA:   +(base.shotsA   * modsA.shots).toFixed(2),
      shotsB:   +(base.shotsB   * modsB.shots).toFixed(2),
      sotA:     +(base.sotA     * modsA.sot).toFixed(2),
      sotB:     +(base.sotB     * modsB.sot).toFixed(2),
      cornA:    +(base.cornA    * modsA.corners).toFixed(2),
      cornB:    +(base.cornB    * modsB.corners).toFixed(2),
      goalsA:   +(base.goalsA   * modsA.goals).toFixed(2),
      goalsB:   +(base.goalsB   * modsB.goals).toFixed(2),
      cardsA:   +(base.cardsA   * modsA.cards).toFixed(2),
      cardsB:   +(base.cardsB   * modsB.cards).toFixed(2),
      shots1hA: +(base.shots1hA * modsA.shots).toFixed(2),
      shots1hB: +(base.shots1hB * modsB.shots).toFixed(2),
      shots2hA: +(base.shots2hA * modsA.shots).toFixed(2),
      shots2hB: +(base.shots2hB * modsB.shots).toFixed(2),
      sot1hA:   +(base.sot1hA  * modsA.sot).toFixed(2),
      sot1hB:   +(base.sot1hB  * modsB.sot).toFixed(2),
      corn1hA:  +(base.corn1hA * modsA.corners).toFixed(2),
      corn1hB:  +(base.corn1hB * modsB.corners).toFixed(2),
      corn2hA:  +(base.corn2hA * modsA.corners).toFixed(2),
      corn2hB:  +(base.corn2hB * modsB.corners).toFixed(2),
      goals1hA: +(base.goals1hA * modsA.goals).toFixed(2),
      goals1hB: +(base.goals1hB * modsB.goals).toFixed(2),
      goals2hA: +(base.goals2hA * modsA.goals).toFixed(2),
      goals2hB: +(base.goals2hB * modsB.goals).toFixed(2),
      cards1hA: +(base.cards1hA * modsA.cards).toFixed(2),
      cards1hB: +(base.cards1hB * modsB.cards).toFixed(2),
      gkA:      +(base.gkA * ((modsA.shots + modsA.corners) / 2)).toFixed(2),
      gkB:      +(base.gkB * ((modsB.shots + modsB.corners) / 2)).toFixed(2),
      tiA:      +(base.tiA * modsA.shots).toFixed(2),
      tiB:      +(base.tiB * modsB.shots).toFixed(2),
    }

    const t = {
      shots:   +(adj.shotsA  + adj.shotsB).toFixed(2),
      sot:     +(adj.sotA    + adj.sotB).toFixed(2),
      corners: +(adj.cornA   + adj.cornB).toFixed(2),
      goals:   +(adj.goalsA  + adj.goalsB).toFixed(2),
      cards:   +(adj.cardsA  + adj.cardsB).toFixed(2),
      shots1h: +(adj.shots1hA + adj.shots1hB).toFixed(2),
      shots2h: +(adj.shots2hA + adj.shots2hB).toFixed(2),
      sot1h:   +(adj.sot1hA  + adj.sot1hB).toFixed(2),
      corn1h:  +(adj.corn1hA + adj.corn1hB).toFixed(2),
      corn2h:  +(adj.corn2hA + adj.corn2hB).toFixed(2),
      goals1h: +(adj.goals1hA + adj.goals1hB).toFixed(2),
      goals2h: +(adj.goals2hA + adj.goals2hB).toFixed(2),
      cards1h: +(adj.cards1hA + adj.cards1hB).toFixed(2),
      gk:      +(adj.gkA + adj.gkB).toFixed(2),
      ti:      +(adj.tiA + adj.tiB).toFixed(2),
    }

    const bTot = {
      shots:   +(base.shotsA + base.shotsB).toFixed(2),
      corners: +(base.cornA  + base.cornB).toFixed(2),
    }

    const volumeAlert = getVolumeAlert(bTot.shots, t.shots)
    return { base, adj, t, bTot, volumeAlert, passes, fouls }
  }, [teamA, teamB, altMod, modsA, modsB])

  // ─── Picks ───────────────────────────────────────────────────────────────
  const { picks, combo } = useMemo(() => {
    if (!calc || !teamA || !teamB) return { picks: [], combo: null }
    const candidates = generateCandidates(calc, null, teamA, teamB)
    const top  = selectTopPicks(candidates)
    const c    = suggestCombo(top)
    return { picks: top, combo: c }
  }, [calc, teamA, teamB])

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
              onChange={e => { setTeamAId(e.target.value); setTeamBId('') }}>
              <option value="">Seleccionar...</option>
              {TEAMS.map(t => <option key={t.id} value={t.id}>{t.name} ({t.group})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Equipo Visitante</label>
            <select className="input-dark w-full" value={teamBId}
              onChange={e => setTeamBId(e.target.value)}>
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

      {/* ── Contexto ── */}
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
              <ContextPanel ctx={ctx} onChange={setCtx} teamAName={teamA?.name} teamBName={teamB?.name} sameGroup={sameGroup} />
            </div>
          )}
          {!ctxOpen && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              <span>Jornada: <strong className="text-white">{ctx.jornada}</strong></span>
              <span>Descanso {teamA?.name}: <strong className="text-white">{ctx.descansoA}d</strong></span>
              <span>Descanso {teamB?.name}: <strong className="text-white">{ctx.descansoB}d</strong></span>
              <span>Mot.Local: <strong className="text-white">{ctx.motA?.replace(/_/g, ' ')}</strong></span>
              <span>Mot.Visit: <strong className="text-white">{ctx.motB?.replace(/_/g, ' ')}</strong></span>
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
          {/* ── Alertas motivacionales ── */}
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
            <div className="grid grid-cols-3 md:grid-cols-7 gap-3 text-center">
              {[['Tiros', calc.t.shots], ['SOT', calc.t.sot], ['Córners', calc.t.corners], ['Goles', calc.t.goals], ['Tarjetas', calc.t.cards], ['Pases', calc.passes.total], ['Faltas', calc.fouls.total]].map(([label, val]) => (
                <div key={label} className="bg-dark-800 rounded-lg p-2">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-lg font-bold text-green-400">{val}</p>
                </div>
              ))}
            </div>
            {teamA.est && <p className="text-xs text-yellow-600 mt-2">⚠️ {teamA.name}: datos estimados</p>}
            {teamB.est && <p className="text-xs text-yellow-600 mt-1">⚠️ {teamB.name}: datos estimados</p>}
          </div>

          {/* ── Stats de Referencia ── */}
          <TeamStatsRef teamA={teamA} teamB={teamB} />

          {/* ── Últimos 5 partidos ── */}
          <Last5Panel teamA={teamA} teamB={teamB} />

          {/* ── Picks del Motor ── */}
          {picks.length > 0 && (
            <div className="card bg-dark-700 border border-green-800 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-white text-sm">🎯 Picks del Motor — {teamA.name} vs {teamB.name}</h2>
                <span className="text-xs text-gray-500">basado en expected + contexto</span>
              </div>
              {picks.map((pick, i) => (
                <PickCard key={`${pick.marketKey}_${pick.line}`} pick={pick} rank={i}
                  teamA={teamA} teamB={teamB} ctx={ctx} calc={calc} modsA={modsA} modsB={modsB} />
              ))}
              {combo && <ComboCard combo={combo} />}
              <p className="text-xs text-gray-600">⚠️ Picks generados por el motor. Verifica el contexto antes de apostar.</p>
            </div>
          )}

          {/* ── 1. TIROS ── */}
          <Section title="Tiros — Partido Completo">
            <MarketTable label="Tiros Totales" expected={calc.t.shots}
              base={calc.bTot.shots} modsA={modsA} modsB={modsB} statKey="shots"
              lines={[19.5, 21.5, 23.5, 25.5, 27.5]} />
            <MarketTable label="SOT Totales" expected={calc.t.sot}
              lines={[6.5, 7.5, 8.5, 9.5, 10.5]} />
          </Section>

          {/* ── 2. TIROS POR EQUIPO ── */}
          <Section title="Tiros — Por Equipo">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MarketTable label={`Tiros ${teamA.name}`} expected={calc.adj.shotsA}
                lines={[4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5]} />
              <MarketTable label={`Tiros ${teamB.name}`} expected={calc.adj.shotsB}
                lines={[4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5]} />
            </div>
          </Section>

          {/* ── 3. TIROS POR TIEMPO ── */}
          <Section title="Tiros — Por Tiempo">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MarketTable label="Tiros Totales 1H" expected={calc.t.shots1h}
                lines={[5.5, 7.5, 9.5, 11.5, 13.5]} />
              <MarketTable label="Tiros Totales 2H" expected={calc.t.shots2h}
                lines={[5.5, 7.5, 9.5, 11.5, 13.5]} />
              <MarketTable label="SOT 1H" expected={calc.t.sot1h}
                lines={[2.5, 3.5, 4.5, 5.5]} />
              <MarketTable label={`Tiros ${teamA.name} 1H`} expected={calc.adj.shots1hA}
                lines={[2.5, 3.5, 4.5, 5.5, 6.5, 7.5]} />
              <MarketTable label={`Tiros ${teamB.name} 1H`} expected={calc.adj.shots1hB}
                lines={[2.5, 3.5, 4.5, 5.5, 6.5, 7.5]} />
            </div>
          </Section>

          {/* ── 4. CÓRNERS ── */}
          <Section title="Córners">
            <MarketTable label="Córners Totales" expected={calc.t.corners}
              base={calc.bTot.corners} modsA={modsA} modsB={modsB} statKey="corners"
              lines={[7.5, 8.5, 9.5, 10.5, 11.5]} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MarketTable label="Córners 1H" expected={calc.t.corn1h} lines={[3.5, 4.5, 5.5]} />
              <MarketTable label="Córners 2H" expected={calc.t.corn2h} lines={[4.5, 5.5, 6.5]} />
              <MarketTable label={`Córners ${teamA.name}`} expected={calc.adj.cornA} lines={[3.5, 4.5, 5.5, 6.5]} />
              <MarketTable label={`Córners ${teamB.name}`} expected={calc.adj.cornB} lines={[3.5, 4.5, 5.5, 6.5]} />
            </div>
          </Section>

          {/* ── 5. GOLES ── */}
          <Section title="Goles">
            <MarketTable label="Goles Totales" expected={calc.t.goals} lines={[0.5, 1.5, 2.5, 3.5]} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MarketTable label="Goles 1H"  expected={calc.t.goals1h} lines={[0.5, 1.5]} />
              <MarketTable label="Goles 2H"  expected={calc.t.goals2h} lines={[0.5, 1.5]} />
              <MarketTable label={`Goles ${teamA.name}`} expected={calc.adj.goalsA} lines={[0.5, 1.5]} />
              <MarketTable label={`Goles ${teamB.name}`} expected={calc.adj.goalsB} lines={[0.5, 1.5]} />
            </div>
          </Section>

          {/* ── 6. TARJETAS ── */}
          <Section title="Tarjetas">
            <MarketTable label="Tarjetas Totales" expected={calc.t.cards} lines={[1.5, 2.5, 3.5, 4.5, 5.5]} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MarketTable label="Tarjetas 1H" expected={calc.t.cards1h} lines={[0.5, 1.5, 2.5]} />
              <MarketTable label={`Tarjetas ${teamA.name}`} expected={calc.adj.cardsA} lines={[0.5, 1.5, 2.5, 3.5]} />
              <MarketTable label={`Tarjetas ${teamB.name}`} expected={calc.adj.cardsB} lines={[0.5, 1.5, 2.5, 3.5]} />
            </div>
          </Section>

          {/* ── 7. SAQUES ── */}
          <Section title="Saques de Portería y Banda">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MarketTable label="Saques de Portería Totales" expected={calc.t.gk}
                lines={[18.5, 20.5, 22.5, 24.5, 26.5]} />
              <MarketTable label="Throw-ins Totales" expected={calc.t.ti}
                lines={[49.5, 54.5, 59.5, 64.5, 69.5]} />
            </div>
          </Section>

          {/* ── 8. PASES ── */}
          <Section title="Pases">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MarketTable label={`Pases ${teamA.name}`} expected={calc.passes.expPassesA}
                lines={[350, 380, 420, 460, 500, 540]} />
              <MarketTable label={`Pases ${teamB.name}`} expected={calc.passes.expPassesB}
                lines={[350, 380, 420, 460, 500, 540]} />
            </div>
            <MarketTable label="Pases Totales" expected={calc.passes.total}
              lines={[750, 800, 850, 900, 950, 1000]} />
          </Section>

          {/* ── 9. FALTAS ── */}
          <Section title="Faltas">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MarketTable label={`Faltas ${teamA.name}`} expected={calc.fouls.expFoulsA}
                lines={[8.5, 10.5, 12.5, 14.5, 16.5]} />
              <MarketTable label={`Faltas ${teamB.name}`} expected={calc.fouls.expFoulsB}
                lines={[8.5, 10.5, 12.5, 14.5, 16.5]} />
            </div>
            <MarketTable label="Faltas Totales" expected={calc.fouls.total}
              lines={[18.5, 20.5, 22.5, 24.5, 26.5, 28.5]} />
          </Section>
        </>
      )}
    </div>
  )
}
