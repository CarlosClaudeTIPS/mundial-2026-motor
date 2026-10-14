import { useEffect, useMemo, useRef, useState } from 'react'
import { Compass, Search, Scale, Target, Rocket, ChevronRight, ArrowLeft, Bookmark, BookmarkCheck, ExternalLink, Plus, Trash2, Users, Printer, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Titulo, Badge, Barra, Vacio, Md } from '../ui'
import { ir } from '../../lib/nav'
import { MATERIAS } from '../Login'
import { nombrePrueba } from '../../lib/taxonomia'
import { leerFuturo, guardarFuturo, FUTURO_VACIO, CUESTIONARIO, AREAS, perfilIntereses, sugerirOcupaciones, conflictosDeValores, valoresPrioritarios, resumenHabilidades, OCUPACIONES, ocupacionPorId, carrerasDeOcupacion, pruebasQuePesan, FORMACION, FUENTES, fuentePorId, OPORTUNIDADES, CRITERIOS, compararOpciones, PREGUNTAS_COMPARACION, DIMENSIONES, PUNTO_PARTIDA, VISION, ESTADOS_META, metaNueva, planAccion, PREGUNTAS_CAMBIO, ACTIVIDADES, REFLEXION_ACTIVIDAD, CONVERSACION, siguientePaso } from '../../lib/futuro'
import { uuid, ahora } from '../../lib/db'

// ─── Mi futuro ───────────────────────────────────────────────────────────────
// Cinco áreas conectadas: Conócete → Explora → Compara → Proyecto de vida → Acción.
// Todo se guarda solo (local primero; nube si existe la migración 006). Nada se
// comparte con el docente ni con otros estudiantes.

export const NOMBRE_SECCION = 'Mi futuro' // renombrable desde aquí (configuración del producto)
const AREAS_UI = [
  { id: 'conocete', nombre: 'Conócete', icono: Compass, que: 'Tus intereses, habilidades, valores y circunstancias.' },
  { id: 'explora', nombre: 'Explora opciones', icono: Search, que: 'Ocupaciones, tipos de formación, fuentes oficiales y apoyos.' },
  { id: 'compara', nombre: 'Compara tus caminos', icono: Scale, que: 'De 2 a 4 opciones con criterios que tú ponderas.' },
  { id: 'proyecto', nombre: 'Proyecto de vida', icono: Target, que: 'Punto de partida, visión, metas y plan de 30/90 días.' },
  { id: 'accion', nombre: 'Pasa a la acción', icono: Rocket, que: 'Actividades reales para comprobar y conversaciones.' },
]

export default function MiFuturo({ usuario, params }) {
  const [f, setF] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [area, setArea] = useState(params.area ?? null)
  const timer = useRef(null)
  useEffect(() => { leerFuturo(usuario).then(setF) }, [usuario.id])
  useEffect(() => { if (params.area) setArea(params.area) }, [params.area])

  // Guardado automático con pequeña espera (evita escribir en cada tecla).
  const actualizar = (fn) => {
    setF(prev => {
      const nuevo = typeof fn === 'function' ? fn(prev) : { ...prev, ...fn }
      clearTimeout(timer.current)
      timer.current = setTimeout(async () => { setGuardando(true); try { const r = await guardarFuturo(usuario, nuevo); if (r.aviso) setAviso(r.aviso) } finally { setGuardando(false) } }, 600)
      return nuevo
    })
  }
  if (!f) return <p className="text-sm text-gray-400">Cargando…</p>
  const paso = siguientePaso(f)
  const perfil = perfilIntereses(f.intereses.respuestas)
  const props = { f, actualizar, usuario, perfil }

  if (area) {
    const a = AREAS_UI.find(x => x.id === area)
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 no-print">
          <button onClick={() => { setArea(null); ir('futuro') }} className="text-gray-400 hover:text-brand-navy" aria-label="Volver"><ArrowLeft size={20} /></button>
          <div className="flex-1 min-w-0"><p className="text-xs text-gray-500">{NOMBRE_SECCION}</p><h1 className="text-xl font-semibold leading-tight">{a?.nombre}</h1></div>
          <span className="text-[11px] text-gray-500">{guardando ? 'Guardando…' : 'Guardado'}</span>
        </div>
        {aviso && <p className="text-xs text-brand-amber">{aviso}</p>}
        {area === 'conocete' && <Conocete {...props} />}
        {area === 'explora' && <Explora {...props} params={params} />}
        {area === 'compara' && <Compara {...props} />}
        {area === 'proyecto' && <Proyecto {...props} />}
        {area === 'accion' && <Accion {...props} />}
      </div>
    )
  }

  const avance = {
    conocete: perfil.suficiente && Object.keys(f.valores).length > 0, explora: f.guardadas.length > 0, compara: (f.comparacion.opciones ?? []).length >= 2,
    proyecto: f.proyecto.metas.length > 0, accion: f.actividades.length > 0,
  }
  return (
    <div className="space-y-4">
      <Titulo sub="Conocerte, explorar opciones reales, comparar, armar tu proyecto de vida y pasar a la acción. A tu ritmo: puedes parar y volver cuando quieras.">{NOMBRE_SECCION}</Titulo>
      <div className="rounded-2xl p-4 bg-gradient-to-r from-brand-blue to-indigo-500 text-[#fff]">
        <p className="text-xs uppercase tracking-wide opacity-80">Siguiente paso recomendado</p>
        <p className="font-semibold mt-1">{paso.texto}</p>
        <button onClick={() => setArea(paso.area)} className="mt-3 rounded-xl bg-[#fff] text-brand-blue font-semibold px-4 py-2 text-sm">Ir a {AREAS_UI.find(x => x.id === paso.area)?.nombre}</button>
      </div>
      <div className="space-y-2">
        {AREAS_UI.map((a, i) => { const I = a.icono; return (
          <button key={a.id} onClick={() => setArea(a.id)} className="card w-full text-left flex items-center gap-3 hover:-translate-y-0.5 transition-transform">
            <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${avance[a.id] ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-brand-blue'}`}>{avance[a.id] ? <CheckCircle2 size={20} /> : <I size={20} />}</span>
            <div className="flex-1 min-w-0"><p className="font-semibold text-brand-navy">{i + 1}. {a.nombre}</p><p className="text-xs text-gray-400">{a.que}</p></div>
            <ChevronRight size={18} className="text-gray-500 shrink-0" />
          </button>) })}
      </div>
      <p className="text-[11px] text-gray-500">Lo que escribas aquí es tuyo: no lo ve tu docente ni tus compañeros. Los resultados son orientativos y pueden cambiar; esta herramienta no reemplaza a un orientador ni a un profesional de la salud. Si estás pasando por un momento difícil, habla con un adulto de confianza o con el orientador de tu colegio.</p>
    </div>
  )
}

