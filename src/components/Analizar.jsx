import { useState, useMemo, useEffect, useRef } from 'react'
import { calcExpectedCorners, calcExpectedShots, calcExpectedPasses, calcExpectedFouls, calcExpectedGK, calcExpectedTI, calcExpectedGoals, calcExpectedCards } from '../lib/engine'
import {
  getJornadaMods, getDescansoMods, getMotivacionMods,
  getContextoMods, getMotivacionCombo, getMotivacionConfidenceDelta,
  getVolumeAlert, applyMods, DEFAULT_MODS,
} from '../lib/context'
import ContextPanel from './ContextPanel'
import { generateCandidates, selectTopPicks, pickUnoPorMercado, suggestCombo, generateExplanation, explicacionCorta, linesAround, bestRealisticLine } from '../lib/picks'
import { logCombo } from '../lib/market-engine'
import { mercadosDeLiga, resumenLiga } from '../lib/mercados-liga'
import { poissonOver } from '../lib/engine'
import { getBaseline, compAbbr } from '../lib/leagues'
import { fetchStandings, fetchFixtures } from '../lib/football-api'
import { buildTeamStats, teamsFromStandings } from '../lib/league-stats'
import { fetchH2H, fetchFixtureStats, hasLivescore } from '../lib/livescore-api'
import RecentResults from './RecentResults'
import { informePrePartido, hasIA } from '../lib/ia'
import { savePrediccion, getPrediccion } from '../lib/predicciones'

// ─── TeamStatsRef — tabla comparativa (colapsable) ───────────────────────────
function StatRow({ label, valA, valB, higherIsBetter = true }) {
  const aNum = parseFloat(valA)
  const bNum = parseFloat(valB)
  const aWins = higherIsBetter ? aNum > bNum : aNum < bNum
  const bWins = higherIsBetter ? bNum > aNum : bNum < aNum
  return (
    <div className="grid grid-cols-7 gap-1 text-xs py-1 border-b border-dark-700/60 last:border-0 items-center">
      <span className={`col-span-2 text-right font-mono ${aWins ? 'text-green-400 font-bold' : 'text-gray-300'}`}>{valA}</span>
      <span className="col-span-3 text-center text-gray-500 text-xs">{label}</span>
      <span className={`col-span-2 text-left font-mono ${bWins ? 'text-green-400 font-bold' : 'text-gray-300'}`}>{valB}</span>
    </div>
  )
}

