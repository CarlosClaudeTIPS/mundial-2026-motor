import { useEffect, useState } from 'react'
import { Printer, Download, FileBarChart } from 'lucide-react'
import { db } from '../lib/db'
import { intentosDe, intentosDeGrupo } from '../lib/datos'
import { listarPreguntas } from '../lib/banco'
import { sesionesDe } from '../lib/pruebas'
import { informeEstudiante, informeGrupo, csvInformeGrupo, NOMBRE_NIVEL, ORDEN_NIVEL, PRUEBAS } from '../lib/informes'
import { ir } from '../lib/nav'
import { Titulo, Badge, Barra, Vacio, fechaCorta } from './ui'
import { MATERIAS } from './Login'
import { formatoFecha } from '../lib/ciclo'
import { medirAprendizaje } from '../lib/aprendizaje'
import { ReporteEstudiante, ReporteGrupo } from './InformeOficial'
import { AprendizajeReal } from './estudiante/MiProgreso'

// ─── Informe de mejoramiento (individual o de grupo) ─────────────────────────
// params: { estudiante: id } o { grupo: id }. base: 'todo' | 'sesion:<id>' | 'desde:<fecha>'
// Estudiante: puede ver solo el suyo. Docente/admin: cualquiera de sus grupos.

const materia = (id) => MATERIAS.find(m => m.id === id) ?? { nombre: id, color: '#64748B', fondo: '#F1F5F9' }
const tonoNivel = (n) => ({ 1: 'rojo', 2: 'ambar', 3: 'azul', 4: 'verde', 5: 'verde' }[ORDEN_NIVEL[n]] ?? 'gris')
const colorNivel = (n) => ({ 1: '#F87171', 2: '#FBBF24', 3: '#38BDF8', 4: '#34D399', 5: '#34D399' }[ORDEN_NIVEL[n]] ?? '#94A3B8')

