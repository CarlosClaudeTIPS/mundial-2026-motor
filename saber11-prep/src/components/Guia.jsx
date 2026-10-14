import { useEffect, useMemo, useState } from 'react'
import { BookOpenCheck, ExternalLink, MapPin, Search, ChevronRight, ArrowLeft, Printer } from 'lucide-react'
import { Titulo, Badge, Md, Vacio } from './ui'

// ─── Guía del ICFES ──────────────────────────────────────────────────────────
// Qué es el examen, cómo se califica, para qué sirve y qué piden las universidades
// de cada ciudad. Contenido en content/guia/*.json (ver content/guia/ESQUEMA.md).

// Los JSON de la guía (~360 KB) se descargan solo al abrir esta pantalla, no en el paquete inicial.
const archivos = import.meta.glob('../../content/guia/*.json', { import: 'default' })
let DATOS = null // { SECCIONES, UNIVERSIDADES } una vez cargados
async function cargarDatos() {
  if (DATOS) return DATOS
  const entradas = await Promise.all(Object.entries(archivos).map(async ([k, f]) => [k, await f()]))
  const general = entradas.find(([k]) => k.endsWith('/general.json'))?.[1] ?? null
  DATOS = {
    SECCIONES: Array.isArray(general) ? general : (general?.secciones ?? []),
    UNIVERSIDADES: entradas.filter(([k]) => k.includes('/universidades-')).flatMap(([, v]) => (Array.isArray(v) ? v : v?.universidades ?? [])),
  }
  return DATOS
}
let SECCIONES = [], UNIVERSIDADES = []

const USO = {
  requisito: { nombre: 'Solo requisito', tono: 'gris', texto: 'Exige haber presentado el Saber 11, sin puntaje mínimo publicado.' },
  puntaje_minimo: { nombre: 'Puntaje mínimo', tono: 'ambar', texto: 'Pide un puntaje mínimo global o por prueba.' },
  ponderado: { nombre: 'Admite por puntaje', tono: 'azul', texto: 'Admite según el puntaje Saber 11, ponderado por programa.' },
  examen_propio: { nombre: 'Examen propio', tono: 'morado', texto: 'Tiene su propio examen de admisión; el Saber 11 es requisito.' },
  entrevista_o_mixto: { nombre: 'Mixto', tono: 'verde', texto: 'Combina Saber 11 con entrevista, prueba o promedio del colegio.' },
}
const sinTildes = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function Guia({ params }) {
  const [cargado, setCargado] = useState(Boolean(DATOS))
  const [errorCarga, setErrorCarga] = useState(null)
  useEffect(() => { cargarDatos().then(d => { SECCIONES = d.SECCIONES; UNIVERSIDADES = d.UNIVERSIDADES; setCargado(true) }).catch(e => setErrorCarga(e.message)) }, [])
  if (DATOS) { SECCIONES = DATOS.SECCIONES; UNIVERSIDADES = DATOS.UNIVERSIDADES }
  return !cargado
    ? (errorCarga ? <div className="card" role="alert"><p className="text-sm">No se pudo cargar la guía ({errorCarga}).</p><button className="btn-secondary mt-2" onClick={() => { setErrorCarga(null); cargarDatos().then(() => setCargado(true)).catch(e => setErrorCarga(e.message)) }}>Reintentar</button></div> : <div className="space-y-3" role="status"><Titulo sub="Cargando la guía…">Guía del ICFES</Titulo><div className="card h-24 animate-pulse" /><div className="card h-40 animate-pulse" /></div>)
    : <GuiaCargada params={params} />
}

