import { db, setConfig, getConfig, uuid, ahora } from './db'
import { supabase, NUBE_DISPONIBLE } from './supabase'
import { refrescarUsuario } from './sesion'
import cuestionario from '../../content/futuro/cuestionario.json'
import ocupacionesJson from '../../content/futuro/ocupaciones.json'
import formacionJson from '../../content/futuro/formacion.json'
import fuentesJson from '../../content/futuro/fuentes.json'
import oportunidadesJson from '../../content/futuro/oportunidades.json'
import actividadesJson from '../../content/futuro/actividades.json'
import conversacionJson from '../../content/futuro/conversacion.json'
import { carreraPorId } from './carreras'

// ─── Mi futuro: orientación vocacional y proyecto de vida ────────────────────
// Lógica pura + persistencia. Todo el estado del estudiante vive en un
// solo objeto `futuro` guardado en el dispositivo (db.config) y, si la nube tiene
// la migración 006, en perfiles.futuro mediante la función guardar_futuro.
// Nada de esto se muestra al docente ni a otros estudiantes.

export const CUESTIONARIO = cuestionario
export const OCUPACIONES = ocupacionesJson.ocupaciones
export const FORMACION = formacionJson.tipos
export const FUENTES = fuentesJson
export const OPORTUNIDADES = oportunidadesJson.oportunidades
export const ACTIVIDADES = actividadesJson.actividades
export const REFLEXION_ACTIVIDAD = actividadesJson.reflexion
export const CONVERSACION = conversacionJson
export const AREAS = cuestionario.areas
export const ocupacionPorId = (id) => OCUPACIONES.find(o => o.id === id) ?? null
export const fuentePorId = (id) => [...FUENTES.formacion, ...FUENTES.trabajo, ...FUENTES.apoyos].find(f => f.id === id) ?? null

export const FUTURO_VACIO = () => ({
  version: 1,
  intereses: { respuestas: {}, terminado: false },   // { itemId: 0..3 }
  habilidades: {},                                  // { nombre: estado }
  valores: {},                                      // { id: 0..3 }  (0 no importa, 3 esencial)
  entorno: {},                                      // { campoId: valor }
  guardadas: [],                                    // 'ocupacion:x' | 'oportunidad:y'
  comparacion: { opciones: [], pesos: {}, notas: {}, respuestas: {} },
  proyecto: { punto_partida: {}, vision: { 1: {}, 3: {}, 5: {} }, metas: [], dimensiones: [] },
  actividades: [],                                  // { id, actividad_id, fecha, respuestas: {} }
  revisiones: [],                                   // { fecha, nota }
  actualizado: null,
})

// ── Intereses ─────────────────────────────────────────────────────────────────
// Puntaje por área = promedio de sus ítems respondidos (0-3), en porcentaje 0-100.
export function perfilIntereses(respuestas = {}) {
  const porArea = {}
  for (const it of cuestionario.items) {
    const v = respuestas[it.id]
    if (v == null) continue
    const a = (porArea[it.area] ??= { area: it.area, suma: 0, n: 0 })
    a.suma += Number(v); a.n++
  }
  const total = cuestionario.items.length
  const respondidos = Object.keys(respuestas).length
  const areas = Object.keys(cuestionario.areas).map(k => {
    const a = porArea[k]
    const pct = a && a.n ? Math.round((a.suma / (a.n * 3)) * 100) : null
    return { area: k, nombre: cuestionario.areas[k].nombre, descripcion: cuestionario.areas[k].descripcion, actividades: cuestionario.areas[k].actividades, respondidos: a?.n ?? 0, puntaje: pct }
  }).sort((x, y) => (y.puntaje ?? -1) - (x.puntaje ?? -1))
  const conDatos = areas.filter(a => a.puntaje != null)
  // Destacadas: puntaje ≥ 50 y a no más de 35 puntos de la máxima, máximo 3. Si todo es plano, se dice.
  const max = conDatos[0]?.puntaje ?? 0
  const destacadas = conDatos.filter(a => a.puntaje >= 50 && a.puntaje >= max - 35).slice(0, 3)
  const plano = conDatos.length >= 6 && (max - (conDatos.at(-1)?.puntaje ?? 0)) < 15
  return { areas, destacadas, plano, respondidos, total, completo: respondidos >= total, suficiente: respondidos >= 18 }
}

