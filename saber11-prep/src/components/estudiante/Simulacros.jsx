import { useEffect, useState } from 'react'
import { Timer, Play } from 'lucide-react'
import { crearMiniPrueba, crearSimulacro, crearSimulacroCompleto, crearDiagnostico, sesionesDe } from '../../lib/pruebas'
import { estructuraExamen, cicloActivo, programa, estadoCiclo } from '../../lib/ciclo'
import { listarPreguntas } from '../../lib/banco'
import { ir } from '../../lib/nav'
import { Titulo, Badge, fechaCorta, formatoTiempo } from '../ui'
import { taxonomia, nombrePrueba } from '../../lib/taxonomia'

// ─── Mini-pruebas configurables y simulacros por sesión ──────────────────────

export default function Simulacros({ usuario }) {
  const [est, setEst] = useState(null)
  const [historial, setHistorial] = useState([])
  const [conteo, setConteo] = useState({})
  const [fase, setFase] = useState(null)
  const [mini, setMini] = useState({ prueba: '', competencia: '', habilidad: '', dificultad: '', cantidad: 10, tiempo_min: 20 })
  const [escala, setEscala] = useState(1)
  const [error, setError] = useState('')
  const tax = taxonomia()

  useEffect(() => {
    (async () => {
      setEst(await estructuraExamen())
      setHistorial(await sesionesDe(usuario.id))
      const ps = await listarPreguntas({ usuario })
      const c = {}; for (const p of ps) c[p.prueba] = (c[p.prueba] ?? 0) + 1
      setConteo(c)
      const ciclo = await cicloActivo(); const prog = await programa()
      setFase(estadoCiclo(ciclo, prog)?.fase ?? null)
    })()
  }, [usuario.id])

  const lanzarMini = async () => {
    setError('')
    try {
      const filtros = {}
      for (const k of ['prueba', 'competencia', 'habilidad', 'dificultad']) if (mini[k]) filtros[k] = mini[k]
      const s = await crearMiniPrueba({ estudiante: usuario, cantidad: Number(mini.cantidad), tiempo_min: mini.tiempo_min ? Number(mini.tiempo_min) : null, filtros, titulo: `Mini-prueba${mini.prueba ? ' · ' + nombrePrueba(mini.prueba) : ''}` })
      ir('sesion', { id: s.id })
    } catch (e) { setError(e.message) }
  }

  const lanzarSimulacro = async (sesion_examen) => {
    setError('')
    try {
      const s = await crearSimulacro({ estudiante: usuario, sesion_examen, escala })
      ir('sesion', { id: s.id })
    } catch (e) { setError(e.message) }
  }

  const competencias = mini.prueba ? tax.competencias.filter(c => c.prueba === mini.prueba) : tax.competencias

  return (
    <div className="space-y-4">
      <Titulo sub="Mini-pruebas por competencia o habilidad, y simulacros con la estructura real del examen">Pruebas</Titulo>

      <div className="card flex items-center gap-4 border-brand-blue">
        <div className="flex-1"><p className="font-semibold text-brand-navy">Prueba diagnóstica</p><p className="text-sm text-gray-400">25 preguntas de las cinco materias en 40 minutos. Ideal al comenzar el ciclo.</p></div>
        <button className="btn-primary shrink-0" onClick={async () => { const s = await crearDiagnostico({ estudiante: usuario }); ir('sesion', { id: s.id }) }}>Empezar</button>
      </div>

      <div className="card space-y-3">
        <p className="font-semibold text-brand-navy flex items-center gap-2"><Timer size={18} /> Simulacro tipo ICFES</p>
        <p className="text-sm text-gray-400">Igual que el examen: las mismas materias por sesión, la misma cantidad de preguntas, el mismo tiempo y sin ver respuestas hasta terminar.</p>
        {est && (
          <div className="text-xs text-gray-400 space-y-1">
            {est.sesiones.map(s => (
              <p key={s.numero}><span className="text-gray-200">{s.nombre}:</span> {s.bloques.map(b => `${nombrePrueba(b.prueba)} ${b.preguntas}`).join(' · ')} · {Math.floor(est.duracion_sesion_min / 60)} h {est.duracion_sesion_min % 60} min</p>
            ))}
          </div>
        )}
        <div>
          <label className="label">Tamaño</label>
          <div className="flex gap-2">
            {[[1, 'Real'], [0.5, 'Mitad'], [0.25, 'Corto'], [0.1, 'Muy corto']].map(([e, n]) => <button key={e} onClick={() => setEscala(e)} className={`btn flex-1 !px-1 text-sm ${escala === e ? 'bg-dark-600 text-white' : 'bg-dark-900 text-gray-400'}`}>{n}</button>)}
          </div>
          {est && <p className="text-xs text-gray-500 mt-1">{est.sesiones.map(s => `Sesión ${s.numero}: ${s.bloques.reduce((a, b) => a + Math.max(1, Math.round(b.preguntas * escala)), 0)} preguntas`).join(' · ')} · {(m => m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`)(Math.round(est.duracion_sesion_min * escala))} cada una.{escala < 1 && ' Las versiones cortas conservan la proporción entre materias y el tiempo por pregunta.'}</p>}
        </div>
        <button className="btn-primary w-full" onClick={async () => { setError(''); try { const s = await crearSimulacroCompleto({ estudiante: usuario, escala }); ir('sesion', { id: s.id }) } catch (e) { setError(e.message) } }}><Play size={16} /> Empezar simulacro completo (2 sesiones)</button>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-secondary" onClick={() => lanzarSimulacro(1)}>Solo sesión 1</button>
          <button className="btn-secondary" onClick={() => lanzarSimulacro(2)}>Solo sesión 2</button>
        </div>
        <p className="text-xs text-gray-500">En el completo, al terminar la sesión 1 tomas el descanso y luego inicias la sesión 2; al final ves el resultado global con un puntaje aproximado sobre 500. Si cierras la app, el cronómetro sigue corriendo como en el examen.</p>
        {error && <p className="text-sm text-brand-red">{error}</p>}
      </div>

      <div className="card space-y-3">
        <p className="font-medium flex items-center gap-2"><Timer size={18} /> Mini-prueba</p>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="label">Prueba</label>
            <select className="input" value={mini.prueba} onChange={e => setMini({ ...mini, prueba: e.target.value, competencia: '' })}>
              <option value="">Todas</option>{tax.pruebas.map(p => <option key={p.id} value={p.id}>{p.nombre} ({conteo[p.id] ?? 0})</option>)}
            </select></div>
          <div><label className="label">Competencia</label>
            <select className="input" value={mini.competencia} onChange={e => setMini({ ...mini, competencia: e.target.value })}>
              <option value="">Todas</option>{competencias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select></div>
          <div><label className="label">Habilidad</label>
            <select className="input" value={mini.habilidad} onChange={e => setMini({ ...mini, habilidad: e.target.value })}>
              <option value="">Todas</option>{tax.habilidades.map(h => <option key={h.id} value={h.id}>{h.nombre}</option>)}
            </select></div>
          <div><label className="label">Dificultad</label>
            <select className="input" value={mini.dificultad} onChange={e => setMini({ ...mini, dificultad: e.target.value })}>
              <option value="">Todas</option><option value="1">1 · básica</option><option value="2">2 · media</option><option value="3">3 · alta</option>
            </select></div>
          <div><label className="label">Cantidad</label><input className="input" type="number" min="3" max="40" value={mini.cantidad} onChange={e => setMini({ ...mini, cantidad: e.target.value })} /></div>
          <div><label className="label">Tiempo (min, vacío = sin límite)</label><input className="input" type="number" min="0" value={mini.tiempo_min} onChange={e => setMini({ ...mini, tiempo_min: e.target.value })} /></div>
        </div>
        {fase?.mini_prueba && <p className="text-xs text-gray-500">Sugerencia de la fase actual ({fase.nombre}): {fase.mini_prueba.cantidad} preguntas en {fase.mini_prueba.tiempo_min} min · {fase.mini_prueba.enfoque}.</p>}
        <button className="btn-primary w-full" onClick={lanzarMini}><Play size={16} /> Empezar mini-prueba</button>
      </div>

      <div className="card">
        <p className="font-medium mb-2">Historial</p>
        {historial.length === 0 && <p className="text-sm text-gray-500">Aún no has hecho pruebas.</p>}
        <div className="divide-y divide-dark-700">
          {historial.map(s => (
            <button key={s.id} onClick={() => ir('sesion', { id: s.id })} className="w-full text-left py-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm truncate">{s.titulo}</p>
                <p className="text-xs text-gray-500">{fechaCorta(s.fecha_inicio)} · {s.pregunta_ids.length} preguntas{s.duracion_seg ? ` · ${formatoTiempo(s.duracion_seg)}` : ''}</p>
              </div>
              {s.estado === 'terminada' ? <Badge tono={s.resultado.precision >= 70 ? 'verde' : s.resultado.precision >= 50 ? 'ambar' : 'rojo'}>{s.resultado.precision}%</Badge> : <Badge tono="azul">en curso</Badge>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
