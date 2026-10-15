// ─── Portal: las tres secciones de la casa (ICFES, Apoyo docente, Tienda) ───
// Esta app es la sección «ICFES». Desde su inicio se enlazan las otras dos.
//
// Dónde viven las otras secciones:
//  - Si la app está publicada DENTRO del portal (carpeta icfes/), los enlaces
//    son relativos (../docentes/, ../tienda/) y funcionan solos.
//  - Si la app está en su propio dominio (saber11-prep.vercel.app), se usa
//    VITE_PORTAL_URL (la dirección del portal). Si no está definida, se
//    enlaza a la portada del portal de vista previa.
const PORTAL_URL = (import.meta.env.VITE_PORTAL_URL || 'https://claude.ai/artifact/KtjAKB8wc9KLYsSEbMDA1m').replace(/\/+$/, '')

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
  if (dentroDelPortal()) return urlPortal() + s.carpeta
  // Con un dominio propio del portal, el enlace va directo a la sección.
  // Con la vista previa (claude.ai) solo se puede abrir la portada.
  return /claude\.ai\/artifact/.test(PORTAL_URL) ? urlPortal() : urlPortal() + s.carpeta
}