// ═══ 1. Conócete ═════════════════════════════════════════════════════════════
function Conocete({ f, actualizar, perfil }) {
  const [tab, setTab] = useState(perfil.suficiente ? 'resultado' : 'intereses')
  const tabs = [['intereses', 'Intereses'], ['resultado', 'Resultado'], ['habilidades', 'Habilidades'], ['valores', 'Valores'], ['entorno', 'Mi situación']]
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1 no-print">{tabs.map(([k, n]) => <button key={k} onClick={() => setTab(k)} className={`badge shrink-0 border px-3 py-1 ${tab === k ? 'border-brand-blue text-brand-blue bg-sky-50' : 'border-dark-600 text-gray-400'}`}>{n}</button>)}</div>
      {tab === 'intereses' && <Cuestionario f={f} actualizar={actualizar} perfil={perfil} alTerminar={() => setTab('resultado')} />}
      {tab === 'resultado' && <ResultadoIntereses f={f} perfil={perfil} actualizar={actualizar} />}
      {tab === 'habilidades' && <Habilidades f={f} actualizar={actualizar} />}
      {tab === 'valores' && <Valores f={f} actualizar={actualizar} />}
      {tab === 'entorno' && <Entorno f={f} actualizar={actualizar} />}
    </div>
  )
}

function Cuestionario({ f, actualizar, perfil, alTerminar }) {
  const r = f.intereses.respuestas
  const pendientes = CUESTIONARIO.items.filter(it => r[it.id] == null)
  // El bloque de 6 se mantiene en pantalla hasta pulsar "Siguientes" (las respondidas no desaparecen de golpe).
  const [ids, setIds] = useState(() => pendientes.slice(0, 6).map(it => it.id))
  const bloque = ids.map(id => CUESTIONARIO.items.find(it => it.id === id))
  const siguientes = () => setIds(CUESTIONARIO.items.filter(it => f.intereses.respuestas[it.id] == null && !ids.includes(it.id)).slice(0, 6).map(it => it.id))
  const responder = (id, v) => actualizar(prev => ({ ...prev, intereses: { ...prev.intereses, respuestas: { ...prev.intereses.respuestas, [id]: v } } }))
  return (
    <div className="space-y-3">
      <div className="card">
        <div className="flex justify-between text-sm mb-1"><span>Cuestionario de intereses</span><span className="text-gray-400">{perfil.respondidos} de {perfil.total}</span></div>
        <Barra valor={(perfil.respondidos / perfil.total) * 100} />
        <p className="text-xs text-gray-500 mt-2">Marca cuánto te gustaría hacer cada actividad. No hay respuestas buenas ni malas y no es un examen: puedes parar y seguir después. Toma como referencia seis grandes áreas de interés (modelo RIASEC), pero no es una prueba psicométrica validada: el resultado es orientativo.</p>
      </div>
      {!pendientes.length || !bloque.length ? (
        <div className="card text-center"><p className="font-medium">Terminaste el cuestionario.</p><button className="btn-primary mt-3" onClick={alTerminar}>Ver mi resultado</button></div>
      ) : bloque.map(it => (
        <div key={it.id} className="card !p-3">
          <p className="text-sm font-medium">{it.texto}</p>
          <div className="grid grid-cols-4 gap-1.5 mt-2">
            {CUESTIONARIO.escala.map(e => <button key={e.valor} onClick={() => responder(it.id, e.valor)} className={`rounded-lg border px-2 py-2 text-xs ${r[it.id] === e.valor ? 'border-brand-blue bg-sky-50 text-brand-blue font-semibold' : 'border-dark-600 text-gray-300'}`}>{e.texto}</button>)}
          </div>
        </div>
      ))}
      {pendientes.length > 0 && bloque.length > 0 && bloque.every(it => r[it.id] != null) && <button className="btn-primary w-full" onClick={siguientes}>{pendientes.length ? `Siguientes ${Math.min(6, pendientes.length)}` : 'Ver mi resultado'}</button>}
      {perfil.suficiente && pendientes.length > 0 && <button className="btn-ghost w-full text-xs" onClick={alTerminar}>Ya tengo suficiente para ver un resultado provisional ({pendientes.length} pendientes)</button>}
    </div>
  )
}

function ResultadoIntereses({ f, perfil, actualizar }) {
  if (!perfil.suficiente) return <Vacio>Responde al menos 18 preguntas del cuestionario para ver un resultado orientativo.</Vacio>
  const sug = sugerirOcupaciones(perfil)
  const guardar = (id) => actualizar(prev => ({ ...prev, guardadas: prev.guardadas.includes(`ocupacion:${id}`) ? prev.guardadas.filter(g => g !== `ocupacion:${id}`) : [...prev.guardadas, `ocupacion:${id}`] }))
  return (
    <div className="space-y-3">
      <div className="card">
        <p className="font-medium">Tus áreas de interés{!perfil.completo && <span className="text-xs text-gray-400 font-normal"> · provisional ({perfil.respondidos} de {perfil.total})</span>}</p>
        <div className="space-y-2 mt-2">
          {perfil.areas.map(a => (
            <div key={a.area}>
              <div className="flex justify-between text-sm"><span className={perfil.destacadas.some(d => d.area === a.area) ? 'font-semibold text-brand-navy' : ''}>{a.nombre}</span><span className="text-gray-400">{a.puntaje ?? '—'}{a.puntaje != null && ' %'}</span></div>
              <Barra valor={a.puntaje ?? 0} color={perfil.destacadas.some(d => d.area === a.area) ? '#1FA9EC' : '#CBD5E1'} alto={6} />
            </div>
          ))}
        </div>
        {perfil.plano ? <p className="text-sm text-gray-300 mt-3">Tus respuestas salieron parecidas en todas las áreas. Eso no es malo: puede ser que te interesen muchas cosas o que todavía no hayas probado suficiente. Las actividades de «Pasa a la acción» sirven justo para eso.</p>
          : <p className="text-sm text-gray-300 mt-3">Destacan: <b>{perfil.destacadas.map(d => d.nombre).join(', ')}</b>. {perfil.destacadas[0]?.descripcion}</p>}
        <p className="text-[11px] text-gray-500 mt-2">Esto describe lo que te gusta hoy, no quién eres para siempre. Se afina con lo que explores.</p>
      </div>
      {perfil.destacadas.length > 0 && (
        <div className="card">
          <p className="font-medium">Actividades relacionadas</p>
          <ul className="list-disc pl-5 text-sm text-gray-300 mt-1">{[...new Set(perfil.destacadas.flatMap(d => d.actividades))].map(a => <li key={a}>{a}</li>)}</ul>
        </div>
      )}
      <div className="card">
        <p className="font-medium">Ocupaciones que podrías explorar y contrastar con tu experiencia</p>
        <p className="text-xs text-gray-500 mb-2">No es «tu carrera ideal»: son puntos de partida. Guarda las que quieras comparar.</p>
        <div className="space-y-1.5">
          {sug.afines.map(({ ocupacion: o, areas_comunes }) => (
            <div key={o.id} className="flex items-center gap-2 rounded-lg bg-dark-900 p-2">
              <button className="flex-1 text-left" onClick={() => ir('futuro', { area: 'explora', ocupacion: o.id })}><p className="text-sm font-medium">{o.nombre}</p><p className="text-[11px] text-gray-500">{areas_comunes.map(a => AREAS[a].nombre).join(' · ')}</p></button>
              <button onClick={() => guardar(o.id)} className="text-brand-blue" aria-label="Guardar">{f.guardadas.includes(`ocupacion:${o.id}`) ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}</button>
            </div>
          ))}
        </div>
        {sug.panorama.length > 0 && <><p className="text-xs uppercase tracking-wide text-gray-400 mt-3 mb-1">Para abrir el panorama (no coinciden tanto, pero podrían interesarte)</p><div className="flex flex-wrap gap-1.5">{sug.panorama.map(({ ocupacion: o }) => <button key={o.id} className="badge border border-dark-600 text-gray-300" onClick={() => ir('futuro', { area: 'explora', ocupacion: o.id })}>{o.nombre}</button>)}</div></>}
      </div>
      <div className="card">
        <p className="font-medium">Para pensar</p>
        <ul className="list-disc pl-5 text-sm text-gray-300 mt-1 space-y-1">{CUESTIONARIO.reflexion.map(q => <li key={q}>{q}</li>)}</ul>
        <button className="btn-secondary mt-3 !py-2 text-sm" onClick={() => ir('futuro', { area: 'accion' })}>Ver actividades para explorar</button>
      </div>
    </div>
  )
}

