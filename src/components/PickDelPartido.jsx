import { useState, useEffect, useCallback } from 'react'
import { getPrediccion } from '../lib/predicciones'
import { getLeague } from '../lib/leagues'
import { buildTeamStats } from '../lib/league-stats'
import { computePrematchCalc } from '../lib/prematch'
import { generateCandidates, selectTopPicks } from '../lib/picks'
import { savePrediccion } from '../lib/predicciones'
import { tieneMercado } from '../lib/mercados-liga'

// ─── UN SOLO PICK por partido, dentro del Fixture ────────────────────────────
// Solo los mercados que el usuario juega: tiros, tiros al arco, córners,
// saques de banda y saques de portería. Nada de tarjetas ni goles.
// Si el partido ya fue analizado (análisis del día), sale al instante.
// Si no, un botón lo calcula con los datos que ya están en las fuentes.

const CATS = new Set(['shots', 'sot', 'corners', 'ti', 'gk'])
const CAT_MERCADO = { shots: 'shots', sot: 'sot', corners: 'corners', ti: 'ti', gk: 'gk' }

// De los picks guardados, el MEJOR de esos mercados (mayor confianza)
export function mejorPick(picks) {
  return (picks ?? [])
    .filter(p => CATS.has(catDe(p.marketKey)))
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0) || Math.abs(b.margin ?? 0) - Math.abs(a.margin ?? 0))[0] ?? null
}

function catDe(marketKey = '') {
  if (marketKey.startsWith('shots') || marketKey.startsWith('tiros')) return 'shots'
  if (marketKey.startsWith('sot')) return 'sot'
  if (marketKey.startsWith('corners')) return 'corners'
  if (marketKey.startsWith('ti_')) return 'ti'
  if (marketKey.startsWith('gk_')) return 'gk'
  return 'otro'
}

const ICONO = { shots: '🎯', sot: '🥅', corners: '🚩', ti: '🧮', gk: '🧤' }

export default function PickDelPartido({ fixture }) {
  const [pick, setPick] = useState(null)
  const [estado, setEstado] = useState('cargando') // cargando | listo | vacio | sin-analizar
  const [calculando, setCalculando] = useState(false)
  const [progreso, setProgreso] = useState('')

  const leer = useCallback(() => {
    const pred = getPrediccion(fixture.leagueId, fixture.homeTeam, fixture.awayTeam)
    if (!pred) { setEstado('sin-analizar'); return }
    const m = mejorPick(pred.picks)
    if (m) { setPick(m); setEstado('listo') } else setEstado('vacio')
  }, [fixture.leagueId, fixture.homeTeam, fixture.awayTeam])

  useEffect(() => { leer() }, [leer])

  const calcular = async () => {
    setCalculando(true); setProgreso('cargando historial...')
    try {
      const liga = getLeague(fixture.leagueId)
      const onProg = (n, i, t) => setProgreso(`${n} ${i}/${t}`)
      const A = await buildTeamStats(liga, fixture.homeId, fixture.homeTeam, onProg)
      const B = await buildTeamStats(liga, fixture.awayId, fixture.awayTeam, onProg)
      const calc = computePrematchCalc(A, B, liga)
      const cands = generateCandidates(calc, null, A, B).filter(c => {
        const m = CAT_MERCADO[c.category]
        return m ? tieneMercado(liga.id, m) : false   // solo los 5 mercados
      })
      const top = selectTopPicks(cands, 5)
      savePrediccion({
        leagueId: liga.id, teamAName: A.name, teamBName: B.name,
        expected: {
          goals: calc.t.goals, shots: calc.t.shots, sot: calc.t.sot,
          corners: calc.t.corners, cards: calc.t.cards, fouls: calc.fouls.total,
          ti: calc.t.ti, gk: calc.t.gk,
        },
        picks: top,
      })
      const m = mejorPick(top)
      if (m) { setPick(m); setEstado('listo') } else setEstado('vacio')
    } catch (e) {
      setProgreso(e.message || 'error')
      setEstado('sin-analizar')
    } finally {
      setCalculando(false)
    }
  }

  if (estado === 'listo' && pick) {
    const cat = catDe(pick.marketKey)
    const cuotaMin = pick.pMod > 5 ? (1.025 / (pick.pMod / 100)).toFixed(2) : null
    return (
      <div className="px-3 pb-2.5 -mt-1">
        <div className="flex items-center gap-2 flex-wrap bg-green-950/40 border border-green-800/40 rounded-lg px-2.5 py-1.5">
          <span className="text-[10px] text-green-400 font-bold uppercase tracking-wide">Pick</span>
          <span className="text-base">{ICONO[cat] ?? '🎯'}</span>
          <span className={`text-sm font-black px-2 py-0.5 rounded ${pick.dir === 'OVER' ? 'bg-green-700 text-white' : 'bg-blue-700 text-white'}`}>
            {pick.dir} {pick.line}
          </span>
          <span className="text-white text-xs font-semibold">{pick.label}</span>
          <span className="text-[11px] text-gray-400 ml-auto">
            proy <strong className="text-green-300">{pick.expected}</strong> · P {pick.pMod}% · conf {pick.confidence}
          </span>
        </div>
        {cuotaMin && (
          <p className="text-[10px] text-gray-500 mt-1 px-1">💰 Vale desde cuota {cuotaMin}</p>
        )}
      </div>
    )
  }

  if (estado === 'vacio') {
    return (
      <div className="px-3 pb-2.5 -mt-1">
        <p className="text-[11px] text-gray-500 bg-dark-700/50 rounded-lg px-2.5 py-1.5">
          Sin pick con margen creíble en este partido — no siempre hay valor, y eso también es una respuesta
        </p>
      </div>
    )
  }

  return (
    <div className="px-3 pb-2.5 -mt-1">
      <button onClick={calcular} disabled={calculando}
        className="w-full text-[11px] px-2.5 py-1.5 rounded-lg bg-dark-700 text-gray-400 hover:text-white border border-dark-500 disabled:opacity-60">
        {calculando ? `⏳ ${progreso}` : '🎯 Ver pick recomendado'}
      </button>
    </div>
  )
}
