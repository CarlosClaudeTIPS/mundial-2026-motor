// ─── Tests unitarios del sistema cuantitativo (auditoría v3 §44) ─────────────
// Ejecutar: npm test
// Estos tests protegen las invariantes matemáticas y de decisión — si alguno
// falla tras un cambio, el cambio rompió una garantía del sistema.
import { describe, it, expect } from 'vitest'

import { nbOver } from '../src/lib/throwins'
import { jointProbability, jointProbabilityMC, suggestCombo } from '../src/lib/picks'
import { evaluarMercado, avisosCorrelacion } from '../src/lib/market-engine'
import { redCardFactor, redCardFactorGk, restanteEfectivo } from '../src/lib/match-state'
import { shotsLiveModel } from '../src/lib/shots'
import { cardsLiveModel, hazardShare } from '../src/lib/cards'

// ── DISTRIBUCIÓN: la NB debe ser una probabilidad válida y monótona ──────────
describe('Distribución NB', () => {
  it('P(X > línea) decrece al subir la línea y vive en [0,1]', () => {
    let prev = 1.01
    for (let line = 0.5; line <= 30.5; line += 1) {
      const p = nbOver(12, line, 1.4)
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(1)
      expect(p).toBeLessThanOrEqual(prev + 1e-9)
      prev = p
    }
  })
  it('la pmf implícita suma ~1 (P(X>línea)→0 en la cola)', () => {
    expect(nbOver(10, 80.5, 1.4)).toBeLessThan(1e-6)
    expect(nbOver(10, -0.5, 1.4)).toBeCloseTo(1, 6)
  })
})

// ── TIROS: coherencia contable total = SOT + fuera + bloqueados ──────────────
describe('Coherencia de tiros', () => {
  it('las categorías suman el total (±0.15 de redondeo)', () => {
    const m = shotsLiveModel({ minuto: 40, sH: 8, sA: 5, sotH: 3, sotA: 2, blkH: 2, blkA: 1, goalDiff: 0, snaps: [], prior: null, daTotal: null })
    const suma = m.home.sotFinal + m.home.offFinal + m.home.blkFinal + m.away.sotFinal + m.away.offFinal + m.away.blkFinal
    expect(Math.abs(suma - m.expectedFinal)).toBeLessThan(0.35) // redondeo por lado
    expect(m.home.offFinal).toBeGreaterThanOrEqual(0)
    expect(m.away.offFinal).toBeGreaterThanOrEqual(0)
  })
})

// ── COMBINADAS: un solo proceso generativo ───────────────────────────────────
describe('Probabilidad conjunta', () => {
  const A = { category: 'shots', expected: 27, line: 24.5, dir: 'OVER' }
  const B = { category: 'corners', expected: 10.8, line: 8.5, dir: 'OVER' }

  it('OVER+OVER del grupo tempo → dependencia positiva', () => {
    const jp = jointProbability(A, B)
    expect(jp.pJoint).toBeGreaterThan(jp.pIndep)
  })
  it('OVER+UNDER del grupo tempo → dependencia negativa', () => {
    const jp = jointProbability(A, { ...B, dir: 'UNDER' })
    expect(jp.pJoint).toBeLessThan(jp.pIndep)
  })
  it('mercado insensible al tempo (TI) → independencia (ajuste ~0)', () => {
    const ti = { category: 'ti', expected: 34, line: 32.5, dir: 'OVER' }
    const jp = jointProbability(A, ti)
    expect(Math.abs(jp.ajusteDep)).toBeLessThan(0.15)
  })
  it('Monte Carlo del MISMO proceso generativo reproduce marginales y conjunta (±2pp)', () => {
    // rng determinista de calidad (mulberry32) — un LCG simple sesga los
    // productos de uniformes del muestreador de Poisson
    let a = 0x9E3779B9
    const rng = () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const jp = jointProbability(A, B)
    const mc = jointProbabilityMC(A, B, 40000, rng)
    expect(Math.abs(mc.pJoint - jp.pJoint)).toBeLessThan(2)
    // marginales del MC vs marginales analíticas implícitas en pIndep
    const margProd = (mc.margA / 100) * (mc.margB / 100) * 100
    expect(Math.abs(margProd - jp.pIndep)).toBeLessThan(2.5)
  })
  it('la implícita del target 1.50 es 1/1.50 (no 1.025/1.50)', () => {
    const picks = [{ ...A, pMod: 75, marketKey: 'shots_totales' }, { ...B, pMod: 80, marketKey: 'corners_totales' }]
    const combo = suggestCombo(picks, 1.50)
    expect(combo.impTarget).toBeCloseTo(66.7, 1)
  })
})

