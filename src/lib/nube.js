// ─── Nube: sesión + sincronización de datos del usuario (Supabase) ───────────
//
// Login sin contraseña: se escribe el correo, llega un código de 6 dígitos,
// y la sesión queda guardada en el navegador (se renueva sola).
//
// Los datos viajan a la tabla `estado` (user_id, clave, data, updated_at) con
// RLS: cada usuario solo ve lo suyo. El merge es simple y honesto: gana el
// estado COMPLETO más reciente (un solo usuario, varios dispositivos).
//
// Si Supabase no está configurado (sin VITE_SUPABASE_URL), todo esto se apaga
// y la app sigue igual que siempre: localStorage por dispositivo.

import { supabase } from './supabase'

export const NUBE_DISPONIBLE = supabase !== null

// ─── Sesión ──────────────────────────────────────────────────────────────────
export async function getSesion() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data?.session ?? null
}

export function onSesion(cb) {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_ev, session) => cb(session))
  return () => data?.subscription?.unsubscribe?.()
}

export async function enviarCodigo(email) {
  if (!supabase) throw new Error('Nube no configurada')
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  })
  if (error) throw new Error(error.message)
}

export async function verificarCodigo(email, codigo) {
  if (!supabase) throw new Error('Nube no configurada')
  const { data, error } = await supabase.auth.verifyOtp({ email, token: codigo.trim(), type: 'email' })
  if (error) throw new Error(error.message === 'Token has expired or is invalid' ? 'Código inválido o vencido — pide uno nuevo' : error.message)
  return data.session
}

export async function cerrarSesion() {
  if (!supabase) return
  await supabase.auth.signOut()
}

// ─── Estado remoto (clave → JSON) ────────────────────────────────────────────
export async function subirEstado(clave, data) {
  const s = await getSesion()
  if (!s) return false
  const { error } = await supabase.from('estado').upsert({
    user_id: s.user.id,
    clave,
    data,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,clave' })
  return !error
}

export async function bajarEstado(clave) {
  const s = await getSesion()
  if (!s) return null
  const { data, error } = await supabase
    .from('estado')
    .select('data, updated_at')
    .eq('user_id', s.user.id)
    .eq('clave', clave)
    .maybeSingle()
  if (error || !data) return null
  return { data: data.data, updatedAt: new Date(data.updated_at).getTime() }
}

// ─── Sincronizar una clave de localStorage completa ──────────────────────────
// Devuelve el estado ganador (el más reciente) y lo deja igual en ambos lados.
// localTs: cuándo cambió por última vez el estado local (guardado junto a él).
export async function sincronizarClave(clave, localData, localTs) {
  const remoto = await bajarEstado(clave)
  if (remoto && (!localTs || remoto.updatedAt > localTs)) {
    return { data: remoto.data, origen: 'nube' }
  }
  if (localData != null) await subirEstado(clave, localData)
  return { data: localData, origen: 'local' }
}

// Empuje con debounce: los cambios rápidos (marcar 3 resultados seguidos) se
// suben una sola vez, 2 s después del último.
const timers = {}
export function subirConCalma(clave, data, ms = 2000) {
  clearTimeout(timers[clave])
  timers[clave] = setTimeout(() => { subirEstado(clave, data) }, ms)
}
