import { useState, useEffect, useCallback } from 'react'
import { fetchFixtures, fetchFixtureStats, isDone } from '../lib/football-api'
import { fetchSofaSaques, buscarSaquesPorFecha } from '../lib/sofascore'
import { listPredicciones, listResultados, yaResuelto, saveResultado, resolverPrediccion } from '../lib/predicciones'
import { LEAGUES, getLeague } from '../lib/leagues'
import ModelHealth from './ModelHealth'
import Historico from './Historico'

// ─── Rendimiento del Motor — calibración automática ──────────────────────────
// Toma cada predicción guardada, busca el partido TERMINADO en Live-Score,
// marca sola si se dio o no, y lo acumula PARA SIEMPRE agrupado por liga.

const norm = s => (s ?? '').toLowerCase().trim()

const MERCADOS = [
  ['goals', 'Goles'], ['shots', 'Tiros'], ['sot', 'SOT'], ['corners', 'Córners'],
  ['cards', 'Tarjetas'], ['fouls', 'Faltas'], ['ti', 'S. Banda'], ['gk', 'S. Puerta'],
]

export default function Rendimiento() {
  const [resultados, setResultados] = useState(listResultados)
  const [buscando, setBuscando] = useState(false)
  const [msg, setMsg] = useState('')

  // ── Resolver predicciones pendientes contra Live-Score ──
  const buscarNuevos = useCallback(async () => {
    setBuscando(true)
    setMsg('')
    let nuevos = 0
    try {
      const pendientes = listPredicciones().filter(p => !yaResuelto(p.leagueId, p.home, p.away))
      const porLiga = {}
      for (const p of pendientes) (porLiga[p.leagueId] = porLiga[p.leagueId] ?? []).push(p)

      for (const [leagueId, preds] of Object.entries(porLiga)) {
        let fixtures
        try {
          const res = await fetchFixtures(Number(leagueId))
          if (!res.ok) continue
          fixtures = res.fixtures ?? []
        } catch { continue }

        for (const pred of preds) {
          // Buscar el partido TERMINADO entre esos dos equipos (cualquier orden)
          const match = fixtures.find(f =>
            isDone(f.status) &&
            ((norm(f.homeTeam) === norm(pred.home) && norm(f.awayTeam) === norm(pred.away)) ||
             (norm(f.homeTeam) === norm(pred.away) && norm(f.awayTeam) === norm(pred.home)))
          )
          if (!match) continue
          // El partido debe haber empezado DESPUÉS de la predicción (pre-partido real)
          if (match.date && new Date(match.date).getTime() < pred.ts - 2 * 3600_000) continue

          try {
            const sr = await fetchFixtureStats(match.id, match.homeId, match.awayId)
            if (!sr.ok || !sr.stats?.length) continue
            const home = { ...(sr.stats[0]?.stats ?? {}) }
            const away = { ...(sr.stats[1]?.stats ?? {}) }

            // Completar saques con Sofascore si faltan
            if (home['Goal Kicks'] == null || home['Throw Ins'] == null) {
              try {
                const sofa = await fetchSofaSaques(match.homeTeam, 12)
                const s = buscarSaquesPorFecha(sofa.byDate, (match.date ?? '').slice(0, 10), match.awayTeam)
                if (s) {
                  if (home['Goal Kicks'] == null && s.gk != null) { home['Goal Kicks'] = s.gk; away['Goal Kicks'] = s.gkAg }
                  if (home['Throw Ins'] == null && s.ti != null) { home['Throw Ins'] = s.ti; away['Throw Ins'] = s.tiAg }
                }
              } catch {}
            }

            const entry = resolverPrediccion(pred, match, home, away)
            saveResultado(entry)
            nuevos++
          } catch {}
        }
      }
      setResultados(listResultados())
      setMsg(nuevos > 0 ? `✅ ${nuevos} partido(s) nuevo(s) resuelto(s)` : 'Sin partidos nuevos terminados — las predicciones pendientes se resuelven cuando acaben')
    } finally {
      setBuscando(false)
    }
  }, [])

  useEffect(() => { buscarNuevos() }, [buscarNuevos])

  // ── Agregados globales ──
  const todosPicks = resultados.flatMap(r => (r.picks ?? []).filter(p => p.result === 'W' || p.result === 'L'))
  const ganados = todosPicks.filter(p => p.result === 'W').length
  const hitRate = todosPicks.length ? Math.round((ganados / todosPicks.length) * 100) : null

  // Error medio absoluto por mercado (%)
  const errPorMercado = MERCADOS.map(([k, label]) => {
    const errs = resultados.map(r => r.errores?.[k]).filter(e => e != null)
    if (!errs.length) return null
    const mae = errs.reduce((s, e) => s + Math.abs(e), 0) / errs.length
    const bias = errs.reduce((s, e) => s + e, 0) / errs.length
    return { k, label, mae: Math.round(mae * 100), bias: Math.round(bias * 100), n: errs.length }
  }).filter(Boolean)

  // Agrupar por liga
  const porLiga = Object.entries(
    resultados.reduce((acc, r) => {
      (acc[r.leagueId] = acc[r.leagueId] ?? []).push(r)
      return acc
    }, {})
  )

  const pendientes = listPredicciones().filter(p => !yaResuelto(p.leagueId, p.home, p.away))

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-white">📈 Rendimiento del Motor</h1>
          <p className="text-gray-400 text-xs mt-1">Cada predicción se marca sola contra las stats finales de Live-Score — el registro es permanente</p>
        </div>
        <button onClick={buscarNuevos} disabled={buscando}
          className="text-xs px-3 py-1.5 rounded bg-dark-700 text-gray-300 hover:bg-dark-600 transition-colors disabled:opacity-50">
          {buscando ? '⏳ Resolviendo...' : '🔄 Buscar resultados nuevos'}
        </button>
      </div>

      {msg && <p className="text-xs text-gray-500">{msg}</p>}

      {/* ── HISTÓRICO: navegación por fecha, match review, lecciones ── */}
      <Historico />

      {/* ── MODEL HEALTH: salud de los modelos cuantitativos (v5.1) ── */}
      <ModelHealth />

      {/* ── Resumen global ── */}
      {resultados.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card text-center bg-dark-700">
            <p className="text-xs text-gray-500">Partidos evaluados</p>
            <p className="text-2xl font-black text-white">{resultados.length}</p>
          </div>
          <div className="card text-center bg-dark-700">
            <p className="text-xs text-gray-500">Picks resueltos</p>
            <p className="text-2xl font-black text-white">{ganados}G / {todosPicks.length - ganados}P</p>
          </div>
          <div className="card text-center bg-dark-700">
            <p className="text-xs text-gray-500">Hit rate picks</p>
            <p className={`text-2xl font-black ${hitRate >= 60 ? 'text-green-400' : hitRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
              {hitRate != null ? hitRate + '%' : '—'}
            </p>
          </div>
          <div className="card text-center bg-dark-700">
            <p className="text-xs text-gray-500">Pendientes por jugar</p>
            <p className="text-2xl font-black text-blue-400">{pendientes.length}</p>
          </div>
        </div>
      )}

      {/* ── Error por mercado — dónde confiar ── */}
      {errPorMercado.length > 0 && (
        <div className="card border border-dark-600">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Margen de error por mercado (menor = más confiable)</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {errPorMercado.sort((a, b) => a.mae - b.mae).map(e => (
              <div key={e.k} className="bg-dark-700 rounded-lg p-2">
                <p className="text-xs text-gray-400">{e.label} <span className="text-gray-600">({e.n}p)</span></p>
                <p className={`text-lg font-bold ${e.mae <= 15 ? 'text-green-400' : e.mae <= 30 ? 'text-yellow-400' : 'text-red-400'}`}>
                  ±{e.mae}%
                </p>
                <p className="text-[10px] text-gray-600">
                  {e.bias > 5 ? `tiende a quedarse corto ${e.bias}%` : e.bias < -5 ? `tiende a pasarse ${-e.bias}%` : 'sin sesgo'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {resultados.length === 0 && (
        <div className="card text-center text-gray-500 py-12">
          <p className="text-4xl mb-3">🔮</p>
          <p>Aún no hay partidos resueltos.</p>
          <p className="text-xs text-gray-600 mt-2">
            Analiza partidos ANTES de que empiecen (la predicción se guarda sola) y cuando terminen aparecerán aquí marcados ✅/❌ automáticamente.
            {pendientes.length > 0 && ` Hay ${pendientes.length} predicción(es) esperando a que se juegue el partido.`}
          </p>
        </div>
      )}

      {/* ── Por liga ── */}
      {porLiga.map(([leagueId, items]) => {
        const l = getLeague(leagueId)
        const picksLiga = items.flatMap(r => (r.picks ?? []).filter(p => p.result === 'W' || p.result === 'L'))
        const gLiga = picksLiga.filter(p => p.result === 'W').length
        return (
          <div key={leagueId} className="card border border-dark-600 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-bold text-white text-sm">{l.flag} {l.name}</p>
              {picksLiga.length > 0 && (
                <span className="text-xs text-gray-400">
                  picks: <span className="text-green-400 font-bold">{gLiga}G</span> / <span className="text-red-400 font-bold">{picksLiga.length - gLiga}P</span>
                </span>
              )}
            </div>

            {items.map((r, i) => (
              <div key={i} className="bg-dark-800/70 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="text-gray-500 text-xs">{new Date(r.matchTs).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' })}</span>
                  <span className="text-white font-semibold">{r.home} <span className="text-green-400 font-black">{r.score}</span> {r.away}</span>
                </div>

                {/* Expected vs real por mercado */}
                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                  {MERCADOS.map(([k, label]) => {
                    const p = r.expected?.[k]; const real = r.reales?.[k]
                    if (p == null || real == null) return null
                    const err = Math.abs((real - p) / p)
                    const icon = err <= 0.15 ? '✅' : err <= 0.30 ? '⚠️' : '❌'
                    return (
                      <span key={k} className="text-[11px]">
                        <span className="text-gray-500">{label}</span>{' '}
                        <span className="text-purple-300">{p}</span>
                        <span className="text-gray-600">→</span>
                        <span className="text-white font-bold">{real}</span> {icon}
                      </span>
                    )
                  })}
                </div>

                {/* Picks resueltos */}
                {(r.picks ?? []).length > 0 && (
                  <div className="space-y-0.5 pt-1 border-t border-dark-700/60">
                    {r.picks.map((p, j) => (
                      <p key={j} className="text-[11px]">
                        <span className={
                          p.result === 'W' ? 'text-green-400 font-bold' :
                          p.result === 'L' ? 'text-red-400 font-bold' :
                          p.result === 'PUSH' ? 'text-yellow-400 font-bold' : 'text-gray-600'
                        }>
                          {p.result === 'W' ? '✅ GANADA' : p.result === 'L' ? '❌ FALLÓ' : p.result === 'PUSH' ? '🟡 PUSH' : '· sin dato'}
                        </span>
                        <span className="text-gray-300 ml-1.5">{p.label} {p.dir} {p.line}</span>
                        {p.real != null && <span className="text-gray-500"> — salió {p.real}</span>}
                        <span className="text-gray-600"> (conf {p.confidence})</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
