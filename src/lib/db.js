import Dexie from 'dexie'
import { NUBE_DISPONIBLE } from './supabase'

// ─── Base de datos local (IndexedDB) ─────────────────────────────────────────
// Es la fuente de verdad EN EL DISPOSITIVO. Todo lo que el estudiante hace se
// guarda aquí primero (funciona sin internet) y luego se sincroniza con la
// nube cuando hay conexión y Supabase está configurado (ver sync.js).
//
// Tablas (índices entre comillas; el primer campo es la clave primaria):
export const db = new Dexie('saber11')

db.version(1).stores({
  preguntas:    'id, prueba, competencia, habilidad, componente, dificultad, estado, origen, *etiquetas',
  intentos:     'uid, estudiante_id, pregunta_id, fecha, sesion_id, sincronizado, [estudiante_id+pregunta_id], [estudiante_id+fecha]',
  usuarios:     'id, rol, usuario, grupo_id',
  grupos:       'id, docente_id, codigo',
  asignaciones: 'id, grupo_id, tipo, fecha_creacion',
  sesiones:     'id, estudiante_id, tipo, estado, fecha_inicio, asignacion_id',
  recursos:     'id, prueba, estado, tipo, *habilidades, *tipos_error',
  ciclos:       'id, calendario',
  config:       'clave',
  cola:         '++id, tabla, fecha',
})

// v2: sesiones del docente (una cada ~21 días por grupo, con el resumen del periodo)
db.version(2).stores({
  sesiones_docente: 'id, grupo_id, fecha',
})

export const ahora = () => new Date().toISOString()

export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// Encola un cambio para la nube. En modo local no hay a dónde enviarlo, así que no se acumula.
export async function encolar(tabla, datos) {
  if (!NUBE_DISPONIBLE) return
  await db.cola.add({ tabla, accion: 'upsert', datos, fecha: ahora() })
}

export async function getConfig(clave, porDefecto = null) {
  const fila = await db.config.get(clave)
  return fila ? fila.valor : porDefecto
}

export async function setConfig(clave, valor) {
  await db.config.put({ clave, valor })
}