export function TeamStatsRef({ teamA, teamB }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card border border-dark-600">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between text-left">
        <span className="font-semibold text-white text-sm">📊 Promedios ponderados — últimos {teamA.matches} partidos</span>
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="mt-4 border-t border-dark-600 pt-3">
          <div className="grid grid-cols-7 gap-1 text-xs text-center mb-2">
            <span className="col-span-2 text-green-400 font-semibold truncate">{teamA.name}</span>
            <span className="col-span-3 text-gray-600 uppercase tracking-wide">Estadística</span>
            <span className="col-span-2 text-blue-400 font-semibold truncate">{teamB.name}</span>
          </div>
          <StatRow label="Goles/P"   valA={teamA.gf_avg.toFixed(2)}    valB={teamB.gf_avg.toFixed(2)} />
          <StatRow label="Tiros/P"   valA={teamA.shots_avg.toFixed(1)} valB={teamB.shots_avg.toFixed(1)} />
          <StatRow label="SOT/P"     valA={teamA.sot_avg.toFixed(1)}   valB={teamB.sot_avg.toFixed(1)} />
          <StatRow label="Córners/P" valA={teamA.corners_avg.toFixed(1)} valB={teamB.corners_avg.toFixed(1)} />
          <StatRow label="Posesión %" valA={teamA.possession_avg} valB={teamB.possession_avg} />
          <StatRow label="Tarjetas/P" valA={teamA.cards_avg.toFixed(1)} valB={teamB.cards_avg.toFixed(1)} higherIsBetter={false} />
          <StatRow label="Goles contra/P" valA={teamA.ga_avg.toFixed(2)} valB={teamB.ga_avg.toFixed(2)} higherIsBetter={false} />
          <StatRow label="Saques banda/P" valA={teamA.throwins_avg.toFixed(1)} valB={teamB.throwins_avg.toFixed(1)} />
          <StatRow label="Saques puerta/P" valA={teamA.goalkicks_avg.toFixed(1)} valB={teamB.goalkicks_avg.toFixed(1)} />
          <StatRow label="Pts/partido" valA={teamA.ppg.toFixed(2)} valB={teamB.ppg.toFixed(2)} />
          <StatRow label="BTTS%" valA={`${teamA.btts_pct}%`} valB={`${teamB.btts_pct}%`} />

          {/* Racha y localía */}
          {(teamA.racha || teamB.racha || teamA.split || teamB.split) && (
            <div className="mt-3 pt-2 border-t border-dark-700 text-xs text-gray-400 space-y-1">
              <p className="text-gray-600 uppercase tracking-wide text-[10px]">Racha y localía (últimos {teamA.matches})</p>
              {teamA.racha && (
                <p>{teamA.racha.tipo === 'W' ? '🔥' : teamA.racha.tipo === 'L' ? '🥶' : '➖'} <span className="text-green-400">{teamA.name}</span>: {teamA.racha.n} {teamA.racha.tipo === 'W' ? 'victoria(s)' : teamA.racha.tipo === 'L' ? 'derrota(s)' : 'empate(s)'} seguida(s)</p>
              )}
              {teamB.racha && (
                <p>{teamB.racha.tipo === 'W' ? '🔥' : teamB.racha.tipo === 'L' ? '🥶' : '➖'} <span className="text-blue-400">{teamB.name}</span>: {teamB.racha.n} {teamB.racha.tipo === 'W' ? 'victoria(s)' : teamB.racha.tipo === 'L' ? 'derrota(s)' : 'empate(s)'} seguida(s)</p>
              )}
              {teamA.split?.home && (
                <p>🏠 <span className="text-green-400">{teamA.name}</span> en casa ({teamA.split.home.n} PJ): {teamA.split.home.ppg} pts · {teamA.split.home.gf ?? '—'} goles · {teamA.split.home.shots ?? '—'} tiros · {teamA.split.home.corners ?? '—'} córners</p>
              )}
              {teamB.split?.away && (
                <p>✈️ <span className="text-blue-400">{teamB.name}</span> de visita ({teamB.split.away.n} PJ): {teamB.split.away.ppg} pts · {teamB.split.away.gf ?? '—'} goles · {teamB.split.away.shots ?? '—'} tiros · {teamB.split.away.corners ?? '—'} córners</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── MatchColumn — estilo adamchoi: fila verde si Over, roja si Under ────────
const RESULT_DOT = { W: 'bg-green-500', D: 'bg-gray-500', L: 'bg-red-500' }

function MatchColumn({ title, rows, getVal, getSplit, line, accent }) {
  const vals = (rows ?? []).map(getVal)
  const valid = vals.filter(v => v != null)
  const overs = valid.filter(v => v > line).length
  const pct = valid.length ? Math.round((overs / valid.length) * 100) : null

  return (
    <div className="min-w-0">
      <p className={`text-xs font-bold mb-1.5 truncate ${accent}`}>{title}</p>
      <div className="space-y-1">
        {(rows ?? []).map((r, i) => {
          const v = vals[i]
          const over = v != null && v > line
          const bg = v == null
            ? 'bg-dark-700/40'
            : over ? 'bg-green-900/50' : 'bg-red-900/45'
          // Desglose propio · rival (solo variante Total)
          let split = null
          if (getSplit && v != null) {
            const [own, ag] = getSplit(r)
            if (own != null || ag != null) split = `${own ?? '—'}·${ag ?? '—'}`
          }
          return (
            <div key={i} className={`flex items-center gap-1.5 px-2 py-1 rounded ${bg}`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${RESULT_DOT[r.result] ?? 'bg-gray-600'}`} />
              <span className="text-gray-500 text-[10px] w-8 shrink-0">{r.date?.slice(5)}</span>
              <span className="text-purple-400/80 text-[9px] w-11 shrink-0 truncate" title={r.comp}>{compAbbr(r.comp)}</span>
              <span className="text-[10px] shrink-0">{r.isHome ? '🏠' : '✈️'}</span>
              <span className="flex-1 truncate text-gray-200 text-[11px]">{r.rival}</span>
              {split && <span className="text-gray-500 text-[10px] font-mono shrink-0" title="propio · rival">{split}</span>}
              <span className={`w-8 text-right font-bold text-xs shrink-0 ${
                v == null ? 'text-gray-600' : over ? 'text-green-300' : 'text-red-300'
              }`}>{v ?? '—'}</span>
            </div>
          )
        })}
        {(rows ?? []).length === 0 && <p className="text-xs text-gray-600 py-2">Sin historial</p>}
      </div>
      {pct != null && (
        <p className="text-[11px] mt-1.5 text-gray-400">
          Over {line}: <span className={`font-bold ${pct >= 70 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
            {overs}/{valid.length} ({pct}%)
          </span>
        </p>
      )}
    </div>
  )
}

// Líneas que admiten negativos (hándicap)
function signedLines(expected, step = 1, count = 5) {
  const c = Math.floor(expected) + 0.5
  const half = Math.floor(count / 2)
  const out = []
  for (let i = -half; i <= half; i++) out.push(+(c + i * step).toFixed(2))
  return out
}

// ─── LadderRow — línea clickeable con P del modelo ───────────────────────────
function LadderRow({ line, expected, isHandicap, onClick, active }) {
  const diff = expected - line
  const margin = isHandicap ? null : diff / line
  const dir = diff > 0 ? 'OVER' : 'UNDER'
  const pOver = isHandicap ? null : Math.round(poissonOver(expected, line) * 100)
  const p = dir === 'OVER' ? pOver : pOver != null ? 100 - pOver : null
  const strong = isHandicap ? Math.abs(diff) >= 1 : Math.abs(margin) >= 0.08
  const weak = isHandicap ? Math.abs(diff) < 0.4 : Math.abs(margin) < 0.04

  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors text-left ${
        active ? 'bg-dark-600 ring-1 ring-green-600' : 'hover:bg-dark-700'
      }`}>
      <span className="text-gray-400 font-mono w-12 shrink-0">{line > 0 || isHandicap ? line : line}</span>
      {weak ? (
        <span className="text-gray-600 flex-1">❌ Sin señal — expected pegado a la línea</span>
      ) : (
        <>
          <span className={`font-bold w-14 shrink-0 ${dir === 'OVER' ? 'text-green-400' : 'text-blue-400'}`}>
            {strong ? '✅' : '⚠️'} {dir}
          </span>
          {margin != null && (
            <span className={margin > 0 ? 'text-green-500' : 'text-blue-500'}>
              {margin > 0 ? '+' : ''}{Math.round(margin * 100)}%
            </span>
          )}
          {p != null && <span className="text-gray-500 ml-auto">P≈{p}%</span>}
          {isHandicap && <span className="text-gray-500 ml-auto">dif {diff > 0 ? '+' : ''}{diff.toFixed(1)}</span>}
        </>
      )}
      <span className="text-gray-600 shrink-0">{active ? '▲' : '¿por qué?'}</span>
    </button>
  )
}

// ─── MarketCard v2 — acordeón con variantes y explicación ────────────────────
function MarketCard({ icon, title, teamA, teamB, cfg, notes = [], explain }) {
  const [open, setOpen] = useState(false)
  const [variantKey, setVariantKey] = useState('total')
  const [selLine, setSelLine] = useState(null)
  const [explLine, setExplLine] = useState(null) // línea con explicación abierta

  const rec = useMemo(() => bestRealisticLine(cfg.expTotal, cfg.stepTotal), [cfg.expTotal, cfg.stepTotal])

  // Lectura del motor en prosa — el porqué del expected, siempre visible al desplegar
  const lectura = useMemo(() => {
    try {
      const bullets = explain('total', cfg.expTotal, cfg.expTotal, false) ?? []
      return bullets
        .filter(b => typeof b === 'string' && !/^Expected |^El motor proyecta|^🔎/.test(b))
        .slice(0, 4)
        .join(' ')
    } catch { return '' }
  }, [explain, cfg.expTotal])

  const VARIANTS = useMemo(() => {
    const v = [
      { key: 'total', label: 'Total' },
      { key: 'teamA', label: teamA.name.slice(0, 14) },
      { key: 'teamB', label: teamB.name.slice(0, 14) },
    ]
    if (cfg.handicap) v.push({ key: 'handicap', label: 'Hándicap' })
    return v
  }, [teamA.name, teamB.name, cfg.handicap])

  // Construir la variante activa
  const v = useMemo(() => {
    const { statKey, agKey, expTotal, expA, expB, stepTotal, stepTeam } = cfg
    const own = r => r[statKey]
    const ag = r => r[agKey]
    const total = r => (r[statKey] != null && r[agKey] != null) ? r[statKey] + r[agKey] : null
    const diffVal = r => (r[statKey] != null && r[agKey] != null) ? +(r[statKey] - r[agKey]).toFixed(1) : null

    if (variantKey === 'teamA') return {
      expected: expA, lines: linesAround(expA, stepTeam, 5), isHandicap: false,
      colA: { title: `${teamA.name} — a favor`, rows: teamA.last10, getVal: own, accent: 'text-green-400' },
      colB: { title: `${teamA.name} — en contra`, rows: teamA.last10, getVal: ag, accent: 'text-orange-400' },
      hint: `Escalera sobre lo que genera ${teamA.name}. La columna "en contra" muestra lo que le hacen — úsala para el mercado "${title} en contra".`,
    }
    if (variantKey === 'teamB') return {
      expected: expB, lines: linesAround(expB, stepTeam, 5), isHandicap: false,
      colA: { title: `${teamB.name} — a favor`, rows: teamB.last10, getVal: own, accent: 'text-blue-400' },
      colB: { title: `${teamB.name} — en contra`, rows: teamB.last10, getVal: ag, accent: 'text-orange-400' },
      hint: `Escalera sobre lo que genera ${teamB.name}.`,
    }
    if (variantKey === 'handicap') {
      const expDiff = +(expA - expB).toFixed(2)
      return {
        expected: expDiff, lines: signedLines(expDiff, cfg.stepTeam, 5), isHandicap: true,
        colA: { title: `${teamA.name} (dif propio-rival)`, rows: teamA.last10, getVal: diffVal, accent: 'text-green-400' },
        colB: { title: `${teamB.name} (dif propio-rival)`, rows: teamB.last10, getVal: diffVal, accent: 'text-blue-400' },
        hint: `Hándicap desde ${teamA.name}: Over de la línea = ${teamA.name} supera a ${teamB.name} por más de esa diferencia.`,
      }
    }
    const split = r => [r[statKey], r[agKey]]
    return {
      expected: expTotal, lines: linesAround(expTotal, stepTotal, 5), isHandicap: false,
      colA: { title: teamA.name, rows: teamA.last10, getVal: total, getSplit: split, accent: 'text-green-400' },
      colB: { title: teamB.name, rows: teamB.last10, getVal: total, getSplit: split, accent: 'text-blue-400' },
      hint: 'Valor = total del partido · el número pequeño es el desglose propio·rival',
    }
  }, [variantKey, cfg, teamA, teamB, title])

  const line = selLine != null && v.lines.includes(selLine) ? selLine : (v.lines[Math.floor(v.lines.length / 2)] ?? null)

  return (
    <div className="card border border-dark-600 !p-0 overflow-hidden self-start">
      {/* Header acordeón */}
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-dark-700/50 transition-colors">
        <span className="text-lg shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm">{title}</p>
          <p className="text-xs text-gray-500">Expected: <span className="text-green-400 font-bold">{cfg.expTotal}</span>
            <span className="ml-2 text-gray-600">{teamA.name.slice(0, 10)} {cfg.expA} · {teamB.name.slice(0, 10)} {cfg.expB}</span>
          </p>
        </div>
        {rec && (
          <span className={`text-xs font-bold px-2 py-1 rounded shrink-0 ${
            rec.dir === 'OVER' ? 'bg-green-900/50 text-green-300' : 'bg-blue-900/50 text-blue-300'
          }`}>{rec.dir} {rec.line}</span>
        )}
        <span className="text-gray-500 shrink-0">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-dark-600 pt-3">
          {/* Lectura del motor — el porqué en palabras */}
          {lectura && (
            <div className="bg-purple-950/30 border border-purple-800/30 rounded-lg p-3">
              <p className="text-xs text-gray-200 leading-relaxed">📝 <span className="text-purple-300 font-semibold">Lectura del motor:</span> {lectura}</p>
            </div>
          )}

          {notes.map((n, i) => <p key={i} className="text-[11px] text-gray-500">{n}</p>)}

          {/* Variantes */}
          <div className="flex gap-1.5 flex-wrap">
            {VARIANTS.map(vt => (
              <button key={vt.key}
                onClick={() => { setVariantKey(vt.key); setSelLine(null); setExplLine(null) }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  variantKey === vt.key ? 'bg-green-700 text-white' : 'bg-dark-700 text-gray-400 hover:text-white'
                }`}>
                {vt.label}
              </button>
            ))}
          </div>

          {/* Escalera de líneas */}
          <div className="bg-dark-800/60 rounded-lg p-1.5 space-y-0.5">
            <p className="text-[10px] text-gray-600 uppercase tracking-wide px-2 pt-1">
              Expected {v.isHandicap ? 'diferencia' : ''}: <span className="text-green-400 font-bold">{v.expected}</span> — toca una línea para ver el porqué
            </p>
            {v.lines.map(l => (
              <div key={l}>
                <LadderRow line={l} expected={v.expected} isHandicap={v.isHandicap}
                  active={explLine === l}
                  onClick={() => { setSelLine(l); setExplLine(explLine === l ? null : l) }} />
                {explLine === l && (
                  <div className="mx-2 my-1 p-3 bg-dark-900/80 border border-green-900/40 rounded-lg space-y-1">
                    {explain(variantKey, l, v.expected, v.isHandicap).map((b, i) => (
                      <p key={i} className="text-[11px] text-gray-300">• {b}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Historial */}
          <div className="grid grid-cols-2 gap-3">
            <MatchColumn {...v.colA} line={line} />
            <MatchColumn {...v.colB} line={line} />
          </div>
          <p className="text-[10px] text-gray-600">{v.hint} · 🟢 Over {line} · 🔴 Under · punto = W/D/L</p>
        </div>
      )}
    </div>
  )
}

// ─── H2HCard — enfrentamientos directos ──────────────────────────────────────
function FormBadges({ form }) {
  return (
    <div className="flex gap-0.5">
      {(form ?? []).slice(0, 6).map((r, i) => (
        <span key={i} className={`w-4 h-4 rounded-sm text-[10px] leading-4 text-center text-white font-bold ${
          r === 'W' ? 'bg-green-600' : r === 'D' ? 'bg-gray-600' : 'bg-red-600'
        }`}>{r}</span>
      ))}
    </div>
  )
}

function H2HCard({ teamA, teamB }) {
  const [h2h, setH2h] = useState(null)
  const [meetingStats, setMeetingStats] = useState({})
  const [statsOpen, setStatsOpen] = useState(false)

  useEffect(() => {
    let alive = true
    if (!hasLivescore()) return
    fetchH2H(teamA.id, teamB.id).then(res => { if (alive && res.ok) setH2h(res) })
    return () => { alive = false }
  }, [teamA.id, teamB.id])

  // Stats de los cruces al expandir (cacheadas para siempre)
  useEffect(() => {
    if (!statsOpen || !h2h?.meetings?.length) return
    let alive = true
    ;(async () => {
      const acc = {}
      for (const m of h2h.meetings) {
        try {
          const res = await fetchFixtureStats(m.id, m.homeId, m.awayId)
          const sum = name => {
            const h = res.stats?.[0]?.stats?.[name]
            const a = res.stats?.[1]?.stats?.[name]
            const hn = typeof h === 'string' ? parseFloat(h) : h
            const an = typeof a === 'string' ? parseFloat(a) : a
            return hn != null && an != null ? hn + an : null
          }
          acc[m.id] = {
            corners: sum('Corner Kicks'),
            shots: sum('Total Shots'),
            cards: (() => { const y = sum('Yellow Cards'); const r = sum('Red Cards'); return y != null ? y + (r ?? 0) : null })(),
            ti: sum('Throw Ins'),
          }
          if (alive) setMeetingStats({ ...acc })
        } catch {}
      }
    })()
    return () => { alive = false }
  }, [statsOpen, h2h])

  if (!h2h) return null

  return (
    <div className="card border border-purple-800/40 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="font-bold text-white text-sm">⚔️ Head to Head — últimos {h2h.meetings.length} cruces</p>
        <button onClick={() => setStatsOpen(o => !o)} className="text-xs text-purple-400 hover:text-purple-300">
          {statsOpen ? '▲ ocultar stats' : '▼ ver stats de los cruces'}
        </button>
      </div>

      {/* Forma */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="space-y-1.5">
          <p className="text-green-400 font-semibold truncate">{h2h.team1.name}</p>
          <div className="flex items-center gap-2"><span className="text-gray-600 w-14">General</span><FormBadges form={h2h.team1.overallForm} /></div>
          <div className="flex items-center gap-2"><span className="text-gray-600 w-14">vs rival</span><FormBadges form={h2h.team1.h2hForm} /></div>
        </div>
        <div className="space-y-1.5">
          <p className="text-blue-400 font-semibold truncate">{h2h.team2.name}</p>
          <div className="flex items-center gap-2"><span className="text-gray-600 w-14">General</span><FormBadges form={h2h.team2.overallForm} /></div>
          <div className="flex items-center gap-2"><span className="text-gray-600 w-14">vs rival</span><FormBadges form={h2h.team2.h2hForm} /></div>
        </div>
      </div>

      {/* Cruces */}
      <div className="space-y-1">
        {h2h.meetings.map(m => {
          const st = meetingStats[m.id]
          return (
            <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-dark-700/60 text-xs">
              <span className="text-gray-500 text-[10px] w-16 shrink-0">{m.date}</span>
              <span className={`flex-1 text-right truncate ${m.homeGoals > m.awayGoals ? 'text-green-300 font-bold' : 'text-gray-300'}`}>{m.homeTeam}</span>
              <span className="text-white font-bold shrink-0 px-1">{m.homeGoals} - {m.awayGoals}</span>
              <span className={`flex-1 truncate ${m.awayGoals > m.homeGoals ? 'text-green-300 font-bold' : 'text-gray-300'}`}>{m.awayTeam}</span>
              {statsOpen && (
                <span className="text-[10px] text-gray-500 shrink-0 w-40 text-right">
                  {st
                    ? <>C:{st.corners ?? '—'} T:{st.shots ?? '—'} Tj:{st.cards ?? '—'} TI:{st.ti ?? '—'}</>
                    : 'cargando...'}
                </span>
              )}
            </div>
          )
        })}
      </div>
      {statsOpen && <p className="text-[10px] text-gray-600">C = córners · T = tiros · Tj = tarjetas · TI = throw-ins (totales del cruce)</p>}
    </div>
  )
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

// ─── InformeIA — Claude busca en internet: noticias, alineaciones, clima ─────
function InformeIA({ teamA, teamB, league, calc }) {
  const [estado, setEstado] = useState('idle') // idle | loading | done | error
  const [informe, setInforme] = useState(null)
  const [error, setError] = useState(null)

  // Reset al cambiar de cruce
  useEffect(() => {
    setEstado('idle'); setInforme(null); setError(null)
  }, [teamA.id, teamB.id])

  async function generar() {
    setEstado('loading')
    setError(null)
    try {
      const res = await informePrePartido({ teamA, teamB, league, calc })
      setInforme(res)
      setEstado('done')
    } catch (e) {
      setError(e.message)
      setEstado('error')
    }
  }

  if (!hasIA()) {
    return (
      <div className="card border border-purple-800/40">
        <p className="font-bold text-white text-sm mb-2">🧠 Informe IA — busca en internet lo que las stats no ven</p>
        <p className="text-xs text-gray-400 mb-2">
          Noticias, alineaciones probables, bajas de última hora y clima — Claude los busca en la web y los contrasta con los números del motor.
        </p>
        <div className="bg-dark-700 rounded-lg p-3 text-xs text-gray-400 space-y-1">
          <p className="text-yellow-500 font-semibold">Para activarlo:</p>
          <p>1. Crea una API key en <span className="text-white">console.anthropic.com</span> → API Keys</p>
          <p>2. Pégala en <span className="text-white font-mono">.env.local</span> → <span className="font-mono">VITE_ANTHROPIC_API_KEY=sk-ant-...</span></p>
          <p>3. Reinicia el servidor</p>
          <p className="text-gray-600 pt-1">Costo aproximado: $0.10–0.30 USD por informe (modelo + búsquedas web). Se cachea 6 horas.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card border-2 border-purple-700/60 bg-gradient-to-b from-purple-950/40 to-dark-800 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="font-bold text-purple-200 text-base">🧠 Informe IA — {teamA.name} vs {teamB.name}</p>
        {estado !== 'loading' && (
          <button onClick={generar}
            className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-600 text-white text-sm font-bold transition-colors">
            {estado === 'done' ? '🔄 Regenerar' : '🔍 Buscar en internet'}
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500 -mt-1">
        Claude busca noticias, alineaciones probables, bajas y clima de las últimas 48-72h, y los contrasta con los números del motor.
      </p>

      {estado === 'loading' && (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-purple-300 text-sm font-semibold">Buscando en internet...</p>
          <p className="text-gray-500 text-xs mt-1">Alineaciones, bajas, noticias, clima — tarda 30-90 segundos</p>
        </div>
      )}

      {estado === 'error' && (
        <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300">
          Error: {error}
        </div>
      )}

      {estado === 'done' && informe && (
        <div className="bg-dark-900/70 rounded-xl p-4">
          <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{informe.texto}</div>
          <p className="text-[10px] text-gray-600 mt-3 pt-2 border-t border-dark-700">
            {informe.busquedas ?? '?'} búsquedas web · {informe.fromCache ? 'informe cacheado (máx 6h de antigüedad) — usa Regenerar para uno fresco' : 'generado ahora'}
          </p>
        </div>
      )}
    </div>
  )
}

function ComboCard({ combo }) {
  return (
    <div className="rounded-lg border border-purple-700/40 bg-purple-900/20 p-3 text-xs space-y-2">
      <p className="text-purple-300 font-bold text-sm">🎯 Combinada sugerida — meta: cuota ≥ {combo.targetOdds}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-white font-semibold">{combo.p1.label} {combo.p1.dir} {combo.p1.line}</span>
        <span className="text-gray-500">+</span>
        <span className="text-white font-semibold">{combo.p2.label} {combo.p2.dir} {combo.p2.line}</span>
      </div>
      <div className="flex gap-4 text-gray-300 flex-wrap">
        <span>P oficial: <strong className="text-white">{combo.pA}%</strong> × <strong className="text-white">{combo.pB}%</strong> = <strong className="text-purple-300">{combo.pIndep}%</strong></span>
        <span className="text-gray-500">Conjunta-tempo ({combo.tempoStatus}): {combo.pJointTempo}% ({combo.ajusteDep > 0 ? '+' : ''}{combo.ajusteDep} pp)</span>
        <span>Risk gate (NO es la P conjunta oficial): <strong className="text-purple-300">{combo.pGate}%</strong></span>
        <span>Cuota justa del gate: <strong className="text-white">{combo.cuotaJusta}</strong></span>
      </div>
      {combo.valeAlTarget ? (
        <p className="text-green-300 font-bold bg-green-950/50 border border-green-800/50 rounded-lg px-3 py-1.5">
          📝 PAPER BET a cuota {combo.targetOdds}: EV {combo.evAlTarget > 0 ? '+' : ''}{combo.evAlTarget}% · {combo.unc.nPos} de {combo.unc.n} escenarios con EV&gt;0 · rango P10-P90 [{combo.unc.evP10}%, {combo.unc.evP90}%] — registrar y seguir
        </p>
      ) : (
        <p className="text-yellow-400 bg-yellow-950/40 border border-yellow-900/50 rounded-lg px-3 py-1.5">
          ⚠️ A cuota {combo.targetOdds}: EV {combo.evAlTarget}% · solo {combo.unc.nPos} de {combo.unc.n} escenarios con EV&gt;0 — {combo.evAlTarget > 2 ? 'demasiado sensible a los parámetros' : `insuficiente (necesitarías cuota ≥ ${combo.cuotaJusta})`}. NO BET
        </p>
      )}
      <p className="text-[10px] text-gray-600">Las P oficiales son las MISMAS NB de los paneles individuales. La conjunta-tempo es EXPERIMENTAL y solo puede recortar el gate, nunca inflarlo. Los escenarios miden incertidumbre PARAMÉTRICA (PROVISIONAL) — la incertidumbre estructural (¿es NB la distribución correcta? ¿existe el tempo?) NO está incluida.</p>
    </div>
  )
}

// ─── Default context ──────────────────────────────────────────────────────────
const DEFAULT_CTX = {
  jornada: 'inicio', descansoA: 5, descansoB: 5,
  viajeA: false, viajeB: false,
  motA: 'cualquier_result', motB: 'cualquier_result',
  checks: {},
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Analizar({ league, preloadTeams }) {
  const [leagueTeams, setLeagueTeams] = useState([])
  const [teamsError, setTeamsError]   = useState(null)
  const [teamAId, setTeamAId] = useState('')
  const [teamBId, setTeamBId] = useState('')
  const [teamA, setTeamA] = useState(null)
  const [teamB, setTeamB] = useState(null)
  const [building, setBuilding] = useState(false)
  const [progress, setProgress] = useState('')
  const [buildError, setBuildError] = useState(null)
  const [ctx, setCtx] = useState(DEFAULT_CTX)
  const [ctxOpen, setCtxOpen] = useState(false)
  const [clima, setClima] = useState(null) // pronóstico automático del estadio
  const buildSeq = useRef(0)

  // ── Copas = eliminación directa: partidos más cerrados y volátiles ──
  // Se auto-activa el check (goles ×0.90, tiros ×0.95, tarjetas ×1.12);
  // el usuario puede desmarcarlo en el contexto si es fase de grupos/liga.
  useEffect(() => {
    setCtx(prev => ({
      ...prev,
      checks: { ...prev.checks, eliminacion: league.type === 'cup' },
    }))
  }, [league.id, league.type])

  // ── Clima automático: busca el fixture de estos equipos y trae el pronóstico ──
  useEffect(() => {
    setClima(null)
    if (!teamAId || !teamBId || !leagueTeams.length) return
    let alive = true
    const nameA = (leagueTeams.find(t => t.id === Number(teamAId))?.name ?? '').toLowerCase()
    const nameB = (leagueTeams.find(t => t.id === Number(teamBId))?.name ?? '').toLowerCase()
    ;(async () => {
      try {
        const fx = await fetchFixtures(league.id)
        if (!alive || !fx?.ok) return
        const norm = s => (s ?? '').toLowerCase()
        const f = (fx.fixtures ?? []).find(f =>
          (norm(f.homeTeam) === nameA && norm(f.awayTeam) === nameB) ||
          (norm(f.homeTeam) === nameB && norm(f.awayTeam) === nameA)
        )
        if (!f?.venue || !f?.date) return
        const { fetchClima } = await import('../lib/clima')
        const c = await fetchClima(f.venue, f.date)
        if (!alive || !c) return
        setClima(c)
        // Auto-activar checks de calor/lluvia (el usuario puede desmarcarlos)
        if (c.sugiereCalor || c.sugiereLluvia) {
          setCtx(prev => ({
            ...prev,
            checks: {
              ...prev.checks,
              ...(c.sugiereCalor ? { calor: true } : {}),
              ...(c.sugiereLluvia ? { lluvia: true } : {}),
            },
          }))
        }
      } catch {}
    })()
    return () => { alive = false }
  }, [teamAId, teamBId, leagueTeams, league.id])

  // ── Cargar equipos de la liga ──
  useEffect(() => {
    let alive = true
    setLeagueTeams([])
    setTeamAId(''); setTeamBId('')
    setTeamA(null); setTeamB(null)
    setTeamsError(null)
    fetchStandings(league.id)
      .then(async res => {
        if (!alive) return
        const base = (res.ok && res.groups?.length) ? teamsFromStandings(res.groups) : []
        // SIEMPRE mezclar los equipos del fixture (±7 días): las copas y fases
        // previas (playoffs de Champions, EFL Cup...) no aparecen en la tabla
        const fx = await fetchFixtures(league.id).catch(() => null)
        if (!alive) return
        const map = new Map(base.map(t => [t.id, t]))
        for (const f of fx?.fixtures ?? []) {
          if (f.homeId && !map.has(f.homeId)) map.set(f.homeId, { id: f.homeId, name: f.homeTeam })
          if (f.awayId && !map.has(f.awayId)) map.set(f.awayId, { id: f.awayId, name: f.awayTeam })
        }
        if (map.size) setLeagueTeams([...map.values()].sort((a, b) => a.name.localeCompare(b.name)))
        else setTeamsError(res.error || 'No se pudo cargar la lista de equipos')
      })
      .catch(e => alive && setTeamsError(e.message))
    return () => { alive = false }
  }, [league.id])

  // ── Preload desde Fixture (por ID directo; nombre como respaldo) ──
  useEffect(() => {
    if (!preloadTeams?.teamAName || !leagueTeams.length) return
    const byId = id => id && leagueTeams.some(t => t.id === Number(id)) ? Number(id) : null
    const byName = name => leagueTeams.find(t => t.name.toLowerCase() === name?.toLowerCase())?.id ?? null
    const a = byId(preloadTeams.teamAId) ?? byName(preloadTeams.teamAName)
    const b = byId(preloadTeams.teamBId) ?? byName(preloadTeams.teamBName)
    if (a) setTeamAId(String(a))
    if (b) setTeamBId(String(b))
  }, [preloadTeams, leagueTeams])

  // ── Construir stats ──
  useEffect(() => {
    if (!teamAId || !teamBId) { setTeamA(null); setTeamB(null); return }
    const seq = ++buildSeq.current
    const nameA = leagueTeams.find(t => t.id === Number(teamAId))?.name ?? 'Equipo A'
    const nameB = leagueTeams.find(t => t.id === Number(teamBId))?.name ?? 'Equipo B'

    setBuilding(true)
    setBuildError(null)
    setTeamA(null); setTeamB(null)

    const onProgress = (name, i, n) => {
      if (buildSeq.current === seq) setProgress(`${name}: partido ${i}/${n}`)
    }

    ;(async () => {
      try {
        const a = await buildTeamStats(league, Number(teamAId), nameA, onProgress)
        if (buildSeq.current !== seq) return
        setTeamA(a)
        const b = await buildTeamStats(league, Number(teamBId), nameB, onProgress)
        if (buildSeq.current !== seq) return
        setTeamB(b)
      } catch (e) {
        if (buildSeq.current === seq) setBuildError(e.message)
      } finally {
        if (buildSeq.current === seq) { setBuilding(false); setProgress('') }
      }
    })()
  }, [teamAId, teamBId, league, leagueTeams])

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

    const kC = league.kCorners

    const shots   = calcExpectedShots(teamA, teamB)
    const corners = calcExpectedCorners(teamA, teamB)
    const passes  = calcExpectedPasses(teamA, teamB)
    const fouls   = calcExpectedFouls(teamA, teamB, modsA.cards, modsB.cards)
    const goals   = calcExpectedGoals(teamA, teamB)
    const cardsCausal = calcExpectedCards(teamA, teamB, fouls.expFoulsA, fouls.expFoulsB)
    const gk      = calcExpectedGK(teamA, teamB)
    const ti      = calcExpectedTI(teamA, teamB, {
      lluvia: !!ctx.checks?.lluvia,
      rivalidad: !!ctx.checks?.rivalidad,
      kLiga: league.kTI,
    })

    const base = {
      shotsA:   shots.expShotsA,          shotsB:  shots.expShotsB,
      sotA:     shots.expSOTA,            sotB:    shots.expSOTB,
      cornA:    +(corners.expA * kC).toFixed(2),
      cornB:    +(corners.expB * kC).toFixed(2),
      goalsA:   goals.expA,
      goalsB:   goals.expB,
      cardsA:   cardsCausal.expA,
      cardsB:   cardsCausal.expB,
      shots1hA: +teamA.shots_1h.toFixed(2),
      shots1hB: +teamB.shots_1h.toFixed(2),
      shots2hA: +teamA.shots_2h.toFixed(2),
      shots2hB: +teamB.shots_2h.toFixed(2),
      sot1hA:   +teamA.sot_1h.toFixed(2),     sot1hB:  +teamB.sot_1h.toFixed(2),
      corn1hA:  +(teamA.corners_1h * kC).toFixed(2), corn1hB: +(teamB.corners_1h * kC).toFixed(2),
      corn2hA:  +(teamA.corners_2h * kC).toFixed(2), corn2hB: +(teamB.corners_2h * kC).toFixed(2),
      goals1hA: +teamA.goals_1h.toFixed(2),   goals1hB:+teamB.goals_1h.toFixed(2),
      goals2hA: +teamA.goals_2h.toFixed(2),   goals2hB:+teamB.goals_2h.toFixed(2),
      cards1hA: +teamA.cards_1h.toFixed(2),   cards1hB:+teamB.cards_1h.toFixed(2),
      gkA:      gk.expA,
      gkB:      gk.expB,
      tiA:      ti.expA,
      tiB:      ti.expB,
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
      gkA: base.gkA,
      gkB: base.gkB,
      tiA: base.tiA,
      tiB: base.tiB,
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
    return { base, adj, t, bTot, volumeAlert, passes, fouls, goals, gkCalc: gk, tiCalc: ti, cardsCausal, cornersCalc: corners }
  }, [teamA, teamB, modsA, modsB, ctx.checks, league])

  // ─── Picks — top 5 ordenados por confianza ───────────────────────────────
  const { picks, combo } = useMemo(() => {
    if (!calc || !teamA || !teamB) return { picks: [], combo: null }
    // UN pick por mercado, solo de los que la casa ofrece en esta competición.
    // Evita el absurdo de recomendar "X más de 8.5 tiros" y "X menos de 13.5".
    const base = getBaseline(league.id)
    const top = pickUnoPorMercado(generateCandidates(calc, null, teamA, teamB), mercadosDeLiga(league.id))
      // El porqué viaja CON el pick: al guardarse, la tarjeta del Fixture
      // muestra EXACTAMENTE estos picks (Analizar es la fuente de verdad)
      .map(p => ({ ...p, porque: explicacionCorta(p, teamA, teamB, ctx, calc, modsA, modsB, base) }))
    const c = suggestCombo(top)
    return { picks: top, combo: c }
  }, [calc, teamA, teamB, league.id, ctx, modsA, modsB])

  // v5.1 §9: registrar CADA evaluación de combinada (con sus picks, el gate y
  // la incertidumbre) — la selección humana no decide qué entra en la muestra
  useEffect(() => {
    if (!combo || !teamA || !teamB) return
    logCombo({
      matchKey: `${league.id}_${teamA.name}_${teamB.name}`,
      leagueId: league.id, home: teamA.name, away: teamB.name,
      labelA: `${combo.p1.label} ${combo.p1.dir} ${combo.p1.line}`,
      labelB: `${combo.p2.label} ${combo.p2.dir} ${combo.p2.line}`,
      pA: combo.pA, pB: combo.pB,
      pIndep: combo.pIndep, pJointTempo: combo.pJointTempo, pGate: combo.pGate,
      targetOdds: combo.targetOdds, ev: combo.evAlTarget,
      escenariosPos: `${combo.unc.nPos}/${combo.unc.n}`, evP10: combo.unc.evP10, evP90: combo.unc.evP90,
      decision: combo.valeAlTarget ? 'PAPER BET' : 'NO BET',
      marketKeyA: combo.p1.marketKey, lineA: combo.p1.line, dirA: combo.p1.dir,
      marketKeyB: combo.p2.marketKey, lineB: combo.p2.line, dirB: combo.p2.dir,
    })
  }, [combo, teamA, teamB, league.id])

  const ready = !!calc

  // ─── Guardar snapshot de la predicción (7 días) para comparar post-partido ──
  const [snapshotPrevio, setSnapshotPrevio] = useState(null)
  useEffect(() => {
    if (!calc || !teamA || !teamB) return
    // Detectar si ya había una predicción guardada de ANTES (para mostrar su fecha)
    const previa = getPrediccion(league.id, teamA.name, teamB.name)
    if (previa && Date.now() - previa.ts > 5 * 60_000) setSnapshotPrevio(previa)
    else if (!previa) setSnapshotPrevio(null)
    // NO pisar una predicción histórica (>24h): es el registro pre-partido.
    // Re-analizar un partido ya jugado no debe borrar lo que se predijo.
    if (previa && Date.now() - previa.ts > 24 * 3600_000) return
    savePrediccion({
      leagueId: league.id,
      teamAName: teamA.name,
      teamBName: teamB.name,
      expected: {
        goals: calc.t.goals, shots: calc.t.shots, sot: calc.t.sot,
        corners: calc.t.corners, cards: calc.t.cards, fouls: calc.fouls.total,
        ti: calc.t.ti, gk: calc.t.gk,
        goalsA: calc.adj.goalsA, goalsB: calc.adj.goalsB,
        shotsA: calc.adj.shotsA, shotsB: calc.adj.shotsB,
      },
      picks,
    })
  }, [calc, teamA, teamB, league.id, picks])

  // ─── Explicaciones por mercado — el "porqué" de cada recomendación ───────
  const explainFor = useMemo(() => {
    if (!teamA || !teamB || !calc) return () => () => []
    const A = teamA, B = teamB
    const base = getBaseline(league.id)
    const f1 = n => n?.toFixed?.(1) ?? n

    const commonLine = (line, expected, isHandicap) => {
      if (isHandicap) {
        const d = expected - line
        return `El motor proyecta una diferencia de ${expected > 0 ? '+' : ''}${f1(expected)} a favor de ${expected >= 0 ? A.name : B.name}; contra la línea ${line} el colchón es de ${d > 0 ? '+' : ''}${f1(d)}.`
      }
      const m = Math.round(((expected - line) / line) * 100)
      const p = Math.round(poissonOver(expected, line) * 100)
      return `Expected ${f1(expected)} vs línea ${line}: margen ${m > 0 ? '+' : ''}${m}%. Poisson da ${p}% de probabilidad al Over (${100 - p}% al Under).`
    }

    const modNote = (statMod, label) => {
      const a = modsA[statMod], b = modsB[statMod]
      const out = []
      if (Math.abs(a - 1) > 0.02) out.push(`Contexto de ${A.name} (motivación/descanso/fase) aplica ×${a.toFixed(2)} a ${label}`)
      if (Math.abs(b - 1) > 0.02) out.push(`Contexto de ${B.name} aplica ×${b.toFixed(2)} a ${label}`)
      return out
    }

    // Lectura de estilo desde posesión real (no hay dato táctico directo en la API)
    const posDiff = A.possession_avg - B.possession_avg
    const dominio = Math.abs(posDiff) >= 8
      ? `${posDiff > 0 ? A.name : B.name} domina el balón (${Math.max(A.possession_avg, B.possession_avg)}% vs ${Math.min(A.possession_avg, B.possession_avg)}%): el rival se replegará, cede volumen pero congestiona el área.`
      : `Posesión pareja (${A.possession_avg}% vs ${B.possession_avg}%) — partido de ida y vuelta, sin dominador claro.`
    const estiloB = B.possession_avg <= 44
      ? `${B.name} juega replegado (posesión ${B.possession_avg}%): concede tiros de volumen pero bloquea los de calidad.`
      : B.possession_avg >= 56
        ? `${B.name} propone con balón (${B.possession_avg}%): deja espacios a la contra.`
        : null
    const contexto = [
      ctx.jornada === 'inicio' ? 'Inicio de temporada: rodaje irregular, la varianza sube y el expected se recorta ×0.94.' : null,
      A.tierAdj || B.tierAdj ? `${(A.tierAdj ? A : B).name} viene de división inferior — todas sus stats ya llegan descontadas a este análisis.` : null,
      '🔎 Lo que la API NO da: alineaciones confirmadas y clima. Decláralos tú en el panel "Contexto" (lluvia, motivación, descanso, derby) y el expected se ajusta al instante.',
    ].filter(Boolean)

    const REASONS = {
      goles: () => [
        (A.xg_avg != null || B.xg_avg != null)
          ? `xG real (Sofascore): ${A.name} genera ${A.xg_avg ?? '?'} xG/partido${A.xg_avg != null && Math.abs(A.xg_avg - A.gf_avg) > 0.3 ? (A.xg_avg > A.gf_avg ? ` — genera MÁS de lo que anota (${A.gf_avg}): definición fría, regresión al alza esperable` : ` — anota MÁS de lo que genera (${A.gf_avg}): sobre-rendimiento, cuidado`) : ''}. ${B.name}: ${B.xg_avg ?? '?'} xG.`
          : null,
        dominio,
        `${A.name} promedia ${A.gf_avg} goles/partido y enfrenta una defensa que concede ${B.ga_avg} (media de la liga: ${base.gaAvg}) → su expected ${B.ga_avg > base.gaAvg ? 'sube' : 'baja'}.`,
        `${B.name} promedia ${B.gf_avg} y ataca contra una defensa que concede ${A.ga_avg}.`,
        A.tierAdj ? `⬇️ ${A.name} recién llegado de división inferior — sus goles ya vienen descontados ×0.68.` : null,
        B.tierAdj ? `⬇️ ${B.name} recién llegado de división inferior — sus goles ya vienen descontados ×0.68.` : null,
        calc.goals.bttsViable
          ? `BTTS viable: ambos marcan y conceden con frecuencia (BTTS ${A.btts_pct}% y ${B.btts_pct}%).`
          : `BTTS débil (${A.btts_pct}% y ${B.btts_pct}%) — al menos uno suele quedarse en cero o dejar en cero.`,
        ...modNote('goals', 'goles'),
        ...contexto,
      ],
      corners: () => [
        A.styleReal
          ? `${A.name} lanza ${A.crosses_avg} centros/partido (Sofascore) → estilo "${A.style}" ${A.style === 'bandas' ? '— cada centro despejado es un córner en potencia: ×1.25' : A.style === 'central' ? '— juego interior, pocos córners: ×0.90' : ''}.`
          : null,
        B.styleReal
          ? `${B.name}: ${B.crosses_avg} centros/partido → estilo "${B.style}".`
          : null,
        `${A.name} genera ${A.corners_avg} córners/partido y ${B.name} concede ${B.corners_against_avg} — la interacción define el expected.`,
        `${B.name} genera ${B.corners_avg} y ${A.name} concede ${A.corners_against_avg}.`,
        `K de ${league.name} ×${league.kCorners}: ${league.kCorners > 1 ? 'liga de ritmo alto, más córners' : league.kCorners < 1 ? 'liga más pausada, menos córners' : 'factor neutro'}.`,
        ...modNote('corners', 'córners'),
      ].filter(Boolean),
      shots: () => [
        dominio,
        estiloB,
        `${A.name} remata ${A.shots_avg} veces/partido; ${B.name} concede ${B.shots_against_avg} tiros (media liga ~${base.shotsAvg}) — ${B.shots_against_avg > base.shotsAvg ? 'se deja rematar más que el promedio: sube el volumen' : 'concede menos que el promedio: recorta el volumen'}.`,
        `${B.name} remata ${B.shots_avg}; ${A.name} concede ${A.shots_against_avg}.`,
        A.tierAdj ? `⬇️ Los promedios de ${A.name} ya vienen descontados: ${A.tierAdj.lowerTierCount} partidos son de división inferior (tiros ×0.80).` : null,
        B.tierAdj ? `⬇️ Los promedios de ${B.name} ya vienen descontados: ${B.tierAdj.lowerTierCount} partidos son de división inferior (tiros ×0.80).` : null,
        `Reparto por tiempos: 1H ${calc.t.shots1h} · 2H ${calc.t.shots2h} — el 2H siempre carga más volumen.`,
        ...modNote('shots', 'tiros'),
        ...contexto,
      ].filter(Boolean),
      sot: () => [
        `Precisión de ${A.name}: ${A.sot_avg} SOT de ${A.shots_avg} tiros (${Math.round((A.sot_avg / A.shots_avg) * 100)}% a puerta).`,
        `Precisión de ${B.name}: ${B.sot_avg} de ${B.shots_avg} (${Math.round((B.sot_avg / B.shots_avg) * 100)}%).`,
        `El SOT hereda el volumen de tiros — no lo combines con Tiros Over (correlación 0.85).`,
      ],
      cards: () => [
        `Modelo causal: fricción → faltas → tarjetas. El cruce proyecta ${calc.fouls.total} faltas, y de ahí salen las tarjetas — no de un promedio pelado.`,
        `${A.name}: 1 tarjeta cada ${calc.cardsCausal.rateA > 0 ? Math.round(1 / calc.cardsCausal.rateA) : '?'} faltas (tasa ${calc.cardsCausal.rateA}) — ${calc.cardsCausal.rateA > 0.22 ? 'equipo que comete faltas "de tarjeta": tácticas o violentas' : calc.cardsCausal.rateA < 0.14 ? 'faltea suave, los árbitros le perdonan' : 'disciplina normal'}.`,
        `${B.name}: 1 cada ${calc.cardsCausal.rateB > 0 ? Math.round(1 / calc.cardsCausal.rateB) : '?'} faltas (tasa ${calc.cardsCausal.rateB}).`,
        `${A.name} recibe ${A.cards_avg} tarjetas/partido con ${A.fouls_avg} faltas; ${B.name} ${B.cards_avg} con ${B.fouls_avg} faltas.`,
        ctx.checks?.rivalidad ? `Clásico/derby marcado → tarjetas ×1.20.` : `Sin rivalidad especial marcada — si es un clásico, actívalo en Contexto.`,
        ctx.jornada === 'final' ? 'Recta final: la presión sube las tarjetas ×1.12.' : ctx.jornada === 'ko' ? 'Eliminatoria: fricción alta, tarjetas ×1.10.' : null,
        ...modNote('cards', 'tarjetas'),
      ].filter(Boolean),
      fouls: () => [
        `${A.name} comete ${A.fouls_avg} faltas/partido y recibe ${A.fouls_against_avg}; ${B.name} comete ${B.fouls_avg}.`,
        `Las faltas anticipan tarjetas y tiros libres — partidos trabados suben ambos.`,
      ],
      ti: () => [
        A.estTi ? `TI de ${A.name} ESTIMADO desde baseline de liga (${base.tiAvg}) — la API aún no trae su dato.` : `TI de ${A.name} REAL: ${A.throwins_avg}/partido (muestra: ${A.tiSample} partidos, incluye amistosos recientes).`,
        B.estTi ? `TI de ${B.name} ESTIMADO (${base.tiAvg}).` : `TI de ${B.name} REAL: ${B.throwins_avg}/partido (muestra: ${B.tiSample}).`,
        A.styleReal ? `Estilo real de ${A.name}: "${A.style}" (${A.crosses_avg} centros/partido) → ${A.style === 'bandas' ? 'mucho juego lateral, TI ×1.22' : A.style === 'central' ? 'juego interior, TI ×0.88' : A.style === 'mixto-bandas' ? 'TI ×1.10' : 'neutro'}.` : null,
        B.styleReal ? `Estilo de ${B.name}: "${B.style}" (${B.crosses_avg} centros/partido).` : null,
        `K de ${league.name} para TI ×${league.kTI}: ${league.kTI > 1 ? 'liga física con mucho juego lateral' : league.kTI < 1 ? 'liga de posesión, menos banda' : 'neutro'}.`,
        ctx.checks?.lluvia ? 'Lluvia intensa marcada → balón resbaladizo, TI ×1.15.' : null,
        ctx.checks?.rivalidad ? 'Derby físico → más duelos y pelotas divididas, TI ×1.10.' : null,
        `La posesión casi no afecta los TI (correlación -0.15) — lo que importa es el juego por bandas y la fricción.`,
        `⚠️ No combinar con Córners Over del mismo partido (correlación 0.60).`,
      ].filter(Boolean),
      gk: () => [
        `Posesión estimada: ${A.name} ${calc.gkCalc.posA}% · ${B.name} ${calc.gkCalc.posB}% — el que menos tiene el balón despeja y saca más de portería (correlación -0.72).`,
        Math.abs(A.ppg - B.ppg) > 0.4
          ? `${A.ppg < B.ppg ? A.name : B.name} es claramente inferior (PPG ${f1(Math.min(A.ppg, B.ppg))} vs ${f1(Math.max(A.ppg, B.ppg))}) → pasará el partido defendiendo → boost de GK ×${Math.abs(A.ppg - B.ppg) > 0.8 ? '1.28' : '1.10'}.`
          : `Equipos parejos en nivel (PPG ${f1(A.ppg)} vs ${f1(B.ppg)}) — sin boost por diferencia de nivel.`,
        `Un rival que remata mucho y desviado infla los GK: ${B.name} tira ${B.shots_avg}/partido hacia la portería de ${A.name}.`,
        (A.estGk || B.estGk) ? `⚠️ GK estimados — la API aún no reporta goal kicks. Verifica en la casa antes de apostar fuerte.` : `✓ GK con datos reales.`,
      ],
    }

    return (marketId) => (variantKey, line, expected, isHandicap) => {
      const bullets = []
      if (variantKey === 'teamA') bullets.push(`Mercado individual de ${A.name} — su generación propia, ajustada por lo que concede ${B.name}.`)
      if (variantKey === 'teamB') bullets.push(`Mercado individual de ${B.name} — su generación propia, ajustada por lo que concede ${A.name}.`)
      if (variantKey === 'handicap') bullets.push(`Duelo directo: PPG ${f1(A.ppg)} (${A.name}) vs ${f1(B.ppg)} (${B.name}).`)
      bullets.push(...(REASONS[marketId]?.() ?? []).filter(Boolean))
      bullets.push(commonLine(line, expected, isHandicap))
      if (A.est || B.est) bullets.push(`⚠️ Muestra de stats reducida — trata la señal con cautela.`)
      return bullets
    }
  }, [teamA, teamB, calc, league, ctx, modsA, modsB])

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">

      {/* ── Selección de equipos ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h1 className="text-xl font-bold text-white">Analizador de Partido</h1>
          <span className="text-xs text-gray-500">{league.flag} {league.name} · K córners ×{league.kCorners} · K TI ×{league.kTI}</span>
        </div>
        {teamsError && (
          <div className="rounded-lg bg-red-900/30 border border-red-700/40 px-4 py-3 text-sm text-red-300 mb-3">
            {teamsError}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Equipo Local</label>
            <select className="input-dark w-full" value={teamAId}
              onChange={e => setTeamAId(e.target.value)}>
              <option value="">Seleccionar...</option>
              {leagueTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Equipo Visitante</label>
            <select className="input-dark w-full" value={teamBId}
              onChange={e => setTeamBId(e.target.value)}>
              <option value="">Seleccionar...</option>
              {leagueTeams.filter(t => String(t.id) !== teamAId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {building && (
        <div className="card text-center py-10">
          <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-white font-semibold text-sm">Construyendo stats desde la API...</p>
          <p className="text-gray-500 text-xs mt-1">{progress || 'Descargando últimos 10 partidos por equipo'}</p>
        </div>
      )}

      {buildError && (
        <div className="rounded-lg bg-red-900/30 border border-red-700/40 px-4 py-3 text-sm text-red-300">
          Error construyendo stats: {buildError}
        </div>
      )}

      {/* ── Contexto ── */}
      {clima && (
        <div className="rounded-lg bg-blue-950/40 border border-blue-800/40 px-4 py-2.5 text-xs text-blue-200 flex items-center gap-2 flex-wrap">
          <span className="font-semibold">🌦️ Clima en {clima.city} a la hora del partido:</span>
          <span>{clima.resumen}</span>
          {(clima.sugiereCalor || clima.sugiereLluvia) && (
            <span className="text-yellow-400 font-semibold">
              → auto-activado: {[clima.sugiereCalor && 'calor extremo', clima.sugiereLluvia && 'lluvia'].filter(Boolean).join(' + ')} en el contexto
            </span>
          )}
        </div>
      )}

      {ready && (
        <div className="card border border-dark-600">
          <button onClick={() => setCtxOpen(o => !o)} className="w-full flex items-center justify-between text-left">
            <span className="font-semibold text-white text-sm">⚙️ Contexto del partido — ajusta el análisis</span>
            <span className="text-gray-400 text-lg">{ctxOpen ? '▲' : '▼'}</span>
          </button>
          {ctxOpen && (
            <div className="mt-4 border-t border-dark-600 pt-4">
              <ContextPanel ctx={ctx} onChange={setCtx} teamAName={teamA?.name} teamBName={teamB?.name} />
            </div>
          )}
        </div>
      )}

      {!ready && !building && !buildError && (
        <div className="card text-center text-gray-500 py-12">
          Selecciona los dos equipos — el motor descarga sus últimos 10 partidos y construye el análisis
        </div>
      )}

      {ready && (
        <>
          {/* ── Alertas ── */}
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
            <div className="grid grid-cols-4 md:grid-cols-8 gap-3 text-center">
              {[['Goles', calc.t.goals], ['Tiros', calc.t.shots], ['SOT', calc.t.sot], ['Córners', calc.t.corners], ['Tarjetas', calc.t.cards], ['Faltas', calc.fouls.total], ['S. Banda', calc.t.ti], ['S. Puerta', calc.t.gk]].map(([label, val]) => (
                <div key={label} className="bg-dark-800 rounded-lg p-2">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-lg font-bold text-green-400">{val}</p>
                </div>
              ))}
            </div>
            {(teamA.est || teamB.est) && (
              <p className="text-xs text-yellow-600 mt-2">⚠️ Muestra de stats reducida en {teamA.est ? teamA.name : ''}{teamA.est && teamB.est ? ' y ' : ''}{teamB.est ? teamB.name : ''} — Confidence reducido</p>
            )}
            {[teamA, teamB].filter(t => t.tierAdj).map(t => (
              <p key={t.id} className="text-xs text-orange-500 mt-1">
                ⬇️ {t.name}: {t.tierAdj.lowerTierCount} de sus últimos {t.matches} partidos son de división inferior — stats ajustadas a la baja (goles ×0.68, tiros ×0.80) y PPG descontado. Recién ascendido: trátalo con cautela.
              </p>
            ))}

            {/* ── ¿Por qué estos números? — variables aplicadas más allá del promedio ── */}
            <div className="mt-3 pt-3 border-t border-dark-600 space-y-1.5">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">🧠 Por qué este expected — variables aplicadas</p>

              <p className="text-xs text-gray-400">
                📐 <span className="text-gray-300">Base:</span> promedios ponderados de los últimos {teamA.matches} partidos (los 5 más recientes pesan 30% extra), cruzados con lo que CONCEDE el rival, normalizado contra el promedio de {league.name}.
              </p>

              {teamA.split?.home && teamA.split?.away && (
                <p className="text-xs text-gray-400">
                  🏠 <span className="text-gray-300">Localía real:</span> {teamA.name} en casa promedia {teamA.split.home.gf ?? '—'} goles y {teamA.split.home.shots ?? '—'} tiros ({teamA.split.home.n} PJ) vs {teamA.split.away.gf ?? '—'} y {teamA.split.away.shots ?? '—'} fuera — el motor pondera su condición de local.
                </p>
              )}

              {ctx.checks?.eliminacion && (
                <p className="text-xs text-orange-300">
                  ⚔️ <span className="font-semibold">Eliminación directa detectada</span> ({league.name} es formato copa): estos partidos son más cerrados y volátiles — se aplicó goles ×0.90, tiros ×0.95, tarjetas ×1.12. El que gana la ida suele especular en la vuelta. Considera stakes menores: la varianza es más alta que en liga.
                </p>
              )}

              {(league.kCorners !== 1 || league.kTI !== 1) && (
                <p className="text-xs text-gray-400">
                  ⚙️ <span className="text-gray-300">Ritmo de la competición:</span> córners ×{league.kCorners} · saques de banda ×{league.kTI} (calibrado por el estilo típico de {league.name}).
                </p>
              )}

              {clima && (
                <p className="text-xs text-gray-400">
                  🌦️ <span className="text-gray-300">Clima en {clima.city}:</span> {clima.resumen}{(clima.sugiereCalor || clima.sugiereLluvia) ? ' — se auto-aplicó el ajuste correspondiente' : ' — sin impacto relevante'}.
                </p>
              )}

              {[['bandas', 'juega por bandas → genera más córners y centros'], ['mixto-bandas', 'ataca cargado a las bandas → empuja los córners']].map(([st, txt]) => (
                [teamA, teamB].filter(t => t.style === st && t.styleReal).map(t => (
                  <p key={t.id + st} className="text-xs text-gray-400">
                    🎯 <span className="text-gray-300">{t.name}</span> {txt} (medido con centros reales de Sofascore).
                  </p>
                ))
              ))}

              {(teamA.racha?.n >= 3 || teamB.racha?.n >= 3) && (
                <p className="text-xs text-gray-400">
                  {[teamA, teamB].filter(t => t.racha?.n >= 3).map(t =>
                    `${t.racha.tipo === 'W' ? '🔥' : t.racha.tipo === 'L' ? '🥶' : '➖'} ${t.name} llega con ${t.racha.n} ${t.racha.tipo === 'W' ? 'victorias' : t.racha.tipo === 'L' ? 'derrotas' : 'empates'} seguidas`
                  ).join(' · ')} — la racha ya está reflejada en la ponderación de los últimos 5.
                </p>
              )}

              {(() => {
                const activos = Object.entries(ctx.checks ?? {}).filter(([k, v]) => v && k !== 'eliminacion')
                const modNeto = (m) => ['shots', 'goals', 'cards', 'corners'].filter(k => Math.abs((m[k] ?? 1) - 1) > 0.02)
                  .map(k => `${k === 'shots' ? 'tiros' : k === 'goals' ? 'goles' : k === 'cards' ? 'tarjetas' : 'córners'} ×${m[k].toFixed(2)}`).join(' · ')
                const netoA = modNeto(modsA); const netoB = modNeto(modsB)
                return (
                  <>
                    {activos.length > 0 && (
                      <p className="text-xs text-gray-400">
                        ⚙️ <span className="text-gray-300">Contexto activo:</span> {activos.map(([k]) => k).join(', ')} (ajustable abajo en "Contexto del partido").
                      </p>
                    )}
                    {(netoA || netoB) && (
                      <p className="text-xs text-gray-400">
                        🧮 <span className="text-gray-300">Modificadores netos:</span> {netoA && `${teamA.name}: ${netoA}`}{netoA && netoB && ' · '}{netoB && `${teamB.name}: ${netoB}`}
                      </p>
                    )}
                  </>
                )
              })()}

              {(teamA.est || teamB.est) && (
                <p className="text-xs text-yellow-600">
                  ⚠️ <span className="font-semibold">Volatilidad extra:</span> muestra de datos reducida — el expected es menos preciso de lo normal y la confianza de los picks ya viene descontada (−10). En fases previas y copas esto es común: los rivales vienen de ligas con poca cobertura de stats.
                </p>
              )}
            </div>
          </div>

          {/* ── Predicción previa guardada (registro pre-partido) ── */}
          {snapshotPrevio && (
            <div className="rounded-lg px-4 py-3 bg-purple-900/30 border border-purple-700/50 text-sm">
              <p className="text-purple-300 font-semibold">
                🔮 Predicción guardada del {new Date(snapshotPrevio.ts).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} (se conserva 7 días)
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Goles {snapshotPrevio.expected?.goals} · Tiros {snapshotPrevio.expected?.shots} · Córners {snapshotPrevio.expected?.corners} · TI {snapshotPrevio.expected?.ti} · GK {snapshotPrevio.expected?.gk}
                {snapshotPrevio.picks?.length > 0 && <span className="text-purple-400"> — Picks: {snapshotPrevio.picks.slice(0, 3).map(p => `${p.label} ${p.dir} ${p.line}`).join(' · ')}</span>}
              </p>
              <p className="text-[11px] text-gray-600 mt-1">Si el partido ya se jugó, compárala contra la realidad en Fixture → ⏪ Últimos 3 días → 📊 Stats</p>
            </div>
          )}

          {/* ── Informe IA: busca noticias, alineaciones, clima en internet ── */}
          <InformeIA teamA={teamA} teamB={teamB} league={league} calc={calc} />

          {/* ── RECOMENDADOS — ordenados por confianza ── */}
          {picks.length > 0 && (
            <div className="rounded-2xl border-2 border-green-600/60 bg-gradient-to-b from-green-950/60 to-dark-800 p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-xl font-black text-green-300 tracking-wide">🏆 RECOMENDADOS — {teamA.name} vs {teamB.name}</h2>
                <span className="text-xs text-gray-500">
                  UN pick por mercado (nunca dos del mismo) · solo líneas realistas · mercados de {league.name}: {resumenLiga(league.id).etiquetas.join(', ')}
                </span>
              </div>

              {/* ── EL PICK, literal y sin rodeos ── */}
              <div className="rounded-xl px-4 py-3 border-2 bg-green-950/60 border-green-600/70">
                <p className="text-xs font-bold text-green-300/80 uppercase tracking-widest mb-1">🎯 Te recomiendo esta apuesta:</p>
                <p className="text-xl font-black text-white">
                  <span className={picks[0].dir === 'CUBRE' ? 'text-purple-300' : picks[0].dir === 'OVER' ? 'text-green-400' : 'text-blue-400'}>
                    {picks[0].dir === 'CUBRE'
                      ? `${picks[0].line} de hándicap`
                      : `${picks[0].dir === 'OVER' ? 'MÁS' : 'MENOS'} de ${picks[0].line}`}
                  </span> {picks[0].label}
                  <span className="text-sm font-semibold text-gray-400 ml-2">P {picks[0].pMod}% · Confianza {picks[0].confidence}</span>
                </p>
              </div>

              {picks.map((pick, i) => {
                const exp = generateExplanation(pick, teamA, teamB, ctx, calc, modsA, modsB, getBaseline(league.id))
                const reasons = [...exp.pushUp, ...exp.neutral].slice(0, 5)
                return (
                  <div key={`${pick.marketKey}_${pick.line}`}
                    className={`rounded-xl p-4 border ${i === 0 ? 'bg-green-900/30 border-green-600/60' : 'bg-dark-800/80 border-dark-600'}`}>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`text-2xl font-black w-8 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : 'text-gray-600'}`}>
                        {i + 1}
                      </span>
                      <span className={`text-lg font-black px-3 py-1 rounded-lg ${
                        pick.dir === 'CUBRE' ? 'bg-purple-700 text-white'
                          : pick.dir === 'OVER' ? 'bg-green-700 text-white' : 'bg-blue-700 text-white'
                      }`}>
                        {pick.dir === 'CUBRE' ? pick.line : `${pick.dir} ${pick.line}`}
                      </span>
                      <span className="text-white font-bold text-lg">{pick.label}</span>
                      <div className="ml-auto flex items-center gap-3 text-sm">
                        <span className={`font-bold px-2 py-0.5 rounded ${
                          pick.confidence >= 70 ? 'bg-green-800 text-green-200' :
                          pick.confidence >= 60 ? 'bg-yellow-800 text-yellow-200' : 'bg-orange-900 text-orange-300'
                        }`}>
                          Confianza {pick.confidence}
                        </span>
                        <span className="text-green-300 font-semibold">P {pick.pMod}%</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-300 mt-2">{exp.summary}</p>
                    {reasons.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {reasons.map((f, k) => (
                          <p key={k} className="text-xs text-gray-400">• {f.text}</p>
                        ))}
                      </div>
                    )}
                    {exp.risks.slice(0, 2).map((r, k) => (
                      <p key={k} className="text-xs text-yellow-600/90 mt-1.5">⚠️ {r}</p>
                    ))}
                    {(() => {
                      const p = pick.pMod / 100
                      if (!p || p <= 0.05) return null
                      const min = (1.025 / p).toFixed(2)
                      const max = (1.25 / p).toFixed(2)
                      return (
                        <p className="text-sm font-bold text-green-300 mt-2 bg-green-950/60 border border-green-800/50 rounded-lg px-3 py-1.5 inline-block">
                          💰 Apuesta si la cuota está entre <span className="text-white">{min}</span> y <span className="text-white">{max}</span>
                          <span className="text-gray-500 font-normal ml-2 text-xs">menos de {min} = sin valor · más de {max} = sospechoso, la casa sabe algo</span>
                        </p>
                      )
                    })()}
                  </div>
                )
              })}

              {combo && <ComboCard combo={combo} />}
              <p className="text-xs text-gray-500">⚠️ Compara siempre con la cuota real de tu casa antes de apostar — sin cuota no hay EV.</p>
            </div>
          )}

          {/* ── Resultados recientes estilo adamchoi ── */}
          <RecentResults teamA={teamA} teamB={teamB} />

          {/* ── H2H ── */}
          <H2HCard teamA={teamA} teamB={teamB} />

          {/* ── Promedios ── */}
          <TeamStatsRef teamA={teamA} teamB={teamB} />

          {/* ── Mercados — acordeones con variantes, 2 columnas ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {[
              { id: 'goles', icon: '⚽', title: 'Goles',
                cfg: { statKey: 'gf', agKey: 'ga', expTotal: calc.t.goals, expA: calc.adj.goalsA, expB: calc.adj.goalsB, stepTotal: 0.5, stepTeam: 0.5, handicap: true } },
              { id: 'corners', icon: '🚩', title: 'Córners',
                cfg: { statKey: 'corners', agKey: 'cornersAg', expTotal: calc.t.corners, expA: calc.adj.cornA, expB: calc.adj.cornB, stepTotal: 1, stepTeam: 1, handicap: true } },
              { id: 'shots', icon: '🎯', title: 'Tiros Totales',
                cfg: { statKey: 'shots', agKey: 'shotsAg', expTotal: calc.t.shots, expA: calc.adj.shotsA, expB: calc.adj.shotsB, stepTotal: 2, stepTeam: 1, handicap: true },
                notes: [`1H: ${calc.t.shots1h} · 2H: ${calc.t.shots2h}`] },
              { id: 'sot', icon: '🥅', title: 'Tiros a Puerta (SOT)',
                cfg: { statKey: 'sot', agKey: 'sotAg', expTotal: calc.t.sot, expA: calc.adj.sotA, expB: calc.adj.sotB, stepTotal: 1, stepTeam: 1, handicap: false } },
              { id: 'cards', icon: '🟨', title: 'Tarjetas',
                cfg: { statKey: 'cards', agKey: 'cardsAg', expTotal: calc.t.cards, expA: calc.adj.cardsA, expB: calc.adj.cardsB, stepTotal: 1, stepTeam: 0.5, handicap: false } },
              { id: 'fouls', icon: '⚠️', title: 'Faltas',
                cfg: { statKey: 'fouls', agKey: 'foulsAg', expTotal: calc.fouls.total, expA: calc.fouls.expFoulsA, expB: calc.fouls.expFoulsB, stepTotal: 2, stepTeam: 1, handicap: false } },
              { id: 'ti', icon: '🔄', title: 'Saques de Banda (TI)',
                cfg: { statKey: 'ti', agKey: 'tiAg', expTotal: calc.t.ti, expA: calc.adj.tiA, expB: calc.adj.tiB, stepTotal: 2, stepTeam: 1, handicap: false },
                notes: [(teamA.estTi || teamB.estTi)
                  ? `⚠️ ${teamA.estTi ? teamA.name + ' estimado' : teamA.name + ' ✓ real'} · ${teamB.estTi ? teamB.name + ' estimado' : teamB.name + ' ✓ real'}`
                  : '✓ Saques de banda reales de ambos equipos'] },
              { id: 'gk', icon: '🧤', title: 'Saques de Portería (GK)',
                cfg: { statKey: 'gk', agKey: 'gkAg', expTotal: calc.t.gk, expA: calc.adj.gkA, expB: calc.adj.gkB, stepTotal: 1, stepTeam: 1, handicap: false },
                notes: [(teamA.estGk || teamB.estGk) ? '⚠️ GK estimado desde posesión' : '✓ Goal kicks reales'] },
            ].map(m => (
              <MarketCard key={`${m.id}_${teamA.id}_${teamB.id}`} icon={m.icon} title={m.title}
                teamA={teamA} teamB={teamB} cfg={m.cfg} notes={m.notes ?? []}
                explain={explainFor(m.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