function Habilidades({ f, actualizar }) {
  const set = (h, estado) => actualizar(prev => ({ ...prev, habilidades: { ...prev.habilidades, [h]: estado } }))
  const g = resumenHabilidades(f.habilidades)
  return (
    <div className="space-y-3">
      <div className="card"><p className="font-medium">Habilidades: las que tienes y las que quieres</p><p className="text-xs text-gray-500">Marca cada una con lo que mejor la describa. Una nota baja en el colegio no dice nada de tu potencial en un trabajo: aquí cuenta lo que haces, no la calificación.</p></div>
      {CUESTIONARIO.habilidades.map(h => (
        <div key={h} className="card !p-3">
          <p className="text-sm font-medium">{h}</p>
          <div className="flex flex-wrap gap-1.5 mt-1.5">{CUESTIONARIO.estados_habilidad.map(e => <button key={e.id} onClick={() => set(h, e.id)} className={`badge border px-2 py-1 ${f.habilidades[h] === e.id ? 'border-brand-blue bg-sky-50 text-brand-blue' : 'border-dark-600 text-gray-400'}`}>{e.texto}</button>)}</div>
        </div>
      ))}
      {(g.se.length + g.quiero.length) > 0 && <div className="card text-sm"><p><span className="text-brand-green">Ya sabes:</span> {g.se.join(', ') || '—'}</p><p className="mt-1"><span className="text-brand-blue">Te gustaría aprender:</span> {g.quiero.join(', ') || '—'}</p>{g.reconocen.length > 0 && <p className="mt-1"><span className="text-brand-amber">Otros reconocen:</span> {g.reconocen.join(', ')}</p>}</div>}
    </div>
  )
}

function Valores({ f, actualizar }) {
  const set = (id, v) => actualizar(prev => ({ ...prev, valores: { ...prev.valores, [id]: v } }))
  const conflictos = conflictosDeValores(f.valores)
  const ESC = [[0, 'No importa'], [1, 'Poco'], [2, 'Importante'], [3, 'Esencial']]
  return (
    <div className="space-y-3">
      <div className="card"><p className="font-medium">¿Qué importa en un trabajo para ti?</p><p className="text-xs text-gray-500">No todo puede ser esencial: elegir es parte del ejercicio.</p></div>
      {CUESTIONARIO.valores.map(v => (
        <div key={v.id} className="card !p-3">
          <p className="text-sm font-medium">{v.nombre} <span className="text-gray-500 font-normal">· {v.descripcion}</span></p>
          <div className="grid grid-cols-4 gap-1.5 mt-1.5">{ESC.map(([n, t]) => <button key={n} onClick={() => set(v.id, n)} className={`rounded-lg border px-2 py-1.5 text-xs ${Number(f.valores[v.id]) === n && f.valores[v.id] != null ? 'border-brand-blue bg-sky-50 text-brand-blue font-semibold' : 'border-dark-600 text-gray-400'}`}>{t}</button>)}</div>
        </div>
      ))}
      {conflictos.length > 0 && (
        <div className="card border-brand-amber/50">
          <p className="font-medium flex items-center gap-2"><AlertTriangle size={16} className="text-brand-amber" /> Preferencias que pueden chocar</p>
          {conflictos.map((c, i) => <p key={i} className="text-sm text-gray-300 mt-2">{c.texto}</p>)}
          <p className="text-[11px] text-gray-500 mt-2">No es un problema tenerlas: es información para comparar opciones con los ojos abiertos.</p>
        </div>
      )}
    </div>
  )
}

function Entorno({ f, actualizar }) {
  const set = (id, v) => actualizar(prev => ({ ...prev, entorno: { ...prev.entorno, [id]: v } }))
  return (
    <div className="space-y-3">
      <div className="card"><p className="font-medium">Tu situación (opcional)</p><p className="text-xs text-gray-500">{CUESTIONARIO.entorno._nota} Puedes dejar en blanco lo que no quieras responder.</p></div>
      {CUESTIONARIO.entorno.campos.map(c => (
        <div key={c.id} className="card !p-3">
          <label className="label">{c.etiqueta}</label>
          {c.tipo === 'texto' && <input className="input" value={f.entorno[c.id] ?? ''} onChange={e => set(c.id, e.target.value)} placeholder={c.ayuda ?? ''} />}
          {c.tipo === 'opcion' && <div className="flex flex-wrap gap-1.5">{c.opciones.map(o => <button key={o} onClick={() => set(c.id, f.entorno[c.id] === o ? '' : o)} className={`badge border px-2 py-1 ${f.entorno[c.id] === o ? 'border-brand-blue bg-sky-50 text-brand-blue' : 'border-dark-600 text-gray-400'}`}>{o}</button>)}</div>}
          {c.tipo === 'multi' && <div className="flex flex-wrap gap-1.5">{c.opciones.map(o => { const sel = (f.entorno[c.id] ?? []).includes(o); return <button key={o} onClick={() => set(c.id, sel ? (f.entorno[c.id] ?? []).filter(x => x !== o) : [...(f.entorno[c.id] ?? []), o])} className={`badge border px-2 py-1 ${sel ? 'border-brand-blue bg-sky-50 text-brand-blue' : 'border-dark-600 text-gray-400'}`}>{o}</button> })}</div>}
          {c.ayuda && c.tipo !== 'texto' && <p className="text-[11px] text-gray-500 mt-1">{c.ayuda}</p>}
        </div>
      ))}
    </div>
  )
}

