import { useEffect, useState } from 'react'
import { Plus, Upload, Download, Copy, Archive, List, LayoutList } from 'lucide-react'
import { puedeEditar } from '../../lib/roles'
import { listarPreguntas, guardarPregunta } from '../../lib/banco'
import { db } from '../../lib/db'
import { taxonomia, nombrePrueba, nombreCompetencia } from '../../lib/taxonomia'
import PreguntaVista from '../PreguntaVista'
import { Titulo, Badge, Vacio } from '../ui'
import ImportarPreguntas from './ImportarPreguntas'
import { FileText } from 'lucide-react'

// ─── Banco de preguntas (CMS interno) ────────────────────────────────────────
// Ver, filtrar, editar (JSON), duplicar, archivar, aprobar, importar y exportar.

export default function Banco({ usuario }) {
  const [lista, setLista] = useState([])
  const [f, setF] = useState({ prueba: '', competencia: '', habilidad: '', estado: 'todas', buscar: '' })
  const [abierta, setAbierta] = useState(null)
  const [edicion, setEdicion] = useState(null) // texto JSON
  const [error, setError] = useState('')
  const [importando, setImportando] = useState(false)
  // 'tarjetas': una tarjeta por pregunta, se abre al tocarla.
  // 'corrida': todas seguidas y numeradas (1, 2, 3…) para revisarlas de una ojeada.
  const [vista, setVista] = useState(() => { try { return localStorage.getItem('banco_vista') || 'tarjetas' } catch { return 'tarjetas' } })
  const [conExplicaciones, setConExplicaciones] = useState(false)
  const [limite, setLimite] = useState(100) // la vista corrida se muestra por tandas para no cargar el celular
  const cambiarVista = (v) => { setVista(v); try { localStorage.setItem('banco_vista', v) } catch {} }
  const editable = puedeEditar(usuario)
  const tax = taxonomia()


  const cargar = async () => setLista(await listarPreguntas(f))
  useEffect(() => { cargar(); setLimite(100) }, [JSON.stringify(f)])

  const abrirEdicion = (p) => { setAbierta(p.id); setEdicion(JSON.stringify(p, null, 2)); setError('') }

  const guardarEdicion = async () => {
    try {
      const p = JSON.parse(edicion)
      if (!p.id || !p.opciones?.length) throw new Error('Faltan campos obligatorios (id, opciones)')
      if (p.opciones.filter(o => o.correcta).length !== 1) throw new Error('Debe haber exactamente una opción correcta')
      for (const o of p.opciones) if (!o.correcta && !o.explicacion) throw new Error(`La opción ${o.clave} necesita explicación`)
      await guardarPregunta(p)
      setEdicion(null); setAbierta(null); cargar()
    } catch (e) { setError(e.message) }
  }

  const duplicar = async (p) => {
    const nuevo = { ...p, id: `${p.id}-copia-${Date.now().toString(36)}`, estado: 'borrador', origen: p.origen === 'oficial' ? 'estilo' : p.origen, fuente: { ...p.fuente, url: p.origen === 'oficial' ? null : p.fuente?.url } }
    await guardarPregunta(nuevo); cargar()
  }

  const cambiarEstado = async (p, estado) => { await guardarPregunta({ ...p, estado }); cargar() }

  const importar = async (archivo) => {
    try {
      const texto = await archivo.text()
      const datos = JSON.parse(texto)
      const arr = Array.isArray(datos) ? datos : [datos]
      let n = 0
      for (const p of arr) { if (p.id && p.opciones) { await guardarPregunta({ ...p, estado: p.estado ?? 'pendiente', origen: p.origen ?? 'generada' }); n++ } }
      alert(`${n} pregunta(s) importadas (quedan en revisión salvo que traigan estado).`); cargar()
    } catch (e) { alert('Archivo inválido: ' + e.message) }
  }

  const exportar = async () => {
    const todas = await db.preguntas.toArray()
    const blob = new Blob([JSON.stringify(todas, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'banco-saber11.json'; a.click()
  }

  const nueva = () => {
    const plantilla = {
      id: `NUEVA-${Date.now().toString(36)}`, prueba: f.prueba || 'matematicas', origen: 'estilo', fuente: { nombre: 'Elaboración propia', url: null, anio: new Date().getFullYear() },
      competencia: f.competencia || tax.competencias.find(c => c.prueba === (f.prueba || 'matematicas'))?.id, componente: null, afirmacion: '', evidencia: '', habilidad: 'interpretar', tema: '', subtema: '', dificultad: 2,
      contexto: '', estimulo: null, enunciado: '', opciones: ['A', 'B', 'C', 'D'].map((c, i) => ({ clave: c, texto: '', correcta: i === 0, explicacion: '', tipo_error: i === 0 ? null : 'interpretacion', diagnostico: i === 0 ? null : 'probable', razon_frecuente: i === 0 ? null : '' })),
      explicacion: '', que_identificar: '', que_revisar: '', refuerzo_ids: [], recurso_ids: [], tiempo_sugerido_seg: 120, etiquetas: [], estado: 'borrador',
    }
    setAbierta(plantilla.id); setEdicion(JSON.stringify(plantilla, null, 2)); setError('')
  }

  return (
    <div className="space-y-4">
      <Titulo sub={`${lista.length} preguntas`} accion={<div className="flex gap-1 flex-wrap justify-end">
        <button className="btn-ghost !px-2" title={vista === 'corrida' ? 'Ver como tarjetas' : 'Ver todas seguidas (1, 2, 3…)'} aria-label={vista === 'corrida' ? 'Ver como tarjetas' : 'Ver todas seguidas'} onClick={() => cambiarVista(vista === 'corrida' ? 'tarjetas' : 'corrida')}>{vista === 'corrida' ? <LayoutList size={16} /> : <List size={16} />}</button>
        <button className="btn-ghost !px-2" title="Exportar" aria-label="Exportar banco" onClick={exportar}><Download size={16} /></button>
        {editable && <label className="btn-ghost !px-2 cursor-pointer" title="Importar JSON"><Upload size={16} /><input type="file" accept=".json" className="hidden" onChange={e => e.target.files[0] && importar(e.target.files[0])} /></label>}
        {editable && <button className="btn-secondary" onClick={() => setImportando(true)}><FileText size={16} /> Importar</button>}
        {editable && <button className="btn-secondary" onClick={nueva}><Plus size={16} /> Nueva</button>}
      </div>}>Banco de preguntas</Titulo>

      <div className="grid grid-cols-2 gap-2">
        <select className="input" value={f.prueba} onChange={e => setF({ ...f, prueba: e.target.value, competencia: '' })}><option value="">Todas las pruebas</option>{tax.pruebas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
        <select className="input" value={f.competencia} onChange={e => setF({ ...f, competencia: e.target.value })}><option value="">Toda competencia</option>{tax.competencias.filter(c => !f.prueba || c.prueba === f.prueba).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
        <select className="input" value={f.habilidad} onChange={e => setF({ ...f, habilidad: e.target.value })}><option value="">Toda habilidad</option>{tax.habilidades.map(h => <option key={h.id} value={h.id}>{h.nombre}</option>)}</select>
        <select className="input" value={f.estado} onChange={e => setF({ ...f, estado: e.target.value })}><option value="todas">Todos los estados</option>{['aprobada', 'pendiente', 'borrador', 'archivada'].map(e => <option key={e} value={e}>{e}</option>)}</select>
      </div>
      <input className="input" placeholder="Buscar por id, enunciado, tema…" value={f.buscar} onChange={e => setF({ ...f, buscar: e.target.value })} />

      {importando && <ImportarPreguntas usuario={usuario} onCerrar={() => setImportando(false)} onGuardado={() => { setF({ ...f, estado: 'pendiente' }); cargar() }} />}

      {edicion != null && (
        <div className="card space-y-2">
          <p className="font-medium">Editar {abierta}</p>
          <p className="text-xs text-gray-500">Formato: ver content/ESQUEMA-PREGUNTA.md. Cada distractor necesita explicación, tipo_error y diagnostico.</p>
          <textarea className="input font-mono text-xs" rows="22" value={edicion} onChange={e => setEdicion(e.target.value)} spellCheck="false" />
          {error && <p className="text-sm text-brand-red">{error}</p>}
          <div className="flex gap-2"><button className="btn-primary flex-1" onClick={guardarEdicion}>Guardar</button><button className="btn-secondary flex-1" onClick={() => { setEdicion(null); setAbierta(null) }}>Cancelar</button></div>
        </div>
      )}

      {lista.length === 0 && <Vacio>Sin preguntas con esos filtros.</Vacio>}

      {vista === 'corrida' && lista.length > 0 && (
        <div className="space-y-3">
          <div className="card !py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm no-print">
            <span className="text-gray-400">Todas seguidas, numeradas. La respuesta correcta va marcada en verde.</span>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={conExplicaciones} onChange={e => setConExplicaciones(e.target.checked)} /> Con explicaciones</label>
              <button className="btn-ghost !py-1 text-xs" onClick={() => window.print()}>Imprimir</button>
            </div>
          </div>
          {lista.slice(0, limite).map((p, i) => (
            <div key={p.id} id={`p-${p.id}`} className="card p-3 sm:p-4">
              <div className="flex flex-wrap items-center gap-1.5 text-xs mb-2">
                <span className="w-7 h-7 rounded-full bg-brand-navy text-[#ffffff] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <span className="font-mono text-gray-400">{p.id}</span>
                <Badge tono="morado">{nombrePrueba(p.prueba)}</Badge>
                <Badge>{nombreCompetencia(p.competencia)}</Badge>
                <Badge tono="azul">dif. {p.dificultad}</Badge>
                <Badge tono={p.estado === 'aprobada' ? 'verde' : p.estado === 'archivada' ? 'gris' : 'ambar'}>{p.estado}</Badge>
                {(p.etiquetas ?? []).includes('revisar') && <Badge tono="rojo">revisar</Badge>}
                {(p.etiquetas ?? []).includes('sin_clave') && <Badge tono="rojo">sin clave</Badge>}
                {editable && <button className="ml-auto text-xs font-semibold text-brand-blue no-print" onClick={() => { cambiarVista('tarjetas'); abrirEdicion(p) }}>Editar</button>}
              </div>
              <PreguntaVista pregunta={p} elegida={null} modo="revisar" mostrarMeta={false} />
              {conExplicaciones && (
                <div className="text-xs text-gray-400 space-y-1 mt-2 border-t border-dark-700 pt-2">
                  {p.opciones.map(o => <p key={o.clave}><span className="text-gray-200">{o.clave}{o.correcta ? ' ✔' : ''}:</span> {o.explicacion}{o.tipo_error ? ` (${o.tipo_error}, ${o.diagnostico})` : ''}</p>)}
                  {p.explicacion && <p><span className="text-gray-200">Explicación:</span> {p.explicacion}</p>}
                </div>
              )}
            </div>
          ))}
          {lista.length > limite && (
            <div className="flex gap-2 no-print">
              <button className="btn-secondary flex-1" onClick={() => setLimite(l => l + 100)}>Mostrar 100 más ({limite} de {lista.length})</button>
              <button className="btn-ghost" onClick={() => setLimite(lista.length)}>Ver todas</button>
            </div>
          )}
        </div>
      )}

      <div className={`space-y-2 ${vista === 'corrida' ? 'hidden' : ''}`}>
        {lista.map(p => (
          <div key={p.id} className="card p-3">
            <button className="w-full text-left" onClick={() => setAbierta(abierta === p.id && edicion == null ? null : p.id)}>
              <div className="flex flex-wrap gap-1.5 text-xs mb-1">
                <span className="font-mono text-gray-400">{p.id}</span>
                <Badge tono="morado">{nombrePrueba(p.prueba)}</Badge>
                <Badge>{nombreCompetencia(p.competencia)}</Badge>
                <Badge tono="azul">dif. {p.dificultad}</Badge>
                <Badge tono={p.estado === 'aprobada' ? 'verde' : p.estado === 'archivada' ? 'gris' : 'ambar'}>{p.estado}</Badge>
                {p.origen !== 'estilo' && <Badge tono={p.origen === 'oficial' ? 'verde' : 'ambar'}>{p.origen}</Badge>}
                {p.editada_local && <Badge>editada</Badge>}
                {(p.etiquetas ?? []).includes('afirmacion_por_verificar') && <Badge tono="ambar">afirmación por verificar</Badge>}
                {(p.etiquetas ?? []).includes('revisar') && <Badge tono="rojo">revisar</Badge>}
                {(p.etiquetas ?? []).includes('sin_clave') && <Badge tono="rojo">sin clave</Badge>}
              </div>
              <p className="text-sm text-gray-200 line-clamp-2">{p.enunciado}</p>
              <p className="text-xs text-gray-500">{p.tema}{p.subtema ? ` · ${p.subtema}` : ''}</p>
            </button>
            {abierta === p.id && edicion == null && (
              <div className="mt-3 border-t border-dark-700 pt-3 space-y-3">
                <PreguntaVista pregunta={p} elegida={null} modo="revisar" mostrarMeta={false} />
                <div className="text-xs text-gray-400 space-y-1">
                  {p.opciones.map(o => <p key={o.clave}><span className="text-gray-200">{o.clave}{o.correcta ? ' ✔' : ''}:</span> {o.explicacion}{o.tipo_error ? ` (${o.tipo_error}, ${o.diagnostico})` : ''}</p>)}
                  <p><span className="text-gray-200">Afirmación:</span> {p.afirmacion}</p>
                  <p><span className="text-gray-200">Evidencia:</span> {p.evidencia}</p>
                  <p><span className="text-gray-200">Fuente:</span> {p.fuente?.nombre}{p.fuente?.url ? ` · ${p.fuente.url}` : ''}</p>
                </div>
                {editable && <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary !py-1.5 text-xs" onClick={() => abrirEdicion(p)}>Editar</button>
                  <button className="btn-secondary !py-1.5 text-xs" onClick={() => duplicar(p)}><Copy size={14} /> Duplicar</button>
                  {p.estado !== 'aprobada' && <button className="btn-secondary !py-1.5 text-xs" onClick={() => cambiarEstado(p, 'aprobada')}>Aprobar</button>}
                  {p.estado !== 'archivada' && <button className="btn-ghost !py-1.5 text-xs" onClick={() => cambiarEstado(p, 'archivada')}><Archive size={14} /> Archivar</button>}
                  {p.estado === 'archivada' && <button className="btn-ghost !py-1.5 text-xs" onClick={() => cambiarEstado(p, 'pendiente')}>Restaurar</button>}
                </div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
