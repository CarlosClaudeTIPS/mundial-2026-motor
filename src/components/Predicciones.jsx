import { useState, useEffect, useCallback } from 'react'
import { getAllPredicciones, getEvaluaciones, saveEvaluacion, setPickResult, evaluarManual, actualValue, judge } from '../lib/predicciones'
import { fetchFixtures } from '../lib/football-api'
import { fetchFixtureStats } from '../lib/livescore-api'
import { getLeague } from '../lib/leagues'
import { backtestMatch } from '../lib/prematch'
import { diagnosticoCalibracion } from '../lib/ia'
import { hasIA } from '../lib/ia'

const RES_STYLE = {
  ganada:   'bg-green-800/50 text-green-300 border-green-700/50',
  perdida:  'bg-red-800/50 text-red-300 border-red-700/50',
  push:     'bg-yellow-800/40 text-yellow-300 border-yellow-700/40',
  sin_dato: 'bg-dark-700 text-gray-500 border-dark-600',
}
const RES_LABEL = { ganada: '✅ GANADA', perdida: '❌ PERDIDA', push: '➖ PUSH', sin_dato: '? sin dato' }

// ─── Diagnóstico automático (sin IA): sesgo por mercado ──────────────────────
function buildDiagnostico(evaluadas) {
  const byMarket = {}
  for (const e of evaluadas) {
    for (const p of e.picks ?? []) {
      if (p.res !== 'ganada' && p.res !== 'perdida') continue
      const m = (byMarket[p.label] = byMarket[p.label] ?? { g: 0, t: 0, biases: [] })
      m.t++; if (p.res === 'ganada') m.g++
      if (p.expected != null && p.actual != null && p.expected > 0) {
        m.biases.push((p.actual - p.expected) / p.expected)
      }
    }
  }
  const lines = []
  for (const [label, m] of Object.entries(byMarket).sort((a, b) => b[1].t - a[1].t)) {
    const pct = Math.round((m.g / m.t) * 100)
    const bias = m.biases.length ? m.biases.reduce((a, b) => a + b, 0) / m.biases.length : null
    let verdict
    if (bias != null && bias <= -0.10) verdict = `el motor proyecta ${Math.abs(Math.round(bias * 100))}% POR ENCIMA de lo real → sobreestima; desconfía de los OVER aquí o espera líneas más bajas`
    else if (bias != null && bias >= 0.10) verdict = `el motor proyecta ${Math.round(bias * 100)}% POR DEBAJO de lo real → subestima; los OVER tienen valor extra`
    else if (bias != null) verdict = 'proyección bien calibrada (±10%)'
    else verdict = 'sin datos de proyección para medir el sesgo'
    lines.push({ label, pct, n: m.t, g: m.g, bias, verdict })
  }
  return lines
}

