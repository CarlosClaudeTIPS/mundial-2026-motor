import { useState, useMemo, useEffect } from 'react'
import {
  tiLiveModel, tiPrior, tiConfidence, tiEdge, tiFactores,
  logTiSnapshot, tiBacktestSummary, TI_MODEL,
} from '../lib/throwins'
import { ensureBaseline } from '../lib/baseline'

// ─── Panel cuantitativo de SAQUES DE BANDA en vivo ───────────────────────────
// Datos → Modelo → Probabilidad → Incertidumbre → Línea → Edge → Decisión.
// La señal NO BET es válida y frecuente: sin edge suficiente no hay apuesta.

const FUENTE_LABEL = {
  api: '🟢 Live-Score (dato directo)',
  sofa: '🔵 Sofascore (fuente alterna)',
  manual: '✍️ manual',
}

function nivel(ratio) {
  if (ratio == null) return null
  if (ratio >= 1.15) return ['Muy alto', 'text-red-400']
  if (ratio >= 1.05) return ['Alto', 'text-orange-400']
  if (ratio > 0.95) return ['Normal', 'text-gray-300']
  if (ratio > 0.85) return ['Bajo', 'text-blue-300']
  return ['Muy bajo', 'text-blue-400']
}

export default function TiQuant({ minuto, goalDiff, tiAc, tiH, tiA, fuente, snaps, preA, preB, league, matchInfo, homeName, awayName }) {
  const [line, setLine] = useState('')
  const [oddsOver, setOddsOver] = useState('')
  const [oddsUnder, setOddsUnder] = useState('')
  const [showConf, setShowConf] = useState(false)
  const [showBt, setShowBt] = useState(false)

  const prior = useMemo(() => tiPrior(preA, preB, league), [preA, preB, league])

  // PREMATCH BASELINE: el prior se congela la primera vez (solo usa historial
  // de partidos terminados → es info 100% prepartido, sin leakage)
  const baseline = useMemo(() => (matchInfo?.id && prior)
    ? ensureBaseline(matchInfo.id, 'ti', { expected: prior.total, sd: prior.sd })
    : null, [matchInfo?.id, prior]) // eslint-disable-line react-hooks/exhaustive-deps

  const model = useMemo(() => tiLiveModel({
    minuto, acum: tiAc, goalDiff, snaps, prior,
  }), [minuto, tiAc, goalDiff, snaps, prior])

  const conf = useMemo(() => tiConfidence({
    model, prior, fuente, snapsN: snaps?.length ?? 0,
  }), [model, prior, fuente, snaps])

  const edge = useMemo(() => {
    const l = parseFloat(line); const oO = parseFloat(oddsOver); const oU = parseFloat(oddsUnder)
    if (!model || isNaN(l) || isNaN(oO)) return null
    return tiEdge({ model, line: l, oddsOver: oO, oddsUnder: isNaN(oU) ? null : oU, confidence: conf.score })
  }, [model, line, oddsOver, oddsUnder, conf.score])

  const factores = useMemo(() => tiFactores({ model, prior, goalDiff }), [model, prior, goalDiff])

  // Escalera de líneas alrededor de la proyección
  const ladder = useMemo(() => {
    if (!model) return []
    const c = Math.floor(model.expectedFinal) + 0.5
    return [c - 2, c - 1, c, c + 1, c + 2]
      .filter(l => l > (model.acum ?? 0) - 1)
      .map(l => ({ line: l, p: Math.round(model.pOver(l) * 1000) / 10 }))
  }, [model])

  // Log para el live-backtest (cada avance de minuto) — incluye el baseline
  // prematch para poder comparar error prematch vs error live al resolver
  useEffect(() => {
    if (model && matchInfo?.id) logTiSnapshot(matchInfo.id, { ...matchInfo, baseline: baseline?.expected }, model)
  }, [model?.minuto, baseline?.expected]) // eslint-disable-line react-hooks/exhaustive-deps

  const bt = useMemo(() => showBt ? tiBacktestSummary() : null, [showBt, model?.minuto]) // eslint-disable-line react-hooks/exhaustive-deps

  if (tiAc == null) return (
    <div className="card border border-purple-800/40">
      <p className="font-bold text-purple-300 text-sm">🧮 SAQUES DE BANDA — módulo cuantitativo</p>
      <p className="text-xs text-gray-500 mt-1">Este partido aún no reporta saques de banda en vivo (ni Live-Score ni Sofascore). Puedes ingresarlos a mano arriba en "Stats Acumuladas" y el módulo se activa.</p>
    </div>
  )
  if (!model) return null

  const ritmoVsPrior = model.ratePrior ? model.rateObs / model.ratePrior : null
  const nivelRitmo = nivel(ritmoVsPrior)

  return (
    <div className="rounded-2xl border-2 border-purple-700/60 bg-gradient-to-b from-purple-950/40 to-dark-800 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-black text-purple-300 tracking-wide">🧮 SAQUES DE BANDA — módulo cuantitativo</h2>
        <span className="text-[10px] text-gray-500">fuente: {FUENTE_LABEL[fuente] ?? '—'}</span>
      </div>

      {/* ── Estado actual ── */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center">
        {[
          ['Minuto', `${model.minuto}'`],
          ['Actuales', `${model.acum}${tiH != null ? ` (${tiH}·${tiA})` : ''}`],
          ['Ritmo', `${model.rateObs}/min`],
          ['Expected final', model.expectedFinal, 'text-purple-300 text-xl'],
          ['Intervalo 80%', `${model.interval[0]}–${model.interval[1]}`],
          ['Confianza', `${conf.score}/100`, conf.score >= 70 ? 'text-green-400' : conf.score >= 55 ? 'text-yellow-400' : 'text-orange-400'],
        ].map(([label, val, cls]) => (
          <div key={label} className="bg-dark-800/80 rounded-lg p-2">
            <p className="text-[10px] text-gray-500">{label}</p>
            <p className={`font-black ${cls ?? 'text-white'}`}>{val}</p>
          </div>
        ))}
      </div>

      {/* ── PREMATCH baseline → LIVE (separación arquitectónica) ── */}
      {baseline && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] bg-dark-800/50 rounded-lg px-2 py-1.5 border border-dark-600">
          <span className="text-gray-500 uppercase tracking-wide text-[9px] font-bold">Prematch → Live</span>
          <span className="text-gray-300">Baseline prepartido: <strong className="text-white">{baseline.expected}</strong></span>
          <span className="text-gray-300">→ Live ahora: <strong className="text-purple-300">{model.expectedFinal}</strong>
            {(() => { const d = Math.round((model.expectedFinal - baseline.expected) / baseline.expected * 100); return (
              <span className={d > 5 ? 'text-orange-300' : d < -5 ? 'text-blue-300' : 'text-gray-500'}> ({d > 0 ? '+' : ''}{d}%)</span>
            )})()}
          </span>
          <span className="text-gray-600">— el porqué del cambio está en los factores de abajo</span>
        </div>
      )}

      {/* ── Diagnóstico ── */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
        {nivelRitmo && (
          <span className="text-gray-400">Ritmo vs esperado: <strong className={nivelRitmo[1]}>{nivelRitmo[0]}</strong> <span className="text-gray-600">(obs {model.rateObs} · prior {model.ratePrior}/min · peso obs {Math.round(model.wObs * 100)}%)</span></span>
        )}
        {!prior && <span className="text-yellow-600">Sin prior prepartido — espera a que cargue el historial de ambos equipos</span>}
        {prior && <span className="text-gray-400">Prior: <strong className="text-white">{prior.total}</strong> <span className="text-gray-600">(interacción {prior.interTotal}{prior.empTotal ? ` · mediana empírica ${prior.empTotal} de ${prior.totalsN} partidos` : ''})</span></span>}
        <span className="text-gray-400">Estado del partido: <strong className={model.state > 1.01 ? 'text-orange-300' : model.state < 0.99 ? 'text-blue-300' : 'text-gray-300'}>×{model.state}</strong></span>
        <span className="text-gray-400">Cambio de régimen: <strong className={model.regime.detected ? (model.regime.dir === 'up' ? 'text-orange-300' : 'text-blue-300') : 'text-gray-300'}>
          {model.regime.detected ? (model.regime.dir === 'up' ? '🔥 detectado (sube)' : '❄️ detectado (baja)') : 'no detectado'}</strong></span>
      </div>

      {/* ── Escalera de probabilidades ── */}
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
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Compara contra la línea de tu casa</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            ['Línea (ej. 44.5)', line, setLine, '0.5'],
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
              {baseline && (() => {
                const pPre = +(baseline.pOver(edge.line) * 100).toFixed(1)
                const ePre = +(pPre - edge.impOver).toFixed(2)
                return <span className="text-gray-500">Prematch: P(Over) {pPre}% · edge {ePre > 0 ? '+' : ''}{ePre} pp <span className="text-gray-600">(vs live {edge.edgeOver > 0 ? '+' : ''}{edge.edgeOver})</span></span>
              })()}
            </div>

            <div className={`rounded-xl px-4 py-3 text-center font-black text-xl ${
              edge.signal === 'BET'
                ? (edge.lado === 'OVER' ? 'bg-green-800/70 text-green-100 border-2 border-green-500' : 'bg-blue-800/70 text-blue-100 border-2 border-blue-500')
                : 'bg-dark-700 text-gray-400 border border-dark-500'
            }`}>
              {edge.signal === 'BET' ? `✅ BET ${edge.lado} ${edge.line}` : '⛔ NO BET'}
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

      {/* ── Factores (explicabilidad) ── */}
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

      {/* ── Desglose de confianza + backtest ── */}
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
          {!bt && <p className="text-gray-500">Aún no hay partidos resueltos en el registro. Cada partido que analices aquí guarda sus snapshots minuto a minuto; al terminar se resuelve solo y este panel mostrará el error del modelo por tramo (para saber DESDE QUÉ MINUTO es confiable).</p>}
          {bt && (
            <>
              <p className="text-gray-400 mb-1">{bt.matches} partido(s) resuelto(s) — error del modelo según el minuto de la predicción:</p>
              {bt.pre && <p className="text-gray-500 mb-1">📌 Baseline PREMATCH: ±{bt.pre.mae} ({bt.pre.n}p) — el live debe mejorar este error conforme avanza el partido</p>}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5">
                {bt.rows.map(r => (
                  <div key={r.bucket} className="bg-dark-700 rounded p-1.5 text-center">
                    <p className="text-gray-500">{r.bucket}</p>
                    <p className={`font-bold ${r.mae <= 3 ? 'text-green-400' : r.mae <= 6 ? 'text-yellow-400' : 'text-red-400'}`}>±{r.mae}</p>
                    <p className="text-gray-600">acierto {r.hit}% · n={r.n}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
