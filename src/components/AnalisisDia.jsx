import { useState, useEffect, useCallback, useRef } from 'react'
import { analizarDia, partidosDelDia, COSTO_APROX_POR_PARTIDO } from '../lib/analisis-dia'
import { LEAGUES } from '../lib/leagues'
import { todayBogota } from '../lib/football-api'

// ─── ANÁLISIS AUTOMÁTICO DEL DÍA ─────────────────────────────────────────────
// Un botón: recorre los partidos del día de tus ligas, corre el motor en cada
// uno y guarda los picks solos. Agrupado por liga.

const MIS_LIGAS_KEY = 'motor_mis_ligas'
const DEFAULT_MIS_LIGAS = [39, 140, 78, 135, 61]

function loadMisLigas() {
  try {
    const v = JSON.parse(localStorage.getItem(MIS_LIGAS_KEY))
    return Array.isArray(v) && v.length ? v : DEFAULT_MIS_LIGAS
  } catch { return DEFAULT_MIS_LIGAS }
}

const manana = () => new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

export default function AnalisisDia({ onVerPartido }) {
  const [fecha, setFecha] = useState(todayBogota())
  const [alcance, setAlcance] = useState('mis')     // 'mis' | 'principales'
  const [maxPartidos, setMax] = useState(8)
  const [previo, setPrevio] = useState(null)
  const [corriendo, setCorriendo] = useState(false)
  const [progreso, setProgreso] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)
  const abortoRef = useRef({ abortado: false })

  const ligas = alcance === 'mis'
    ? loadMisLigas()
    : LEAGUES.filter(l => l.main).map(l => l.id)

  // Sondeo barato: cuántos partidos hay (sin pedir stats)
  const sondear = useCallback(async () => {
    setPrevio(null); setError(null)
    try {
      const p = await partidosDelDia(ligas, fecha)
      setPrevio(p)
    } catch (e) { setError(e.message) }
  }, [fecha, alcance]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { sondear() }, [sondear])

  const correr = async () => {
    setCorriendo(true); setResultado(null); setError(null)
    abortoRef.current = { abortado: false }
    try {
      const r = await analizarDia({
        leagueIds: ligas, fecha, maxPartidos,
        onProgress: setProgreso,
        señalAborto: abortoRef.current,
      })
      setResultado(r)
    } catch (e) {
      setError(e.message)
    } finally {
      setCorriendo(false); setProgreso(null)
    }
  }

  const aAnalizar = previo ? Math.min(previo.total, maxPartidos) : 0

  return (
    <div className="card border border-emerald-800/40 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="font-bold text-emerald-300 text-sm">⚡ ANÁLISIS AUTOMÁTICO DEL DÍA</p>
        <span className="text-[10px] text-gray-500">analiza y guarda los picks solo — no hay que entrar partido por partido</span>
      </div>

      {/* Controles */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <input type="date" className="input-dark text-xs" value={fecha} onChange={e => setFecha(e.target.value)} />
        <button onClick={() => setFecha(todayBogota())} className="px-2 py-1 rounded bg-dark-700 text-gray-300 hover:bg-dark-600">Hoy</button>
        <button onClick={() => setFecha(manana())} className="px-2 py-1 rounded bg-dark-700 text-gray-300 hover:bg-dark-600">Mañana</button>
        <div className="flex rounded-lg overflow-hidden border border-dark-500">
          <button onClick={() => setAlcance('mis')}
            className={`px-2.5 py-1 ${alcance === 'mis' ? 'bg-emerald-700 text-white' : 'bg-dark-700 text-gray-400'}`}>
            ⭐ Mis ligas ({loadMisLigas().length})
          </button>
          <button onClick={() => setAlcance('principales')}
            className={`px-2.5 py-1 ${alcance === 'principales' ? 'bg-emerald-700 text-white' : 'bg-dark-700 text-gray-400'}`}>
            🏆 Principales ({LEAGUES.filter(l => l.main).length})
          </button>
        </div>
        <label className="flex items-center gap-1 text-gray-400">
          máx partidos:
          <input type="number" min="1" max="25" value={maxPartidos}
            onChange={e => setMax(Math.max(1, Math.min(25, +e.target.value || 1)))}
            className="input-dark w-14 text-xs" />
        </label>
      </div>

      {/* Sondeo + consumo estimado */}
      {previo && !corriendo && !resultado && (
        <div className="text-[11px] text-gray-400 bg-dark-800/60 rounded-lg p-2">
          {previo.total === 0 ? (
            <p>No hay partidos programados el {fecha} en {alcance === 'mis' ? 'tus ligas' : 'las principales'}. Prueba otra fecha o cambia el alcance.</p>
          ) : (
            <>
              <p><strong className="text-white">{previo.total}</strong> partido(s) disponibles · se analizarán <strong className="text-emerald-300">{aAnalizar}</strong> (repartidos entre ligas).</p>
              <p className="text-gray-500">Consumo estimado: ~{aAnalizar * COSTO_APROX_POR_PARTIDO} llamadas del trial (límite 1500/día). Los partidos ya analizados se saltan.</p>
              <p className="text-gray-600 mt-1">Por liga: {previo.porLiga.map(l => `${l.liga.flag} ${l.liga.name} (${l.fixtures.length})`).join(' · ')}</p>
            </>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={correr} disabled={corriendo || !previo?.total}
          className="text-xs px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold disabled:opacity-40">
          {corriendo ? '⏳ Analizando...' : `▶️ Analizar ${aAnalizar || ''} partido(s) del ${fecha}`}
        </button>
        {corriendo && (
          <button onClick={() => { abortoRef.current.abortado = true }}
            className="text-xs px-3 py-2 rounded-lg bg-dark-700 text-gray-300 hover:bg-dark-600">Detener</button>
        )}
      </div>

      {/* Progreso */}
      {corriendo && progreso && (
        <div className="space-y-1">
          <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(progreso.hecho / Math.max(1, progreso.total)) * 100}%` }} />
          </div>
          <p className="text-[11px] text-gray-400">{progreso.hecho}/{progreso.total} · {progreso.texto}</p>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Resultado agrupado POR LIGA */}
      {resultado && (
        <div className="space-y-3">
          <p className="text-xs text-emerald-300 font-semibold">
            ✅ {resultado.analizados} partido(s) analizados · {resultado.totalPicks} picks guardados
            {resultado.omitidos.length > 0 && <span className="text-gray-500"> · {resultado.omitidos.length} omitido(s)</span>}
          </p>

          {resultado.porLiga.map(gr => (
            <div key={gr.liga.id} className="bg-dark-800/70 rounded-lg p-2.5 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-bold text-sm">{gr.liga.flag} {gr.liga.name}</span>
                <span className="text-[10px] text-gray-500">mercados: {gr.mercados.etiquetas.join(', ')}</span>
              </div>

              {gr.partidos.map((p, i) => (
                <div key={i} className="border-t border-dark-700/60 pt-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-white font-semibold">{p.equipos.a} vs {p.equipos.b}</span>
                    {p.muestraPobre && <span className="text-[9px] text-yellow-600">⚠️ muestra pobre</span>}
                    {onVerPartido && (
                      <button onClick={() => onVerPartido(p.equipos.a, p.equipos.b, gr.liga.id)}
                        className="text-[10px] px-2 py-0.5 rounded bg-dark-600 text-gray-300 hover:text-white ml-auto">
                        Ver análisis →
                      </button>
                    )}
                  </div>
                  {p.picks.length === 0 ? (
                    <p className="text-[10px] text-gray-600">Sin picks con margen creíble — correcto, no siempre hay valor</p>
                  ) : p.picks.map((pk, j) => (
                    <div key={j} className="mb-1">
                      <p className="text-[11px] flex items-center gap-2 flex-wrap">
                        <span className={`font-bold ${pk.dir === 'CUBRE' ? 'text-purple-300' : pk.dir === 'OVER' ? 'text-green-400' : 'text-blue-400'}`}>
                          {pk.dir === 'CUBRE' ? `HÁNDICAP ${pk.line}` : `${pk.dir} ${pk.line}`}
                        </span>
                        <span className="text-white">{pk.label}</span>
                        <span className="text-gray-500">proy {pk.expected} · P {pk.pMod}% · conf {pk.confidence}</span>
                      </p>
                      {pk.porque?.length > 0 && (
                        <p className="text-[10px] text-gray-500 pl-2 leading-snug">{pk.porque.slice(1, 3).join(' · ') || pk.porque[0]}</p>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}

          {/* ── COMBINADAS DEL DÍA: dos partidos distintos → cuota ≥ 1.50 ── */}
          {resultado.combinadas?.length > 0 && (
            <div className="bg-purple-950/30 border border-purple-800/40 rounded-lg p-2.5 space-y-2">
              <p className="text-xs font-bold text-purple-300">
                🎯 COMBINADAS DEL DÍA — dos partidos distintos (tu casa no deja el mismo partido)
              </p>
              {resultado.combinadas.map((c, i) => (
                <div key={i} className="border-t border-purple-900/40 pt-1.5 text-[11px] space-y-0.5">
                  <p className="text-white">
                    <span className="font-bold text-purple-200">{i + 1}.</span>{' '}
                    {c.a.label} {c.a.dir === 'CUBRE' ? c.a.line : `${c.a.dir} ${c.a.line}`}
                    <span className="text-gray-500"> ({c.a.partido} · ~{c.a.cuota})</span>
                  </p>
                  <p className="text-white pl-4">
                    + {c.b.label} {c.b.dir === 'CUBRE' ? c.b.line : `${c.b.dir} ${c.b.line}`}
                    <span className="text-gray-500"> ({c.b.partido} · ~{c.b.cuota})</span>
                  </p>
                  <p className="text-[10px] text-purple-300/90 pl-4">
                    cuota total ~{c.cuotaTotal} · P conjunta {c.pJoint}% (independencia real: partidos distintos) · cuota justa {c.cuotaJusta}
                    {c.estimada && <span className="text-yellow-600/90"> · cuotas ESTIMADAS — confirma en tu casa</span>}
                  </p>
                </div>
              ))}
              <p className="text-[10px] text-gray-500">
                La cuota ~X es la mínima que hace jugable la pata (margen de casa ~2.5%). Si tu casa paga MENOS que eso, la pata pierde valor: no la juegues.
              </p>
            </div>
          )}

          {resultado.omitidos.length > 0 && (
            <p className="text-[10px] text-gray-600">
              Omitidos: {resultado.omitidos.map(o => `${o.fixture.homeTeam}-${o.fixture.awayTeam} (${o.motivo})`).join(' · ')}
            </p>
          )}

          <p className="text-[10px] text-gray-500">
            Los picks quedaron guardados: aparecen en <strong>Rendimiento → 📅 Histórico</strong> y se marcan ✅/❌ solos cuando terminen los partidos.
          </p>
        </div>
      )}
    </div>
  )
}