// ═══ 2. Explora ══════════════════════════════════════════════════════════════
function Explora({ f, actualizar, perfil, params }) {
  const [tab, setTab] = useState(params.ocupacion ? 'ocupaciones' : (params.tab ?? 'ocupaciones'))
  const [abierta, setAbierta] = useState(params.ocupacion ?? null)
  const [busqueda, setBusqueda] = useState('')
  useEffect(() => { if (params.ocupacion) { setAbierta(params.ocupacion); setTab('ocupaciones') } }, [params.ocupacion])
  const toggle = (clave) => actualizar(prev => ({ ...prev, guardadas: prev.guardadas.includes(clave) ? prev.guardadas.filter(g => g !== clave) : [...prev.guardadas, clave] }))
  const sug = sugerirOcupaciones(perfil)
  const afines = new Set(sug.afines.map(a => a.ocupacion.id))
  const lista = OCUPACIONES.filter(o => !busqueda || (o.nombre + ' ' + o.sector.join(' ')).toLowerCase().includes(busqueda.toLowerCase())).sort((a, b) => (afines.has(b.id) - afines.has(a.id)) || a.nombre.localeCompare(b.nombre, 'es'))
  const tabs = [['ocupaciones', 'Ocupaciones'], ['formacion', 'Tipos de formación'], ['fuentes', 'Dónde buscar'], ['oportunidades', 'Becas y apoyos']]
  if (abierta) { const o = ocupacionPorId(abierta); if (o) return <FichaOcupacion o={o} f={f} toggle={toggle} volver={() => { setAbierta(null); ir('futuro', { area: 'explora' }) }} /> }
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1 no-print">{tabs.map(([k, n]) => <button key={k} onClick={() => setTab(k)} className={`badge shrink-0 border px-3 py-1 ${tab === k ? 'border-brand-blue text-brand-blue bg-sky-50' : 'border-dark-600 text-gray-400'}`}>{n}</button>)}</div>
      {tab === 'ocupaciones' && (
        <>
          <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input className="input !pl-9" placeholder="Buscar ocupación o sector" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></div>
          <p className="text-[11px] text-gray-500">{OCUPACIONES.length} ocupaciones descritas en lenguaje sencillo, con lo bueno y lo difícil. {afines.size ? 'Primero las afines a tus áreas.' : 'Responde el cuestionario para ver primero las afines a ti.'}</p>
          <div className="space-y-1.5">
            {lista.map(o => (
              <div key={o.id} className="flex items-center gap-2 card !p-3">
                <button className="flex-1 text-left min-w-0" onClick={() => setAbierta(o.id)}>
                  <p className="font-medium text-brand-navy flex items-center gap-2 flex-wrap">{o.nombre}{afines.has(o.id) && <Badge tono="azul">afín</Badge>}</p>
                  <p className="text-xs text-gray-400 truncate">{o.que_hace}</p>
                </button>
                <button onClick={() => toggle(`ocupacion:${o.id}`)} className="text-brand-blue shrink-0" aria-label="Guardar">{f.guardadas.includes(`ocupacion:${o.id}`) ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}</button>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === 'formacion' && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Una misma ocupación admite varias rutas. Los costos no aparecen aquí porque cambian por institución: se consultan en la fuente oficial de cada una.</p>
          {FORMACION.map(t => (
            <div key={t.id} className="card">
              <div className="flex items-start justify-between gap-2"><p className="font-semibold text-brand-navy">{t.nombre}</p><Badge>{t.duracion}</Badge></div>
              <p className="text-xs text-gray-500">{t.nivel}</p>
              <p className="text-sm text-gray-300 mt-1">{t.que_es}</p>
              <p className="text-sm mt-1"><span className="text-gray-500">Requisitos:</span> {t.requisitos}</p>
              <p className="text-sm mt-1"><span className="text-brand-green">A favor:</span> {t.ventajas}</p>
              <p className="text-sm mt-1"><span className="text-brand-amber">Límites:</span> {t.limites}</p>
              {fuentePorId(t.fuente) && <a href={fuentePorId(t.fuente).url} target="_blank" rel="noreferrer" className="text-xs text-brand-blue inline-flex items-center gap-1 mt-1"><ExternalLink size={12} /> {fuentePorId(t.fuente).nombre}</a>}
            </div>
          ))}
        </div>
      )}
      {tab === 'fuentes' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">No hay una API pública para traer programas en vivo; estas son búsquedas guiadas en los portales oficiales. Cada enlace dice cuándo se verificó.</p>
          {[['Formación', FUENTES.formacion], ['Trabajo y empleabilidad', FUENTES.trabajo], ['Apoyos y examen', FUENTES.apoyos]].map(([t, lista]) => (
            <div key={t} className="card">
              <p className="font-medium mb-2">{t}</p>
              <div className="space-y-2">{lista.map(s => (
                <div key={s.id} className="rounded-lg bg-dark-900 p-2.5">
                  <div className="flex items-start justify-between gap-2"><a href={s.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-blue inline-flex items-center gap-1">{s.nombre} <ExternalLink size={12} /></a><Badge tono={s.estado === 'activa' ? 'verde' : 'ambar'}>{s.estado === 'activa' ? 'verificada' : 'no verificada'}</Badge></div>
                  <p className="text-xs text-gray-300 mt-1">{s.que_ofrece}</p>
                  {s.como_usar && <p className="text-xs text-gray-500 mt-1">Cómo usarla: {s.como_usar}</p>}
                  <p className="text-[10px] text-gray-500 mt-1">Verificada el {s.verificado}</p>
                </div>))}</div>
            </div>
          ))}
        </div>
      )}
      {tab === 'oportunidades' && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Nadie garantiza una beca o un cupo: cada entidad decide. Guarda las que apliquen y anota en tu proyecto la acción para postularte.</p>
          {OPORTUNIDADES.map(o => { const tono = { abierta: 'verde', cerrada: 'rojo', anunciada: 'azul', desconocida: 'gris' }[o.vigencia]; return (
            <div key={o.id} className="card">
              <div className="flex items-start justify-between gap-2"><p className="font-semibold text-brand-navy">{o.nombre}</p><button onClick={() => toggle(`oportunidad:${o.id}`)} className="text-brand-blue shrink-0" aria-label="Guardar">{f.guardadas.includes(`oportunidad:${o.id}`) ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}</button></div>
              <p className="text-xs text-gray-500">{o.entidad} · <Badge tono={tono}>vigencia {o.vigencia}</Badge></p>
              <p className="text-sm text-gray-300 mt-1">{o.cobertura}</p>
              <p className="text-sm mt-1"><span className="text-gray-500">Requisitos:</span> {o.requisitos}</p>
              <p className="text-sm mt-1"><span className="text-gray-500">Fechas:</span> {o.fechas}</p>
              <p className="text-[11px] text-gray-500 mt-1">Consultado el {o.consultado}. {o.verificacion}</p>
              {o.url && (o.url.startsWith('#') ? <a href={o.url} className="text-xs text-brand-blue inline-flex items-center gap-1 mt-1">Ver en la Guía ICFES <ChevronRight size={12} /></a> : <a href={o.url} target="_blank" rel="noreferrer" className="text-xs text-brand-blue inline-flex items-center gap-1 mt-1"><ExternalLink size={12} /> Enlace oficial</a>)}
            </div>) })}
        </div>
      )}
    </div>
  )
}

function FichaOcupacion({ o, f, toggle, volver }) {
  const guardada = f.guardadas.includes(`ocupacion:${o.id}`)
  const carreras = carrerasDeOcupacion(o)
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2"><button onClick={volver} aria-label="Volver" className="no-print mt-1 text-gray-400"><ArrowLeft size={20} /></button><div className="flex-1"><h2 className="text-lg font-semibold leading-tight">{o.nombre}</h2><p className="text-xs text-gray-400">{o.areas.map(a => AREAS[a].nombre).join(' · ')}</p></div><button onClick={() => toggle(`ocupacion:${o.id}`)} className={`btn-secondary !py-1.5 text-xs ${guardada ? 'text-brand-blue' : ''}`}>{guardada ? <BookmarkCheck size={14} /> : <Bookmark size={14} />} {guardada ? 'Guardada' : 'Guardar'}</button></div>
      {[['Qué hace', o.que_hace], ['Cómo puede ser un día de trabajo', o.jornada], ['Qué problemas resuelve', o.problemas]].map(([t, x]) => <div key={t} className="card !p-3"><p className="text-xs uppercase tracking-wide text-gray-400 mb-1">{t}</p><p className="text-sm">{x}</p></div>)}
      <div className="card !p-3"><p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Actividades frecuentes</p><div className="flex flex-wrap gap-1.5">{o.actividades.map(a => <Badge key={a}>{a}</Badge>)}</div></div>
      <div className="card !p-3"><p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Conocimientos y habilidades que usa</p><div className="flex flex-wrap gap-1.5">{o.habilidades.map(a => <Badge key={a} tono="azul">{a}</Badge>)}</div></div>
      <div className="card !p-3 border-brand-amber/40"><p className="text-xs uppercase tracking-wide text-amber-700 mb-1">Lo difícil o poco atractivo</p><p className="text-sm">{o.dificil}</p></div>
      <div className="card !p-3"><p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Sectores donde se trabaja</p><p className="text-sm">{o.sector.join(' · ')}</p></div>
      <div className="card !p-3">
        <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Rutas para llegar (una ocupación no es un solo título)</p>
        <ul className="list-disc pl-5 text-sm space-y-1">{o.rutas.map((r, i) => <li key={i}>{r.texto}</li>)}</ul>
        {carreras.length > 0 && (
          <div className="mt-2 border-t border-dark-700 pt-2">
            <p className="text-xs text-gray-500">Si te interesa, las pruebas del ICFES que más pesan en la admisión de estas carreras (información complementaria; un puntaje bajo no te excluye):</p>
            {carreras.map(c => <p key={c.id} className="text-xs mt-1"><span className="font-medium">{c.nombre}:</span> {pruebasQuePesan(c.id).map(p => nombrePrueba(p.prueba)).join(', ')} · <button className="text-brand-blue" onClick={() => ir('carreras')}>activar en modo carrera</button></p>)}
          </div>
        )}
      </div>
      {o.especializacion?.length > 0 && <div className="card !p-3"><p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Especializaciones posibles</p><p className="text-sm">{o.especializacion.join(' · ')}</p></div>}
      <div className="card !p-3">
        <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Para ampliar (fuentes oficiales)</p>
        <div className="flex flex-wrap gap-2">{o.fuentes.map(fuentePorId).filter(Boolean).map(s => <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="badge border border-dark-600 text-brand-blue"><ExternalLink size={12} /> {s.nombre.split(':')[0]}</a>)}</div>
        <p className="text-[11px] text-gray-500 mt-2">Esta ficha es una descripción general escrita para esta app; ingresos y empleabilidad se consultan en el Observatorio Laboral, que publica datos oficiales por programa. No incluye salarios para no inventarlos.</p>
      </div>
      <div className="flex gap-2 no-print"><button className="btn-primary flex-1" onClick={() => ir('futuro', { area: 'compara' })}>Comparar con otras</button><button className="btn-secondary flex-1" onClick={() => ir('futuro', { area: 'accion' })}>Probarla con una actividad</button></div>
    </div>
  )
}

