import { useState, useMemo } from 'react'
import { TEAMS, MATCHES } from '../lib/teams'
import { getSituationS, getTacticalK, calcLiveExpected } from '../lib/engine'

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

export default function EnVivo() {
  const [teamAId,    setTeamAId]    = useState('')
  const [teamBId,    setTeamBId]    = useState('')
  const [minuto,     setMinuto]     = useState(45)
  const [golesA,     setGolesA]     = useState(0)
  const [golesB,     setGolesB]     = useState(0)
  const [cornersAc,  setCornersAc]  = useState(4)
  const [tirosAc,    setTirosAc]    = useState(8)
  const [sotAc,      setSotAc]      = useState(3)
  const [tarjetasAc, setTarjetasAc] = useState(1)
  const [zona,       setZona]       = useState('mixto')

  const teamA = TEAMS.find(t => t.id === teamAId)
  const teamB = TEAMS.find(t => t.id === teamBId)

  const matchInfo = useMemo(() => {
    if (!teamAId || !teamBId) return null
    return MATCHES.find(m =>
      (m.teamA === teamAId && m.teamB === teamBId) ||
      (m.teamA === teamBId && m.teamB === teamAId)
    ) || null
  }, [teamAId, teamBId])

  const minutosRestantes = Math.max(0, 90 - minuto)

  const calc = useMemo(() => {
    if (!teamA || !teamB || minuto <= 0) return null

    const goalDiff   = golesA - golesB
    const situationS = getSituationS(goalDiff)
    const tacticalK  = getTacticalK(zona)

    const corners = calcLiveExpected({ statAcumulada: cornersAc, minutos: minuto, minutosRestantes, situationS, tacticalK })
    const shots   = calcLiveExpected({ statAcumulada: tirosAc,   minutos: minuto, minutosRestantes, situationS, tacticalK: 1 })
    const sot     = calcLiveExpected({ statAcumulada: sotAc,     minutos: minuto, minutosRestantes, situationS, tacticalK: 1 })
    const cards   = calcLiveExpected({ statAcumulada: tarjetasAc,minutos: minuto, minutosRestantes, situationS, tacticalK: 1 })

    return {
      situationS, tacticalK,
      corners: { ...corners, proy: +(cornersAc + corners.lambda).toFixed(1) },
      shots:   { ...shots,   proy: +(tirosAc   + shots.lambda).toFixed(1) },
      sot:     { ...sot,     proy: +(sotAc      + sot.lambda).toFixed(1) },
      cards:   { ...cards,   proy: +(tarjetasAc + cards.lambda).toFixed(1) },
    }
  }, [teamA, teamB, minuto, golesA, golesB, cornersAc, tirosAc, sotAc, tarjetasAc, zona])

  const ready = !!calc

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <h1 className="text-2xl font-bold text-white">Análisis En Vivo</h1>
      </div>

      {/* ── Selección de equipos ── */}
      <div className="card space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Equipo A</label>
            <select className="input-dark w-full" value={teamAId} onChange={e => { setTeamAId(e.target.value); setTeamBId('') }}>
              <option value="">Seleccionar...</option>
              {TEAMS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Equipo B</label>
            <select className="input-dark w-full" value={teamBId} onChange={e => setTeamBId(e.target.value)}>
              <option value="">Seleccionar...</option>
              {TEAMS.filter(t => t.id !== teamAId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
        {matchInfo && (
          <p className="text-xs text-gray-500">📅 {matchInfo.date} · 📍 {matchInfo.ciudad} · Grupo {matchInfo.group}</p>
        )}
      </div>

      {/* ── Inputs en vivo ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Marcador */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-white text-sm">Marcador y Minuto</h2>
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
              ['Córners', cornersAc, setCornersAc],
              ['Tiros totales', tirosAc, setTirosAc],
              ['SOT', sotAc, setSotAc],
              ['Tarjetas', tarjetasAc, setTarjetasAc],
            ].map(([label, val, setter]) => (
              <div key={label}>
                <label className="text-xs text-gray-400">{label}</label>
                <input type="number" min="0" className="input-dark w-full mt-1" value={val} onChange={e => setter(+e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {!ready && (
        <div className="card text-center text-gray-500 py-10">
          Selecciona los dos equipos para ver el análisis en vivo
        </div>
      )}

      {ready && (
        <>
          {/* ── Resumen proyecciones ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            {[
              ['Córners proy.', calc.corners.proy, cornersAc],
              ['Tiros proy.',   calc.shots.proy,   tirosAc],
              ['SOT proy.',     calc.sot.proy,     sotAc],
              ['Tarjetas proy.',calc.cards.proy,   tarjetasAc],
            ].map(([label, proy, acum]) => (
              <div key={label} className="card text-center bg-dark-700">
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-2xl font-bold text-blue-400">{proy}</p>
                <p className="text-xs text-gray-600">actual: {acum} · restante: {+(proy - acum).toFixed(1)}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
            <span>Min. restantes: <strong className="text-white">{minutosRestantes}'</strong></span>
            <span>Situation S: <strong className={calc.situationS > 1 ? 'text-green-400' : calc.situationS < 1 ? 'text-red-400' : 'text-white'}>{calc.situationS}</strong></span>
            <span>Tactical K: <strong className="text-white">{calc.tacticalK}</strong></span>
          </div>

          {/* ── Recomendaciones por mercado ── */}
          <div className="card space-y-5">
            <h2 className="font-bold text-white border-b border-dark-600 pb-2 text-sm tracking-wide uppercase">Recomendaciones En Vivo</h2>
            <LiveMarket label="Córners"  acum={cornersAc}  projected={calc.corners.proy} lines={[7.5, 8.5, 9.5, 10.5, 11.5]} />
            <LiveMarket label="Tiros"    acum={tirosAc}    projected={calc.shots.proy}   lines={[19.5, 21.5, 23.5, 25.5, 27.5]} />
            <LiveMarket label="SOT"      acum={sotAc}      projected={calc.sot.proy}     lines={[6.5, 7.5, 8.5, 9.5, 10.5]} />
            <LiveMarket label="Tarjetas" acum={tarjetasAc} projected={calc.cards.proy}   lines={[1.5, 2.5, 3.5, 4.5, 5.5]} />
          </div>
        </>
      )}
    </div>
  )
}
