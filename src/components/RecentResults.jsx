import { useState, useMemo, useEffect } from 'react'
import { fetchH2H, fetchFixtureStats, hasLivescore } from '../lib/livescore-api'
import { compAbbr } from '../lib/leagues'

// ─── Panel "recent results" estilo adamchoi ──────────────────────────────────
// - Modo sincronizado (🔗): un solo stat type + highlight controla ambos paneles
// - Tabla H2H abajo con el mismo stat elegido, entre ellos dos
// Verde = mercado cumplido · Amarillo = push/empate · Rojo = falló

const t2 = (a, b) => (a != null && b != null) ? a + b : null
const bpts = (y, r) => (y != null || r != null) ? (y ?? 0) * 10 + (r ?? 0) * 25 : null

export const STAT_TYPES = [
  { key: 'result',        label: 'Match Result',              kind: 'result' },
  { key: 'btts',          label: 'Both Teams To Score',       kind: 'btts' },
  { key: 'goals_total',   label: 'Total Match Goals',         kind: 'value', getVal: r => t2(r.gf, r.ga), split: r => [r.gf, r.ga] },
  { key: 'goals_for',     label: 'Team Goals For',            kind: 'value', getVal: r => r.gf },
  { key: 'goals_ag',      label: 'Team Goals Against',        kind: 'value', getVal: r => r.ga },
  { key: 'corners_total', label: 'Total Match Corners',       kind: 'value', getVal: r => t2(r.corners, r.cornersAg), split: r => [r.corners, r.cornersAg] },
  { key: 'corners_for',   label: 'Team Corners For',          kind: 'value', getVal: r => r.corners },
  { key: 'corners_ag',    label: 'Team Corners Against',      kind: 'value', getVal: r => r.cornersAg },
  { key: 'corners_hc',    label: 'Corners Handicap',          kind: 'handicap', getVal: r => (r.corners != null && r.cornersAg != null) ? r.corners - r.cornersAg : null },
  { key: 'bp_total',      label: 'Total Booking Points',      kind: 'value', getVal: r => t2(bpts(r.yellow, r.red), bpts(r.yellowAg, r.redAg)), split: r => [bpts(r.yellow, r.red), bpts(r.yellowAg, r.redAg)] },
  { key: 'bp_for',        label: 'Team Booking Points For',   kind: 'value', getVal: r => bpts(r.yellow, r.red) },
  { key: 'bp_ag',         label: 'Team Booking Points Against', kind: 'value', getVal: r => bpts(r.yellowAg, r.redAg) },
  { key: 'bp_each',       label: 'Each Team Booking Points',  kind: 'each', getVals: r => [bpts(r.yellow, r.red), bpts(r.yellowAg, r.redAg)] },
  { key: 'most_cards',    label: 'Most Cards',                kind: 'most', getVals: r => [r.cards, r.cardsAg] },
  { key: 'cards_total',   label: 'Total Cards',               kind: 'value', getVal: r => t2(r.cards, r.cardsAg), split: r => [r.cards, r.cardsAg] },
  { key: 'cards_for',     label: 'Team Cards For',            kind: 'value', getVal: r => r.cards },
  { key: 'cards_ag',      label: 'Team Cards Against',        kind: 'value', getVal: r => r.cardsAg },
  { key: 'cards_each',    label: 'Each Team Cards',           kind: 'each', getVals: r => [r.cards, r.cardsAg] },
  { key: 'shots_total',   label: 'Match Total Shots',         kind: 'value', getVal: r => t2(r.shots, r.shotsAg), split: r => [r.shots, r.shotsAg] },
  { key: 'shots_for',     label: 'Team Total Shots For',      kind: 'value', getVal: r => r.shots },
  { key: 'shots_ag',      label: 'Team Total Shots Ag',       kind: 'value', getVal: r => r.shotsAg },
  { key: 'sot_total',     label: 'Match Shots On Target',     kind: 'value', getVal: r => t2(r.sot, r.sotAg), split: r => [r.sot, r.sotAg] },
  { key: 'sot_for',       label: 'Shots On Target For',       kind: 'value', getVal: r => r.sot },
  { key: 'sot_ag',        label: 'Shots On Target Ag',        kind: 'value', getVal: r => r.sotAg },
  { key: 'sot_each',      label: 'Shots On Target Each Team', kind: 'each', getVals: r => [r.sot, r.sotAg] },
  { key: 'offs_total',    label: 'Match Offsides',            kind: 'value', getVal: r => t2(r.offsides, r.offsidesAg), split: r => [r.offsides, r.offsidesAg] },
  { key: 'offs_for',      label: 'Offsides For',              kind: 'value', getVal: r => r.offsides },
  { key: 'offs_ag',       label: 'Offsides Against',          kind: 'value', getVal: r => r.offsidesAg },
  { key: 'fouls_total',   label: 'Match Total Fouls',         kind: 'value', getVal: r => t2(r.fouls, r.foulsAg), split: r => [r.fouls, r.foulsAg] },
  { key: 'fouls_for',     label: 'Fouls For',                 kind: 'value', getVal: r => r.fouls },
  { key: 'fouls_ag',      label: 'Fouls Against',             kind: 'value', getVal: r => r.foulsAg },
  { key: 'gk_total',      label: 'Match Goal Kicks',          kind: 'value', getVal: r => t2(r.gk, r.gkAg), split: r => [r.gk, r.gkAg] },
  { key: 'gk_for',        label: 'Goal Kicks For',            kind: 'value', getVal: r => r.gk },
  { key: 'gk_ag',         label: 'Goal Kicks Against',        kind: 'value', getVal: r => r.gkAg },
  { key: 'ti_total',      label: 'Match Throw Ins',           kind: 'value', getVal: r => t2(r.ti, r.tiAg), split: r => [r.ti, r.tiAg] },
  { key: 'ti_for',        label: 'Throw Ins For',             kind: 'value', getVal: r => r.ti },
  { key: 'ti_ag',         label: 'Throw Ins Against',         kind: 'value', getVal: r => r.tiAg },
]

