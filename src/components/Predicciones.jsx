import { useState, useEffect, useCallback } from 'react'
import { getAllPredicciones, getEvaluaciones, saveEvaluacion, setPickResult, evaluarManual } from '../lib/predicciones'
import { fetchFixtures } from '../lib/football-api'
import { fetchFixtureStats } from '../lib/livescore-api'
import { getLeague } from '../lib/leagues'

// ─── Cómo se calcula el valor REAL de cada mercado desde las stats finales ───
const num = v => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return (n == null || isNaN(n)) ? null : n
}

function actualValue(marketKey, fixture, homeStats, awayStats) {
  const h = k => num(homeStats?.[k])
  const a = k => num(awayStats?.[k])
  const t = k => (h(k) != null || a(k) != null) ? (h(k) ?? 0) + (a(k) ?? 0) : null
  const cards = s => {
    const y = num(s?.['Yellow Cards']); const r = num(s?.['Red Cards'])
    return (y != null || r != null) ? (y ?? 0) + (r ?? 0) : null
  }
  switch (marketKey) {
    case 'goles_totales':    return (fixture.homeGoals ?? 0) + (fixture.awayGoals ?? 0)
    case 'goles_local':      return fixture.homeGoals
    case 'goles_visita':     return fixture.awayGoals
    case 'shots_totales':    return t('Total Shots')
    case 'tiros_local':      return h('Total Shots')
    case 'tiros_visita':     return a('Total Shots')
    case 'sot_totales':      return t('Shots on Goal')
    case 'sot_local':        return h('Shots on Goal')
    case 'sot_visita':       return a('Shots on Goal')
    case 'corners_totales':  return t('Corner Kicks')
    case 'corners_local':    return h('Corner Kicks')
    case 'corners_visita':   return a('Corner Kicks')
    case 'tarjetas_totales': return (cards(homeStats) != null || cards(awayStats) != null) ? (cards(homeStats) ?? 0) + (cards(awayStats) ?? 0) : null
    case 'tarjetas_local':   return cards(homeStats)
    case 'tarjetas_visita':  return cards(awayStats)
    case 'ti_totales':       return t('Throw Ins')
    case 'ti_local':         return h('Throw Ins')
    case 'ti_visita':        return a('Throw Ins')
    case 'gk_totales':       return t('Goal Kicks')
    case 'gk_local':         return h('Goal Kicks')
    case 'gk_visita':        return a('Goal Kicks')
    default:                 return null // corners_1h, tiros_1h... sin dato de tiempos
  }
}

function judge(pick, actual) {
  if (actual == null) return { res: 'sin_dato' }
  if (actual === pick.line) return { res: 'push' }
  const over = actual > pick.line
  const won = (pick.dir === 'OVER') === over
  return { res: won ? 'ganada' : 'perdida', actual }
}

const RES_STYLE = {
  ganada:   'bg-green-800/50 text-green-300 border-green-700/50',
  perdida:  'bg-red-800/50 text-red-300 border-red-700/50',
  push:     'bg-yellow-800/40 text-yellow-300 border-yellow-700/40',
  sin_dato: 'bg-dark-700 text-gray-500 border-dark-600',
}
const RES_LABEL = { ganada: '✅ GANADA', perdida: '❌ PERDIDA', push: '➖ PUSH', sin_dato: '? sin dato' }

