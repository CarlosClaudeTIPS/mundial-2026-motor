import { useState } from 'react'
import { FileText, Sparkles, Save, X } from 'lucide-react'
import { textoDePdf, detectarPreguntas, borradorAPregunta, completarConIA, generarConIA } from '../../lib/importar'
import { guardarPregunta } from '../../lib/banco'
import { taxonomia } from '../../lib/taxonomia'
import { NUBE_DISPONIBLE } from '../../lib/supabase'
import { Badge } from '../ui'

// ─── Importar preguntas desde PDF/texto y completar o generar con IA ─────────
// 1) Sube un PDF o pega texto (cuadernillo ICFES, guía, documento).
// 2) La app detecta las preguntas numeradas con opciones A-D y la hoja de respuestas.
// 3) Guardas los borradores (estado pendiente) y, si quieres, la IA los clasifica y
//    escribe las explicaciones de cada opción. Tú revisas y apruebas en el banco.
// También: "Generar con IA" redacta preguntas nuevas a partir del texto pegado.

export default function ImportarPreguntas({ usuario, onCerrar, onGuardado }) {
  const tax = taxonomia()
  const [prueba, setPrueba] = useState('lectura_critica')
  const [origen, setOrigen] = useState('oficial')
  const [fuente, setFuente] = useState({ nombre: '', url: '', anio: '' })
  const [prefijo, setPrefijo] = useState('IMP-' + Date.now().toString(36).toUpperCase().slice(-4))
  const [texto, setTexto] = useState('')
  const [borradores, setBorradores] = useState([])
  const [estado, setEstado] = useState('')
  const [cantidad, setCantidad] = useState(5)
  const [ocupado, setOcupado] = useState(false)

  const leerArchivo = async (archivo) => {
    setEstado('Leyendo archivo…')
    try {
      const t = archivo.name.toLowerCase().endsWith('.pdf') ? await textoDePdf(archivo) : await archivo.text()
      setTexto(t); setEstado(`Texto leído: ${t.length.toLocaleString('es-CO')} caracteres. Pulsa "Detectar preguntas".`)
    } catch (e) { setEstado('No se pudo leer el archivo: ' + e.message) }
  }

  const detectar = () => {
    const d = detectarPreguntas(texto)
    setBorradores(d.map(b => ({ ...b, incluir: true })))
    setEstado(d.length ? `${d.length} preguntas detectadas (${d.filter(b => b.correcta).length} con clave). Revisa y guarda.` : 'No se detectaron preguntas numeradas con opciones A-D. Puedes usar "Generar con IA" con este texto.')
  }

  const guardarBorradores = async (conIA) => {
    const sel = borradores.filter(b => b.incluir)
    if (!sel.length) return setEstado('No hay preguntas seleccionadas')
    if (!fuente.nombre.trim()) return setEstado('Escribe el nombre de la fuente (p. ej. "Cuadernillo Saber 11 Lectura Crítica 2025, ICFES")')
    setOcupado(true)
    let ok = 0, fallos = []
    for (const b of sel) {
      let p = borradorAPregunta(b, { prueba, origen, fuente, prefijo })
      try {
        if (conIA) { setEstado(`IA completando pregunta ${b.numero}… (${ok + 1}/${sel.length})`); p = await completarConIA(p) }
        await guardarPregunta(p); ok++
      } catch (e) { fallos.push(`P${b.numero}: ${e.message}`); try { await guardarPregunta(p) } catch {} }
    }
    setOcupado(false)
    setEstado(`${ok} preguntas guardadas en estado pendiente${fallos.length ? `. Fallos: ${fallos.join(' · ')}` : ''}. Revísalas en el banco (filtro "pendiente") y apruébalas.`)
    onGuardado?.()
  }

  const generar = async () => {
    if (texto.trim().length < 80) return setEstado('Pega o carga primero un texto fuente')
    setOcupado(true); setEstado(`IA redactando ${cantidad} preguntas…`)
    try {
      const ps = await generarConIA({ prueba, texto, cantidad, fuente, prefijo: prefijo + '-G' })
      for (const p of ps) await guardarPregunta(p)
      setEstado(`${ps.length} preguntas generadas y guardadas en estado pendiente. Revísalas en el banco antes de aprobar.`)
      onGuardado?.()
    } catch (e) { setEstado('Error: ' + e.message) }
    setOcupado(false)
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold flex items-center gap-2"><FileText size={18} /> Importar preguntas desde PDF o texto</p>
        <button className="btn-ghost !p-1" onClick={onCerrar}><X size={18} /></button>
      </div>
      <p className="text-xs text-gray-400">Sube cuadernillos liberados del ICFES, guías o documentos con preguntas numeradas (1., 2., …) y opciones A-D. Todo queda <b>pendiente</b> hasta que lo revises. Respeta los términos de uso de cada fuente: el ICFES permite uso académico con cita.</p>

      <div className="grid sm:grid-cols-2 gap-2">
        <div><label className="label">Prueba</label><select className="input" value={prueba} onChange={e => setPrueba(e.target.value)}>{tax.pruebas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
        <div><label className="label">Origen</label><select className="input" value={origen} onChange={e => setOrigen(e.target.value)}><option value="oficial">Oficial (ICFES, con enlace)</option><option value="estilo">Estilo Saber 11 (otra fuente)</option></select></div>
        <div><label className="label">Fuente (obligatoria)</label><input className="input" placeholder="Cuadernillo Saber 11 · Matemáticas 2025 · ICFES" value={fuente.nombre} onChange={e => setFuente({ ...fuente, nombre: e.target.value })} /></div>
        <div><label className="label">Enlace de la fuente</label><input className="input" placeholder="https://www.icfes.gov.co/…" value={fuente.url} onChange={e => setFuente({ ...fuente, url: e.target.value })} /></div>
        <div><label className="label">Año</label><input className="input" placeholder="2025" value={fuente.anio} onChange={e => setFuente({ ...fuente, anio: e.target.value })} /></div>
        <div><label className="label">Prefijo de ids</label><input className="input font-mono" value={prefijo} onChange={e => setPrefijo(e.target.value.toUpperCase())} /></div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <label className="btn-secondary cursor-pointer"><FileText size={16} /> Subir PDF o TXT<input type="file" accept=".pdf,.txt,.md" className="hidden" onChange={e => e.target.files[0] && leerArchivo(e.target.files[0])} /></label>
        <span className="text-xs text-gray-500">o pega el texto abajo</span>
      </div>
      <textarea className="input font-mono text-xs" rows="8" placeholder={'1. ¿Cuál es…?\nA. …\nB. …\nC. …\nD. …\n\n2. …'} value={texto} onChange={e => setTexto(e.target.value)} />

      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={detectar} disabled={!texto.trim() || ocupado}>Detectar preguntas</button>
        <div className="flex items-center gap-1 ml-auto">
          <input className="input !w-16" type="number" min="1" max="10" value={cantidad} onChange={e => setCantidad(e.target.value)} />
          <button className="btn-secondary" onClick={generar} disabled={ocupado || !NUBE_DISPONIBLE} title={NUBE_DISPONIBLE ? '' : 'Solo con la nube configurada'}><Sparkles size={16} /> Generar con IA desde este texto</button>
        </div>
      </div>
      {estado && <p className="text-sm text-gray-300">{estado}</p>}

      {borradores.length > 0 && (
        <div className="space-y-2">
          <div className="max-h-80 overflow-y-auto divide-y divide-dark-700 border border-dark-700 rounded-xl">
            {borradores.map((b, i) => (
              <label key={i} className="flex gap-2 p-2 text-sm cursor-pointer hover:bg-dark-900">
                <input type="checkbox" checked={b.incluir} onChange={e => setBorradores(borradores.map((x, j) => j === i ? { ...x, incluir: e.target.checked } : x))} className="mt-1" />
                <div className="min-w-0 flex-1">
                  <p className="text-gray-200"><span className="font-mono text-xs text-gray-500 mr-1">{b.numero}.</span>{b.enunciado.slice(0, 160)}{b.enunciado.length > 160 ? '…' : ''}</p>
                  <p className="text-xs text-gray-500">{b.opciones.length} opciones · {b.correcta ? <Badge tono="verde">clave {b.correcta}</Badge> : <Badge tono="ambar">sin clave</Badge>}{b.contexto ? ' · con contexto' : ''}</p>
                </div>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" disabled={ocupado} onClick={() => guardarBorradores(false)}><Save size={16} /> Guardar como pendientes</button>
            <button className="btn-primary" disabled={ocupado || !NUBE_DISPONIBLE} onClick={() => guardarBorradores(true)} title={NUBE_DISPONIBLE ? '' : 'Solo con la nube configurada'}><Sparkles size={16} /> Guardar y completar con IA</button>
          </div>
          <p className="text-[11px] text-gray-500">"Completar con IA" clasifica cada pregunta (competencia, habilidad, dificultad) y escribe la explicación de cada opción; marca con "revisar" lo que no pudo determinar con certeza. Sin clave en la fuente, la IA propone una y lo advierte.</p>
        </div>
      )}
    </div>
  )
}