function makeLines(values, isHandicap) {
  const valid = values.filter(v => v != null)
  if (!valid.length) return []
  const sorted = [...valid].sort((a, b) => a - b)
  const med = sorted[Math.floor(sorted.length / 2)]
  const step = Math.abs(med) > 30 ? 5 : Math.abs(med) > 12 ? 2 : Math.abs(med) >= 3 ? 1 : isHandicap ? 1 : 0.5
  const c = Math.floor(med) + 0.5
  const out = []
  for (let i = -3; i <= 3; i++) {
    const l = +(c + i * step).toFixed(1)
    if (isHandicap || l > 0) out.push(l)
  }
  return out
}

const RESULT_OPTS = [
  { key: 'win',  label: 'Win' },
  { key: 'draw', label: 'Draw' },
  { key: 'lose', label: 'Lose' },
]
const BTTS_OPTS = [
  { key: 'yes', label: 'BTTS: Sí' },
  { key: 'no',  label: 'BTTS: No' },
]
const MOST_OPTS = [
  { key: 'team',  label: 'El equipo (más tarjetas)' },
  { key: 'rival', label: 'El rival' },
  { key: 'tie',   label: 'Empate' },
]

function marketOptsFor(stat, rows) {
  if (stat.kind === 'result') return RESULT_OPTS
  if (stat.kind === 'btts') return BTTS_OPTS
  if (stat.kind === 'most') return MOST_OPTS
  const values = stat.kind === 'each'
    ? rows.flatMap(r => stat.getVals(r))
    : rows.map(r => stat.getVal(r))
  return makeLines(values, stat.kind === 'handicap').map(l => ({ key: l, label: `Over ${l}` }))
}

function judge(stat, r, market) {
  if (stat.kind === 'result') {
    const res = r.result === 'W' ? 'win' : r.result === 'D' ? 'draw' : 'lose'
    if (res === 'draw' && market !== 'draw') return 'push'
    return res === market ? 'hit' : 'miss'
  }
  if (stat.kind === 'btts') {
    if (r.gf == null || r.ga == null) return null
    const yes = r.gf > 0 && r.ga > 0
    return (market === 'yes') === yes ? 'hit' : 'miss'
  }
  if (stat.kind === 'most') {
    const [a, b] = stat.getVals(r)
    if (a == null || b == null) return null
    const res = a > b ? 'team' : b > a ? 'rival' : 'tie'
    return res === market ? 'hit' : res === 'tie' ? 'push' : 'miss'
  }
  if (stat.kind === 'each') {
    const [a, b] = stat.getVals(r)
    if (a == null || b == null) return null
    return (a > market && b > market) ? 'hit' : 'miss'
  }
  const v = stat.getVal(r)
  if (v == null) return null
  if (v === market) return 'push'
  return v > market ? 'hit' : 'miss'
}

