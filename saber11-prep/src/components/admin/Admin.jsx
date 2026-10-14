import { useEffect, useState } from 'react'
import { db, getConfig, setConfig } from '../../lib/db'
import { listarCiclos, guardarCiclo, estadoCiclo, programa, estructuraExamen, formatoFecha, FECHAS_REFERENCIA } from '../../lib/ciclo'
import { crearUsuario, hashPin } from '../../lib/sesion'
import { taxonomia, aplicarExtension } from '../../lib/taxonomia'
import { borrarDatosDemo } from '../../lib/demo'
import { REGLAS_POR_DEFECTO } from '../../lib/reglas'
import { NUBE_DISPONIBLE } from '../../lib/supabase'
import { Titulo, Badge, Metrica } from '../ui'

// ─── Administración ──────────────────────────────────────────────────────────
// Usuarios, ciclos (fechas del examen), taxonomía (tipos de error), estructura
// del examen, programa, reglas, estadísticas generales, respaldo.

export default function Admin({ usuario }) {
  const [pestana, setPestana] = useState('ciclos')
  return (
    <div className="space-y-4">
      <Titulo sub={NUBE_DISPONIBLE ? 'Conectado a Supabase' : 'Modo local: los datos viven en este navegador'}>Administración</Titulo>
      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1">
        {[['ciclos', 'Ciclos'], ['usuarios', 'Usuarios'], ['taxonomia', 'Taxonomía'], ['examen', 'Examen y programa'], ['reglas', 'Reglas'], ['datos', 'Datos']].map(([k, n]) => (
          <button key={k} onClick={() => setPestana(k)} className={`badge shrink-0 border px-3 py-1 ${pestana === k ? 'border-brand-blue text-white' : 'border-dark-600 text-gray-400'}`}>{n}</button>
        ))}
      </div>
      {pestana === 'ciclos' && <Ciclos />}
      {pestana === 'usuarios' && <Usuarios admin={usuario} />}
      {pestana === 'taxonomia' && <Taxonomia />}
      {pestana === 'examen' && <ExamenPrograma />}
      {pestana === 'reglas' && <Reglas />}
      {pestana === 'datos' && <Datos />}
    </div>
  )
}

