import { useEffect, useState } from 'react'
import { puedeEditar } from '../lib/roles'
import { ExternalLink, Plus, Check, X } from 'lucide-react'
import { listarRecursos, guardarRecurso, cambiarEstadoRecurso } from '../lib/datos'
import { taxonomia, nombrePrueba, nombreTipoError, nombreHabilidad } from '../lib/taxonomia'
import { Titulo, Badge, Vacio, fechaCorta } from './ui'

// ─── Biblioteca pedagógica ───────────────────────────────────────────────────
// Cada recurso está conectado a prueba, habilidad y tipo de error, y muestra
// su fuente. Los estudiantes ven solo lo aprobado; docente/admin revisan lo
// pendiente y pueden proponer recursos nuevos.

const VACIO = { titulo: '', tipo: 'enlace', url: '', descripcion: '', prueba: '', categoria: 'refuerzo', habilidades: [], tipos_error: [], fuente: { nombre: '', autor: '', institucion: '', fecha: '', url: '' } }

export default function Biblioteca({ usuario }) {
  const gestor = usuario.rol !== 'estudiante'
  const editable = puedeEditar(usuario)
  const [recursos, setRecursos] = useState([])
  const [pestana, setPestana] = useState('aprobado')
  const [filtroPrueba, setFiltroPrueba] = useState('')
  const [nuevo, setNuevo] = useState(null)
  const tax = taxonomia()

  const cargar = async () => setRecursos(await listarRecursos())
  useEffect(() => { cargar() }, [])

  const lista = recursos.filter(r => (gestor ? r.estado === pestana : r.estado === 'aprobado') && (!filtroPrueba || r.prueba === filtroPrueba || !r.prueba))

  const guardar = async () => {
    if (!nuevo.titulo.trim()) return alert('Falta el título')
    await guardarRecurso({ ...nuevo, prueba: nuevo.prueba || null, propuesto_por: usuario.id, estado: usuario.rol === 'admin' ? 'aprobado' : 'pendiente', aprobado_por: usuario.rol === 'admin' ? usuario.id : null, fecha_incorporacion: new Date().toISOString() })
    setNuevo(null); cargar()
  }

  return (
    <div className="space-y-4">
      <Titulo sub="Recursos conectados a cada prueba, habilidad y tipo de error" accion={editable && <button className="btn-secondary no-print" onClick={() => setNuevo({ ...VACIO })}><Plus size={16} /> Proponer</button>}>Biblioteca</Titulo>

      {gestor && (
        <div className="flex gap-1.5">
          {['aprobado', 'pendiente', 'rechazado'].map(e => <button key={e} onClick={() => setPestana(e)} className={`badge border capitalize ${pestana === e ? 'border-brand-blue text-white' : 'border-dark-600 text-gray-400'}`}>{e} ({recursos.filter(r => r.estado === e).length})</button>)}
        </div>
      )}
      <select className="input" value={filtroPrueba} onChange={e => setFiltroPrueba(e.target.value)}>
        <option value="">Todas las pruebas</option>{tax.pruebas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
      </select>

      {nuevo && (
        <div className="card space-y-2">
          <p className="font-medium">Nuevo recurso</p>
          <input className="input" placeholder="Título" value={nuevo.titulo} onChange={e => setNuevo({ ...nuevo, titulo: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={nuevo.tipo} onChange={e => setNuevo({ ...nuevo, tipo: e.target.value })}>{['enlace', 'video', 'pdf', 'texto', 'guia'].map(t => <option key={t}>{t}</option>)}</select>
            <select className="input" value={nuevo.categoria} onChange={e => setNuevo({ ...nuevo, categoria: e.target.value })}>{['esencial', 'refuerzo', 'opcional'].map(t => <option key={t}>{t}</option>)}</select>
            <select className="input" value={nuevo.prueba} onChange={e => setNuevo({ ...nuevo, prueba: e.target.value })}><option value="">Todas las pruebas</option>{tax.pruebas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
            <input className="input" placeholder="URL (opcional)" value={nuevo.url} onChange={e => setNuevo({ ...nuevo, url: e.target.value })} />
          </div>
          <textarea className="input" rows="3" placeholder="Descripción o contenido (para tipo texto, el contenido va aquí)" value={nuevo.descripcion} onChange={e => setNuevo({ ...nuevo, descripcion: e.target.value })} />
          <div>
            <label className="label">Habilidades</label>
            <div className="flex flex-wrap gap-1.5">{tax.habilidades.map(h => <button key={h.id} onClick={() => setNuevo({ ...nuevo, habilidades: alternar(nuevo.habilidades, h.id) })} className={`badge border ${nuevo.habilidades.includes(h.id) ? 'border-brand-blue text-white' : 'border-dark-600 text-gray-400'}`}>{h.nombre}</button>)}</div>
          </div>
          <div>
            <label className="label">Tipos de error que atiende</label>
            <div className="flex flex-wrap gap-1.5">{tax.tipos_error.map(t => <button key={t.id} onClick={() => setNuevo({ ...nuevo, tipos_error: alternar(nuevo.tipos_error, t.id) })} className={`badge border ${nuevo.tipos_error.includes(t.id) ? 'border-brand-blue text-white' : 'border-dark-600 text-gray-400'}`}>{t.nombre}</button>)}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Fuente (nombre)" value={nuevo.fuente.nombre} onChange={e => setNuevo({ ...nuevo, fuente: { ...nuevo.fuente, nombre: e.target.value } })} />
            <input className="input" placeholder="Institución / autor" value={nuevo.fuente.institucion} onChange={e => setNuevo({ ...nuevo, fuente: { ...nuevo.fuente, institucion: e.target.value } })} />
          </div>
          <p className="text-xs text-gray-500">Se guarda el enlace y los metadatos, no una copia del material: respeta los términos de uso de cada fuente.</p>
          <div className="flex gap-2"><button className="btn-primary flex-1" onClick={guardar}>Guardar</button><button className="btn-secondary flex-1" onClick={() => setNuevo(null)}>Cancelar</button></div>
        </div>
      )}

      {lista.length === 0 && <Vacio>No hay recursos {gestor ? `en estado "${pestana}"` : 'disponibles todavía'}.</Vacio>}
      <div className="space-y-2">
        {lista.map(r => (
          <div key={r.id} className="card p-3">
            <div className="flex flex-wrap gap-1.5 text-xs mb-1">
              <Badge tono={r.categoria === 'esencial' ? 'verde' : r.categoria === 'opcional' ? 'gris' : 'azul'}>{r.categoria}</Badge>
              <Badge>{r.tipo}</Badge>
              {r.prueba && <Badge tono="morado">{nombrePrueba(r.prueba)}</Badge>}
              {(r.tipos_error ?? []).map(t => <Badge key={t} tono="ambar">{nombreTipoError(t)}</Badge>)}
              {(r.habilidades ?? []).map(h => <Badge key={h}>{nombreHabilidad(h)}</Badge>)}
            </div>
            <p className="font-medium">{r.titulo}</p>
            {r.descripcion && <p className="text-sm text-gray-300 mt-1 whitespace-pre-line">{r.descripcion}</p>}
            {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="text-brand-blue text-sm inline-flex items-center gap-1 mt-1">Abrir <ExternalLink size={12} /></a>}
            <p className="text-[11px] text-gray-500 mt-2">Fuente: {r.fuente?.nombre ?? '—'}{r.fuente?.institucion ? ` · ${r.fuente.institucion}` : ''}{r.fecha_incorporacion ? ` · incorporado ${fechaCorta(r.fecha_incorporacion)}` : ''} · v{r.version ?? 1}{r.aprobado_por ? ' · aprobado' : ''}</p>
            {editable && r.estado === 'pendiente' && (
              <div className="flex gap-2 mt-2">
                <button className="btn-secondary !py-1.5 text-xs" onClick={async () => { await cambiarEstadoRecurso(r.id, 'aprobado', usuario.id); cargar() }}><Check size={14} /> Aprobar</button>
                <button className="btn-ghost !py-1.5 text-xs" onClick={async () => { await cambiarEstadoRecurso(r.id, 'rechazado', usuario.id); cargar() }}><X size={14} /> Rechazar</button>
              </div>
            )}
            {editable && r.estado === 'aprobado' && <button className="btn-ghost !py-1 text-xs mt-1" onClick={async () => { await cambiarEstadoRecurso(r.id, 'pendiente', usuario.id); cargar() }}>Enviar a revisión</button>}
          </div>
        ))}
      </div>
    </div>
  )
}

function alternar(arr, v) { return arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v] }