function cellValue(stat, r) {
  if (stat.kind === 'result' || stat.kind === 'btts') return `${r.gf ?? '?'} - ${r.ga ?? '?'}`
  if (stat.kind === 'most' || stat.kind === 'each') {
    const [a, b] = stat.getVals(r)
    return `${a ?? '—'} : ${b ?? '—'}`
  }
  const v = stat.getVal(r)
  return v ?? '—'
}

const CELL_BG = {
  hit:  'bg-green-600/80 text-white',
  push: 'bg-yellow-600/80 text-black',
  miss: 'bg-red-700/70 text-white',
  null: 'bg-dark-600 text-gray-500',
}

// ─── Fila estándar (usada por paneles y H2H) ─────────────────────────────────
function ResultRow({ stat, r, j, boldName }) {
  const homeName = r.isHome ? boldName : r.rival
  const awayName = r.isHome ? r.rival : boldName
  const scoreDisplay = r.isHome ? `${r.gf} - ${r.ga}` : `${r.ga} - ${r.gf}`
  const val = cellValue(stat, r)
  const showScore = stat.kind === 'result' || stat.kind === 'btts'
  let splitDisplay = null
  if (stat.split) {
    const [own, ag] = stat.split(r)
    if (own != null || ag != null) {
      splitDisplay = r.isHome ? `${own ?? '—'} · ${ag ?? '—'}` : `${ag ?? '—'} · ${own ?? '—'}`
    }
  }
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <span className="text-gray-600 w-9 shrink-0">{r.date?.slice(5)}</span>
      <span className="text-purple-400/80 text-[9px] w-12 shrink-0 truncate" title={r.comp}>{compAbbr(r.comp)}</span>
      <span className={`flex-1 text-right truncate ${homeName === boldName ? 'text-white font-semibold' : 'text-gray-400'}`}>{homeName}</span>
      <span className={`w-12 text-center rounded px-1 py-0.5 font-bold shrink-0 ${CELL_BG[j ?? 'null']}`}>
        {showScore ? scoreDisplay : val}
      </span>
      <span className={`flex-1 truncate ${awayName === boldName ? 'text-white font-semibold' : 'text-gray-400'}`}>{awayName}</span>
      {splitDisplay && (
        <span className="text-gray-500 w-14 text-right shrink-0 font-mono" title="desglose local · visitante">{splitDisplay}</span>
      )}
    </div>
  )
}

