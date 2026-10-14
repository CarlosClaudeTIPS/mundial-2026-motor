import { useEffect, useState } from 'react'
import { Target, CalendarDays, CheckCircle2, Circle, Settings2, Play, Flame, Lock } from 'lucide-react'
import { intentosDe } from '../../lib/datos'
import { listarPreguntas } from '../../lib/banco'
import { sesionesDe, diagnosticoDe } from '../../lib/pruebas'
import { cicloActivo, formatoFecha } from '../../lib/ciclo'
import { perfilDiagnostico } from '../../lib/diagnostico'
import { informeEstudiante } from '../../lib/informes'
import { constancia } from '../../lib/aprendizaje'
import { prioridadesDeUsuario, modoCarreraActivo } from '../../lib/carreras'
import { planSemana, leerRutaConfig, guardarRutaConfig, NOMBRE_DIA, LIMITES } from '../../lib/ruta'
import { Badge, Barra } from '../ui'
import { ir } from '../../lib/nav'
import { lanzarAccion } from './Inicio'
import { MATERIAS } from '../Login'

// ─── Mi ruta para mejorar ────────────────────────────────────────────────────
// Carga todo lo del estudiante, arma el plan de la semana (lib/ruta.js) y lo
// muestra. `modo="hoy"` muestra solo la sesión de hoy (tarjeta de Inicio).

export async function cargarRuta(usuario) {
  const [intentos, sesiones, preguntas, ciclo, diag] = await Promise.all([intentosDe(usuario.id), sesionesDe(usuario.id), listarPreguntas({ usuario }), cicloActivo(), diagnosticoDe(usuario.id)])
  const preguntasPorId = Object.fromEntries(preguntas.map(p => [p.id, p]))
  const config = await leerRutaConfig(usuario, ciclo)
  const perfil = perfilDiagnostico(intentos, { preguntasPorId, prioridadesCarrera: modoCarreraActivo(usuario) ? prioridadesDeUsuario(usuario) : null })
  const inf = intentos.length ? informeEstudiante({ intentos, preguntasPorId, sesiones }) : null
  // Errores pendientes: la última vez que vio la pregunta falló y ninguna verificación posterior de esa competencia salió bien
  const ordenados = [...intentos].sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
  const ultimo = {}
  for (const i of ordenados) ultimo[i.pregunta_id] ??= i
  const erroresPendientes = Object.values(ultimo).filter(i => !i.correcta && preguntasPorId[i.pregunta_id]).sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).map(i => i.pregunta_id)
  const plan = planSemana({ config, perfil, hayDiagnostico: diag?.estado === 'terminada', intentos, sesiones, erroresPendientes, puntajeActual: inf?.global ?? null })
  return { config, perfil, plan, ciclo, constancia: constancia(intentos), informe: inf, n: intentos.length }
}

