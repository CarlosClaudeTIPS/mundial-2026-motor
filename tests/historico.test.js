// ─── Tests del módulo RENDIMIENTO/HISTÓRICO (§33 del spec) ───────────────────
import { describe, it, expect, beforeAll } from 'vitest'

// Mock de localStorage (los stores solo lo usan al llamar funciones)
const store = new Map()
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
}

import { logDecision, listDecisiones, logCombo, listCombos } from '../src/lib/market-engine'
import { logTiSnapshot, resolveTiLog, tiLogAll, TI_MODEL } from '../src/lib/throwins'
import { evaluarPick, clasificarPick, turningPoint, resumenDia, fechasConDatos, picksDelDia, descomponerError } from '../src/lib/rendimiento'

const fakeModel = (minuto, acum, proj, i10, i90) => ({
  minuto, acum,
  expectedFinal: proj, naiveFinal: proj + 1,
  interval: [i10, i90], muRest: proj - acum,
  pOver: () => 0.6,
})

beforeAll(() => {
  // Partido m1: snapshots 20' y 40', final 33
  logTiSnapshot('m1', { home: 'A', away: 'B', leagueId: 39 }, fakeModel(20, 6, 31, 24, 39))
  logTiSnapshot('m1', { home: 'A', away: 'B', leagueId: 39 }, fakeModel(40, 14, 33, 28, 38))
  resolveTiLog('m1', 33, { h: 17, a: 16 })
  // Pick PAPER sobre m1
  logDecision({ matchId: 'm1', match: 'A vs B', market: 'ti', line: 30.5, odds: 1.8, pModelo: 62, pImplicita: 54, edge: 8, ev: 11, confidence: 70, signal: 'PAPER BET', quality: 'B', minuto: 40, lado: 'OVER' })
  // Combinada registrada
  logCombo({ matchKey: '39_A_B', home: 'A', away: 'B', labelA: 'Tiros OVER 24.5', labelB: 'Córners OVER 8.5', pA: 70, pB: 75, pIndep: 52.5, pJointTempo: 54, pGate: 52.5, targetOdds: 1.5, ev: -21, escenariosPos: '10/81', decision: 'NO BET' })
})

describe('Registro inmutable', () => {
  it('el pick se registra y su ts original NUNCA cambia al re-evaluarse', async () => {
    const antes = listDecisiones().find(d => d.matchId === 'm1')
    expect(antes).toBeTruthy()
    const ts0 = antes.ts
    await new Promise(r => setTimeout(r, 5))
    logDecision({ matchId: 'm1', match: 'A vs B', market: 'ti', line: 30.5, odds: 1.85, pModelo: 64, pImplicita: 54, edge: 10, signal: 'PAPER BET', minuto: 55, lado: 'OVER' })
    const despues = listDecisiones().find(d => d.matchId === 'm1')
    expect(despues.ts).toBe(ts0)          // foto original preservada en ts
    expect(despues.tsUltimo).toBeGreaterThanOrEqual(ts0)
  })
  it('los snapshots históricos no se sobrescriben (solo avanza el minuto)', () => {
    const m = tiLogAll().find(e => e.id === 'm1')
    expect(m.snaps.length).toBe(2)
    expect(m.snaps[0].min).toBeLessThan(m.snaps[1].min) // timeline ordenada
    // re-log con minuto viejo NO agrega
    logTiSnapshot('m1', {}, fakeModel(30, 10, 32, 26, 38))
    expect(tiLogAll().find(e => e.id === 'm1').snaps.length).toBe(2)
  })
})

describe('Resolución y evaluación', () => {
  it('vincula el resultado al pick correcto: hit y P&L', () => {
    const m = tiLogAll().find(e => e.id === 'm1')
    const pick = { market: 'ti', line: 30.5, lado: 'OVER', signal: 'PAPER BET', odds: 1.8 }
    const r = evaluarPick(pick, m)
    expect(r.final).toBe(33)
    expect(r.hit).toBe(true)              // 33 > 30.5
    expect(r.pnl).toBeCloseTo(0.8, 5)     // cuota 1.8 ganada
  })
  it('clasificación GOOD FORECAST — BAD OUTCOME cuando pierde dentro del intervalo', () => {
    const m = { snaps: [{ min: 40, i10: 28, i90: 38, acum: 14, proj: 33, lineCentral: 32.5, pCentral: 0.6 }], final: 29 }
    const pick = { market: 'ti', line: 30.5, lado: 'OVER', minuto: 40 }
    const r = evaluarPick(pick, m)
    expect(r.hit).toBe(false)
    const c = clasificarPick(pick, m, r)
    expect(c.etiqueta).toBe('GOOD FORECAST — BAD OUTCOME')
  })
  it('turning point: primer snapshot cuyo intervalo NO contuvo el final', () => {
    const m = { snaps: [{ min: 20, acum: 5, proj: 30, i10: 24, i90: 37 }, { min: 60, acum: 20, proj: 34, i10: 29, i90: 40 }], final: 25 }
    const tp = turningPoint(m)
    expect(tp.min).toBe(60)               // al 60' el 25 ya estaba fuera de 29-40
    const sinTp = turningPoint({ snaps: [{ min: 30, acum: 8, proj: 30, i10: 22, i90: 38 }], final: 30 })
    expect(sinTp).toBeNull()
  })
  it('descomposición: dentro del intervalo = VARIACIÓN ALEATORIA (no inventa causas)', () => {
    const m = { snaps: [{ min: 45, acum: 12, proj: 31, i10: 26, i90: 37 }], final: 28 }
    expect(descomponerError(m).cat).toBe('A')
  })
})

describe('Día, filtros y muestra', () => {
  const hoy = new Date().toLocaleDateString('sv-SE')
  it('fechasConDatos incluye hoy y picksDelDia filtra por fecha', () => {
    expect(fechasConDatos()).toContain(hoy)
    const { picks, combos } = picksDelDia(hoy)
    expect(picks.some(p => p.matchId === 'm1')).toBe(true)
    expect(combos.length).toBe(1)         // la combinada quedó registrada con sus patas
    expect(picksDelDia('1999-01-01').picks.length).toBe(0)
  })
  it('resumen del día marca INSUFFICIENT SAMPLE con n<10', () => {
    const r = resumenDia(hoy)
    expect(r.resueltos).toBeGreaterThanOrEqual(1)
    expect(r.insuficiente).toBe(true)
  })
  it('el análisis NO modifica parámetros del modelo (research flags ≠ ajustes)', () => {
    const phiAntes = TI_MODEL.PHI
    resumenDia(hoy); picksDelDia(hoy)
    expect(TI_MODEL.PHI).toBe(phiAntes)
  })
})
