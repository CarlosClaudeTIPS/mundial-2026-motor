import { useState, useMemo, useEffect } from 'react'
import {
  cardsLiveModel, cardsPrior, cardsConfidence, cardsEdge, cardsFactores,
  logCardsSnapshot, cardsBacktestSummary,
} from '../lib/cards'
import { ensureBaseline } from '../lib/baseline'
import { reportarOportunidad, logDecision } from '../lib/market-engine'
import { fetchSofaContexto, fetchSofaAmonestados } from '../lib/sofascore'

// ─── Panel cuantitativo de TARJETAS en vivo ──────────────────────────────────
// Prematch (disciplina propia + provocada + árbitro real) → hazard temporal
// live (las tarjetas se concentran al final, nada de extrapolación lineal) →
// NB → mercados total/local/visitante → dos edges → BET/NO BET.

const FUENTE_LABEL = {
  api: '🟢 Live-Score (dato directo por equipo)',
  manual: '✍️ manual',
}

export default function CardsQuant({ minuto, goalDiff, cH, cA, yH, yA, rH, rA, foulsH, foulsA, fuente, snaps, preA, preB, matchInfo, homeName, awayName }) {
  const [market, setMarket] = useState('total')
  const [line, setLine] = useState('')
  const [oddsOver, setOddsOver] = useState('')
  const [oddsUnder, setOddsUnder] = useState('')
  const [showConf, setShowConf] = useState(false)
  const [showBt, setShowBt] = useState(false)

  // Árbitro (prematch, Sofascore) — undefined = cargando, null = sin dato
  const [refInfo, setRefInfo] = useState(undefined)
  useEffect(() => {
    if (!matchInfo?.home) { setRefInfo(null); return }
    let alive = true
    fetchSofaContexto(matchInfo.home)
      .then(c => alive && setRefInfo(c?.referee ?? null))
      .catch(() => alive && setRefInfo(null))
    return () => { alive = false }
  }, [matchInfo?.home]) // eslint-disable-line react-hooks/exhaustive-deps

  // Amonestados (live, Sofascore incidents) — refresco cada ~5 min de juego
  const [booked, setBooked] = useState(null)
  const bookedTick = Math.floor((minuto ?? 0) / 5)
  useEffect(() => {
    if (!matchInfo?.home) return
    let alive = true
    fetchSofaAmonestados(matchInfo.home)
      .then(b => alive && setBooked(b))
      .catch(() => {})
    return () => { alive = false }
  }, [matchInfo?.home, bookedTick]) // eslint-disable-line react-hooks/exhaustive-deps

  const prior = useMemo(() => cardsPrior(preA, preB, { refYellowPg: refInfo?.yellowPerGame ?? null }), [preA, preB, refInfo])

  // Baseline congelado — espera a que el árbitro resuelva (también es prematch)
  const baseline = useMemo(() => (matchInfo?.id && prior && refInfo !== undefined)
    ? ensureBaseline(matchInfo.id, 'cards', { expected: prior.total, sd: prior.sd })
    : null, [matchInfo?.id, prior, refInfo]) // eslint-disable-line react-hooks/exhaustive-deps

  const model = useMemo(() => cardsLiveModel({
    minuto, cH, cA, yH, yA, rH, rA, foulsH, foulsA, goalDiff, snaps, prior, booked,
  }), [minuto, cH, cA, yH, yA, rH, rA, foulsH, foulsA, goalDiff, snaps, prior, booked])

  const conf = useMemo(() => cardsConfidence({ model, prior, fuente, snapsN: snaps?.length ?? 0 }), [model, prior, fuente, snaps])

  const edge = useMemo(() => {
    const l = parseFloat(line); const oO = parseFloat(oddsOver); const oU = parseFloat(oddsUnder)
    if (!model || isNaN(l) || isNaN(oO)) return null
    return cardsEdge({ model, market, line: l, oddsOver: oO, oddsUnder: isNaN(oU) ? null : oU, confidence: conf.score })
  }, [model, market, line, oddsOver, oddsUnder, conf.score])

  const factores = useMemo(() => cardsFactores({
    model, prior, goalDiff,
    homeName: homeName?.trim() || 'Local', awayName: awayName?.trim() || 'Visitante',
  }), [model, prior, goalDiff, homeName, awayName])

  const ladder = useMemo(() => {
    if (!model) return []
    const cfg = {
      total: { exp: model.expectedFinal, acum: model.acum, fn: model.pOver },
      local: { exp: model.home.expectedFinal, acum: model.home.acum, fn: model.pOverHome },
      visitante: { exp: model.away.expectedFinal, acum: model.away.acum, fn: model.pOverAway },
    }[market]
    const c = Math.floor(cfg.exp) + 0.5
    return [c - 2, c - 1, c, c + 1, c + 2]
      .filter(l => l > 0 && l > cfg.acum - 1)
      .map(l => ({ line: l, p: Math.round(cfg.fn(l) * 1000) / 10 }))
  }, [model, market])

  useEffect(() => {
    if (model && matchInfo?.id) logCardsSnapshot(matchInfo.id, { ...matchInfo, baseline: baseline?.expected, hayRoja: model.hayRoja || undefined, goalDiff: model.hayRoja ? goalDiff : undefined }, model)
  }, [model?.minuto, baseline?.expected]) // eslint-disable-line react-hooks/exhaustive-deps

  const bt = useMemo(() => showBt ? cardsBacktestSummary() : null, [showBt, model?.minuto]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!matchInfo?.id) return
    const edgeLado = edge ? (edge.lado === 'UNDER' ? edge.edgeUnder : edge.edgeOver) : null
    const mLbl = market === 'total' ? '' : market === 'local' ? `${homeName?.split(' ')[0] ?? 'Local'} ` : `${awayName?.split(' ')[0] ?? 'Visita'} `
    reportarOportunidad(matchInfo.id, `cards_${market}`, edge ? {
      marketBase: 'cards', label: `Tarjetas ${mLbl}${edge.lado ? edge.lado + ' ' : 'O/U '}${edge.line}`,
      signal: edge.signal, quality: edge.quality, edgeLado, evPct: edge.evPct,
      conf: conf.score, line: edge.line, minuto,
    } : null)
    if (edge) logDecision({
      matchId: matchInfo.id, match: `${matchInfo.home} vs ${matchInfo.away}`,
      market: `cards_${market}`, line: edge.line, odds: edge.oddsOver,
      baseline: baseline?.expected, live: model?.expectedFinal,
      pModelo: edge.pOver, pImplicita: edge.impOver, edge: edge.edgeOver,
      ev: edge.evPct, confidence: conf.score, signal: edge.signal, quality: edge.quality, minuto,
    })
  }, [edge, conf.score, market]) // eslint-disable-line react-hooks/exhaustive-deps

  if (cH == null || cA == null) return (
    <div className="card border border-rose-800/40">
      <p className="font-bold text-rose-300 text-sm">🟨 TARJETAS — módulo cuantitativo</p>
      <p className="text-xs text-gray-500 mt-1">Este partido aún no reporta tarjetas por equipo en la API — el módulo se activa cuando lleguen las stats en vivo.</p>
    </div>
  )
  if (!model) return null

  const tn = { h: homeName?.trim() || 'Local', a: awayName?.trim() || 'Visitante' }
  const bookedList = booked ? [...(booked.home ?? []).map(b => ({ ...b, team: tn.h })), ...(booked.away ?? []).map(b => ({ ...b, team: tn.a }))].filter(b => b.type === 'yellow') : []

  return (
    <div className="rounded-2xl border-2 border-rose-700/60 bg-gradient-to-b from-rose-950/40 to-dark-800 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-black text-rose-300 tracking-wide">🟨 TARJETAS — módulo cuantitativo</h2>
        <span className="text-[10px] text-gray-500">fuente: {FUENTE_LABEL[fuente] ?? '—'}</span>
      </div>
      <p className="text-[10px] text-yellow-600/80 -mt-1">Modelo BASELINE (heurístico, sin calibrar) · señales en modo 📝 PAPER: registrar y validar, no es ventaja demostrada</p>

      {/* ── Estado actual ── */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center">
        {[
          ['Minuto', `${model.minuto}'`],
          ['Tarjetas', `${model.acum} (${model.acumH}·${model.acumA})`],
          ['Faltas', model.foulsTot != null ? `${model.foulsTot} (${foulsH ?? '—'}·${foulsA ?? '—'})` : '—'],
          ['Expected final', model.expectedFinal, 'text-rose-300 text-xl'],
          ['Intervalo 80%', `${model.interval[0]}–${model.interval[1]}`],
          ['Confianza', `${conf.score}/100`, conf.score >= 70 ? 'text-green-400' : conf.score >= 55 ? 'text-yellow-400' : 'text-orange-400'],
        ].map(([label, val, cls]) => (
          <div key={label} className="bg-dark-800/80 rounded-lg p-2">
            <p className="text-[10px] text-gray-500">{label}</p>
            <p className={`font-black ${cls ?? 'text-white'}`}>{val}</p>
          </div>
        ))}
      </div>

      {/* ── PREMATCH baseline → LIVE ── */}
      {baseline && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] bg-dark-800/50 rounded-lg px-2 py-1.5 border border-dark-600">
          <span className="text-gray-500 uppercase tracking-wide text-[9px] font-bold">Prematch → Live</span>
          <span className="text-gray-300">Baseline prepartido: <strong className="text-white">{baseline.expected}</strong></span>
          <span className="text-gray-300">→ Live ahora: <strong className="text-rose-300">{model.expectedFinal}</strong>
            {(() => { const d = Math.round((model.expectedFinal - baseline.expected) / baseline.expected * 100); return (
              <span className={d > 5 ? 'text-orange-300' : d < -5 ? 'text-blue-300' : 'text-gray-500'}> ({d > 0 ? '+' : ''}{d}%)</span>
            )})()}
          </span>
          {model.hayRoja && <span className="text-red-400 font-bold">🟥 roja en cancha</span>}
          <span className="text-gray-600">— el porqué del cambio está en los factores de abajo</span>
        </div>
      )}

      {/* ── Por equipo + próxima tarjeta + árbitro ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
        <div className="bg-dark-800/60 rounded-lg p-2">
          <p className="text-gray-500">{tn.h} <span className="text-gray-600">🟨{yH ?? '—'} 🟥{rH ?? 0}</span></p>
          <p className="text-white">van <strong>{model.home.acum}</strong> → proy <strong className="text-rose-300">{model.home.expectedFinal}</strong>
            <span className="text-gray-600"> · estado ×{model.home.state}</span></p>
        </div>
        <div className="bg-dark-800/60 rounded-lg p-2">
          <p className="text-gray-500">{tn.a} <span className="text-gray-600">🟨{yA ?? '—'} 🟥{rA ?? 0}</span></p>
          <p className="text-white">van <strong>{model.away.acum}</strong> → proy <strong className="text-rose-300">{model.away.expectedFinal}</strong>
            <span className="text-gray-600"> · estado ×{model.away.state}</span></p>
        </div>
        {model.nextCard && (
          <div className="bg-dark-800/60 rounded-lg p-2">
            <p className="text-gray-500">Próxima tarjeta</p>
            <p className="text-white">{tn.h.split(' ')[0]} <strong className="text-green-300">{Math.round(model.nextCard.pHome * 100)}%</strong>
              {' · '}{tn.a.split(' ')[0]} <strong className="text-blue-300">{Math.round(model.nextCard.pAway * 100)}%</strong>
              <span className="text-gray-600"> · P(ninguna en 10') {Math.round(model.nextCard.pNone10 * 100)}%</span></p>
          </div>
        )}
      </div>

      {/* ── Diagnóstico ── */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
        {refInfo?.name && (
          <span className="text-gray-400">⚖️ Árbitro: <strong className="text-white">{refInfo.name}</strong>
            {prior?.refUsado
              ? <span className="text-gray-600"> ({prior.refYellowPg} am/partido → factor <strong className={prior.refFactor >= 1.1 ? 'text-orange-300' : prior.refFactor <= 0.92 ? 'text-blue-300' : 'text-gray-300'}>×{prior.refFactor}</strong>)</span>
              : <span className="text-gray-600"> (sin promedio disponible)</span>}
          </span>
        )}
        {refInfo === null && <span className="text-yellow-600">Sin dato del árbitro (variable de alto impacto ausente — la confianza lo castiga)</span>}
        {!prior && <span className="text-yellow-600">Sin prior prepartido — espera a que cargue el historial</span>}
        {prior && <span className="text-gray-400">Prior: <strong className="text-white">{prior.total}</strong> <span className="text-gray-600">({tn.h.split(' ')[0]} {prior.expA} · {tn.a.split(' ')[0]} {prior.expB} · faltas esperadas {prior.foulsExp})</span></span>}
        <span className="text-gray-400">Hazard: <strong className="text-white">{Math.round(model.restShare * 100)}%</strong> <span className="text-gray-600">de las tarjetas de un partido típico caen después del {model.minuto}'</span></span>
        {model.foulsObs != null && <span className="text-gray-400">Fricción: <strong className={model.foulsFactor > 1.02 ? 'text-orange-300' : model.foulsFactor < 0.98 ? 'text-blue-300' : 'text-gray-300'}>×{model.foulsFactor}</strong> <span className="text-gray-600">({model.foulsObs} faltas/min)</span></span>}
      </div>

      {/* ── Amonestados (riesgo de segunda amarilla — cualitativo) ── */}
      {bookedList.length > 0 && (
        <p className="text-[11px] text-yellow-500/90">🟨 Amonestados: {bookedList.map(b => `${b.name} (${b.team}${b.min ? ` ${b.min}'` : ''})`).join(' · ')} <span className="text-gray-600">— riesgo de segunda amarilla, sin peso en el número</span></p>
      )}

      {/* ── Mercado + escalera ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {[['total', 'Total'], ['local', tn.h.split(' ')[0]], ['visitante', tn.a.split(' ')[0]]].map(([k, lbl]) => (
          <button key={k} onClick={() => setMarket(k)}
            className={`text-xs px-2.5 py-1 rounded-lg border ${market === k ? 'bg-rose-800/60 border-rose-500 text-white font-bold' : 'bg-dark-700 border-dark-600 text-gray-400 hover:text-white'}`}>
            {lbl}
          </button>
        ))}
        <div className="flex gap-2 flex-wrap">
          {ladder.map(l => (
            <span key={l.line} className={`px-2 py-1 rounded-lg text-xs font-mono border ${
              l.p >= 58 ? 'bg-green-900/40 border-green-700/50 text-green-300' :
              l.p <= 42 ? 'bg-blue-900/40 border-blue-700/50 text-blue-300' :
              'bg-dark-700 border-dark-600 text-gray-400'
            }`}>
              O {l.line} · <strong>{l.p}%</strong>
            </span>
          ))}
        </div>
      </div>

      {/* ── Línea de la casa + edge ── */}
      <div className="bg-dark-800/80 rounded-xl p-3 space-y-2 border border-dark-600">
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Compara contra la línea de tu casa — mercado: <span className="text-rose-300">{market}</span></p>
        <div className="grid grid-cols-3 gap-2">
          {[
            ['Línea (ej. 4.5)', line, setLine, '0.5'],
            ['Cuota Over', oddsOver, setOddsOver, '0.01'],
            ['Cuota Under (opcional)', oddsUnder, setOddsUnder, '0.01'],
          ].map(([label, val, setter, step]) => (
            <div key={label}>
              <label className="text-[10px] text-gray-500 block mb-0.5">{label}</label>
              <input type="number" step={step} className="input-dark w-full text-sm" value={val}
                placeholder="—" onChange={e => setter(e.target.value)} />
            </div>
          ))}
        </div>

        {edge && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span className="text-gray-400">P(Over {edge.line}): <strong className="text-white">{edge.pOver}%</strong> · P(Under): <strong className="text-white">{edge.pUnder}%</strong></span>
              <span className="text-gray-400">Implícita casa{edge.sinVig ? ' (sin vig)' : ''}: <strong className="text-white">{edge.impOver}%</strong></span>
              <span className="text-gray-400">Edge Over: <strong className={edge.edgeOver > 0 ? 'text-green-400' : 'text-red-400'}>{edge.edgeOver > 0 ? '+' : ''}{edge.edgeOver} pp</strong>
                {edge.edgeUnder != null && <> · Edge Under: <strong className={edge.edgeUnder > 0 ? 'text-green-400' : 'text-red-400'}>{edge.edgeUnder > 0 ? '+' : ''}{edge.edgeUnder} pp</strong></>}
              </span>
              <span className="text-gray-500">umbral mínimo: {edge.minEdge} pp{edge.razonesUmbral.length ? ` (${edge.razonesUmbral.join(' · ')})` : ''}</span>
              {baseline && market === 'total' && (() => {
                const pPre = +(baseline.pOver(edge.line) * 100).toFixed(1)
                const ePre = +(pPre - edge.impOver).toFixed(2)
                return <span className="text-gray-500">Prematch: P(Over) {pPre}% · edge {ePre > 0 ? '+' : ''}{ePre} pp <span className="text-gray-600">(vs live {edge.edgeOver > 0 ? '+' : ''}{edge.edgeOver})</span></span>
              })()}
            </div>

            <div className={`rounded-xl px-4 py-3 text-center font-black text-xl ${
              edge.signal !== 'NO BET'
                ? (edge.lado === 'OVER' ? 'bg-green-800/70 text-green-100 border-2 border-green-500' : 'bg-blue-800/70 text-blue-100 border-2 border-blue-500')
                : 'bg-dark-700 text-gray-400 border border-dark-500'
            }`}>
              {edge.signal !== 'NO BET' ? `${edge.signal === 'BET' ? '✅ BET' : '📝 PAPER BET'} ${edge.lado} ${edge.line} (${market}) · Calidad ${edge.quality} · EV ${edge.evPct > 0 ? '+' : ''}${edge.evPct}%` : '⛔ NO BET'}
              <p className="text-[11px] font-normal mt-0.5 opacity-80">
                {edge.abstencion
                  ? `abstención: ${edge.abstencion}`
                  : edge.signal !== 'NO BET'
                    ? `edge ${edge.lado === 'OVER' ? edge.edgeOver : edge.edgeUnder} pp supera el umbral de ${edge.minEdge} pp con confianza ${conf.score}${edge.signal === 'PAPER BET' ? ' · modo PAPER: registrar — la ventaja se confirma con la calibración' : ''}`
                    : `sin ventaja robusta: el mejor edge no supera ${edge.minEdge} pp (o la confianza es baja) — no apostar también es una decisión`}
              </p>
            </div>
          </div>
        )}
        {!edge && <p className="text-[11px] text-gray-600">Ingresa línea y cuota Over para calcular el edge — con la cuota Under también, se quita el margen de la casa (más preciso)</p>}
      </div>

      {/* ── Factores ── */}
      {(factores.up.length > 0 || factores.down.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
          {factores.up.length > 0 && (
            <div className="bg-green-950/30 border border-green-900/40 rounded-lg p-2">
              <p className="text-green-400 font-bold mb-1">Aumentan tarjetas</p>
              {factores.up.map((f, i) => <p key={i} className="text-gray-300">+ {f}</p>)}
            </div>
          )}
          {factores.down.length > 0 && (
            <div className="bg-blue-950/30 border border-blue-900/40 rounded-lg p-2">
              <p className="text-blue-400 font-bold mb-1">Reducen tarjetas / suben incertidumbre</p>
              {factores.down.map((f, i) => <p key={i} className="text-gray-300">− {f}</p>)}
            </div>
          )}
        </div>
      )}

      {/* ── Confianza + backtest ── */}
      <div className="flex gap-3 text-[11px]">
        <button onClick={() => setShowConf(s => !s)} className="text-gray-500 hover:text-white">
          {showConf ? '▴' : '▸'} ¿Por qué confianza {conf.score}?
        </button>
        <button onClick={() => setShowBt(s => !s)} className="text-gray-500 hover:text-white">
          {showBt ? '▴' : '▸'} Live-backtest del modelo
        </button>
      </div>
      {showConf && (
        <div className="text-[11px] text-gray-400 space-y-0.5 bg-dark-800/60 rounded-lg p-2">
          {conf.parts.map(([pts, txt], i) => <p key={i}><span className="font-mono text-gray-500">{pts}</span> {txt}</p>)}
          <p className="text-gray-600 pt-1">La confianza mide calidad/estabilidad de la predicción — NO es probabilidad de ganar.</p>
        </div>
      )}
      {showBt && (
        <div className="text-[11px] bg-dark-800/60 rounded-lg p-2">
          {!bt && <p className="text-gray-500">Aún no hay partidos resueltos. Cada partido guarda snapshots por minuto y se resuelve solo con las tarjetas finales de Live-Score.</p>}
          {bt && (
            <>
              <p className="text-gray-400 mb-1">{bt.matches} partido(s) resuelto(s){bt.conRoja ? ` (${bt.conRoja} con roja)` : ''} — error por minuto:</p>
              {bt.dist && <p className="text-gray-500 mb-1">Distribución: log-loss {bt.dist.logloss} (0.693 = moneda) · sharpness {bt.dist.sharpness} · cobertura 10-90: {bt.dist.coverage != null ? `${bt.dist.coverage}% (objetivo ~80%)` : '—'}</p>}
              {bt.pre && <p className="text-gray-500 mb-1">📌 Baseline PREMATCH: ±{bt.pre.mae} ({bt.pre.n}p) — el live debe mejorar este error conforme avanza</p>}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5">
                {bt.rows.map(r => (
                  <div key={r.bucket} className="bg-dark-700 rounded p-1.5 text-center">
                    <p className="text-gray-500">{r.bucket}</p>
                    <p className={`font-bold ${r.mae <= 1 ? 'text-green-400' : r.mae <= 2 ? 'text-yellow-400' : 'text-red-400'}`}>±{r.mae}</p>
                    {r.maeNaive != null && <p className={r.mae <= r.maeNaive ? 'text-green-600' : 'text-red-500'}>naive ±{r.maeNaive}</p>}
                    <p className="text-gray-600">acierto {r.hit}% · n={r.n}</p>
                  </div>
                ))}
              </div>
              {bt.calib?.length > 0 && (
                <div className="mt-1.5">
                  <p className="text-gray-500 mb-1">Calibración — el modelo dice% → ocurre%:</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {bt.calib.map(c => (
                      <span key={c.rango} className="bg-dark-700 rounded px-1.5 py-0.5">
                        {c.rango} → <strong className={Math.abs(c.real - (parseInt(c.rango) + 5)) <= 10 ? 'text-green-400' : 'text-red-400'}>{c.real}%</strong> <span className="text-gray-600">(n={c.n})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