// ═══ 3. Compara ══════════════════════════════════════════════════════════════
function Compara({ f, actualizar }) {
  const c = f.comparacion
  const guardadas = f.guardadas.filter(g => g.startsWith('ocupacion:')).map(g => ocupacionPorId(g.slice(10))).filter(Boolean)
  const [nueva, setNueva] = useState('')
  const setC = (cambios) => actualizar(prev => ({ ...prev, comparacion: { ...prev.comparacion, ...cambios } }))
  const agregar = (id, nombre) => { if (c.opciones.length >= 4 || c.opciones.some(o => o.id === id)) return; setC({ opciones: [...c.opciones, { id, nombre }] }) }
  const quitar = (id) => setC({ opciones: c.opciones.filter(o => o.id !== id) })
  const valorar = (opId, critId, v) => setC({ respuestas: { ...c.respuestas, [opId]: { ...(c.respuestas[opId] ?? {}), [critId]: v } } })
  const res = compararOpciones(c)
  const ESC = ['1', '2', '3', '4', '5']
  return (
    <div className="space-y-3">
      <div className="card">
        <p className="font-medium">Elige de 2 a 4 opciones</p>
        <p className="text-xs text-gray-500 mb-2">Ocupaciones guardadas, o escribe otra (una carrera, un programa, «trabajar y estudiar de noche»).</p>
        <div className="flex flex-wrap gap-1.5">{guardadas.map(o => <button key={o.id} disabled={c.opciones.some(x => x.id === o.id)} onClick={() => agregar(o.id, o.nombre)} className="badge border border-dark-600 text-gray-300 disabled:opacity-40"><Plus size={12} /> {o.nombre}</button>)}</div>
        <div className="flex gap-2 mt-2"><input className="input" placeholder="Otra opción" value={nueva} onChange={e => setNueva(e.target.value)} /><button className="btn-secondary shrink-0" onClick={() => { if (nueva.trim()) { agregar('propia:' + uuid().slice(0, 8), nueva.trim()); setNueva('') } }}>Agregar</button></div>
        {c.opciones.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">{c.opciones.map(o => <span key={o.id} className="badge border border-brand-blue text-brand-blue">{o.nombre} <button onClick={() => quitar(o.id)} aria-label="Quitar"><Trash2 size={12} /></button></span>)}</div>}
      </div>
      {c.opciones.length >= 2 && (
        <>
          <div className="card">
            <p className="font-medium">¿Qué tanto pesa cada criterio para ti?</p>
            <div className="space-y-1.5 mt-2">{CRITERIOS.map(cr => (
              <div key={cr.id} className="flex items-center justify-between gap-2 text-sm"><span className="min-w-0"><span>{cr.nombre}</span><span className="block text-[11px] text-gray-500">{cr.ayuda}</span></span><div className="flex gap-1 shrink-0">{[[0, 'No'], [1, 'Poco'], [2, 'Sí'], [3, 'Mucho']].map(([n, t]) => <button key={n} onClick={() => setC({ pesos: { ...c.pesos, [cr.id]: n } })} className={`rounded px-1.5 py-0.5 text-[11px] border ${Number(c.pesos[cr.id] ?? 2) === n ? 'border-brand-blue text-brand-blue bg-sky-50' : 'border-dark-600 text-gray-400'}`}>{t}</button>)}</div></div>))}</div>
          </div>
          <div className="card overflow-x-auto">
            <p className="font-medium mb-1">Valora cada opción (1 = mal, 5 = muy bien). Deja vacío lo que no sepas.</p>
            <table className="w-full text-xs">
              <thead><tr className="text-gray-500 text-left"><th className="py-1 pr-2">Criterio</th>{c.opciones.map(o => <th key={o.id} className="pr-2">{o.nombre}</th>)}</tr></thead>
              <tbody>{CRITERIOS.filter(cr => Number(c.pesos[cr.id] ?? 2) > 0).map(cr => (
                <tr key={cr.id} className="border-t border-dark-700"><td className="py-1.5 pr-2">{cr.nombre}</td>{c.opciones.map(o => <td key={o.id} className="pr-2"><select className="input !py-1 !px-1.5 text-xs" value={c.respuestas[o.id]?.[cr.id] ?? ''} onChange={e => valorar(o.id, cr.id, e.target.value)}><option value="">sin dato</option>{ESC.map(v => <option key={v} value={v}>{v}</option>)}</select></td>)}</tr>))}</tbody>
            </table>
          </div>
          <div className="card">
            <p className="font-medium">Lectura de la comparación</p>
            <p className="text-xs text-gray-500 mb-2">No es un ranking ni una probabilidad de éxito: resume lo que tú valoraste con los pesos que tú pusiste. Lo que falta por investigar pesa tanto como lo que sabes.</p>
            <div className="space-y-2">{res.map(r => (
              <div key={r.opcion.id} className="rounded-lg bg-dark-900 p-3">
                <div className="flex items-center justify-between"><p className="font-medium text-sm">{r.opcion.nombre}</p><span className="text-sm">{r.promedio != null ? `${r.promedio} / 5` : 'sin datos'} <span className="text-[11px] text-gray-500">· {r.cobertura} % de criterios valorados</span></span></div>
                {r.sin_dato.length > 0 && <p className="text-xs text-brand-amber mt-1">Pendiente de investigar: {r.sin_dato.map(x => x.nombre.toLowerCase()).join('; ')}.</p>}
              </div>))}</div>
          </div>
          <div className="card">
            <p className="font-medium">Para decidir con cabeza</p>
            {PREGUNTAS_COMPARACION.map(q => <div key={q} className="mt-2"><label className="text-sm">{q}</label><textarea className="input mt-1" rows={2} value={c.notas[q] ?? ''} onChange={e => setC({ notas: { ...c.notas, [q]: e.target.value } })} /></div>)}
          </div>
        </>
      )}
      {c.opciones.length < 2 && <Vacio>Agrega al menos dos opciones para comparar.</Vacio>}
    </div>
  )
}

// ═══ 4. Proyecto de vida ═════════════════════════════════════════════════════
function Proyecto({ f, actualizar }) {
  const [tab, setTab] = useState('metas')
  const p = f.proyecto
  const setP = (cambios) => actualizar(prev => ({ ...prev, proyecto: { ...prev.proyecto, ...cambios } }))
  const plan = planAccion(f)
  const tabs = [['partida', 'Punto de partida'], ['vision', 'Visión'], ['metas', 'Metas'], ['plan', 'Plan 30 / 90 días']]
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1 no-print">{tabs.map(([k, n]) => <button key={k} onClick={() => setTab(k)} className={`badge shrink-0 border px-3 py-1 ${tab === k ? 'border-brand-blue text-brand-blue bg-sky-50' : 'border-dark-600 text-gray-400'}`}>{n}</button>)}</div>
      {tab === 'partida' && (
        <div className="space-y-2">
          <div className="card"><p className="font-medium">Dimensiones que te importan hoy</p><p className="text-xs text-gray-500 mb-2">No tienes que tener metas en todas. Marca las que sí.</p><div className="flex flex-wrap gap-1.5">{DIMENSIONES.map(d => { const sel = p.dimensiones.includes(d.id); return <button key={d.id} onClick={() => setP({ dimensiones: sel ? p.dimensiones.filter(x => x !== d.id) : [...p.dimensiones, d.id] })} className={`badge border px-2 py-1 ${sel ? 'border-brand-blue bg-sky-50 text-brand-blue' : 'border-dark-600 text-gray-400'}`}>{d.nombre}</button> })}</div></div>
          {PUNTO_PARTIDA.map(q => <div key={q.id} className="card !p-3"><label className="text-sm font-medium">{q.texto}</label><textarea className="input mt-1" rows={2} value={p.punto_partida[q.id] ?? ''} onChange={e => setP({ punto_partida: { ...p.punto_partida, [q.id]: e.target.value } })} /></div>)}
        </div>
      )}
      {tab === 'vision' && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Imagina escenarios a 1, 3 y 5 años. No son compromisos: son borradores que puedes cambiar cuando cambies tú.</p>
          {[1, 3, 5].map(h => (
            <div key={h} className="card">
              <p className="font-medium">Dentro de {h} año{h > 1 ? 's' : ''}</p>
              {VISION.map(q => <div key={q.id} className="mt-2"><label className="text-xs text-gray-400">{q.texto}</label><textarea className="input mt-0.5" rows={1} value={p.vision[h]?.[q.id] ?? ''} onChange={e => setP({ vision: { ...p.vision, [h]: { ...(p.vision[h] ?? {}), [q.id]: e.target.value } } })} /></div>)}
            </div>
          ))}
        </div>
      )}
      {tab === 'metas' && <Metas f={f} actualizar={actualizar} />}
      {tab === 'plan' && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Generado con tus metas, tu situación y lo que falta explorar. Es una propuesta, no un calendario obligatorio: ajusta lo que no te sirva.</p>
          {[['Próximos 30 días', plan.dias30], ['Próximos 90 días', plan.dias90]].map(([t, lista]) => (
            <div key={t} className="card">
              <p className="font-medium mb-2">{t}</p>
              <ul className="space-y-2">{lista.map((x, i) => (
                <li key={i} className="flex items-start gap-2 text-sm"><span className="w-5 h-5 rounded-full bg-sky-50 text-brand-blue text-[11px] font-semibold flex items-center justify-center shrink-0 mt-0.5">{x.tipo === 'nota' ? '!' : i + 1}</span><div><p>{x.texto}</p>{x.minutos && <p className="text-[11px] text-gray-500">~{x.minutos} min</p>}{x.actividad_id && <button className="text-xs text-brand-blue" onClick={() => ir('futuro', { area: 'accion', actividad: x.actividad_id })}>Abrir actividad</button>}</div></li>))}</ul>
            </div>
          ))}
          <button className="btn-ghost w-full text-sm no-print" onClick={() => window.print()}><Printer size={16} /> Imprimir mi plan</button>
        </div>
      )}
    </div>
  )
}

