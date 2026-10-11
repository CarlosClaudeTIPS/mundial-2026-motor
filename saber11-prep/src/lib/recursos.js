import { db, ahora, encolar } from './db'

// ─── Biblioteca curada (content/recursos.json) ───────────────────────────────
// Igual que el banco: los recursos curados se empaquetan con la app y se cargan
// en IndexedDB cuando cambia su contenido. Si el docente/admin cambió el estado
// de un recurso en la app (editado_local), la semilla no lo sobreescribe.
const archivos = import.meta.glob('../../content/recursos*.json', { eager: true, import: 'default' })

export function recursosSemilla() {
  return Object.values(archivos).flat()
}

function huella(texto) {
  let h = 0
  for (let i = 0; i < texto.length; i++) h = (Math.imul(31, h) + texto.charCodeAt(i)) | 0
  return String(h)
}

export async function sembrarRecursos() {
  const lista = recursosSemilla()
  if (!lista.length) return { cargados: 0 }
  const version = huella(JSON.stringify(lista))
  const previa = await db.config.get('recursos_version')
  if (previa?.valor === version) return { cargados: 0 }
  let cargados = 0
  await db.transaction('rw', db.recursos, db.config, async () => {
    for (const r of lista) {
      const existente = await db.recursos.get(r.id)
      if (existente?.editado_local) continue
      await db.recursos.put({ version: 1, categoria: 'refuerzo', habilidades: [], tipos_error: [], estado: 'aprobado', ...r, semilla: true, fecha_incorporacion: r.fecha_incorporacion ?? ahora(), actualizado: ahora(), sincronizado: 0 })
      cargados++
    }
    await db.config.put({ clave: 'recursos_version', valor: version })
  })
  // Se encolan fuera de la transacción (encolar no participa en ella).
  for (const r of lista) await encolar('recursos', await db.recursos.get(r.id))
  return { cargados }
}
