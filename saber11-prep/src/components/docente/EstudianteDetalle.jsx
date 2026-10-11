import { useEffect, useState } from 'react'
import { db } from '../../lib/db'
import { intentosDe, moverEstudiante } from '../../lib/datos'
import { listarPreguntas } from '../../lib/banco'
import { sesionesDe } from '../../lib/pruebas'
import { resumen, evolucionSemanal } from '../../lib/analitica'
import { recomendar, reglasVigentes } from '../../lib/reglas'
import { hashPin } from '../../lib/sesion'
import { ir } from '../../lib/nav'
import { Titulo, FilaMetrica, Metrica, Badge, fechaCorta, formatoTiempo } from '../ui'
import { nombrePrueba, nombreTipoError, nombreDiagnostico } from '../../lib/taxonomia'
import { carreraPorId } from '../../lib/carreras'

export default function EstudianteDetalle({ params }) {
  const [d, setD] = useState(null)
  const [pinNuevo, setPinNuevo] = useState('')
  const cargar = async () => {
    const e = await db.usuarios.get(params.id)
    if (!e) return
    const [intentos, preguntas, sesiones] = await Promise.all([intentosDe(e.id), listarPreguntas({ estado: 'todas' }), sesionesDe(e.id)])
    const porId = Object.fromEntries(preguntas.map(p => [p.id, p]))
    const ordenados = [...intentos].sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
    setD({ e, r: resumen(intentos, porId), evo: evolucionSemanal(intentos), recs: recomendar(intentos, { preguntasPorId: porId, reglas: await reglasVigentes() }), errores: ordenados.filter(i => !i.correcta).slice(0, 20), porId, sesiones: sesiones.filter(s => s.estado === 'terminada'), grupos: await db.grupos.toArray() })
  }
  useEffect(() => { cargar() }, [params.id])
  if (!d) return <p className="text-sm text-gray-400">Cargando…</p>
  const { e, r } = d

  const cambiarGrupo = async (id) => {
    const g = d.grupos.find(x => x.id === id)
    if (!g || g.id === e.grupo_id) return
    if (!confirm(`¿Pasar a ${e.nombre} al grupo ${g.nombre}?`)) return
    try { await moverEstudiante(e, g); await cargar() } catch (err) { alert(err.message) }
  }

  const cambiarPin = async () => {
    if (!/^\d{4,6}$/.test(pinNuevo)) return alert('El PIN debe tener 4 a 6 dígitos')
    await db.usuarios.update(e.id, { pin_hash: await hashPin(pinNuevo) })
    setPinNuevo(''); alert('PIN actualizado')
  }

  return (
    <div className="space-y-4">
      <Titulo volver sub={`${e.usuario} · ${e.curso ?? ''}`}>{e.nombre}</Titulo>
      {(e.carreras ?? []).length > 0 && (
        <p className="text-sm text-gray-400 -mt-2">Le gustaría estudiar: <span className="text-brand-navy font-medium">{e.carreras.map(id => carreraPorId(id)?.nombre).filter(Boolean).join(' · ')}</span>{e.modo_carrera ? <Badge tono="azul">modo carrera</Badge> : null}</p>
      )}
      {d.grupos.length > 1 && (
        <label className="card !py-2.5 flex items-center justify-between gap-2 text-sm">
          <span className="text-gray-400">Grupo</span>
          <select className="input !w-auto !py-1.5 text-sm" value={e.grupo_id ?? ''} onChange={ev => cambiarGrupo(ev.target.value)}>
            {!e.grupo_id && <option value="">Sin grupo</option>}
            {d.grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
        </label>
      )}
      <button className="btn-secondary w-full" onClick={() => ir('historial', { id: e.id })}>Ver historial completo (cada prueba y cada pregunta)</button>
      <div className="grid grid-cols-3 gap-2">
        <Metrica etiqueta="Aciertos" valor={r.precision} sufijo="%" />
        <Metrica etiqueta="Respuestas" valor={r.total} />
        <Metrica etiqueta="Tiempo prom." valor={formatoTiempo(r.tiempo_prom_seg)} />
      </div>
      {r.por_prueba.length > 0 && <div className="card"><p className="font-medium mb-1">Por prueba</p>{r.por_prueba.map(x => <FilaMetrica key={x.id} nombre={x.nombre} valor={x.precision} detalle={`${x.aciertos}/${x.total}`} />)}</div>}
      {r.por_habilidad.length > 0 && <div className="card"><p className="font-medium mb-1">Habilidades</p>{r.por_habilidad.map(x => <FilaMetrica key={x.id} nombre={x.nombre} valor={x.precision} detalle={`${x.aciertos}/${x.total}`} />)}</div>}
      {r.por_tipo_error.length > 0 && <div className="card"><p className="font-medium mb-1">Errores por tipo</p>{r.por_tipo_error.map(x => <FilaMetrica key={x.id} nombre={x.nombre} valor={x.pct} detalle={`${x.n}`} color="#F87171" />)}</div>}
      <div className="card">
        <p className="font-medium mb-1">Recomendación (reglas)</p>
        {d.recs.slice(0, 3).map((rec, i) => <p key={i} className="text-sm text-gray-300 mb-1"><span className="text-white">{rec.titulo}.</span> {rec.dato} → {rec.nombre_practica}.</p>)}
      </div>
      {d.sesiones.length > 0 && (
        <div className="card">
          <p className="font-medium mb-1">Pruebas y simulacros</p>
          {d.sesiones.map(s => <p key={s.id} className="text-sm flex justify-between"><span>{s.titulo} <span className="text-gray-500 text-xs">{fechaCorta(s.fecha_inicio)}</span></span><span>{s.resultado.precision}%</span></p>)}
        </div>
      )}
      <div className="card">
        <p className="font-medium mb-2">Últimos errores</p>
        <div className="divide-y divide-dark-700">
          {d.errores.map(i => (
            <div key={i.uid} className="py-2 text-sm">
              <div className="flex flex-wrap gap-1.5 text-xs mb-0.5"><Badge tono="morado">{nombrePrueba(i.prueba)}</Badge>{i.tipo_error && <Badge tono={i.diagnostico === 'confirmado' ? 'rojo' : 'ambar'}>{nombreTipoError(i.tipo_error)} · {nombreDiagnostico(i.diagnostico).toLowerCase()}</Badge>}<span className="text-gray-500 ml-auto">{fechaCorta(i.fecha)}</span></div>
              <p className="text-gray-300 line-clamp-2">{d.porId[i.pregunta_id]?.enunciado}</p>
              <p className="text-xs text-gray-500">Eligió {i.opcion ?? '—'}{i.razon ? ` · dijo: “${i.razon.texto}”` : ''}{i.vio_explicacion ? ' · vio la explicación' : ''}</p>
            </div>
          ))}
          {d.errores.length === 0 && <p className="text-sm text-gray-500">Sin errores registrados.</p>}
        </div>
      </div>
      <div className="card">
        <p className="font-medium mb-1">Restablecer PIN</p>
        <div className="flex gap-2"><input className="input" placeholder="Nuevo PIN" value={pinNuevo} onChange={e => setPinNuevo(e.target.value)} /><button className="btn-secondary shrink-0" onClick={cambiarPin}>Guardar</button></div>
      </div>
    </div>
  )
}
