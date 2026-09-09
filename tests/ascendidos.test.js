import { describe, it, expect } from 'vitest'
import { detectarAscendidos, esAscendido } from '../src/lib/ascendidos'
import { situacionTabla } from '../src/lib/motivacion'

const anterior = [
  { id: 1, name: 'Barcelona', rank: 1, pts: 94 }, { id: 2, name: 'Real Madrid', rank: 2, pts: 86 },
  { id: 3, name: 'Mallorca', rank: 18, pts: 42 }, { id: 4, name: 'Girona', rank: 19, pts: 41 }, { id: 5, name: 'Real Oviedo', rank: 20, pts: 29 },
]
// 5 equipos → 8 partidos totales; pj=1 → 12% = inicio de temporada
const actual = [
  { id: 1, name: 'Barcelona', rank: 1, pts: 3, pj: 1 }, { id: 2, name: 'Real Madrid', rank: 2, pts: 3, pj: 1 },
  { id: 3, name: 'Mallorca', rank: 3, pts: 1, pj: 1 },
  { id: 9, name: 'Racing Santander', rank: 4, pts: 0, pj: 1 }, // subió de Segunda
  { id: 10, name: 'Deportivo La Coruna', rank: 5, pts: 0, pj: 1 },
]

describe('Recién ascendidos', () => {
  it('detecta los que no estaban en la categoría la temporada pasada', () => {
    const asc = detectarAscendidos(actual, anterior)
    expect(asc.disponible).toBe(true)
    expect(asc.nombres).toEqual(['Racing Santander', 'Deportivo La Coruna'])
    expect(esAscendido(asc, { id: 9, name: 'Racing Santander' })).toBe(true)
    expect(esAscendido(asc, { id: -1, name: 'Racing Santander' })).toBe(true) // por nombre
    expect(esAscendido(asc, { id: 1, name: 'Barcelona' })).toBe(false)
  })

  it('sin tabla anterior no inventa', () => {
    expect(detectarAscendidos(actual, []).disponible).toBe(false)
  })

  it('un ascendido nunca queda "sin nada en juego" y tiene más urgencia (incluso al inicio)', () => {
    const normal = situacionTabla(actual, { id: 3, name: 'Mallorca' })
    const asc = situacionTabla(actual, { id: 9, name: 'Racing Santander' }, { ascendido: true })
    expect(normal.fase).toBe('inicio')
    expect(normal.motivacion).toBe('cualquier_result')
    expect(asc.ascendido).toBe(true)
    expect(asc.motivacion).toBe('ganar_o_empatar')
    expect(asc.urgencia).toBeGreaterThan(normal.urgencia)
    expect(asc.nota).toMatch(/Recién ascendido/)
  })
})
