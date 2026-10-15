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

// tabla local → { tabla en Supabase, clave de conflicto }
const TABLAS = {
  intentos: { destino: 'intentos', clave: 'uid' },
  usuarios: { destino: 'perfiles', clave: 'id' },
  grupos: { destino: 'grupos', clave: 'id' },
  asignaciones: { destino: 'asignaciones', clave: 'id' },
  sesiones: { destino: 'sesiones', clave: 'id' },
  recursos: { destino: 'recursos', clave: 'id' },
  preguntas: { destino: 'preguntas', clave: 'id' },
  sesiones_docente: { destino: 'sesiones_docente', clave: 'id' },
}

export async function sincronizar() {
  await contarPendientes()
  if (!NUBE_DISPONIBLE || !estado.enLinea || estado.sincronizando) return
  const { data } = await supabase.auth.getSession()
  if (!data.session) return
  set({ sincronizando: true, error: null })
  try {
    const cola = await db.cola.orderBy('id').toArray()
    const fallos = []
    for (const item of cola) {
      const destino = TABLAS[item.tabla]
      if (!destino) { await db.cola.delete(item.id); continue }
      try {
        const fila = aFilaNube(item.tabla, item.datos)
        const { error } = await supabase.from(destino.destino).upsert(fila, { onConflict: destino.clave })
        if (error) {
          // Si la fila ya existe en la nube y la regla de seguridad no deja modificarla (por ejemplo, un
          // intento de otro estudiante reenviado desde la cuenta del docente), ya está subida: se descarta.
          if (/row-level security/i.test(error.message) && await existeEnNube(destino, fila)) { await db.cola.delete(item.id); continue }
          throw new Error(`${item.tabla}: ${error.message}`)
        }
        await db.cola.delete(item.id)
        if (item.tabla === 'intentos') await db.intentos.update(item.datos.uid, { sincronizado: 1 })
      } catch (e) {
        // Un cambio que falla no bloquea a los demás: se anota el error y se reintenta en la siguiente ronda.
        fallos.push(e.message)
        await db.cola.update(item.id, { error: e.message, fallos: (item.fallos ?? 0) + 1, ultimo_intento: ahora() })
      }
    }
    set({ ultimo: ahora(), error: fallos.length ? `${fallos.length} cambio(s) no se pudieron subir · ${fallos[0]}` : null })
  } catch (e) {
    set({ error: e.message })
  } finally {
    set({ sincronizando: false })
    await contarPendientes()
  }
}

async function existeEnNube(destino, fila) {
  const { data } = await supabase.from(destino.destino).select(destino.clave).eq(destino.clave, fila[destino.clave]).maybeSingle()
  return Boolean(data)
}

// Campos que no van a la nube o que cambian de forma.
function aFilaNube(tabla, d) {
  const { sincronizado, semilla, ...resto } = d
  if (tabla === 'usuarios') { const { pin_hash, demo, ruta_config, futuro, ...u } = resto; return u } // ruta_config y futuro viajan por sus funciones (migraciones 005 y 006)
  if (tabla === 'preguntas') { const { editada_local, fecha_carga, fecha_edicion, ...p } = resto; return { ...p, actualizado: fecha_edicion ?? ahora() } }
  if (tabla === 'recursos') { const { editado_local, ...r } = resto; return r }
  return resto
}

// Descarga datos de la nube para el usuario actual (grupo del estudiante o grupos del docente).
export async function descargarDeNube(usuario) {
  if (!NUBE_DISPONIBLE || !estado.enLinea || !usuario) return
  try {
    if (usuario.rol === 'estudiante') {
      if (usuario.grupo_id) {
        const { data: asig } = await supabase.from('asignaciones').select('*').eq('grupo_id', usuario.grupo_id)
        if (asig) await db.asignaciones.bulkPut(asig.map(a => ({ ...a, sincronizado: 1 })))
      }
      // Su propio historial (para verlo desde cualquier dispositivo). Solo se agrega
      // lo que no está en este dispositivo: lo local puede tener cambios sin enviar.
      const intentos = await todasLasFilas('intentos', q => q.eq('estudiante_id', usuario.id))
      const tengoI = new Set(await db.intentos.where('estudiante_id').equals(usuario.id).primaryKeys())
      await db.intentos.bulkPut(intentos.filter(i => !tengoI.has(i.uid)).map(i => ({ ...i, sincronizado: 1 })))
      const sesiones = await todasLasFilas('sesiones', q => q.eq('estudiante_id', usuario.id))
      const tengoS = new Set(await db.sesiones.where('estudiante_id').equals(usuario.id).primaryKeys())
      await db.sesiones.bulkPut(sesiones.filter(s => !tengoS.has(s.id)).map(s => ({ ...s, sincronizado: 1 })))
    } else {
      const { data: grupos } = await supabase.from('grupos').select('*')
      if (grupos) await db.grupos.bulkPut(grupos.map(g => ({ ...g, sincronizado: 1 })))
      const { data: usuarios } = await supabase.from('perfiles').select('*')
      if (usuarios) await db.usuarios.bulkPut(usuarios.map(u => ({ ...u, sincronizado: 1 })))
      const intentos = await todasLasFilas('intentos')
      await db.intentos.bulkPut(intentos.map(i => ({ ...i, sincronizado: 1 })))
      const sesiones = await todasLasFilas('sesiones')
      await db.sesiones.bulkPut(sesiones.map(s => ({ ...s, sincronizado: 1 })))
    }
    const { data: recursos } = await supabase.from('recursos').select('*')
    if (recursos) await db.recursos.bulkPut(recursos.map(r => ({ ...r, sincronizado: 1 })))
  } catch (e) {
    set({ error: e.message })
  } finally {
    set({ descargado: ahora() }) // las pantallas abiertas vuelven a leer
  }
}

// Supabase devuelve máximo 1000 filas por consulta: se lee por páginas.
async function todasLasFilas(tabla, filtrar = q => q) {
  const clave = TABLAS[tabla].clave, filas = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await filtrar(supabase.from(tabla).select('*')).order(clave).range(desde, desde + 999)
    if (error) throw new Error(`${tabla}: ${error.message}`)
    filas.push(...data)
    if (data.length < 1000) return filas
  }
}

// Sincronización automática: al arrancar, al recuperar la conexión, cada minuto, al volver a la app
// y unos segundos después de cada respuesta registrada. Lo que falle se reintenta solo en el
// siguiente ciclo; el botón de la barra lateral es solo para forzarlo a mano.
let temporizador = null
export function programarSync(ms = 4_000) {
  clearTimeout(temporizador)
  temporizador = setTimeout(() => sincronizar(), ms)
}

export function iniciarSync() {
  if (typeof window === 'undefined') return
  window.addEventListener('online', () => { set({ enLinea: true }); sincronizar() })
  window.addEventListener('offline', () => set({ enLinea: false }))
  window.addEventListener('saber11:cola', () => programarSync())
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sincronizar() })
  contarPendientes()
  sincronizar()
  setInterval(sincronizar, 60_000)
}
