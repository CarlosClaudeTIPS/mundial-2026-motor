// Función de servidor (Vercel) — inscribir estudiantes en Supabase Auth.
// POST /api/estudiantes  { grupo_id, estudiantes: [{ nombre, usuario, pin }] }
// Cabecera: Authorization: Bearer <access_token del docente>
//
// Crea un usuario de Auth por estudiante con correo sintético
// <usuario>@estudiantes.saber11.local y contraseña = PIN, y su fila en `perfiles`.
// Usa la SERVICE_ROLE_KEY (solo en el servidor; nunca con prefijo VITE_).

import { createClient } from '@supabase/supabase-js'

const DOMINIO = 'estudiantes.saber11.local'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })
  const url = process.env.VITE_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !service) return res.status(500).json({ error: 'Supabase no configurado en el servidor' })

  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Falta el token del docente' })

  const admin = createClient(url, service, { auth: { persistSession: false } })
  const { data: quien, error: errTok } = await admin.auth.getUser(token)
  if (errTok || !quien?.user) return res.status(401).json({ error: 'Token inválido' })

  const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', quien.user.id).single()
  if (!perfil || !['docente', 'admin'].includes(perfil.rol)) return res.status(403).json({ error: 'Solo docentes o administradores' })

  const { grupo_id, estudiantes } = req.body ?? {}
  if (!grupo_id || !Array.isArray(estudiantes) || !estudiantes.length) return res.status(400).json({ error: 'Faltan grupo_id o estudiantes' })

  const { data: grupo } = await admin.from('grupos').select('*').eq('id', grupo_id).single()
  if (!grupo) return res.status(404).json({ error: 'Grupo no encontrado' })
  if (perfil.rol !== 'admin' && grupo.docente_id !== quien.user.id) return res.status(403).json({ error: 'El grupo no es tuyo' })

  const creados = [], errores = []
  for (const e of estudiantes.slice(0, 200)) {
    const usuario = String(e.usuario ?? '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
    const pin = String(e.pin ?? '').trim()
    if (!e.nombre || !usuario || pin.length < 4) { errores.push(`${e.nombre ?? '?'}: datos incompletos`); continue }
    const { data, error } = await admin.auth.admin.createUser({ email: `${usuario}@${DOMINIO}`, password: pin, email_confirm: true, user_metadata: { nombre: e.nombre, rol: 'estudiante' } })
    if (error) { errores.push(`${e.nombre}: ${error.message}`); continue }
    const fila = { id: data.user.id, rol: 'estudiante', nombre: e.nombre, usuario, grupo_id, colegio: grupo.colegio, curso: grupo.curso, ciclo_id: grupo.ciclo_id }
    const { error: errPerfil } = await admin.from('perfiles').upsert(fila)
    if (errPerfil) { errores.push(`${e.nombre}: ${errPerfil.message}`); continue }
    creados.push(fila)
  }
  return res.status(200).json({ creados, errores })
}
