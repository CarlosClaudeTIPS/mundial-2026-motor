import { useState, useEffect, useCallback } from 'react'
import { NUBE_DISPONIBLE, getSesion, onSesion, sincronizarClave, subirConCalma } from '../../lib/nube'

const STORAGE_KEY = 'bankroll_tracker_v1'
const TS_KEY = 'bankroll_tracker_v1_ts' // cuándo cambió por última vez (para el merge)

const DEFAULT_STATE = {
  apuestas: [],
  configuracion: {
    bank_inicial: 1000000,
    apuesta_maxima: 25000,
    max_dia: 4,
    max_perdidas_consecutivas: 2,
    meta_diaria_min: 40000, // objetivo del día: piso
    meta_diaria_max: 60000, // objetivo del día: techo → hora de parar
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
  try { localStorage.setItem(TS_KEY, String(Date.now())) } catch {}
}

function hoy() {
  return new Date().toISOString().slice(0, 10)
}

export function useBankroll() {
  const [state, setState] = useState(load)
  const [sincronizado, setSincronizado] = useState(false)

  useEffect(() => {
    save(state)
    // Con sesión activa: cada cambio se sube a la nube (debounce 2 s)
    if (NUBE_DISPONIBLE && sincronizado) subirConCalma(STORAGE_KEY, state)
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Al iniciar sesión (o al abrir la app con sesión guardada): merge ──
  // Gana el estado COMPLETO más reciente entre este dispositivo y la nube.
  useEffect(() => {
    if (!NUBE_DISPONIBLE) return
    let vivo = true
    const sync = async () => {
      const s = await getSesion()
      if (!s || !vivo) { setSincronizado(false); return }
      const localTs = Number(localStorage.getItem(TS_KEY)) || null
      const r = await sincronizarClave(STORAGE_KEY, load(), localTs)
      if (!vivo) return
      if (r.origen === 'nube' && r.data) setState({ ...DEFAULT_STATE, ...r.data })
      setSincronizado(true)
    }
    sync()
    const off = onSesion(() => sync())
    return () => { vivo = false; off() }
  }, [])

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
      // Ganada: solo se suma la GANANCIA NETA (pago total − lo apostado), porque
      // el monto apostado nunca se descontó del bank al registrar la apuesta.
      // Sumar el pago completo contaría tu propia plata como ganancia (bug).
      if (a.resultado === 'ganada') return acc + ((a.ganancia_real ?? 0) - a.monto)
      if (a.resultado === 'perdida') return acc - a.monto
      return acc // pendiente / devuelta: sin efecto en el bank
    }, configuracion.bank_inicial)
  }, [state])

  const apuestasHoy = useCallback(() => {
    return state.apuestas.filter(a => a.fecha === hoy() && a.resultado !== 'devuelta')
  }, [state])

  // Ganancia NETA de hoy (solo apuestas ya resueltas de la fecha de hoy)
  const gananciaHoy = useCallback(() => {
    return state.apuestas
      .filter(a => a.fecha === hoy())
      .reduce((acc, a) => {
        if (a.resultado === 'ganada') return acc + ((a.ganancia_real ?? 0) - a.monto)
        if (a.resultado === 'perdida') return acc - a.monto
        return acc
      }, 0)
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

  // Guardar cambios de configuración (metas, límites) sin tocar el resto
  function guardarConfig(parcial) {
    setState(s => ({ ...s, configuracion: { ...s.configuracion, ...parcial } }))
  }

  return {
    state,
    bankActual: bankActual(),
    apuestasHoy: apuestasHoy(),
    gananciaHoy: gananciaHoy(),
    perdidasConsecutivas: perdidasConsecutivas(),
    guardarConfig,
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
