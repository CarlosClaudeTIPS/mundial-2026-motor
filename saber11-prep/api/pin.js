// Función de servidor (Vercel) — cambiar el PIN de un estudiante.
// POST /api/pin  { estudiante_id, pin }
// Cabecera: Authorization: Bearer <access_token del docente o admin>
//
// El PIN del estudiante es su contraseña en Supabase Auth; cambiarla solo
// puede hacerse con la SERVICE_ROLE_KEY (solo en el servidor; nunca con
// prefijo VITE_). Un docente solo puede cambiar el PIN de estudiantes de
// sus propios grupos; el admin, de cualquiera.

import { createClient } from '@supabase/supabase-js'

// Debe coincidir con claveDePin() en src/lib/sesion.js
const claveDePin = (pin) => `${String(pin ?? '').trim()}#saber11`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })
  const url = process.env.VITE_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !service) return res.status(500).json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno de Vercel' })

  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Falta el token del docente' })

  const admin = createClient(url, service, { auth: { persistSession: false } })
  const { data: quien, error: errTok } = await admin.auth.getUser(token)
  if (errTok || !quien?.user) return res.status(401).json({ error: 'Token inválido' })

  const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', quien.user.id).single()
  if (!perfil || !['docente', 'admin'].includes(perfil.rol)) return res.status(403).json({ error: 'Solo docentes o administradores' })

  const { estudiante_id, pin } = req.body ?? {}
  const pinLimpio = String(pin ?? '').trim()
  if (!estudiante_id || !/^\d{4,6}$/.test(pinLimpio)) return res.status(400).json({ error: 'El PIN debe tener 4 a 6 dígitos' })

  const { data: est } = await admin.from('perfiles').select('id, rol, grupo_id, nombre').eq('id', estudiante_id).single()
  if (!est || est.rol !== 'estudiante') return res.status(404).json({ error: 'Estudiante no encontrado' })
  if (perfil.rol !== 'admin') {
    const { data: grupo } = est.grupo_id ? await admin.from('grupos').select('docente_id').eq('id', est.grupo_id).single() : { data: null }
    if (!grupo || grupo.docente_id !== quien.user.id) return res.status(403).json({ error: 'El estudiante no está en un grupo tuyo' })
  }

  const { error } = await admin.auth.admin.updateUserById(estudiante_id, { password: claveDePin(pinLimpio) })
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}