export default function Predicciones({ league }) {
  const [pendientes, setPendientes] = useState([])
  const [evaluadas, setEvaluadas] = useState([])
  const [checking, setChecking] = useState(false)
  const [checkInfo, setCheckInfo] = useState('')
  const [btLoading, setBtLoading] = useState(false)
  const [btInfo, setBtInfo] = useState('')
  const [iaTexto, setIaTexto] = useState(null)
  const [iaLoading, setIaLoading] = useState(false)

  const [closedLeagues, setClosedLeagues] = useState({})
  const [openMatches, setOpenMatches] = useState({})

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

  // ── BACKTEST: correr el motor ACTUAL sobre los últimos partidos jugados ──
  const runBacktest = useCallback(async () => {
    setBtLoading(true)
    setBtInfo('')
    try {
      const fx = await fetchFixtures(league.id)
      if (!fx?.ok) throw new Error(fx?.error || 'No se pudo cargar el fixture')
      const yaHechos = new Set(getEvaluaciones().map(e => e.key))
      const terminados = (fx.fixtures ?? [])
        .filter(f => ['FT', 'AET', 'PEN'].includes(f.status) && f.homeId && f.awayId)
        .filter(f => !yaHechos.has(`backtest_${f.id}`))
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5)

      if (!terminados.length) {
        setBtInfo('No hay partidos terminados nuevos de esta liga en los últimos 7 días (o ya fueron backtesteados)')
        return
      }

      let done = 0
      for (const f of terminados) {
        const onProgress = (name, i, n) => setBtInfo(`${f.homeTeam} vs ${f.awayTeam} — cargando historial de ${name} (${i}/${n})...`)
        try {
          const ev = await backtestMatch(league, f, onProgress)
          saveEvaluacion(ev)
          done++
          setBtInfo(`✓ ${done}/${terminados.length}: ${f.homeTeam} ${f.homeGoals}-${f.awayGoals} ${f.awayTeam}`)
          reload()
        } catch (e) {
          setBtInfo(`⚠️ ${f.homeTeam} vs ${f.awayTeam}: ${e.message} — sigo con el siguiente`)
        }
      }
      setBtInfo(`✓ Backtest terminado: ${done} partido(s) evaluado(s) con el motor actual`)
      reload()
    } catch (e) {
      setBtInfo(`Error: ${e.message}`)
    } finally {
      setBtLoading(false)
    }
  }, [league, reload])

  // ── Informe IA sobre la calibración ──
  const runIA = useCallback(async () => {
    setIaLoading(true)
    setIaTexto(null)
    try {
      const evs = getEvaluaciones()
      const resumen = evs.slice(0, 20).map(e =>
        `${e.home} ${e.score ?? 'vs'} ${e.away}${e.backtest ? ' [backtest]' : ''}:\n` +
        (e.picks ?? []).map(p =>
          `  - ${p.label} ${p.dir} ${p.line} → ${p.res.toUpperCase()}${p.actual != null ? ` (real: ${p.actual}${p.expected != null ? `, proyectado: ${p.expected}` : ''})` : ''}`
        ).join('\n')
      ).join('\n')
      const texto = await diagnosticoCalibracion(resumen)
      setIaTexto(texto)
    } catch (e) {
      setIaTexto(`Error: ${e.message}`)
    } finally {
      setIaLoading(false)
    }
  }, [])

  // ── Resumen de aciertos y diagnóstico ──
  const allPicks = evaluadas.flatMap(e => (e.picks ?? []).filter(p => p.res === 'ganada' || p.res === 'perdida'))
  const ganadas = allPicks.filter(p => p.res === 'ganada').length
  const hitRate = allPicks.length ? Math.round((ganadas / allPicks.length) * 100) : null
  const diagnostico = buildDiagnostico(evaluadas)

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-white">🎯 Predicciones del Motor</h1>
          <p className="text-gray-400 text-xs mt-1">
            Compara lo que el motor sugiere contra lo que realmente pasa — para saber en qué confiar y qué recalibrar.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={runBacktest} disabled={btLoading}
            className="text-xs px-3 py-1.5 rounded bg-purple-800/50 text-purple-300 hover:bg-purple-700/60 border border-purple-700/40 transition-colors disabled:opacity-50">
            {btLoading ? '⏳ Corriendo...' : `🧪 Backtest ${league.flag} últimos jugados`}
          </button>
          <button onClick={checkResults} disabled={checking}
            className="text-xs px-3 py-1.5 rounded bg-green-800/50 text-green-300 hover:bg-green-700/60 border border-green-700/40 transition-colors disabled:opacity-50">
            {checking ? '⏳ Revisando...' : '🔍 Revisar pendientes'}
          </button>
        </div>
      </div>

      {checkInfo && (
        <p className={`text-xs ${checkInfo.startsWith('✓') ? 'text-green-400' : checkInfo.startsWith('Error') ? 'text-red-400' : 'text-gray-400'}`}>{checkInfo}</p>
      )}
      {btInfo && (
        <p className={`text-xs ${btInfo.startsWith('✓') ? 'text-purple-300' : btInfo.startsWith('Error') ? 'text-red-400' : 'text-gray-400'}`}>{btInfo}</p>
      )}

      {/* ── Resumen global ── */}
      {hitRate != null && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card text-center bg-dark-700">
            <p className="text-xs text-gray-400">Hit Rate global</p>
            <p className={`text-3xl font-black ${hitRate >= 60 ? 'text-green-400' : hitRate >= 45 ? 'text-yellow-400' : 'text-red-400'}`}>{hitRate}%</p>
            <p className="text-xs text-gray-600">{ganadas}/{allPicks.length} picks</p>
          </div>
          {diagnostico.slice(0, 3).map(d => (
            <div key={d.label} className="card text-center bg-dark-700">
              <p className="text-xs text-gray-400 truncate">{d.label}</p>
              <p className={`text-2xl font-bold ${d.pct >= 60 ? 'text-green-400' : d.pct >= 45 ? 'text-yellow-400' : 'text-red-400'}`}>{d.pct}%</p>
              <p className="text-xs text-gray-600">{d.g}/{d.n}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Evaluadas — agrupadas por liga, partidos desplegables ── */}
      {evaluadas.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs text-green-400 font-semibold uppercase tracking-wide">✅ Evaluadas contra el resultado real — toca un partido para revisarlo</h2>
          {Object.entries(evaluadas.reduce((acc, e) => {
            const lg = getLeague(e.leagueId)
            const k = `${lg.flag} ${lg.name}`
            ;(acc[k] = acc[k] ?? []).push(e)
            return acc
          }, {})).map(([ligaLabel, items]) => {
            const cerrada = !!closedLeagues[ligaLabel]
            const lgPicks = items.flatMap(e => (e.picks ?? []).filter(p => p.res === 'ganada' || p.res === 'perdida'))
            const lgG = lgPicks.filter(p => p.res === 'ganada').length
            const lgPct = lgPicks.length ? Math.round((lgG / lgPicks.length) * 100) : null
            return (
              <div key={ligaLabel} className="space-y-2">
                <button onClick={() => setClosedLeagues(p => ({ ...p, [ligaLabel]: !p[ligaLabel] }))}
                  className="w-full flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-green-300 hover:text-white bg-dark-800/60 border border-green-900/40 rounded-lg px-3 py-2 transition-colors">
                  <span>{cerrada ? '▸' : '▾'}</span>
                  <span>{ligaLabel}</span>
                  <span className="text-gray-500 normal-case">· {items.length} partido(s)</span>
                  {lgPct != null && (
                    <span className={`ml-auto font-bold normal-case ${lgPct >= 60 ? 'text-green-400' : lgPct >= 45 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {lgG}/{lgPicks.length} ({lgPct}%)
                    </span>
                  )}
                </button>

                {!cerrada && items.map(e => {
                  const abierto = !!openMatches[e.key]
                  const g = (e.picks ?? []).filter(p => p.res === 'ganada').length
                  const pd = (e.picks ?? []).filter(p => p.res === 'perdida').length
                  const push = (e.picks ?? []).filter(p => p.res === 'push').length
                  const sd = (e.picks ?? []).filter(p => p.res === 'sin_dato').length
                  return (
                    <div key={e.key} className="card !p-0 overflow-hidden">
                      <button onClick={() => setOpenMatches(p => ({ ...p, [e.key]: !p[e.key] }))}
                        className="w-full flex items-center gap-2 flex-wrap text-left px-4 py-3 hover:bg-dark-700/40 transition-colors">
                        <span className="text-gray-500 text-xs">{abierto ? '▾' : '▸'}</span>
                        <span className="text-white font-medium text-sm">{e.home} <strong className="text-green-400">{e.score ?? 'vs'}</strong> {e.away}</span>
                        {e.backtest && <span className="text-[10px] bg-purple-900/60 text-purple-300 rounded px-1.5 py-0.5 font-semibold">🧪 BACKTEST</span>}
                        <span className="ml-auto flex items-center gap-1.5 text-xs">
                          {g > 0 && <span className="bg-green-900/60 text-green-300 rounded px-1.5 py-0.5 font-bold">✅ {g}</span>}
                          {pd > 0 && <span className="bg-red-900/60 text-red-300 rounded px-1.5 py-0.5 font-bold">❌ {pd}</span>}
                          {push > 0 && <span className="bg-yellow-900/50 text-yellow-300 rounded px-1.5 py-0.5 font-bold">➖ {push}</span>}
                          {sd > 0 && <span className="bg-dark-600 text-gray-400 rounded px-1.5 py-0.5">? {sd}</span>}
                          <span className="text-gray-600">{e.date?.slice(0, 10) ?? new Date(e.ts).toLocaleDateString('es-CO')}</span>
                        </span>
                      </button>

                      {abierto && (
                        <div className="space-y-1 px-4 pb-3">
                          {(e.picks ?? []).map((p, i) => (
                            <div key={i} className={`flex items-center gap-2 text-xs rounded-lg border px-3 py-1.5 flex-wrap ${RES_STYLE[p.res]}`}>
                              <span className="font-bold">{RES_LABEL[p.res]}{p.manual && ' ✍️'}</span>
                              <span className="text-gray-300">{p.label} {p.dir} {p.line}</span>
                              {p.actual != null && <span className="font-mono">· real: <strong>{p.actual}</strong>{p.expected != null && <span className="text-gray-500"> (proy: {p.expected})</span>}</span>}
                              {p.res === 'sin_dato' && !p.manual && <span className="text-gray-500">· sin dato de la API — márcalo tú:</span>}
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
                            <p className="text-xs text-gray-600">El análisis no dejó picks guardados (márgenes fuera de rango o sin stats verificables)</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Diagnóstico al final: análisis por línea de qué está fallando ── */}
      {diagnostico.length > 0 && (
        <div className="card border border-purple-800/40 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-semibold text-white text-sm">🔧 Análisis por línea — qué está fallando y qué ajustamos</h2>
            {hasIA() && (
              <button onClick={runIA} disabled={iaLoading}
                className="text-xs px-3 py-1.5 rounded bg-blue-800/50 text-blue-300 hover:bg-blue-700/60 border border-blue-700/40 disabled:opacity-50">
                {iaLoading ? '⏳ Analizando...' : '🤖 Informe IA profundo'}
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {diagnostico.map(d => (
              <div key={d.label} className="text-xs rounded-lg bg-dark-700/60 px-3 py-2">
                <span className={`font-bold ${d.pct >= 60 ? 'text-green-400' : d.pct >= 45 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {d.label} — {d.g}/{d.n} ({d.pct}%)
                </span>
                <span className="text-gray-400"> · {d.verdict}</span>
              </div>
            ))}
          </div>
          {!hasIA() && (
            <p className="text-[11px] text-gray-600">💡 Con la clave VITE_ANTHROPIC_API_KEY configurada, aquí aparece un botón de informe IA que analiza las causas a fondo y propone ajustes concretos.</p>
          )}
          {iaTexto && (
            <div className="mt-2 bg-dark-900/70 rounded-xl p-4 text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{iaTexto}</div>
          )}
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
          <span className="text-xs text-gray-600">
            Usa <strong className="text-purple-400">🧪 Backtest</strong> para correr el motor sobre los últimos partidos ya jugados de {league.flag} {league.name} y ver qué habría predicho — o analiza un partido en la pestaña Analizar y vuelve cuando termine.
          </span>
        </div>
      )}
    </div>
  )
}
