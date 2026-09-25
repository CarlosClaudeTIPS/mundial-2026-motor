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
    const usuario = id ? await db.usuarios.get(id) : null
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

export async function entrarNube({ correo, contrasena, codigo, pin }) {
  if (!NUBE_DISPONIBLE) throw new Error('La nube no está configurada')
  const email = correo ?? `${codigo.trim().toLowerCase()}@estudiantes.saber11.local`
  const password = contrasena ?? pin
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
