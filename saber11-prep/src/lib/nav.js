import { useSyncExternalStore } from 'react'

// Enrutador mínimo por hash: #/ruta?a=1&b=2  → { ruta: 'ruta', params: {a:'1', b:'2'} }
function leer() {
  const h = (window.location.hash || '#/').slice(1)
  const [camino, qs] = h.split('?')
  const ruta = camino.replace(/^\/+/, '') || 'inicio'
  const params = Object.fromEntries(new URLSearchParams(qs || ''))
  return { ruta, params, clave: h }
}

let actual = leer()
const subs = new Set()
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => { actual = leer(); subs.forEach(f => f()) })
}

export function useRuta() {
  return useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f) }, () => actual)
}

export function ir(ruta, params = {}) {
  const limpio = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  const qs = new URLSearchParams(limpio).toString()
  window.location.hash = `#/${ruta}${qs ? '?' + qs : ''}`
}

export function atras() { window.history.back() }