function Metas({ f, actualizar }) {
  const metas = f.proyecto.metas
  const [editando, setEditando] = useState(null)
  const guardarMeta = (m) => actualizar(prev => ({ ...prev, proyecto: { ...prev.proyecto, metas: prev.proyecto.metas.some(x => x.id === m.id) ? prev.proyecto.metas.map(x => (x.id === m.id ? m : x)) : [...prev.proyecto.metas, m] } }))
  const cambiarEstado = (m, estado, nota = '') => guardarMeta({ ...m, estado, historial: [...(m.historial ?? []), { fecha: ahora(), de: m.estado, a: estado, nota }] })
  const borrar = (id) => { if (confirm('¿Borrar esta meta? Se pierde su historial.')) actualizar(prev => ({ ...prev, proyecto: { ...prev.proyecto, metas: prev.proyecto.metas.filter(x => x.id !== id) } })) }
  if (editando) return <FormMeta meta={editando} onGuardar={(m) => { guardarMeta(m); setEditando(null) }} onCancelar={() => setEditando(null)} />
  const tono = { idea: 'gris', en_curso: 'azul', pausada: 'ambar', lograda: 'verde', replanteada: 'morado' }
  return (
    <div className="space-y-2">
      <div className="card"><p className="font-medium">Metas y acciones</p><p className="text-xs text-gray-500">Una meta sirve cuando tiene un primer paso concreto y una fecha. Ejemplo: «estudiar ingeniería de sistemas» → primer paso: investigar tres programas y hacer un curso gratuito de programación.</p><button className="btn-primary mt-3 !py-2 text-sm" onClick={() => setEditando(metaNueva())}><Plus size={16} /> Nueva meta</button></div>
      {metas.length === 0 && <Vacio>Todavía no tienes metas. Empieza con una pequeña.</Vacio>}
      {metas.map(m => (
        <div key={m.id} className="card">
          <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="font-semibold text-brand-navy">{m.titulo || '(sin título)'}</p><p className="text-xs text-gray-400">{DIMENSIONES.find(d => d.id === m.dimension)?.nombre} · {m.horizonte}{m.fecha_objetivo && ` · para ${m.fecha_objetivo}`}</p></div><Badge tono={tono[m.estado]}>{ESTADOS_META[m.estado]}</Badge></div>
          {m.por_que && <p className="text-sm text-gray-300 mt-1">Por qué: {m.por_que}</p>}
          {m.primer_paso && <p className="text-sm mt-1"><span className="text-gray-500">Primer paso:</span> {m.primer_paso}</p>}
          {m.indicador && <p className="text-xs text-gray-500 mt-1">Sabré que avanzo cuando: {m.indicador}</p>}
          <div className="flex flex-wrap gap-1.5 mt-2 no-print">
            <button className="btn-secondary !py-1 text-xs" onClick={() => setEditando(m)}>Editar</button>
            {m.estado !== 'en_curso' && m.estado !== 'lograda' && <button className="btn-secondary !py-1 text-xs" onClick={() => cambiarEstado(m, 'en_curso')}>Empezar</button>}
            {m.estado === 'en_curso' && <button className="btn-secondary !py-1 text-xs" onClick={() => cambiarEstado(m, 'lograda')}>Lograda</button>}
            {m.estado === 'en_curso' && <button className="btn-secondary !py-1 text-xs" onClick={() => cambiarEstado(m, 'pausada')}>Pausar</button>}
            {m.estado !== 'replanteada' && <button className="btn-secondary !py-1 text-xs" onClick={() => { const nota = prompt(PREGUNTAS_CAMBIO.join('\n\n') + '\n\nEscribe lo que pensaste (opcional):') ?? ''; cambiarEstado(m, 'replanteada', nota) }}>Replantear</button>}
            <button className="btn-ghost !py-1 text-xs text-brand-red" aria-label="Borrar meta" onClick={() => borrar(m.id)}><Trash2 size={12} /></button>
          </div>
          {m.estado === 'replanteada' && <p className="text-xs text-gray-400 mt-2">Cambiar de rumbo no es fracasar: es usar información nueva. {m.alternativa ? `Tu alternativa era: ${m.alternativa}.` : 'Si quieres, crea una meta nueva con lo que aprendiste.'}</p>}
          {(m.historial ?? []).length > 0 && <p className="text-[11px] text-gray-500 mt-1">{m.historial.length} cambio(s) de estado registrados.</p>}
        </div>
      ))}
    </div>
  )
}

