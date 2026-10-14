import { describe, it, expect } from 'vitest'
import { preguntasSemilla, estadoDeSiembra, observarSiembra } from '../src/lib/banco'

describe('banco: carga perezosa', () => {
  it('las preguntas se cargan por trozos bajo demanda y se informa el progreso', async () => {
    const progreso = []
    const lista = await preguntasSemilla(p => progreso.push(p))
    expect(lista.length).toBeGreaterThanOrEqual(995)
    expect(progreso.length).toBeGreaterThan(5)
    expect(progreso.at(-1).hechos).toBe(progreso.at(-1).total)
    expect(new Set(lista.map(p => p.id)).size).toBe(lista.length) // sin ids repetidos
  })
  it('el estado de siembra empieza pendiente y es observable', () => {
    expect(estadoDeSiembra().fase).toBe('pendiente')
    let visto = null
    const parar = observarSiembra(s => { visto = s })
    expect(visto.fase).toBe('pendiente')
    parar()
  })
})
