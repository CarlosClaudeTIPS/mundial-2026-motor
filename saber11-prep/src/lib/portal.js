// ─── Portal: las tres secciones de la casa (ICFES, Apoyo docente, Tienda) ───
// Esta app es la sección «ICFES». Desde su inicio se enlazan las otras dos.
//
// Dónde viven las otras secciones: el portal (portada, Apoyo docente y Tienda)
// se publica como carpeta estática en /portal/ de este mismo sitio
// (public/portal/). VITE_PORTAL_URL permite moverlo a otro dominio.
const PORTAL_URL = (import.meta.env.VITE_PORTAL_URL || '/portal').replace(/\/+$/, '')

export const MARCA = import.meta.env.VITE_PORTAL_MARCA || 'Tu Marca'

export const SECCIONES = [
  { id: 'icfes', nombre: 'ICFES', carpeta: 'icfes/', color: '#2F4D8C', actual: true },
  { id: 'docentes', nombre: 'Apoyo docente', carpeta: 'docentes/', color: '#F4845F' },
  { id: 'tienda', nombre: 'Tienda', carpeta: 'tienda/', color: '#1E9E7A' },
]

function dentroDelPortal() {
  return typeof location !== 'undefined' && /\/icfes\//.test(location.pathname)
}

export function urlPortal() {
  if (dentroDelPortal()) return location.pathname.replace(/\/icfes\/.*$/, '/')
  return PORTAL_URL + '/'
}

export function urlSeccion(s) {
  if (s.actual) return null
  return urlPortal() + s.carpeta
}