function Ciclos() {
  const [ciclos, setCiclos] = useState([])
  const [prog, setProg] = useState(null)
  const cargar = async () => { setCiclos(await listarCiclos()); setProg(await programa()) }
  useEffect(() => { cargar() }, [])
  const editar = async (c, cambios) => { await guardarCiclo({ ...c, ...cambios }); cargar() }
  const activar = async (id) => { for (const c of ciclos) await guardarCiclo({ ...c, activo: c.id === id }); cargar() }
  const nuevo = async () => {
    const anio = new Date().getFullYear() + 1
    await guardarCiclo({ id: `saber11-X-${Date.now().toString(36)}`, nombre: `Nuevo ciclo ${anio}`, calendario: 'A', anio, fecha_inicio: `${anio}-02-01`, fecha_examen: `${anio}-08-01`, fecha_provisional: true, semanas: 24, activo: false })
    cargar()
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">Referencias oficiales: {FECHAS_REFERENCIA.filter(f => f.oficial).map(f => `${f.calendario} ${f.anio} = ${formatoFecha(f.fecha)}`).join(' · ')}. Las de 2027 son provisionales hasta que el ICFES publique el cronograma (icfes.gov.co).</p>
      {ciclos.map(c => {
        const e = prog ? estadoCiclo(c, prog) : null
        return (
          <div key={c.id} className={`card space-y-2 ${c.activo ? 'border-brand-blue' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <input className="input font-medium" value={c.nombre} onChange={ev => editar(c, { nombre: ev.target.value })} />
              {c.activo ? <Badge tono="azul">activo</Badge> : <button className="btn-ghost text-xs" onClick={() => activar(c.id)}>Activar</button>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Inicio del ciclo</label><input className="input" type="date" value={c.fecha_inicio} onChange={ev => editar(c, { fecha_inicio: ev.target.value })} /></div>
              <div><label className="label">Fecha del examen</label><input className="input" type="date" value={c.fecha_examen} onChange={ev => editar(c, { fecha_examen: ev.target.value })} /></div>
              <div><label className="label">Calendario</label><select className="input" value={c.calendario} onChange={ev => editar(c, { calendario: ev.target.value })}><option value="B">B (primer semestre)</option><option value="A">A (segundo semestre)</option></select></div>
              <div><label className="label">Fecha</label><select className="input" value={c.fecha_provisional ? 'prov' : 'ofi'} onChange={ev => editar(c, { fecha_provisional: ev.target.value === 'prov' })}><option value="prov">Provisional</option><option value="ofi">Oficial (verificada en ICFES)</option></select></div>
            </div>
            <div>
              <label className="label">Pausas (vacaciones): una por línea, "AAAA-MM-DD a AAAA-MM-DD · nombre"</label>
              <textarea className="input font-mono text-xs" rows="2" defaultValue={(c.pausas ?? []).map(p => `${p.inicio} a ${p.fin} · ${p.nombre ?? ''}`).join('\n')}
                onBlur={ev => editar(c, { pausas: parsearPausas(ev.target.value) })} placeholder="2026-12-18 a 2027-01-10 · Vacaciones" />
            </div>
            {e && <p className="text-xs text-gray-400">{e.semanasTotales} semanas efectivas ({e.semanas.filter(s => s.pausa).length} en pausa) · hoy: semana {e.semanaActual}{e.enPausa ? ` (en pausa: ${e.pausaActual})` : ''} · {e.diasRestantes} días al examen · fase: {e.fase?.nombre ?? '—'}</p>}
          </div>
        )
      })}
      <button className="btn-secondary w-full" onClick={nuevo}>Nuevo ciclo</button>
    </div>
  )
}

function parsearPausas(texto) {
  return texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
    const m = l.match(/(\d{4}-\d{2}-\d{2})\s*a\s*(\d{4}-\d{2}-\d{2})\s*(?:·\s*(.*))?$/)
    return m ? { inicio: m[1], fin: m[2], nombre: (m[3] ?? 'Pausa').trim() || 'Pausa' } : null
  }).filter(Boolean)
}

function Usuarios({ admin }) {
  const [lista, setLista] = useState([])
  const [nuevo, setNuevo] = useState(null)
  const cargar = async () => setLista(await db.usuarios.toArray())
  useEffect(() => { cargar() }, [])
  const guardar = async () => {
    try { await crearUsuario(nuevo); setNuevo(null); cargar() } catch (e) { alert(e.message) }
  }
  const cambiarRol = async (u, rol) => { await db.usuarios.update(u.id, { rol }); cargar() }
  const resetPin = async (u) => { const pin = prompt(`Nuevo PIN para ${u.nombre}`); if (pin) { await db.usuarios.update(u.id, { pin_hash: await hashPin(pin) }); alert('PIN actualizado') } }
  const eliminar = async (u) => {
    if (u.id === admin.id) return alert('No puedes eliminar tu propia cuenta')
    if (!confirm(`¿Eliminar a ${u.nombre} y todos sus registros? Esta acción no se puede deshacer.`)) return
    await db.intentos.where('estudiante_id').equals(u.id).delete()
    await db.sesiones.where('estudiante_id').equals(u.id).delete()
    await db.usuarios.delete(u.id); cargar()
  }
  return (
    <div className="space-y-3">
      {NUBE_DISPONIBLE && <p className="text-xs text-gray-400">Con Supabase, las cuentas se crean desde el panel de Supabase (docentes) o al inscribir estudiantes en un grupo (función api/estudiantes.js).</p>}
      <button className="btn-secondary w-full" onClick={() => setNuevo({ nombre: '', usuario: '', pin: '', rol: 'docente' })}>Nuevo docente / admin</button>
      {nuevo && (
        <div className="card space-y-2">
          <input className="input" placeholder="Nombre" value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} />
          <div className="grid grid-cols-3 gap-2">
            <input className="input" placeholder="usuario" value={nuevo.usuario} onChange={e => setNuevo({ ...nuevo, usuario: e.target.value })} />
            <input className="input" placeholder="PIN" value={nuevo.pin} onChange={e => setNuevo({ ...nuevo, pin: e.target.value })} />
            <select className="input" value={nuevo.rol} onChange={e => setNuevo({ ...nuevo, rol: e.target.value })}><option value="docente">docente</option><option value="admin">admin</option></select>
          </div>
          <div className="flex gap-2"><button className="btn-primary flex-1" onClick={guardar}>Crear</button><button className="btn-secondary flex-1" onClick={() => setNuevo(null)}>Cancelar</button></div>
        </div>
      )}
      <div className="card p-0 divide-y divide-dark-700">
        {lista.map(u => (
          <div key={u.id} className="px-4 py-2 flex items-center gap-2 text-sm">
            <div className="min-w-0 flex-1"><p className="truncate">{u.nombre} {u.demo && <Badge>demo</Badge>}</p><p className="text-xs text-gray-500">{u.usuario}{u.curso ? ` · ${u.curso}` : ''}</p></div>
            <select className="input !w-auto !py-1 text-xs" value={u.rol} onChange={e => cambiarRol(u, e.target.value)}><option value="estudiante">estudiante</option><option value="docente">docente</option><option value="admin">admin</option></select>
            <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => resetPin(u)}>PIN</button>
            <button className="btn-ghost !px-2 !py-1 text-xs text-brand-red" onClick={() => eliminar(u)}>Eliminar</button>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500">Minimización de datos: solo se guardan nombre, usuario, curso, colegio y resultados. Eliminar una cuenta borra sus registros en este dispositivo (y en la nube al sincronizar).</p>
    </div>
  )
}

function Taxonomia() {
  const tax = taxonomia()
  const [ext, setExt] = useState(null)
  const [nuevoError, setNuevoError] = useState({ id: '', nombre: '', practica: 'ejercitacion' })
  useEffect(() => { getConfig('taxonomia_extension', { tipos_error: [] }).then(setExt) }, [])
  const agregar = async () => {
    if (!nuevoError.id || !nuevoError.nombre) return
    const e = { ...ext, tipos_error: [...(ext.tipos_error ?? []), { ...nuevoError, id: nuevoError.id.toLowerCase().replace(/\W+/g, '_') }] }
    await setConfig('taxonomia_extension', e); aplicarExtension(e); setExt(e); setNuevoError({ id: '', nombre: '', practica: 'ejercitacion' })
  }
  return (
    <div className="space-y-3">
      <div className="card"><p className="font-medium mb-1">Pruebas y competencias</p>{tax.pruebas.map(p => <div key={p.id} className="text-sm mb-1"><span className="text-white">{p.nombre}:</span> <span className="text-gray-400">{tax.competencias.filter(c => c.prueba === p.id).map(c => c.nombre).join(' · ')}</span></div>)}</div>
      <div className="card"><p className="font-medium mb-1">Habilidades del eje transversal</p>{tax.habilidades.map(h => <p key={h.id} className="text-sm"><span className="text-white">{h.nombre}:</span> <span className="text-gray-400">{h.descripcion}</span></p>)}</div>
      <div className="card">
        <p className="font-medium mb-1">Tipos de error → práctica</p>
        {tax.tipos_error.map(t => <p key={t.id} className="text-sm"><span className="text-white">{t.nombre}</span> <span className="text-gray-500">({t.id})</span> → <span className="text-gray-400">{tax.tipoPracticaPorId[t.practica]?.nombre ?? t.practica}</span></p>)}
        {ext && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            <input className="input" placeholder="id" value={nuevoError.id} onChange={e => setNuevoError({ ...nuevoError, id: e.target.value })} />
            <input className="input" placeholder="Nombre" value={nuevoError.nombre} onChange={e => setNuevoError({ ...nuevoError, nombre: e.target.value })} />
            <select className="input" value={nuevoError.practica} onChange={e => setNuevoError({ ...nuevoError, practica: e.target.value })}>{tax.tipos_practica.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
            <button className="btn-secondary col-span-3" onClick={agregar}>Agregar tipo de error</button>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-500">La taxonomía base vive en content/taxonomia.json (versionada). Lo que se agrega aquí se guarda como extensión local.</p>
    </div>
  )
}

function ExamenPrograma() {
  const [est, setEst] = useState(null)
  const [prog, setProg] = useState(null)
  const [texto, setTexto] = useState('')
  const [cual, setCual] = useState('examen')
  useEffect(() => { (async () => { const e = await estructuraExamen(); const p = await programa(); setEst(e); setProg(p); setTexto(JSON.stringify(e, null, 2)) })() }, [])
  const cambiar = (c) => { setCual(c); setTexto(JSON.stringify(c === 'examen' ? est : prog, null, 2)) }
  const guardar = async () => {
    try { const v = JSON.parse(texto); await setConfig(cual === 'examen' ? 'estructura_examen' : 'programa', v); if (cual === 'examen') setEst(v); else setProg(v); alert('Guardado') } catch (e) { alert('JSON inválido: ' + e.message) }
  }
  const restaurar = async () => { await setConfig(cual === 'examen' ? 'estructura_examen' : 'programa', null); location.reload() }
  if (!est) return null
  return (
    <div className="space-y-3">
      <div className="flex gap-2">{[['examen', 'Estructura del examen'], ['programa', 'Programa de 6 meses']].map(([k, n]) => <button key={k} onClick={() => cambiar(k)} className={`btn flex-1 ${cual === k ? 'bg-dark-600 text-white' : 'bg-dark-900 text-gray-400'}`}>{n}</button>)}</div>
      <p className="text-xs text-gray-400">{cual === 'examen' ? est._estado : prog._estado}</p>
      <textarea className="input font-mono text-xs" rows="24" value={texto} onChange={e => setTexto(e.target.value)} spellCheck="false" />
      <div className="flex gap-2"><button className="btn-primary flex-1" onClick={guardar}>Guardar</button><button className="btn-secondary flex-1" onClick={restaurar}>Restaurar el archivo base</button></div>
    </div>
  )
}

function Reglas() {
  const [reglas, setReglas] = useState(null)
  useEffect(() => { getConfig('reglas', REGLAS_POR_DEFECTO).then(setReglas) }, [])
  if (!reglas) return null
  const editar = async (i, cambios) => { const r = reglas.map((x, j) => (j === i ? { ...x, ...cambios } : x)); setReglas(r); await setConfig('reglas', r) }
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">Fase 1: reglas simples y transparentes. El motor adaptativo (fase 2) se construirá cuando haya datos reales suficientes.</p>
      {reglas.map((r, i) => (
        <div key={r.id} className="card">
          <div className="flex items-center justify-between gap-2"><p className="font-medium text-sm">{r.id}</p><label className="text-xs flex items-center gap-1"><input type="checkbox" checked={r.activa} onChange={e => editar(i, { activa: e.target.checked })} /> activa</label></div>
          <p className="text-xs text-gray-400 mt-1">{r.descripcion}</p>
          <div className="flex gap-2 mt-2">
            {'umbral' in r && <label className="text-xs">umbral <input className="input !w-20 !py-1 inline-block ml-1" type="number" step="0.1" value={r.umbral} onChange={e => editar(i, { umbral: Number(e.target.value) })} /></label>}
            {'ventana' in r && <label className="text-xs">ventana <input className="input !w-20 !py-1 inline-block ml-1" type="number" value={r.ventana} onChange={e => editar(i, { ventana: Number(e.target.value) })} /></label>}
            {'minimo' in r && <label className="text-xs">mínimo <input className="input !w-20 !py-1 inline-block ml-1" type="number" value={r.minimo} onChange={e => editar(i, { minimo: Number(e.target.value) })} /></label>}
          </div>
        </div>
      ))}
    </div>
  )
}

function Datos() {
  const [stats, setStats] = useState(null)
  const cargar = async () => setStats({
    preguntas: await db.preguntas.count(), aprobadas: await db.preguntas.where('estado').equals('aprobada').count(), usuarios: await db.usuarios.count(),
    estudiantes: await db.usuarios.where('rol').equals('estudiante').count(), grupos: await db.grupos.count(), intentos: await db.intentos.count(), sesiones: await db.sesiones.count(), recursos: await db.recursos.count(), pendientes: await db.cola.count(),
  })
  useEffect(() => { cargar() }, [])
  const exportar = async () => {
    const respaldo = {}
    for (const t of ['preguntas', 'intentos', 'usuarios', 'grupos', 'asignaciones', 'sesiones', 'recursos', 'ciclos', 'config']) respaldo[t] = await db[t].toArray()
    const blob = new Blob([JSON.stringify(respaldo)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `saber11-respaldo-${new Date().toISOString().slice(0, 10)}.json`; a.click()
  }
  const importar = async (archivo) => {
    if (!confirm('Se fusionarán los datos del respaldo con los actuales (los registros con el mismo id se reemplazan). ¿Continuar?')) return
    const r = JSON.parse(await archivo.text())
    for (const [t, filas] of Object.entries(r)) if (db[t] && Array.isArray(filas)) await db[t].bulkPut(filas)
    alert('Respaldo importado'); cargar()
  }
  if (!stats) return null
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Metrica etiqueta="Preguntas" valor={`${stats.aprobadas}/${stats.preguntas}`} />
        <Metrica etiqueta="Estudiantes" valor={stats.estudiantes} />
        <Metrica etiqueta="Grupos" valor={stats.grupos} />
        <Metrica etiqueta="Respuestas" valor={stats.intentos} />
        <Metrica etiqueta="Pruebas" valor={stats.sesiones} />
        <Metrica etiqueta="Recursos" valor={stats.recursos} />
      </div>
      <div className="card space-y-2">
        <p className="font-medium">Respaldo</p>
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={exportar}>Exportar todo (JSON)</button>
          <label className="btn-secondary flex-1 cursor-pointer">Importar respaldo<input type="file" accept=".json" className="hidden" onChange={e => e.target.files[0] && importar(e.target.files[0])} /></label>
        </div>
        <p className="text-xs text-gray-500">En modo local, el respaldo es la única copia fuera del navegador. Haz uno después de cada jornada. Pendientes de sincronizar: {stats.pendientes}.</p>
      </div>
      {!NUBE_DISPONIBLE && <button className="btn-ghost w-full text-brand-red" onClick={async () => { if (confirm('¿Borrar usuarios y respuestas de demostración?')) { await borrarDatosDemo(); location.reload() } }}>Borrar datos de demostración</button>}
    </div>
  )
}
