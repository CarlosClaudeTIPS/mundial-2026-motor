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
