import { describe, it, expect } from 'vitest'
import { numero } from '../src/components/Estimulo.jsx'
import { preguntasSemilla } from '../src/lib/banco'

describe('estímulos gráficos', () => {
  it('entiende números en formato colombiano', () => {
    expect(numero(3)).toBe(3)
    expect(numero('3,5')).toBe(3.5)
    expect(numero('1.050')).toBe(1050)
    expect(numero('1.050,25')).toBe(1050.25)
    expect(numero('-0,4')).toBe(-0.4)
    expect(Number.isNaN(numero('abc'))).toBe(true)
  })
  it('todos los gráficos del banco tienen valores numéricos válidos', async () => {
    const lista = await preguntasSemilla()
    const malos = []
    for (const p of lista) {
      const e = p.estimulo
      if (!e || !['barras', 'lineas'].includes(e.tipo)) continue
      for (const s of e.series ?? []) for (const [, v] of s.valores ?? []) if (!Number.isFinite(numero(v))) malos.push(`${p.id}: ${v}`)
    }
    expect(malos).toEqual([])
  })
})