export default function Informe({ usuario, params }) {
  const esEstudiante = usuario.rol === 'estudiante'
  const estudianteId = esEstudiante ? usuario.id : params.estudiante
  const grupoId = esEstudiante ? null : params.grupo
  const [base, setBase] = useState(params.base ?? 'todo')
  const [formato, setFormato] = useState(params.formato ?? 'icfes')
  const [d, setD] = useState(null)

  useEffect(() => {
    (async () => {
      setD(null)
      const preguntas = await listarPreguntas({ estado: 'todas' })
      const porId = Object.fromEntries(preguntas.map(p => [p.id, p]))
      const filtrar = (lista) => {
        if (base.startsWith('sesion:')) return lista.filter(i => i.sesion_id === base.slice(7))
        if (base.startsWith('desde:')) return lista.filter(i => i.fecha >= base.slice(6))
        return lista
      }
      if (grupoId) {
        const grupo = await db.grupos.get(grupoId)
        const { miembros, intentos } = await intentosDeGrupo(grupoId)
        setD({ tipo: 'grupo', grupo, informe: informeGrupo({ miembros, intentos: filtrar(intentos), preguntasPorId: porId }), sesiones: [] })
      } else if (estudianteId) {
        const est = esEstudiante ? usuario : await db.usuarios.get(estudianteId)
        if (!est) return setD({ tipo: 'vacio' })
        const [intentos, sesiones] = await Promise.all([intentosDe(est.id), sesionesDe(est.id)])
        // Población local: compañeros del mismo grupo (si lo hay)
        let poblacion = null
        if (est.grupo_id) {
          const { miembros, intentos: todos } = await intentosDeGrupo(est.grupo_id)
          const otros = miembros.filter(m => m.id !== est.id).map(m => informeEstudiante({ intentos: filtrar(todos.filter(i => i.estudiante_id === m.id)), preguntasPorId: porId })).filter(x => x.respuestas > 0)
          poblacion = { global: otros.map(x => x.global) }
          for (const p of PRUEBAS) poblacion[p] = otros.map(x => x.pruebas.find(q => q.prueba === p).puntaje)
        }
        const grupoEst = est.grupo_id ? await db.grupos.get(est.grupo_id) : null
        setD({ tipo: 'estudiante', est, grupo: grupoEst, informe: informeEstudiante({ intentos: filtrar(intentos), preguntasPorId: porId, poblacion, sesiones }), sesiones: sesiones.filter(s => s.estado === 'terminada'), aprendizaje: medirAprendizaje(filtrar(intentos)) })
      } else setD({ tipo: 'vacio' })
    })()
  }, [estudianteId, grupoId, base])

  if (!d) return <p className="text-sm text-gray-400">Cargando…</p>
  if (d.tipo === 'vacio') return <Vacio>No hay datos para este informe.</Vacio>
  const inf = d.informe
  const titulo = d.tipo === 'grupo' ? `Informe del grupo ${d.grupo?.nombre ?? ''}` : esEstudiante ? 'Mi informe de mejoramiento' : `Informe de ${d.est.nombre}`
  const hoy = new Date().toISOString()

  const descargarCsv = () => {
    const blob = new Blob(['﻿' + csvInformeGrupo(inf)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `informe-${d.grupo?.nombre ?? 'grupo'}.csv`; a.click()
  }

  return (
    <div className="space-y-4">
      <Titulo volver={!esEstudiante} sub={`Generado el ${formatoFecha(hoy)} · puntajes estimados a partir de ${inf.respuestas ?? inf.n_activos + ' estudiantes activos y sus'} respuestas en la plataforma`}
        accion={<div className="no-print flex gap-2">{d.tipo === 'grupo' && <button className="btn-secondary !py-1.5 text-xs" onClick={descargarCsv}><Download size={14} /> Excel (CSV)</button>}<button className="btn-secondary !py-1.5 text-xs" onClick={() => window.print()}><Printer size={14} /> PDF</button></div>}>
        {titulo}
      </Titulo>

      {/* Base del informe */}
      <div className="no-print card !py-2.5 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-400">Formato:</span>
        <select className="input !w-auto !py-1.5 text-sm" value={formato} onChange={e => setFormato(e.target.value)}>
          <option value="icfes">Formato ICFES (reporte oficial)</option>
          <option value="mejoramiento">Informe de mejoramiento</option>
          <option value="ambos">Ambos</option>
        </select>
        <span className="text-gray-400">Base:</span>
        <select className="input !w-auto !py-1.5 text-sm" value={base} onChange={e => setBase(e.target.value)}>
          <option value="todo">Toda la práctica</option>
          <option value={`desde:${new Date(Date.now() - 30 * 864e5).toISOString()}`}>Últimos 30 días</option>
          {d.sesiones.map(s => <option key={s.id} value={`sesion:${s.id}`}>{s.titulo} · {fechaCorta(s.fecha_fin ?? s.fecha_inicio)}</option>)}
        </select>
      </div>

      {(inf.respuestas === 0 || inf.n_activos === 0) ? <Vacio>Todavía no hay respuestas registradas para esta base.</Vacio> : (
        <>
          {formato !== 'mejoramiento' && (d.tipo === 'estudiante'
            ? <ReporteEstudiante inf={inf} est={d.est} grupo={d.grupo} fechaAplicacion={fechaAplicacion(base, d.sesiones)} />
            : <ReporteGrupo inf={inf} grupo={d.grupo} docente={usuario.rol !== 'estudiante' ? usuario.nombre : null} fechaAplicacion={fechaAplicacion(base, d.sesiones)} />)}
          {formato === 'ambos' && <p className="text-sm font-semibold text-brand-navy pt-2 border-t border-dark-600">Anexo: informe de mejoramiento (no hace parte del reporte ICFES)</p>}
          {formato !== 'icfes' && (d.tipo === 'estudiante' ? <CuerpoEstudiante inf={inf} aprendizaje={d.aprendizaje} /> : <CuerpoGrupo inf={inf} grupoId={grupoId} />)}
        </>
      )}

      <p className="text-[11px] text-gray-500">Puntajes estimados: cada prueba es el porcentaje de aciertos en la plataforma (0-100) y el global usa la ponderación oficial 3-3-3-3-1 (0-500). El ICFES calcula sus puntajes con un modelo estadístico sobre toda la población, así que estas cifras son una aproximación para orientar el estudio, no un pronóstico oficial. Percentil nacional: {inf.referencia.fuente}, aplicación {inf.referencia.periodo}. Niveles según la Guía de interpretación de resultados del ICFES.</p>
    </div>
  )
}

// Fecha de aplicación para el encabezado: la sesión elegida como base, o la última sesión terminada.
function fechaAplicacion(base, sesiones) {
  if (base.startsWith('sesion:')) { const s = sesiones.find(x => x.id === base.slice(7)); return s?.fecha_fin ?? s?.fecha_inicio ?? null }
  const ult = [...sesiones].sort((a, b) => ((a.fecha_fin ?? a.fecha_inicio) < (b.fecha_fin ?? b.fecha_inicio) ? 1 : -1))[0]
  return ult?.fecha_fin ?? ult?.fecha_inicio ?? null
}

function Puntaje({ etiqueta, valor, sufijo = '', sub = null, color }) {
  return (
    <div className="rounded-xl bg-dark-900 p-3">
      <p className="text-xs text-gray-500">{etiqueta}</p>
      <p className="text-2xl font-semibold" style={color ? { color } : undefined}>{valor ?? '—'}<span className="text-sm text-gray-400">{valor != null ? sufijo : ''}</span></p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function CuerpoEstudiante({ inf, aprendizaje = null }) {
  return (
    <>
      <div className="card">
        <p className="font-medium mb-2 flex items-center gap-2"><FileBarChart size={16} className="text-brand-blue" /> Puntaje global estimado</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Puntaje etiqueta={inf.global_parcial ? `Global parcial (${inf.pruebas_con_datos} de 5 pruebas)` : 'Global (0-500)'} valor={inf.global} sub={inf.global_parcial ? 'faltan pruebas: el global cambiará' : `media nacional ${inf.media_nacional_global}`} color="#1FA9EC" />
          <Puntaje etiqueta="Percentil nacional" valor={inf.percentil_nacional} sub="supera a ese % de evaluados en Colombia" />
          <Puntaje etiqueta="Percentil en su grupo" valor={inf.percentil_local} sub="frente a sus compañeros" />
          <Puntaje etiqueta="Respuestas" valor={inf.respuestas} sub={inf.mas_debil ? `más débil: ${inf.mas_debil.nombre}` : null} />
        </div>
      </div>

      <div className="card">
        <p className="font-medium mb-2">Resultados por prueba</p>
        <div className="space-y-3">
          {inf.pruebas.map(p => { const m = materia(p.prueba); return (
            <div key={p.prueba}>
              <div className="flex items-center justify-between gap-2 text-sm mb-1">
                <span className="font-medium flex items-center gap-2">{p.nombre}{p.nivel && <Badge tono={tonoNivel(p.nivel)}>Nivel {p.nivel} · {p.nombre_nivel}</Badge>}</span>
                <span className="text-gray-300 shrink-0">{p.puntaje ?? '—'}{p.puntaje != null && <span className="text-xs text-gray-500"> /100 · media nal. {p.media_nacional}</span>}</span>
              </div>
              <Barra valor={p.puntaje ?? 0} color={m.color} />
              <p className="text-[11px] text-gray-500 mt-1">{p.respuestas} respuestas{p.percentil_nacional != null && ` · percentil nacional ${p.percentil_nacional}`}{p.percentil_local != null && ` · percentil en el grupo ${p.percentil_local}`}</p>
            </div>) })}
        </div>
      </div>

      <div className="card">
        <p className="font-medium mb-1">Aprendizajes por mejorar</p>
        <p className="text-xs text-gray-500 mb-2">Afirmaciones donde falló al menos la mitad de las veces, ordenadas por urgencia, con el error más frecuente y la práctica recomendada.</p>
        {inf.prioridades.length === 0 && <p className="text-sm text-gray-400">Sin afirmaciones críticas con suficientes datos (mínimo 3 respuestas por afirmación).</p>}
        <div className="space-y-2">
          {inf.prioridades.map((a, i) => (
            <div key={i} className="rounded-lg bg-dark-900 p-3">
              <div className="flex items-start justify-between gap-2"><p className="text-sm font-medium">{a.afirmacion}</p><Badge tono="rojo">{a.pct_error} % error</Badge></div>
              <p className="text-xs text-gray-400 mt-0.5">{a.nombre_prueba} · {a.nombre_competencia} · {a.aciertos}/{a.total} aciertos{a.error_principal && ` · error frecuente: ${a.error_principal.toLowerCase()}`}</p>
              {a.practica && <p className="text-xs text-gray-300 mt-1">Qué hacer: {a.practica}</p>}
              <button className="no-print btn-secondary mt-2 !py-1 text-xs" onClick={() => ir('practica', { competencia: a.competencia, prueba: a.prueba, n: 5 })}>Practicar esta competencia</button>
            </div>
          ))}
        </div>
      </div>

      {aprendizaje && <AprendizajeReal ap={aprendizaje} compacto />}

      <div className="card">
        <p className="font-medium mb-2">Fortalezas</p>
        {inf.pruebas.flatMap(p => p.fortalezas.map(a => ({ ...a, nombre_prueba: p.nombre }))).length === 0
          ? <p className="text-sm text-gray-400">Aún no hay afirmaciones con 75 % o más de aciertos y suficientes datos.</p>
          : <ul className="text-sm space-y-1">{inf.pruebas.flatMap(p => p.fortalezas.map(a => <li key={p.prueba + a.afirmacion} className="flex justify-between gap-2"><span>{a.afirmacion} <span className="text-gray-500 text-xs">({p.nombre})</span></span><span className="text-emerald-600 shrink-0">{a.precision} %</span></li>))}</ul>}
      </div>

      {inf.evolucion.length > 0 && (
        <div className="card">
          <p className="font-medium mb-2">Evolución en pruebas y simulacros</p>
          <div className="space-y-1.5">
            {inf.evolucion.map(e => (
              <div key={e.id} className="text-sm">
                <div className="flex justify-between gap-2"><span>{e.titulo} <span className="text-gray-500 text-xs">{fechaCorta(e.fecha)}</span></span><span className="text-gray-300 shrink-0">{e.precision} % · global est. {e.global ?? '—'}</span></div>
                <Barra valor={e.precision} alto={5} />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function CuerpoGrupo({ inf, grupoId }) {
  return (
    <>
      <div className="card">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Puntaje etiqueta="Global promedio (0-500)" valor={inf.global} sub={`media nacional ${inf.media_nacional_global}`} color="#1FA9EC" />
          <Puntaje etiqueta="Percentil nacional del promedio" valor={inf.percentil_nacional} />
          <Puntaje etiqueta="Estudiantes activos" valor={`${inf.n_activos}/${inf.n_estudiantes}`} />
          <Puntaje etiqueta="Prueba más débil" valor={[...inf.pruebas].filter(p => p.media != null).sort((a, b) => a.media - b.media)[0]?.nombre ?? '—'} />
        </div>
      </div>

      <div className="card">
        <p className="font-medium mb-2">Resultados por prueba y niveles de desempeño</p>
        <div className="space-y-3">
          {inf.pruebas.map(p => { const m = materia(p.prueba); return (
            <div key={p.prueba}>
              <div className="flex items-center justify-between gap-2 text-sm mb-1">
                <span className="font-medium">{p.nombre}{p.nivel_medio && <Badge tono={tonoNivel(p.nivel_medio)}>Nivel medio {p.nivel_medio}</Badge>}</span>
                <span className="text-gray-300 shrink-0">{p.media ?? '—'}{p.media != null && <span className="text-xs text-gray-500"> /100 · nal. {p.media_nacional}{p.percentil_nacional != null && ` · pct ${p.percentil_nacional}`}</span>}</span>
              </div>
              <Barra valor={p.media ?? 0} color={m.color} />
              {p.evaluados > 0 && (
                <div className="flex h-3 rounded-full overflow-hidden mt-1.5">
                  {p.distribucion_niveles.filter(x => x.n > 0).map(x => <div key={x.nivel} title={`${x.nombre}: ${x.n}`} style={{ width: `${x.pct}%`, background: colorNivel(x.nivel) }} />)}
                </div>
              )}
              <p className="text-[11px] text-gray-500 mt-1">{p.distribucion_niveles.map(x => `${x.nombre} ${x.n}`).join(' · ')} · {p.estudiantes_bajos} en niveles bajos</p>
            </div>) })}
        </div>
      </div>

      <div className="card">
        <p className="font-medium mb-1">Aprendizajes por mejorar del grupo</p>
        <p className="text-xs text-gray-500 mb-2">Afirmaciones con mayor porcentaje de error (mínimo 6 respuestas del grupo), como en el reporte de establecimiento del ICFES.</p>
        {inf.prioridades.length === 0 && <p className="text-sm text-gray-400">Aún no hay afirmaciones con suficientes respuestas.</p>}
        <div className="space-y-2">
          {inf.prioridades.map((a, i) => (
            <div key={i} className="rounded-lg bg-dark-900 p-3">
              <div className="flex items-start justify-between gap-2"><p className="text-sm font-medium">{a.afirmacion}</p><Badge tono="rojo">{a.pct_error} % error</Badge></div>
              <p className="text-xs text-gray-400 mt-0.5">{a.nombre_prueba} · {a.nombre_competencia} · {a.total} respuestas{a.error_principal && ` · error frecuente: ${a.error_principal.toLowerCase()}`}</p>
              {a.practica && <p className="text-xs text-gray-300 mt-1">Qué hacer en clase: {a.practica}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <p className="font-medium mb-2">Fortalezas del grupo</p>
        {inf.pruebas.flatMap(p => p.fortalezas).length === 0 ? <p className="text-sm text-gray-400">Aún sin afirmaciones con 75 % o más de aciertos.</p>
          : <ul className="text-sm space-y-1">{inf.pruebas.flatMap(p => p.fortalezas.slice(0, 4).map(a => <li key={p.prueba + a.afirmacion} className="flex justify-between gap-2"><span>{a.afirmacion} <span className="text-gray-500 text-xs">({p.nombre})</span></span><span className="text-emerald-600 shrink-0">{a.precision} %</span></li>))}</ul>}
      </div>

      <div className="card overflow-x-auto">
        <p className="font-medium mb-2">Estudiantes</p>
        <table className="w-full text-xs">
          <thead><tr className="text-gray-500 text-left"><th className="py-1 pr-2">Estudiante</th><th className="pr-2">Global</th><th className="pr-2">Pct grupo</th><th className="pr-2">Pct nal.</th>{PRUEBAS.map(p => <th key={p} className="pr-2">{materia(p).nombre.replace(' y Ciudadanas', '').replace('Ciencias ', '')}</th>)}<th>Más débil</th></tr></thead>
          <tbody>
            {inf.estudiantes.map(e => (
              <tr key={e.id} className="border-t border-dark-700">
                <td className="py-1.5 pr-2"><button className="text-left hover:text-brand-blue" onClick={() => ir('informe', { estudiante: e.id })}>{e.nombre}</button></td>
                <td className="pr-2 font-medium">{e.global ?? '—'}</td><td className="pr-2">{e.percentil_local ?? '—'}</td><td className="pr-2">{e.percentil_nacional ?? '—'}</td>
                {PRUEBAS.map(p => <td key={p} className="pr-2">{e.pruebas[p].puntaje ?? '—'}{e.pruebas[p].nivel && <span className="text-gray-500"> ({e.pruebas[p].nivel})</span>}</td>)}
                <td className="text-gray-400">{e.mas_debil ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {grupoId && <p className="no-print text-[11px] text-gray-500 mt-2">Toca un nombre para abrir su informe individual.</p>}
      </div>
    </>
  )
}
