import { db, ahora, uuid } from './db'
import { crearUsuario } from './sesion'
import { crearGrupo, guardarRecurso } from './datos'
import { listarPreguntas } from './banco'
import { evaluar } from './feedback'
import { NUBE_DISPONIBLE } from './supabase'

// ─── Datos de demostración (solo modo local) ─────────────────────────────────
// Para probar los tres roles sin configurar nada. Los usuarios demo llevan
// `demo: true` y se pueden borrar desde Administración.

export const USUARIOS_DEMO = [
  { nombre: 'Administración', usuario: 'admin', pin: '1234', rol: 'admin' },
  { nombre: 'Docente de prueba', usuario: 'docente', pin: '1234', rol: 'docente' },
]

const ESTUDIANTES_DEMO = ['Valentina Rojas', 'Juan Esteban Pérez', 'Sara Martínez', 'Kevin Rodríguez', 'Laura Gómez', 'Andrés Castro']

export async function asegurarDatosIniciales() {
  if (NUBE_DISPONIBLE) return
  if ((await db.usuarios.count()) > 0) return
  const admin = await crearUsuario({ ...USUARIOS_DEMO[0], demo: true })
  const docente = await crearUsuario({ ...USUARIOS_DEMO[1], demo: true })
  const grupo = await crearGrupo({ nombre: '11-02 (demo)', docente_id: docente.id, colegio: 'IED de prueba', curso: '11-02', ciclo_id: 'saber11-B-2027' })
  for (const [i, nombre] of ESTUDIANTES_DEMO.entries()) {
    await crearUsuario({ nombre, usuario: `est${i + 1}`, pin: '1234', rol: 'estudiante', grupo_id: grupo.id, colegio: grupo.colegio, curso: grupo.curso, ciclo_id: grupo.ciclo_id, demo: true })
  }
  await sembrarRecursosIniciales(admin.id)
  return { admin, docente, grupo }
}

// Recursos iniciales: quedan PENDIENTES hasta que el docente/admin los revise,
// porque las URL del ICFES cambian con frecuencia (varias devolvían 404 el 25-sep-2026).
export async function sembrarRecursosIniciales(admin_id) {
  if ((await db.recursos.count()) > 0) return
  const base = { propuesto_por: 'sistema', estado: 'pendiente', categoria: 'esencial', nivel: 'todos' }
  const lista = [
    { titulo: 'Guías de orientación Saber 11° (ICFES)', tipo: 'enlace', url: 'https://www.icfes.gov.co/', descripcion: 'Documento oficial con la estructura del examen, competencias, afirmaciones y evidencias por prueba. Buscar la guía del año vigente en la sección de Saber 11.', prueba: null, habilidades: ['leer', 'comprender'], tipos_error: ['comprension'], fuente: { nombre: 'ICFES', institucion: 'ICFES', url: 'https://www.icfes.gov.co/' } },
    { titulo: 'Cuadernillos de preguntas liberadas Saber 11° (ICFES)', tipo: 'enlace', url: 'https://www.icfes.gov.co/', descripcion: 'Preguntas oficiales liberadas con su clave y, en algunas ediciones, la explicación ("Preguntas explicadas"). Son la referencia de estilo del banco.', prueba: null, habilidades: ['interpretar', 'razonar'], tipos_error: ['distractor'], fuente: { nombre: 'ICFES', institucion: 'ICFES', url: 'https://www.icfes.gov.co/' } },
    { titulo: 'Cómo leer una tabla o un gráfico antes de responder (guía interna)', tipo: 'texto', url: null, descripcion: '1) Lee el título y las unidades. 2) Identifica qué representa cada eje o columna. 3) Ubica exactamente el dato que pide la pregunta (año, categoría, serie). 4) Escribe el dato con sus unidades antes de operar. 5) Verifica que la respuesta responde lo preguntado.', prueba: 'matematicas', habilidades: ['interpretar', 'representar', 'verificar'], tipos_error: ['lectura_grafico', 'lectura_tabla'], categoria: 'esencial', fuente: { nombre: 'Elaboración propia del programa', institucion: 'Programa Saber 11', url: null } },
    { titulo: 'Lista de chequeo antes de enviar (guía interna)', tipo: 'texto', url: null, descripcion: '¿Respondí exactamente lo que preguntan (no una pregunta parecida)? ¿Usé el dato correcto del contexto? ¿Las unidades y el orden de magnitud tienen sentido? ¿Puedo decir por qué las otras opciones no sirven?', prueba: null, habilidades: ['verificar'], tipos_error: ['verificacion', 'descuido', 'distractor'], categoria: 'esencial', fuente: { nombre: 'Elaboración propia del programa', institucion: 'Programa Saber 11', url: null } },
    { titulo: 'Inferir sin inventar: cómo sostener una inferencia con el texto (guía interna)', tipo: 'texto', url: null, descripcion: 'Una inferencia válida se apoya en una o más frases del texto. Antes de elegir, subraya la frase que la sostiene. Si no encuentras ninguna, la opción va más allá del texto.', prueba: 'lectura_critica', habilidades: ['interpretar', 'razonar'], tipos_error: ['inferencia'], categoria: 'esencial', fuente: { nombre: 'Elaboración propia del programa', institucion: 'Programa Saber 11', url: null } },
  ]
  for (const r of lista) await guardarRecurso({ ...base, ...r, aprobado_por: null, fecha_incorporacion: ahora() })
}

