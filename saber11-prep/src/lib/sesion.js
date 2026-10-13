import { useSyncExternalStore } from 'react'
import { db, getConfig, setConfig, uuid, ahora, encolar } from './db'
import { supabase, NUBE_DISPONIBLE } from './supabase'

// ─── Sesión de usuario ───────────────────────────────────────────────────────
// Modo local: los usuarios viven en IndexedDB y se entra con usuario + PIN.
// Modo nube: docentes/admin entran con correo + contraseña (Supabase Auth);
// los estudiantes con su código + PIN (el código se convierte en un correo
// sintético que la función api/estudiantes.js creó al inscribirlos).

let estado = { usuario: null, cargando: true, modo: NUBE_DISPONIBLE ? 'nube' : 'local' }
const subs = new Set()
const emitir = () => subs.forEach(f => f())
const suscribir = (f) => { subs.add(f); return () => subs.delete(f) }

export function useSesion() {
  return useSyncExternalStore(suscribir, () => estado)
}

function setEstado(parcial) { estado = { ...estado, ...parcial }; emitir() }

export async function hashPin(pin) {
  const datos = new TextEncoder().encode(`saber11:${pin}`)
  const buf = await crypto.subtle.digest('SHA-256', datos)
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// Si el usuario llega desde un enlace de invitación o de recuperación de
// contraseña (Supabase pone #access_token=…&type=invite|recovery en la URL),
// hay que pedirle que cree su contraseña antes de seguir.
const HASH_INICIAL = typeof window !== 'undefined' ? window.location.hash : ''
export const LLEGO_POR_ENLACE = /type=(invite|recovery|magiclink)/.test(HASH_INICIAL)

export async function crearContrasena(nueva) {
  if (!NUBE_DISPONIBLE) throw new Error('La nube no está configurada')
  const { data, error } = await supabase.auth.updateUser({ password: nueva })
  if (error) throw new Error(error.message)
  const usuario = await perfilDesdeNube(data.user)
  setEstado({ usuario })
  return usuario
}

export async function pedirRecuperacion(correo) {
  if (!NUBE_DISPONIBLE) throw new Error('La nube no está configurada')
  const { error } = await supabase.auth.resetPasswordForEmail(correo, { redirectTo: window.location.origin + '/' })
  if (error) throw new Error(error.message)
}

export async function iniciarSesionGuardada() {
  try {
    if (NUBE_DISPONIBLE) {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        const usuario = await perfilDesdeNube(data.session.user)
        setEstado({ usuario, cargando: false })
        return
      }
    }
    const id = await getConfig('sesion_usuario_id')
    let usuario = id ? await db.usuarios.get(id) : null
    // Solo modo local: VITE_AUTOLOGIN="usuario:pin" entra directo (vistas previas y demos).
    const auto = import.meta.env.VITE_AUTOLOGIN
    if (!usuario && auto) {
      const [handle, pin = ''] = String(auto).split(':')
      usuario = await entrarLocal(handle, pin).catch(e => { console.warn('AUTOLOGIN falló', e); return null })
    }
    setEstado({ usuario: usuario ?? null, cargando: false })
  } catch (e) {
    console.error('No se pudo restaurar la sesión', e)
    setEstado({ usuario: null, cargando: false })
  }
}

export async function entrarLocal(usuarioHandle, pin) {
  const u = await db.usuarios.where('usuario').equals(usuarioHandle.trim().toLowerCase()).first()
  if (!u) throw new Error('Usuario no encontrado')
  if (u.pin_hash && u.pin_hash !== await hashPin(pin ?? '')) throw new Error('PIN incorrecto')
  await setConfig('sesion_usuario_id', u.id)
  setEstado({ usuario: u })
  return u
}

// El PIN del estudiante (4+ dígitos) se convierte en contraseña con un sufijo fijo,
// porque Supabase exige mínimo 6 caracteres.
export const claveDePin = (pin) => `${String(pin ?? '').trim()}#saber11`
export const DOMINIO_ESTUDIANTES = 'estudiantes.saber11.local'

