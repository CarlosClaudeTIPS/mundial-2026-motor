import { useEffect, useState } from 'react'
import { puedeEditar, veTodosLosGrupos } from '../../lib/roles'
import { Plus, Users } from 'lucide-react'
import { gruposDe, todosLosGrupos, crearGrupo, miembrosDe, intentosDeGrupo } from '../../lib/datos'
import { listarCiclos, cicloActivo, estadoCiclo, programa } from '../../lib/ciclo'
import { resumenGrupo } from '../../lib/analitica'
import { ir } from '../../lib/nav'
import { Titulo, Badge, Vacio } from '../ui'
import Solicitudes from './Solicitudes'

export default function PanelDocente({ usuario }) {
  const [grupos, setGrupos] = useState(null)
  const [ciclos, setCiclos] = useState([])
  const [nuevo, setNuevo] = useState(null)
  const [estadoC, setEstadoC] = useState(null)

  const cargar = async () => {
    const lista = veTodosLosGrupos(usuario) ? await todosLosGrupos() : await gruposDe(usuario.id)
    const conDatos = await Promise.all(lista.map(async g => {
      const { miembros, intentos } = await intentosDeGrupo(g.id)
      return { ...g, n: miembros.length, resumen: resumenGrupo(miembros, intentos) }
    }))
    setGrupos(conDatos)
    setCiclos(await listarCiclos())
    setEstadoC(estadoCiclo(await cicloActivo(), await programa()))
  }
  useEffect(() => { cargar() }, [usuario.id])

  const guardar = async () => {
    if (!nuevo.nombre.trim()) return
    await crearGrupo({ ...nuevo, docente_id: usuario.id })
    setNuevo(null); cargar()
  }

  if (!grupos) return <p className="text-sm text-gray-400">Cargando…</p>

  return (
    <div className="space-y-4">
      <Titulo sub={estadoC ? (estadoC.estado === 'no_iniciado' ? `Ciclo activo: empieza en ${-estadoC.diasTranscurridos} día(s) · ${estadoC.semanasTotales} semanas` : `Ciclo activo: semana ${estadoC.semanaActual} de ${estadoC.semanasTotales} · ${estadoC.enPausa ? estadoC.pausaActual : (estadoC.fase?.nombre ?? '')}`) : null}
        accion={puedeEditar(usuario) && <button className="btn-secondary" onClick={() => setNuevo({ nombre: '', colegio: '', curso: '', ciclo_id: ciclos.find(c => c.activo)?.id ?? '' })}><Plus size={16} /> Grupo</button>}>{veTodosLosGrupos(usuario) ? 'Todos los grupos' : 'Mis grupos'}</Titulo>

      <Solicitudes usuario={usuario} grupos={grupos} onCambio={cargar} />

      {nuevo && (
        <div className="card space-y-2">
          <input className="input" placeholder="Nombre del grupo (p. ej. 11-02)" value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Colegio" value={nuevo.colegio} onChange={e => setNuevo({ ...nuevo, colegio: e.target.value })} />
            <input className="input" placeholder="Curso" value={nuevo.curso} onChange={e => setNuevo({ ...nuevo, curso: e.target.value })} />
          </div>
          <select className="input" value={nuevo.ciclo_id} onChange={e => setNuevo({ ...nuevo, ciclo_id: e.target.value })}>{ciclos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
          <div className="flex gap-2"><button className="btn-primary flex-1" onClick={guardar}>Crear</button><button className="btn-secondary flex-1" onClick={() => setNuevo(null)}>Cancelar</button></div>
        </div>
      )}

      {grupos.length === 0 && <Vacio>Crea tu primer grupo y agrega estudiantes.</Vacio>}
      <div className="space-y-2">
        {grupos.map(g => (
          <button key={g.id} onClick={() => ir('grupo', { id: g.id })} className="card w-full text-left hover:border-gray-500">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium flex items-center gap-2"><Users size={16} /> {g.nombre}</p>
                <p className="text-xs text-gray-400">{[g.colegio, g.curso !== g.nombre && g.curso, `código ${g.codigo}`, g.plan === 'mensual' ? 'plan mensual' : 'plan completo'].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-medium">{g.resumen.promedio ?? '—'}{g.resumen.promedio != null && '%'}</p>
                <p className="text-xs text-gray-500">{g.n} estudiantes · {g.resumen.n_activos} activos</p>
              </div>
            </div>
            {g.resumen.erroresFrecuentes[0]?.pct_estudiantes > 0 && <p className="text-xs text-gray-400 mt-2">Error más frecuente: <Badge tono="ambar">{g.resumen.erroresFrecuentes[0].nombre}</Badge> en {g.resumen.erroresFrecuentes[0].pct_estudiantes}% de los activos</p>}
          </button>
        ))}
      </div>
    </div>
  )
}
