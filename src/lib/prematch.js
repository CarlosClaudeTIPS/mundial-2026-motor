// ─── Cálculo prepartido reutilizable + backtest ──────────────────────────────
// El mismo pipeline que usa la pestaña Analizar, como función pura, para poder
// correr el motor MEJORADO sobre partidos YA JUGADOS y ver qué habría predicho.

import {
  calcExpectedCorners, calcExpectedShots, calcExpectedFouls,
  calcExpectedGK, calcExpectedTI, calcExpectedGoals, calcExpectedCards,
  calcExpectedPasses,
} from './engine'
import { DEFAULT_MODS } from './context'
import { generateCandidates, selectTopPicks } from './picks'
import { buildTeamStats } from './league-stats'
import { fetchFixtureStats } from './livescore-api'
import { actualValue, judge } from './predicciones'

// Calc prepartido con contexto neutro (sin checks manuales)
export function computePrematchCalc(teamA, teamB, league) {
  const kC = league.kCorners
  const modsA = { ...DEFAULT_MODS }
  const modsB = { ...DEFAULT_MODS }

  const shots   = calcExpectedShots(teamA, teamB)
  const corners = calcExpectedCorners(teamA, teamB)
  const passes  = calcExpectedPasses(teamA, teamB)
  const fouls   = calcExpectedFouls(teamA, teamB, modsA.cards, modsB.cards)
  const goals   = calcExpectedGoals(teamA, teamB)
  const cardsCausal = calcExpectedCards(teamA, teamB, fouls.expFoulsA, fouls.expFoulsB)
  const gk      = calcExpectedGK(teamA, teamB)
  const ti      = calcExpectedTI(teamA, teamB, { kLiga: league.kTI })

  const adj = {
    shotsA: shots.expShotsA, shotsB: shots.expShotsB,
    sotA: shots.expSOTA, sotB: shots.expSOTB,
    cornA: +(corners.expA * kC).toFixed(2), cornB: +(corners.expB * kC).toFixed(2),
    goalsA: goals.expA, goalsB: goals.expB,
    cardsA: cardsCausal.expA, cardsB: cardsCausal.expB,
    shots1hA: +teamA.shots_1h.toFixed(2), shots1hB: +teamB.shots_1h.toFixed(2),
    shots2hA: +teamA.shots_2h.toFixed(2), shots2hB: +teamB.shots_2h.toFixed(2),
    sot1hA: +teamA.sot_1h.toFixed(2), sot1hB: +teamB.sot_1h.toFixed(2),
    corn1hA: +(teamA.corners_1h * kC).toFixed(2), corn1hB: +(teamB.corners_1h * kC).toFixed(2),
    corn2hA: +(teamA.corners_2h * kC).toFixed(2), corn2hB: +(teamB.corners_2h * kC).toFixed(2),
    goals1hA: +teamA.goals_1h.toFixed(2), goals1hB: +teamB.goals_1h.toFixed(2),
    goals2hA: +teamA.goals_2h.toFixed(2), goals2hB: +teamB.goals_2h.toFixed(2),
    cards1hA: +teamA.cards_1h.toFixed(2), cards1hB: +teamB.cards_1h.toFixed(2),
    gkA: gk.expA, gkB: gk.expB,
    tiA: ti.expA, tiB: ti.expB,
  }

  const t = {
    shots: +(adj.shotsA + adj.shotsB).toFixed(2),
    sot: +(adj.sotA + adj.sotB).toFixed(2),
    corners: +(adj.cornA + adj.cornB).toFixed(2),
    goals: +(adj.goalsA + adj.goalsB).toFixed(2),
    cards: +(adj.cardsA + adj.cardsB).toFixed(2),
    shots1h: +(adj.shots1hA + adj.shots1hB).toFixed(2),
    shots2h: +(adj.shots2hA + adj.shots2hB).toFixed(2),
    sot1h: +(adj.sot1hA + adj.sot1hB).toFixed(2),
    corn1h: +(adj.corn1hA + adj.corn1hB).toFixed(2),
    corn2h: +(adj.corn2hA + adj.corn2hB).toFixed(2),
    goals1h: +(adj.goals1hA + adj.goals1hB).toFixed(2),
    goals2h: +(adj.goals2hA + adj.goals2hB).toFixed(2),
    cards1h: +(adj.cards1hA + adj.cards1hB).toFixed(2),
    gk: +(adj.gkA + adj.gkB).toFixed(2),
    ti: +(adj.tiA + adj.tiB).toFixed(2),
  }

  return { adj, t, passes, fouls, goals }
}

// ─── Backtest de UN partido terminado ────────────────────────────────────────
// Reconstruye el prepartido SIN incluir ese partido en el historial, genera los
// picks del motor actual y los evalúa contra las stats reales.
export async function backtestMatch(league, fixture, onProgress) {
  const teamA = await buildTeamStats(league, fixture.homeId, fixture.homeTeam, onProgress, { excludeFixtureId: fixture.id })
  const teamB = await buildTeamStats(league, fixture.awayId, fixture.awayTeam, onProgress, { excludeFixtureId: fixture.id })

  const calc = computePrematchCalc(teamA, teamB, league)

  // Stats reales del partido (cacheadas 30 días) — se cargan ANTES para
  // elegir solo picks de mercados verificables con lo que la API sí reportó
  const st = await fetchFixtureStats(fixture.id, fixture.homeId, fixture.awayId).catch(() => null)
  const homeStats = st?.stats?.[0]?.stats ?? {}
  const awayStats = st?.stats?.[1]?.stats ?? {}

  const candidates = generateCandidates(calc, null, teamA, teamB)
    .filter(c => actualValue(c.marketKey, fixture, homeStats, awayStats) != null)
  const top = selectTopPicks(candidates, 5)
    .sort((a, b) => b.confidence - a.confidence || Math.abs(b.margin) - Math.abs(a.margin))

  const picks = top.map(pk => {
    const actual = actualValue(pk.marketKey, fixture, homeStats, awayStats)
    return {
      label: pk.label, marketKey: pk.marketKey, dir: pk.dir,
      line: pk.line, pMod: pk.pMod, confidence: pk.confidence,
      expected: pk.expected,
      ...judge(pk, actual), actual,
    }
  })

  return {
    key: `backtest_${fixture.id}`,
    ts: new Date(fixture.date).getTime(),
    evalTs: Date.now(),
    leagueId: league.id,
    home: fixture.homeTeam,
    away: fixture.awayTeam,
    score: `${fixture.homeGoals}-${fixture.awayGoals}`,
    date: fixture.date,
    backtest: true,
    picks,
  }
}
