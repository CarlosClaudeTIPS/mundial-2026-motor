import { describe, it, expect } from 'vitest'
import { evaluar, razonesPosibles } from '../src/lib/feedback'
import { recomendar, REGLAS_POR_DEFECTO } from '../src/lib/reglas'
import { resumen, resumenGrupo, estadisticasPreguntas } from '../src/lib/analitica'
import { estadoCiclo } from '../src/lib/ciclo'
import programa from '../content/programa.json'

const pregunta = {
  id: 'T-1', prueba: 'matematicas', competencia: 'M1', habilidad: 'interpretar', dificultad: 2, tiempo_sugerido_seg: 100,
  refuerzo_ids: ['T-2'],
  opciones: [
    { clave: 'A', texto: 'a', correcta: false, explicacion: 'x', tipo_error: 'lectura_grafico', diagnostico: 'probable', razon_frecuente: 'Leyó otra barra' },
    { clave: 'B', texto: 'b', correcta: true, explicacion: 'ok', tipo_error: null, diagnostico: null },
    { clave: 'C', texto: 'c', correcta: false, explicacion: 'y', tipo_error: 'calculo', diagnostico: 'insuficiente' },
  ],
  explicacion: 'porque sí', que_identificar: 'el dato', que_revisar: 'gráficos',
}

describe('feedback.evaluar', () => {
  it('reconoce la correcta y no asigna error', () => {
    const ev = evaluar(pregunta, 'B', { tiempoSeg: 50 })
    expect(ev.esCorrecta).toBe(true)
    expect(ev.tipoError).toBeNull()
    expect(ev.lento).toBe(false)
  })
  it('marca lentitud cuando supera 1,6× el tiempo sugerido', () => {
    expect(evaluar(pregunta, 'B', { tiempoSeg: 170 }).lento).toBe(true)
  })
  it('usa el diagnóstico del banco para un distractor', () => {
    const ev = evaluar(pregunta, 'A')
    expect(ev.tipoError).toBe('lectura_grafico')
    expect(ev.diagnostico).toBe('probable')
    expect(evaluar(pregunta, 'C').diagnostico).toBe('insuficiente')
  })
  it('confirma cuando la razón del estudiante coincide y reasigna cuando no', () => {
    expect(evaluar(pregunta, 'A', { razon: { tipo_error: 'lectura_grafico' } }).diagnostico).toBe('confirmado')
    const otro = evaluar(pregunta, 'A', { razon: { tipo_error: 'descuido' } })
    expect(otro.tipoError).toBe('descuido')
    expect(otro.diagnostico).toBe('confirmado')
  })
  it('sin responder = tiempo, insuficiente', () => {
    const ev = evaluar(pregunta, null)
    expect(ev.tipoError).toBe('tiempo')
    expect(ev.diagnostico).toBe('insuficiente')
  })
  it('la primera razón posible es la frecuente del distractor', () => {
    expect(razonesPosibles(pregunta, pregunta.opciones[0])[0].tipo_error).toBe('lectura_grafico')
  })
})

const intento = (over) => ({ estudiante_id: 'e1', pregunta_id: 'T-1', prueba: 'matematicas', competencia: 'M1', habilidad: 'interpretar', correcta: false, tiempo_seg: 60, lento: false, tipo_error: 'lectura_grafico', diagnostico: 'probable', fecha: '2026-09-20T10:00:00Z', ...over })

describe('reglas.recomendar', () => {
  it('detecta error repetido y propone la práctica asociada', () => {
    const recs = recomendar([intento({}), intento({}), intento({})])
    expect(recs[0].regla).toBe('error_repetido')
    expect(recs[0].practica).toBe('representacion')
    expect(recs[0].accion.filtros.tipo_error).toBe('lectura_grafico')
  })
  it('sin datos devuelve recomendación de inicio', () => {
    expect(recomendar([])[0].regla).toBe('inicio')
  })
  it('respeta reglas desactivadas', () => {
    const reglas = REGLAS_POR_DEFECTO.map(r => ({ ...r, activa: r.id !== 'error_repetido' }))
    const recs = recomendar([intento({}), intento({}), intento({})], { reglas })
    expect(recs.some(r => r.regla === 'error_repetido')).toBe(false)
  })
  it('propone refuerzo pendiente cuando existe', () => {
    const recs = recomendar([intento({})], { preguntasPorId: { 'T-1': pregunta } })
    expect(recs.find(r => r.regla === 'refuerzo_pendiente').accion.ids).toEqual(['T-2'])
  })
})

