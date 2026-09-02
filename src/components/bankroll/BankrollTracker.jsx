import { useState, useEffect } from 'react'
import { useBankroll } from './useBankroll'
import Onboarding from './Onboarding'
import BankrollDashboard from './BankrollDashboard'
import NuevaApuesta from './NuevaApuesta'
import HistorialApuestas from './HistorialApuestas'
import BankrollStats from './BankrollStats'
import BloqueoScreen from './BloqueoScreen'
import Cuenta from '../Cuenta'
import { LayoutDashboard, List, BarChart2, Settings } from 'lucide-react'

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'historial', label: 'Historial', icon: List },
  { id: 'stats', label: 'Stats', icon: BarChart2 },
  { id: 'config', label: 'Config', icon: Settings },
]

function ConfigPanel({ hook }) {
  const { state, resetearTodo, guardarConfig } = hook
  const [confirm, setConfirm] = useState(false)
  const c = state.configuracion
  const [min, setMin] = useState(c.meta_diaria_min ?? 40000)
  const [max, setMax] = useState(c.meta_diaria_max ?? 60000)
  const [guardado, setGuardado] = useState(false)

  const guardarMetas = () => {
    const mn = Math.max(0, Number(min) || 0)
    const mx = Math.max(mn, Number(max) || 0) // el techo nunca por debajo del piso
    guardarConfig({ meta_diaria_min: mn, meta_diaria_max: mx })
    setMax(mx)
    setGuardado(true); setTimeout(() => setGuardado(false), 1500)
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 className="text-xl font-black text-white">Configuración</h2>

      {/* Cuenta / sincronización — visible en todos los tamaños */}
      <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
        <div className="px-4 pt-3">
          <p className="text-xs text-gray-500 uppercase tracking-widest">☁️ Guardar mis datos (nube)</p>
          <p className="text-[11px] text-gray-600 mt-1">Sin login, el bankroll vive solo en este dispositivo. Con login viaja a la nube y lo ves en el celular y el PC.</p>
        </div>
        <Cuenta compacto />
      </div>

      {/* Objetivo diario — editable */}
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-4 space-y-3">
        <p className="text-xs text-gray-500 uppercase tracking-widest">🎯 Objetivo diario (ganancia neta)</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Piso (mínimo)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input type="number" value={min} onChange={e => setMin(e.target.value)} step="5000" min="0"
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 pl-7 text-white text-sm focus:outline-none focus:border-green-500" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Techo (máximo)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input type="number" value={max} onChange={e => setMax(e.target.value)} step="5000" min="0"
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 pl-7 text-white text-sm focus:outline-none focus:border-green-500" />
            </div>
          </div>
        </div>
        <button onClick={guardarMetas}
          className="w-full py-2 rounded-lg bg-green-700 hover:bg-green-600 text-white text-sm font-bold transition-colors">
          {guardado ? '✅ Guardado' : 'Guardar objetivo'}
        </button>
        <p className="text-[11px] text-gray-600">Al llegar al techo, el dashboard te avisa que pares por hoy.</p>
      </div>

      <div className="bg-dark-800 border border-dark-600 rounded-xl p-4 space-y-3">
        <p className="text-xs text-gray-500 uppercase tracking-widest">Reglas activas</p>
        {[
          ['Bank inicial', '$' + state.configuracion.bank_inicial.toLocaleString('es-CO')],
          ['Apuesta máxima', '$' + state.configuracion.apuesta_maxima.toLocaleString('es-CO')],
          ['Apuestas por día', state.configuracion.max_dia],
          ['Pérdidas consecutivas máx', state.configuracion.max_perdidas_consecutivas],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <span className="text-sm text-gray-400">{k}</span>
            <span className="text-sm font-bold text-white">{v}</span>
          </div>
        ))}
      </div>

      <div className="bg-dark-800 border border-dark-600 rounded-xl p-4 space-y-3">
        <p className="text-xs text-gray-500 uppercase tracking-widest">Estado de bloqueos</p>
        <div className="flex justify-between">
          <span className="text-sm text-gray-400">Bloqueo activo</span>
          <span className={`text-sm font-bold ${state.bloqueo.activo ? 'text-red-400' : 'text-green-400'}`}>
            {state.bloqueo.activo ? 'Sí' : 'No'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-400">Modo roto</span>
          <span className={`text-sm font-bold ${state.modo_roto ? 'text-red-400' : 'text-green-400'}`}>
            {state.modo_roto ? 'Activo' : 'Normal'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-400">Violaciones totales</span>
          <span className="text-sm font-bold text-white">{state.violaciones.length}</span>
        </div>
      </div>

      <div className="bg-dark-800 border border-red-900/40 rounded-xl p-4">
        <p className="text-xs text-red-500 uppercase tracking-widest mb-3">Zona de peligro</p>
        {!confirm ? (
          <button
            onClick={() => setConfirm(true)}
            className="w-full py-3 border border-red-800 text-red-500 hover:text-red-400 hover:border-red-700 rounded-xl text-sm font-medium transition-colors"
          >
            Resetear todo (borrar datos)
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-red-400 text-sm">¿Seguro? Esto borrará TODAS las apuestas y el historial.</p>
            <div className="flex gap-2">
              <button onClick={resetearTodo} className="flex-1 py-2 bg-red-700 hover:bg-red-600 text-white text-sm font-bold rounded-lg">
                Sí, borrar todo
              </button>
              <button onClick={() => setConfirm(false)} className="flex-1 py-2 border border-dark-500 text-gray-400 text-sm rounded-lg hover:text-white">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function BankrollTracker() {
  const hook = useBankroll()
  const { state, completarOnboarding } = hook
  const [tab, setTab] = useState('dashboard')
  const [subView, setSubView] = useState(null) // 'nueva'

  // Modo roto: aplicar estilos a todo el tracker
  useEffect(() => {
    const el = document.getElementById('bankroll-root')
    if (!el) return
    if (state.modo_roto) {
      el.style.filter = 'hue-rotate(180deg) saturate(200%) contrast(150%)'
      el.style.animation = 'bankroll-shake 0.3s infinite'
    } else {
      el.style.filter = ''
      el.style.animation = ''
    }
  }, [state.modo_roto])

  if (!state.onboarding_completo) {
    return <Onboarding onComplete={completarOnboarding} />
  }

  // Bloqueo activo (nivel 2 o 3) — pantalla completa
  if (state.bloqueo.activo && state.bloqueo.hasta && Date.now() < state.bloqueo.hasta) {
    return <BloqueoScreen bloqueo={state.bloqueo} />
  }

  if (subView === 'nueva') {
    return (
      <div id="bankroll-root" className="min-h-screen bg-dark-900">
        <style>{`@keyframes bankroll-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-2px)} 75%{transform:translateX(2px)} }`}</style>
        <NuevaApuesta hook={hook} onVolver={() => setSubView(null)} />
      </div>
    )
  }

  return (
    <div id="bankroll-root" className="min-h-screen bg-dark-900">
      <style>{`@keyframes bankroll-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-2px)} 75%{transform:translateX(2px)} }`}</style>

      {state.modo_roto && (
        <div className="bg-red-900 border-b border-red-700 px-4 py-2 text-center">
          <p className="text-red-300 text-xs font-bold uppercase tracking-widest">
            MODO INCUMPLIMIENTO — Violaste tus propias reglas
          </p>
        </div>
      )}

      {/* Content */}
      <div className="pb-20">
        {tab === 'dashboard' && (
          <BankrollDashboard hook={hook} onNuevaApuesta={() => setSubView('nueva')} />
        )}
        {tab === 'historial' && <HistorialApuestas hook={hook} />}
        {tab === 'stats' && <BankrollStats hook={hook} />}
        {tab === 'config' && <ConfigPanel hook={hook} />}
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-dark-800 border-t border-dark-600 flex md:hidden">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
              tab === id ? 'text-green-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon size={18} />
            <span className="text-xs">{label}</span>
          </button>
        ))}
      </div>

      {/* Desktop tab nav */}
      <div className="hidden md:block fixed bottom-4 left-1/2 -translate-x-1/2">
        <div className="flex gap-1 bg-dark-800 border border-dark-600 rounded-2xl p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                tab === id ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