// Ocupaciones sugeridas por áreas destacadas (primera pesa 3, segunda 2, tercera 1; el área principal de la ocupación pesa 1,5×).
// "panorama": ocupaciones que comparten solo un área secundaria, para no cerrar opciones.
export function sugerirOcupaciones(perfil, { max = 8 } = {}) {
  if (!perfil?.destacadas?.length) return { afines: [], panorama: [] }
  const peso = Object.fromEntries(perfil.destacadas.map((a, i) => [a.area, 3 - i]))
  const puntuadas = OCUPACIONES.map(o => {
    const puntos = o.areas.reduce((s, a, i) => s + (peso[a] ?? 0) * (i === 0 ? 1.5 : 1), 0)
    return { ocupacion: o, puntos, areas_comunes: o.areas.filter(a => peso[a]) }
  }).sort((x, y) => y.puntos - x.puntos)
  const afines = puntuadas.filter(p => p.puntos >= 3).slice(0, max)
  const idsAfines = new Set(afines.map(p => p.ocupacion.id))
  const panorama = puntuadas.filter(p => !idsAfines.has(p.ocupacion.id) && p.puntos > 0).slice(-4).reverse()
  return { afines, panorama }
}

export const carrerasDeOcupacion = (o) => (o?.rutas ?? []).map(r => r.carrera).filter(Boolean).map(carreraPorId).filter(Boolean)

// Pruebas ICFES que pesan para una carrera (catálogo existente). Solo información complementaria: nunca excluye opciones.
export function pruebasQuePesan(carreraId) {
  const c = carreraPorId(carreraId)
  if (!c) return []
  return Object.entries(c.pesos).filter(([, p]) => p >= 2).sort((a, b) => b[1] - a[1]).map(([prueba, peso]) => ({ prueba, peso }))
}

// ── Valores y habilidades ─────────────────────────────────────────────────────
export function conflictosDeValores(valores = {}) {
  const altos = new Set(Object.entries(valores).filter(([, v]) => Number(v) >= 3).map(([k]) => k))
  return cuestionario.conflictos.filter(c => c.entre.every(id => altos.has(id)))
}
export function valoresPrioritarios(valores = {}) {
  return cuestionario.valores.map(v => ({ ...v, importancia: Number(valores[v.id] ?? 0) })).filter(v => v.importancia > 0).sort((a, b) => b.importancia - a.importancia)
}
export function resumenHabilidades(habilidades = {}) {
  const grupos = { se: [], reconocen: [], aprendiendo: [], quiero: [], no_probado: [] }
  for (const [h, estado] of Object.entries(habilidades)) if (grupos[estado]) grupos[estado].push(h)
  return grupos
}

