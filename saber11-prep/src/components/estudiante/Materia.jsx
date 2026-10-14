import { useEffect, useState } from 'react'
import { Play, Timer, CheckCircle2, XCircle, Circle } from 'lucide-react'
import { listarPreguntas } from '../../lib/banco'
import { intentosDe } from '../../lib/datos'
import { crearMiniPrueba } from '../../lib/pruebas'
import { ir } from '../../lib/nav'
import { competenciasDe, nombreHabilidad } from '../../lib/taxonomia'
import { MATERIAS, ICONO_PRUEBA } from '../Login'
import { Titulo, FilaMetrica, Badge } from '../ui'

// ─── Una materia: práctica, competencias y banco de preguntas ────────────────
export default function Materia({ usuario, params }) {
  const m = MATERIAS.find(x => x.id === params.id) ?? MATERIAS[0]
  const I = ICONO_PRUEBA[m.id]
  const esEst = usuario.rol === 'estudiante'
  const [d, setD] = useState(null)
  const [filtro, setFiltro] = useState({ competencia: '', dificultad: '', estado: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
      const [preguntas, intentos] = await Promise.all([listarPreguntas({ prueba: m.id, usuario }), esEst ? intentosDe(usuario.id) : []])
      const ultimo = {}
      for (const i of [...intentos].sort((a, b) => (a.fecha < b.fecha ? -1 : 1))) ultimo[i.pregunta_id] = i
      const its = intentos.filter(i => i.prueba === m.id)
      const porComp = competenciasDe(m.id).map(c => {
        const l = its.filter(i => i.competencia === c.id)
        return { ...c, total: preguntas.filter(p => p.competencia === c.id).length, respuestas: l.length, precision: l.length ? Math.round(l.filter(i => i.correcta).length / l.length * 100) : null }
      })
      setD({ preguntas, ultimo, porComp, its })
    })()
  }, [m.id, usuario.id])

  if (!d) return <p className="text-sm text-gray-400">Cargando…</p>

  const estadoDe = (p) => { const u = d.ultimo[p.id]; return !u ? 'nueva' : u.correcta ? 'acertada' : 'fallada' }
  // Temas con al menos 3 preguntas, ordenados por cantidad
  const temas = Object.entries(d.preguntas.reduce((acc, p) => { if (p.tema) acc[p.tema] = (acc[p.tema] ?? 0) + 1; return acc }, {})).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 24)
  const lista = d.preguntas
    .filter(p => !filtro.competencia || p.competencia === filtro.competencia)
    .filter(p => !filtro.dificultad || p.dificultad === Number(filtro.dificultad))
    .filter(p => !filtro.estado || estadoDe(p) === filtro.estado)
    .sort((a, b) => a.id.localeCompare(b.id, 'es', { numeric: true }))
  const vistas = Object.keys(d.ultimo).filter(id => d.preguntas.some(p => p.id === id)).length
  const precision = d.its.length ? Math.round(d.its.filter(i => i.correcta).length / d.its.length * 100) : null

  const mini = async () => {
    setError('')
    try { const s = await crearMiniPrueba({ estudiante: usuario, cantidad: 10, tiempo_min: 20, filtros: { prueba: m.id }, titulo: `Mini-prueba · ${m.nombre}` }); ir('sesion', { id: s.id }) }
    catch (e) { setError(e.message) }
  }

  return (
    <div className="space-y-4">
      <Titulo volver>{m.nombre}</Titulo>

      <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: m.fondo }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-dark-800 shadow-sm" style={{ color: m.color }}><I size={28} /></div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-300">{m.frase}</p>
          <div className="flex flex-wrap gap-4 mt-2 text-sm">
            <span><b className="text-brand-navy">{d.preguntas.length}</b> preguntas</span>
            {esEst && <span><b className="text-brand-navy">{vistas}</b> resueltas</span>}
            {esEst && <span><b className="text-brand-navy">{precision ?? '—'}{precision != null && '%'}</b> aciertos</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button className="btn-primary !py-3" onClick={() => ir('practica', { prueba: m.id, n: 5 })}><Play size={18} /> Practicar 5</button>
        <button className="btn-secondary !py-3" onClick={mini}><Timer size={18} /> Mini-prueba 10</button>
      </div>
      {error && <p className="text-sm text-brand-red">{error}</p>}

      {temas.length > 1 && (
        <div className="card">
          <p className="text-sm font-medium">Practicar por tema</p>
          <p className="text-[11px] text-gray-500 mb-2">5 preguntas de un tema concreto, con explicación. Entre paréntesis, cuántas hay en el banco.</p>
          <div className="flex flex-wrap gap-1.5">
            {temas.map(([t, n]) => <button key={t} onClick={() => ir('practica', { prueba: m.id, tema: t, n: 5 })} className="badge border border-dark-600 text-gray-300 hover:border-brand-blue hover:text-brand-blue">{t} <span className="text-gray-500">({n})</span></button>)}
          </div>
        </div>
      )}

      <div className="card">
        <p className="font-semibold mb-2">Competencias</p>
        {d.porComp.map(c => (
          <div key={c.id} className="py-1">
            <FilaMetrica nombre={c.nombre} valor={esEst ? c.precision : null} detalle={`${c.total} preg.`} color={m.color} />
            <button className="text-xs font-medium mt-1" style={{ color: m.color }} onClick={() => ir('practica', { prueba: m.id, competencia: c.id, n: 5 })}>Practicar esta competencia →</button>
          </div>
        ))}
      </div>

      <div className="card">
        <p className="font-semibold mb-3">Banco de preguntas</p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <select className="input" value={filtro.competencia} onChange={e => setFiltro({ ...filtro, competencia: e.target.value })}>
            <option value="">Toda competencia</option>{competenciasDe(m.id).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <select className="input" value={filtro.dificultad} onChange={e => setFiltro({ ...filtro, dificultad: e.target.value })}>
            <option value="">Toda dificultad</option><option value="1">Básica</option><option value="2">Media</option><option value="3">Alta</option>
          </select>
          {esEst ? (
            <select className="input" value={filtro.estado} onChange={e => setFiltro({ ...filtro, estado: e.target.value })}>
              <option value="">Todas</option><option value="nueva">Sin resolver</option><option value="fallada">Falladas</option><option value="acertada">Acertadas</option>
            </select>
          ) : <div />}
        </div>
        <p className="text-xs text-gray-500 mb-2">{lista.length} preguntas. Toca una para resolverla con su explicación completa.</p>
        <div className="divide-y divide-dark-700">
          {lista.map(p => {
            const e = estadoDe(p)
            return (
              <button key={p.id} onClick={() => ir('practica', { ids: p.id })} className="w-full text-left py-3 flex items-start gap-3 hover:bg-dark-900 rounded-lg px-2">
                {esEst ? (e === 'acertada' ? <CheckCircle2 size={20} className="text-brand-green shrink-0 mt-0.5" /> : e === 'fallada' ? <XCircle size={20} className="text-brand-red shrink-0 mt-0.5" /> : <Circle size={20} className="text-gray-600 shrink-0 mt-0.5" />) : null}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-200 line-clamp-2">{p.enunciado}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span className="font-mono text-[11px] text-gray-500">{p.id}</span>
                    <Badge>{p.tema}</Badge>
                    <Badge tono="azul">{nombreHabilidad(p.habilidad)}</Badge>
                    <Badge tono={p.dificultad === 1 ? 'verde' : p.dificultad === 2 ? 'ambar' : 'rojo'}>{['', 'Básica', 'Media', 'Alta'][p.dificultad]}</Badge>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
