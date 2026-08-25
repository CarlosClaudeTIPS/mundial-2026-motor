import { useState, useMemo, useEffect, useCallback } from 'react'
import { getSituationS, getTacticalK, calcLiveExpected, poissonOver } from '../lib/engine'
import { bestRealisticLine } from '../lib/picks'
import { fetchLive } from '../lib/football-api'
import { fetchFixtureStats, hasLivescore } from '../lib/livescore-api'

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

export default function EnVivo({ league }) {
  // Partidos en vivo de la liga
  const [liveMatches, setLiveMatches] = useState([])
  const [loadingLive, setLoadingLive] = useState(false)
  const [liveError, setLiveError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [statsInfo, setStatsInfo] = useState('') // feedback de auto-fill

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
  const [dangAtk,    setDangAtk]    = useState(null) // { h, a } ataques peligrosos si la API los da
  const [liveStatsRaw, setLiveStatsRaw] = useState(null) // stats actuales crudas por equipo
  const [zona,       setZona]       = useState('mixto')

  // ── Cargar partidos en vivo de la liga ──
  const loadLive = useCallback(async () => {
    setLoadingLive(true)
    setLiveError(null)
    try {
      const res = await fetchLive(league.id)
      if (res.ok) setLiveMatches(res.live ?? [])
      else setLiveError(res.error)
    } catch (e) {
      setLiveError(e.message)
    } finally {
      setLoadingLive(false)
    }
  }, [league.id])

  useEffect(() => {
    setSelectedId(null)
    loadLive()
  }, [loadLive])

  // ── Auto-llenar al seleccionar un partido ──
  const fillFromMatch = useCallback(async (match) => {
    setSelectedId(match.id)
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

      let filled = []
      if (corners != null) { setCornersAc(corners); filled.push('córners') }
      if (shots != null)   { setTirosAc(shots);     filled.push('tiros') }
      if (sot != null)     { setSotAc(sot);         filled.push('SOT') }
      if (yellow != null || red != null) { setTarjetasAc((yellow ?? 0) + (red ?? 0)); filled.push('tarjetas') }
      setTiAc(ti) // null si no hay dato

      // Ataques peligrosos por equipo (si la API los reporta en este partido)
      const daH = res.stats?.[0]?.stats?.['Dangerous Attacks']
      const daA = res.stats?.[1]?.stats?.['Dangerous Attacks']
      setDangAtk(daH != null || daA != null ? { h: daH ?? '—', a: daA ?? '—' } : null)

      // Tablero de stats actuales por equipo
      setLiveStatsRaw({
        home: res.stats?.[0]?.stats ?? {},
        away: res.stats?.[1]?.stats ?? {},
        homeName: match.homeTeam,
        awayName: match.awayTeam,
      })

      setStatsInfo(filled.length
        ? `✓ Auto-llenado: ${filled.join(', ')}${ti != null ? ', throw-ins' : ''}`
        : 'El partido aún no reporta stats — llena los acumulados a mano')
    } catch {
      setStatsInfo('No se pudieron cargar las stats — llena los acumulados a mano')
    }
  }, [])

  // ── Auto-refresh cada 60s del partido seleccionado ──
  useEffect(() => {
    if (!selectedId) return
    const id = setInterval(async () => {
      try {
        const res = await fetchLive(league.id)
        if (!res.ok) return
        setLiveMatches(res.live ?? [])
        const m = res.live?.find(x => x.id === selectedId)
        if (m) fillFromMatch(m)
      } catch {}
    }, 60_000)
    return () => clearInterval(id)
  }, [selectedId, league.id, fillFromMatch])

  const minutosRestantes = Math.max(0, 90 - minuto)

  const calc = useMemo(() => {
    if (!teamAName.trim() || !teamBName.trim() || minuto <= 0) return null

    const goalDiff   = golesA - golesB
    const situationS = getSituationS(goalDiff)
    const tacticalK  = getTacticalK(zona)

    // ── Intensidad real de ataque (ataques peligrosos/minuto) ──
    // Ritmo típico combinado: ~1.1 ataques peligrosos por minuto.
    // Un partido caliente (1.4/min) proyecta MÁS córners/tiros que su ritmo
    // pasado; un partido dormido (0.7/min) proyecta menos. Esto corrige el
    // "un córner cada 20 min" ingenuo con lo que REALMENTE pasa en la cancha.
    const daTotal = dangAtk ? (parseFloat(dangAtk.h) || 0) + (parseFloat(dangAtk.a) || 0) : null
    const intensity = (daTotal && minuto >= 15)
      ? Math.min(1.20, Math.max(0.85, (daTotal / minuto) / 1.1))
      : 1

    const corners = calcLiveExpected({ statAcumulada: cornersAc, minutos: minuto, minutosRestantes, situationS, tacticalK: tacticalK * intensity })
    const shots   = calcLiveExpected({ statAcumulada: tirosAc,   minutos: minuto, minutosRestantes, situationS, tacticalK: intensity })
    const sot     = calcLiveExpected({ statAcumulada: sotAc,     minutos: minuto, minutosRestantes, situationS, tacticalK: intensity })
    const cards   = calcLiveExpected({ statAcumulada: tarjetasAc,minutos: minuto, minutosRestantes, situationS, tacticalK: 1 })
    // TI en vivo: ritmo estable (no depende del marcador) pero sí de la intensidad física
    const ti = tiAc != null
      ? calcLiveExpected({ statAcumulada: tiAc, minutos: minuto, minutosRestantes, situationS: 1, tacticalK: intensity })
      : null

    return {
      situationS, tacticalK, intensity: +intensity.toFixed(2), daTotal,
      corners: { ...corners, proy: +(cornersAc + corners.lambda).toFixed(1) },
      shots:   { ...shots,   proy: +(tirosAc   + shots.lambda).toFixed(1) },
      sot:     { ...sot,     proy: +(sotAc      + sot.lambda).toFixed(1) },
      cards:   { ...cards,   proy: +(tarjetasAc + cards.lambda).toFixed(1) },
      ti:      ti ? { ...ti, proy: +(tiAc + ti.lambda).toFixed(1) } : null,
    }
  }, [teamAName, teamBName, minuto, golesA, golesB, cornersAc, tirosAc, sotAc, tarjetasAc, tiAc, zona, dangAtk])

  const ready = !!calc

  // ─── RECOMENDADOS EN VIVO — ordenados por confianza ──────────────────────
  const liveRecs = useMemo(() => {
    if (!calc) return []
    const mkts = [
      { label: 'Córners',   proy: calc.corners.proy, acum: cornersAc, step: 1, extra: `Situation S ×${calc.situationS} por el marcador ${golesA}-${golesB}` },
      { label: 'Tiros',     proy: calc.shots.proy,   acum: tirosAc,   step: 2, extra: null },
      { label: 'SOT',       proy: calc.sot.proy,     acum: sotAc,     step: 1, extra: null },
      { label: 'Tarjetas',  proy: calc.cards.proy,   acum: tarjetasAc, step: 1, extra: minuto >= 60 ? 'Tramo 60-90: donde más tarjetas caen' : null },
      ...(calc.ti ? [{ label: 'Throw-ins', proy: calc.ti.proy, acum: tiAc, step: 2, extra: 'Dato real en vivo de la API' }] : []),
    ]
    const recs = []
    for (const m of mkts) {
      const rec = bestRealisticLine(m.proy, m.step)
      if (!rec) continue
      // Línea ya superada → solo tiene sentido el OVER cumplido, no recomendar
      if (rec.dir === 'OVER' && m.acum > rec.line) continue
      const ritmo = minuto > 0 ? m.acum / minuto : 0
      const pOver = poissonOver(m.proy, rec.line)
      const p = rec.dir === 'OVER' ? pOver : 1 - pOver
      // Confianza: crece con los minutos jugados (ritmo más fiable) y el margen
      const confidence = Math.min(90, Math.round(
        30 + (minuto / 90) * 35 + Math.min(15, Math.abs(rec.margin) * 100) + (p > 0.7 ? 8 : 0)
      ))
      recs.push({
        ...m, rec, p: Math.round(p * 100), confidence, ritmo: +ritmo.toFixed(2),
        faltan: +(m.proy - m.acum).toFixed(1),
      })
    }
    return recs.sort((a, b) => b.confidence - a.confidence)
  }, [calc, cornersAc, tirosAc, sotAc, tarjetasAc, tiAc, minuto, golesA, golesB])

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <h1 className="text-2xl font-bold text-white">Análisis En Vivo — {league.flag} {league.name}</h1>
      </div>

      {/* ── Fila superior: partidos en vivo | stats actuales ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white text-sm">🔴 Partidos en curso ahora</h2>
          <button onClick={loadLive} disabled={loadingLive}
            className="text-xs px-3 py-1.5 rounded bg-dark-700 text-gray-300 hover:bg-dark-600 transition-colors disabled:opacity-50">
            {loadingLive ? '⏳' : '🔄'} Actualizar
          </button>
        </div>

        {liveError && (
          <p className="text-xs text-red-400">{liveError}</p>
        )}

        {!loadingLive && liveMatches.length === 0 && !liveError && (
          <p className="text-sm text-gray-500 py-3 text-center">
            No hay partidos de {league.name} en juego ahora.<br />
            <span className="text-xs text-gray-600">Cambia de liga en el menú lateral o vuelve cuando haya jornada. También puedes llenar los datos a mano abajo.</span>
          </p>
        )}

        {liveMatches.length > 0 && (
          <div className="space-y-2">
            {liveMatches.map(m => (
              <button
                key={m.id}
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
                  {selectedId === m.id ? '✓ analizando' : 'Analizar →'}
                </span>
              </button>
            ))}
          </div>
        )}

        {statsInfo && (
          <p className={`text-xs ${statsInfo.startsWith('✓') ? 'text-green-400' : 'text-yellow-500'}`}>{statsInfo}</p>
        )}
        {dangAtk && (
          <p className="text-xs text-orange-300">⚔️ Ataques peligrosos: {teamAName} {dangAtk.h} · {teamBName} {dangAtk.a} — quien acumula más presiona el próximo córner/gol</p>
        )}
        {selectedId && (
          <p className="text-xs text-gray-600">Marcador, minuto y stats se actualizan solos cada 60 segundos</p>
        )}
      </div>

      {/* Stats actuales del partido seleccionado */}
      {liveStatsRaw && (
        <LiveStatsBoard raw={liveStatsRaw} homeName={liveStatsRaw.homeName} awayName={liveStatsRaw.awayName} minuto={minuto} />
      )}
      </div>

      {/* ── Datos del partido (auto-llenados, editables) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div>
              <label className="text-xs text-gray-400">Throw-ins {tiAc == null && <span className="text-gray-600">(sin dato)</span>}</label>
              <input type="number" min="0" className="input-dark w-full mt-1" value={tiAc ?? ''}
                placeholder="—"
                onChange={e => setTiAc(e.target.value === '' ? null : +e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {!ready && (
        <div className="card text-center text-gray-500 py-10">
          Selecciona un partido en vivo arriba, o escribe los equipos y datos a mano
        </div>
      )}

      {ready && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        <div className="space-y-5">
          {/* ── RECOMENDADOS EN VIVO ── */}
          {liveRecs.length > 0 && (
            <div className="rounded-2xl border-2 border-red-700/60 bg-gradient-to-b from-red-950/50 to-dark-800 p-5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-xl font-black text-red-300 tracking-wide">🏆 RECOMENDADOS EN VIVO — min {minuto}'</h2>
                <span className="text-xs text-gray-500">orden: confianza · la confianza sube con los minutos jugados</span>
              </div>
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
                  {minuto < 30 && <p className="text-xs text-yellow-600 mt-1">⚠️ Pocos minutos jugados — el ritmo aún es poco fiable</p>}
                  {r.p > 5 && (
                    <p className="text-sm font-bold text-green-300 mt-2 bg-green-950/60 border border-green-800/50 rounded-lg px-3 py-1.5 inline-block">
                      💰 Apuesta si la cuota en vivo está entre <span className="text-white">{(1.025 / (r.p / 100)).toFixed(2)}</span> y <span className="text-white">{(1.25 / (r.p / 100)).toFixed(2)}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>

        <div className="space-y-5">
          {/* ── Resumen proyecciones ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-center">
            {[
              ['Córners proy.', calc.corners.proy, cornersAc],
              ['Tiros proy.',   calc.shots.proy,   tirosAc],
              ['SOT proy.',     calc.sot.proy,     sotAc],
              ['Tarjetas proy.',calc.cards.proy,   tarjetasAc],
              ...(calc.ti ? [['Throw-ins proy.', calc.ti.proy, tiAc]] : []),
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
            {calc.daTotal != null && (
              <span>Intensidad de ataque: <strong className={calc.intensity > 1.05 ? 'text-orange-400' : calc.intensity < 0.95 ? 'text-blue-400' : 'text-white'}>
                ×{calc.intensity}</strong> <span className="text-gray-600">({calc.daTotal} at. peligrosos en {minuto}')</span>
              </span>
            )}
          </div>

          {/* ── Recomendaciones por mercado ── */}
          <div className="card space-y-5">
            <h2 className="font-bold text-white border-b border-dark-600 pb-2 text-sm tracking-wide uppercase">Recomendaciones En Vivo</h2>
            <LiveMarket label="Córners"  acum={cornersAc}  projected={calc.corners.proy} lines={[7.5, 8.5, 9.5, 10.5, 11.5]} />
            <LiveMarket label="Tiros"    acum={tirosAc}    projected={calc.shots.proy}   lines={[19.5, 21.5, 23.5, 25.5, 27.5]} />
            <LiveMarket label="SOT"      acum={sotAc}      projected={calc.sot.proy}     lines={[6.5, 7.5, 8.5, 9.5, 10.5]} />
            <LiveMarket label="Tarjetas" acum={tarjetasAc} projected={calc.cards.proy}   lines={[1.5, 2.5, 3.5, 4.5, 5.5]} />
            {calc.ti && (
              <LiveMarket label="Throw-ins" acum={tiAc} projected={calc.ti.proy} lines={[28.5, 32.5, 36.5, 40.5, 44.5]} />
            )}
          </div>
        </div>
        </div>
      )}
    </div>
  )
}
