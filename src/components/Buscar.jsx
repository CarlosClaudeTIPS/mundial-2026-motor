import { useState, useEffect, useCallback } from 'react'
import { fetchLiveGlobal, fetchFixtureStats } from '../lib/livescore-api'
import { fetchSofaSaques, fetchSofaPartidoActual } from '../lib/sofascore'
import { poissonOver } from '../lib/engine'

// ─── Buscador global: cualquier equipo, cualquier liga de la API ─────────────
// 1. Partidos EN VIVO ahora que matcheen (feed global de Live-Score)
//    → clic y ves las stats del momento, saques de banda incluidos
// 2. Ficha del equipo vía Sofascore: últimos partidos con TI/GK/centros/xG

const norm = s => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

// La API usa nombres en INGLÉS — alias para lo que se escribe en español
const ALIAS = {
  tailandia: 'thailand', japon: 'japan', 'corea del sur': 'south korea', corea: 'korea',
  alemania: 'germany', espana: 'spain', francia: 'france', inglaterra: 'england',
  italia: 'italy', brasil: 'brazil', mejico: 'mexico', belgica: 'belgium',
  paises_bajos: 'netherlands', holanda: 'netherlands', suiza: 'switzerland',
  turquia: 'turkey', grecia: 'greece', polonia: 'poland', suecia: 'sweden',
  noruega: 'norway', dinamarca: 'denmark', escocia: 'scotland', gales: 'wales',
  irlanda: 'ireland', croacia: 'croatia', estados_unidos: 'united states', 'estados unidos': 'usa',
}

function expandQuery(q) {
  const n = norm(q)
  return [n, ALIAS[n]].filter(Boolean)
}

const LIVE_ROWS = [
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
]

