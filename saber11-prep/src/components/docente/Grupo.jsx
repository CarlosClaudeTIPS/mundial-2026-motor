import { useEffect, useState } from 'react'
import { UserPlus, ClipboardList, Printer, Lightbulb, FileBarChart } from 'lucide-react'
import { db } from '../../lib/db'
import { intentosDeGrupo, agregarEstudiante, importarEstudiantes, crearAsignacion, asignacionesDeGrupo, sesionesDocenteDe, prepararSesionDocente, guardarSesionDocente, actualizarGrupo } from '../../lib/datos'
import { PLANES, LOTE_MENSUAL, estadoLiberacion } from '../../lib/acceso'
import { formatoFecha } from '../../lib/ciclo'
import { listarPreguntas } from '../../lib/banco'
import { resumenGrupo, estadisticasPreguntas } from '../../lib/analitica'
import { generarIntentosDemo } from '../../lib/demo'
import { puedeEditar } from '../../lib/roles'
import { NUBE_DISPONIBLE } from '../../lib/supabase'
import { ir } from '../../lib/nav'
import { Titulo, Badge, FilaMetrica, Metrica, Vacio, fechaCorta } from '../ui'
import { taxonomia, nombrePrueba } from '../../lib/taxonomia'

// ─── Panel de un grupo ───────────────────────────────────────────────────────
// Desempeño, errores frecuentes, acciones sugeridas (por reglas), estudiantes,
// preguntas más falladas, asignaciones e inscripción de estudiantes.

