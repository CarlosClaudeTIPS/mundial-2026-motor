import { describe, it, expect } from 'vitest'
import { generateCandidates, pickUnoPorMercado, pHandicap, pOficial, jointProbabilityMC, suggestCombo } from '../src/lib/picks.js'
import { mercadosDeLiga } from '../src/lib/mercados-liga.js'

// Partido de prueba: local claramente favorito (1.85 vs 1.00 goles esperados)
const calc = {
  t: { shots: 25.4, sot: 8.7, corners: 10.2, goals: 2.85, cards: 4.4, ti: 41.0, gk: 15.5 },
  adj: {
    shotsA: 14.6, shotsB: 10.8, cornA: 5.9, cornB: 4.3, sotA: 5.1, sotB: 3.6,
    cardsA: 2.1, cardsB: 2.3, tiA: 21.5, tiB: 19.5, gkA: 7.4, gkB: 8.1,
    goalsA: 1.85, goalsB: 1.00,
  },
}
const A = { name: 'Local', est: false }
const B = { name: 'Visita', est: false }
const cands = generateCandidates(calc, null, A, B)

function mulberry32(seed) {
  let s = seed
  return () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('un pick por mercado', () => {
  for (const [id, liga] of [[140, 'España'], [78, 'Alemania'], [61, 'Francia'], [999, 'sin configurar']]) {
    it(`${liga}: nunca dos del mismo mercado, y solo los que ofrece la casa`, () => {
      const permitidos = mercadosDeLiga(id)
      const picks = pickUnoPorMercado(cands, permitidos)
      expect(picks.length).toBeGreaterThan(0)
      expect(picks.length).toBeLessThanOrEqual(5)
      expect(picks.every(p => permitidos.includes(p.category))).toBe(true)
      // nunca la misma variable dos veces (el "over 8.5 y under 13.5" que molestaba)
      expect(new Set(picks.map(p => p.marketKey)).size).toBe(picks.length)
      // si el relleno mete una 2ª línea del mismo mercado: misma dirección SIEMPRE
      const porCat = {}
      for (const p of picks) (porCat[p.category] ??= []).push(p)
      for (const grupo of Object.values(porCat)) {
        expect(grupo.length).toBeLessThanOrEqual(2)
        expect(new Set(grupo.map(p => p.dir)).size).toBe(1)
      }
      // los hándicaps nunca se duplican (dos líneas del mismo partido se pisan)
      expect((porCat.handicap ?? []).length).toBeLessThanOrEqual(1)
    })
  }

  it('las ligas sin saques reciben goles y hándicap en su lugar', () => {
    const alemania = pickUnoPorMercado(cands, mercadosDeLiga(78)).map(p => p.category)
    expect(alemania).toContain('goals')
    expect(alemania).toContain('handicap')
    expect(alemania).not.toContain('ti')
    expect(alemania).not.toContain('gk')
  })
})

describe('hándicap de goles', () => {
  // El signo importa: H es lo que se SUMA al equipo. Con el local favorito,
  // "local +0.5" (empate o gana) DEBE ser más probable que "local -0.5" (gana).
  it('el signo de la línea no está invertido', () => {
    const h = cands.filter(c => c.category === 'handicap')
    const masMedio = h.find(p => p.marketKey === 'handicap_local' && p.line === '+0.5')
    const menosMedio = h.find(p => p.marketKey === 'handicap_local' && p.line === '-0.5')
    expect(masMedio.pMod).toBeGreaterThan(menosMedio.pMod)
    // local -0.5 y visitante +0.5 son complementarios: deben sumar 100
    const visitaMas = h.find(p => p.marketKey === 'handicap_visita' && p.line === '+0.5')
    expect(menosMedio.pMod + visitaMas.pMod).toBeCloseTo(100, 0)
  })

  it('la convolución de Poisson coincide con el Monte Carlo', () => {
    const otro = cands.find(c => c.category === 'corners')
    for (const pick of cands.filter(c => c.category === 'handicap')) {
      const mc = jointProbabilityMC(pick, otro, 40000, mulberry32(0x9e3779b9))
      expect(Math.abs(mc.margA - pOficial(pick) * 100)).toBeLessThan(1.5)
    }
  })

  it('sirve como pata de combinada donde no hay saques', () => {
    const combo = suggestCombo(pickUnoPorMercado(cands, mercadosDeLiga(61)), 1.50)
    expect(combo).toBeTruthy()
    expect(100 / combo.pGate).toBeGreaterThan(1.5)
  })

  it('pHandicap es monótona en la línea', () => {
    const p = l => pHandicap(1.85, 1.0, l)
    expect(p(-1.5)).toBeGreaterThan(p(-0.5))
    expect(p(-0.5)).toBeGreaterThan(p(0.5))
    expect(p(0.5)).toBeGreaterThan(p(1.5))
  })
})