// ── Comparador ────────────────────────────────────────────────────────────────
// Criterios explícitos valorados por el estudiante (1 a 5) o "sin dato". Nunca se
// inventa un valor para llenar un vacío ni se produce un ranking definitivo.
export const CRITERIOS = [
  { id: 'interes', nombre: 'Me interesa de verdad', ayuda: 'Según tus áreas y lo que has explorado.' },
  { id: 'actividades', nombre: 'Me gustan sus actividades diarias', ayuda: 'Lo que se hace todos los días, no el título.' },
  { id: 'habilidades', nombre: 'Tengo (o quiero desarrollar) sus habilidades', ayuda: 'Compara con tu lista de habilidades.' },
  { id: 'duracion', nombre: 'La duración me sirve', ayuda: 'Años de estudio frente a tu urgencia de trabajar.' },
  { id: 'costo', nombre: 'Es viable económicamente', ayuda: 'Costo publicado + transporte + materiales frente a tu presupuesto y apoyos.' },
  { id: 'modalidad', nombre: 'Modalidad y ubicación me sirven', ayuda: 'Presencial/virtual, cerca o lejos de casa.' },
  { id: 'admision', nombre: 'Puedo cumplir los requisitos de admisión', ayuda: 'Puntaje, examen propio, cupos.' },
  { id: 'financiacion', nombre: 'Hay financiación o apoyos', ayuda: 'Gratuidad, becas, créditos condonables.' },
  { id: 'empleo', nombre: 'Tiene salidas laborales que conozco', ayuda: 'Datos del Observatorio Laboral, no rumores.' },
  { id: 'riesgos', nombre: 'Acepto sus dificultades y riesgos', ayuda: 'Turnos, inestabilidad, carga física o emocional.' },
  { id: 'circunstancias', nombre: 'Es compatible con mi situación actual', ayuda: 'Tiempo, trabajo, responsabilidades, conectividad.' },
]
export function compararOpciones(comparacion) {
  const { opciones = [], pesos = {}, respuestas = {} } = comparacion ?? {}
  const peso = (c) => Number(pesos[c.id] ?? 2) // 0 no importa … 3 muy importante
  return opciones.map(op => {
    const valoradas = CRITERIOS.map(c => { const v = respuestas[op.id]?.[c.id]; return { criterio: c, valor: v == null || v === '' ? null : Number(v), peso: peso(c) } })
    const conDato = valoradas.filter(x => x.valor != null && x.peso > 0)
    const sumaPesos = conDato.reduce((a, x) => a + x.peso, 0)
    const promedio = sumaPesos ? Math.round((conDato.reduce((a, x) => a + x.valor * x.peso, 0) / sumaPesos) * 10) / 10 : null
    return { opcion: op, valoradas, sin_dato: valoradas.filter(x => x.valor == null).map(x => x.criterio), promedio, cobertura: Math.round((conDato.length / Math.max(1, valoradas.filter(x => x.peso > 0).length)) * 100) }
  })
}
export const PREGUNTAS_COMPARACION = [
  '¿Qué opción te interesa más y por qué?',
  '¿Qué aspectos todavía desconoces de cada una?',
  '¿Qué tendrías que sacrificar o cambiar para seguir cada camino?',
  '¿Qué alternativa es viable económicamente hoy?',
  '¿Qué podrías probar antes de tomar la decisión?',
  '¿Qué harías si tu primera opción no funciona?',
]

// ── Proyecto de vida ──────────────────────────────────────────────────────────
export const DIMENSIONES = [
  { id: 'educacion', nombre: 'Educación y aprendizaje' }, { id: 'trabajo', nombre: 'Trabajo y desarrollo profesional' }, { id: 'finanzas', nombre: 'Finanzas personales' },
  { id: 'bienestar', nombre: 'Bienestar físico y emocional' }, { id: 'relaciones', nombre: 'Relaciones y redes de apoyo' }, { id: 'familia', nombre: 'Familia y responsabilidades' },
  { id: 'social', nombre: 'Participación social' }, { id: 'creatividad', nombre: 'Creatividad, intereses y tiempo libre' }, { id: 'personal', nombre: 'Desarrollo personal' },
]
export const PUNTO_PARTIDA = [
  { id: 'situacion', texto: '¿Cómo ves tu situación actual, en una o dos frases?' }, { id: 'cambiar', texto: '¿Qué te gustaría cambiar?' }, { id: 'conservar', texto: '¿Qué quieres conservar como está?' },
  { id: 'curiosidad', texto: '¿Qué te genera curiosidad últimamente?' }, { id: 'obstaculos', texto: '¿Qué obstáculos reconoces?' }, { id: 'apoyos', texto: '¿Qué recursos y personas pueden apoyarte?' },
]
export const VISION = [
  { id: 'dia', texto: '¿Cómo te gustaría que fuera un día normal de tu vida?' }, { id: 'actividades', texto: '¿Qué actividades quisieras estar haciendo?' }, { id: 'aprendido', texto: '¿Qué te gustaría haber aprendido?' },
  { id: 'independencia', texto: '¿Qué tipo de independencia te gustaría tener?' }, { id: 'relaciones', texto: '¿Qué clase de relaciones quisieras haber construido?' }, { id: 'problemas', texto: '¿Qué problemas te gustaría contribuir a resolver?' },
  { id: 'no_sacrificar', texto: '¿Qué no estarías dispuesto(a) a sacrificar?' }, { id: 'explorar', texto: '¿Qué todavía no sabes y necesitas explorar?' },
]
export const ESTADOS_META = { idea: 'Idea', en_curso: 'En curso', pausada: 'En pausa', lograda: 'Lograda', replanteada: 'Replanteada' }
export const metaNueva = (base = {}) => ({ id: uuid(), titulo: '', descripcion: '', por_que: '', dimension: 'educacion', horizonte: '1 año', primer_paso: '', fecha_objetivo: '', recursos: '', obstaculos: '', alternativa: '', indicador: '', estado: 'idea', creada: ahora(), historial: [], ...base })

