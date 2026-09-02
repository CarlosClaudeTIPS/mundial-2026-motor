import { useState, useRef } from 'react'
import { ArrowLeft, Upload, Loader2, AlertTriangle, XCircle, CheckCircle, ImageIcon, Edit2 } from 'lucide-react'

const CASAS = ['BetWinner', 'Betplay', 'Rushbet', 'Codere', 'Wplay', 'Zamba', 'Otra']
const MERCADOS = ['Tiros totales Over', 'Tiros totales Under', 'Córners Over', 'Córners Under', 'Over 2.5 goles', 'Under 2.5 goles', 'Over 1.5 goles', 'BTTS Sí', 'BTTS No', 'Ganador local', 'Ganador visitante', 'Empate', 'Tarjetas Over', 'Tarjetas Under', 'Otro']
const DEPORTES = ['Fútbol', 'Baloncesto', 'Tenis', 'Béisbol', 'Otro']

const EMPTY = { deporte: 'Fútbol', casa: 'BetWinner', partido: '', mercado: 'Tiros totales Over', seleccion: '', cuota: '', monto: '' }

// La lectura del pantallazo pasa SIEMPRE por /api/vision (Edge Function): la
// clave de Claude vive en el servidor y nunca se expone en el navegador.
// En dev local /api no existe → si no responde, se cae al formulario manual.
const ES_DEV = !!import.meta.env.DEV

async function analizarImagen(base64, mimeType) {
  const res = await fetch('/api/vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, mimeType }),
  }).catch(() => null)

  if (!res) throw new Error(ES_DEV ? 'NO_KEY' : 'Sin conexión')
  if (res.status === 503) throw new Error('NO_KEY') // clave no configurada
  const data = await res.json().catch(() => null)
  if (!res.ok || !data) throw new Error(`Error ${res?.status ?? ''}`)
  if (!data.ok) throw new Error(data.error || 'No se pudo leer la imagen')
  return data.datos
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      const base64 = result.split(',')[1]
      resolve({ base64, mimeType: file.type })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Modal de advertencia nivel 1