export default function RutaMejorar({ usuario, modo = 'completa' }) {
  const [d, setD] = useState(null)
  const [editando, setEditando] = useState(false)
  const recargar = () => cargarRuta(usuario).then(setD)
  useEffect(() => { recargar() }, [usuario.id])
  if (!d) return <p className="text-sm text-gray-400">Armando tu ruta…</p>
  const { config, plan } = d

  if (!config.definida || editando) {
    if (modo === 'hoy') return (
      <button onClick={() => ir('ruta')} className="rounded-2xl p-4 w-full text-left bg-gradient-to-r from-emerald-500 to-teal-500 text-[#fff] shadow-lg shadow-emerald-100">
        <p className="font-bold flex items-center gap-2"><Target size={20} /> Arma tu ruta para mejorar</p>
        <p className="text-sm opacity-90 mt-1">Dinos cuánto tiempo tienes al día y tu meta: te decimos qué hacer cada día hasta el examen.</p>
      </button>
    )
    return <FormularioRuta usuario={usuario} config={config} ciclo={d.ciclo} onListo={() => { setEditando(false); recargar() }} onCancelar={config.definida ? () => setEditando(false) : null} />
  }

  if (modo === 'hoy') return <TarjetaHoy plan={plan} usuario={usuario} constancia={d.constancia} />

  return (
    <div className="space-y-3">
      <div className="card border-emerald-300/60">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold flex items-center gap-2"><Target size={18} className="text-emerald-500" /> Mi ruta para mejorar</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Grado {config.grado}º · {config.minutos_dia} min/día · {config.dias_semana} días/semana
              {plan.dias_restantes != null && <> · examen el {formatoFecha(config.fecha_examen)} ({plan.dias_restantes} días)</>}
            </p>
          </div>
          <button onClick={() => setEditando(true)} className="text-xs font-semibold text-brand-blue flex items-center gap-1 shrink-0"><Settings2 size={14} /> Ajustar</button>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <div className="rounded-xl bg-dark-900 p-2"><p className="text-xl font-semibold">{plan.meta.global}</p><p className="text-[11px] text-gray-500">meta global</p></div>
          <div className="rounded-xl bg-dark-900 p-2"><p className="text-xl font-semibold">{plan.meta.actual ?? '—'}</p><p className="text-[11px] text-gray-500">vas en (estimado)</p></div>
          <div className="rounded-xl bg-dark-900 p-2"><p className="text-xl font-semibold">{plan.meta.puntos_por_semana != null ? `+${plan.meta.puntos_por_semana}` : plan.meta.brecha != null && plan.meta.brecha <= 0 ? '✓' : '—'}</p><p className="text-[11px] text-gray-500">{plan.meta.brecha != null && plan.meta.brecha <= 0 ? 'meta alcanzada' : 'puntos por semana'}</p></div>
        </div>
        {plan.meta.actual == null && <p className="text-[11px] text-gray-500 mt-2">El puntaje estimado aparece cuando hayas respondido preguntas de las cinco materias (la prueba diagnóstica basta).</p>}
        {plan.recta_final && <p className="text-xs text-brand-amber mt-2">Recta final: faltan {plan.dias_restantes} días. Cada semana cierra con un simulacro cronometrado.</p>}
      </div>

      <div className="card">
        <p className="font-medium flex items-center gap-2"><CalendarDays size={18} className="text-brand-blue" /> Semana del {formatoFecha(plan.semana.inicio)} al {formatoFecha(plan.semana.fin)}</p>
        <div className="flex justify-between text-xs text-gray-400 mt-2 mb-1"><span>{plan.resumen.hechas} de {plan.resumen.planeadas} sesiones hechas</span><span>{plan.resumen.minutos_semana} min en total</span></div>
        <Barra valor={(plan.resumen.hechas / Math.max(1, plan.resumen.planeadas)) * 100} color="#10B981" />
        {plan.objetivos.length > 0 && (
          <div className="mt-3">
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Objetivos de la semana</p>
            <div className="space-y-1.5">
              {plan.objetivos.map(o => { const m = MATERIAS.find(x => x.id === o.prueba); return (
                <div key={o.competencia} className="flex items-start gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: m?.color ?? '#999' }} />
                  <div className="min-w-0"><p className="font-medium leading-tight">{o.nombre}{o.precision != null && <span className="text-gray-400 font-normal"> · {o.precision} %</span>}</p><p className="text-xs text-gray-500">{o.meta}</p></div>
                </div>) })}
            </div>
          </div>
        )}
        {plan.sin_datos && <p className="text-xs text-gray-500 mt-3">Todavía no hay datos suficientes: la ruta empieza con la prueba diagnóstica y después se personaliza con tus resultados.</p>}
      </div>

      <div className="space-y-2">
        {plan.dias.map(dia => <FilaDia key={dia.fecha} dia={dia} usuario={usuario} />)}
      </div>
      <p className="text-[11px] text-gray-500">Lo "hecho" se marca solo, con lo que respondes cada día. La ruta se recalcula cada semana con tus resultados: no es un plan fijo.</p>
    </div>
  )
}

