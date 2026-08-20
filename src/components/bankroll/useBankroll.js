import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'bankroll_tracker_v1'

const DEFAULT_STATE = {
  apuestas: [],
  configuracion: {
    bank_inicial: 1000000,
    apuesta_maxima: 25000,
    max_dia: 4,
    max_perdidas_consecutivas: 2,
  },
  bloqueo: { activo: false, hasta: null, nivel: 0, motivo: '' },
  violaciones: [],
  modo_roto: false,
  modo_roto_hasta: null,
  onboarding_completo: false,
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : DEFAULT_STATE
  } catch {
    return DEFAULT_STATE
  }
}

function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function hoy() {
  return new Date().toISOString().slice(0, 10)
}

export function useBankroll() {
  const [state, setState] = useState(load)

  useEffect(() => { save(state) }, [state])

  // Desbloquear automáticamente si ya pasó el tiempo
  useEffect(() => {
    const { bloqueo, modo_roto, modo_roto_hasta } = state
    const ahora = Date.now()
    if (bloqueo.activo && bloqueo.hasta && ahora > bloqueo.hasta) {
      setState(s => ({ ...s, bloqueo: { activo: false, hasta: null, nivel: 0, motivo: '' } }))
    }
    if (modo_roto && modo_roto_hasta && ahora > modo_roto_hasta) {
      setState(s => ({ ...s, modo_roto: false, modo_roto_hasta: null }))
    }
  })

  const bankActual = useCallback(() => {
    const { apuestas, configuracion } = state
    return apuestas.reduce((acc, a) => {
      if (a.resultado === 'ganada') return acc + (a.ganancia_real ?? 0)
      if (a.resultado === 'perdida') return acc - a.monto
      return acc
    }, configuracion.bank_inicial)
  }, [state])

  const apuestasHoy = useCallback(() => {
    return state.apuestas.filter(a => a.fecha === hoy() && a.resultado !== 'devuelta')
  }, [state])

  const perdidasConsecutivas = useCallback(() => {
    const resueltas = state.apuestas.filter(a => a.resultado === 'ganada' || a.resultado === 'perdida')
    let count = 0
    for (let i = resueltas.length - 1; i >= 0; i--) {
      if (resueltas[i].resultado === 'perdida') count++
      else break
    }
    return count
  }, [state])

  function validarApuesta(monto) {
    const { configuracion } = state
    const banco = bankActual()
    const hoyApuestas = apuestasHoy()
    const perdidas = perdidasConsecutivas()

    if (monto > configuracion.apuesta_maxima) {
      return { ok: false, regla: 1, msg: `El monto $${monto.toLocaleString('es-CO')} supera el máximo de $${configuracion.apuesta_maxima.toLocaleString('es-CO')}` }
    }
    if (hoyApuestas.length >= configuracion.max_dia) {
      return { ok: false, regla: 2, msg: `Ya tienes ${hoyApuestas.length} apuestas hoy. Máximo ${configuracion.max_dia} por día.` }
    }
    if (perdidas >= configuracion.max_perdidas_consecutivas) {
      return { ok: false, regla: 3, msg: `Llevas ${perdidas} pérdidas consecutivas. Regla: máximo ${configuracion.max_perdidas_consecutivas}.` }
    }
    if (monto > banco) {
      return { ok: false, regla: 4, msg: `Saldo insuficiente. Tienes $${banco.toLocaleString('es-CO')}` }
    }
    return { ok: true }
  }

  function aplicarConsecuencia(regla, msg) {
    const violacion = { id: Date.now(), fecha: new Date().toISOString(), regla, msg }
    const violacionesHoy = state.violaciones.filter(v => v.fecha.slice(0, 10) === hoy())
    const nivel = violacionesHoy.length + 1

    let nuevoBloqueoo = state.bloqueo
    let modoRoto = state.modo_roto
    let modoRotoHasta = state.modo_roto_hasta

    if (nivel === 1) {
      // Solo advertencia — se maneja en UI, no bloqueamos aún
    } else if (nivel === 2) {
      nuevoBloqueoo = { activo: true, hasta: Date.now() + 2 * 60 * 60 * 1000, nivel: 2, motivo: msg }
    } else {
      nuevoBloqueoo = { activo: true, hasta: Date.now() + 24 * 60 * 60 * 1000, nivel: 3, motivo: msg }
      modoRoto = true
      modoRotoHasta = Date.now() + 24 * 60 * 60 * 1000
    }

    setState(s => ({
      ...s,
      violaciones: [...s.violaciones, violacion],
      bloqueo: nuevoBloqueoo,
      modo_roto: modoRoto,
      modo_roto_hasta: modoRotoHasta,
    }))

    return nivel
  }

  function agregarApuesta(datos) {
    const apuesta = {
      id: Date.now().toString(),
      fecha: hoy(),
      created_at: new Date().toISOString(),
      resultado: 'pendiente',
      ganancia_real: 0,
      ...datos,
    }
    setState(s => ({ ...s, apuestas: [...s.apuestas, apuesta] }))
    return apuesta
  }

  function actualizarResultado(id, resultado) {
    setState(s => ({
      ...s,
      apuestas: s.apuestas.map(a => {
        if (a.id !== id) return a
        let ganancia_real = 0
        if (resultado === 'ganada') ganancia_real = Math.round(a.monto * a.cuota)
        if (resultado === 'devuelta') ganancia_real = a.monto
        return { ...a, resultado, ganancia_real }
      }),
    }))
  }

  function eliminarApuesta(id) {
    setState(s => ({ ...s, apuestas: s.apuestas.filter(a => a.id !== id) }))
  }

  function completarOnboarding(config) {
    setState(s => ({ ...s, configuracion: { ...s.configuracion, ...config }, onboarding_completo: true }))
  }

  function resetearTodo() {
    setState(DEFAULT_STATE)
  }

  return {
    state,
    bankActual: bankActual(),
    apuestasHoy: apuestasHoy(),
    perdidasConsecutivas: perdidasConsecutivas(),
    validarApuesta,
    aplicarConsecuencia,
    agregarApuesta,
    actualizarResultado,
    eliminarApuesta,
    completarOnboarding,
    resetearTodo,
    hoy: hoy(),
  }
}