// Genera intentos ficticios para ver el panel del docente con datos. Solo demo.
export async function generarIntentosDemo(grupo_id) {
  const miembros = await db.usuarios.where('grupo_id').equals(grupo_id).toArray()
  const preguntas = await listarPreguntas()
  if (!preguntas.length) return 0
  let n = 0
  const hoy = Date.now()
  for (const [k, m] of miembros.entries()) {
    const habilidadPropia = 0.35 + (k % 4) * 0.12 // distintos niveles
    const sesgo = ['lectura_grafico', 'inferencia', 'calculo', 'comprension'][k % 4]
    for (let j = 0; j < 22; j++) {
      const p = preguntas[(k * 7 + j * 3) % preguntas.length]
      const correcta = p.opciones.find(o => o.correcta)
      let clave
      if (Math.random() < habilidadPropia + (p.dificultad === 1 ? 0.2 : p.dificultad === 3 ? -0.15 : 0)) clave = correcta.clave
      else {
        const conSesgo = p.opciones.filter(o => !o.correcta && o.tipo_error === sesgo)
        const distractores = conSesgo.length && Math.random() < 0.7 ? conSesgo : p.opciones.filter(o => !o.correcta)
        clave = distractores[Math.floor(Math.random() * distractores.length)].clave
      }
      const tiempo = Math.round(p.tiempo_sugerido_seg * (0.6 + Math.random() * 1.2))
      const ev = evaluar(p, clave, { tiempoSeg: tiempo })
      const fecha = new Date(hoy - Math.floor(Math.random() * 21) * 86400000 - Math.random() * 8.64e7).toISOString()
      await db.intentos.add({
        uid: uuid(), estudiante_id: m.id, pregunta_id: p.id, prueba: p.prueba, competencia: p.competencia, componente: p.componente ?? null,
        habilidad: p.habilidad, dificultad: p.dificultad, opcion: clave, correcta: ev.esCorrecta, tiempo_seg: tiempo, lento: ev.lento,
        tipo_error: ev.tipoError, diagnostico: ev.diagnostico, razon: null, modo: 'practica', sesion_id: null, refuerzo_de: null,
        vio_explicacion: true, fecha, sincronizado: 1, demo: true,
      })
      n++
    }
  }
  return n
}

export async function borrarDatosDemo() {
  const usuarios = await db.usuarios.filter(u => u.demo).toArray()
  const ids = usuarios.map(u => u.id)
  await db.intentos.where('estudiante_id').anyOf(ids).delete()
  await db.sesiones.where('estudiante_id').anyOf(ids).delete()
  await db.usuarios.bulkDelete(ids)
  await db.grupos.filter(g => g.nombre.includes('(demo)')).delete()
}