// Plan de 30 y 90 días a partir de las metas, del entorno y de lo que falta explorar.
export function planAccion(futuro, { hoy = new Date() } = {}) {
  const f = futuro ?? FUTURO_VACIO()
  const metas = f.proyecto.metas.filter(m => ['idea', 'en_curso'].includes(m.estado))
  const perfil = perfilIntereses(f.intereses.respuestas)
  const hechas = new Set(f.actividades.map(a => a.actividad_id))
  const guardadas = f.guardadas.filter(g => g.startsWith('ocupacion:')).map(g => g.slice(10))
  const poco = ['Solo noches o fines de semana', 'No lo sé'].includes(f.entorno.tiempo) || f.entorno.responsabilidades === 'Muchas'
  const sinInternet = ['Acceso limitado o compartido', 'Casi nunca'].includes(f.entorno.internet)
  const d30 = [], d90 = []
  if (!perfil.suficiente) d30.push({ tipo: 'conocete', texto: 'Terminar el cuestionario de intereses (10 minutos) y marcar tus habilidades y valores.', minutos: 15 })
  if (perfil.suficiente && !guardadas.length) d30.push({ tipo: 'explora', texto: 'Leer tres fichas de ocupaciones afines y guardar al menos dos para comparar.', minutos: 20 })
  if (!hechas.has('entrevista')) d30.push({ tipo: 'actividad', actividad_id: 'entrevista', texto: 'Hacer una entrevista informativa a alguien que trabaje en algo que te interesa.', minutos: 30 })
  if (!hechas.has('investigar_programas')) d30.push({ tipo: 'actividad', actividad_id: 'investigar_programas', texto: sinInternet ? 'Investigar tres programas (puedes usar el computador del colegio o la biblioteca) y anotar duración, requisitos y costo publicado.' : 'Investigar tres programas en el SNIES o la oferta del SENA y anotar duración, requisitos y costo publicado.', minutos: 60 })
  if (!hechas.has('oportunidades')) d30.push({ tipo: 'actividad', actividad_id: 'oportunidades', texto: 'Revisar la gratuidad, el SENA y las becas que apliquen a tu caso y anotar fechas.', minutos: 45 })
  for (const m of metas.slice(0, 2)) if (m.primer_paso) d30.push({ tipo: 'meta', meta_id: m.id, texto: `Meta «${m.titulo}»: ${m.primer_paso}`, minutos: null })
  d90.push({ tipo: 'actividad', actividad_id: 'curso_intro', texto: poco ? 'Hacer al menos dos lecciones de un curso introductorio gratuito (en ratos cortos: no hace falta terminarlo).' : 'Completar un curso introductorio gratuito de tu opción principal.', minutos: 180 })
  d90.push({ tipo: 'compara', texto: 'Comparar en el comparador 2 o 3 caminos con todos los criterios y escribir qué harías si el primero no funciona.', minutos: 40 })
  if (!hechas.has('conversar_docente')) d90.push({ tipo: 'actividad', actividad_id: 'conversar_docente', texto: 'Conversar con un docente u orientador sobre lo que has descubierto.', minutos: 30 })
  d90.push({ tipo: 'conversacion', texto: 'Preparar y tener la conversación con tu familia o un adulto de confianza, con datos en la mano.', minutos: 60 })
  d90.push({ tipo: 'decision', texto: 'Definir el siguiente paso educativo o laboral y escribirlo como meta con fecha y primer paso.', minutos: 20 })
  if (poco) d90.unshift({ tipo: 'nota', texto: 'Tienes poco tiempo libre: el plan está pensado en bloques de 20 a 30 minutos. Avanzar despacio también es avanzar.', minutos: null })
  return { dias30: d30.slice(0, 5), dias90: d90.slice(0, 6), generado: hoy.toISOString() }
}

