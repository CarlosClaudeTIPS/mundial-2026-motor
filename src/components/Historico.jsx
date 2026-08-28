import { useState, useMemo } from 'react'
import { fechasConDatos, picksDelDia, resumenDia, leccionesDia, descomponerError, turningPoint, MERCADOS_HIST } from '../lib/rendimiento'

// ─── HISTÓRICO — navegación por fecha, match review y lecciones ──────────────
// Análisis y aprendizaje. NO modifica ningún parámetro del modelo.
// Flujo: fecha → resumen → partido → pick → timeline → ¿por qué? → ¿qué aprendemos?

const hoyStr = () => new Date().toLocaleDateString('sv-SE')

function Badge({ ok, children }) {
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${ok == null ? 'bg-dark-600 text-gray-400' : ok ? 'bg-green-800 text-green-200' : 'bg-red-900 text-red-300'}`}>{children}</span>
}

// ── Detalle de un partido (MATCH REVIEW) ─────────────────────────────────────
function MatchReview({ matchId, picks, combos }) {
  const [pickOpen, setPickOpen] = useState(null)
  const info = picks[0]
  const porBase = {}
  for (const p of picks) if (p.matchLog && !porBase[p.base]) porBase[p.base] = p.matchLog

  return (
    <div className="bg-dark-900/60 rounded-lg p-3 space-y-3 border-t border-indigo-900/40">
      {/* Expectativa vs realidad por mercado */}
      <div className="flex flex-wrap gap-2 text-[11px]">
        {Object.entries(porBase).map(([base, ml]) => {
          const m = MERCADOS_HIST.find(x => x.base === base)
          const ultimo = ml.snaps?.[0]
          return (
            <span key={base} className="bg-dark-700 rounded px-2 py-1">
              {m?.label}: baseline <strong className="text-white">{ml.baseline ?? '—'}</strong>
              {ultimo && <> · 1er snap ({ultimo.min}') proy <strong className="text-white">{ultimo.proj}</strong></>}
              {' '}→ real <strong className={ml.final != null ? 'text-indigo-300' : 'text-gray-500'}>{ml.final ?? 'pendiente'}</strong>
              {ml.final != null && ml.baseline != null && <span className="text-gray-500"> (dif {(ml.final - ml.baseline) > 0 ? '+' : ''}{(ml.final - ml.baseline).toFixed(1)})</span>}
              {ml.hayRoja && <span className="text-red-400"> 🟥{ml.rojaMin ? ` ${ml.rojaMin}'` : ''}</span>}
            </span>
          )
        })}
      </div>

      {/* Picks del partido */}
      {picks.map((p, i) => (
        <div key={i} className="bg-dark-800/70 rounded-lg p-2.5 space-y-1.5">
          <button onClick={() => setPickOpen(pickOpen === i ? null : i)} className="w-full flex items-center gap-2 flex-wrap text-left">
            <Badge ok={p.evalR ? p.evalR.hit : null}>{p.evalR ? (p.evalR.hit ? '✅' : '❌') : '⏳'}</Badge>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${p.signal === 'PAPER BET' ? 'bg-emerald-900 text-emerald-300' : 'bg-dark-600 text-gray-400'}`}>{p.signal}</span>
            <span className="text-white text-xs font-semibold">{p.market} {p.lado ?? 'O/U'} {p.line}</span>
            <span className="text-[11px] text-gray-400">cuota {p.odds ?? '—'} · P {p.pModelo}% · edge {p.edge > 0 ? '+' : ''}{p.edge}pp · min {p.minuto}'</span>
            {p.evalR && <span className="text-[11px] text-gray-300 ml-auto">real: <strong>{p.evalR.final}</strong>{p.evalR.pnl != null && <span className={p.evalR.pnl > 0 ? ' text-green-400' : ' text-red-400'}> · P&L {p.evalR.pnl > 0 ? '+' : ''}{p.evalR.pnl.toFixed(2)}u</span>}</span>}
            <span className="text-gray-600 text-xs">{pickOpen === i ? '▴' : '▸'}</span>
          </button>

          {pickOpen === i && (
            <div className="space-y-2 pt-1 border-t border-dark-700 text-[11px]">
              {/* Foto congelada del pick */}
              <p className="text-gray-500">📸 Foto al registrar: baseline {p.baseline ?? '—'} → live {p.live ?? '—'} · implícita {p.pImplicita}% · EV {p.ev ?? '—'}% · conf {p.confidence} · calidad {p.quality ?? '—'}{p.razon ? ` · razón: ${p.razon}` : ''}</p>

              {/* Clasificación forecast × outcome */}
              {p.clasif && (
                <p className={`px-2 py-1 rounded ${p.clasif.goodForecast ? 'bg-green-950/40 text-green-300' : 'bg-red-950/40 text-red-300'}`}>
                  <strong>{p.clasif.etiqueta}</strong> (vs intervalo del snap {p.clasif.snapMin}') — {p.clasif.nota}
                </p>
              )}

              {/* Timeline */}
              {p.matchLog?.snaps?.length > 0 && (
                <div>
                  <p className="text-gray-500 mb-1">Timeline del modelo ({p.matchLog.snaps.length} snapshots):</p>
                  <div className="overflow-x-auto">
                    <table className="text-[10px] w-full">
                      <thead><tr className="text-gray-600"><th className="text-left pr-2">Min</th><th className="pr-2">Acum</th><th className="pr-2">Proyección</th><th className="pr-2">Intervalo</th><th>P(línea central)</th></tr></thead>
                      <tbody>
                        {p.matchLog.snaps.map((s, j) => (
                          <tr key={j} className="text-center font-mono border-t border-dark-700/40">
                            <td className="text-left text-gray-400">{s.min}'</td>
                            <td>{s.acum}</td>
                            <td className="text-indigo-300">{s.proj}</td>
                            <td className="text-gray-500">{s.i10 != null ? `${s.i10}–${s.i90}` : '—'}</td>
                            <td className="text-gray-500">{Math.round((s.pCentral ?? 0) * 100)}% O{s.lineCentral}</td>
                          </tr>
                        ))}
                        {p.matchLog.final != null && (
                          <tr className="text-center font-bold border-t border-indigo-800/50"><td className="text-left text-gray-400">FIN</td><td className="text-indigo-300">{p.matchLog.final}</td><td colSpan={3} /></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Turning point + descomposición */}
              {(() => {
                if (!p.matchLog || p.matchLog.final == null) return null
                const tp = turningPoint(p.matchLog)
                const desc = descomponerError(p.matchLog)
                return (
                  <>
                    <p className="text-gray-400">🔀 Turning point: {tp ? <span className="text-orange-300">{tp.detalle}</span> : 'No identificado — el final siempre estuvo dentro del intervalo proyectado'}</p>
                    <p className="text-gray-400">🧩 Descomposición: <span className="text-white">{desc.texto}</span></p>
                    {desc.extras?.map((e, k) => <p key={k} className="text-yellow-600/90 ml-3">{e}</p>)}
                    <p className="text-gray-600">Observación ≠ interpretación: lo anterior describe QUÉ pasó; el porqué causal requiere muestra, no un partido.</p>
                  </>
                )
              })()}
            </div>
          )}
        </div>
      ))}

      {/* Combinadas del partido */}
      {combos.map((c, i) => (
        <div key={'c' + i} className="bg-purple-950/30 border border-purple-900/40 rounded-lg p-2.5 text-[11px] space-y-0.5">
          <p className="text-purple-300 font-bold">🎯 Combinada ({c.decision}): {c.labelA} + {c.labelB}</p>
          <p className="text-gray-400">P(A) {c.pA}% · P(B) {c.pB}% · producto {c.pIndep}% · conjunta-tempo {c.pJointTempo}% · risk gate {c.pGate}% · EV {c.ev}% a {c.targetOdds} · escenarios {c.escenariosPos}</p>
          <p className="text-gray-600">La resolución de cada pata está arriba en sus picks individuales — así se sabe cuál de las dos falló.</p>
        </div>
      ))}
      {info?.match && <p className="text-[10px] text-gray-600">Partido: {info.match} · id {matchId}</p>}
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function Historico() {
  const [fecha, setFecha] = useState(hoyStr())
  const [matchOpen, setMatchOpen] = useState(null)
  const [fMercado, setFMercado] = useState('todos')
  const [fSenal, setFSenal] = useState('todas')
  const [fResultado, setFResultado] = useState('todos')

  const fechas = useMemo(() => fechasConDatos(), [])
  const r = useMemo(() => resumenDia(fecha), [fecha])
  const { picks, combos } = useMemo(() => picksDelDia(fecha), [fecha])
  const lecciones = useMemo(() => leccionesDia(fecha), [fecha])

  const idx = fechas.indexOf(fecha)
  const mover = (d) => {
    if (!fechas.length) return
    if (idx === -1) { setFecha(fechas[fechas.length - 1]); return }
    const ni = Math.min(fechas.length - 1, Math.max(0, idx + d))
    setFecha(fechas[ni]); setMatchOpen(null)
  }

  const filtrados = picks.filter(p =>
    (fMercado === 'todos' || p.base === fMercado) &&
    (fSenal === 'todas' || p.signal === fSenal) &&
    (fResultado === 'todos' || (p.evalR && (fResultado === 'acierto' ? p.evalR.hit : !p.evalR.hit)))
  )
  const porPartido = {}
  for (const p of filtrados) (porPartido[String(p.matchId)] = porPartido[String(p.matchId)] ?? []).push(p)

  return (
    <div className="card border border-indigo-800/40 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="font-bold text-indigo-300 text-sm">📅 HISTÓRICO — qué recomendó el sistema y qué pasó</p>
        <div className="flex items-center gap-2">
          <button onClick={() => mover(-1)} className="text-xs px-2 py-1 rounded bg-dark-700 text-gray-300 hover:bg-dark-600">◀</button>
          <input type="date" className="input-dark text-xs" value={fecha} onChange={e => { setFecha(e.target.value); setMatchOpen(null) }} />
          <button onClick={() => mover(1)} className="text-xs px-2 py-1 rounded bg-dark-700 text-gray-300 hover:bg-dark-600">▶</button>
        </div>
      </div>
      {fechas.length > 0 && <p className="text-[10px] text-gray-600">Fechas con registros: {fechas.join(' · ')}</p>}

      {r.evaluaciones === 0 ? (
        <p className="text-xs text-gray-500 py-4 text-center">Sin evaluaciones registradas el {fecha}. Se registran solas cuando analizas partidos e ingresas línea+cuota en los módulos (BET y NO BET por igual).</p>
      ) : (
        <>
          {/* Resumen del día */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center text-xs">
            {[
              ['Partidos', r.partidos], ['Evaluaciones', r.evaluaciones],
              ['📝 PAPER', r.paper], ['NO BET', r.nobet],
              ['Hit rate', r.hitRate != null ? `${r.aciertos}/${r.resueltos} (${r.hitRate}%)` : '—'],
              ['P&L 📝', r.resueltos ? `${r.pnl > 0 ? '+' : ''}${r.pnl}u` : '—', r.pnl > 0 ? 'text-green-400' : r.pnl < 0 ? 'text-red-400' : null],
            ].map(([l, v, cls]) => (
              <div key={l} className="bg-dark-700 rounded-lg p-2"><p className="text-[9px] text-gray-500">{l}</p><p className={`font-black ${cls ?? 'text-white'}`}>{v}</p></div>
            ))}
          </div>
          {r.insuficiente && <p className="text-[10px] text-yellow-600">⚠️ INSUFFICIENT SAMPLE (n={r.resueltos}): el hit rate y P&L de hoy NO son evidencia de nada.</p>}

          {/* Por mercado */}
          {r.porMercado.length > 0 && (
            <div className="flex flex-wrap gap-1.5 text-[10px]">
              {r.porMercado.map(m => (
                <span key={m.base} className="bg-dark-700 rounded px-2 py-1">
                  {m.label}: {m.n} eval · {m.paper} 📝{m.resueltos ? ` · ${m.aciertos}/${m.resueltos}${m.pnl != null ? ` (${m.pnl > 0 ? '+' : ''}${m.pnl}u)` : ''}` : ''}{m.insuficiente ? ' · INSUF.' : ''}
                </span>
              ))}
            </div>
          )}

          {/* Filtros */}
          <div className="flex flex-wrap gap-2 text-[10px]">
            <select className="input-dark text-[10px]" value={fMercado} onChange={e => setFMercado(e.target.value)}>
              <option value="todos">Todos los mercados</option>
              {MERCADOS_HIST.map(m => <option key={m.base} value={m.base}>{m.label}</option>)}
            </select>
            <select className="input-dark text-[10px]" value={fSenal} onChange={e => setFSenal(e.target.value)}>
              <option value="todas">PAPER y NO BET</option>
              <option value="PAPER BET">Solo PAPER BET</option>
              <option value="NO BET">Solo NO BET</option>
            </select>
            <select className="input-dark text-[10px]" value={fResultado} onChange={e => setFResultado(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="acierto">Acertados</option>
              <option value="fallo">Fallados</option>
            </select>
          </div>

          {/* Partidos del día */}
          {Object.entries(porPartido).map(([mid, ps]) => {
            const res = ps.filter(p => p.evalR)
            const ok = res.filter(p => p.evalR.hit).length
            const estado = !res.length ? 'PENDIENTE' : ok === res.length ? 'PERFECTO' : ok === 0 ? 'FALLADO' : 'MIXTO'
            const combosDelMatch = combos.filter(c => ps[0]?.match && `${c.home} vs ${c.away}` === ps[0].match)
            return (
              <div key={mid}>
                <button onClick={() => setMatchOpen(matchOpen === mid ? null : mid)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-dark-600 bg-dark-800 hover:border-indigo-800 text-left">
                  <span className="text-white text-sm font-semibold flex-1 truncate">{ps[0].match ?? `Partido ${mid}`}</span>
                  <span className="text-[11px] text-gray-400">{ps.length} eval{res.length ? ` · ${ok}✅ ${res.length - ok}❌` : ''}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    estado === 'PERFECTO' ? 'bg-green-800 text-green-200' : estado === 'FALLADO' ? 'bg-red-900 text-red-300' :
                    estado === 'MIXTO' ? 'bg-yellow-900 text-yellow-300' : 'bg-dark-600 text-gray-400'}`}>{estado}</span>
                  <span className="text-gray-600 text-xs">{matchOpen === mid ? '▴' : '▸'}</span>
                </button>
                {matchOpen === mid && <MatchReview matchId={mid} picks={ps} combos={combosDelMatch} />}
              </div>
            )
          })}

          {/* Lecciones del día */}
          <div className="bg-dark-800/60 rounded-lg p-3 space-y-1.5 text-[11px]">
            <p className="text-indigo-300 font-bold text-xs">📚 LECCIONES DEL {fecha}</p>
            {lecciones.funciono.length > 0 && <p className="text-green-400">✅ Funcionó: {lecciones.funciono.join(' · ')}</p>}
            {lecciones.fallo.length > 0 && <p className="text-red-400">❌ Falló: {lecciones.fallo.join(' · ')}</p>}
            {lecciones.investigar.length > 0 && lecciones.investigar.map((h, i) => <p key={i} className="text-yellow-500">🔍 Investigar: {h}</p>)}
            {lecciones.noConcluir.map((n, i) => <p key={i} className="text-gray-500">🚫 No concluir todavía: {n}</p>)}
          </div>
        </>
      )}
    </div>
  )
}
