import { useEffect, useState } from 'react'
import { veTodosLosGrupos } from '../../lib/roles'
import { Printer } from 'lucide-react'
import { elegirPreguntas, obtenerPregunta } from '../../lib/banco'
import { db } from '../../lib/db'
import { miembrosDe, todosLosGrupos, gruposDe, registrarPapel } from '../../lib/datos'
import { taxonomia, nombrePrueba } from '../../lib/taxonomia'
import PreguntaVista from '../PreguntaVista'
import { Titulo } from '../ui'

// ─── Modo papel ──────────────────────────────────────────────────────────────
// 1) Generar una prueba imprimible (con hoja de respuestas y clave aparte).
// 2) Registrar después las respuestas marcadas en papel por cada estudiante.

export default function Imprimir({ usuario, params }) {
  const tax = taxonomia()
  const [f, setF] = useState({ prueba: '', competencia: '', dificultad: '', cantidad: 10 })
  const [preguntas, setPreguntas] = useState(null)
  const [codigo, setCodigo] = useState('')
  const [modo, setModo] = useState('generar') // generar | registrar
  const [grupos, setGrupos] = useState([])
  const [grupoId, setGrupoId] = useState(params.grupo ?? '')
  const [miembros, setMiembros] = useState([])
  const [reg, setReg] = useState({ codigo: '', estudiante_id: '', claves: '' })
  const [mensaje, setMensaje] = useState('')

  useEffect(() => { (veTodosLosGrupos(usuario) ? todosLosGrupos() : gruposDe(usuario.id)).then(setGrupos) }, [usuario.id])
  useEffect(() => { if (grupoId) miembrosDe(grupoId).then(setMiembros) }, [grupoId])

  const generar = async () => {
    const filtros = {}
    for (const k of ['prueba', 'competencia', 'dificultad']) if (f[k]) filtros[k] = f[k]
    const lista = await elegirPreguntas({ n: Number(f.cantidad), ...filtros })
    const cod = `P-${Date.now().toString(36).toUpperCase()}`
    await db.config.put({ clave: `papel:${cod}`, valor: { ids: lista.map(p => p.id), fecha: new Date().toISOString(), filtros } })
    setPreguntas(lista); setCodigo(cod)
  }

  const registrar = async () => {
    setMensaje('')
    const conf = await db.config.get(`papel:${reg.codigo.trim().toUpperCase()}`)
    if (!conf) return setMensaje('No encuentro una prueba con ese código.')
    if (!reg.estudiante_id) return setMensaje('Elige el estudiante.')
    const ps = (await Promise.all(conf.valor.ids.map(obtenerPregunta))).filter(Boolean)
    const claves = reg.claves.toUpperCase().replace(/[^A-D\-]/g, '').split('')
    if (claves.length !== ps.length) return setMensaje(`La prueba tiene ${ps.length} preguntas; escribiste ${claves.length} respuestas (usa "-" para las no respondidas).`)
    await registrarPapel({ estudiante_id: reg.estudiante_id, preguntas: ps, claves: claves.map(c => (c === '-' ? null : c)) })
    setMensaje(`Registradas ${ps.length} respuestas.`); setReg({ ...reg, claves: '' })
  }

  return (
    <div className="space-y-4">
      <Titulo sub="Para estudiantes sin conexión: imprime, aplica y registra después" accion={preguntas && <button className="btn-primary no-print" onClick={() => window.print()}><Printer size={16} /> Imprimir</button>}>Modo papel</Titulo>

      <div className="no-print flex gap-2">{[['generar', 'Generar prueba'], ['registrar', 'Registrar resultados']].map(([k, n]) => <button key={k} onClick={() => setModo(k)} className={`btn flex-1 ${modo === k ? 'bg-dark-600 text-white' : 'bg-dark-900 text-gray-400'}`}>{n}</button>)}</div>

      {modo === 'generar' && (
        <>
          <div className="card no-print grid grid-cols-2 gap-2">
            <select className="input" value={f.prueba} onChange={e => setF({ ...f, prueba: e.target.value, competencia: '' })}><option value="">Todas las pruebas</option>{tax.pruebas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
            <select className="input" value={f.competencia} onChange={e => setF({ ...f, competencia: e.target.value })}><option value="">Toda competencia</option>{tax.competencias.filter(c => !f.prueba || c.prueba === f.prueba).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
            <select className="input" value={f.dificultad} onChange={e => setF({ ...f, dificultad: e.target.value })}><option value="">Toda dificultad</option><option value="1">1</option><option value="2">2</option><option value="3">3</option></select>
            <input className="input" type="number" min="1" max="60" value={f.cantidad} onChange={e => setF({ ...f, cantidad: e.target.value })} />
            <button className="btn-primary col-span-2" onClick={generar}>Generar</button>
          </div>

          {preguntas && (
            <div className="space-y-4">
              <div className="card">
                <p className="font-semibold text-lg">Prueba {codigo}</p>
                <p className="text-sm">Nombre: ______________________________ Curso: ________ Fecha: ___________</p>
                <p className="text-xs mt-1">Marca una sola opción por pregunta. Lee todo el contexto antes de responder. Verifica al final que cada respuesta responde lo que se pregunta.</p>
              </div>
              {preguntas.map((p, i) => (
                <div key={p.id} className="card">
                  <p className="text-xs text-gray-400 mb-1">{i + 1}. {nombrePrueba(p.prueba)}</p>
                  <PreguntaVista pregunta={p} modo="papel" mostrarMeta={false} />
                </div>
              ))}
              <div className="card" style={{ breakBefore: 'page' }}>
                <p className="font-semibold">Hoja de respuestas · {codigo}</p>
                <div className="grid grid-cols-5 gap-2 mt-2 text-sm">{preguntas.map((p, i) => <p key={p.id}>{i + 1}. A B C D</p>)}</div>
              </div>
              <div className="card" style={{ breakBefore: 'page' }}>
                <p className="font-semibold">Clave (solo docente) · {codigo}</p>
                <p className="text-sm mt-1 font-mono">{preguntas.map((p, i) => `${i + 1}${p.opciones.find(o => o.correcta).clave}`).join('  ')}</p>
                <p className="text-xs text-gray-500 mt-2">Para registrar: pestaña "Registrar resultados", código {codigo}, y las letras marcadas en orden (por ejemplo ABDC-A…, con "-" si no respondió).</p>
              </div>
            </div>
          )}
        </>
      )}

      {modo === 'registrar' && (
        <div className="card space-y-2">
          <input className="input font-mono" placeholder="Código de la prueba (P-…)" value={reg.codigo} onChange={e => setReg({ ...reg, codigo: e.target.value })} />
          <select className="input" value={grupoId} onChange={e => setGrupoId(e.target.value)}><option value="">Grupo…</option>{grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}</select>
          <select className="input" value={reg.estudiante_id} onChange={e => setReg({ ...reg, estudiante_id: e.target.value })}><option value="">Estudiante…</option>{miembros.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select>
          <input className="input font-mono uppercase" placeholder="Respuestas en orden, p. ej. ABDC-ABBA" value={reg.claves} onChange={e => setReg({ ...reg, claves: e.target.value })} />
          <button className="btn-primary w-full" onClick={registrar}>Registrar</button>
          {mensaje && <p className="text-sm text-gray-300">{mensaje}</p>}
          <p className="text-xs text-gray-500">Las respuestas en papel entran al historial del estudiante con modo "papel" y sin tiempo por pregunta.</p>
        </div>
      )}
    </div>
  )
}
