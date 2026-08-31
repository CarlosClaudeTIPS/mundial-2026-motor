// ─── ANÁLISIS AUTOMÁTICO DEL DÍA, POR LIGA ───────────────────────────────────
//
// Recorre los partidos de una fecha en las ligas elegidas, corre el motor
// prepartido completo en cada uno y GUARDA la predicción (savePrediccion).
// Así los picks quedan registrados solos: el usuario no tiene que entrar
// partido por partido en Analizar.
//
// Respeta mercados-liga.js: en cada competición solo se generan picks de los
// mercados que la casa realmente ofrece.
//
// CUIDADO CON EL TRIAL: cada partido necesita el historial de sus dos equipos
// (~20-25 llamadas a Live-Score). Por eso hay tope de partidos y el consumo se
// estima ANTES de empezar. La caché abarata mucho los equipos repetidos.

import { fetchFixtures, getLocalDateStr } from './football-api'
import { buildTeamStats } from './league-stats'
import { computePrematchCalc } from './prematch'
import { generateCandidates, selectTopPicks, suggestCombo } from './picks'
import { savePrediccion, getPrediccion } from './predicciones'
import { getLeague } from './leagues'
import { tieneMercado, resumenLiga } from './mercados-liga'

const CAT_A_MERCADO = { shots: 'shots', sot: 'sot', corners: 'corners', ti: 'ti', gk: 'gk', cards: 'cards' }

// Llamadas aproximadas por partido (2 equipos × ~10 partidos de historial + Sofascore)
export const COSTO_APROX_POR_PARTIDO = 22

// ─── Qué partidos hay para analizar (sin gastar llamadas de stats) ───────────
export async function partidosDelDia(leagueIds, fecha) {
  const porLiga = []
  for (const id of leagueIds) {
    const liga = getLeague(id)
    if (!liga) continue
    try {
      const r = await fetchFixtures(id)
      if (!r?.ok) continue
      const fx = (r.fixtures ?? []).filter(f => getLocalDateStr(f.date) === fecha)
      if (fx.length) porLiga.push({ liga, fixtures: fx.sort((a, b) => new Date(a.date) - new Date(b.date)) })
    } catch {}
  }
  const total = porLiga.reduce((s, l) => s + l.fixtures.length, 0)
  return { porLiga, total, costoEstimado: total * COSTO_APROX_POR_PARTIDO }
}

// ─── Analizar un partido y guardar su predicción ─────────────────────────────
async function analizarPartido(liga, fixture, onProgress) {
  const prog = (msg) => onProgress?.(`${fixture.homeTeam} vs ${fixture.awayTeam} — ${msg}`)
  const teamA = await buildTeamStats(liga, fixture.homeId, fixture.homeTeam, (n, i, t) => prog(`historial ${n} ${i}/${t}`))
  const teamB = await buildTeamStats(liga, fixture.awayId, fixture.awayTeam, (n, i, t) => prog(`historial ${n} ${i}/${t}`))

  const calc = computePrematchCalc(teamA, teamB, liga)
  const candidates = generateCandidates(calc, null, teamA, teamB)
    .filter(c => {
      const m = CAT_A_MERCADO[c.category]
      return m ? tieneMercado(liga.id, m) : true
    })
  const picks = selectTopPicks(candidates, 5)
  const combo = suggestCombo(picks, 1.50)

  savePrediccion({
    leagueId: liga.id,
    teamAName: teamA.name,
    teamBName: teamB.name,
    expected: {
      goals: calc.t.goals, shots: calc.t.shots, sot: calc.t.sot,
      corners: calc.t.corners, cards: calc.t.cards, fouls: calc.fouls.total,
      ti: calc.t.ti, gk: calc.t.gk,
      goalsA: calc.adj.goalsA, goalsB: calc.adj.goalsB,
      shotsA: calc.adj.shotsA, shotsB: calc.adj.shotsB,
    },
    picks,
  })

  return {
    fixture, picks, combo,
    muestraPobre: teamA.est || teamB.est,
    equipos: { a: teamA.name, b: teamB.name },
  }
}

// ─── ANÁLISIS COMPLETO DEL DÍA ───────────────────────────────────────────────
// onProgress({ hecho, total, texto }) para la barra de avance.
// maxPartidos protege el trial. omitirYaAnalizados evita repetir trabajo.
export async function analizarDia({
  leagueIds, fecha, maxPartidos = 8,
  omitirYaAnalizados = true, onProgress = null, señalAborto = null,
}) {
  const { porLiga } = await partidosDelDia(leagueIds, fecha)

  // Cola respetando el tope, repartida entre ligas (round-robin) para no
  // gastar todo el presupuesto en la primera competición
  const cola = []
  let quedan = true
  for (let i = 0; quedan && cola.length < maxPartidos; i++) {
    quedan = false
    for (const l of porLiga) {
      if (cola.length >= maxPartidos) break
      if (l.fixtures[i]) { cola.push({ liga: l.liga, fixture: l.fixtures[i] }); quedan = true }
    }
  }

  const resultados = []
  const omitidos = []
  let hecho = 0
  for (const item of cola) {
    if (señalAborto?.abortado) break
    const yaEsta = omitirYaAnalizados && getPrediccion(item.liga.id, item.fixture.homeTeam, item.fixture.awayTeam)
    if (yaEsta) {
      omitidos.push({ ...item, motivo: 'ya analizado' })
      hecho++
      onProgress?.({ hecho, total: cola.length, texto: `${item.fixture.homeTeam} vs ${item.fixture.awayTeam} — ya estaba analizado` })
      continue
    }
    try {
      const r = await analizarPartido(item.liga, item.fixture, (texto) =>
        onProgress?.({ hecho, total: cola.length, texto }))
      resultados.push({ liga: item.liga, ...r })
    } catch (e) {
      omitidos.push({ ...item, motivo: e.message || 'error al analizar' })
    }
    hecho++
    onProgress?.({ hecho, total: cola.length, texto: `${hecho}/${cola.length} listos` })
  }

  // Agrupar por liga, como pidió el usuario
  const porLigaRes = {}
  for (const r of resultados) {
    const k = r.liga.id
    if (!porLigaRes[k]) porLigaRes[k] = { liga: r.liga, mercados: resumenLiga(r.liga.id), partidos: [] }
    porLigaRes[k].partidos.push(r)
  }

  const totalPicks = resultados.reduce((s, r) => s + r.picks.length, 0)
  return {
    fecha,
    analizados: resultados.length,
    enCola: cola.length,
    disponibles: porLiga.reduce((s, l) => s + l.fixtures.length, 0),
    totalPicks,
    omitidos,
    porLiga: Object.values(porLigaRes),
  }
}
