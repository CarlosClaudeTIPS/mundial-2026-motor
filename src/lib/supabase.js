import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// detectSessionInUrl + persistSession: al volver del link del correo, la
// sesión se detecta sola y queda guardada (se renueva sin pedir login otra vez)
export const supabase = url && key
  ? createClient(url, key, {
      auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
    })
  : null