function FormMeta({ meta, onGuardar, onCancelar }) {
  const [m, setM] = useState(meta)
  const set = (k, v) => setM(x => ({ ...x, [k]: v }))
  const campos = [['titulo', 'Título', 'input'], ['descripcion', 'Descripción', 'textarea'], ['por_que', '¿Por qué es importante para ti?', 'textarea'], ['primer_paso', 'Primer paso concreto', 'input'], ['recursos', 'Recursos que necesitas', 'input'], ['obstaculos', 'Posibles obstáculos', 'input'], ['alternativa', 'Alternativa si el plan inicial falla', 'input'], ['indicador', 'Indicador observable de avance', 'input']]
  return (
    <div className="card space-y-2">
      <p className="font-medium">{meta.titulo ? 'Editar meta' : 'Nueva meta'}</p>
      {campos.map(([k, l, t]) => <div key={k}><label className="label">{l}</label>{t === 'input' ? <input className="input" value={m[k]} onChange={e => set(k, e.target.value)} /> : <textarea className="input" rows={2} value={m[k]} onChange={e => set(k, e.target.value)} />}</div>)}
      <div className="grid grid-cols-3 gap-2">
        <div><label className="label">Dimensión</label><select className="input" value={m.dimension} onChange={e => set('dimension', e.target.value)}>{DIMENSIONES.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}</select></div>
        <div><label className="label">Horizonte</label><select className="input" value={m.horizonte} onChange={e => set('horizonte', e.target.value)}>{['30 días', '90 días', '1 año', '3 años', '5 años'].map(h => <option key={h}>{h}</option>)}</select></div>
        <div><label className="label">Fecha objetivo</label><input className="input" type="date" value={m.fecha_objetivo} onChange={e => set('fecha_objetivo', e.target.value)} /></div>
      </div>
      <div className="flex gap-2"><button className="btn-primary flex-1" disabled={!m.titulo.trim()} onClick={() => onGuardar(m)}>Guardar meta</button><button className="btn-secondary" onClick={onCancelar}>Cancelar</button></div>
    </div>
  )
}