describe('analitica', () => {
  it('resume precisión y errores por tipo', () => {
    const r = resumen([intento({}), intento({ correcta: true, tipo_error: null })])
    expect(r.precision).toBe(50)
    expect(r.por_tipo_error[0].id).toBe('lectura_grafico')
  })
  it('acciones del grupo distinguen pocos datos', () => {
    const g = resumenGrupo([{ id: 'e1', nombre: 'A' }], [intento({})])
    expect(g.acciones[0].tipo).toBe('info')
  })
  it('marca preguntas con dos opciones casi igual de elegidas', () => {
    const lista = []
    for (let i = 0; i < 10; i++) lista.push(intento({ opcion: i % 2 ? 'A' : 'C', correcta: false }))
    const est = estadisticasPreguntas(lista, { 'T-1': pregunta })
    expect(est[0].revisar).toBe(true)
  })
})

describe('ciclo.estadoCiclo', () => {
  const ciclo = { fecha_inicio: '2026-09-27', fecha_examen: '2027-03-14' }
  it('calcula semana y fase', () => {
    const e = estadoCiclo(ciclo, programa, new Date('2026-10-20T12:00:00'))
    expect(e.semanaActual).toBe(4)
    expect(e.fase.id).toBe('F2')
    expect(e.estado).toBe('en_curso')
  })
  it('descuenta las semanas de pausa y marca el estado en pausa', () => {
    const conPausa = { ...ciclo, pausas: [{ nombre: 'Vacaciones', inicio: '2026-12-18', fin: '2027-01-10' }] }
    const sin = estadoCiclo(ciclo, programa, new Date('2027-02-01T12:00:00'))
    const con = estadoCiclo(conPausa, programa, new Date('2027-02-01T12:00:00'))
    expect(con.semanasTotales).toBeLessThan(sin.semanasTotales)
    expect(con.semanaActual).toBeLessThan(sin.semanaActual)
    const enPausa = estadoCiclo(conPausa, programa, new Date('2026-12-28T12:00:00'))
    expect(enPausa.estado).toBe('pausa')
    expect(enPausa.pausaActual).toBe('Vacaciones')
  })
  it('detecta ciclo no iniciado y día del examen', () => {
    expect(estadoCiclo(ciclo, programa, new Date('2026-09-01T12:00:00')).estado).toBe('no_iniciado')
    expect(estadoCiclo(ciclo, programa, new Date('2027-03-14T12:00:00')).estado).toBe('dia_examen')
  })
})

// ─── Modo carrera ────────────────────────────────────────────────────────────
import { prioridadesDe, mezclaPorPrueba, horasPorPrueba, CARRERAS, PRUEBAS } from '../src/lib/carreras'