export const PREGUNTAS_CAMBIO = [
  '¿Qué cambió: tus intereses, tu situación, o la información que tenías?',
  '¿Qué aprendiste intentándolo que sigue sirviendo aunque cambies de rumbo?',
  '¿Qué parte de la meta quieres conservar y cuál soltar?',
  '¿Cuál sería un siguiente paso pequeño en la nueva dirección?',
]

// ── Siguiente paso recomendado (orientador por reglas) ──────────────
export function siguientePaso(futuro) {
  const f = futuro ?? FUTURO_VACIO()
  const perfil = perfilIntereses(f.intereses.respuestas)
  const guardadas = f.guardadas.filter(g => g.startsWith('ocupacion:'))
  if (!perfil.suficiente) return { area: 'conocete', texto: perfil.respondidos ? `Llevas ${perfil.respondidos} de ${perfil.total} preguntas. Sigue con el cuestionario de intereses.` : 'Empieza por el cuestionario de intereses: 36 preguntas cortas, puedes parar y volver.' }
  if (!Object.keys(f.valores).length) return { area: 'conocete', texto: 'Marca qué tan importantes son para ti los valores del trabajo: así el comparador sabrá qué pesa.' }
  if (guardadas.length < 2) return { area: 'explora', texto: 'Lee fichas de ocupaciones afines a tus áreas y guarda al menos dos que quieras comparar.' }
  if ((f.comparacion.opciones ?? []).length < 2) return { area: 'compara', texto: 'Compara las opciones que guardaste con criterios explícitos y marca lo que aún no sabes.' }
  if (!f.proyecto.metas.length) return { area: 'proyecto', texto: 'Convierte lo que descubriste en una meta con un primer paso y una fecha.' }
  if (!f.actividades.length) return { area: 'accion', texto: 'Comprueba una opción con una actividad real: una entrevista informativa o un curso corto.' }
  return { area: 'proyecto', texto: 'Revisa tus metas: ¿cuál avanzó, cuál se replantea? Actualiza el plan de 30 y 90 días.' }
}

// ── Persistencia ──────────────────────────────────────────────────────────────
const clave = (usuario) => `futuro:${usuario.id}`
export async function leerFuturo(usuario) {
  const local = await getConfig(clave(usuario))
  const nube = usuario.futuro && typeof usuario.futuro === 'object' ? usuario.futuro : null
  const elegido = !local ? nube : !nube ? local : ((nube.actualizado ?? '') > (local.actualizado ?? '') ? nube : local)
  return { ...FUTURO_VACIO(), ...(elegido ?? {}) }
}
export async function guardarFuturo(usuario, futuro) {
  const f = { ...futuro, actualizado: ahora() }
  await setConfig(clave(usuario), f)
  let aviso = null
  if (NUBE_DISPONIBLE && !usuario.previsualizacion) {
    const { error } = await supabase.rpc('guardar_futuro', { p_futuro: f })
    if (error && /guardar_futuro|function|schema cache/i.test(error.message)) aviso = 'Tu avance quedó guardado en este dispositivo. La nube todavía no tiene esta función (migración 006).'
    else if (error) aviso = 'No se pudo subir a la nube ahora; quedó guardado en este dispositivo.'
  }
  await db.usuarios.update(usuario.id, { futuro: f }).catch(() => {})
  return { futuro: f, aviso }
}
export async function borrarFuturo(usuario) {
  await setConfig(clave(usuario), null)
  await db.usuarios.update(usuario.id, { futuro: null }).catch(() => {})
  if (NUBE_DISPONIBLE && !usuario.previsualizacion) await supabase.rpc('guardar_futuro', { p_futuro: null }).catch(() => {})
  await refrescarUsuario().catch(() => {})
}