// ═══ 5. Pasa a la acción ═════════════════════════════════════════════════════
function Accion({ f, actualizar, perfil }) {
  const [tab, setTab] = useState('actividades')
  const [abierta, setAbierta] = useState(null)
  const hechas = f.actividades
  const areasAltas = new Set(perfil.destacadas.map(d => d.area))
  const lista = [...ACTIVIDADES].sort((a, b) => (b.areas.some(x => areasAltas.has(x)) - a.areas.some(x => areasAltas.has(x))))
  const registrar = (act, respuestas) => actualizar(prev => ({ ...prev, actividades: [...prev.actividades, { id: uuid(), actividad_id: act.id, fecha: ahora(), respuestas }] }))
  if (abierta) return <FichaActividad act={abierta} previas={hechas.filter(h => h.actividad_id === abierta.id)} onRegistrar={(r) => { registrar(abierta, r); setAbierta(null) }} volver={() => setAbierta(null)} />
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 no-print">{[['actividades', 'Actividades'], ['conversacion', 'Hablar con mi familia o un mentor'], ['registro', `Mi registro (${hechas.length})`]].map(([k, n]) => <button key={k} onClick={() => setTab(k)} className={`badge border px-3 py-1 ${tab === k ? 'border-brand-blue text-brand-blue bg-sky-50' : 'border-dark-600 text-gray-400'}`}>{n}</button>)}</div>
      {tab === 'actividades' && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">La única forma de saber si algo te gusta es probarlo. Cada actividad dice qué descubres y cuánto tarda; al final registras lo que aprendiste.</p>
          {lista.map(a => (
            <button key={a.id} className="card w-full text-left" onClick={() => setAbierta(a)}>
              <div className="flex items-start justify-between gap-2"><p className="font-semibold text-brand-navy">{a.titulo}</p><div className="flex gap-1 shrink-0"><Badge>{a.minutos >= 60 ? `${Math.round(a.minutos / 60)} h` : `${a.minutos} min`}</Badge>{hechas.some(h => h.actividad_id === a.id) && <Badge tono="verde">hecha</Badge>}</div></div>
              <p className="text-xs text-gray-400 mt-1">{a.descubre}</p>
            </button>
          ))}
        </div>
      )}
      {tab === 'conversacion' && <Conversacion />}
      {tab === 'registro' && (
        <div className="space-y-2">
          {!hechas.length && <Vacio>Aún no has registrado actividades.</Vacio>}
          {[...hechas].reverse().map(h => { const a = ACTIVIDADES.find(x => x.id === h.actividad_id); return (
            <div key={h.id} className="card">
              <p className="font-medium text-sm">{a?.titulo ?? h.actividad_id} <span className="text-xs text-gray-500 font-normal">· {new Date(h.fecha).toLocaleDateString('es-CO')}</span></p>
              {Object.entries(h.respuestas ?? {}).filter(([, v]) => v).map(([q, v]) => <p key={q} className="text-xs mt-1"><span className="text-gray-500">{q}</span> {v}</p>)}
            </div>) })}
        </div>
      )}
    </div>
  )
}

function FichaActividad({ act, previas, onRegistrar, volver }) {
  const [r, setR] = useState({})
  const [registro, setRegistro] = useState('')
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2"><button onClick={volver} aria-label="Volver" className="no-print mt-1 text-gray-400"><ArrowLeft size={20} /></button><div><h2 className="text-lg font-semibold leading-tight">{act.titulo}</h2><p className="text-xs text-gray-400">~{act.minutos} min · {act.descubre}</p></div></div>
      <div className="card"><p className="font-medium mb-1">Pasos</p><ol className="list-decimal pl-5 text-sm space-y-1">{act.pasos.map(p => <li key={p}>{p}</li>)}</ol><p className="text-xs text-gray-500 mt-2">Cómo registrarlo: {act.registro}</p></div>
      <div className="card">
        <p className="font-medium">Cuando la hayas hecho, cuéntate qué pasó</p>
        <div className="mt-2"><label className="label">Lo que hice / aprendí</label><textarea className="input" rows={3} value={registro} onChange={e => setRegistro(e.target.value)} /></div>
        {REFLEXION_ACTIVIDAD.map(q => <div key={q} className="mt-2"><label className="text-sm">{q}</label><input className="input mt-1" value={r[q] ?? ''} onChange={e => setR({ ...r, [q]: e.target.value })} /></div>)}
        <button className="btn-primary w-full mt-3" disabled={!registro.trim()} onClick={() => onRegistrar({ 'Lo que hice / aprendí': registro, ...r })}>Registrar actividad</button>
        <p className="text-[11px] text-gray-500 mt-2">Tus respuestas son evidencia de lo que exploraste, no un diagnóstico de personalidad.</p>
      </div>
      {previas.length > 0 && <p className="text-xs text-gray-500">Ya la registraste {previas.length} vez/veces. Repetirla con otra persona u otro tema también cuenta.</p>}
    </div>
  )
}

function Conversacion() {
  const c = CONVERSACION
  return (
    <div className="space-y-3">
      <div className="card"><p className="font-medium flex items-center gap-2"><Users size={18} className="text-brand-blue" /> Prepararte para hablar del futuro</p><p className="text-sm text-gray-300 mt-1">{c.introduccion}</p><p className="text-[11px] text-gray-500 mt-2">{c._nota}</p></div>
      {c.bloques.map(b => <div key={b.titulo} className="card"><p className="font-medium mb-1">{b.titulo}</p><ul className="list-disc pl-5 text-sm space-y-1 text-gray-300">{b.preguntas.map(q => <li key={q}>{q}</li>)}</ul></div>)}
      <div className="card"><p className="font-medium mb-1">Para expresar desacuerdos con respeto</p><ul className="list-disc pl-5 text-sm space-y-1 text-gray-300">{c.recomendaciones.map(q => <li key={q}>{q}</li>)}</ul></div>
      <div className="card"><p className="font-medium mb-1">Frases que pueden ayudar</p>{c.frases.map(fr => <div key={fr.situacion} className="rounded-lg bg-dark-900 p-2.5 mt-2"><p className="text-xs text-gray-500">{fr.situacion}</p><p className="text-sm">“{fr.frase}”</p></div>)}</div>
      <button className="btn-ghost w-full text-sm no-print" onClick={() => window.print()}><Printer size={16} /> Imprimir estas preguntas</button>
    </div>
  )
}
