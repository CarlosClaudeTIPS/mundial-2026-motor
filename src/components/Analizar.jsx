import { useState, useMemo, useEffect } from 'react'
import { TEAMS, SEDES, MATCHES } from '../lib/teams'
import { calcExpectedCorners, calcExpectedShots, altitudeCorrection } from '../lib/engine'

// ─── Recommendation logic ─────────────────────────────────────────────────────
function recommend(expected, line) {
  const margin = (expected - line) / line
  if (margin > 0.08)  return { dir: 'OVER',  conf: 'alta',    icon: '✅' }
  if (margin > 0.03)  return { dir: 'OVER',  conf: 'media',   icon: '⚠️' }
  if (margin < -0.08) return { dir: 'UNDER', conf: 'alta',    icon: '✅' }
  if (margin < -0.03) return { dir: 'UNDER', conf: 'media',   icon: '⚠️' }
  return { dir: null, conf: null, icon: '❌' }
}

function pct(margin) {
  const v = Math.round(margin * 100)
  return v > 0 ? `+${v}%` : `${v}%`
}

// ─── MarketTable component ────────────────────────────────────────────────────
function MarketTable({ label, expected, lines, unit = '' }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-1">
        <span className="font-semibold text-white">{label}</span>
        {' '}— expected: <span className="text-green-400 font-bold">{expected}{unit}</span>
      </p>
      <div className="space-y-0.5">
        {lines.map(line => {
          const { dir, conf, icon } = recommend(expected, line)
          const margin = (expected - line) / line
          const label2 = dir
            ? `${icon} ${dir} — ${conf === 'alta' ? 'Alta confianza' : 'Media confianza'} (exp: ${pct(margin)} sobre línea)`
            : `${icon} Sin recomendación clara`
          return (
            <div key={line} className="flex items-center gap-3 text-xs py-0.5">
              <span className="w-16 text-gray-500 shrink-0">O/U {line}</span>
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

// ─── SideBySide — two MarketTables side by side ───────────────────────────────
function SideBySide({ labelA, expA, labelB, expB, lines, unit = '' }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <MarketTable label={labelA} expected={expA} lines={lines} unit={unit} />
      <MarketTable label={labelB} expected={expB} lines={lines} unit={unit} />
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div className="card space-y-4">
      <h2 className="font-bold text-white border-b border-dark-600 pb-2 text-sm tracking-wide uppercase">
        {title}
      </h2>
      {children}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Analizar() {
  const [teamAId, setTeamAId] = useState('')
  const [teamBId, setTeamBId] = useState('')
  const [sedeId, setSedeId]   = useState('')

  const teamA = TEAMS.find(t => t.id === teamAId)
  const teamB = TEAMS.find(t => t.id === teamBId)

  // Auto-detect match from fixture when both teams are selected
  const matchInfo = useMemo(() => {
    if (!teamAId || !teamBId) return null
    return MATCHES.find(m =>
      (m.teamA === teamAId && m.teamB === teamBId) ||
      (m.teamA === teamBId && m.teamB === teamAId)
    ) || null
  }, [teamAId, teamBId])

  // Auto-fill sede from fixture; allow manual override
  useEffect(() => {
    if (matchInfo) setSedeId(matchInfo.ciudad)
  }, [matchInfo])

  const sede   = SEDES.find(s => s.ciudad === sedeId)
  const altMod = sede ? altitudeCorrection(sede.altitud) : 1

  const calc = useMemo(() => {
    if (!teamA || !teamB) return null

    // Shots
    const shots = calcExpectedShots(teamA, teamB, altMod)
    // Corners
    const corners = calcExpectedCorners(teamA, teamB)

    // 1H shots
    const sh1A = +(teamA.shots_1h * altMod).toFixed(2)
    const sh1B = +(teamB.shots_1h * altMod).toFixed(2)
    const sh2A = +(teamA.shots_2h * altMod).toFixed(2)
    const sh2B = +(teamB.shots_2h * altMod).toFixed(2)
    const sot1A = +(teamA.sot_1h).toFixed(2)
    const sot1B = +(teamB.sot_1h).toFixed(2)
    const sot2A = +(teamA.sot_2h).toFixed(2)
    const sot2B = +(teamB.sot_2h).toFixed(2)

    // Corners 1H/2H
    const c1A = +teamA.corners_1h.toFixed(2)
    const c1B = +teamB.corners_1h.toFixed(2)
    const c2A = +teamA.corners_2h.toFixed(2)
    const c2B = +teamB.corners_2h.toFixed(2)

    // Goals
    const gfA = +(teamA.gf_avg * altMod).toFixed(2)
    const gfB = +(teamB.gf_avg * altMod).toFixed(2)
    const g1A = +(teamA.goals_1h).toFixed(2)
    const g1B = +(teamB.goals_1h).toFixed(2)
    const g2A = +(teamA.goals_2h).toFixed(2)
    const g2B = +(teamB.goals_2h).toFixed(2)

    // Cards
    const cardsA = +teamA.cards_avg.toFixed(2)
    const cardsB = +teamB.cards_avg.toFixed(2)
    const c1hA = +teamA.cards_1h.toFixed(2)
    const c1hB = +teamB.cards_1h.toFixed(2)
    const c2hA = +teamA.cards_2h.toFixed(2)
    const c2hB = +teamB.cards_2h.toFixed(2)

    // GK / Throw-ins
    const gkA = +teamA.goalkicks_avg.toFixed(2)
    const gkB = +teamB.goalkicks_avg.toFixed(2)
    const tiA = +teamA.throwins_avg.toFixed(2)
    const tiB = +teamB.throwins_avg.toFixed(2)

    return {
      // Shots full
      shotsTotal:  shots.totalShots,
      sotTotal:    shots.totalSOT,
      shotsA:      shots.expShotsA,
      shotsB:      shots.expShotsB,
      sotA:        shots.expSOTA,
      sotB:        shots.expSOTB,
      // Shots 1H/2H total
      shots1H: +(sh1A + sh1B).toFixed(2),
      shots2H: +(sh2A + sh2B).toFixed(2),
      sot1H:   +(sot1A + sot1B).toFixed(2),
      sot2H:   +(sot2A + sot2B).toFixed(2),
      // Shots 1H/2H per team
      sh1A, sh1B, sh2A, sh2B,
      sot1A, sot1B, sot2A, sot2B,
      // Corners
      cornersTotal: corners.total,
      cornersA: corners.expA,
      cornersB: corners.expB,
      corners1H: +(c1A + c1B).toFixed(2),
      corners2H: +(c2A + c2B).toFixed(2),
      c1A, c1B, c2A, c2B,
      // Goals
      goalsTotal: +(gfA + gfB).toFixed(2),
      gfA, gfB,
      goals1H: +(g1A + g1B).toFixed(2),
      goals2H: +(g2A + g2B).toFixed(2),
      g1A, g1B, g2A, g2B,
      // Cards
      cardsTotal: +(cardsA + cardsB).toFixed(2),
      cardsA, cardsB,
      cards1H: +(c1hA + c1hB).toFixed(2),
      cards2H: +(c2hA + c2hB).toFixed(2),
      c1hA, c1hB, c2hA, c2hB,
      // GK / TI
      gkTotal: +(gkA + gkB).toFixed(2),
      gkA, gkB,
      tiTotal: +(tiA + tiB).toFixed(2),
      tiA, tiB,
    }
  }, [teamA, teamB, altMod])

  const ready = !!calc

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* ── Selección de equipos ── */}
      <div className="card">
        <h1 className="text-xl font-bold text-white mb-4">Analizador de Partido</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Equipo Local</label>
            <select className="input-dark w-full" value={teamAId} onChange={e => { setTeamAId(e.target.value); setTeamBId('') }}>
              <option value="">Seleccionar...</option>
              {TEAMS.map(t => <option key={t.id} value={t.id}>{t.name} ({t.group})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Equipo Visitante</label>
            <select className="input-dark w-full" value={teamBId} onChange={e => setTeamBId(e.target.value)}>
              <option value="">Seleccionar...</option>
              {TEAMS.filter(t => t.id !== teamAId).map(t => <option key={t.id} value={t.id}>{t.name} ({t.group})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">
              Sede {matchInfo ? <span className="text-green-500">(auto-detectada)</span> : <span className="text-gray-600">(opcional)</span>}
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
            {sede?.altitud > 1800 && <span className="text-yellow-400">⛰️ Altitud: {sede.altitud}m — corrección aplicada</span>}
          </div>
        )}
      </div>

      {!ready && (
        <div className="card text-center text-gray-500 py-12">
          Selecciona los dos equipos para ver el análisis completo
        </div>
      )}

      {ready && (
        <>
          {/* ── RESUMEN EXPECTED ── */}
          <div className="card bg-dark-700">
            <h2 className="text-xs text-gray-400 uppercase tracking-wide mb-3">Resumen Expected — {teamA.name} vs {teamB.name}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              {[
                ['Tiros', calc.shotsTotal],
                ['SOT', calc.sotTotal],
                ['Córners', calc.cornersTotal],
                ['Goles', calc.goalsTotal],
                ['Tarjetas', calc.cardsTotal],
                ['Saques GK', calc.gkTotal],
                ['Throw-ins', calc.tiTotal],
              ].map(([label, val]) => (
                <div key={label} className="bg-dark-800 rounded-lg p-2">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-lg font-bold text-green-400">{val}</p>
                </div>
              ))}
            </div>
            {teamA.est && <p className="text-xs text-yellow-600 mt-2">⚠️ {teamA.name}: datos estimados — confianza reducida</p>}
            {teamB.est && <p className="text-xs text-yellow-600 mt-1">⚠️ {teamB.name}: datos estimados — confianza reducida</p>}
            {sede?.altitud > 1800 && <p className="text-xs text-yellow-400 mt-1">⛰️ Corrección altitud ×{altMod} ({sede.altitud}m)</p>}
          </div>

          {/* ── 1. TIROS TOTALES ── */}
          <Section title="Tiros — Partido Completo">
            <MarketTable label="Tiros Totales" expected={calc.shotsTotal}
              lines={[19.5, 21.5, 23.5, 25.5, 27.5]} />
            <MarketTable label="SOT Totales" expected={calc.sotTotal}
              lines={[6.5, 7.5, 8.5, 9.5, 10.5]} />
          </Section>

          {/* ── 2. TIROS POR EQUIPO ── */}
          <Section title="Tiros — Por Equipo">
            <SideBySide
              labelA={`Tiros ${teamA.name}`} expA={calc.shotsA}
              labelB={`Tiros ${teamB.name}`} expB={calc.shotsB}
              lines={[4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5]} />
            <SideBySide
              labelA={`SOT ${teamA.name}`} expA={calc.sotA}
              labelB={`SOT ${teamB.name}`} expB={calc.sotB}
              lines={[2.5, 3.5, 4.5, 5.5, 6.5]} />
          </Section>

          {/* ── 3. TIROS POR TIEMPO ── */}
          <Section title="Tiros — Por Tiempo">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MarketTable label="Tiros Totales 1H" expected={calc.shots1H} lines={[4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5]} />
              <MarketTable label="Tiros Totales 2H" expected={calc.shots2H} lines={[4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5]} />
              <MarketTable label="SOT Totales 1H"   expected={calc.sot1H}   lines={[2.5, 3.5, 4.5, 5.5, 6.5]} />
              <MarketTable label="SOT Totales 2H"   expected={calc.sot2H}   lines={[2.5, 3.5, 4.5, 5.5, 6.5]} />
            </div>
            <div className="border-t border-dark-600 pt-4">
              <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Por equipo por tiempo</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <MarketTable label={`Tiros ${teamA.name} 1H`} expected={calc.sh1A} lines={[2.5, 3.5, 4.5, 5.5, 6.5, 7.5]} />
                <MarketTable label={`Tiros ${teamB.name} 1H`} expected={calc.sh1B} lines={[2.5, 3.5, 4.5, 5.5, 6.5, 7.5]} />
                <MarketTable label={`Tiros ${teamA.name} 2H`} expected={calc.sh2A} lines={[2.5, 3.5, 4.5, 5.5, 6.5, 7.5]} />
                <MarketTable label={`Tiros ${teamB.name} 2H`} expected={calc.sh2B} lines={[2.5, 3.5, 4.5, 5.5, 6.5, 7.5]} />
                <MarketTable label={`SOT ${teamA.name} 1H`}   expected={calc.sot1A} lines={[1.5, 2.5, 3.5, 4.5]} />
                <MarketTable label={`SOT ${teamB.name} 1H`}   expected={calc.sot1B} lines={[1.5, 2.5, 3.5, 4.5]} />
                <MarketTable label={`SOT ${teamA.name} 2H`}   expected={calc.sot2A} lines={[1.5, 2.5, 3.5, 4.5]} />
                <MarketTable label={`SOT ${teamB.name} 2H`}   expected={calc.sot2B} lines={[1.5, 2.5, 3.5, 4.5]} />
              </div>
            </div>
          </Section>

          {/* ── 4. CÓRNERS ── */}
          <Section title="Córners">
            <MarketTable label="Córners Totales" expected={calc.cornersTotal}
              lines={[7.5, 8.5, 9.5, 10.5, 11.5]} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MarketTable label="Córners 1H" expected={calc.corners1H} lines={[3.5, 4.5, 5.5]} />
              <MarketTable label="Córners 2H" expected={calc.corners2H} lines={[4.5, 5.5, 6.5]} />
            </div>
            <SideBySide
              labelA={`Córners ${teamA.name}`} expA={calc.cornersA}
              labelB={`Córners ${teamB.name}`} expB={calc.cornersB}
              lines={[3.5, 4.5, 5.5, 6.5]} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MarketTable label={`Córners ${teamA.name} 1H`} expected={calc.c1A} lines={[1.5, 2.5, 3.5, 4.5]} />
              <MarketTable label={`Córners ${teamB.name} 1H`} expected={calc.c1B} lines={[1.5, 2.5, 3.5, 4.5]} />
              <MarketTable label={`Córners ${teamA.name} 2H`} expected={calc.c2A} lines={[2.5, 3.5, 4.5, 5.5]} />
              <MarketTable label={`Córners ${teamB.name} 2H`} expected={calc.c2B} lines={[2.5, 3.5, 4.5, 5.5]} />
            </div>
          </Section>

          {/* ── 5. GOLES ── */}
          <Section title="Goles">
            <MarketTable label="Goles Totales" expected={calc.goalsTotal}
              lines={[0.5, 1.5, 2.5, 3.5]} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MarketTable label="Goles 1H" expected={calc.goals1H} lines={[0.5, 1.5]} />
              <MarketTable label="Goles 2H" expected={calc.goals2H} lines={[0.5, 1.5]} />
            </div>
            <SideBySide
              labelA={`Goles ${teamA.name}`} expA={calc.gfA}
              labelB={`Goles ${teamB.name}`} expB={calc.gfB}
              lines={[0.5, 1.5]} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MarketTable label={`Goles ${teamA.name} 1H`} expected={calc.g1A} lines={[0.5, 1.5]} />
              <MarketTable label={`Goles ${teamB.name} 1H`} expected={calc.g1B} lines={[0.5, 1.5]} />
              <MarketTable label={`Goles ${teamA.name} 2H`} expected={calc.g2A} lines={[0.5, 1.5]} />
              <MarketTable label={`Goles ${teamB.name} 2H`} expected={calc.g2B} lines={[0.5, 1.5]} />
            </div>
          </Section>

          {/* ── 6. TARJETAS ── */}
          <Section title="Tarjetas">
            <MarketTable label="Tarjetas Totales" expected={calc.cardsTotal}
              lines={[1.5, 2.5, 3.5, 4.5, 5.5]} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MarketTable label="Tarjetas 1H" expected={calc.cards1H} lines={[0.5, 1.5, 2.5]} />
              <MarketTable label="Tarjetas 2H" expected={calc.cards2H} lines={[0.5, 1.5, 2.5]} />
            </div>
            <SideBySide
              labelA={`Tarjetas ${teamA.name}`} expA={calc.cardsA}
              labelB={`Tarjetas ${teamB.name}`} expB={calc.cardsB}
              lines={[0.5, 1.5, 2.5, 3.5]} />
          </Section>

          {/* ── 7. SAQUES ── */}
          <Section title="Saques de Portería y Banda">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MarketTable label="Saques de Portería Totales" expected={calc.gkTotal}
                lines={[18.5, 20.5, 22.5, 24.5, 26.5]} />
              <MarketTable label="Throw-ins Totales" expected={calc.tiTotal}
                lines={[49.5, 54.5, 59.5, 64.5, 69.5]} />
            </div>
            <SideBySide
              labelA={`GK ${teamA.name}`} expA={calc.gkA}
              labelB={`GK ${teamB.name}`} expB={calc.gkB}
              lines={[9.5, 10.5, 11.5, 12.5, 13.5]} />
            <SideBySide
              labelA={`Throw-ins ${teamA.name}`} expA={calc.tiA}
              labelB={`Throw-ins ${teamB.name}`} expB={calc.tiB}
              lines={[24.5, 27.5, 29.5, 32.5, 34.5]} />
          </Section>
        </>
      )}
    </div>
  )
}
