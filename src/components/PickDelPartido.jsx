import { useState, useEffect, useCallback } from 'react'
import { getPrediccion, savePrediccion } from '../lib/predicciones'
import { getLeague } from '../lib/leagues'
import { buildTeamStats } from '../lib/league-stats'
import { computePrematchCalc } from '../lib/prematch'
import { generateCandidates, pickUnoPorMercado, explicacionCorta } from '../lib/picks'
import { mercadosDeLiga, MERCADO_LABEL } from '../lib/mercados-liga'
import { getBaseline } from '../lib/leagues'
import { anotarCuotas } from '../lib/odds'

// ─── PICKS DEL PARTIDO, UNO POR MERCADO ──────────────────────────────────────
// Regla del usuario: un pick de tiros, uno de córners, uno de tiros al arco,
// uno de saques de banda y uno de portería. NUNCA dos del mismo mercado (nada
// de "X más de 8.5 tiros" y "X menos de 13.5" a la vez). Donde la casa no
// ofrece saques, esos huecos los llenan goles totales y hándicap de goles.

const ICONO = {
  shots: '🎯', sot: '🥅', corners: '🚩', ti: '🧮', gk: '🧤',
  goals: '⚽', handicap: '⚖️', cards: '🟨',
}

function catDe(marketKey = '') {
  if (marketKey.startsWith('handicap')) return 'handicap'
  if (marketKey.startsWith('goles')) return 'goals'
  if (marketKey.startsWith('shots') || marketKey.startsWith('tiros')) return 'shots'
  if (marketKey.startsWith('sot')) return 'sot'
  if (marketKey.startsWith('corners')) return 'corners'
  if (marketKey.startsWith('ti_')) return 'ti'
  if (marketKey.startsWith('gk_')) return 'gk'
  if (marketKey.startsWith('tarjetas')) return 'cards'
  return 'otro'
}

// De unos picks guardados, deja UNO por mercado (por si venían de antes)
export function unoPorMercado(picks, permitidos) {
  const best = {}
  for (const p of picks ?? []) {
    const cat = p.category ?? catDe(p.marketKey)
    if (permitidos && !permitidos.includes(cat)) continue
    const prev = best[cat]
    if (!prev || (p.confidence ?? 0) > (prev.confidence ?? 0)) best[cat] = p
  }
  const ORDEN = ['shots', 'sot', 'corners', 'ti', 'gk', 'goals', 'handicap', 'cards']
  return ORDEN.map(c => best[c]).filter(Boolean)
}

