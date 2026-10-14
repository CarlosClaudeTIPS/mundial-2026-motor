import { describe, it, expect } from 'vitest'
import { CUESTIONARIO, OCUPACIONES, perfilIntereses, sugerirOcupaciones, conflictosDeValores, compararOpciones, CRITERIOS, planAccion, siguientePaso, FUTURO_VACIO, metaNueva, pruebasQuePesan, OPORTUNIDADES, FUENTES, ACTIVIDADES } from '../src/lib/futuro'

const responder = (fn) => Object.fromEntries(CUESTIONARIO.items.map(it => [it.id, fn(it)]))

describe('futuro: cuestionario e intereses', () => {
  it('el cuestionario tiene 36 ítems, 6 por área', () => {
    expect(CUESTIONARIO.items.length).toBe(36)
    for (const a of Object.keys(CUESTIONARIO.areas)) expect(CUESTIONARIO.items.filter(i => i.area === a).length).toBe(6)
  })
  it('sin respuestas no hay perfil suficiente; con 18 sí', () => {
    expect(perfilIntereses({}).suficiente).toBe(false)
    const parcial = Object.fromEntries(CUESTIONARIO.items.slice(0, 18).map(i => [i.id, 2]))
    expect(perfilIntereses(parcial).suficiente).toBe(true); expect(perfilIntereses(parcial).completo).toBe(false)
  })
  it('destaca las áreas altas y detecta un perfil plano', () => {
    const p = perfilIntereses(responder(it => (it.area === 'S' ? 3 : it.area === 'I' ? 2 : 0)))
    expect(p.destacadas[0].area).toBe('S'); expect(p.destacadas.map(a => a.area)).toContain('I'); expect(p.plano).toBe(false)
    expect(perfilIntereses(responder(() => 2)).plano).toBe(true)
  })
  it('sugiere ocupaciones afines y otras para abrir el panorama', () => {
    const p = perfilIntereses(responder(it => (it.area === 'S' ? 3 : it.area === 'I' ? 2 : 0)))
    const s = sugerirOcupaciones(p)
    expect(s.afines.length).toBeGreaterThan(0); expect(s.afines.length).toBeLessThanOrEqual(8)
    expect(s.afines[0].ocupacion.areas[0]).toBe('S')
    expect(s.panorama.length).toBeGreaterThan(0)
    expect(s.afines.every(a => a.areas_comunes.length > 0)).toBe(true)
  })
  it('toda ocupación tiene dificultades, rutas y fuentes conocidas; las rutas con carrera existen', () => {
    const fuentes = new Set([...FUENTES.formacion, ...FUENTES.trabajo, ...FUENTES.apoyos].map(f => f.id))
    for (const o of OCUPACIONES) {
      expect(o.dificil.length).toBeGreaterThan(20); expect(o.rutas.length).toBeGreaterThan(0)
      for (const f of o.fuentes) expect(fuentes.has(f)).toBe(true)
      for (const r of o.rutas) if (r.carrera) expect(pruebasQuePesan(r.carrera).length).toBeGreaterThan(0)
    }
  })
})

describe('futuro: valores, comparador y plan', () => {
  it('detecta conflictos solo cuando ambos valores son esenciales', () => {
    expect(conflictosDeValores({ ingresos: 3, creatividad: 3 }).length).toBe(1)
    expect(conflictosDeValores({ ingresos: 3, creatividad: 2 }).length).toBe(0)
  })
  it('el comparador respeta pesos, marca "sin dato" y no inventa valores', () => {
    const c = { opciones: [{ id: 'a', nombre: 'A' }, { id: 'b', nombre: 'B' }], pesos: { interes: 3, costo: 3, empleo: 0 }, respuestas: { a: { interes: 5, costo: 1 }, b: { interes: 3 } } }
    const r = compararOpciones(c)
    expect(r[0].promedio).toBe(3); expect(r[1].promedio).toBe(3)
    expect(r[1].sin_dato.map(x => x.id)).toContain('costo')
    expect(r[0].sin_dato.length).toBe(CRITERIOS.length - 2)
    expect(r[0].cobertura).toBeLessThan(100)
  })
  it('el plan de 30/90 días empieza por conocerse sin datos y se adapta al poco tiempo', () => {
    const f = FUTURO_VACIO()
    const p = planAccion(f)
    expect(p.dias30[0].tipo).toBe('conocete'); expect(p.dias90.length).toBeGreaterThan(0)
    f.entorno.tiempo = 'Solo noches o fines de semana'
    expect(planAccion(f).dias90[0].tipo).toBe('nota')
  })
  it('el plan no repite actividades hechas y toma el primer paso de las metas', () => {
    const f = FUTURO_VACIO()
    f.intereses.respuestas = responder(() => 2); f.valores = { ingresos: 3 }
    f.actividades.push({ id: 'x', actividad_id: 'entrevista', fecha: '2026-10-01', respuestas: {} })
    f.proyecto.metas.push(metaNueva({ titulo: 'Estudiar sistemas', primer_paso: 'Investigar tres programas', estado: 'en_curso' }))
    const p = planAccion(f)
    expect(p.dias30.some(x => x.actividad_id === 'entrevista')).toBe(false)
    expect(p.dias30.some(x => x.tipo === 'meta')).toBe(true)
  })
  it('el siguiente paso recomendado sigue el recorrido', () => {
    const f = FUTURO_VACIO()
    expect(siguientePaso(f).area).toBe('conocete')
    f.intereses.respuestas = responder(() => 2); f.valores = { ingresos: 2 }
    expect(siguientePaso(f).area).toBe('explora')
    f.guardadas = ['ocupacion:medico', 'ocupacion:enfermero']
    expect(siguientePaso(f).area).toBe('compara')
  })
  it('las oportunidades declaran vigencia y verificación; las actividades tienen reflexión', () => {
    for (const o of OPORTUNIDADES) { expect(['abierta', 'cerrada', 'anunciada', 'desconocida']).toContain(o.vigencia); expect(o.verificacion).toBeTruthy(); expect(o.consultado).toMatch(/^\d{4}-\d{2}-\d{2}$/) }
    for (const a of ACTIVIDADES) { expect(a.descubre).toBeTruthy(); expect(a.minutos).toBeGreaterThan(0); expect(a.registro).toBeTruthy() }
  })
})
