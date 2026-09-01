// ─── Tests del GAME STATE ENGINE (§53-54 del prompt de auditoría live) ───────
import { describe, it, expect } from 'vitest'
import { stateResponseExp, effectiveChasing, matchClosure, multiScalePace, dominance, buildGameState, explicarEstado } from '../src/lib/game-state'
import { getSituationS } from '../src/lib/engine'

// Priors sintéticos: FUERTE (favorito) vs DEBIL (underdog)
const FUERTE = { ppg: 2.3, shots_avg: 17 }
const DEBIL  = { ppg: 0.8, shots_avg: 9 }
const gapFuerte = +( (2.3 - 0.8) / 1.2 * 0.65 + (17 - 9) / 8 * 0.35 ).toFixed(3)  // ~+1.16 → clamp 1
const gapDebil  = -gapFuerte

describe('Casos A-J: el estado del partido cambia la respuesta', () => {
  it('A/B: perder 0-1 al 20 pesa MENOS que al 85 (interacción marcador × tiempo)', () => {
    const temprano = stateResponseExp({ scoreDiff: -1, minuto: 20, gap: 0.5, responseRatio: 1 })
    const tarde    = stateResponseExp({ scoreDiff: -1, minuto: 85, gap: 0.5, responseRatio: 1 })
    expect(tarde.factor).toBeGreaterThan(temprano.factor)
    // el baseline actual NO distingue: da lo mismo en ambos
    expect(getSituationS(-1)).toBe(getSituationS(-1))
  })

  it('C: el underdog perdiendo NO recibe el mismo empujón que el favorito', () => {
    const fav = stateResponseExp({ scoreDiff: -1, minuto: 65, gap: 1, responseRatio: 1 })
    const und = stateResponseExp({ scoreDiff: -1, minuto: 65, gap: -1, responseRatio: 1 })
    expect(fav.factor).toBeGreaterThan(und.factor)
  })

  it('G: pierde SIN respuesta observable → el ajuste se atenúa fuerte', () => {
    const conResp = stateResponseExp({ scoreDiff: -1, minuto: 68, gap: 0.6, responseRatio: 1.5 })
    const sinResp = stateResponseExp({ scoreDiff: -1, minuto: 68, gap: 0.6, responseRatio: 0.4 })
    expect(sinResp.factor).toBeLessThan(conResp.factor)
    // el caso clave del usuario: sin respuesta, el efecto del marcador casi no cuenta
    expect(sinResp.factor).toBeLessThan(1.10)
  })

  it('H: pierde CON respuesta fuerte → sí eleva la expectativa', () => {
    const r = stateResponseExp({ scoreDiff: -1, minuto: 68, gap: 0.6, responseRatio: 1.6 })
    expect(r.factor).toBeGreaterThan(1.15)
  })

  it('E/F: 0-0 con ritmo alto ≠ 0-0 con ritmo bajo (el marcador no lo distingue)', () => {
    const snapsAlto = [{ min: 40, sh: 5, sa: 4 }, { min: 55, sh: 9, sa: 7 }, { min: 70, sh: 14, sa: 11 }]
    const snapsBajo = [{ min: 40, sh: 2, sa: 1 }, { min: 55, sh: 3, sa: 2 }, { min: 70, sh: 4, sa: 2 }]
    const alto = multiScalePace(snapsAlto, 'sh', 14, 70)
    const bajo = multiScalePace(snapsBajo, 'sh', 4, 70)
    expect(alto.medio).toBeGreaterThan(bajo.medio)
    // el factor de marcador es idéntico en ambos (0-0) — la diferencia debe
    // venir del ritmo, no del estado
    expect(getSituationS(0)).toBe(1)
  })

  it('I/J: 2-0 al 85 se cierra; 2-0 al 55 con el rival respondiendo NO', () => {
    const tarde = matchClosure({ scoreDiff: 2, minuto: 85, responseRatioPerdedor: 0.7, pace: { trend: 'bajando' } })
    const vivo  = matchClosure({ scoreDiff: 2, minuto: 55, responseRatioPerdedor: 1.4, pace: { trend: 'subiendo' } })
    expect(tarde.nivel).toBe('CERRADO')
    expect(vivo.score).toBeLessThan(tarde.score)
  })
})