describe('carreras.prioridadesDe', () => {
  it('sin carreras todas las pruebas son base y reparten igual', () => {
    const p = prioridadesDe([])
    expect(p).toHaveLength(5)
    expect(p.every(x => x.nivel === 'base')).toBe(true)
    expect(p.every(x => Math.abs(x.proporcion - 0.2) < 1e-9)).toBe(true)
  })
  it('medicina pone ciencias naturales de primera y en prioridad alta', () => {
    const p = prioridadesDe(['medicina'])
    expect(p[0].prueba).toBe('ciencias_naturales')
    expect(p[0].nivel).toBe('alta')
    expect(p.find(x => x.prueba === 'lectura_critica').nivel).toBe('media')
    expect(p.find(x => x.prueba === 'sociales_ciudadanas').nivel).toBe('base')
  })
  it('con carreras muy distintas las prioridades se aplanan pero conservan orden', () => {
    const p = prioridadesDe(['medicina', 'ing_sistemas', 'derecho'])
    expect(['lectura_critica', 'matematicas']).toContain(p[0].prueba)
    expect(p.filter(x => x.nivel === 'alta').length).toBeLessThan(5)
  })
  it('ninguna materia queda sin práctica: la proporción mínima es positiva', () => {
    const p = prioridadesDe(['ing_sistemas', 'derecho', 'medicina'])
    expect(Math.min(...p.map(x => x.proporcion))).toBeGreaterThan(0.1)
    expect(Math.abs(p.reduce((a, x) => a + x.proporcion, 0) - 1)).toBeLessThan(1e-9)
  })
  it('ignora ids desconocidos', () => {
    expect(prioridadesDe(['no_existe'])).toEqual(prioridadesDe([]))
  })
  it('el catálogo tiene pesos 1-3 para las cinco pruebas en cada carrera', () => {
    for (const c of CARRERAS) for (const pr of PRUEBAS) expect([1, 2, 3]).toContain(c.pesos[pr])
    expect(new Set(CARRERAS.map(c => c.id)).size).toBe(CARRERAS.length)
  })
})

describe('carreras.mezclaPorPrueba', () => {
  it('reparte exactamente n y da al menos 1 por prueba cuando n ≥ 5', () => {
    const r = mezclaPorPrueba(prioridadesDe(['medicina']), 10)
    expect(Object.values(r).reduce((a, b) => a + b, 0)).toBe(10)
    expect(Object.values(r).every(k => k >= 1)).toBe(true)
    expect(r.ciencias_naturales).toBeGreaterThan(r.sociales_ciudadanas)
  })
  it('con pocas preguntas prioriza las de mayor peso sin pasarse de n', () => {
    const r = mezclaPorPrueba(prioridadesDe(['derecho']), 3)
    expect(Object.values(r).reduce((a, b) => a + b, 0)).toBe(3)
    expect(r.lectura_critica + r.sociales_ciudadanas).toBeGreaterThanOrEqual(2)
  })
  it('las horas suman aproximadamente las de la semana', () => {
    const h = horasPorPrueba(prioridadesDe(['ing_civil']), 3)
    expect(Math.abs(h.reduce((a, x) => a + x.minutos, 0) - 180)).toBeLessThanOrEqual(15)
    expect(h[0].minutos).toBeGreaterThan(h[h.length - 1].minutos)
  })
})

// ─── Plan de acceso por grupo ────────────────────────────────────────────────
import { estadoLiberacion, mesesTranscurridos, fechaLote } from '../src/lib/acceso'

const bancoFicticio = () => {
  const out = []
  for (const prueba of ['lectura_critica', 'matematicas', 'sociales_ciudadanas', 'ciencias_naturales', 'ingles']) {
    for (let i = 1; i <= 50; i++) out.push({ id: `${prueba.slice(0, 3).toUpperCase()}-${String(i).padStart(3, '0')}`, prueba, estado: 'aprobada', origen: i > 45 ? 'oficial' : 'estilo' })
  }
  return out
}

describe('acceso.mesesTranscurridos', () => {
  it('cuenta meses completos', () => {
    expect(mesesTranscurridos('2026-10-15', new Date('2026-10-20'))).toBe(0)
    expect(mesesTranscurridos('2026-10-15', new Date('2026-11-14'))).toBe(0)
    expect(mesesTranscurridos('2026-10-15', new Date('2026-11-15'))).toBe(1)
    expect(mesesTranscurridos('2026-10-15', new Date('2027-01-16'))).toBe(3)
  })
  it('fechaLote respeta el día y los meses cortos', () => {
    expect(fechaLote('2026-01-31', 2).getMonth()).toBe(1) // febrero
    expect(fechaLote('2026-01-31', 2).getDate()).toBe(28)
  })
})

