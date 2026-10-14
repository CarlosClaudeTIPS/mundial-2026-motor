import { describe, it, expect } from 'vitest'
import { consejoPorRazon, leccionDe, razonesPosibles } from '../src/lib/feedback'
import { elegirVerificacion } from '../src/lib/banco'
import { nivelCompetencia, perfilDiagnostico } from '../src/lib/diagnostico'
import { medirAprendizaje, constancia } from '../src/lib/aprendizaje'
import { planSemana, normalizarConfig, diasDeEstudio, preguntasPorSesion, lunesDe } from '../src/lib/ruta'

const q = (id, extra = {}) => ({ id, prueba: 'matematicas', competencia: 'M1', habilidad: 'interpretar', dificultad: 2, tema: 'graficas', refuerzo_ids: [], estado: 'aprobada', opciones: [], ...extra })
const it_ = (over) => ({ uid: Math.random().toString(36), estudiante_id: 'e', pregunta_id: 'P', prueba: 'matematicas', competencia: 'M1', habilidad: 'interpretar', correcta: true, tipo_error: null, modo: 'practica', fecha: '2026-10-01T10:00:00.000Z', ...over })

describe('feedback.consejoPorRazon / leccionDe', () => {
  it('cada razón posible tiene consejo, estrategia y habilidad', () => {
    for (const r of razonesPosibles(q('A'), null)) {
      const c = consejoPorRazon(r, q('A'))
      expect(c.titulo).toBeTruthy(); expect(c.estrategia).toBeTruthy(); expect(c.habilidad).toBeTruthy()
    }
  })
  it('la razón "otra" usa el consejo genérico y sin razón no hay consejo', () => {
    expect(consejoPorRazon({ id: 'otra', texto: 'x', tipo_error: null }).id).toBe('otra')
    expect(consejoPorRazon(null)).toBeNull()
  })
  it('la lección trae la competencia y la habilidad de la pregunta', () => {
    const l = leccionDe(q('A'))
    expect(l.pasos.length).toBeGreaterThan(0); expect(l.habilidad_consejo).toBeTruthy()
  })
})

describe('banco.elegirVerificacion', () => {
  const base = q('M-1', { refuerzo_ids: ['M-2'] })
  it('prefiere el refuerzo no visto', () => {
    expect(elegirVerificacion(base, [q('M-2'), q('M-3')], new Set()).id).toBe('M-2')
  })
  it('si el refuerzo ya se vio, toma una nueva de la misma competencia y habilidad, nunca la misma', () => {
    const e = elegirVerificacion(base, [q('M-2'), q('M-3', { habilidad: 'leer' }), q('M-4'), base], new Set(['M-2']))
    expect(e.id).toBe('M-4')
  })
  it('no sube de dificultad y devuelve null si no hay nada nuevo', () => {
    expect(elegirVerificacion(base, [q('M-5', { dificultad: 3 })], new Set()).id).toBe('M-5') // último recurso: aunque sea más difícil
    expect(elegirVerificacion(base, [q('M-2')], new Set(['M-2']))).toBeNull()
    expect(elegirVerificacion(base, [q('C-1', { competencia: 'C1' })], new Set())).toBeNull()
  })
})