export default function Grupo({ usuario, params }) {
  const editable = puedeEditar(usuario)
  const [grupo, setGrupo] = useState(null)
  const [d, setD] = useState(null)
  const [pestana, setPestana] = useState('resumen')
  const [alta, setAlta] = useState(null) // { modo: 'uno'|'lista', ... }
  const [creados, setCreados] = useState(null)
  const [asig, setAsig] = useState(null)
  const [asignaciones, setAsignaciones] = useState([])
  const tax = taxonomia()

  const cargar = async () => {
    const g = await db.grupos.get(params.id)
    if (!g) return
    const { miembros, intentos } = await intentosDeGrupo(g.id)
    const preguntas = await listarPreguntas({ estado: 'todas' })
    const porId = Object.fromEntries(preguntas.map(p => [p.id, p]))
    setGrupo(g)
    setD({ miembros, intentos, resumen: resumenGrupo(miembros, intentos, porId), preguntas: estadisticasPreguntas(intentos, porId), porId })
    setAsignaciones(await asignacionesDeGrupo(g.id))
  }
  useEffect(() => { cargar() }, [params.id])

  if (!grupo || !d) return <p className="text-sm text-gray-400">Cargando…</p>
  const r = d.resumen

  const guardarAlta = async () => {
    try {
      if (alta.modo === 'uno') {
        if (!alta.nombre?.trim() || !alta.usuario?.trim() || !alta.pin) return alert('Nombre, usuario y PIN son obligatorios')
        const u = await agregarEstudiante(grupo, { nombre: alta.nombre, usuario: alta.usuario, pin: alta.pin })
        setCreados([{ ...u, pin: alta.pin }])
      } else {
        const res = await importarEstudiantes(grupo, alta.texto ?? '')
        if (res.errores.length) alert(res.errores.join('\n'))
        setCreados(res.creados)
      }
      setAlta(null); cargar()
    } catch (e) { alert(e.message) }
  }

  const guardarAsignacion = async () => {
    if (!asig.titulo.trim()) return alert('Falta el título')
    const config = asig.tipo === 'diagnostico' ? { cantidad: 25, tiempo_min: 40, diagnostico: true } : asig.tipo === 'simulacro'
      ? { sesion_examen: asig.sesion_examen === 'completo' ? 'completo' : Number(asig.sesion_examen), escala: Number(asig.escala) }
      : { cantidad: Number(asig.cantidad), tiempo_min: asig.tiempo_min ? Number(asig.tiempo_min) : null, filtros: limpiar({ prueba: asig.prueba, competencia: asig.competencia, habilidad: asig.habilidad, tipo_error: asig.tipo_error, dificultad: asig.dificultad }) }
    await crearAsignacion({ grupo_id: grupo.id, docente_id: usuario.id, tipo: asig.tipo, titulo: asig.titulo, config, fecha_limite: asig.fecha_limite || null, nota: asig.nota })
    setAsig(null); cargar()
  }

  const asignarDesdeAccion = (a) => {
    if (!a.accion) return
    setAsig({ tipo: 'mini', titulo: a.accion.titulo ?? a.titulo, cantidad: a.accion.config?.cantidad ?? 8, tiempo_min: a.accion.config?.tiempo_min ?? 16, ...a.accion.config?.filtros, nota: a.sugerencia, fecha_limite: '', sesion_examen: 1, escala: 0.25 })
    setPestana('asignaciones')
  }

  return (
    <div className="space-y-4">
      <Titulo volver sub={`${grupo.colegio ?? ''}${grupo.curso ? ' · ' + grupo.curso : ''} · código ${grupo.codigo} · ${d.miembros.length} estudiantes`}>{grupo.nombre}</Titulo>

      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1">
        {[['resumen', 'Resumen'], ['estudiantes', 'Estudiantes'], ['preguntas', 'Preguntas'], ['asignaciones', 'Asignaciones'], ['sesiones', 'Sesiones']].map(([k, n]) => (
          <button key={k} onClick={() => setPestana(k)} className={`badge shrink-0 border px-3 py-1 ${pestana === k ? 'border-brand-blue text-white' : 'border-dark-600 text-gray-400'}`}>{n}</button>
        ))}
      </div>

      {pestana === 'resumen' && (
        <>
          <button className="btn-primary w-full" onClick={() => ir('informe', { grupo: grupo.id })}><FileBarChart size={16} /> Informe de mejoramiento del grupo (puntajes, niveles, percentiles)</button>
          <PlanAcceso grupo={grupo} preguntas={Object.values(d.porId)} onCambio={cargar} editable={editable} />
          <div className="grid grid-cols-3 gap-2">
            <Metrica etiqueta="Promedio" valor={r.promedio} sufijo="%" />
            <Metrica etiqueta="Activos" valor={`${r.n_activos}/${r.n_estudiantes}`} />
            <Metrica etiqueta="Respuestas" valor={r.total_intentos} />
          </div>

          <div className="card">
            <p className="font-medium flex items-center gap-2 mb-1"><Lightbulb size={16} className="text-brand-amber" /> Acciones sugeridas</p>
            <p className="text-xs text-gray-500 mb-2">Cada sugerencia sale de una regla explícita. El <span className="text-gray-300">dato observado</span> es un hecho; la <span className="text-gray-300">sugerencia</span> es una recomendación generada automáticamente que tú decides.</p>
            <div className="space-y-2">
              {r.acciones.map((a, i) => (
                <div key={i} className="rounded-lg bg-dark-900 p-3">
                  <p className="text-sm font-medium">{a.titulo}</p>
                  <p className="text-xs mt-1"><span className="text-gray-500">Dato observado:</span> <span className="text-gray-200">{a.dato}</span></p>
                  <p className="text-xs mt-1"><span className="text-gray-500">Sugerencia (reglas):</span> <span className="text-gray-300">{a.sugerencia}</span></p>
                  {a.estudiantes && <p className="text-xs text-gray-400 mt-1">{a.estudiantes.map(e => e.nombre).join(', ')}</p>}
                  {editable && a.accion && <button className="btn-secondary mt-2 !py-1.5 text-xs" onClick={() => asignarDesdeAccion(a)}><ClipboardList size={14} /> Asignar al grupo</button>}
                </div>
              ))}
            </div>
          </div>

          {r.erroresFrecuentes.length > 0 && (
            <div className="card">
              <p className="font-medium mb-1">Errores más frecuentes</p>
              <p className="text-xs text-gray-500 mb-2">Porcentaje de estudiantes activos con 2 o más errores de cada tipo (lectura probable según la opción elegida).</p>
              {r.erroresFrecuentes.slice(0, 8).map(e => <FilaMetrica key={e.id} nombre={e.nombre} valor={e.pct_estudiantes} detalle={`${e.estudiantes} est. · ${e.errores} errores`} color="#F87171" />)}
            </div>
          )}
          {r.pruebas.length > 0 && <div className="card"><p className="font-medium mb-1">Por prueba</p>{r.pruebas.map(x => <FilaMetrica key={x.id} nombre={x.nombre} valor={x.precision} detalle={`${x.total}`} />)}</div>}
          {r.competencias.length > 0 && <div className="card"><p className="font-medium mb-1">Competencias (de más débil a más fuerte)</p>{r.competencias.slice(0, 10).map(x => <FilaMetrica key={x.id} nombre={x.nombre} valor={x.precision} detalle={`${x.total}`} />)}</div>}
          {r.habilidades.length > 0 && <div className="card"><p className="font-medium mb-1">Habilidades del eje transversal</p>{r.habilidades.map(x => <FilaMetrica key={x.id} nombre={x.nombre} valor={x.precision} detalle={`${x.total}`} />)}</div>}
          {editable && !NUBE_DISPONIBLE && r.total_intentos < 20 && (
            <button className="btn-ghost w-full text-xs" onClick={async () => { const n = await generarIntentosDemo(grupo.id); alert(`Se generaron ${n} respuestas ficticias (solo demostración).`); cargar() }}>Generar respuestas de demostración para ver el panel con datos</button>
          )}
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => ir('imprimir', { grupo: grupo.id })}><Printer size={16} /> Modo papel</button>
            {editable && <button className="btn-secondary flex-1" onClick={() => { setPestana('asignaciones'); setAsig(nuevaAsig()) }}><ClipboardList size={16} /> Asignar</button>}
          </div>
        </>
      )}

      {pestana === 'estudiantes' && (
        <>
          {editable && <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setAlta({ modo: 'uno', nombre: '', usuario: '', pin: '' })}><UserPlus size={16} /> Agregar uno</button>
            <button className="btn-secondary flex-1" onClick={() => setAlta({ modo: 'lista', texto: '' })}>Importar lista</button>
          </div>}
          {alta && (
            <div className="card space-y-2">
              {alta.modo === 'uno' ? (
                <>
                  <input className="input" placeholder="Nombre completo" value={alta.nombre} onChange={e => setAlta({ ...alta, nombre: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <input className="input" placeholder="usuario (sin espacios)" value={alta.usuario} onChange={e => setAlta({ ...alta, usuario: e.target.value })} />
                    <input className="input" placeholder="PIN (4 dígitos o más)" value={alta.pin} onChange={e => setAlta({ ...alta, pin: e.target.value })} />
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-400">Una línea por estudiante: <code>Nombre Apellido; usuario; pin</code>. Usuario y PIN son opcionales (se generan). Puedes pegar desde Excel (columnas separadas por tabulación).</p>
                  <textarea className="input font-mono text-xs" rows="6" value={alta.texto} onChange={e => setAlta({ ...alta, texto: e.target.value })} placeholder={'Valentina Rojas; valentina.r; 2031\nJuan Pérez'} />
                </>
              )}
              <div className="flex gap-2"><button className="btn-primary flex-1" onClick={guardarAlta}>Guardar</button><button className="btn-secondary flex-1" onClick={() => setAlta(null)}>Cancelar</button></div>
            </div>
          )}
          {creados && (
            <div className="card border-brand-green/40">
              <p className="text-sm font-medium mb-1">Credenciales creadas (entrégalas a cada estudiante; el PIN no se vuelve a mostrar)</p>
              <table className="text-sm w-full"><tbody>{creados.map(c => <tr key={c.id}><td className="py-0.5">{c.nombre}</td><td className="font-mono">{c.usuario}</td><td className="font-mono">{c.pin}</td></tr>)}</tbody></table>
              <button className="btn-ghost text-xs mt-2" onClick={() => setCreados(null)}>Cerrar</button>
            </div>
          )}
          {d.miembros.length === 0 && <Vacio>Sin estudiantes todavía.</Vacio>}
          <div className="card divide-y divide-dark-700 p-0">
            {r.porEstudiante.sort((a, b) => (a.resumen.precision ?? 101) - (b.resumen.precision ?? 101)).map(({ estudiante: e, resumen: re, ultimo }) => (
              <button key={e.id} onClick={() => ir('estudiante', { id: e.id, grupo: grupo.id })} className="w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-dark-700">
                <div className="min-w-0">
                  <p className="text-sm truncate">{e.nombre}</p>
                  <p className="text-xs text-gray-500">{e.usuario} · {re.total} respuestas{ultimo ? ` · última ${fechaCorta(ultimo)}` : ''}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {re.total >= 8 && re.precision < 50 && <Badge tono="rojo">dificultad</Badge>}
                  {re.total === 0 && <Badge>sin actividad</Badge>}
                  <span className="text-sm font-medium w-12 text-right">{re.precision != null ? `${re.precision}%` : '—'}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {pestana === 'preguntas' && (
        <div className="card p-0 divide-y divide-dark-700">
          {d.preguntas.length === 0 && <p className="p-4 text-sm text-gray-500">Sin datos todavía.</p>}
          {d.preguntas.slice(0, 30).map(q => (
            <div key={q.id} className="px-4 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm truncate"><span className="font-mono text-xs text-gray-500 mr-2">{q.id}</span>{q.pregunta?.enunciado}</p>
                <span className="text-sm font-medium shrink-0">{q.precision}%</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{q.total} respuestas{q.distractor ? ` · distractor más elegido: ${q.distractor.clave} (${q.distractor.n})` : ''}{q.tiempo_prom ? ` · ${q.tiempo_prom} s` : ''} {q.revisar && <Badge tono="ambar">Revisar pregunta: {q.alertas.join(', ')}</Badge>}</p>
            </div>
          ))}
        </div>
      )}

      {pestana === 'sesiones' && <SesionesDocente grupo={grupo} usuario={usuario} porId={d.porId} onAsignar={asignarDesdeAccion} />}

      {pestana === 'asignaciones' && (
        <>
          {editable && !asig && <button className="btn-secondary w-full" onClick={() => setAsig(nuevaAsig())}><ClipboardList size={16} /> Nueva asignación</button>}
          {asig && (
            <div className="card space-y-2">
              <div className="flex gap-2">{['diagnostico', 'mini', 'simulacro'].map(t => <button key={t} onClick={() => setAsig({ ...asig, tipo: t, titulo: t === 'diagnostico' && !asig.titulo ? 'Prueba diagnóstica' : asig.titulo })} className={`btn flex-1 ${asig.tipo === t ? 'bg-dark-600 text-white' : 'bg-dark-900 text-gray-400'}`}>{t === 'mini' ? 'Mini-prueba' : t === 'diagnostico' ? 'Diagnóstica' : 'Simulacro'}</button>)}</div>
              <input className="input" placeholder="Título" value={asig.titulo} onChange={e => setAsig({ ...asig, titulo: e.target.value })} />
              {asig.tipo === 'diagnostico' ? <p className="text-sm text-gray-400">25 preguntas (5 por materia, dificultad básica y media) en 40 minutos.</p> : asig.tipo === 'mini' ? (
                <div className="grid grid-cols-2 gap-2">
                  <input className="input" type="number" placeholder="Cantidad" value={asig.cantidad} onChange={e => setAsig({ ...asig, cantidad: e.target.value })} />
                  <input className="input" type="number" placeholder="Tiempo (min)" value={asig.tiempo_min} onChange={e => setAsig({ ...asig, tiempo_min: e.target.value })} />
                  <select className="input" value={asig.prueba ?? ''} onChange={e => setAsig({ ...asig, prueba: e.target.value })}><option value="">Todas las pruebas</option>{tax.pruebas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
                  <select className="input" value={asig.competencia ?? ''} onChange={e => setAsig({ ...asig, competencia: e.target.value })}><option value="">Toda competencia</option>{tax.competencias.filter(c => !asig.prueba || c.prueba === asig.prueba).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
                  <select className="input" value={asig.habilidad ?? ''} onChange={e => setAsig({ ...asig, habilidad: e.target.value })}><option value="">Toda habilidad</option>{tax.habilidades.map(h => <option key={h.id} value={h.id}>{h.nombre}</option>)}</select>
                  <select className="input" value={asig.tipo_error ?? ''} onChange={e => setAsig({ ...asig, tipo_error: e.target.value })}><option value="">Todo tipo de error</option>{tax.tipos_error.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <select className="input" value={asig.sesion_examen} onChange={e => setAsig({ ...asig, sesion_examen: e.target.value })}><option value="1">Sesión 1</option><option value="2">Sesión 2</option><option value="completo">Completo (2 sesiones)</option></select>
                  <select className="input" value={asig.escala} onChange={e => setAsig({ ...asig, escala: e.target.value })}>{[0.1, 0.25, 0.5, 1].map(e => <option key={e} value={e}>Escala {Math.round(e * 100)} %</option>)}</select>
                </div>
              )}
              <input className="input" type="date" value={asig.fecha_limite} onChange={e => setAsig({ ...asig, fecha_limite: e.target.value })} />
              <textarea className="input" rows="2" placeholder="Nota para los estudiantes (opcional)" value={asig.nota} onChange={e => setAsig({ ...asig, nota: e.target.value })} />
              <div className="flex gap-2"><button className="btn-primary flex-1" onClick={guardarAsignacion}>Asignar</button><button className="btn-secondary flex-1" onClick={() => setAsig(null)}>Cancelar</button></div>
            </div>
          )}
          {asignaciones.length === 0 && <Vacio>Sin asignaciones.</Vacio>}
          <div className="space-y-2">
            {asignaciones.map(a => <AsignacionFila key={a.id} a={a} miembros={d.miembros} />)}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Sesiones del docente (una cada ~21 días) ────────────────────────────────
function SesionesDocente({ grupo, usuario, porId, onAsignar }) {
  const [lista, setLista] = useState([])
  const [borrador, setBorrador] = useState(null)
  const [abierta, setAbierta] = useState(null)
  const cargar = async () => setLista(await sesionesDocenteDe(grupo.id))
  useEffect(() => { cargar() }, [grupo.id])
  const ultima = lista[0]
  const proxima = ultima ? new Date(new Date(ultima.fecha + 'T00:00:00').getTime() + 21 * 86400000) : null

  const preparar = async () => {
    setBorrador(await prepararSesionDocente({ grupo, docente_id: usuario.id, resumenGrupoFn: resumenGrupo, estadisticasPreguntasFn: estadisticasPreguntas, preguntasPorId: porId }))
  }
  const guardar = async () => { await guardarSesionDocente(borrador); setBorrador(null); cargar() }

  const Resumen = ({ s }) => {
    const r = s.resumen
    return (
      <div className="space-y-2 text-sm">
        <p className="text-xs text-gray-500">Periodo desde {r.periodo_inicio} · {r.n_intentos} respuestas · {r.n_activos} estudiantes activos · promedio {r.promedio ?? '—'}%</p>
        {r.errores_frecuentes.length > 0 && <div><p className="font-medium text-xs uppercase tracking-wide text-gray-400">Errores del periodo</p>{r.errores_frecuentes.map(e => <p key={e.id}>{e.nombre}: {e.pct_estudiantes}% de los activos ({e.errores} errores)</p>)}</div>}
        {r.habilidades_debiles.length > 0 && <div><p className="font-medium text-xs uppercase tracking-wide text-gray-400">Habilidades problemáticas</p>{r.habilidades_debiles.map(h => <p key={h.id}>{h.nombre}: {h.precision}% en {h.total} preguntas</p>)}</div>}
        {r.acciones.length > 0 && <div><p className="font-medium text-xs uppercase tracking-wide text-gray-400">Acciones sugeridas (reglas)</p>{r.acciones.slice(0, 3).map((a, i) => <div key={i} className="rounded bg-dark-900 p-2 mb-1"><p>{a.titulo}</p><p className="text-xs text-gray-400">{a.dato}</p>{puedeEditar(usuario) && a.accion && <button className="btn-ghost !py-0.5 text-xs mt-1" onClick={() => onAsignar(a)}>Asignar al grupo</button>}</div>)}</div>}
        {r.preguntas_recomendadas.length > 0 && <div><p className="font-medium text-xs uppercase tracking-wide text-gray-400">Preguntas para trabajar en clase</p>{r.preguntas_recomendadas.map(q => <p key={q.id}><span className="font-mono text-xs text-gray-400">{q.id}</span> {porId[q.id]?.enunciado?.slice(0, 90)}… ({q.precision}%{q.distractor ? `, distractor ${q.distractor.clave}` : ''})</p>)}</div>}
        {r.recursos.length > 0 && <div><p className="font-medium text-xs uppercase tracking-wide text-gray-400">Material recomendado</p>{r.recursos.map(x => <p key={x.id}>{x.titulo}</p>)}</div>}
        {r.con_dificultad.length > 0 && <p className="text-xs text-gray-400">Con dificultades marcadas: {r.con_dificultad.join(', ')}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">El programa sugiere una sesión de una hora con el grupo cada ~21 días (no es obligatorio). Cada sesión guarda un resumen del periodo para planear la clase.{proxima && ` Próxima sugerida: ${proxima.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}.`}</p>
      {puedeEditar(usuario) && !borrador && <button className="btn-secondary w-full" onClick={preparar}>Preparar sesión con los datos del periodo</button>}
      {borrador && (
        <div className="card space-y-2">
          <input className="input" value={borrador.titulo} onChange={e => setBorrador({ ...borrador, titulo: e.target.value })} />
          <input className="input" type="date" value={borrador.fecha} onChange={e => setBorrador({ ...borrador, fecha: e.target.value })} />
          <Resumen s={borrador} />
          <textarea className="input" rows="3" placeholder="Notas del docente: qué se trabajó, acuerdos, tareas" value={borrador.notas} onChange={e => setBorrador({ ...borrador, notas: e.target.value })} />
          <div className="flex gap-2"><button className="btn-primary flex-1" onClick={guardar}>Guardar sesión</button><button className="btn-secondary flex-1" onClick={() => setBorrador(null)}>Cancelar</button></div>
        </div>
      )}
      {lista.length === 0 && !borrador && <Vacio>Aún no hay sesiones registradas.</Vacio>}
      {lista.map(s => (
        <div key={s.id} className="card p-3">
          <button className="w-full text-left flex justify-between" onClick={() => setAbierta(abierta === s.id ? null : s.id)}>
            <span className="font-medium">{s.titulo}</span><span className="text-xs text-gray-500">{s.fecha}</span>
          </button>
          {abierta === s.id && <div className="mt-2 border-t border-dark-700 pt-2"><Resumen s={s} />{s.notas && <p className="text-sm mt-2 whitespace-pre-line"><span className="text-gray-500">Notas:</span> {s.notas}</p>}</div>}
        </div>
      ))}
    </div>
  )
}

function nuevaAsig() { return { tipo: 'mini', titulo: '', cantidad: 10, tiempo_min: 20, prueba: '', competencia: '', habilidad: '', tipo_error: '', dificultad: '', sesion_examen: 1, escala: 0.25, fecha_limite: '', nota: '' } }
function limpiar(o) { return Object.fromEntries(Object.entries(o).filter(([, v]) => v)) }

function AsignacionFila({ a, miembros }) {
  const [hechas, setHechas] = useState(null)
  useEffect(() => { db.sesiones.where('asignacion_id').equals(a.id).toArray().then(s => setHechas(s.filter(x => x.estado === 'terminada'))) }, [a.id])
  const prom = hechas?.length ? Math.round(hechas.reduce((x, s) => x + (s.resultado?.precision ?? 0), 0) / hechas.length) : null
  return (
    <div className="card p-3">
      <div className="flex justify-between gap-2">
        <div><p className="text-sm font-medium">{a.titulo}</p><p className="text-xs text-gray-500">{a.tipo === 'diagnostico' ? 'Prueba diagnóstica · 25 preguntas · 40 min' : a.tipo === 'simulacro' ? `Simulacro sesión ${a.config.sesion_examen} · ${Math.round(a.config.escala * 100)} %` : `Mini-prueba · ${a.config.cantidad} preguntas${a.config.tiempo_min ? ` · ${a.config.tiempo_min} min` : ''}`}{a.fecha_limite ? ` · hasta ${a.fecha_limite}` : ''}</p></div>
        <div className="text-right shrink-0"><p className="text-sm font-medium">{prom != null ? `${prom}%` : '—'}</p><p className="text-xs text-gray-500">{hechas?.length ?? 0}/{miembros.length} hechas</p></div>
      </div>
    </div>
  )
}

// ─── Plan de acceso al banco: completo o mensual (lotes de LOTE_MENSUAL) ─────
function PlanAcceso({ grupo, preguntas, onCambio, editable = true }) {
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({ plan: grupo.plan ?? 'completo', plan_inicio: (grupo.plan_inicio ?? grupo.creado ?? '').slice(0, 10), plan_lote: grupo.plan_lote ?? LOTE_MENSUAL })
  const aprobadas = preguntas.filter(p => p.estado === 'aprobada')
  const e = estadoLiberacion(aprobadas, grupo)
  const guardar = async () => {
    try {
      await actualizarGrupo(grupo.id, { plan: form.plan, plan_inicio: form.plan_inicio ? new Date(form.plan_inicio + 'T00:00:00').toISOString() : grupo.plan_inicio, plan_lote: Number(form.plan_lote) || LOTE_MENSUAL })
      setEditando(false); onCambio?.()
    } catch (err) { alert(err.message) }
  }
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">Plan de acceso al banco <Badge tono={e ? 'ambar' : 'verde'}>{PLANES[grupo.plan ?? 'completo']?.nombre ?? grupo.plan}</Badge></p>
          <p className="text-xs text-gray-400 mt-1">
            {e
              ? <>Mes {e.meses + 1} · liberadas {e.liberadas.size} de {e.total} preguntas ({e.nuevas.size} nuevas este mes). {e.proximo ? `Próximo lote (${e.lote} por asignatura, ${e.lote_total} en total): ${formatoFecha(e.proximo.toISOString())}.` : 'Ya se liberó todo el banco.'}</>
              : <>Los estudiantes ven las {aprobadas.length} preguntas aprobadas del banco.</>}
          </p>
        </div>
        {editable && <button className="text-xs font-semibold text-brand-blue shrink-0" onClick={() => setEditando(v => !v)}>{editando ? 'Cerrar' : 'Cambiar'}</button>}
      </div>
      {editando && (
        <div className="mt-3 space-y-2">
          <div className="grid sm:grid-cols-2 gap-2">
            {Object.values(PLANES).map(p => (
              <button key={p.id} onClick={() => setForm({ ...form, plan: p.id })} className={`text-left rounded-xl border p-3 ${form.plan === p.id ? 'border-brand-blue bg-sky-50' : 'border-dark-600'}`}>
                <p className="text-sm font-medium">{p.nombre}</p><p className="text-xs text-gray-400">{p.descripcion}</p>
              </button>
            ))}
          </div>
          {form.plan === 'mensual' && (
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Inicio del plan</label><input type="date" className="input" value={form.plan_inicio} onChange={ev => setForm({ ...form, plan_inicio: ev.target.value })} /></div>
              <div><label className="label">Preguntas por asignatura y mes</label><input type="number" min="5" step="5" className="input" value={form.plan_lote} onChange={ev => setForm({ ...form, plan_lote: ev.target.value })} /></div>
            </div>
          )}
          <p className="text-[11px] text-gray-500">Cada mes se libera ese número de preguntas en cada una de las cinco asignaturas y se acumula: lo liberado no se quita. Al cambiar el plan, el estudiante lo ve en cuanto recargue la app.</p>
          <div className="flex gap-2"><button className="btn-primary flex-1" onClick={guardar}>Guardar</button><button className="btn-secondary flex-1" onClick={() => setEditando(false)}>Cancelar</button></div>
        </div>
      )}
    </div>
  )
}