describe('acceso.estadoLiberacion', () => {
  it('plan completo no restringe', () => {
    expect(estadoLiberacion(bancoFicticio(), { plan: 'completo' })).toBeNull()
    expect(estadoLiberacion(bancoFicticio(), null)).toBeNull()
  })
  it('primer mes libera el lote por asignatura (20 de prueba) y las propias antes que las oficiales', () => {
    const e = estadoLiberacion(bancoFicticio(), { plan: 'mensual', plan_inicio: '2026-10-01', plan_lote: 20 }, new Date('2026-10-05'))
    expect(e.liberadas.size).toBe(100)
    expect(e.nuevas.size).toBe(100)
    expect(e.lote_total).toBe(100)
    expect([...e.liberadas].filter(id => id.startsWith('MAT')).length).toBe(20)
    expect(e.liberadas.has('MAT-001')).toBe(true)
    expect(e.liberadas.has('MAT-046')).toBe(false)
    expect(e.proximo.toISOString().slice(0, 10)).toBe('2026-11-01')
  })
  it('el tercer mes acumula 300 y solo 100 son nuevas; lo anterior sigue liberado', () => {
    const grupo = { plan: 'mensual', plan_inicio: '2026-10-01', plan_lote: 20 }
    const e1 = estadoLiberacion(bancoFicticio(), grupo, new Date('2026-10-05'))
    const e3 = estadoLiberacion(bancoFicticio(), grupo, new Date('2026-12-05'))
    expect(e3.liberadas.size).toBe(250) // 50 por prueba es el máximo del banco ficticio
    expect([...e1.liberadas].every(id => e3.liberadas.has(id))).toBe(true)
    expect(e3.agotado).toBe(true)
    expect(e3.proximo).toBeNull()
  })
  it('con el lote por defecto (100 por asignatura) el primer mes libera hasta 500', () => {
    const e = estadoLiberacion(bancoFicticio(), { plan: 'mensual', plan_inicio: '2026-10-01' }, new Date('2026-10-05'))
    expect(e.lote_total).toBe(500)
    expect(e.liberadas.size).toBe(250) // el banco ficticio solo tiene 50 por prueba
  })
  it('agregar preguntas nuevas al banco no cambia lo ya liberado', () => {
    const grupo = { plan: 'mensual', plan_inicio: '2026-10-01', plan_lote: 20 }
    const antes = estadoLiberacion(bancoFicticio(), grupo, new Date('2026-10-05'))
    const mas = [...bancoFicticio(), ...[51, 52, 53].map(i => ({ id: `MAT-${i}`, prueba: 'matematicas', estado: 'aprobada', origen: 'estilo' }))]
    const despues = estadoLiberacion(mas, grupo, new Date('2026-10-05'))
    expect([...antes.liberadas].sort()).toEqual([...despues.liberadas].sort())
  })
})

// ─── Informes ────────────────────────────────────────────────────────────────
import { nivelDe, puntajeGlobal, percentilNacional, percentilLocal, informeEstudiante, informeGrupo, csvInformeGrupo } from '../src/lib/informes'

const intentoDe = (estudiante_id, pregunta_id, prueba, correcta, tipo_error = null) => ({ uid: `${estudiante_id}-${pregunta_id}`, estudiante_id, pregunta_id, prueba, competencia: 'X', correcta, tipo_error: correcta ? null : tipo_error, fecha: '2026-10-01T00:00:00Z' })
const preguntasInforme = { P1: { id: 'P1', prueba: 'matematicas', competencia: 'M1', afirmacion: 'Interpreta gráficas' }, P2: { id: 'P2', prueba: 'matematicas', competencia: 'M1', afirmacion: 'Interpreta gráficas' }, P3: { id: 'P3', prueba: 'matematicas', competencia: 'M2', afirmacion: 'Resuelve problemas' }, P4: { id: 'P4', prueba: 'lectura_critica', competencia: 'LC1', afirmacion: 'Contenidos locales' } }