function GuiaCargada({ params }) {
  const [pestana, setPestana] = useState(params.seccion ?? (SECCIONES[0]?.id ?? 'universidades'))
  const [ciudad, setCiudad] = useState('')
  const [uso, setUso] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [abierta, setAbierta] = useState(null)

  const ciudades = useMemo(() => [...new Set(UNIVERSIDADES.map(u => u.ciudad).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')), [])
  const lista = useMemo(() => UNIVERSIDADES.filter(u =>
    (!ciudad || u.ciudad === ciudad || (u.sedes ?? []).includes(ciudad)) &&
    (!uso || u.uso_saber11 === uso) &&
    (!busqueda || sinTildes(`${u.nombre} ${u.sigla ?? ''} ${u.ciudad} ${u.departamento ?? ''}`).includes(sinTildes(busqueda)))
  ).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), [ciudad, uso, busqueda])

  if (abierta) return <DetalleUniversidad u={abierta} volver={() => setAbierta(null)} />

  const pestanas = [...SECCIONES.map(s => [s.id, s.titulo]), ['universidades', 'Universidades por ciudad'], ['saber11', '¿Qué piden del Saber 11?']]
  const seccion = SECCIONES.find(s => s.id === pestana)

  return (
    <div className="space-y-4">
      <Titulo sub="Qué es el examen Saber 11, cómo se califica, para qué sirve y qué piden las universidades">Guía del ICFES</Titulo>
      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1">
        {pestanas.map(([k, n]) => (
          <button key={k} onClick={() => setPestana(k)} className={`badge shrink-0 border px-3 py-1 ${pestana === k ? 'border-brand-blue text-brand-blue bg-sky-50' : 'border-dark-600 text-gray-400'}`}>{n}</button>
        ))}
      </div>

      {pestana !== 'universidades' && pestana !== 'saber11' && (
        !seccion ? <Vacio>Esta sección aún no tiene contenido.</Vacio> : (
          <div className="card space-y-3">
            <p className="font-semibold text-brand-navy flex items-center gap-2"><BookOpenCheck size={18} className="text-brand-blue" /> {seccion.titulo}</p>
            {seccion.parrafos?.map((p, i) => <Md key={i} texto={p} className="text-sm text-gray-300" />)}
            {seccion.preguntas?.map((q, i) => (
              <div key={i} className="rounded-lg bg-dark-900 p-3"><p className="text-sm font-medium">{q.pregunta}</p><Md texto={q.respuesta} className="text-sm text-gray-300 mt-1" /></div>
            ))}
            {seccion.enlaces?.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {seccion.enlaces.map((e, i) => <a key={i} href={e.url} target="_blank" rel="noreferrer" className="badge border border-dark-600 text-brand-blue hover:border-brand-blue"><ExternalLink size={12} /> {e.texto}</a>)}
              </div>
            )}
          </div>
        )
      )}

      {pestana === 'saber11' && <ResumenSaber11 abrir={setAbierta} />}

      {pestana === 'universidades' && (
        <>
          <div className="card space-y-2">
            <div className="grid sm:grid-cols-3 gap-2">
              <select className="input" value={ciudad} onChange={e => setCiudad(e.target.value)}>
                <option value="">Todas las ciudades</option>
                {ciudades.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="input" value={uso} onChange={e => setUso(e.target.value)}>
                <option value="">Cualquier forma de admisión</option>
                {Object.entries(USO).map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}
              </select>
              <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input className="input !pl-9" placeholder="Buscar universidad" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></div>
            </div>
            <p className="text-[11px] text-gray-500">{lista.length} instituciones. Los datos salen de los sitios oficiales de admisiones y pueden cambiar cada semestre: confirma siempre en el enlace de cada universidad.</p>
          </div>
          {UNIVERSIDADES.length === 0 && <Vacio>La lista de universidades aún no está cargada.</Vacio>}
          <div className="grid sm:grid-cols-2 gap-2">
            {lista.map(u => { const us = USO[u.uso_saber11] ?? { nombre: u.uso_saber11, tono: 'gris' }; return (
              <button key={u.id} onClick={() => setAbierta(u)} className="card text-left hover:-translate-y-0.5 transition-transform">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-brand-navy leading-tight">{u.nombre}{u.sigla ? <span className="text-gray-400 font-normal"> · {u.sigla}</span> : null}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><MapPin size={12} /> {u.ciudad}{u.departamento ? `, ${u.departamento}` : ''} · {u.tipo}</p>
                  </div>
                  <ChevronRight size={18} className="text-gray-500 shrink-0" />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5"><Badge tono={us.tono}>{us.nombre}</Badge>{u.puntaje_minimo?.global && <Badge tono="ambar">global ≥ {u.puntaje_minimo.global}</Badge>}</div>
              </button>) })}
          </div>
        </>
      )}
    </div>
  )
}

function DetalleUniversidad({ u, volver }) {
  const us = USO[u.uso_saber11] ?? { nombre: u.uso_saber11, tono: 'gris', texto: '' }
  const minimos = u.puntaje_minimo && typeof u.puntaje_minimo === 'object' ? Object.entries(u.puntaje_minimo) : []
  const nombreMin = { global: 'Global', lectura_critica: 'Lectura Crítica', matematicas: 'Matemáticas', sociales_ciudadanas: 'Sociales', ciencias_naturales: 'Ciencias', ingles: 'Inglés' }
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <button onClick={volver} aria-label="Volver" className="no-print mt-1 text-gray-400 hover:text-brand-navy"><ArrowLeft size={20} /></button>
        <div>
          <h1 className="text-xl font-semibold leading-tight">{u.nombre}{u.sigla ? <span className="text-gray-400 font-normal"> · {u.sigla}</span> : null}</h1>
          <p className="text-sm text-gray-400">{u.ciudad}{u.departamento ? `, ${u.departamento}` : ''} · {u.tipo}{u.sedes?.length ? ` · sedes: ${u.sedes.join(', ')}` : ''}</p>
        </div>
      </div>

      <div className="card space-y-2">
        <p className="font-medium flex items-center gap-2">¿Cómo usa el Saber 11? <Badge tono={us.tono}>{us.nombre}</Badge></p>
        <p className="text-sm text-gray-300">{u.uso_saber11_detalle || us.texto}</p>
        {minimos.length > 0 && <p className="text-sm">Puntaje mínimo: {minimos.map(([k, v]) => `${nombreMin[k] ?? k} ${v}`).join(' · ')}</p>}
        {u.ponderacion && <Md texto={`Ponderación: ${u.ponderacion}`} className="text-sm text-gray-300" />}
      </div>

      {u.proceso?.length > 0 && (
        <div className="card">
          <p className="font-medium mb-2">Proceso de admisión, paso a paso</p>
          <ol className="space-y-2">
            {u.proceso.map((p, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-sky-50 text-brand-blue text-xs font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{p.paso}</p>
                  {p.detalle && <Md texto={p.detalle} className="text-sm text-gray-300" />}
                  {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="text-xs text-brand-blue underline inline-flex items-center gap-1"><ExternalLink size={11} /> {p.url.replace(/^https?:\/\//, '').slice(0, 60)}</a>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-2">
        {u.calendario && <div className="card"><p className="text-xs text-gray-500">Calendario</p><Md texto={u.calendario} className="text-sm" /></div>}
        {u.costo_inscripcion && <div className="card"><p className="text-xs text-gray-500">Costo de inscripción</p><Md texto={u.costo_inscripcion} className="text-sm" /></div>}
      </div>
      {u.becas_programas?.length > 0 && (
        <div className="card"><p className="font-medium mb-1">Becas y admisión especial</p><ul className="list-disc pl-5 text-sm text-gray-300 space-y-0.5">{u.becas_programas.map((b, i) => <li key={i}>{b}</li>)}</ul></div>
      )}
      {u.notas && <div className="card"><p className="text-xs text-gray-500">Notas</p><Md texto={u.notas} className="text-sm text-gray-300" /></div>}
      <div className="card">
        <div className="flex flex-wrap gap-2">
          {u.admisiones_url && <a href={u.admisiones_url} target="_blank" rel="noreferrer" className="btn-primary !py-2 text-sm"><ExternalLink size={14} /> Admisiones</a>}
          {u.web && <a href={u.web} target="_blank" rel="noreferrer" className="btn-secondary !py-2 text-sm"><ExternalLink size={14} /> Sitio oficial</a>}
        </div>
        <p className="text-[11px] text-gray-500 mt-2">Verificado {u.verificado ?? 's. f.'} en fuentes oficiales{u.fuentes?.length ? `: ${u.fuentes.length} enlace(s)` : ''}. Las condiciones cambian cada convocatoria: confirma en el sitio de admisiones antes de inscribirte.</p>
      </div>
    </div>
  )
}

// ─── Resumen: cómo usa cada institución el Saber 11 ──────────────────────────
// Presentar el examen es requisito legal para ingresar a la educación superior;
// lo que cambia es si el puntaje decide la admisión y con qué mínimo.
const noVerificada = (u) => /no verificad/i.test(`${u.notas ?? ''} ${u.uso_saber11_detalle ?? ''}`)
const nombreMin = { global: 'Global', lectura_critica: 'Lectura Crítica', matematicas: 'Matemáticas', sociales_ciudadanas: 'Sociales', ciencias_naturales: 'Ciencias', ingles: 'Inglés' }
const ORDEN_USO = { puntaje_minimo: 0, ponderado: 1, entrevista_o_mixto: 2, examen_propio: 3, requisito: 4 }
function ResumenSaber11({ abrir }) {
  const [ciudad, setCiudad] = useState('')
  const [modo, setModo] = useState('')
  const ciudades = useMemo(() => [...new Set(UNIVERSIDADES.map(u => u.ciudad).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')), [])
  const lista = UNIVERSIDADES.filter(u => (!ciudad || u.ciudad === ciudad || (u.sedes ?? []).includes(ciudad)) && (!modo || u.uso_saber11 === modo))
    .sort((a, b) => (ORDEN_USO[a.uso_saber11] ?? 9) - (ORDEN_USO[b.uso_saber11] ?? 9) || a.ciudad.localeCompare(b.ciudad, 'es') || a.nombre.localeCompare(b.nombre, 'es'))
  const conteo = {}
  for (const u of UNIVERSIDADES) conteo[u.uso_saber11] = (conteo[u.uso_saber11] ?? 0) + 1
  const minimo = (u) => (u.puntaje_minimo && typeof u.puntaje_minimo === 'object' ? Object.entries(u.puntaje_minimo).map(([k, v]) => `${nombreMin[k] ?? k.replace(/_/g, ' ')} ${v}`).join(' · ') : '')
  return (
    <div className="space-y-3">
      <div className="card space-y-2">
        <p className="font-semibold text-brand-navy">¿Qué piden del Saber 11 las universidades?</p>
        <p className="text-sm text-gray-300">Presentar el Saber 11 es requisito legal para entrar a cualquier programa de educación superior en Colombia (Ley 1324 de 2009 y Decreto 869 de 2010). Lo que cambia entre instituciones es <b>si el puntaje decide la admisión</b> y con qué mínimo:</p>
        <div className="grid sm:grid-cols-2 gap-1.5 text-xs">
          {Object.entries(USO).map(([k, v]) => <div key={k} className="rounded-lg bg-dark-900 p-2 flex items-start gap-2"><span className="shrink-0 whitespace-nowrap"><Badge tono={v.tono}>{v.nombre}</Badge></span><span className="text-gray-300">{v.texto} <span className="text-gray-500">({conteo[k] ?? 0})</span></span></div>)}
        </div>
        <p className="text-[11px] text-gray-500">Para fijar tu meta: las públicas que admiten por puntaje definen cortes por programa (Medicina e Ingenierías suelen ser los más altos); las que tienen "puntaje mínimo" lo publican; las de examen propio no usan tu puntaje para admitir. "No verificado" significa que el sitio oficial no se pudo consultar desde el servidor: confirma en admisiones.</p>
      </div>
      <div className="card no-print grid sm:grid-cols-3 gap-2">
        <select className="input" value={ciudad} onChange={e => setCiudad(e.target.value)}><option value="">Todas las ciudades</option>{ciudades.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <select className="input" value={modo} onChange={e => setModo(e.target.value)}><option value="">Todas las formas de admisión</option>{Object.entries(USO).map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}</select>
        <button className="btn-secondary !py-2 text-sm" onClick={() => window.print()}><Printer size={16} /> Imprimir tabla</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-gray-500 text-left"><th className="py-1 pr-2">Institución</th><th className="pr-2">Ciudad</th><th className="pr-2">Uso del Saber 11</th><th className="pr-2">Mínimo publicado</th><th className="pr-2">Ponderación</th></tr></thead>
          <tbody>
            {lista.map(u => { const us = USO[u.uso_saber11] ?? { nombre: u.uso_saber11, tono: 'gris' }; return (
              <tr key={u.id} className="border-t border-dark-700 align-top">
                <td className="py-1.5 pr-2"><button className="text-left font-medium hover:text-brand-blue" onClick={() => abrir(u)}>{u.nombre}</button><span className="block text-[10px] text-gray-500">{u.tipo}{noVerificada(u) ? ' · no verificado' : ''}</span></td>
                <td className="pr-2">{u.ciudad}</td>
                <td className="pr-2 whitespace-nowrap"><Badge tono={us.tono}>{us.nombre}</Badge></td>
                <td className="pr-2">{minimo(u) || <span className="text-gray-500">no publica</span>}</td>
                <td className="pr-2 text-gray-400">{u.ponderacion ? (u.ponderacion.length > 90 ? u.ponderacion.slice(0, 90) + '…' : u.ponderacion) : (u.uso_saber11 === 'ponderado' ? 'por programa (ver ficha)' : '—')}</td>
              </tr>) })}
          </tbody>
        </table>
        <p className="text-[11px] text-gray-500 mt-2">{lista.length} instituciones. Toca el nombre para ver la ficha completa con proceso, calendario y enlaces oficiales. Datos verificados en octubre de 2026; cambian cada convocatoria.</p>
      </div>
    </div>
  )
}
