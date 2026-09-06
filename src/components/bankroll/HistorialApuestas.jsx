import { useState } from 'react'
import { CheckCircle, XCircle, RefreshCw, Clock, Trash2 } from 'lucide-react'

function fmt(n) { return '$' + n.toLocaleString('es-CO') }

const ESTADO_CONFIG = {
  ganada:   { label: 'Ganada',   icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-900/20 border-green-800/40' },
  perdida:  { label: 'Perdida',  icon: XCircle,     color: 'text-red-400',   bg: 'bg-red-900/20 border-red-800/40' },
  devuelta: { label: 'Devuelta', icon: RefreshCw,   color: 'text-blue-400',  bg: 'bg-blue-900/20 border-blue-800/40' },
  pendiente:{ label: 'Pendiente',icon: Clock,       color: 'text-yellow-400',bg: 'bg-yellow-900/10 border-yellow-800/30' },
}

export default function HistorialApuestas({ hook }) {
  const { state, actualizarResultado, editarApuesta, eliminarApuesta } = hook
  const [filtro, setFiltro] = useState('todo')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [corrigiendo, setCorrigiendo] = useState(null) // id de la apuesta cuyo resultado se está corrigiendo
  const [editando, setEditando] = useState(null)       // { id, monto, cuota } — edición de monto/cuota

  const guardarEdicion = () => {
    const monto = Number(editando.monto); const cuota = Number(editando.cuota)
    if (!monto || monto < 100 || !cuota || cuota < 1.01) return
    editarApuesta(editando.id, { monto, cuota })
    setEditando(null)
  }

  const apuestas = [...state.apuestas].reverse()

  const filtradas = filtro === 'todo' ? apuestas
    : filtro === 'pendiente' ? apuestas.filter(a => a.resultado === 'pendiente')
    : apuestas.filter(a => a.resultado === filtro)

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-xl font-black text-white mb-4">Historial</h2>

      {/* Filtros */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['todo', 'pendiente', 'ganada', 'perdida', 'devuelta'].map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
              filtro === f ? 'bg-green-600 text-white' : 'bg-dark-700 text-gray-400 hover:text-white'
            }`}
          >
            {f === 'todo' ? 'Todo' : ESTADO_CONFIG[f].label}
            {f !== 'todo' && (
              <span className="ml-1 opacity-60">
                ({apuestas.filter(a => a.resultado === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {filtradas.length === 0 && (
        <div className="text-center py-16 text-gray-600">
          <p className="text-4xl mb-3">📋</p>
          <p>No hay apuestas {filtro !== 'todo' ? `con estado "${ESTADO_CONFIG[filtro]?.label}"` : 'registradas'}</p>
        </div>
      )}

      <div className="space-y-3">
        {filtradas.map(a => {
          const cfg = ESTADO_CONFIG[a.resultado]
          const Icon = cfg.icon
          const isPendiente = a.resultado === 'pendiente'

          return (
            <div key={a.id} className={`rounded-2xl border p-4 ${cfg.bg}`}>
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {a.tipo === 'multiple' && (
                      <span className="text-[9px] font-bold bg-purple-700 text-white px-1.5 py-0.5 rounded shrink-0">
                        COMBINADA {a.selecciones?.length ?? ''}
                      </span>
                    )}
                    <p className="text-white font-bold truncate">
                      {a.tipo === 'multiple' ? `Combinada de ${a.selecciones?.length ?? '?'}` : a.partido}
                    </p>
                  </div>
                  {a.tipo !== 'multiple' && a.competicion && <p className="text-gray-400 text-xs truncate">{a.competicion}</p>}
                  <p className="text-gray-500 text-xs">
                    {a.deporte && a.tipo !== 'multiple' && <span className="text-gray-400">{a.deporte} · </span>}
                    {a.fecha} · {a.casa}
                  </p>
                </div>
                <div className={`flex items-center gap-1 text-xs font-semibold shrink-0 ${cfg.color}`}>
                  <Icon size={13} />
                  {cfg.label}
                </div>
              </div>

              {/* Selecciones de la combinada */}
              {a.tipo === 'multiple' && a.selecciones?.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {a.selecciones.map((s, i) => (
                    <div key={i} className="bg-dark-900/40 rounded-lg px-2.5 py-1.5 border border-dark-600/60">
                      <div className="flex justify-between items-baseline gap-2">
                        <p className="text-xs text-white font-medium truncate">{s.partido}</p>
                        {s.cuota && <span className="text-xs text-gray-400 shrink-0">{s.cuota}</span>}
                      </div>
                      <p className="text-[11px] text-gray-500 truncate">
                        {[s.deporte, s.mercado, s.seleccion].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Datos */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div>
                  <p className="text-xs text-gray-600 mb-0.5">{a.tipo === 'multiple' ? 'Mercado' : 'Mercado'}</p>
                  <p className="text-xs text-gray-300 font-medium leading-tight truncate">
                    {a.tipo === 'multiple' ? `${a.selecciones?.length ?? 0} selecciones` : a.mercado}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-0.5">{a.tipo === 'multiple' ? 'Cuota total' : 'Cuota'}</p>
                  <p className="text-sm font-bold text-white">{a.cuota}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-0.5">Monto</p>
                  <p className="text-sm font-bold text-white">{fmt(a.monto)}</p>
                </div>
              </div>

              {/* Editar monto / cuota (el pantallazo a veces se lee mal) */}
              {editando?.id === a.id ? (
                <div className="bg-dark-900/50 border border-yellow-800/50 rounded-xl p-3 mb-3 space-y-2">
                  <p className="text-[11px] text-yellow-400">✏️ Corrige lo que se leyó mal. La ganancia se recalcula sola.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">Monto</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                        <input type="number" value={editando.monto} min="100" step="1000" autoFocus
                          onChange={e => setEditando(ed => ({ ...ed, monto: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && guardarEdicion()}
                          className="w-full bg-dark-700 border border-dark-500 rounded-lg px-2 pl-5 py-1.5 text-white text-sm focus:outline-none focus:border-yellow-500" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">Cuota</label>
                      <input type="number" value={editando.cuota} min="1.01" step="0.01"
                        onChange={e => setEditando(ed => ({ ...ed, cuota: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && guardarEdicion()}
                        className="w-full bg-dark-700 border border-dark-500 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-yellow-500" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={guardarEdicion}
                      className="flex-1 py-1.5 rounded-lg bg-yellow-700 hover:bg-yellow-600 text-white text-xs font-bold">Guardar</button>
                    <button onClick={() => setEditando(null)}
                      className="px-4 py-1.5 border border-dark-500 text-gray-400 text-xs rounded-lg hover:text-white">Cancelar</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setEditando({ id: a.id, monto: a.monto, cuota: a.cuota }); setCorrigiendo(null) }}
                  className="mb-2 flex items-center gap-1 text-xs text-gray-500 hover:text-yellow-400 transition-colors"
                >
                  ✏️ Editar monto / cuota
                </button>
              )}

              {/* Resultado económico */}
              {!isPendiente && a.resultado !== 'pendiente' && (
                <div className={`rounded-xl p-2 mb-3 text-center ${
                  a.resultado === 'ganada' ? 'bg-green-900/30' :
                  a.resultado === 'perdida' ? 'bg-red-900/30' : 'bg-blue-900/30'
                }`}>
                  <p className={`text-base font-black ${cfg.color}`}>
                    {a.resultado === 'ganada' && `+${fmt(a.ganancia_real - a.monto)}`}
                    {a.resultado === 'perdida' && `-${fmt(a.monto)}`}
                    {a.resultado === 'devuelta' && 'Devuelto'}
                  </p>
                </div>
              )}

              {/* Botones de resultado: siempre si está pendiente; en las ya
                  resueltas, al pulsar "Corregir" (las casas se equivocan y a
                  veces cambian el resultado días después). El bank se recalcula
                  solo porque se deriva del estado actual de cada apuesta. */}
              {(isPendiente || corrigiendo === a.id) && (
                <div className="space-y-2">
                  {!isPendiente && (
                    <p className="text-[11px] text-yellow-400">✏️ Corrigiendo — el resultado actual es <b>{cfg.label}</b>. Elige el correcto:</p>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => { actualizarResultado(a.id, 'ganada'); setCorrigiendo(null) }}
                      className={`py-2 rounded-xl text-white text-xs font-bold transition-colors flex items-center justify-center gap-1 ${a.resultado === 'ganada' ? 'bg-green-900 opacity-50' : 'bg-green-700 hover:bg-green-600'}`}
                      disabled={a.resultado === 'ganada'}
                    >
                      <CheckCircle size={12} /> Ganada
                    </button>
                    <button
                      onClick={() => { actualizarResultado(a.id, 'perdida'); setCorrigiendo(null) }}
                      className={`py-2 rounded-xl text-white text-xs font-bold transition-colors flex items-center justify-center gap-1 ${a.resultado === 'perdida' ? 'bg-red-900 opacity-50' : 'bg-red-700 hover:bg-red-600'}`}
                      disabled={a.resultado === 'perdida'}
                    >
                      <XCircle size={12} /> Perdida
                    </button>
                    <button
                      onClick={() => { actualizarResultado(a.id, 'devuelta'); setCorrigiendo(null) }}
                      className={`py-2 rounded-xl text-white text-xs font-bold transition-colors flex items-center justify-center gap-1 ${a.resultado === 'devuelta' ? 'bg-blue-900 opacity-50' : 'bg-blue-700 hover:bg-blue-600'}`}
                      disabled={a.resultado === 'devuelta'}
                    >
                      <RefreshCw size={12} /> Devuelta
                    </button>
                  </div>
                  {!isPendiente && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { actualizarResultado(a.id, 'pendiente'); setCorrigiendo(null) }}
                        className="flex-1 py-1.5 rounded-lg border border-yellow-800 text-yellow-400 text-xs hover:bg-yellow-900/20 flex items-center justify-center gap-1"
                      >
                        <Clock size={11} /> Volver a pendiente
                      </button>
                      <button onClick={() => setCorrigiendo(null)} className="px-4 py-1.5 border border-dark-500 text-gray-400 text-xs rounded-lg hover:text-white">
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Acceso a corregir en las ya resueltas */}
              {!isPendiente && corrigiendo !== a.id && (
                <button
                  onClick={() => setCorrigiendo(a.id)}
                  className="mt-1 flex items-center gap-1 text-xs text-gray-500 hover:text-yellow-400 transition-colors"
                >
                  ✏️ Corregir resultado
                </button>
              )}

              {/* Delete */}
              {confirmDelete === a.id ? (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => { eliminarApuesta(a.id); setConfirmDelete(null) }}
                    className="flex-1 py-1.5 bg-red-700 hover:bg-red-600 text-white text-xs font-bold rounded-lg"
                  >
                    Confirmar eliminación
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="px-4 py-1.5 border border-dark-500 text-gray-400 text-xs rounded-lg hover:text-white"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(a.id)}
                  className="mt-2 flex items-center gap-1 text-xs text-gray-700 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={11} /> Eliminar
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
