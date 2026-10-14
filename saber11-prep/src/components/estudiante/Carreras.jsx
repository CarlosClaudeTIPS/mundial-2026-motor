import { useEffect, useMemo, useState } from 'react'
import { Compass, Check, Search, X } from 'lucide-react'
import { AREAS, CARRERAS, MAX_CARRERAS, NOMBRE_NIVEL, prioridadesDe, guardarCarreras } from '../../lib/carreras'
import { ir } from '../../lib/nav'
import { MATERIAS, ICONO_PRUEBA } from '../Login'
import { Titulo, Badge } from '../ui'

// ─── Mis carreras: elegir carreras y activar el modo carrera ────────────────
// Se muestra al principio (primera vez que entra el estudiante) y luego desde
// Inicio → "Mi carrera" para cambiarlo. `inicial` = pantalla completa de bienvenida.

const materiaPorId = Object.fromEntries(MATERIAS.map(m => [m.id, m]))
const sinTildes = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function Carreras({ usuario, inicial = false }) {
  const [elegidas, setElegidas] = useState(() => (usuario.carreras ?? []).slice(0, MAX_CARRERAS))
  const [modo, setModo] = useState(() => usuario.carreras_definidas ? Boolean(usuario.modo_carrera) : true)
  const [busqueda, setBusqueda] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const prioridades = useMemo(() => prioridadesDe(elegidas), [elegidas])
  const muyDistintas = elegidas.length > 1 && prioridades.filter(p => p.nivel === 'alta').length >= 4
  useEffect(() => { window.scrollTo(0, 0) }, [])
  const filtro = sinTildes(busqueda.trim())
  const areas = AREAS.map(a => ({ ...a, carreras: filtro ? a.carreras.filter(c => sinTildes(c.nombre).includes(filtro) || sinTildes(a.nombre).includes(filtro)) : a.carreras })).filter(a => a.carreras.length)

  const alternar = (id) => {
    setError('')
    setElegidas(l => l.includes(id) ? l.filter(x => x !== id) : l.length >= MAX_CARRERAS ? (setError(`Puedes elegir hasta ${MAX_CARRERAS} carreras. Quita una para agregar otra.`), l) : [...l, id])
  }

  const guardar = async (opciones = {}) => {
    setGuardando(true); setError('')
    try {
      const r = await guardarCarreras(usuario, { carreras: opciones.carreras ?? elegidas, modo_carrera: opciones.modo ?? modo })
      if (r.aviso) alert(r.aviso)
      ir('inicio')
    } catch (e) { setError(e.message) } finally { setGuardando(false) }
  }

  const cuerpo = (
    <div className="space-y-5">
      {inicial && (
        <div className="rounded-2xl p-5 bg-gradient-to-r from-brand-blue to-indigo-500 text-[#fff] shadow-lg shadow-sky-200">
          <div className="flex items-start gap-3">
            <Compass size={28} className="shrink-0" />
            <div>
              <p className="text-lg font-bold">Hola, {usuario.nombre.split(' ')[0]}. ¿Qué te gustaría estudiar?</p>
              <p className="text-sm opacity-90 mt-1">Elige hasta {MAX_CARRERAS} carreras que te llamen la atención. Con eso la app prioriza las materias que más pesan para ellas. No es una decisión definitiva: la cambias cuando quieras.</p>
            </div>
          </div>
        </div>
      )}

      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-brand-navy">Tus carreras <span className="text-gray-400 font-normal text-sm">({elegidas.length} de {MAX_CARRERAS})</span></p>
          {elegidas.length > 0 && <button className="text-xs text-gray-400 hover:text-brand-red" onClick={() => setElegidas([])}>Quitar todas</button>}
        </div>
        {elegidas.length === 0
          ? <p className="text-sm text-gray-400">Todavía no has elegido ninguna. Toca una carrera de la lista.</p>
          : <div className="flex flex-wrap gap-2">{elegidas.map(id => { const c = CARRERAS.find(x => x.id === id); return c && (
              <button key={id} onClick={() => alternar(id)} className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 text-brand-blue border border-sky-200 pl-3 pr-2 py-1 text-sm font-medium">{c.nombre} <X size={14} /></button>) })}</div>}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input !pl-9" placeholder="Buscar carrera o área (medicina, ingeniería, derecho…)" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        {error && <p className="text-sm text-brand-red">{error}</p>}
      </div>

      <div className="space-y-3">
        {areas.map(a => (
          <div key={a.id} className="card">
            <p className="text-sm font-semibold text-brand-navy mb-2">{a.nombre}</p>
            <div className="flex flex-wrap gap-2">
              {a.carreras.map(c => { const on = elegidas.includes(c.id); return (
                <button key={c.id} onClick={() => alternar(c.id)} aria-pressed={on}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${on ? 'bg-brand-blue border-brand-blue text-[#fff]' : 'border-dark-600 bg-dark-800 text-gray-300 hover:border-brand-blue hover:text-brand-blue'}`}>
                  {on && <Check size={14} />}{c.nombre}
                </button>) })}
            </div>
          </div>
        ))}
        {areas.length === 0 && <p className="text-sm text-gray-400 text-center">Ninguna carrera coincide con "{busqueda}". Prueba con otra palabra o elige la más parecida.</p>}
      </div>

      <div className="card space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-brand-navy">Modo carrera</p>
            <p className="text-xs text-gray-400 mt-0.5">Prioriza en Inicio, Materias, la práctica enfocada y Mi ruta las materias que más pesan para tus carreras. La meta sigue siendo subir las cinco pruebas: ninguna desaparece, solo cambia cuánto practicas de cada una.</p>
          </div>
          <button role="switch" aria-checked={modo && elegidas.length > 0} disabled={!elegidas.length} onClick={() => setModo(m => !m)}
            className={`shrink-0 w-12 h-7 rounded-full transition-colors relative disabled:opacity-40 ${modo && elegidas.length ? 'bg-brand-blue' : 'bg-dark-600'}`}>
            <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-[#fff] shadow transition-all ${modo && elegidas.length ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
        <VistaPrioridades prioridades={prioridades} activo={modo && elegidas.length > 0} />
        {muyDistintas && <p className="text-xs text-brand-amber">Tus carreras son muy distintas entre sí, así que casi todo queda en prioridad alta. Si ya te inclinas por una, déjala sola para que el enfoque sea más claro.</p>}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <button className="btn-primary flex-1 !py-3" disabled={guardando} onClick={() => guardar()}>{guardando ? 'Guardando…' : elegidas.length ? 'Guardar y continuar' : 'Continuar sin carreras'}</button>
        {inicial && <button className="btn-ghost sm:w-auto" disabled={guardando} onClick={() => guardar({ carreras: [], modo: false })}>Aún no sé, lo decido después</button>}
        {!inicial && <button className="btn-secondary sm:w-auto" disabled={guardando} onClick={() => ir('inicio')}>Cancelar</button>}
      </div>
      <p className="text-[11px] text-gray-500">Los pesos por carrera son una guía pedagógica, no los criterios de admisión de una universidad en particular: cada institución pondera a su manera.</p>
    </div>
  )

  if (inicial) {
    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-5"><img src="/icono.svg" alt="" className="w-9 h-9" /><span className="text-xl font-bold text-brand-blue">Saber<span className="text-brand-navy">11</span></span></div>
          {cuerpo}
        </div>
      </div>
    )
  }
  return <div><Titulo volver sub="Elige lo que te gustaría estudiar y decide si quieres priorizar">Mi carrera</Titulo>{cuerpo}</div>
}

// Cómo quedan las cinco materias con las carreras elegidas.
export function VistaPrioridades({ prioridades, activo = true, compacta = false }) {
  const tono = { alta: 'azul', media: 'ambar', base: 'gris' }
  return (
    <div className={compacta ? 'flex flex-wrap gap-1.5' : 'space-y-1.5'}>
      {prioridades.map(p => {
        const m = materiaPorId[p.prueba]; const I = ICONO_PRUEBA[p.prueba]
        if (compacta) return <Badge key={p.prueba} tono={activo ? tono[p.nivel] : 'gris'}>{m.nombre.replace(' y Ciudadanas', '')} · {Math.round(p.proporcion * 100)} %</Badge>
        return (
          <div key={p.prueba} className="flex items-center gap-3 rounded-xl bg-dark-900 px-3 py-2">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: m.fondo, color: m.color }}><I size={16} /></span>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-2 text-sm"><span className="font-medium leading-tight">{m.nombre.replace(' y Ciudadanas', '')}</span><span className="text-gray-400 text-xs shrink-0">{activo ? `${Math.round(p.proporcion * 100)} %` : '20 %'}<span className="hidden sm:inline"> de la práctica</span></span></div>
              <div className="h-1.5 rounded-full bg-dark-700 mt-1 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(activo ? p.proporcion : 0.2) * 100 * 2.5}%`, background: m.color }} /></div>
            </div>
            <Badge tono={activo ? tono[p.nivel] : 'gris'}>{activo ? NOMBRE_NIVEL[p.nivel] : 'Igual'}</Badge>
          </div>
        )
      })}
    </div>
  )
}
