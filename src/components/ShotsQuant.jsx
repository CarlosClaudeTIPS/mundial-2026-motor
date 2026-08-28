import { useState, useMemo, useEffect } from 'react'
import {
  shotsLiveModel, shotsPrior, shotsConfidence, shotsEdge, shotsFactores,
  logShotsSnapshot, logSotSnapshot, shotsBacktestSummary, sotBacktestSummary,
} from '../lib/shots'
import { ensureBaseline } from '../lib/baseline'

// ─── Panel cuantitativo de TIROS en vivo ─────────────────────────────────────
// Total por equipo repartido coherentemente en a puerta / fuera / bloqueados
// (suman el total — nunca categorías imposibles). 6 mercados con edge.

const FUENTE_LABEL = {
  api: '🟢 Live-Score (dato directo por equipo)',
  manual: '✍️ manual',
}

const MARKETS = [
  ['shots_total', 'Tiros Total'],
  ['shots_local', 'Tiros Local'],
  ['shots_visitante', 'Tiros Visita'],
  ['sot_total', 'SOT Total'],
  ['sot_local', 'SOT Local'],
  ['sot_visitante', 'SOT Visita'],
]

export default function ShotsQuant({ minuto, goalDiff, sH, sA, sotH, sotA, blkH, blkA, daTotal, fuente, snaps, preA, preB, matchInfo, homeName, awayName, homeIsA = true, reds = null }) {
  const [market, setMarket] = useState('shots_total')
  const [line, setLine] = useState('')
  const [oddsOver, setOddsOver] = useState('')
  const [oddsUnder, setOddsUnder] = useState('')
  const [showConf, setShowConf] = useState(false)
  const [showBt, setShowBt] = useState(false)

  const prior = useMemo(() => shotsPrior(preA, preB, { homeA: homeIsA }), [preA, preB, homeIsA])

  // PREMATCH BASELINES congelados: uno para tiros totales, otro para SOT
  const baseline = useMemo(() => (matchInfo?.id && prior)
    ? ensureBaseline(matchInfo.id, 'shots', { expected: prior.total, sd: prior.sd })
    : null, [matchInfo?.id, prior]) // eslint-disable-line react-hooks/exhaustive-deps
  const baselineSot = useMemo(() => (matchInfo?.id && prior)
    ? ensureBaseline(matchInfo.id, 'sot', { expected: prior.sotTotal, sd: +(prior.sd * 0.5).toFixed(1) })
    : null, [matchInfo?.id, prior]) // eslint-disable-line react-hooks/exhaustive-deps

  const model = useMemo(() => shotsLiveModel({
    minuto, sH, sA, sotH, sotA, blkH, blkA, goalDiff, snaps, prior, daTotal, reds,
  }), [minuto, sH, sA, sotH, sotA, blkH, blkA, goalDiff, snaps, prior, daTotal, reds])

  const conf = useMemo(() => shotsConfidence({
    model, prior, fuente, snapsN: snaps?.length ?? 0,
  }), [model, prior, fuente, snaps])

  const edge = useMemo(() => {
    const l = parseFloat(line); const oO = parseFloat(oddsOver); const oU = parseFloat(oddsUnder)
    if (!model || isNaN(l) || isNaN(oO)) return null
    return shotsEdge({ model, market, line: l, oddsOver: oO, oddsUnder: isNaN(oU) ? null : oU, confidence: conf.score })
  }, [model, market, line, oddsOver, oddsUnder, conf.score])

  const factores = useMemo(() => shotsFactores({
    model, prior, goalDiff,
    homeName: homeName?.trim() || 'Local', awayName: awayName?.trim() || 'Visitante',
  }), [model, prior, goalDiff, homeName, awayName])

  const ladder = useMemo(() => {
    if (!model) return []
    const cfg = {
      shots_total: { exp: model.expectedFinal, acum: model.acum, fn: model.pOver, step: 1 },
      shots_local: { exp: model.home.expectedFinal, acum: model.home.acum, fn: model.home.pOverShots, step: 1 },
      shots_visitante: { exp: model.away.expectedFinal, acum: model.away.acum, fn: model.away.pOverShots, step: 1 },
      sot_total: { exp: model.sotFinal, acum: model.sotAcum ?? 0, fn: model.pOverSot, step: 1 },
      sot_local: { exp: model.home.sotFinal, acum: model.home.sotAcum ?? 0, fn: model.home.pOverSot, step: 1 },
      sot_visitante: { exp: model.away.sotFinal, acum: model.away.sotAcum ?? 0, fn: model.away.pOverSot, step: 1 },
    }[market]
    const c = Math.floor(cfg.exp) + 0.5
    return [c - 2 * cfg.step, c - cfg.step, c, c + cfg.step, c + 2 * cfg.step]
      .filter(l => l > 0 && l > cfg.acum - 1)
      .map(l => ({ line: l, p: Math.round(cfg.fn(l) * 1000) / 10 }))
  }, [model, market])

  useEffect(() => {
    if (model && matchInfo?.id) {
      const extra = { hayRoja: model.hayRoja || undefined }
      logShotsSnapshot(matchInfo.id, { ...matchInfo, ...extra, baseline: baseline?.expected }, model)
      logSotSnapshot(matchInfo.id, { ...matchInfo, ...extra, baseline: baselineSot?.expected }, model)
    }
  }, [model?.minuto, baseline?.expected, baselineSot?.expected]) // eslint-disable-line react-hooks/exhaustive-deps

  const bt = useMemo(() => showBt ? { shots: shotsBacktestSummary(), sot: sotBacktestSummary() } : null, [showBt, model?.minuto]) // eslint-disable-line react-hooks/exhaustive-deps

  if (sH == null || sA == null) return (
    <div className="card border border-sky-800/40">
      <p className="font-bold text-sky-300 text-sm">🎯 TIROS — módulo cuantitativo</p>
      <p className="text-xs text-gray-500 mt-1">Este partido aún no reporta tiros por equipo en la API — el módulo se activa cuando lleguen las stats en vivo.</p>
    </div>
  )
  if (!model) return null

  const tn = { h: homeName?.trim() || 'Local', a: awayName?.trim() || 'Visitante' }

  return (
    <div className="rounded-2xl border-2 border-sky-700/60 bg-gradient-to-b from-sky-950/40 to-dark-800 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-black text-sky-300 tracking-wide">🎯 TIROS — módulo cuantitativo</h2>
        <span className="text-[10px] text-gray-500">fuente: {FUENTE_LABEL[fuente] ?? '—'}</span>
      </div>

      {/* ── Estado actual (total) ── */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center">
        {[
          ['Minuto', `${model.minuto}'`],
          ['Tiros', `${model.acum} (${model.home.acum}·${model.away.acum})`],
          ['Ritmo', `${model.rateObs}/min`],
          ['Expected final', model.expectedFinal, 'text-sky-300 text-xl'],
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
          <span className="text-gray-300">Tiros: <strong className="text-white">{baseline.expected}</strong> → <strong className="text-sky-300">{model.expectedFinal}</strong>
            {(() => { const d = Math.round((model.expectedFinal - baseline.expected) / baseline.expected * 100); return (
              <span className={d > 5 ? 'text-orange-300' : d < -5 ? 'text-blue-300' : 'text-gray-500'}> ({d > 0 ? '+' : ''}{d}%)</span>
            )})()}
          </span>
          {baselineSot && <span className="text-gray-300">SOT: <strong className="text-white">{baselineSot.expected}</strong> → <strong className="text-green-300">{model.sotFinal}</strong></span>}
          {model.hayRoja && <span className="text-red-400 font-bold">🟥 roja en cancha — cambio estructural aplicado</span>}
          <span className="text-gray-600">— el porqué del cambio está en los factores de abajo</span>
        </div>
      )}

      {/* ── Desglose coherente: total = a puerta + fuera + bloqueados ── */}
      <div className="bg-dark-800/60 rounded-xl p-2 overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-gray-600 uppercase text-[9px]">
              <th className="text-left py-0.5"></th>
              <th className="text-center px-2">Tiros</th>
              <th className="text-center px-2">A puerta</th>
              <th className="text-center px-2">Fuera</th>
              <th className="text-center px-2">Bloqueados</th>
            </tr>
          </thead>
          <tbody>
            {[[tn.h, model.home], [tn.a, model.away]].map(([name, s]) => (
              <tr key={name} className="border-t border-dark-700/60">
                <td className="py-1 text-white font-semibold truncate max-w-[120px]">{name} <span className="text-gray-600 font-normal">S ×{s.state}</span></td>
                <td className="text-center font-mono">{s.acum} → <strong className="text-sky-300">{s.expectedFinal}</strong></td>
                <td className="text-center font-mono">{s.sotAcum ?? '—'} → <strong className="text-green-300">{s.sotFinal}</strong></td>
                <td className="text-center font-mono text-gray-400">→ {s.offFinal}</td>
                <td className="text-center font-mono text-gray-400">{s.blkAcum ?? '—'} → {s.blkFinal}</td>
              </tr>
            ))}
            <tr className="border-t border-sky-900/50 font-bold">
              <td className="py-1 text-sky-300">TOTAL</td>
              <td className="text-center font-mono">{model.acum} → <strong className="text-sky-300">{model.expectedFinal}</strong></td>
              <td className="text-center font-mono">{model.sotAcum ?? '—'} → <strong className="text-green-300">{model.sotFinal}</strong>
                {model.sotInterval && <span className="text-gray-600 font-normal"> ({model.sotInterval[0]}–{model.sotInterval[1]})</span>}</td>
              <td className="text-center font-mono text-gray-400">→ {model.offFinal}</td>
              <td className="text-center font-mono text-gray-400">→ {model.blkFinal}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Diagnóstico ── */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
        {!prior && <span className="text-yellow-600">Sin prior prepartido — espera a que cargue el historial de ambos equipos</span>}
        {prior && <span className="text-gray-400">Prior: <strong className="text-white">{prior.total}</strong> tiros <span className="text-gray-600">({tn.h} {prior.A.shots} · {tn.a} {prior.B.shots}{prior.empTotal ? ` · mediana empírica ${prior.empTotal}` : ''})</span></span>}
        {model.daObs != null && <span className="text-gray-400">Presión: <strong className={model.daFactor > 1.03 ? 'text-orange-300' : model.daFactor < 0.97 ? 'text-blue-300' : 'text-gray-300'}>×{model.daFactor}</strong> <span className="text-gray-600">({model.daObs} at. peligrosos/min)</span></span>}
        {prior?.xgPerShotA != null && <span className="text-gray-400">Calidad: <span className="text-gray-500">xG/tiro {tn.h} {prior.xgPerShotA} · {tn.a} {prior.xgPerShotB ?? '—'}</span> <span className="text-gray-600">(no infla el volumen)</span></span>}
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
        {MARKETS.map(([k, lbl]) => (
          <button key={k} onClick={() => setMarket(k)}
            className={`text-xs px-2.5 py-1 rounded-lg border ${market === k ? 'bg-sky-800/60 border-sky-500 text-white font-bold' : 'bg-dark-700 border-dark-600 text-gray-400 hover:text-white'}`}>
            {lbl}
          </button>
        ))}
      </div>
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

      {/* ── Línea de la casa + edge ── */}
      <div className="bg-dark-800/80 rounded-xl p-3 space-y-2 border border-dark-600">
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Compara contra la línea de tu casa — mercado: <span className="text-sky-300">{MARKETS.find(m => m[0] === market)?.[1]}</span></p>
        <div className="grid grid-cols-3 gap-2">
          {[
            ['Línea (ej. 24.5)', line, setLine, '0.5'],
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
              {(() => {
                const b = market === 'shots_total' ? baseline : market === 'sot_total' ? baselineSot : null
                if (!b) return null
                const pPre = +(b.pOver(edge.line) * 100).toFixed(1)
                const ePre = +(pPre - edge.impOver).toFixed(2)
                return <span className="text-gray-500">Prematch: P(Over) {pPre}% · edge {ePre > 0 ? '+' : ''}{ePre} pp <span className="text-gray-600">(vs live {edge.edgeOver > 0 ? '+' : ''}{edge.edgeOver})</span></span>
              })()}
            </div>

            <div className={`rounded-xl px-4 py-3 text-center font-black text-xl ${
              edge.signal === 'BET'
                ? (edge.lado === 'OVER' ? 'bg-green-800/70 text-green-100 border-2 border-green-500' : 'bg-blue-800/70 text-blue-100 border-2 border-blue-500')
                : 'bg-dark-700 text-gray-400 border border-dark-500'
            }`}>
              {edge.signal === 'BET' ? `✅ BET ${edge.lado} ${edge.line} (${MARKETS.find(m => m[0] === market)?.[1]})` : '⛔ NO BET'}
              <p className="text-[11px] font-normal mt-0.5 opacity-80">
                {edge.signal === 'BET'
                  ? `edge ${edge.lado === 'OVER' ? edge.edgeOver : edge.edgeUnder} pp supera el umbral de ${edge.minEdge} pp con confianza ${conf.score}`
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

      {/* ── Confianza + backtests ── */}
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
        <div className="text-[11px] bg-dark-800/60 rounded-lg p-2 space-y-2">
          {(!bt?.shots && !bt?.sot) && <p className="text-gray-500">Aún no hay partidos resueltos. Cada partido guarda snapshots minuto a minuto (tiros Y a puerta por separado) y se resuelve solo con las stats finales de Live-Score.</p>}
          {bt?.shots && (
            <div>
              <p className="text-gray-400 mb-1">Tiros totales — {bt.shots.matches} partido(s), error por minuto:</p>
              {bt.shots.pre && <p className="text-gray-500 mb-1">📌 Baseline PREMATCH: ±{bt.shots.pre.mae} ({bt.shots.pre.n}p)</p>}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5">
                {bt.shots.rows.map(r => (
                  <div key={r.bucket} className="bg-dark-700 rounded p-1.5 text-center">
                    <p className="text-gray-500">{r.bucket}</p>
                    <p className={`font-bold ${r.mae <= 3 ? 'text-green-400' : r.mae <= 6 ? 'text-yellow-400' : 'text-red-400'}`}>±{r.mae}</p>
                    <p className="text-gray-600">acierto {r.hit}% · n={r.n}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {bt?.sot && (
            <div>
              <p className="text-gray-400 mb-1">Tiros a puerta — {bt.sot.matches} partido(s):</p>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5">
                {bt.sot.rows.map(r => (
                  <div key={r.bucket} className="bg-dark-700 rounded p-1.5 text-center">
                    <p className="text-gray-500">{r.bucket}</p>
                    <p className={`font-bold ${r.mae <= 1.5 ? 'text-green-400' : r.mae <= 3 ? 'text-yellow-400' : 'text-red-400'}`}>±{r.mae}</p>
                    <p className="text-gray-600">acierto {r.hit}% · n={r.n}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