describe('diagnostico.perfilDiagnostico', () => {
  it('clasifica niveles con los umbrales de Refuerzo', () => {
    expect(nivelCompetencia(null, 0)).toBe('sin_datos'); expect(nivelCompetencia(50, 1)).toBe('sin_datos')
    expect(nivelCompetencia(59, 5)).toBe('floja'); expect(nivelCompetencia(60, 5)).toBe('proceso'); expect(nivelCompetencia(75, 5)).toBe('fuerte')
  })
  it('las prioridades empiezan por las flojas y ponderan la carrera', () => {
    const intentos = [
      ...[1, 0, 0, 0].map(c => it_({ competencia: 'M1', prueba: 'matematicas', correcta: !!c })),
      ...[1, 0, 0, 0].map(c => it_({ competencia: 'LC1', prueba: 'lectura_critica', correcta: !!c })),
      ...[1, 1, 1, 1].map(c => it_({ competencia: 'C1', prueba: 'ciencias_naturales', correcta: !!c })),
    ]
    const p = perfilDiagnostico(intentos, { prioridadesCarrera: [{ prueba: 'lectura_critica', nivel: 'alta' }] })
    expect(p.prioridades[0].id).toBe('LC1') // misma precisión que M1 pero pesa para la carrera
    expect(p.prioridades[1].id).toBe('M1')
    expect(p.prioridades.map(x => x.id)).not.toContain('C1')
    expect(p.conteo.flojas).toBe(2); expect(p.conteo.fuertes).toBe(1)
    expect(p.pruebas.find(x => x.id === 'ciencias_naturales').nivel).toBe('fuerte')
  })
  it('sin intentos todo queda por evaluar', () => {
    const p = perfilDiagnostico([])
    expect(p.conteo.sin_datos).toBe(14); expect(p.prioridades.length).toBe(3)
  })
})

describe('aprendizaje.medirAprendizaje', () => {
  it('superado solo con preguntas NUEVAS correctas después del error', () => {
    const intentos = [
      it_({ pregunta_id: 'A', correcta: false, tipo_error: 'calculo', fecha: '2026-10-01T10:00:00Z' }),
      it_({ pregunta_id: 'A', correcta: true, fecha: '2026-10-01T10:05:00Z' }), // repetir la misma no cuenta
      it_({ pregunta_id: 'B', correcta: true, fecha: '2026-10-02T10:00:00Z', modo: 'verificacion' }),
      it_({ pregunta_id: 'C', correcta: true, fecha: '2026-10-03T10:00:00Z' }),
    ]
    const m = medirAprendizaje(intentos)
    const c = m.competencias.find(x => x.id === 'M1')
    expect(c.nuevosDespues).toBe(2); expect(c.estado).toBe('superado')
    expect(m.verificaciones).toEqual({ total: 1, correctas: 1, pct: 100 })
  })
  it('sin preguntas nuevas después del error queda sin verificar; con fallos, en proceso', () => {
    const a = medirAprendizaje([it_({ pregunta_id: 'A', correcta: false }), it_({ pregunta_id: 'A', correcta: true, fecha: '2026-10-02T10:00:00Z' })])
    expect(a.competencias[0].estado).toBe('sin_verificar')
    const b = medirAprendizaje([it_({ pregunta_id: 'A', correcta: false }), it_({ pregunta_id: 'B', correcta: false, fecha: '2026-10-02T10:00:00Z' }), it_({ pregunta_id: 'C', correcta: true, fecha: '2026-10-03T10:00:00Z' })])
    expect(b.competencias[0].estado).toBe('en_proceso')
  })
  it('constancia cuenta días activos y racha', () => {
    const hoy = new Date('2026-10-14T15:00:00')
    const d = (n, h = 10) => new Date(2026, 9, n, h).toISOString()
    const c = constancia([it_({ fecha: d(14) }), it_({ fecha: d(13) }), it_({ fecha: d(12) }), it_({ fecha: d(1) })], hoy)
    expect(c.racha).toBe(3); expect(c.ultimos_7).toBe(3); expect(c.ultimos_30).toBe(4); expect(c.hoy).toBe(true)
    const sinHoy = constancia([it_({ fecha: d(13) }), it_({ fecha: d(12) })], hoy)
    expect(sinHoy.racha).toBe(2); expect(sinHoy.hoy).toBe(false)
  })
})

