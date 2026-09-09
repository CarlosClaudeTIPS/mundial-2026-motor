import { describe, it, expect } from 'vitest'
import { situacionTabla, jornadaDe } from '../src/lib/motivacion'
import { stateResponseExp, buildGameState } from '../src/lib/game-state'

// Liga de 20 (3 bajan, top 4 Europa), 32 partidos jugados de 38 (84% → fase 'final')
const tabla = Array.from({ length: 20 }, (_, i) => ({
  id: 100 + i, name: `Equipo ${i + 1}`, rank: i + 1, pj: 32,
  pts: 70 - i * 3, // 70, 67, 64, ... 13
}))
// Ajustes puntuales para los casos
tabla[15].pts = 30 // 16º
tabla[16].pts = 29 // 17º (último salvado)
tabla[17].pts = 28 // 18º (primer descenso) → el 16º está a 2 pts del descenso
tabla[18].pts = 20
tabla[19].pts = 15

describe('Motivación automática desde la tabla', () => {
  it('16º a 2 puntos del descenso en recta final → necesita ganar, urgencia alta', () => {
    const s = situacionTabla(tabla, { id: 115, name: 'Equipo 16' })
    expect(s.disponible).toBe(true)
    expect(s.pos).toBe(16)
    expect(s.colchon).toBe(2)
    expect(s.zona).toBe('riesgo')
    expect(s.fase).toBe('final')
    expect(s.motivacion).toBe('necesita_ganar')
    expect(s.urgencia).toBeGreaterThanOrEqual(0.85)
    expect(s.nota).toMatch(/2 pts del descenso/)
  })

  it('18º (en descenso) → necesita ganar, dice cuánto le falta para salvarse', () => {
    const s = situacionTabla(tabla, { id: 117, name: 'Equipo 18' })
    expect(s.enDescenso).toBe(true)
    expect(s.ptsSalvacion).toBe(1)
    expect(s.motivacion).toBe('necesita_ganar')
    expect(s.urgencia).toBe(1)
  })

  it('líder en recta final → necesita ganar (título)', () => {
    const s = situacionTabla(tabla, { id: 100, name: 'Equipo 1' })
    expect(s.zona).toBe('titulo')
    expect(s.motivacion).toBe('necesita_ganar')
  })

  it('media tabla lejos de todo en recta final → sin nada en juego', () => {
    const s = situacionTabla(tabla, { id: 109, name: 'Equipo 10' }) // 43 pts: 15 sobre el descenso, 18 de Europa
    expect(s.zona).toBe('nada')
    expect(s.motivacion).toBe('ya_clasificado')
    expect(s.urgencia).toBeLessThan(0.5)
  })

  it('inicio de temporada: la tabla no manda (neutro)', () => {
    const inicio = tabla.map(t => ({ ...t, pj: 3 }))
    const s = situacionTabla(inicio, { id: 117, name: 'Equipo 18' })
    expect(s.fase).toBe('inicio')
    expect(s.motivacion).toBe('cualquier_result')
  })

  it('copa → ko, motivación neutra (el check de eliminación ya pesa)', () => {
    const s = situacionTabla(tabla, { id: 100, name: 'Equipo 1' }, { type: 'cup' })
    expect(s.zona).toBe('copa')
    expect(jornadaDe(s, s, 'cup')).toBe('ko')
  })

  it('equipo que no está en la tabla → no disponible, no inventa', () => {
    const s = situacionTabla(tabla, { id: 999, name: 'Otro' })
    expect(s.disponible).toBe(false)
    expect(s.motivacion).toBeNull()
  })
})

describe('Urgencia dentro del estado LIVE experimental', () => {
  it('perdiendo: el que se juega el descenso empuja más que el que no tiene nada en juego', () => {
    const urgente = stateResponseExp({ scoreDiff: -1, minuto: 70, gap: 0, responseRatio: 1, urgencia: 1 })
    const relajado = stateResponseExp({ scoreDiff: -1, minuto: 70, gap: 0, responseRatio: 1, urgencia: 0.25 })
    const neutro = stateResponseExp({ scoreDiff: -1, minuto: 70, gap: 0, responseRatio: 1 })
    expect(urgente.factor).toBeGreaterThan(neutro.factor)
    expect(relajado.factor).toBeLessThan(neutro.factor)
    expect(urgente.contribuciones.find(c => c.factor === 'Motivación (tabla)')).toBeTruthy()
  })
  it('ganando: la motivación NO empuja (administra igual)', () => {
    const a = stateResponseExp({ scoreDiff: 1, minuto: 70, gap: 0, urgencia: 1 })
    const b = stateResponseExp({ scoreDiff: 1, minuto: 70, gap: 0 })
    expect(a.factor).toBe(b.factor)
  })
  it('acotado: nunca más de ±8% sobre el efecto del marcador', () => {
    const r = stateResponseExp({ scoreDiff: -1, minuto: 70, gap: 0, responseRatio: 1, urgencia: 1 })
    expect(r.modUrgencia).toBeLessThanOrEqual(1.08)
  })
  it('buildGameState acepta motivH/motivA y los expone', () => {
    const motiv = situacionTabla(tabla, { id: 115, name: 'Equipo 16' })
    const gs = buildGameState({ minuto: 70, golesH: 0, golesA: 1, priorH: { ppg: 1.0, shots_avg: 11 }, priorA: { ppg: 1.4, shots_avg: 12 },
      shotsH: 9, shotsA: 8, priorShotsH: 11, priorShotsA: 12, motivH: motiv })
    expect(gs.motivH.zona).toBe('riesgo')
    expect(gs.stateExpH.contribuciones.some(c => c.factor === 'Motivación (tabla)')).toBe(true)
  })
})