describe('informes.niveles y escalas', () => {
  it('asigna niveles según los cortes', () => {
    expect(nivelDe('matematicas', 35)).toBe('1'); expect(nivelDe('matematicas', 36)).toBe('2'); expect(nivelDe('matematicas', 71)).toBe('4')
    expect(nivelDe('lectura_critica', 66)).toBe('4'); expect(nivelDe('ingles', 60)).toBe('A2'); expect(nivelDe('ingles', 90)).toBe('B+')
  })
  it('global con ponderación 3-3-3-3-1 en 0-500', () => {
    expect(puntajeGlobal({ lectura_critica: 50, matematicas: 50, sociales_ciudadanas: 50, ciencias_naturales: 50, ingles: 50 })).toBe(250)
    expect(puntajeGlobal({ lectura_critica: 100, matematicas: 100, sociales_ciudadanas: 100, ciencias_naturales: 100, ingles: 100 })).toBe(500)
    expect(puntajeGlobal({ matematicas: 60 })).toBe(300)
    expect(puntajeGlobal({})).toBeNull()
  })
  it('percentil nacional crece con el puntaje y la media queda cerca del 50', () => {
    expect(percentilNacional('global', 100)).toBeLessThan(5)
    expect(percentilNacional('global', 250)).toBeGreaterThan(40)
    expect(percentilNacional('global', 250)).toBeLessThan(60)
    expect(percentilNacional('global', 450)).toBeGreaterThan(99)
    expect(percentilNacional('matematicas', 80)).toBeGreaterThan(percentilNacional('matematicas', 50))
  })
  it('percentil local', () => {
    expect(percentilLocal(50, [10, 20, 30, 40, 50, 60, 70, 80, 90, 100])).toBe(45)
    expect(percentilLocal(50, [50])).toBeNull()
  })
})

describe('informes.informeEstudiante / informeGrupo', () => {
  const intentos = [intentoDe('E1', 'P1', 'matematicas', false, 'lectura_grafico'), intentoDe('E1', 'P2', 'matematicas', false, 'lectura_grafico'), intentoDe('E1', 'P3', 'matematicas', true), intentoDe('E1', 'P4', 'lectura_critica', true),
    intentoDe('E2', 'P1', 'matematicas', true), intentoDe('E2', 'P2', 'matematicas', true), intentoDe('E2', 'P3', 'matematicas', true), intentoDe('E2', 'P4', 'lectura_critica', false, 'comprension')]
  it('individual: puntajes, nivel, prioridades y fortalezas', () => {
    const inf = informeEstudiante({ intentos: intentos.filter(i => i.estudiante_id === 'E1'), preguntasPorId: preguntasInforme })
    const mat = inf.pruebas.find(p => p.prueba === 'matematicas')
    expect(mat.puntaje).toBe(33); expect(mat.nivel).toBe('1')
    expect(inf.global).toBe(Math.round(((33 * 3 + 100 * 3) / 6) * 5))
    expect(inf.mas_debil.prueba).toBe('matematicas')
    expect(inf.pruebas.find(p => p.prueba === 'ingles').puntaje).toBeNull()
    expect(inf.percentil_nacional).toBeGreaterThan(0)
  })
  it('grupo: medias, distribución de niveles, percentil local y CSV', () => {
    const inf = informeGrupo({ miembros: [{ id: 'E1', nombre: 'Ana', usuario: 'ana' }, { id: 'E2', nombre: 'Beto', usuario: 'beto' }, { id: 'E3', nombre: 'Cami', usuario: 'cami' }], intentos, preguntasPorId: preguntasInforme })
    expect(inf.n_activos).toBe(2)
    const mat = inf.pruebas.find(p => p.prueba === 'matematicas')
    expect(mat.media).toBe(67)
    expect(mat.distribucion_niveles.reduce((a, d) => a + d.n, 0)).toBe(2)
    expect(inf.estudiantes[0].nombre).toBe('Ana') // 333 global (lectura 100, mate 33) > Beto 250
    expect(inf.estudiantes.find(e => e.nombre === 'Ana').percentil_local).toBeGreaterThan(inf.estudiantes.find(e => e.nombre === 'Beto').percentil_local)
    expect(inf.estudiantes.find(e => e.nombre === 'Cami').global).toBeNull()
    expect(csvInformeGrupo(inf).split('\n')).toHaveLength(4)
  })
})