function FilaDia({ dia, usuario }) {
  const [abriendo, setAbriendo] = useState(false)
  const nombre = NOMBRE_DIA[dia.dia]
  if (dia.descanso) return (
    <div className={`rounded-xl border border-dashed border-dark-700 px-3 py-2 text-xs text-gray-500 flex items-center justify-between ${dia.hoy ? 'bg-dark-900' : ''}`}><span>{nombre}{dia.hoy ? ' · hoy' : ''}</span><span>descanso</span></div>
  )
  const lanzar = async () => { setAbriendo(true); try { await lanzarAccion(dia.accion, usuario) } catch (e) { alert(e.message) } finally { setAbriendo(false) } }
  return (
    <div className={`card !p-3 ${dia.hoy ? 'border-brand-blue' : dia.hecho ? 'opacity-80' : dia.pasado ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{dia.hecho ? <CheckCircle2 size={20} className="text-brand-green" /> : <Circle size={20} className={dia.pasado ? 'text-brand-red/60' : 'text-gray-500'} />}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs text-gray-400">{nombre}{dia.hoy ? ' · hoy' : ''}</p>
            <Badge tono={dia.tipo === 'simulacro' ? 'morado' : dia.tipo === 'errores' ? 'ambar' : dia.tipo === 'diagnostico' ? 'azul' : 'gris'}>{dia.minutos} min</Badge>
            {dia.pasado && !dia.hecho && <Badge tono="rojo">pendiente</Badge>}
          </div>
          <p className="font-medium leading-tight mt-0.5">{dia.titulo}</p>
          <p className="text-xs text-gray-400 mt-1">{dia.detalle}</p>
        </div>
        {!dia.hecho && <button onClick={lanzar} disabled={abriendo} className={`${dia.hoy ? 'btn-primary' : 'btn-secondary'} !py-1.5 !px-3 text-xs shrink-0`}><Play size={14} /> {dia.hoy ? 'Hacer ahora' : dia.pasado ? 'Recuperar' : 'Adelantar'}</button>}
      </div>
    </div>
  )
}

function TarjetaHoy({ plan, usuario, constancia: c }) {
  const hoy = plan.hoy
  const [abriendo, setAbriendo] = useState(false)
  const lanzar = async () => { setAbriendo(true); try { await lanzarAccion(hoy.accion, usuario) } catch (e) { alert(e.message) } finally { setAbriendo(false) } }
  return (
    <div className="card border-emerald-300/60">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold flex items-center gap-2"><Target size={18} className="text-emerald-500" /> Hoy en mi ruta</p>
        <div className="flex items-center gap-2 text-xs text-gray-400">{c.racha > 0 && <span className="flex items-center gap-1 text-brand-amber"><Flame size={14} /> {c.racha} día{c.racha === 1 ? '' : 's'} seguidos</span>}<button onClick={() => ir('ruta')} className="font-semibold text-brand-blue">Ver semana</button></div>
      </div>
      {!hoy || hoy.descanso ? (
        <p className="text-sm text-gray-400 mt-2">Hoy es día de descanso en tu plan. Si quieres, practica 5 preguntas cortas para no perder el ritmo.</p>
      ) : (
        <>
          <div className="mt-2 flex items-start gap-2">
            {hoy.hecho ? <CheckCircle2 size={20} className="text-brand-green mt-0.5 shrink-0" /> : <Circle size={20} className="text-gray-500 mt-0.5 shrink-0" />}
            <div className="min-w-0"><p className="font-medium leading-tight">{hoy.titulo} <span className="text-xs text-gray-400 font-normal">· {hoy.minutos} min</span></p><p className="text-xs text-gray-400 mt-1">{hoy.detalle}</p></div>
          </div>
          {hoy.hecho ? <p className="text-xs text-brand-green mt-2">Sesión de hoy hecha. {plan.resumen.hechas} de {plan.resumen.planeadas} esta semana.</p>
            : <button onClick={lanzar} disabled={abriendo} className="btn-primary w-full mt-3"><Play size={16} /> Hacer la sesión de hoy</button>}
        </>
      )}
    </div>
  )
}

function FormularioRuta({ usuario, config, ciclo, onListo, onCancelar }) {
  const [f, setF] = useState({ grado: config.grado, fecha_examen: config.fecha_examen ?? '', minutos_dia: config.minutos_dia, dias_semana: config.dias_semana, meta_global: config.meta_global })
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState(null)
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const guardar = async () => {
    setGuardando(true)
    try { const r = await guardarRutaConfig(usuario, f); if (r.aviso) setAviso(r.aviso); onListo() } catch (e) { alert(e.message) } finally { setGuardando(false) }
  }
  return (
    <div className="card border-emerald-300/60 space-y-3">
      <div>
        <p className="font-semibold flex items-center gap-2"><Target size={18} className="text-emerald-500" /> Mi ruta para mejorar</p>
        <p className="text-xs text-gray-400 mt-0.5">Con estos datos armamos tu plan semana a semana: qué practicar cada día, cuánto tiempo y con qué meta. Lo puedes cambiar cuando quieras.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><label className="label">Grado</label>
          <select className="input" value={f.grado} onChange={e => set('grado', Number(e.target.value))}><option value={9}>9º (empiezo temprano)</option><option value={10}>10º</option><option value={11}>11º</option></select></div>
        <div><label className="label">Fecha del examen</label>
          <input className="input" type="date" value={f.fecha_examen} onChange={e => set('fecha_examen', e.target.value)} />
          {ciclo?.fecha_examen && <p className="text-[11px] text-gray-500 mt-1">Sugerida por el ciclo: {formatoFecha(ciclo.fecha_examen)}{ciclo.fecha_provisional ? ' (provisional)' : ''}</p>}</div>
        <div><label className="label">Minutos por día: {f.minutos_dia}</label>
          <input type="range" className="w-full" min={LIMITES.minutos_dia[0]} max={LIMITES.minutos_dia[1]} step={5} value={f.minutos_dia} onChange={e => set('minutos_dia', Number(e.target.value))} />
          <p className="text-[11px] text-gray-500">Sé realista: 20 minutos todos los días rinden más que 2 horas un domingo.</p></div>
        <div><label className="label">Días por semana: {f.dias_semana}</label>
          <input type="range" className="w-full" min={LIMITES.dias_semana[0]} max={LIMITES.dias_semana[1]} value={f.dias_semana} onChange={e => set('dias_semana', Number(e.target.value))} /></div>
        <div className="sm:col-span-2"><label className="label">Meta de puntaje global (0 a 500): {f.meta_global}</label>
          <input type="range" className="w-full" min={LIMITES.meta_global[0]} max={LIMITES.meta_global[1]} step={10} value={f.meta_global} onChange={e => set('meta_global', Number(e.target.value))} />
          <p className="text-[11px] text-gray-500">Referencia: el promedio nacional está alrededor de 250; muchas becas y universidades piden entre 300 y 360. Consulta la Guía ICFES.</p></div>
      </div>
      {aviso && <p className="text-xs text-brand-amber">{aviso}</p>}
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Armar mi ruta'}</button>
        {onCancelar && <button className="btn-secondary" onClick={onCancelar}>Cancelar</button>}
      </div>
    </div>
  )
}
