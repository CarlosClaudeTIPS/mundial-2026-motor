import { useSyncExternalStore } from 'react'
import { db, ahora } from './db'
import { supabase, NUBE_DISPONIBLE } from './supabase'

// ─── Sincronización local → nube ─────────────────────────────────────────────
// Cola de cambios (tabla `cola`). Cuando hay conexión y sesión de Supabase,
// se envían en orden con upsert. Si falla, se reintenta más tarde. Los
// registros conservan su `uid`/`id` generado en el dispositivo, así que
// reenviar no duplica.
//
// Limitaciones (documentadas en docs/03-arquitectura.md):
//  - Sin resolución de conflictos: gana la última escritura (los intentos nunca
//    se editan desde dos dispositivos, así que en la práctica no hay conflicto).
//  - Lo que otros dispositivos escriben solo se ve al recargar datos del grupo.
//  - Los datos locales de un celular compartido son visibles para quien lo use;
//    por eso cada estudiante tiene PIN y se puede cerrar sesión.

let estado = { enLinea: typeof navigator !== 'undefined' ? navigator.onLine : true, pendientes: 0, sincronizando: false, ultimo: null, error: null }
const subs = new Set()
const emitir = () => subs.forEach(f => f())
const set = (p) => { estado = { ...estado, ...p }; emitir() }

export function useSync() {
  return useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f) }, () => estado)
}

export async function contarPendientes() {
  if (!NUBE_DISPONIBLE) await db.cola.clear() // sin nube no hay nada que enviar
  const n = await db.cola.count()
  set({ pendientes: n })
  return n
}

const TABLAS = { intentos: 'uid', usuarios: 'id', grupos: 'id', asignaciones: 'id', sesiones: 'id', recursos: 'id' }

export async function sincronizar() {
  await contarPendientes()
  if (!NUBE_DISPONIBLE || !estado.enLinea || estado.sincronizando) return
  const { data } = await supabase.auth.getSession()
  if (!data.session) return
  set({ sincronizando: true, error: null })
  try {
    const cola = await db.cola.orderBy('id').toArray()
    for (const item of cola) {
      const clave = TABLAS[item.tabla]
      if (!clave) { await db.cola.delete(item.id); continue }
      const fila = aFilaNube(item.tabla, item.datos)
      const { error } = await supabase.from(item.tabla).upsert(fila, { onConflict: clave })
      if (error) throw new Error(`${item.tabla}: ${error.message}`)
      await db.cola.delete(item.id)
      if (item.tabla === 'intentos') await db.intentos.update(item.datos.uid, { sincronizado: 1 })
    }
    set({ ultimo: ahora() })
  } catch (e) {
    set({ error: e.message })
  } finally {
    set({ sincronizando: false })
    await contarPendientes()
  }
}

// Campos que no van a la nube o que cambian de forma.
function aFilaNube(tabla, d) {
  const { sincronizado, semilla, ...resto } = d
  if (tabla === 'usuarios') { const { pin_hash, ...u } = resto; return u }
  return resto
}

// Descarga datos de la nube para el usuario actual (grupo del estudiante o grupos del docente).
export async function descargarDeNube(usuario) {
  if (!NUBE_DISPONIBLE || !estado.enLinea || !usuario) return
  try {
    if (usuario.rol === 'estudiante') {
      const { data: asig } = await supabase.from('asignaciones').select('*').eq('grupo_id', usuario.grupo_id ?? '')
      if (asig) await db.asignaciones.bulkPut(asig.map(a => ({ ...a, sincronizado: 1 })))
    } else {
      const { data: grupos } = await supabase.from('grupos').select('*')
      if (grupos) await db.grupos.bulkPut(grupos.map(g => ({ ...g, sincronizado: 1 })))
      const { data: usuarios } = await supabase.from('perfiles').select('*')
      if (usuarios) await db.usuarios.bulkPut(usuarios.map(u => ({ ...u, sincronizado: 1 })))
      const { data: intentos } = await supabase.from('intentos').select('*')
      if (intentos) await db.intentos.bulkPut(intentos.map(i => ({ ...i, sincronizado: 1 })))
      const { data: sesiones } = await supabase.from('sesiones').select('*')
      if (sesiones) await db.sesiones.bulkPut(sesiones.map(s => ({ ...s, sincronizado: 1 })))
    }
    const { data: recursos } = await supabase.from('recursos').select('*')
    if (recursos) await db.recursos.bulkPut(recursos.map(r => ({ ...r, sincronizado: 1 })))
  } catch (e) {
    set({ error: e.message })
  }
}

export function iniciarSync() {
  if (typeof window === 'undefined') return
  window.addEventListener('online', () => { set({ enLinea: true }); sincronizar() })
  window.addEventListener('offline', () => set({ enLinea: false }))
  contarPendientes()
  sincronizar()
  setInterval(sincronizar, 60_000)
}