// Usuario a partir de primer nombre + primer apellido: sin tildes, minúsculas, sin espacios.
export function baseUsuario(nombre, apellido) {
  const limpio = (t) => String(t ?? '').trim().split(/\s+/)[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')
  return limpio(nombre) + limpio(apellido)
}
const capital = (t) => { const p = String(t ?? '').trim().split(/\s+/)[0]; return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() }

// Registro del propio estudiante. Queda en estado "pendiente" hasta que el docente/admin lo acepte.
// Devuelve el usuario asignado (si el nombre ya existe se le agrega 1, 2, 3…).
export async function registrarEstudiante({ nombre, apellido, pin }) {
  const base = baseUsuario(nombre, apellido)
  if (base.length < 4 || !nombre?.trim() || !apellido?.trim()) throw new Error('Escribe tu primer nombre y tu primer apellido')
  if (!/^\d{4,8}$/.test(String(pin ?? ''))) throw new Error('El PIN debe tener entre 4 y 8 dígitos')
  const nombreCompleto = `${capital(nombre)} ${capital(apellido)}`
  if (NUBE_DISPONIBLE) {
    const { data: handle, error: errH } = await supabase.rpc('siguiente_usuario', { base })
    if (errH || !handle) throw new Error(errH?.message ?? 'No se pudo asignar el usuario')
    const { data, error } = await supabase.auth.signUp({ email: `${handle}@${DOMINIO_ESTUDIANTES}`, password: claveDePin(pin), options: { data: { nombre: nombreCompleto, rol: 'estudiante' } } })
    if (error || !data?.user) throw new Error(error?.message ?? 'No se pudo crear la cuenta')
    const fila = { id: data.user.id, rol: 'estudiante', nombre: nombreCompleto, usuario: handle, estado: 'pendiente' }
    const { error: errP } = await supabase.from('perfiles').insert(fila)
    if (errP) throw new Error('Cuenta creada, pero no se pudo guardar el perfil: ' + errP.message)
    await db.usuarios.put({ ...fila, sincronizado: 1 })
    await setConfig('sesion_usuario_id', fila.id)
    setEstado({ usuario: fila })
    return fila
  }
  // Modo local
  let handle = base, n = 0
  while (await db.usuarios.where('usuario').equals(handle).first()) { n++; handle = base + n }
  const u = { id: uuid(), nombre: nombreCompleto, usuario: handle, rol: 'estudiante', grupo_id: null, estado: 'pendiente', pin_hash: await hashPin(pin), creado: ahora(), sincronizado: 0 }
  await db.usuarios.add(u)
  await setConfig('sesion_usuario_id', u.id)
  setEstado({ usuario: u })
  return u
}

// Solicitudes de registro (para docente/admin)
export async function solicitudesPendientes() {
  if (NUBE_DISPONIBLE) {
    const { data, error } = await supabase.from('perfiles').select('*').eq('rol', 'estudiante').eq('estado', 'pendiente').order('creado')
    if (error) throw new Error(error.message)
    return data ?? []
  }
  return db.usuarios.filter(u => u.rol === 'estudiante' && u.estado === 'pendiente').toArray()
}

export async function resolverSolicitud(perfil, { aceptar, grupo = null }) {
  const cambios = aceptar
    ? { estado: 'activo', grupo_id: grupo?.id ?? null, colegio: grupo?.colegio ?? null, curso: grupo?.curso ?? null, ciclo_id: grupo?.ciclo_id ?? null }
    : { estado: 'rechazado' }
  if (NUBE_DISPONIBLE) {
    const { error } = await supabase.from('perfiles').update(cambios).eq('id', perfil.id)
    if (error) throw new Error(error.message)
  }
  await db.usuarios.put({ ...perfil, ...cambios, sincronizado: 1 })
}

// Vuelve a leer el perfil (para saber si ya fue aceptado)
export async function revisarAprobacion() {
  if (!estado.usuario) return null
  let u
  if (NUBE_DISPONIBLE) { const { data } = await supabase.auth.getUser(); u = data?.user ? await perfilDesdeNube(data.user) : null }
  else u = await db.usuarios.get(estado.usuario.id)
  if (u) setEstado({ usuario: u })
  return u
}

export async function entrarNube({ correo, contrasena, codigo, pin }) {
  if (!NUBE_DISPONIBLE) throw new Error('La nube no está configurada')
  const email = correo ?? `${codigo.trim().toLowerCase()}@${DOMINIO_ESTUDIANTES}`
  const password = contrasena ?? claveDePin(pin)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Credenciales incorrectas' : error.message)
  const usuario = await perfilDesdeNube(data.user)
  setEstado({ usuario })
  return usuario
}

async function perfilDesdeNube(authUser) {
  const { data } = await supabase.from('perfiles').select('*').eq('id', authUser.id).maybeSingle()
  const perfil = data ?? { id: authUser.id, rol: 'estudiante', nombre: authUser.email, usuario: authUser.email }
  await db.usuarios.put({ ...perfil, sincronizado: 1 })
  await setConfig('sesion_usuario_id', perfil.id)
  return perfil
}

export async function salir() {
  if (NUBE_DISPONIBLE) await supabase.auth.signOut().catch(() => {})
  await setConfig('sesion_usuario_id', null)
  setEstado({ usuario: null })
}

export async function refrescarUsuario() {
  if (!estado.usuario) return
  const u = await db.usuarios.get(estado.usuario.id)
  if (u) setEstado({ usuario: u })
}

// Crea un usuario local (docente/admin lo usan para inscribir estudiantes).
export async function crearUsuario({ nombre, usuario, pin, rol = 'estudiante', grupo_id = null, colegio = null, curso = null, ciclo_id = null, demo = false }) {
  const handle = usuario.trim().toLowerCase()
  const existe = await db.usuarios.where('usuario').equals(handle).first()
  if (existe) throw new Error(`El usuario "${handle}" ya existe`)
  const u = {
    id: uuid(), nombre: nombre.trim(), usuario: handle, rol, grupo_id, colegio, curso, ciclo_id,
    pin_hash: pin ? await hashPin(pin) : null, demo, creado: ahora(), sincronizado: 0,
  }
  await db.usuarios.add(u)
  await encolar('usuarios', u)
  return u
}
