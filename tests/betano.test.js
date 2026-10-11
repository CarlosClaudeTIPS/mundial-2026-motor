import { describe, it, expect } from 'vitest'
import { buscarEventoBetano, aplicarOfertaBetano, cuotaBetanoParaPick, escalera } from '../src/lib/betano.js'
import { generateCandidates, pickUnoPorMercado, rankPick } from '../src/lib/picks.js'

// Oferta REAL recortada de Betano (Bournemouth–Brentford, 2026-09-11)
const ou = (type, name, filas) => ({
  type, name,
  selections: filas.flatMap(([l, o, u]) => [
    { name: `Más de ${l}`, handicap: l, price: o },
    { name: `Menos ${l}`, handicap: l, price: u },
  ]),
})
const oferta = {
  estado: 'ok',
  evento: { id: '91655509', name: 'AFC Bournemouth - Brentford FC', home: 'AFC Bournemouth', away: 'Brentford FC', startTime: 1789221600000 },
  mercados: [
    ou('4159', 'Remates totales', [[26.5, 1.57, 2.3], [27.5, 1.78, 1.95], [28.5, 2.05, 1.72]]),
    ou('4160', 'AFC Bournemouth Remates totales', [[14.5, 1.62, 2.2], [15.5, 1.93, 1.82]]),
    ou('4161', 'Brentford FC Remates totales', [[11.5, 1.6, 2.25], [12.5, 1.93, 1.82]]),
    ou('X002', 'Tiros al Arco', [[7.5, 1.44, 2.67], [8.5, 1.75, 2], [9.5, 2.25, 1.6]]),
    ou('CNOU', 'Tiros de esquina Menos/Más', [[8.5, 1.31, 3.3], [9.5, 1.52, 2.42], [10.5, 1.87, 1.87], [11.5, 2.4, 1.53]]),
    ou('X328', 'Total de Saques de meta', [[16.5, 1.78, 1.98]]),
    ou('4165', 'AFC Bournemouth Total de Saques de meta', [[7.5, 1.72, 2.05]]),
    ou('4166', 'Brentford FC Total de Saques de meta', [[8.5, 1.72, 2.05]]),
    ou('X128', 'Total de Saques de banda', [[37.5, 1.91, 1.83]]),
    ou('HCTG', 'Goles totales Más/Menos', [[2.5, 1.62, 2.3], [3.5, 2.52, 1.53]]),
    { type: 'AHRF', name: 'Hándicap Asiático', selections: [
      { name: 'AFC Bournemouth -0.5', handicap: -0.5, price: 2.42 }, { name: 'Brentford FC +0.5', handicap: 0.5, price: 1.6 },
      { name: 'AFC Bournemouth +0.5', handicap: 0.5, price: 1.47 }, { name: 'Brentford FC -0.5', handicap: -0.5, price: 2.75 },
    ] },
    { type: 'FCH2', name: 'Hándicap de Tiros de Esquina 2 way', selections: [
      { name: 'AFC Bournemouth -0.5', handicap: -0.5, price: 1.67 }, { name: 'Brentford FC +0.5', handicap: 0.5, price: 2.05 },
    ] },
  ],
}

describe('Betano — emparejar el partido', () => {
  const eventos = [
    { id: '1', home: 'Manchester City', away: 'Liverpool FC', startTime: Date.parse('2026-09-13T15:30:00Z'), url: '/a/' },
    { id: '2', home: 'Manchester United', away: 'Chelsea FC', startTime: Date.parse('2026-09-13T15:30:00Z'), url: '/b/' },
    { id: '3', home: 'AFC Bournemouth', away: 'Brentford FC', startTime: Date.parse('2026-09-12T19:00:00Z'), url: '/c/' },
  ]
  it('distingue Manchester City de Manchester United (nombres Live-Score)', () => {
    expect(buscarEventoBetano(eventos, 'Manchester City', 'Liverpool').id).toBe('1')
    expect(buscarEventoBetano(eventos, 'Manchester Utd', 'Chelsea').id).toBe('2')
    expect(buscarEventoBetano(eventos, 'Bournemouth', 'Brentford').id).toBe('3')
  })
  it('no inventa un partido que no está y respeta la fecha', () => {
    expect(buscarEventoBetano(eventos, 'Arsenal', 'Tottenham')).toBeNull()
    expect(buscarEventoBetano(eventos, 'Bournemouth', 'Brentford', '2026-10-30T19:00:00Z')).toBeNull()
    expect(buscarEventoBetano(eventos, 'Bournemouth', 'Brentford', '2026-09-12T20:00:00Z').id).toBe('3')
  })
})