export default function Predicciones() {
  const [pendientes, setPendientes] = useState([])
  const [evaluadas, setEvaluadas] = useState([])
  const [checking, setChecking] = useState(false)
  const [checkInfo, setCheckInfo] = useState('')

  const reload = useCallback(() => {
    setPendientes(getAllPredicciones())
    setEvaluadas(getEvaluaciones())
  }, [])

  useEffect(() => { reload() }, [reload])

  // ── Revisar pendientes: buscar el partido terminado y evaluar cada pick ──
  const checkResults = useCallback(async () => {
    setChecking(true)
    setCheckInfo('')
    let evaluadasN = 0
    try {
      const pend = getAllPredicciones()
      // agrupar por liga para no repetir fetch
      const byLeague = {}
      for (const p of pend) (byLeague[p.leagueId] = byLeague[p.leagueId] ?? []).push(p)

      for (const [leagueId, preds] of Object.entries(byLeague)) {
        const fx = await fetchFixtures(Number(leagueId)).catch(() => null)
        if (!fx?.ok) continue
        for (const p of preds) {
          const norm = s => (s ?? '').toLowerCase().trim()
          const f = (fx.fixtures ?? []).find(f =>
            ['FT', 'AET', 'PEN'].includes(f.status) &&
            ((norm(f.homeTeam) === norm(p.home) && norm(f.awayTeam) === norm(p.away)) ||
             (norm(f.homeTeam) === norm(p.away) && norm(f.awayTeam) === norm(p.home)))
          )
          if (!f) continue
          setCheckInfo(`Evaluando ${p.home} vs ${p.away}...`)
          const st = await fetchFixtureStats(f.id, f.homeId, f.awayId).catch(() => null)
          const homeStats = st?.stats?.[0]?.stats ?? {}
          const awayStats = st?.stats?.[1]?.stats ?? {}
          // si la predicción se guardó con equipos invertidos vs el fixture real
          const invertido = norm(f.homeTeam) === norm(p.away)
          const hs = invertido ? awayStats : homeStats
          const as = invertido ? homeStats : awayStats
          const fixNorm = invertido
            ? { ...f, homeGoals: f.awayGoals, awayGoals: f.homeGoals }
            : f
          const picks = (p.picks ?? []).map(pk => {
            const actual = actualValue(pk.marketKey, fixNorm, hs, as)
            return { ...pk, ...judge(pk, actual), actual }
          })
          saveEvaluacion({
            key: p.key, ts: p.ts, evalTs: Date.now(),
            leagueId: p.leagueId, home: p.home, away: p.away,
            score: `${fixNorm.homeGoals}-${fixNorm.awayGoals}`,
            date: f.date,
            picks,
          })
          evaluadasN++
        }
      }
      setCheckInfo(evaluadasN
        ? `✓ ${evaluadasN} partido(s) evaluado(s)`
        : 'Ningún partido pendiente ha terminado todavía (o quedó fuera de la ventana de ±7 días del fixture)')
      reload()
    } catch (e) {
      setCheckInfo(`Error: ${e.message}`)
    } finally {
      setChecking(false)
    }
  }, [reload])

  // ── Resumen de aciertos ──
  const allPicks = evaluadas.flatMap(e => (e.picks ?? []).filter(p => p.res === 'ganada' || p.res === 'perdida'))
  const ganadas = allPicks.filter(p => p.res === 'ganada').length
  const hitRate = allPicks.length ? Math.round((ganadas / allPicks.length) * 100) : null

  const porMercado = {}
  for (const p of allPicks) {
    const m = (porMercado[p.label] = porMercado[p.label] ?? { g: 0, t: 0 })
    m.t++; if (p.res === 'ganada') m.g++
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-white">🎯 Predicciones del Motor</h1>
          <p className="text-gray-400 text-xs mt-1">
            Cada análisis queda registrado. Cuando el partido termina, se compara lo sugerido contra las stats reales — así ves qué tan bien viene el motor y en qué mercados confiar.
          </p>
        </div>
        <button onClick={checkResults} disabled={checking}
          className="text-xs px-3 py-1.5 rounded bg-green-800/50 text-green-300 hover:bg-green-700/60 border border-green-700/40 transition-colors disabled:opacity-50">
          {checking ? '⏳ Revisando...' : '🔍 Revisar resultados'}
        </button>
      </div>

      {checkInfo && (
        <p className={`text-xs ${checkInfo.startsWith('✓') ? 'text-green-400' : checkInfo.startsWith('Error') ? 'text-red-400' : 'text-gray-400'}`}>{checkInfo}</p>
      )}

      {/* ── Resumen global ── */}
      {hitRate != null && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card text-center bg-dark-700">
            <p className="text-xs text-gray-400">Hit Rate global</p>
            <p className={`text-3xl font-black ${hitRate >= 60 ? 'text-green-400' : hitRate >= 45 ? 'text-yellow-400' : 'text-red-400'}`}>{hitRate}%</p>
            <p className="text-xs text-gray-600">{ganadas}/{allPicks.length} picks</p>
          </div>
          {Object.entries(porMercado).sort((a, b) => b[1].t - a[1].t).slice(0, 3).map(([label, m]) => {
            const pct = Math.round((m.g / m.t) * 100)
            return (
              <div key={label} className="card text-center bg-dark-700">
                <p className="text-xs text-gray-400 truncate">{label}</p>
                <p className={`text-2xl font-bold ${pct >= 60 ? 'text-green-400' : pct >= 45 ? 'text-yellow-400' : 'text-red-400'}`}>{pct}%</p>
                <p className="text-xs text-gray-600">{m.g}/{m.t}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Evaluadas ── */}
      {evaluadas.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs text-green-400 font-semibold uppercase tracking-wide">✅ Evaluadas contra el resultado real</h2>
          {evaluadas.map(e => {
            const lg = getLeague(e.leagueId)
            return (
              <div key={e.key} className="card space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500">{lg.flag}</span>
                  <span className="text-white font-medium text-sm">{e.home} <strong className="text-green-400">{e.score ?? 'vs'}</strong> {e.away}</span>
                  <span className="text-xs text-gray-600 ml-auto">{e.date?.slice(0, 10) ?? new Date(e.ts).toLocaleDateString('es-CO')}</span>
                </div>
                <div className="space-y-1">
                  {(e.picks ?? []).map((p, i) => (
                    <div key={i} className={`flex items-center gap-2 text-xs rounded-lg border px-3 py-1.5 flex-wrap ${RES_STYLE[p.res]}`}>
                      <span className="font-bold">{RES_LABEL[p.res]}{p.manual && ' ✍️'}</span>
                      <span className="text-gray-300">{p.label} {p.dir} {p.line}</span>
                      {p.actual != null && <span className="font-mono">· real: <strong>{p.actual}</strong></span>}
                      {p.res === 'sin_dato' && !p.manual && <span className="text-gray-500">· sin dato de la API — márcalo tú:</span>}
                      {/* Marcar / corregir a mano */}
                      <span className="ml-auto flex gap-1">
                        {[['ganada', '✅'], ['perdida', '❌'], ['push', '➖']].map(([res, icon]) => (
                          <button key={res}
                            onClick={() => { setPickResult(e.key, i, res); reload() }}
                            title={`Marcar como ${res}`}
                            className={`px-1.5 py-0.5 rounded border text-xs transition-colors ${
                              p.res === res ? 'border-white/50 bg-white/10' : 'border-transparent opacity-40 hover:opacity-100 hover:border-gray-500'
                            }`}>
                            {icon}
                          </button>
                        ))}
                      </span>
                    </div>
                  ))}
                  {(e.picks ?? []).length === 0 && (
                    <p className="text-xs text-gray-600">El análisis no dejó picks guardados</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Pendientes ── */}
      {pendientes.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs text-yellow-500 font-semibold uppercase tracking-wide">⏳ Pendientes — el partido no ha terminado o falta revisar</h2>
          {pendientes.map(p => {
            const lg = getLeague(p.leagueId)
            return (
              <div key={p.key} className="card space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500">{lg.flag}</span>
                  <span className="text-white font-medium text-sm">{p.home} vs {p.away}</span>
                  <span className="text-xs text-gray-600 ml-auto">analizado {new Date(p.ts).toLocaleDateString('es-CO')} {new Date(p.ts).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                  <button onClick={() => { evaluarManual(p.key); reload() }}
                    title="El partido ya terminó y quiero calificar los picks yo mismo"
                    className="text-xs px-2 py-1 rounded bg-dark-700 text-gray-400 hover:text-white border border-dark-500">
                    ✍️ Marcar a mano
                  </button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(p.picks ?? []).map((pk, i) => (
                    <span key={i} className="text-xs bg-dark-700 rounded px-2 py-1 text-gray-300">
                      {pk.label} <strong className={pk.dir === 'OVER' ? 'text-green-400' : 'text-blue-400'}>{pk.dir} {pk.line}</strong>
                      <span className="text-gray-600"> · P {pk.pMod}%</span>
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {pendientes.length === 0 && evaluadas.length === 0 && (
        <div className="card text-center py-10 text-sm text-gray-500">
          Todavía no hay predicciones registradas.<br />
          <span className="text-xs text-gray-600">Analiza un partido en la pestaña Analizar — el motor guarda sus picks automáticamente y aquí los compara con el resultado real.</span>
        </div>
      )}
    </div>
  )
}