// ── MARKET ENGINE: decisión ──────────────────────────────────────────────────
describe('Market Engine', () => {
  const base = { pOverFn: () => 0.70, line: 9.5, oddsOver: 1.95, oddsUnder: 1.85, minuto: 50, minMinuto: 10 }
  it('sin calibrar, la señal positiva es PAPER BET (nunca BET)', () => {
    const r = evaluarMercado({ ...base, confidence: 75 })
    expect(r.signal).toBe('PAPER BET')
  })
  it('abstención dura → NO BET aunque haya edge y confianza', () => {
    const r = evaluarMercado({ ...base, confidence: 75, abstenciones: [{ cond: true, why: 'roja' }] })
    expect(r.signal).toBe('NO BET')
    expect(r.abstencion).toBe('roja')
  })
  it('confianza < 60 → NO BET aunque el edge sea enorme', () => {
    const r = evaluarMercado({ ...base, pOverFn: () => 0.90, confidence: 55 })
    expect(r.signal).toBe('NO BET')
  })
  it('con ambas cuotas quita el vig: implícita < 1/cuota bruta', () => {
    const r = evaluarMercado({ ...base, confidence: 75 })
    expect(r.impOver).toBeLessThan((1 / 1.95) * 100 + 0.01)
    expect(r.sinVig).toBe(true)
  })
  it('correlación: dos BET del grupo tempo generan aviso', () => {
    const avisos = avisosCorrelacion([
      { marketBase: 'corners', label: 'C' }, { marketBase: 'shots', label: 'T' },
    ])
    expect(avisos.length).toBe(1)
  })
})

// ── ROJA: coherencia por mercado ─────────────────────────────────────────────
describe('Tarjeta roja', () => {
  it('el equipo con 10 genera menos; su rival más', () => {
    expect(redCardFactor(1, 0)).toBeLessThan(1)
    expect(redCardFactor(0, 1)).toBeGreaterThan(1)
  })
  it('en GK es inverso: el de 10 saca MÁS', () => {
    expect(redCardFactorGk(1, 0)).toBeGreaterThan(1)
    expect(redCardFactorGk(0, 1)).toBeLessThan(1)
  })
  it('roja con partido resuelto (≥2, ≥70\') se atenúa', () => {
    const normal = redCardFactor(1, 0)
    const atenuada = redCardFactor(1, 0, { goalDiff: 3, minuto: 80 })
    expect(atenuada).toBeGreaterThan(normal) // más cerca de 1
    expect(atenuada).toBeLessThan(1)
  })
  it('tarjetas con roja → abstención (NO BET) pero el modelo sigue prediciendo', () => {
    const m = cardsLiveModel({ minuto: 50, cH: 2, cA: 1, rH: 1, rA: 0, foulsH: 8, foulsA: 7, goalDiff: 0, snaps: [], prior: null })
    expect(m.hayRoja).toBe(true)
    expect(m.expectedFinal).toBeGreaterThan(m.acum) // sigue proyectando
  })
})

// ── HAZARD de tarjetas: acumulada válida y creciente ─────────────────────────
describe('Hazard temporal', () => {
  it('H(min) es creciente, H(0)=0, H(95)=1', () => {
    expect(hazardShare(0)).toBe(0)
    expect(hazardShare(95)).toBeCloseTo(1, 6)
    let prev = -1
    for (let t = 5; t <= 95; t += 5) {
      const h = hazardShare(t)
      expect(h).toBeGreaterThan(prev)
      prev = h
    }
  })
  it('las tarjetas se concentran al final: H(45) < 45/95', () => {
    expect(hazardShare(45)).toBeLessThan(45 / 95)
  })
})

// ── ANTI-LEAKAGE estructural: restante efectivo nunca negativo ───────────────
describe('Match State', () => {
  it('restanteEfectivo ≥ 0 en todo el rango incl. prórroga', () => {
    for (let t = 1; t <= 120; t++) expect(restanteEfectivo(t)).toBeGreaterThanOrEqual(0)
  })
})