describe('ruta.planSemana', () => {
  const hoy = new Date('2026-10-14T09:00:00') // miércoles
  const perfil = perfilDiagnostico([
    ...[0, 0, 1, 0].map(c => it_({ competencia: 'M1', correcta: !!c })),
    ...[0, 0, 1, 0].map(c => it_({ competencia: 'LC2', prueba: 'lectura_critica', correcta: !!c })),
    ...[0, 1, 1, 0].map(c => it_({ competencia: 'S1', prueba: 'sociales_ciudadanas', correcta: !!c })),
  ])
  it('normaliza la configuración dentro de los límites', () => {
    const c = normalizarConfig({ grado: 12, minutos_dia: 5, dias_semana: 9, meta_global: 900 }, { fecha_examen: '2027-03-14' })
    expect(c).toMatchObject({ grado: 11, minutos_dia: 15, dias_semana: 7, meta_global: 500, fecha_examen: '2027-03-14' })
    expect(diasDeEstudio(3)).toEqual([0, 2, 4]); expect(preguntasPorSesion(30)).toBe(10); expect(preguntasPorSesion(15)).toBe(4)
  })
  it('sin diagnóstico ni datos, la primera sesión es la prueba diagnóstica', () => {
    const p = planSemana({ config: { minutos_dia: 30, dias_semana: 5, fecha_examen: '2027-03-14' }, perfil: perfilDiagnostico([]), hoy })
    expect(p.sin_datos).toBe(true)
    expect(p.dias.filter(d => !d.descanso)[0].tipo).toBe('diagnostico')
    expect(p.dias.length).toBe(7); expect(p.resumen.planeadas).toBe(5)
  })
  it('con perfil, las sesiones practican las prioridades, repasan errores y el último día hay simulacro o práctica', () => {
    const p = planSemana({ config: { minutos_dia: 30, dias_semana: 5, fecha_examen: '2027-03-14' }, perfil, hayDiagnostico: true, erroresPendientes: ['A', 'B', 'C'], hoy })
    const tipos = p.dias.filter(d => !d.descanso).map(d => d.tipo)
    expect(tipos[0]).toBe('practica'); expect(p.dias[0].competencia).toBe(p.objetivos[0].competencia)
    expect(tipos[2]).toBe('errores')
    expect(['simulacro', 'practica', 'mini']).toContain(tipos[4])
    expect(p.objetivos.length).toBe(3); expect(new Set(p.objetivos.map(o => o.competencia))).toEqual(new Set(['M1', 'LC2', 'S1']))
    expect(p.hoy.fecha).toBe('2026-10-14'); expect(p.semana.inicio).toBe('2026-10-12')
    expect(p.dias_restantes).toBe(151)
  })
  it('marca como hecha la práctica del día con los intentos de esa competencia y la mini-prueba con la sesión', () => {
    const lunes = lunesDe(hoy)
    const f = (d, h = 10) => new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + d, h).toISOString()
    const intentos = Array.from({ length: 5 }, () => it_({ competencia: perfil.prioridades[0].id, fecha: f(0) }))
    const sesiones = [{ tipo: 'mini', estado: 'terminada', fecha_fin: f(3), config: {} }]
    const p = planSemana({ config: { minutos_dia: 30, dias_semana: 5, fecha_examen: '2027-03-14' }, perfil, hayDiagnostico: true, intentos, sesiones, hoy })
    expect(p.dias[0].hecho).toBe(true); expect(p.dias[1].hecho).toBe(false)
    if (p.dias[3].tipo === 'mini') expect(p.dias[3].hecho).toBe(true)
    expect(p.resumen.hechas).toBeGreaterThanOrEqual(1)
  })
  it('la meta calcula brecha y puntos por semana', () => {
    const p = planSemana({ config: { meta_global: 320, fecha_examen: '2027-03-14' }, perfil, hayDiagnostico: true, puntajeActual: 260, hoy })
    expect(p.meta.brecha).toBe(60); expect(p.meta.semanas_restantes).toBe(22); expect(p.meta.puntos_por_semana).toBe(2.7)
  })
  it('en la recta final (≤ 6 semanas) con tiempo suficiente, el último día de estudio es simulacro', () => {
    const p = planSemana({ config: { minutos_dia: 45, dias_semana: 5, fecha_examen: '2026-11-08' }, perfil, hayDiagnostico: true, hoy })
    expect(p.recta_final).toBe(true)
    expect(p.dias.filter(d => !d.descanso).at(-1).tipo).toBe('simulacro')
  })
})