function AdvertenciaModal({ msg, onEntiendo, onCancelar }) {
  const [texto, setTexto] = useState('')
  return (
    <div className="fixed inset-0 z-50 bg-red-950/95 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-red-900 border border-red-700 rounded-2xl p-6 text-center">
        <AlertTriangle size={48} className="text-red-300 mx-auto mb-4" />
        <h2 className="text-xl font-black text-red-200 mb-2">VIOLACIÓN DE REGLA</h2>
        <p className="text-red-400 text-sm mb-6">{msg}</p>
        <div className="bg-red-950 rounded-xl p-4 mb-4">
          <p className="text-red-300 text-xs mb-2">Escribe <strong>ENTIENDO</strong> para continuar:</p>
          <input
            type="text"
            value={texto}
            onChange={e => setTexto(e.target.value.toUpperCase())}
            placeholder="Escribe ENTIENDO"
            className="w-full bg-red-900 border border-red-700 rounded-lg px-3 py-2 text-white text-center font-mono focus:outline-none focus:border-red-400"
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onCancelar} className="flex-1 py-2.5 rounded-xl border border-red-700 text-red-400 font-medium text-sm">
            Cancelar
          </button>
          <button
            onClick={onEntiendo}
            disabled={texto !== 'ENTIENDO'}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm"
          >
            Registrar igual
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NuevaApuesta({ hook, onVolver }) {
  const [imagen, setImagen] = useState(null)       // { url, base64, mimeType }
  const [analizando, setAnalizando] = useState(false)
  const [extraido, setExtraido] = useState(null)   // datos extraídos por Claude
  const [editando, setEditando] = useState(false)  // mostrar form de edición
  const [form, setForm] = useState(EMPTY)
  const [errorApi, setErrorApi] = useState(null)
  const [errorForm, setErrorForm] = useState(null)
  const [advertencia, setAdvertencia] = useState(null)
  const [exito, setExito] = useState(false)
  const inputRef = useRef()

  const { validarApuesta, aplicarConsecuencia, agregarApuesta, bankActual, state } = hook
  const apuestaMax = bankActual < 700000 ? 15000 : state.configuracion.apuesta_maxima
  // En prod se asume que el proxy /api/vision está; en dev depende de la clave.
  // Si no está, se detecta al analizar (error NO_KEY → formulario manual).
  const tieneKey = !ES_DEV || !!import.meta.env.VITE_ANTHROPIC_API_KEY

  async function handleImagen(file) {
    if (!file) return
    const url = URL.createObjectURL(file)
    const { base64, mimeType } = await fileToBase64(file)
    setImagen({ url, base64, mimeType })
    setExtraido(null)
    setEditando(false)
    setErrorApi(null)

    if (!tieneKey) {
      // Sin API key: mostrar form manual con la imagen como referencia
      setEditando(true)
      setForm(EMPTY)
      return
    }

    setAnalizando(true)
    try {
      const datos = await analizarImagen(base64, mimeType)
      setExtraido(datos)
      // Pre-llenar form con lo extraído para si quiere editar
      setForm({
        deporte: datos.deporte || 'Fútbol',
        casa: datos.casa || 'BetWinner',
        partido: datos.partido || '',
        mercado: datos.mercado || 'Otro',
        seleccion: datos.seleccion || '',
        cuota: datos.cuota ?? '',
        monto: datos.monto ?? '',
      })
    } catch (e) {
      if (e.message === 'NO_KEY') {
        setEditando(true)
      } else {
        setErrorApi(e.message)
        setEditando(true)
        setForm(EMPTY)
      }
    } finally {
      setAnalizando(false)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith('image/')) handleImagen(file)
  }

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }))
    setErrorForm(null)
  }

  function datosParaRegistrar() {
    if (editando || !extraido) return form
    return {
      deporte: extraido.deporte || form.deporte,
      casa: extraido.casa || form.casa,
      partido: extraido.partido || form.partido,
      mercado: extraido.mercado || form.mercado,
      seleccion: extraido.seleccion || form.seleccion,
      cuota: extraido.cuota ?? form.cuota,
      monto: extraido.monto ?? form.monto,
    }
  }

  function ganancia() {
    const d = datosParaRegistrar()
    const m = Number(d.monto)
    const c = Number(d.cuota)
    if (!m || !c) return null
    return Math.round(m * c)
  }

  function handleSubmit(forzar = false) {
    const d = datosParaRegistrar()
    const monto = Number(d.monto)
    const cuota = Number(d.cuota)

    if (!d.partido?.trim()) return setErrorForm('Falta el partido')
    if (!monto || monto < 100) return setErrorForm('Monto inválido')
    if (!cuota || cuota < 1.01) return setErrorForm('Cuota inválida')

    const validacion = validarApuesta(monto)
    if (!validacion.ok && !forzar) {
      const nivel = aplicarConsecuencia(validacion.regla, validacion.msg)
      if (nivel === 1) { setAdvertencia(validacion.msg); return }
      return
    }

    agregarApuesta({
      deporte: d.deporte || 'Fútbol',
      casa: d.casa,
      partido: d.partido?.trim(),
      mercado: d.mercado,
      seleccion: d.seleccion,
      cuota,
      monto,
      ganancia_potencial: ganancia(),
      imagen_url: imagen?.url ?? null,
    })

    setExito(true)
    setTimeout(() => { setExito(false); onVolver() }, 1500)
  }

  if (exito) {
    return (
      <div className="min-h-64 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3">✅</div>
          <p className="text-white font-bold text-lg">Apuesta registrada</p>
        </div>
      </div>
    )
  }

  const d = datosParaRegistrar()
  const gananciaPot = ganancia()

  return (
    <div className="p-4 max-w-lg mx-auto">
      {advertencia && (
        <AdvertenciaModal
          msg={advertencia}
          onEntiendo={() => { setAdvertencia(null); handleSubmit(true) }}
          onCancelar={() => setAdvertencia(null)}
        />
      )}

      <button onClick={onVolver} className="flex items-center gap-2 text-gray-400 hover:text-white mb-5 text-sm">
        <ArrowLeft size={16} /> Volver
      </button>

      <h2 className="text-xl font-black text-white mb-1">Nueva apuesta</h2>
      <p className="text-gray-500 text-sm mb-5">
        {tieneKey ? 'Sube el pantallazo y Claude extrae todo automáticamente.' : 'Sube el pantallazo como referencia y llena los datos.'}
      </p>

      {/* Zona de upload — siempre visible y prominente */}
      <div
        className={`relative rounded-2xl border-2 border-dashed transition-colors cursor-pointer mb-4 ${
          imagen ? 'border-dark-500' : 'border-green-700 hover:border-green-500'
        }`}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => handleImagen(e.target.files[0])}
        />

        {!imagen ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="w-16 h-16 bg-green-900/40 rounded-2xl flex items-center justify-center mb-4">
              <Upload size={28} className="text-green-400" />
            </div>
            <p className="text-white font-bold mb-1">Sube el pantallazo de la apuesta</p>
            <p className="text-gray-500 text-sm">Arrastra la imagen aquí o toca para seleccionar</p>
            {!tieneKey && (
              <p className="text-orange-400 text-xs mt-3 bg-orange-900/20 border border-orange-800/40 rounded-lg px-3 py-2">
                Sin API key — sube la imagen como referencia y llena los datos tú mismo
              </p>
            )}
          </div>
        ) : (
          <div className="relative">
            <img
              src={imagen.url}
              alt="Pantallazo apuesta"
              className="w-full rounded-2xl object-contain max-h-72"
            />
            <button
              onClick={e => { e.stopPropagation(); setImagen(null); setExtraido(null); setEditando(false); setForm(EMPTY) }}
              className="absolute top-2 right-2 w-7 h-7 bg-dark-900/80 rounded-full flex items-center justify-center text-gray-300 hover:text-white"
            >
              <XCircle size={16} />
            </button>
            <button
              onClick={e => { e.stopPropagation() }}
              className="absolute bottom-2 right-2 text-xs bg-dark-900/80 text-gray-400 px-2 py-1 rounded-lg hover:text-white"
            >
              cambiar imagen
            </button>
          </div>
        )}
      </div>

      {/* Estado: analizando */}
      {analizando && (
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 text-center mb-4">
          <Loader2 size={32} className="text-green-400 mx-auto mb-3 animate-spin" />
          <p className="text-white font-semibold">Analizando el pantallazo...</p>
          <p className="text-gray-500 text-sm mt-1">Claude está extrayendo los datos de la apuesta</p>
        </div>
      )}

      {/* Error de API */}
      {errorApi && (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-3 mb-4 flex items-start gap-2">
          <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm">Error al analizar: {errorApi}. Llena los datos manualmente.</p>
        </div>
      )}

      {/* Datos extraídos — tarjeta de confirmación */}
      {extraido && !editando && !analizando && (
        <div className="bg-dark-800 border border-green-800/50 rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-400" />
              <span className="text-green-400 font-semibold text-sm">Datos extraídos</span>
            </div>
            <button
              onClick={() => setEditando(true)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-white"
            >
              <Edit2 size={12} /> Editar
            </button>
          </div>

          <div className="space-y-2">
            {[
              { label: 'Deporte', val: extraido.deporte },
              { label: 'Casa', val: extraido.casa },
              { label: 'Partido', val: extraido.partido },
              { label: 'Mercado', val: extraido.mercado },
              { label: 'Selección', val: extraido.seleccion },
              { label: 'Cuota', val: extraido.cuota },
              { label: 'Monto', val: extraido.monto ? '$' + Number(extraido.monto).toLocaleString('es-CO') : null },
            ].map(({ label, val }) => (
              <div key={label} className="flex justify-between items-baseline">
                <span className="text-gray-500 text-sm">{label}</span>
                <span className={`text-sm font-medium ${val ? 'text-white' : 'text-gray-700 italic'}`}>
                  {val ?? 'no detectado'}
                </span>
              </div>
            ))}
          </div>

          {gananciaPot && (
            <div className="mt-4 pt-4 border-t border-dark-600 flex justify-between">
              <div>
                <p className="text-xs text-gray-500">Ganancia potencial</p>
                <p className="text-lg font-black text-green-400">${gananciaPot.toLocaleString('es-CO')}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Beneficio neto</p>
                <p className="text-lg font-black text-green-300">+${(gananciaPot - Number(extraido.monto)).toLocaleString('es-CO')}</p>
              </div>
            </div>
          )}

          {/* Campos null — pedir al usuario que los llene */}
          {[extraido.partido, extraido.cuota, extraido.monto].some(v => !v) && (
            <div className="mt-4 space-y-3 pt-4 border-t border-dark-600">
              <p className="text-xs text-orange-400">Algunos datos no se detectaron — complétalos:</p>
              {!extraido.partido && (
                <input type="text" placeholder="Partido (Equipo A vs Equipo B)" value={form.partido}
                  onChange={e => set('partido', e.target.value)}
                  className="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-green-500" />
              )}
              {!extraido.cuota && (
                <input type="number" placeholder="Cuota (ej: 1.75)" value={form.cuota} step="0.01" min="1.01"
                  onChange={e => set('cuota', e.target.value)}
                  className="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-green-500" />
              )}
              {!extraido.monto && (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input type="number" placeholder={`Monto (máx $${apuestaMax.toLocaleString('es-CO')})`} value={form.monto}
                    onChange={e => set('monto', e.target.value)}
                    className="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-2.5 pl-7 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-green-500" />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Form manual — cuando no hay key, hubo error, o el usuario quiere editar */}
      {(editando || (!extraido && !analizando && imagen)) && (
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-5 mb-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <ImageIcon size={14} className="text-gray-500" />
              {editando && extraido ? 'Editar datos extraídos' : 'Llenar datos manualmente'}
            </p>
            {editando && extraido && (
              <button onClick={() => setEditando(false)} className="text-xs text-gray-500 hover:text-white">
                ← Volver a extraídos
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-widest block mb-2">Deporte</label>
              <select value={form.deporte} onChange={e => set('deporte', e.target.value)}
                className="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-green-500">
                {DEPORTES.map(x => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-widest block mb-2">Casa</label>
              <select value={form.casa} onChange={e => set('casa', e.target.value)}
                className="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-green-500">
                {CASAS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 uppercase tracking-widest block mb-2">Partido</label>
            <input type="text" value={form.partido} onChange={e => set('partido', e.target.value)}
              placeholder="Colombia vs Argentina"
              className="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-green-500" />
          </div>

          <div>
            <label className="text-xs text-gray-500 uppercase tracking-widest block mb-2">Mercado</label>
            <select value={form.mercado} onChange={e => set('mercado', e.target.value)}
              className="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-green-500">
              {MERCADOS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 uppercase tracking-widest block mb-2">Selección / Línea</label>
            <input type="text" value={form.seleccion} onChange={e => set('seleccion', e.target.value)}
              placeholder="Over 23.5"
              className="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-green-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-widest block mb-2">Cuota</label>
              <input type="number" value={form.cuota} onChange={e => set('cuota', e.target.value)}
                placeholder="1.75" step="0.01" min="1.01"
                className="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-green-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-widest block mb-2">Monto</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input type="number" value={form.monto} onChange={e => set('monto', e.target.value)}
                  placeholder="25000" step="1000"
                  className="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-2.5 pl-7 text-white placeholder-gray-600 focus:outline-none focus:border-green-500" />
              </div>
            </div>
          </div>

          {gananciaPot && (
            <div className="bg-green-900/20 border border-green-800/40 rounded-xl p-3 flex justify-between">
              <div>
                <p className="text-xs text-gray-500">Ganancia potencial</p>
                <p className="text-lg font-black text-green-400">${gananciaPot.toLocaleString('es-CO')}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Beneficio neto</p>
                <p className="text-lg font-black text-green-300">+${(gananciaPot - Number(form.monto)).toLocaleString('es-CO')}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sin imagen aún — no mostrar botón */}
      {!imagen && !analizando && (
        <p className="text-center text-gray-600 text-sm py-4">Sube un pantallazo para continuar</p>
      )}

      {errorForm && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 mb-3">
          <XCircle size={14} className="text-red-400 shrink-0" />
          <p className="text-red-400 text-sm">{errorForm}</p>
        </div>
      )}

      {/* Botón registrar — solo visible cuando hay datos suficientes */}
      {imagen && !analizando && (extraido || editando) && (
        <button
          onClick={() => handleSubmit()}
          className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-black rounded-2xl text-lg transition-colors"
        >
          Registrar apuesta
        </button>
      )}
    </div>
  )
}
