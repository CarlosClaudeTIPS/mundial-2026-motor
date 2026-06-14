import { useState } from 'react'
import { TEAMS, SEDES } from '../lib/teams'
import {
  calcExpectedCorners, calcExpectedShots, calcEV, calcConfidence, calcRisk,
  getVeredicto, minCuotaForEV, poissonOver, altitudeCorrection, CONFIDENCE_THRESHOLDS
} from '../lib/engine'
import { savePick } from '../lib/storage'

const MARKETS = [
  { id: 'corners',  label: 'Córners',      lines: [7.5, 8.5, 9.5, 10.5] },
  { id: 'goals',    label: 'Goles',         lines: [1.5, 2.5, 3.5] },
  { id: 'sot',      label: 'SOT',           lines: [7.5, 8.5, 9.5] },
  { id: 'cards',    label: 'Tarjetas',      lines: [1.5, 2.5, 3.5, 4.5] },
]

function Badge({ v }) {
  const cl = v === 'ACTIVO' ? 'badge-green' : v === 'MARGINAL' ? 'badge-yellow' : 'badge-red'
  return <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${cl}`}>{v}</span>
}

export default function Analizar() {
  const [teamAId, setTeamAId] = useState('')
  const [teamBId, setTeamBId] = useState('')
  const [sede, setSede] = useState('')
  const [tactical, setTactical] = useState('mixto')
  const [profile, setProfile] = useState('moderado')
  const [lineupA, setLineupA] = useState('none')
  const [lineupB, setLineupB] = useState('none')
  const [absences, setAbsences] = useState(0)
  const [situacion, setSituacion] = useState({ A: 'ya_clasificado', B: 'ya_clasificado' })
  const [quotes, setQuotes] = useState({})
  const [result, setResult] = useState(null)
  const [savedMsg, setSavedMsg] = useState('')

  const teamA = TEAMS.find(t => t.id === teamAId)
  const teamB = TEAMS.find(t => t.id === teamBId)
  const sedeObj = SEDES.find(s => s.ciudad === sede)
  const altCorr = sedeObj ? altitudeCorrection(sedeObj.altitud) : 1

  function setQuote(market, line, val) {
    setQuotes(q => ({ ...q, [`${market}_${line}`]: val }))
  }

  function analyze() {
    if (!teamA || !teamB) return

    const corners = calcExpectedCorners(teamA, teamB, tactical, 'empate')
    const shots = calcExpectedShots(teamA, teamB, altCorr * (1 - absences * 0.05), 1.0)

    const confBase = {
      lineupConfirmed: lineupA === 'confirmed' && lineupB === 'confirmed',
      lineupProbable: lineupA === 'probable' || lineupB === 'probable',
      dataConsistent: true,
      tacticalAligned: true,
      oddsStable: true,
      doubtfulPlayers: 0,
      confirmedAbsences: absences,
      contradictoryStats: false,
      matchesInWindow: Math.min(teamA.matches, teamB.matches),
    }

    const picks = []

    MARKETS.forEach(({ id, label, lines }) => {
      lines.forEach(line => {
        const cuota = parseFloat(quotes[`${id}_${line}`])
        if (!cuota || cuota <= 1) return

        let lambda
        if (id === 'corners') lambda = corners.total
        else if (id === 'goals') lambda = (teamA.gf_avg + teamB.gf_avg) * altCorr
        else if (id === 'sot') lambda = shots.totalSOT
        else if (id === 'cards') lambda = (teamA.cards_avg + teamB.cards_avg)

        const pModelo = poissonOver(lambda, line)
        const { ev, evPct, isActive } = calcEV(pModelo, cuota)
        const confidence = calcConfidence(confBase)
        const risk = calcRisk({ market: id, neutralVenue: true, matchesInWindow: confBase.matchesInWindow })
        const veredicto = getVeredicto(ev, confidence, risk, id, profile)
        const minCuota = minCuotaForEV(pModelo)

        picks.push({
          market: label, line, pModelo: +(pModelo * 100).toFixed(1),
          cuota, evPct, confidence, risk, veredicto, minCuota,
          marketId: id,
        })
      })
    })

    setResult({ corners, shots, picks, teamA, teamB })
  }

  function handleSavePick(pick) {
    savePick({
      partido: `${teamA.name} vs ${teamB.name}`,
      mercado: pick.market,
      linea: pick.line,
      cuota: pick.cuota,
      pModelo: pick.pModelo,
      ev: pick.evPct,
      confidence: pick.confidence,
      risk: pick.risk,
      resultado: null,
    })
    setSavedMsg(`Pick guardado: ${pick.market} O${pick.line}`)
    setTimeout(() => setSavedMsg(''), 2000)
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Analizador de Partido</h1>
        <p className="text-gray-400 text-sm">Selecciona dos equipos y carga las cuotas por mercado</p>
      </div>

      {/* Configuración */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card space-y-4">
          <h2 className="font-semibold text-white">Equipos</h2>
          <div className="space-y-2">
            <label className="text-xs text-gray-400">Equipo A (Local)</label>
            <select className="input-dark w-full" value={teamAId} onChange={e => setTeamAId(e.target.value)}>
              <option value="">Seleccionar...</option>
              {TEAMS.map(t => <option key={t.id} value={t.id}>{t.name} (Grupo {t.group})</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-gray-400">Equipo B (Visitante)</label>
            <select className="input-dark w-full" value={teamBId} onChange={e => setTeamBId(e.target.value)}>
              <option value="">Seleccionar...</option>
              {TEAMS.filter(t => t.id !== teamAId).map(t => <option key={t.id} value={t.id}>{t.name} (Grupo {t.group})</option>)}
            </select>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-white">Variables</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Sede</label>
              <select className="input-dark w-full" value={sede} onChange={e => setSede(e.target.value)}>
                <option value="">Sin sede</option>
                {SEDES.map(s => <option key={s.ciudad} value={s.ciudad}>{s.ciudad} {s.altitud > 1800 ? '⛰️' : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Estilo táctico</label>
              <select className="input-dark w-full" value={tactical} onChange={e => setTactical(e.target.value)}>
                <option value="bandas">Bandas ×1.25</option>
                <option value="mixto-bandas">Mixto-Bandas ×1.10</option>
                <option value="mixto">Mixto ×1.00</option>
                <option value="central">Central ×0.90</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Alineación A</label>
              <select className="input-dark w-full" value={lineupA} onChange={e => setLineupA(e.target.value)}>
                <option value="none">Desconocida</option>
                <option value="probable">Probable</option>
                <option value="confirmed">Confirmada</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Alineación B</label>
              <select className="input-dark w-full" value={lineupB} onChange={e => setLineupB(e.target.value)}>
                <option value="none">Desconocida</option>
                <option value="probable">Probable</option>
                <option value="confirmed">Confirmada</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Bajas confirmadas</label>
              <input type="number" min="0" max="5" className="input-dark w-full" value={absences} onChange={e => setAbsences(+e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Perfil riesgo</label>
              <select className="input-dark w-full" value={profile} onChange={e => setProfile(e.target.value)}>
                <option value="conservador">Conservador (≤40)</option>
                <option value="moderado">Moderado (≤55)</option>
                <option value="agresivo">Agresivo (≤75)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Cuotas por mercado */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-white">Cuotas por mercado</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {MARKETS.map(({ id, label, lines }) => (
            <div key={id}>
              <p className="text-sm font-medium text-gray-300 mb-2">{label}</p>
              <div className="grid grid-cols-2 gap-2">
                {lines.map(line => (
                  <div key={line} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-14">O {line}</span>
                    <input
                      type="number" step="0.01" min="1" placeholder="1.85"
                      className="input-dark w-full"
                      value={quotes[`${id}_${line}`] || ''}
                      onChange={e => setQuote(id, line, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button className="btn-primary" onClick={analyze} disabled={!teamA || !teamB}>
          Analizar partido
        </button>
      </div>

      {/* Comparativa equipos */}
      {result && (
        <>
          <div className="card space-y-4">
            <h2 className="font-semibold text-white">Comparativa</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs border-b border-dark-600">
                    <th className="text-left py-2 px-3">Métrica</th>
                    <th className="text-center py-2 px-3 text-blue-400">{result.teamA.name}</th>
                    <th className="text-center py-2 px-3 text-orange-400">{result.teamB.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['PPG', 'ppg'],
                    ['Goles/P', 'gf_avg'],
                    ['Goles contra/P', 'ga_avg'],
                    ['CS%', 'cs_pct'],
                    ['BTTS%', 'btts_pct'],
                    ['Tiros/P', 'shots_avg'],
                    ['SOT/P', 'sot_avg'],
                    ['Córners/P', 'corners_avg'],
                    ['Tarjetas/P', 'cards_avg'],
                  ].map(([label, key]) => (
                    <tr key={key} className="border-b border-dark-700">
                      <td className="py-2 px-3 text-gray-400">{label}</td>
                      <td className="py-2 px-3 text-center text-white">{result.teamA[key]?.toFixed?.(2) ?? '—'}</td>
                      <td className="py-2 px-3 text-center text-white">{result.teamB[key]?.toFixed?.(2) ?? '—'}</td>
                    </tr>
                  ))}
                  <tr className="border-b border-dark-700 bg-dark-700/30">
                    <td className="py-2 px-3 text-purple-400 font-medium">Exp. Córners</td>
                    <td className="py-2 px-3 text-center text-purple-300">{result.corners.expA}</td>
                    <td className="py-2 px-3 text-center text-purple-300">{result.corners.expB}</td>
                  </tr>
                  <tr className="border-b border-dark-700 bg-dark-700/30">
                    <td className="py-2 px-3 text-purple-400 font-medium">Exp. SOT</td>
                    <td className="py-2 px-3 text-center text-purple-300">{result.shots.expSOTA}</td>
                    <td className="py-2 px-3 text-center text-purple-300">{result.shots.expSOTB}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-gray-400">
              <span>Total córners esperados: <strong className="text-white">{result.corners.total}</strong></span>
              <span>Total tiros esperados: <strong className="text-white">{result.shots.totalShots}</strong></span>
              <span>Total SOT esperados: <strong className="text-white">{result.shots.totalSOT}</strong></span>
              {sedeObj?.altitud > 1800 && (
                <span className="text-yellow-400">⛰️ Corrección altitud ×{altCorr} ({sedeObj.altitud}m)</span>
              )}
            </div>
          </div>

          {/* Tabla de picks */}
          {result.picks.length > 0 && (
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-white">Tabla de Picks</h2>
                {savedMsg && <span className="text-green-400 text-sm">{savedMsg}</span>}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b border-dark-600 uppercase tracking-wide">
                      <th className="text-left py-2 px-2">Mercado</th>
                      <th className="text-center py-2 px-2">Línea</th>
                      <th className="text-center py-2 px-2">P_modelo</th>
                      <th className="text-center py-2 px-2">EV%</th>
                      <th className="text-center py-2 px-2">Conf</th>
                      <th className="text-center py-2 px-2">Risk</th>
                      <th className="text-center py-2 px-2">Veredicto</th>
                      <th className="text-center py-2 px-2">Cuota mín</th>
                      <th className="text-center py-2 px-2">Guardar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.picks.map((pick, i) => (
                      <tr key={i} className="border-b border-dark-700 hover:bg-dark-700/20">
                        <td className="py-2 px-2 font-medium text-white">{pick.market}</td>
                        <td className="py-2 px-2 text-center text-gray-300">O{pick.line}</td>
                        <td className="py-2 px-2 text-center text-gray-300">{pick.pModelo}%</td>
                        <td className={`py-2 px-2 text-center font-semibold ${pick.evPct > 2.5 ? 'text-green-400' : pick.evPct > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {pick.evPct > 0 ? '+' : ''}{pick.evPct}%
                        </td>
                        <td className={`py-2 px-2 text-center ${pick.confidence >= (CONFIDENCE_THRESHOLDS[pick.marketId] ?? 65) ? 'text-green-400' : 'text-yellow-400'}`}>
                          {pick.confidence}
                        </td>
                        <td className={`py-2 px-2 text-center ${pick.risk <= 40 ? 'text-green-400' : pick.risk <= 55 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {pick.risk}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <Badge v={pick.veredicto} />
                        </td>
                        <td className="py-2 px-2 text-center text-gray-300">{pick.minCuota ?? '—'}</td>
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={() => handleSavePick(pick)}
                            className="text-xs bg-dark-600 hover:bg-green-700 px-2 py-0.5 rounded transition-colors"
                          >
                            +
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.picks.length === 0 && (
            <div className="card text-center text-gray-500 py-8">
              Ingresa al menos una cuota para ver los picks
            </div>
          )}
        </>
      )}
    </div>
  )
}