// Stats en vivo de un partido encontrado — refresca cada 60s mientras esté abierto
function LiveMatchStats({ match }) {
  const [stats, setStats] = useState(null)
  const [err, setErr] = useState(null)
  const [vivo, setVivo] = useState({ elapsed: match.elapsed, status: match.status, hg: match.homeGoals, ag: match.awayGoals })

  const load = useCallback(async () => {
    try {
      const r = await fetchFixtureStats(match.id, match.homeId, match.awayId, { noCache: true })
      if (r.ok && r.stats?.length && Object.keys(r.stats[0]?.stats ?? {}).length) {
        setStats(r.stats)
        setErr(null)
      } else setErr('Este partido aún no reporta stats en la API')
    } catch (e) { setErr(e.message) }
    // refrescar minuto y marcador desde el feed global
    try {
      const lv = await fetchLiveGlobal()
      const m = lv.live?.find(x => x.id === match.id)
      if (m) setVivo({ elapsed: m.elapsed, status: m.status, hg: m.homeGoals, ag: m.awayGoals })
    } catch {}
  }, [match.id])

  useEffect(() => {
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [load])

  if (err) return <p className="text-xs text-yellow-600 px-3 pb-2">{err}</p>
  if (!stats) return <p className="text-xs text-gray-600 px-3 pb-2">Cargando stats en vivo...</p>

  const num = v => typeof v === 'string' ? parseFloat(v) : v
  const home = stats[0]?.stats ?? {}
  const away = stats[1]?.stats ?? {}

  // ── Lectura en vivo: proyección Poisson por mercado desde el ritmo real ──
  const minuto = vivo.status === 'HT' ? 45 : (vivo.elapsed ?? match.elapsed)
  const restante = minuto ? Math.max(0, 90 - minuto) : null
  const tot = key => {
    const h = num(home[key]); const a = num(away[key])
    return (h != null || a != null) ? (h ?? 0) + (a ?? 0) : null
  }
  // Intensidad por ataques peligrosos (ritmo típico ~1.1/min combinado)
  const daT = tot('Dangerous Attacks')
  const intensity = (daT && minuto >= 15) ? Math.min(1.2, Math.max(0.85, (daT / minuto) / 1.1)) : 1

  const MERCADOS_VIVO = [
    ['Shots on Goal', 'Tiros a puerta (SOT)', 1],
    ['Total Shots', 'Tiros totales', 2],
    ['Corner Kicks', 'Córners', 1],
    ['Throw Ins', 'Saques de banda', 2],
    ['Goal Kicks', 'Saques de portería', 1],
    ['Yellow Cards', 'Amarillas', 1],
  ]

  const lecturas = (minuto >= 10 && restante != null) ? MERCADOS_VIVO.map(([key, label, step]) => {
    const acum = tot(key)
    if (acum == null) return null
    const ritmo = acum / minuto
    const lambdaRest = ritmo * restante * intensity
    const proy = acum + lambdaRest
    // 3 líneas .5 alrededor de la proyección
    const c = Math.floor(proy) + 0.5
    const lineas = [c - step, c, c + step].filter(l => l > 0).map(line => {
      // P(final > línea) exacta: cuántos faltan vs Poisson del resto
      const pOver = line <= acum ? 1 : poissonOver(lambdaRest, line - acum)
      return { line, pOver: Math.round(pOver * 100) }
    })
    return { label, acum, ritmo: +ritmo.toFixed(2), proy: +proy.toFixed(1), lineas }
  }).filter(Boolean) : []

  return (
    <div className="px-3 pb-3 pt-1 border-t border-dark-600">
      <div className="grid grid-cols-3 text-[10px] text-gray-600 uppercase tracking-wide mb-1">
        <span className="truncate">{match.homeTeam}</span>
        <span className="text-center">Stat · min {minuto ?? '?'}'</span>
        <span className="text-right truncate">{match.awayTeam}</span>
      </div>
      {LIVE_ROWS.map(([key, label]) => {
        const h = num(home[key]); const a = num(away[key])
        if (h == null && a == null) return null
        return (
          <div key={key} className="grid grid-cols-3 text-xs py-0.5 border-b border-dark-700/50 last:border-0 items-center">
            <span className={`font-mono font-bold ${h > a ? 'text-green-400' : 'text-gray-300'}`}>{h ?? '—'}</span>
            <span className="text-center text-gray-500">{label}</span>
            <span className={`text-right font-mono font-bold ${a > h ? 'text-green-400' : 'text-gray-300'}`}>{a ?? '—'}</span>
          </div>
        )
      })}

      {/* ── Lectura en vivo — qué opina el motor ── */}
      {lecturas.length > 0 && (
        <div className="mt-2 pt-2 border-t border-red-900/40 space-y-1.5">
          <p className="text-[10px] text-red-400 uppercase tracking-wide font-bold">
            🎯 Lectura del motor — min {minuto}' · faltan {restante}'
            {intensity !== 1 && <span className="text-orange-400 ml-2">intensidad ×{intensity.toFixed(2)}</span>}
          </p>
          {lecturas.map(l => (
            <div key={l.label} className="text-[11px]">
              <span className="text-white font-semibold">{l.label}</span>
              <span className="text-gray-500"> — van {l.acum} ({l.ritmo}/min) → proyección final </span>
              <span className="text-blue-300 font-bold">{l.proy}</span>
              <div className="flex gap-2 flex-wrap mt-0.5 ml-2">
                {l.lineas.map(ln => {
                  const dir = ln.pOver >= 55 ? 'OVER' : ln.pOver <= 45 ? 'UNDER' : null
                  const p = dir === 'UNDER' ? 100 - ln.pOver : ln.pOver
                  return (
                    <span key={ln.line} className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      dir === 'OVER' ? 'bg-green-900/50 text-green-300' :
                      dir === 'UNDER' ? 'bg-blue-900/50 text-blue-300' : 'bg-dark-700 text-gray-500'
                    }`}>
                      {dir ? `${dir} ${ln.line} · P ${p}%` : `${ln.line} · 50/50`}
                    </span>
                  )
                })}
              </div>
            </div>
          ))}
          <p className="text-[10px] text-gray-600">💰 Apuesta solo si la cuota supera 1.025 ÷ P (ej: P 70% → cuota mínima 1.46)</p>
        </div>
      )}

      <p className="text-[10px] text-gray-600 mt-1">Se refresca cada 60s · lo que no aparece es porque la API no lo reporta en este partido</p>
    </div>
  )
}

export default function Buscar() {
  const [query, setQuery] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [liveMatches, setLiveMatches] = useState(null)
  const [openMatch, setOpenMatch] = useState(null)
  const [teamCard, setTeamCard] = useState(null)
  const [teamErr, setTeamErr] = useState(null)
  const [cargandoEquipo, setCargandoEquipo] = useState(false)
  const [partidoHoy, setPartidoHoy] = useState(null)

  // Refrescar el partido de hoy cada 60s mientras esté en juego
  useEffect(() => {
    if (!partidoHoy || partidoHoy.estado !== 'inprogress' || !partidoHoy._query) return
    const id = setInterval(async () => {
      try {
        const p = await fetchSofaPartidoActual(partidoHoy._query)
        if (p) setPartidoHoy({ ...p, _query: partidoHoy._query })
      } catch {}
    }, 60_000)
    return () => clearInterval(id)
  }, [partidoHoy])

  async function buscar() {
    if (!query.trim()) return
    setBuscando(true)
    setLiveMatches(null); setTeamCard(null); setTeamErr(null); setOpenMatch(null)

    const terms = expandQuery(query)
    const matchesName = name => terms.some(t => norm(name).includes(t))

    // 1) Partidos en vivo GLOBALES
    try {
      const res = await fetchLiveGlobal()
      if (res.ok) {
        setLiveMatches(res.live.filter(m => matchesName(m.homeTeam) || matchesName(m.awayTeam)))
      } else setLiveMatches([])
    } catch { setLiveMatches([]) }

    setBuscando(false)

    // 2) Ficha del equipo vía Sofascore (en paralelo, tarda más)
    setCargandoEquipo(true)
    setPartidoHoy(null)
    try {
      const sofaQuery = terms[terms.length - 1] // alias en inglés si existe

      // Partido de HOY (en juego, recién terminado o por empezar) — Sofascore
      // cubre torneos que Live-Score no transmite en vivo
      fetchSofaPartidoActual(sofaQuery)
        .then(p => p && setPartidoHoy({ ...p, _query: sofaQuery }))
        .catch(() => {})

      const sofa = await fetchSofaSaques(sofaQuery, 10)
      const seen = new Set()
      const rows = Object.entries(sofa.byDate)
        .filter(([, s]) => {
          const sig = `${s.rival}_${s.ti}_${s.gk}`
          if (seen.has(sig)) return false
          seen.add(sig)
          return true
        })
        .map(([date, s]) => ({ date, ...s }))
        .sort((a, b) => b.date.localeCompare(a.date))
      const avgOf = k => {
        const v = rows.map(r => r[k]).filter(x => x != null)
        return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : null
      }
      setTeamCard({
        name: sofa.teamName,
        rows,
        ti: avgOf('ti'), gk: avgOf('gk'), crosses: avgOf('crosses'), xg: avgOf('xg'),
      })
    } catch (e) {
      setTeamErr(`No encontré el equipo "${query}" en Sofascore — prueba el nombre en inglés`)
    } finally {
      setCargandoEquipo(false)
    }
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">🔎 Buscar equipo o partido</h1>
        <p className="text-gray-400 text-xs mt-1">Cualquier equipo de cualquier liga — partidos en vivo y stats recientes. Escribe el nombre en inglés si es raro (Thailand, no Tailandia... aunque los comunes los traduzco yo).</p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && buscar()}
          placeholder="ej. Vietnam, Thailand, Boca Juniors, Flamengo..."
          className="flex-1 bg-dark-700 border border-dark-500 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-green-500"
        />
        <button onClick={buscar} disabled={buscando || !query.trim()}
          className="px-5 py-2.5 rounded-xl bg-green-700 hover:bg-green-600 text-white font-bold disabled:opacity-40 transition-colors">
          {buscando ? '⏳' : 'Buscar'}
        </button>
      </div>

      {/* ── En vivo ahora ── */}
      {liveMatches != null && (
        <div className="space-y-2">
          <h2 className="text-xs text-red-400 font-semibold uppercase tracking-wide">🔴 En vivo ahora</h2>
          {liveMatches.length === 0 && (
            <p className="text-sm text-gray-600">Ningún partido en vivo matchea "{query}" en este momento.</p>
          )}
          {liveMatches.map(m => (
            <div key={m.id} className="card !p-0 overflow-hidden border border-red-800/40">
              <button onClick={() => setOpenMatch(openMatch === m.id ? null : m.id)}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-dark-700/50">
                <span className="text-xs font-bold text-red-400 animate-pulse w-8 shrink-0">
                  {m.status === 'HT' ? 'HT' : `${m.elapsed ?? '?'}'`}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">
                    {m.homeTeam} <span className="text-green-400 font-black">{m.homeGoals ?? 0} - {m.awayGoals ?? 0}</span> {m.awayTeam}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{m.competition}{m.country ? ` · ${m.country}` : ''}</p>
                </div>
                <span className="text-xs text-gray-500 shrink-0">{openMatch === m.id ? '▲' : '📊 Stats ▼'}</span>
              </button>
              {openMatch === m.id && <LiveMatchStats match={m} />}
            </div>
          ))}
        </div>
      )}

      {/* ── Partido de HOY (Sofascore — cubre torneos fuera de Live-Score) ── */}
      {partidoHoy && (
        <div className={`card space-y-2 border-2 ${partidoHoy.estado === 'inprogress' ? 'border-red-600/70' : 'border-purple-700/50'}`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="font-bold text-white text-base">
              {partidoHoy.estado === 'inprogress' && <span className="text-red-400 animate-pulse mr-2">🔴 EN JUEGO</span>}
              {partidoHoy.estado === 'finished' && <span className="text-gray-400 mr-2">FT</span>}
              {partidoHoy.estado === 'notstarted' && <span className="text-blue-400 mr-2">Próximo</span>}
              {partidoHoy.homeTeam} <span className="text-green-400 font-black">{partidoHoy.marcador}</span> {partidoHoy.awayTeam}
            </p>
            <span className="text-xs text-gray-500">{partidoHoy.torneo} · {new Date(partidoHoy.inicio).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          {partidoHoy.rows.length > 0 && (
            <>
              <div className="grid grid-cols-3 text-[10px] text-gray-600 uppercase tracking-wide">
                <span className="truncate">{partidoHoy.homeTeam}</span>
                <span className="text-center">Stat</span>
                <span className="text-right truncate">{partidoHoy.awayTeam}</span>
              </div>
              {partidoHoy.rows.map(r => (
                <div key={r.label} className="grid grid-cols-3 text-xs py-0.5 border-b border-dark-700/50 last:border-0 items-center">
                  <span className="font-mono font-bold text-gray-200">{r.h ?? '—'}</span>
                  <span className="text-center text-gray-500">{r.label}</span>
                  <span className="text-right font-mono font-bold text-gray-200">{r.a ?? '—'}</span>
                </div>
              ))}
              <p className="text-[10px] text-gray-600">Fuente: Sofascore{partidoHoy.estado === 'inprogress' ? ' · se refresca cada 60s' : ''}</p>
            </>
          )}
        </div>
      )}

      {/* ── Ficha del equipo (Sofascore) ── */}
      {cargandoEquipo && (
        <p className="text-xs text-gray-500">Buscando la ficha del equipo en Sofascore...</p>
      )}
      {teamErr && <p className="text-xs text-yellow-600">{teamErr}</p>}
      {teamCard && (
        <div className="card border border-dark-600 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="font-bold text-white text-sm">📋 {teamCard.name} — últimos partidos (Sofascore)</p>
            <div className="flex gap-3 text-xs text-gray-400">
              {teamCard.ti != null && <span>TI/P: <strong className="text-green-400">{teamCard.ti}</strong></span>}
              {teamCard.gk != null && <span>GK/P: <strong className="text-green-400">{teamCard.gk}</strong></span>}
              {teamCard.crosses != null && <span>Centros/P: <strong className="text-green-400">{teamCard.crosses}</strong></span>}
              {teamCard.xg != null && <span>xG/P: <strong className="text-green-400">{teamCard.xg}</strong></span>}
            </div>
          </div>
          <div className="grid grid-cols-6 text-[10px] text-gray-600 uppercase tracking-wide">
            <span>Fecha</span><span className="col-span-2">Rival</span>
            <span className="text-center">TI</span><span className="text-center">GK</span><span className="text-center">Centros</span>
          </div>
          {teamCard.rows.map((r, i) => (
            <div key={i} className="grid grid-cols-6 text-xs py-0.5 border-b border-dark-700/50 last:border-0">
              <span className="text-gray-500">{r.date?.slice(5)}</span>
              <span className="col-span-2 text-gray-200 truncate">{r.rival}</span>
              <span className="text-center font-mono text-white">{r.ti ?? '—'}<span className="text-gray-600">·{r.tiAg ?? '—'}</span></span>
              <span className="text-center font-mono text-white">{r.gk ?? '—'}<span className="text-gray-600">·{r.gkAg ?? '—'}</span></span>
              <span className="text-center font-mono text-white">{r.crosses ?? '—'}</span>
            </div>
          ))}
          <p className="text-[10px] text-gray-600">Formato TI/GK: propio·rival por partido</p>
        </div>
      )}
    </div>
  )
}
