import { useState, useMemo, useEffect } from 'react'
import {
  cornersLiveModel, cornersPrior, cornersConfidence, cornersEdge, cornersFactores,
  logCornersSnapshot, cornersBacktestSummary,
} from '../lib/corners'
import { ensureBaseline } from '../lib/baseline'
import { reportarOportunidad, logDecision } from '../lib/market-engine'

// ─── Panel cuantitativo de CÓRNERS en vivo ───────────────────────────────────
// Modela POR EQUIPO (local/visitante) y suma el total → habilita mercados de
// córners totales, por equipo y la lectura de "próximo córner".

const FUENTE_LABEL = {
  api: '🟢 Live-Score (dato directo por equipo)',
  manual: '✍️ manual',
}

export default function CornersQuant({ minuto, goalDiff, cH, cA, cTotal, daTotal, blkTotal, fuente, snaps, preA, preB, league, matchInfo, homeName, awayName, reds = null }) {
  const [market, setMarket] = useState('total')
  const [line, setLine] = useState('')
  const [oddsOver, setOddsOver] = useState('')
  const [oddsUnder, setOddsUnder] = useState('')
  const [showConf, setShowConf] = useState(false)
  const [showBt, setShowBt] = useState(false)

  const prior = useMemo(() => cornersPrior(preA, preB, league), [preA, preB, league])

  // PREMATCH BASELINE congelado (solo info prepartido — sin leakage)
  const baseline = useMemo(() => (matchInfo?.id && prior)
    ? ensureBaseline(matchInfo.id, 'corners', { expected: prior.total, sd: prior.sd })
    : null, [matchInfo?.id, prior]) // eslint-disable-line react-hooks/exhaustive-deps

  const model = useMemo(() => cornersLiveModel({
    minuto, acumH: cH, acumA: cA, acumTotal: cTotal, goalDiff, snaps, prior, daTotal, blkTotal, reds,
  }), [minuto, cH, cA, cTotal, goalDiff, snaps, prior, daTotal, blkTotal, reds])

  const conf = useMemo(() => cornersConfidence({
    model, prior, fuente, snapsN: snaps?.length ?? 0,
  }), [model, prior, fuente, snaps])

  const edge = useMemo(() => {
    const l = parseFloat(line); const oO = parseFloat(oddsOver); const oU = parseFloat(oddsUnder)
    if (!model || isNaN(l) || isNaN(oO)) return null
    return cornersEdge({ model, market, line: l, oddsOver: oO, oddsUnder: isNaN(oU) ? null : oU, confidence: conf.score })
  }, [model, market, line, oddsOver, oddsUnder, conf.score])

  const factores = useMemo(() => cornersFactores({
    model, prior, goalDiff,
    homeName: homeName?.trim() || 'Local', awayName: awayName?.trim() || 'Visitante',
  }), [model, prior, goalDiff, homeName, awayName])

  // Escalera del mercado elegido
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
    if (model && matchInfo?.id) logCornersSnapshot(matchInfo.id, { ...matchInfo, baseline: baseline?.expected, hayRoja: model.hayRoja || undefined, goalDiff: model.hayRoja ? goalDiff : undefined }, model)
  }, [model?.minuto, baseline?.expected]) // eslint-disable-line react-hooks/exhaustive-deps

  const bt = useMemo(() => showBt ? cornersBacktestSummary() : null, [showBt, model?.minuto]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!matchInfo?.id) return
    const edgeLado = edge ? (edge.lado === 'UNDER' ? edge.edgeUnder : edge.edgeOver) : null
    const mLbl = market === 'total' ? '' : market === 'local' ? `${homeName?.split(' ')[0] ?? 'Local'} ` : `${awayName?.split(' ')[0] ?? 'Visita'} `
    reportarOportunidad(matchInfo.id, `corners_${market}`, edge ? {
      marketBase: 'corners', label: `Córners ${mLbl}${edge.lado ? edge.lado + ' ' : 'O/U '}${edge.line}`,
      signal: edge.signal, quality: edge.quality, edgeLado, evPct: edge.evPct,
      conf: conf.score, line: edge.line, minuto,
    } : null)
    if (edge) logDecision({
      matchId: matchInfo.id, match: `${matchInfo.home} vs ${matchInfo.away}`,
      market: `corners_${market}`, line: edge.line, odds: edge.oddsOver,
      baseline: baseline?.expected, live: model?.expectedFinal,
      pModelo: edge.pOver, pImplicita: edge.impOver, edge: edge.edgeOver,
      ev: edge.evPct, confidence: conf.score, signal: edge.signal, quality: edge.quality, minuto,
    })
  }, [edge, conf.score, market]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!model) return null

  return (
    <div className="rounded-2xl border-2 border-amber-600/60 bg-gradient-to-b from-amber-950/30 to-dark-800 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-black text-amber-300 tracking-wide">🚩 CÓRNERS — módulo cuantitativo</h2>
        <span className="text-[10px] text-gray-500">fuente: {FUENTE_LABEL[fuente] ?? '—'}</span>
      </div>
      <p className="text-[10px] text-yellow-600/80 -mt-1">Modelo BASELINE (heurístico, sin calibrar) · señales en modo 📝 PAPER: registrar y validar, no es ventaja demostrada</p>

      {/* ── Estado actual ── */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center">
        {[
          ['Minuto', `${model.minuto}'`],
          ['Actuales', `${model.acum} (${model.acumH}·${model.acumA})`],
          ['Ritmo', `${model.rateObs}/min`],
          ['Expected final', model.expectedFinal, 'text-amber-300 text-xl'],
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
          <span className="text-gray-300">→ Live ahora: <strong className="text-amber-300">{model.expectedFinal}</strong>
            {(() => { const d = Math.round((model.expectedFinal - baseline.expected) / baseline.expected * 100); return (
              <span className={d > 5 ? 'text-orange-300' : d < -5 ? 'text-blue-300' : 'text-gray-500'}> ({d > 0 ? '+' : ''}{d}%)</span>
            )})()}
          </span>
          {model.hayRoja && <span className="text-red-400 font-bold">🟥 roja en cancha — cambio estructural aplicado</span>}
          <span className="text-gray-600">— el porqué del cambio está en los factores de abajo</span>
        </div>
      )}

      {/* ── Por equipo + próximo córner ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
        <div className="bg-dark-800/60 rounded-lg p-2">
          <p className="text-gray-500">{homeName || 'Local'}</p>
          <p className="text-white">van <strong>{model.home.acum}</strong> → proy <strong className="text-amber-300">{model.home.expectedFinal}</strong>
            <span className="text-gray-600"> · S ×{model.home.state}</span></p>
        </div>
        <div className="bg-dark-800/60 rounded-lg p-2">
          <p className="text-gray-500">{awayName || 'Visitante'}</p>
          <p className="text-white">van <strong>{model.away.acum}</strong> → proy <strong className="text-amber-300">{model.away.expectedFinal}</strong>
            <span className="text-gray-600"> · S ×{model.away.state}</span></p>
        </div>
        {model.nextCorner && (
          <div className="bg-dark-800/60 rounded-lg p-2">
            <p className="text-gray-500">Próximo córner</p>
            <p className="text-white">{homeName?.split(' ')[0] ?? 'Local'} <strong className="text-green-300">{Math.round(model.nextCorner.pHome * 100)}%</strong>
              {' · '}{awayName?.split(' ')[0] ?? 'Visita'} <strong className="text-blue-300">{Math.round(model.nextCorner.pAway * 100)}%</strong>
              <span className="text-gray-600"> · P(ninguno en 10') {Math.round(model.nextCorner.pNone10 * 100)}%</span></p>
          </div>
        )}
      </div>

      {/* ── Diagnóstico ── */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
        {!prior && <span className="text-yellow-600">Sin prior prepartido — espera a que cargue el historial de ambos equipos</span>}
        {prior && <span className="text-gray-400">Prior: <strong className="text-white">{prior.total}</strong> <span className="text-gray-600">({homeName?.split(' ')[0] ?? 'local'} {prior.expA} · {awayName?.split(' ')[0] ?? 'visita'} {prior.expB}{prior.empTotal ? ` · mediana empírica ${prior.empTotal}` : ''})</span></span>}
        {model.daObs != null && <span className="text-gray-400">Presión sostenida: <strong className={model.daFactor > 1.03 ? 'text-orange-300' : model.daFactor < 0.97 ? 'text-blue-300' : 'text-gray-300'}>×{model.daFactor}</strong> <span className="text-gray-600">({model.daObs} at. peligrosos/min)</span></span>}
        {model.blkObs != null && <span className="text-gray-400">Tiros bloqueados: <strong className={model.blkFactor > 1.02 ? 'text-orange-300' : model.blkFactor < 0.98 ? 'text-blue-300' : 'text-gray-300'}>×{model.blkFactor}</strong></span>}
        <span className="text-gray-400">Régimen: <strong className={
          model.home.regime.detected || model.away.regime.detected
            ? ((model.home.regime.dir === 'up' || model.away.regime.dir === 'up') ? 'text-orange-300' : 'text-blue-300')
            : 'text-gray-300'
        }>{model.home.regime.detected || model.away.regime.detected
          ? ((model.home.regime.dir === 'up' || model.away.regime.dir === 'up') ? '🔥 detectado (sube)' : '❄️ detectado (baja)')
          : 'no detectado'}</strong></span>
      </div>

      {/* ── Mercado + escalera ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {[['total', 'Total'], ['local', homeName?.split(' ')[0] ?? 'Local'], ['visitante', awayName?.split(' ')[0] ?? 'Visitante']].map(([k, lbl]) => (
          <button key={k} onClick={() => setMarket(k)}
            className={`text-xs px-2.5 py-1 rounded-lg border ${market === k ? 'bg-amber-800/60 border-amber-500 text-white font-bold' : 'bg-dark-700 border-dark-600 text-gray-400 hover:text-white'}`}>
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
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Compara contra la línea de tu casa — mercado: <span className="text-amber-300">{market}</span></p>
        <div className="grid grid-cols-3 gap-2">
          {[
            ['Línea (ej. 9.5)', line, setLine, '0.5'],
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
              <p className="text-green-400 font-bold mb-1">Impulsan el Over</p>
              {factores.up.map((f, i) => <p key={i} className="text-gray-300">+ {f}</p>)}
            </div>
          )}
          {factores.down.length > 0 && (
            <div className="bg-blue-950/30 border border-blue-900/40 rounded-lg p-2">
              <p className="text-blue-400 font-bold mb-1">Frenan el Over / suben la incertidumbre</p>
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
          {!bt && <p className="text-gray-500">Aún no hay partidos resueltos en el registro. Cada partido que analices aquí guarda sus snapshots minuto a minuto; al terminar se resuelve solo con las stats finales de Live-Score y este panel mostrará el error del modelo por tramo.</p>}
          {bt && (
            <>
              <p className="text-gray-400 mb-1">{bt.matches} partido(s) resuelto(s) — error del modelo según el minuto de la predicción:</p>
              {bt.dist && <p className="text-gray-500 mb-1">Distribución: log-loss {bt.dist.logloss} (0.693 = moneda) · sharpness {bt.dist.sharpness} · cobertura 10-90: {bt.dist.coverage != null ? `${bt.dist.coverage}% (objetivo ~80%)` : '—'}</p>}
              {bt.pre && <p className="text-gray-500 mb-1">📌 Baseline PREMATCH: ±{bt.pre.mae} ({bt.pre.n}p) — el live debe mejorar este error conforme avanza el partido</p>}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5">
                {bt.rows.map(r => (
                  <div key={r.bucket} className="bg-dark-700 rounded p-1.5 text-center">
                    <p className="text-gray-500">{r.bucket}</p>
                    <p className={`font-bold ${r.mae <= 1.5 ? 'text-green-400' : r.mae <= 3 ? 'text-yellow-400' : 'text-red-400'}`}>±{r.mae}</p>
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
