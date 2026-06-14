import { useState, useEffect } from 'react'
import { TEAMS } from '../lib/teams'
import { getSituationS, getTacticalK, calcLiveExpected, poissonOver, calcEV } from '../lib/engine'

export default function EnVivo() {
  const [teamAId, setTeamAId] = useState('')
  const [teamBId, setTeamBId] = useState('')
  const [minuto, setMinuto] = useState(45)
  const [golesA, setGolesA] = useState(0)
  const [golesB, setGolesB] = useState(0)
  const [cornersAc, setCornersAc] = useState(4)
  const [tirosAc, setTirosAc] = useState(8)
  const [sotAc, setSotAc] = useState(3)
  const [tarjetasAc, setTarjetasAc] = useState(1)
  const [cambios, setCambios] = useState(0)
  const [zona, setZona] = useState('mixto')
  const [cuotasVivo, setCuotasVivo] = useState({})
  const [calc, setCalc] = useState(null)

  const teamA = TEAMS.find(t => t.id === teamAId)
  const teamB = TEAMS.find(t => t.id === teamBId)
  const minutosRestantes = Math.max(0, 90 - minuto)

  function recalcular() {
    if (!teamA || !teamB || minuto <= 0) return

    const goalDiff = golesA - golesB
    const situationS = getSituationS(goalDiff)
    const tacticalK = getTacticalK(zona)

    const corners = calcLiveExpected({ statAcumulada: cornersAc, minutos: minuto, minutosRestantes, situationS, tacticalK })
    const shots = calcLiveExpected({ statAcumulada: tirosAc, minutos: minuto, minutosRestantes, situationS, tacticalK: 1 })
    const sot = calcLiveExpected({ statAcumulada: sotAc, minutos: minuto, minutosRestantes, situationS, tacticalK: 1 })
    const cards = calcLiveExpected({ statAcumulada: tarjetasAc, minutos: minuto, minutosRestantes, situationS, tacticalK: 1 })

    const proyectCorners = cornersAc + corners.lambda
    const proyectShots = tirosAc + shots.lambda
    const proyectSOT = sotAc + sot.lambda
    const proyectCards = tarjetasAc + cards.lambda

    const markets = [
      { label: 'Córners O8.5', lambda: proyectCorners, line: 8.5, acum: cornersAc, cuotaKey: 'c85' },
      { label: 'Córners O9.5', lambda: proyectCorners, line: 9.5, acum: cornersAc, cuotaKey: 'c95' },
      { label: 'SOT O7.5',     lambda: proyectSOT,     line: 7.5, acum: sotAc,     cuotaKey: 's75' },
      { label: 'SOT O8.5',     lambda: proyectSOT,     line: 8.5, acum: sotAc,     cuotaKey: 's85' },
      { label: 'Tarjetas O2.5',lambda: proyectCards,   line: 2.5, acum: tarjetasAc,cuotaKey: 't25' },
      { label: 'Tarjetas O3.5',lambda: proyectCards,   line: 3.5, acum: tarjetasAc,cuotaKey: 't35' },
    ].map(m => {
      const remaining = Math.max(0, m.line - m.acum)
      const pOver = remaining <= 0 ? 1 : poissonOver(m.lambda - m.acum, remaining)
      const cuota = parseFloat(cuotasVivo[m.cuotaKey])
      const ev = cuota > 1 ? calcEV(pOver, cuota) : null
      return { ...m, pOver: +(pOver * 100).toFixed(1), ev }
    })

    setCalc({
      situationS, tacticalK, goalDiff,
      corners: { ...corners, proyect: +proyectCorners.toFixed(1) },
      shots: { ...shots, proyect: +proyectShots.toFixed(1) },
      sot: { ...sot, proyect: +proyectSOT.toFixed(1) },
      cards: { ...cards, proyect: +proyectCards.toFixed(1) },
      markets,
    })
  }

  useEffect(() => { recalcular() }, [teamAId, teamBId, minuto, golesA, golesB, cornersAc, tirosAc, sotAc, tarjetasAc, zona, cuotasVivo])

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <h1 className="text-2xl font-bold text-white">Análisis En Vivo</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Equipos y marcador */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-white">Partido</h2>
          <div className="grid grid-cols-2 gap-2">
            <select className="input-dark" value={teamAId} onChange={e => setTeamAId(e.target.value)}>
              <option value="">Equipo A</option>
              {TEAMS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select className="input-dark" value={teamBId} onChange={e => setTeamBId(e.target.value)}>
              <option value="">Equipo B</option>
              {TEAMS.filter(t => t.id !== teamAId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-gray-400">Goles A</label>
              <input type="number" min="0" className="input-dark w-full" value={golesA} onChange={e => setGolesA(+e.target.value)} />
            </div>
            <span className="text-2xl font-bold text-gray-400 mt-4">-</span>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-gray-400">Goles B</label>
              <input type="number" min="0" className="input-dark w-full" value={golesB} onChange={e => setGolesB(+e.target.value)} />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-gray-400">Minuto</label>
              <input type="number" min="1" max="90" className="input-dark w-full" value={minuto} onChange={e => setMinuto(+e.target.value)} />
            </div>
          </div>
        </div>

        {/* Stats acumuladas */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-white">Stats acumuladas</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Córners', cornersAc, setCornersAc],
              ['Tiros', tirosAc, setTirosAc],
              ['SOT', sotAc, setSotAc],
              ['Tarjetas', tarjetasAc, setTarjetasAc],
              ['Cambios', cambios, setCambios],
            ].map(([label, val, setter]) => (
              <div key={label}>
                <label className="text-xs text-gray-400">{label}</label>
                <input type="number" min="0" className="input-dark w-full mt-1" value={val} onChange={e => setter(+e.target.value)} />
              </div>
            ))}
            <div>
              <label className="text-xs text-gray-400">Zona ataque</label>
              <select className="input-dark w-full mt-1" value={zona} onChange={e => setZona(e.target.value)}>
                <option value="bandas">Bandas</option>
                <option value="mixto-bandas">Mixto-Bandas</option>
                <option value="mixto">Mixto</option>
                <option value="central">Central</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Proyecciones */}
      {calc && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Córners proy.', val: calc.corners.proyect, ritmo: calc.corners.ritmo },
              { label: 'Tiros proy.', val: calc.shots.proyect, ritmo: calc.shots.ritmo },
              { label: 'SOT proy.', val: calc.sot.proyect, ritmo: calc.sot.ritmo },
              { label: 'Tarjetas proy.', val: calc.cards.proyect, ritmo: calc.cards.ritmo },
            ].map(({ label, val, ritmo }) => (
              <div key={label} className="card text-center">
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-3xl font-bold text-white mt-1">{val}</p>
                <p className="text-xs text-gray-500">Ritmo: {ritmo}/min</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-gray-400">Situation S: <strong className={calc.situationS > 1 ? 'text-green-400' : calc.situationS < 1 ? 'text-red-400' : 'text-white'}>{calc.situationS}</strong></span>
            <span className="text-gray-400">Tactical K: <strong className="text-white">{calc.tacticalK}</strong></span>
            <span className="text-gray-400">Min. restantes: <strong className="text-white">{90 - minuto}</strong></span>
            <span className="text-gray-400">Resultado: <strong className="text-white">{golesA}-{golesB}</strong></span>
          </div>

          {/* Cuotas en vivo */}
          <div className="card space-y-4">
            <h2 className="font-semibold text-white">EV en Vivo</h2>
            <div className="grid grid-cols-3 gap-2">
              {calc.markets.map(m => (
                <div key={m.cuotaKey}>
                  <label className="text-xs text-gray-400">{m.label}</label>
                  <input
                    type="number" step="0.01" min="1" placeholder="cuota"
                    className="input-dark w-full mt-1"
                    value={cuotasVivo[m.cuotaKey] || ''}
                    onChange={e => setCuotasVivo(q => ({ ...q, [m.cuotaKey]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-dark-600">
                    <th className="text-left py-2 px-2">Mercado</th>
                    <th className="text-center py-2 px-2">P_modelo</th>
                    <th className="text-center py-2 px-2">EV%</th>
                    <th className="text-center py-2 px-2">Lambda</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.markets.map((m, i) => (
                    <tr key={i} className="border-b border-dark-700">
                      <td className="py-2 px-2 text-white">{m.label}</td>
                      <td className="py-2 px-2 text-center">{m.pOver}%</td>
                      <td className={`py-2 px-2 text-center font-semibold ${
                        !m.ev ? 'text-gray-500'
                        : m.ev.evPct > 2.5 ? 'text-green-400'
                        : m.ev.evPct > 0 ? 'text-yellow-400'
                        : 'text-red-400'
                      }`}>
                        {m.ev ? `${m.ev.evPct > 0 ? '+' : ''}${m.ev.evPct}%` : '—'}
                      </td>
                      <td className="py-2 px-2 text-center text-gray-400">{(m.lambda - (m.acum ?? 0)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
