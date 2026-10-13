import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Si no hay claves, la app corre en MODO LOCAL: todo vive en el navegador
// (IndexedDB) y no se sincroniza. Con claves, los datos viajan a Supabase.
export const supabase = url && key
  ? createClient(url, key, {
      auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
    })
  : null

export const NUBE_DISPONIBLE = supabase !== null