describe('Betano — cuota por pick', () => {
  it('escalera más/menos ordenada', () => {
    const e = escalera(oferta.mercados[0])
    expect(e.map(l => l.line)).toEqual([26.5, 27.5, 28.5])
    expect(e[1]).toEqual({ line: 27.5, over: 1.78, under: 1.95 })
  })
  it('totales, por equipo (por nombre, no por código) y hándicaps', () => {
    expect(cuotaBetanoParaPick(oferta, { marketKey: 'shots_totales', dir: 'OVER', line: 27.5 }).cuota).toBe(1.78)
    expect(cuotaBetanoParaPick(oferta, { marketKey: 'shots_totales', dir: 'UNDER', line: 26.5 }).cuota).toBe(2.3)
    expect(cuotaBetanoParaPick(oferta, { marketKey: 'tiros_visita', dir: 'OVER', line: 11.5 }).cuota).toBe(1.6)
    expect(cuotaBetanoParaPick(oferta, { marketKey: 'gk_local', dir: 'UNDER', line: 7.5 }).cuota).toBe(2.05)
    expect(cuotaBetanoParaPick(oferta, { marketKey: 'handicap_local', category: 'handicap', dir: 'CUBRE', hSide: 'local', hLine: 0.5 }).cuota).toBe(2.42)
    expect(cuotaBetanoParaPick(oferta, { marketKey: 'handicap_visita', category: 'handicap', dir: 'CUBRE', hSide: 'visita', hLine: 0.5 }).cuota).toBe(1.6)
    expect(cuotaBetanoParaPick(oferta, { marketKey: 'handicap_corners_local', category: 'handicap_corners', dir: 'CUBRE', hSide: 'local', hLine: 0.5 }).cuota).toBe(1.67)
  })
  it('línea no ofrecida → sin cuota con motivo; mercado no ofrecido → null; sin oferta → undefined', () => {
    const r = cuotaBetanoParaPick(oferta, { marketKey: 'shots_totales', dir: 'OVER', line: 30.5 })
    expect(r.cuota).toBeNull(); expect(r.motivo).toMatch(/26.5, 27.5, 28.5/)
    expect(cuotaBetanoParaPick(oferta, { marketKey: 'tarjetas_totales', dir: 'OVER', line: 4.5 })).toBeNull()
    expect(cuotaBetanoParaPick({ estado: 'sin-partido' }, { marketKey: 'shots_totales', dir: 'OVER', line: 27.5 })).toBeUndefined()
  })
})

const calc = {
  t: { shots: 29.0, sot: 9.6, corners: 11.4, goals: 2.9, cards: 4.4, ti: 40.0, gk: 17.8 },
  adj: {
    shotsA: 16.4, shotsB: 12.6, cornA: 6.6, cornB: 4.8, sotA: 5.6, sotB: 4.0,
    cardsA: 2.1, cardsB: 2.3, tiA: 20.5, tiB: 19.5, gkA: 8.4, gkB: 9.4,
    goalsA: 1.7, goalsB: 1.2,
  },
}
const A = { name: 'Bournemouth', est: false }
const B = { name: 'Brentford', est: false }

describe('Betano — picks solo de lo que la casa ofrece, cuota objetivo primero', () => {
  const cands = aplicarOfertaBetano(generateCandidates(calc, null, A, B), oferta)

  it('todo candidato que sobrevive tiene cuota real de Betano y EV calculado', () => {
    expect(cands.length).toBeGreaterThan(0)
    expect(cands.every(c => c.cuota > 1 && c.casaCuota === 'Betano' && typeof c.ev === 'number')).toBe(true)
    // las tarjetas no estaban en la oferta → ninguna sobrevive
    expect(cands.some(c => c.category === 'cards')).toBe(false)
  })

  it('sin oferta los candidatos quedan intactos', () => {
    const base = generateCandidates(calc, null, A, B)
    expect(aplicarOfertaBetano(base, { estado: 'sin-liga' })).toBe(base)
  })

  it('un pick por mercado, saques de portería primero, y nunca sin valor (cuota < 1.025/P)', () => {
    const picks = pickUnoPorMercado(cands, ['shots', 'sot', 'corners', 'ti', 'gk'], 5, { cuotaObjetivo: 1.5 })
    expect(picks.length).toBeGreaterThan(0)
    expect(picks[0].category).toBe('gk')
    expect(new Set(picks.map(p => p.category)).size).toBe(picks.length)
    for (const p of picks) expect(p.cuota).toBeGreaterThanOrEqual(1.025 / (p.pMod / 100))
  })

  it('con cuota objetivo 1.5 prefiere la línea en zona [1.48, 2.2] por EV antes que la cortita más segura', () => {
    const tiros = cands.filter(c => c.category === 'shots')
    const elegido = pickUnoPorMercado(tiros, ['shots'], 1, { cuotaObjetivo: 1.5 })[0]
    const enZona = tiros.filter(c => c.cuota >= 1.48 && c.cuota <= 2.2 && c.cuota >= 1.025 / (c.pMod / 100))
    if (enZona.length) {
      expect(elegido.cuota).toBeGreaterThanOrEqual(1.48)
      expect(elegido.ev).toBe(Math.max(...enZona.map(c => c.ev)))
    } else {
      expect(elegido).toBeDefined()
    }
  })

  it('rankPick: zona objetivo > sin cuota/corta > muy larga', () => {
    const zona = rankPick({ cuota: 1.6, ev: 3, confidence: 55, margin: 0.05 }, 1.5)
    const corta = rankPick({ cuota: 1.2, ev: 1, confidence: 70, margin: 0.1 }, 1.5)
    const larga = rankPick({ cuota: 3.1, ev: 9, confidence: 50, margin: 0.1 }, 1.5)
    const sin = rankPick({ confidence: 70, margin: 0.1 }, 1.5)
    expect(zona[0]).toBeGreaterThan(corta[0])
    expect(corta[0]).toBe(sin[0])
    expect(sin[0]).toBeGreaterThan(larga[0])
  })
})