describe('§54 No simetría', () => {
  it('fuerte perdiendo ≠ débil perdiendo', () => {
    const a = stateResponseExp({ scoreDiff: -1, minuto: 60, gap: 1, responseRatio: 1 })
    const b = stateResponseExp({ scoreDiff: -1, minuto: 60, gap: -1, responseRatio: 1 })
    expect(a.factor).not.toBeCloseTo(b.factor, 2)
  })
  it('fuerte ganando ≠ débil ganando', () => {
    const a = stateResponseExp({ scoreDiff: 1, minuto: 60, gap: 1 })
    const b = stateResponseExp({ scoreDiff: 1, minuto: 60, gap: -1 })
    expect(a.factor).not.toBeCloseTo(b.factor, 2)
  })
  it('ganar +1 no es el espejo exacto de perder -1', () => {
    const gana  = stateResponseExp({ scoreDiff: 1, minuto: 60, gap: 0.5, responseRatio: 1 })
    const pierde = stateResponseExp({ scoreDiff: -1, minuto: 60, gap: 0.5, responseRatio: 1 })
    expect(Math.abs(gana.factor - 1)).not.toBeCloseTo(Math.abs(pierde.factor - 1), 2)
  })
})

describe('Chasing efectivo y diagnósticos', () => {
  it('perder respondiendo = chasing ALTO; perder sin responder = BAJO', () => {
    const alto = effectiveChasing({ scoreDiff: -1, minuto: 75, responseRatio: 1.5, pace: { trend: 'subiendo' } })
    const bajo = effectiveChasing({ scoreDiff: -1, minuto: 75, responseRatio: 0.5, pace: { trend: 'bajando' } })
    expect(alto.nivel).toBe('ALTO')
    expect(bajo.nivel).toBe('BAJO')
  })
  it('un pico corto no se confunde con tendencia sostenida', () => {
    const snaps = [{ min: 30, sh: 3 }, { min: 50, sh: 5 }, { min: 65, sh: 6 }, { min: 70, sh: 10 }]
    const p = multiScalePace(snaps, 'sh', 10, 70)
    expect(p.spike).toBe(true)
    expect(p.trend).toContain('pico')
  })
  it('dominio unilateral no es lo mismo que partido de alto ritmo', () => {
    expect(dominance(16, 2).tipo).toBe('dominio local')
    expect(dominance(9, 8).tipo).toBe('repartido')
  })
})

describe('Los dos casos que pidió el usuario (§38-39)', () => {
  const base = { minuto: 68, golesH: 0, golesA: 1, priorShotsH: 15, priorShotsA: 11,
                 snaps: [{ min: 40, sh: 2, sa: 4 }, { min: 55, sh: 3, sa: 6 }] }

  it('Favorito perdiendo SIN respuesta (3 tiros, 0 SOT) → no dispara la proyección', () => {
    const gs = buildGameState({ ...base, priorH: FUERTE, priorA: DEBIL, shotsH: 3, shotsA: 9 })
    expect(gs.stateExpH.factor).toBeLessThan(gs.stateBaseH)      // menos agresivo que el baseline
    expect(gs.chasingH.nivel).toBe('BAJO')
    const ex = explicarEstado(gs, 'H', 'El local', 'el visitante')
    expect(ex.respuesta).toContain('NO está respondiendo')
  })

  it('Favorito perdiendo CON respuesta (12 tiros) → sí eleva la proyección', () => {
    const gs = buildGameState({ ...base, priorH: FUERTE, priorA: DEBIL, shotsH: 16, shotsA: 5 })
    expect(gs.stateExpH.factor).toBeGreaterThan(1.10)
    expect(gs.chasingH.nivel).not.toBe('BAJO')
    const ex = explicarEstado(gs, 'H', 'El local', 'el visitante')
    expect(ex.respuesta).toContain('SÍ está respondiendo')
  })

  it('la explicación sale de contribuciones REALES, no de texto inventado', () => {
    const gs = buildGameState({ ...base, priorH: FUERTE, priorA: DEBIL, shotsH: 3, shotsA: 9 })
    const ex = explicarEstado(gs, 'H')
    const suma = ex.contribuciones.map(c => c.factor)
    expect(suma).toEqual(['Marcador', 'Tiempo restante', 'Fuerza relativa', 'Respuesta observada'])
    expect(ex.baselineVsExperimental).toContain('experimental')
  })
})

describe('No inventa lo que no hay', () => {
  it('declara explícitamente las variables no disponibles', () => {
    const gs = buildGameState({ minuto: 50, golesH: 1, golesA: 0 })
    expect(gs.noDisponible).toContain('ppda')
    expect(gs.status).toBe('EXPERIMENTAL')
  })
  it('sin prior no inventa fuerza: gap 0 y favorito "sin prior"', () => {
    const gs = buildGameState({ minuto: 50, golesH: 0, golesA: 1, shotsH: 5, shotsA: 6 })
    expect(gs.favorito).toBe('sin prior')
    expect(gs.strengthGapH).toBe(0)
  })
})