function SummaryLine({ label, judgments }) {
  const hits = judgments.filter(j => j === 'hit').length
  const judged = judgments.filter(j => j != null && j !== 'push').length
  const pushes = judgments.filter(j => j === 'push').length
  if (!judged) return null
  const pct = Math.round((hits / judged) * 100)
  return (
    <p className="text-[11px] text-gray-400 pt-1 border-t border-dark-700">
      {label}: <span className={`font-bold ${pct >= 70 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
        {hits}/{judged} ({pct}%)
      </span>
      {pushes > 0 && <span className="text-yellow-600 ml-2">({pushes} push)</span>}
    </p>
  )
}

function TeamPanel({ team, accent, rows, stat, market, marketOpts, onStat, onMarket }) {
  const judgments = rows.map(r => judge(stat, r, market))
  return (
    <div className="min-w-0">
      <div className={`rounded-t-lg px-3 py-2 text-sm font-bold text-center ${accent === 'green' ? 'bg-green-800/60 text-green-200' : 'bg-blue-800/60 text-blue-200'}`}>
        {team.name} — resultados recientes
      </div>
      <div className="border border-dark-600 border-t-0 rounded-b-lg p-3 space-y-2">
        <div className="grid grid-cols-1 gap-1.5">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-gray-500 uppercase w-20 shrink-0">Stat type</label>
            <select value={stat.key} onChange={e => onStat(e.target.value)}
              className="flex-1 bg-dark-700 border border-dark-500 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-green-500">
              {STAT_TYPES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-gray-500 uppercase w-20 shrink-0">Highlight</label>
            <select value={String(market)} onChange={e => onMarket(e.target.value)}
              className="flex-1 bg-dark-700 border border-dark-500 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-green-500">
              {marketOpts.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          {rows.map((r, i) => <ResultRow key={i} stat={stat} r={r} j={judgments[i]} boldName={team.name} />)}
          {rows.length === 0 && <p className="text-xs text-gray-600 py-3 text-center">Sin partidos con este filtro</p>}
        </div>

        <SummaryLine label={marketOpts.find(o => String(o.key) === String(market))?.label} judgments={judgments} />
      </div>
    </div>
  )
}

// Convierte stats normalizadas (nombres API-Football) → shape de fila
function statsToRowFields(own, ag) {
  const n = v => (typeof v === 'string' ? parseFloat(v) : v) ?? null
  const y = n(own?.['Yellow Cards']); const rd = n(own?.['Red Cards'])
  const yAg = n(ag?.['Yellow Cards']); const rdAg = n(ag?.['Red Cards'])
  return {
    shots: n(own?.['Total Shots']), shotsAg: n(ag?.['Total Shots']),
    sot: n(own?.['Shots on Goal']), sotAg: n(ag?.['Shots on Goal']),
    corners: n(own?.['Corner Kicks']), cornersAg: n(ag?.['Corner Kicks']),
    fouls: n(own?.['Fouls']), foulsAg: n(ag?.['Fouls']),
    offsides: n(own?.['Offsides']), offsidesAg: n(ag?.['Offsides']),
    gk: n(own?.['Goal Kicks']), gkAg: n(ag?.['Goal Kicks']),
    ti: n(own?.['Throw Ins']), tiAg: n(ag?.['Throw Ins']),
    yellow: y, red: rd, yellowAg: yAg, redAg: rdAg,
    cards: y != null || rd != null ? (y ?? 0) + (rd ?? 0) : null,
    cardsAg: yAg != null || rdAg != null ? (yAg ?? 0) + (rdAg ?? 0) : null,
  }
}

export default function RecentResults({ teamA, teamB }) {
  const [homeAwayOnly, setHomeAwayOnly] = useState(false)
  const [sync, setSync] = useState(true)
  const [selA, setSelA] = useState({ stat: 'result', market: 'win' })
  const [selB, setSelB] = useState({ stat: 'result', market: 'win' })
  const [h2hRows, setH2hRows] = useState(null)

  // ── H2H: cruces con stats, en perspectiva del equipo A ──
  useEffect(() => {
    let alive = true
    if (!hasLivescore()) return
    ;(async () => {
      try {
        const h2h = await fetchH2H(teamA.id, teamB.id)
        if (!h2h.ok || !alive) return
        const rows = []
        for (const m of h2h.meetings) {
          const aIsHome = m.homeId === teamA.id
          const gf = aIsHome ? m.homeGoals : m.awayGoals
          const ga = aIsHome ? m.awayGoals : m.homeGoals
          let fields = {}
          try {
            const res = await fetchFixtureStats(m.id, m.homeId, m.awayId)
            const own = res.stats?.find(t => t.teamId === teamA.id)?.stats
            const ag  = res.stats?.find(t => t.teamId === teamB.id)?.stats
            fields = statsToRowFields(own, ag)
          } catch {}
          rows.push({
            date: m.date,
            rival: teamB.name,
            isHome: aIsHome,
            gf, ga,
            result: gf > ga ? 'W' : gf < ga ? 'L' : 'D',
            comp: m.competition ?? '',
            ...fields,
          })
          if (alive) setH2hRows([...rows])
        }
      } catch {}
    })()
    return () => { alive = false }
  }, [teamA.id, teamB.id, teamA.name, teamB.name])

  const rowsA = useMemo(() => {
    let rs = teamA.last10 ?? []
    if (homeAwayOnly) rs = rs.filter(r => r.isHome)
    return rs
  }, [teamA.last10, homeAwayOnly])

  const rowsB = useMemo(() => {
    let rs = teamB.last10 ?? []
    if (homeAwayOnly) rs = rs.filter(r => !r.isHome)
    return rs
  }, [teamB.last10, homeAwayOnly])

  const statA = STAT_TYPES.find(s => s.key === selA.stat)
  const statB = STAT_TYPES.find(s => s.key === (sync ? selA.stat : selB.stat))

  // En modo sync las líneas salen de los datos de AMBOS (mismas opciones en los dos)
  const optsA = useMemo(() => marketOptsFor(statA, sync ? [...rowsA, ...rowsB] : rowsA), [statA, rowsA, rowsB, sync])
  const optsB = useMemo(() => sync ? optsA : marketOptsFor(statB, rowsB), [sync, optsA, statB, rowsB])

  const normalize = (opts, market) =>
    opts.some(o => String(o.key) === String(market)) ? market : opts[Math.floor(opts.length / 2)]?.key

  const marketA = normalize(optsA, selA.market)
  const marketB = sync ? marketA : normalize(optsB, selB.market)

  const parseMarket = (stat, val) =>
    (stat.kind === 'result' || stat.kind === 'btts' || stat.kind === 'most') ? val : Number(val)

  const handleStat = (side) => (key) => {
    const stat = STAT_TYPES.find(s => s.key === key)
    const upd = { stat: key, market: marketOptsFor(stat, side === 'A' ? rowsA : rowsB)[0]?.key ?? 'win' }
    if (sync) { setSelA(upd); setSelB(upd) }
    else if (side === 'A') setSelA(upd)
    else setSelB(upd)
  }
  const handleMarket = (side) => (val) => {
    const stat = side === 'A' ? statA : statB
    const market = parseMarket(stat, val)
    if (sync) { setSelA(s => ({ ...s, market })); setSelB(s => ({ ...s, market })) }
    else if (side === 'A') setSelA(s => ({ ...s, market }))
    else setSelB(s => ({ ...s, market }))
  }

  // H2H usa el stat del panel A (que en sync es el de ambos)
  const h2hJudgments = (h2hRows ?? []).map(r => judge(statA, r, marketA))

  return (
    <div className="card border border-dark-600 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="font-bold text-white text-sm">📋 Resultados recientes — estilo adamchoi</p>
        <div className="flex items-center gap-2">
          <button onClick={() => setSync(v => !v)}
            title="Con el candado activo, un solo stat type y highlight controla ambos paneles y el H2H"
            className={`px-3 py-1 text-xs font-medium rounded-lg border ${
              sync ? 'bg-purple-800/60 border-purple-600 text-purple-200' : 'bg-dark-700 border-dark-500 text-gray-400'
            }`}>
            {sync ? '🔗 Sincronizado' : '🔓 Independiente'}
          </button>
          <div className="flex rounded-lg overflow-hidden border border-dark-500">
            <button onClick={() => setHomeAwayOnly(false)}
              className={`px-3 py-1 text-xs font-medium ${!homeAwayOnly ? 'bg-red-700 text-white' : 'bg-dark-700 text-gray-400'}`}>
              All matches
            </button>
            <button onClick={() => setHomeAwayOnly(true)}
              className={`px-3 py-1 text-xs font-medium ${homeAwayOnly ? 'bg-red-700 text-white' : 'bg-dark-700 text-gray-400'}`}>
              Home/Away
            </button>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-gray-600 -mt-2">
        🟩 cumplido · 🟨 push/empate · 🟥 falló · 🔗 sincronizado: mueves un selector y se mueven los dos paneles y el H2H
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TeamPanel team={teamA} accent="green" rows={rowsA}
          stat={statA} market={marketA} marketOpts={optsA}
          onStat={handleStat('A')} onMarket={handleMarket('A')} />
        <TeamPanel team={teamB} accent="blue" rows={rowsB}
          stat={statB} market={marketB} marketOpts={optsB}
          onStat={handleStat('B')} onMarket={handleMarket('B')} />
      </div>

      {/* ── H2H con el mismo stat ── */}
      {h2hRows?.length > 0 && (
        <div>
          <div className="rounded-t-lg px-3 py-2 text-sm font-bold text-center bg-purple-800/60 text-purple-200">
            Head to Head — {statA.label}
          </div>
          <div className="border border-dark-600 border-t-0 rounded-b-lg p-3 space-y-1">
            {h2hRows.map((r, i) => <ResultRow key={i} stat={statA} r={r} j={h2hJudgments[i]} boldName={teamA.name} />)}
            <SummaryLine
              label={`${optsA.find(o => String(o.key) === String(marketA))?.label} en el H2H (perspectiva ${teamA.name})`}
              judgments={h2hJudgments} />
            <p className="text-[10px] text-gray-600 pt-1">Mismo stat y highlight que el panel de {teamA.name} · algunos cruces viejos no tienen stats (celda gris)</p>
          </div>
        </div>
      )}

      <p className="text-[10px] text-gray-600">
        No disponibles con esta API: First/Second Half Corners y Tackles.
      </p>
    </div>
  )
}