export default function PickDelPartido({ fixture }) {
  const [picks, setPicks] = useState([])
  const [estado, setEstado] = useState('cargando') // cargando|listo|vacio|sin-analizar
  const [calculando, setCalculando] = useState(false)
  const [progreso, setProgreso] = useState('')

  const permitidos = mercadosDeLiga(fixture.leagueId)

  const leer = useCallback(() => {
    const pred = getPrediccion(fixture.leagueId, fixture.homeTeam, fixture.awayTeam)
    if (!pred) { setEstado('sin-analizar'); return }
    const lista = unoPorMercado(pred.picks, permitidos)
    if (lista.length) { setPicks(lista); setEstado('listo') } else setEstado('vacio')
  }, [fixture.leagueId, fixture.homeTeam, fixture.awayTeam]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { leer() }, [leer])

  const calcular = async () => {
    setCalculando(true); setProgreso('cargando historial...')
    try {
      const liga = getLeague(fixture.leagueId)
      const onProg = (n, i, t) => setProgreso(`${n} ${i}/${t}`)
      const A = await buildTeamStats(liga, fixture.homeId, fixture.homeTeam, onProg)
      const B = await buildTeamStats(liga, fixture.awayId, fixture.awayTeam, onProg)
      const calc = computePrematchCalc(A, B, liga)
      const base = getBaseline(liga.id)
      let lista = pickUnoPorMercado(generateCandidates(calc, null, A, B), permitidos)
        // El porqué se guarda CON el pick: la tarjeta lo muestra después sin
        // volver a pedir el historial de los equipos.
        .map(p => ({ ...p, porque: explicacionCorta(p, A, B, {}, calc, {}, {}, base) }))
      lista = await anotarCuotas(liga.id, A.name, B.name, lista) // cuota real si hay API key
      savePrediccion({
        leagueId: liga.id, teamAName: A.name, teamBName: B.name,
        expected: {
          goals: calc.t.goals, shots: calc.t.shots, sot: calc.t.sot,
          corners: calc.t.corners, cards: calc.t.cards, fouls: calc.fouls.total,
          ti: calc.t.ti, gk: calc.t.gk,
          goalsA: calc.adj.goalsA, goalsB: calc.adj.goalsB,
        },
        picks: lista,
      })
      if (lista.length) { setPicks(lista); setEstado('listo') } else setEstado('vacio')
    } catch (e) {
      setProgreso(e.message || 'error')
      setEstado('sin-analizar')
    } finally { setCalculando(false) }
  }

  if (estado === 'listo') {
    return (
      <div className="px-3 pb-2.5 -mt-1 space-y-1.5">
        {picks.map((p, i) => {
          const cat = p.category ?? catDe(p.marketKey)
          const cuotaMin = p.pMod > 5 ? (1.025 / (p.pMod / 100)).toFixed(2) : null
          const esHand = cat === 'handicap'
          return (
            <div key={i} className="bg-green-950/30 border border-green-900/40 rounded-lg px-2.5 py-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm w-5 text-center">{ICONO[cat] ?? '🎯'}</span>
                <span className="text-[9px] text-gray-500 uppercase w-16 shrink-0">{MERCADO_LABEL[cat] ?? cat}</span>
                <span className={`text-xs font-black px-1.5 py-0.5 rounded ${
                  esHand ? 'bg-purple-700 text-white' : p.dir === 'OVER' ? 'bg-green-700 text-white' : 'bg-blue-700 text-white'
                }`}>
                  {esHand ? p.line : `${p.dir} ${p.line}`}
                </span>
                <span className="text-white text-[11px] font-medium truncate">{p.label}</span>
                <span className="text-[10px] text-gray-500 ml-auto shrink-0">
                  proy {p.expected} · P {p.pMod}%
                  {p.cuota
                    ? <span className="text-emerald-400 font-semibold"> · cuota {p.cuota}{p.casaCuota ? ` (${p.casaCuota})` : ''}</span>
                    : cuotaMin ? ` · desde ${cuotaMin}` : ''}
                </span>
              </div>
              {p.porque?.length > 0 && (
                <div className="mt-1 pl-7 space-y-0.5">
                  {p.porque.map((linea, k) => (
                    <p key={k} className={`text-[10px] leading-snug ${k === 0 ? 'text-gray-300' : linea.startsWith('⚠️') ? 'text-yellow-600/90' : 'text-gray-500'}`}>
                      {k === 0 ? linea : `• ${linea}`}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  if (estado === 'vacio') {
    return (
      <div className="px-3 pb-2.5 -mt-1">
        <p className="text-[11px] text-gray-500 bg-dark-700/50 rounded-lg px-2.5 py-1.5">
          Sin picks con margen creíble aquí — no siempre hay valor, y eso también es una respuesta
        </p>
      </div>
    )
  }

  return (
    <div className="px-3 pb-2.5 -mt-1">
      <button onClick={calcular} disabled={calculando}
        className="w-full text-[11px] px-2.5 py-1.5 rounded-lg bg-dark-700 text-gray-400 hover:text-white border border-dark-500 disabled:opacity-60">
        {calculando ? `⏳ ${progreso}` : `🎯 Ver picks (${permitidos.map(m => MERCADO_LABEL[m]).join(', ')})`}
      </button>
    </div>
  )
}
