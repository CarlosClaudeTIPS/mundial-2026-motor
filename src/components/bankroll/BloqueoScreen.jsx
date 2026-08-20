import { useState, useEffect } from 'react'
import { Lock, AlertTriangle } from 'lucide-react'

function useCountdown(hasta) {
  const [resta, setResta] = useState(Math.max(0, hasta - Date.now()))
  useEffect(() => {
    const t = setInterval(() => setResta(Math.max(0, hasta - Date.now())), 1000)
    return () => clearInterval(t)
  }, [hasta])
  return resta
}

function fmt(ms) {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const seg = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(seg).padStart(2, '0')}`
}

export default function BloqueoScreen({ bloqueo }) {
  const resta = useCountdown(bloqueo.hasta ?? 0)
  const es24h = bloqueo.nivel >= 3

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${es24h ? 'bg-red-950' : 'bg-dark-900'}`}
      style={es24h ? { animation: 'none' } : {}}>
      <div className="text-center max-w-md mx-4">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${es24h ? 'bg-red-800' : 'bg-orange-900'}`}>
          <Lock size={40} className={es24h ? 'text-red-300' : 'text-orange-300'} />
        </div>

        {es24h ? (
          <>
            <h1 className="text-3xl font-black text-red-300 mb-2 tracking-widest">MODO INCUMPLIMIENTO</h1>
            <p className="text-red-400 text-sm mb-6">Violaste tus propias reglas por tercera vez.<br />La app está bloqueada.</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-black text-orange-300 mb-2">APP BLOQUEADA</h1>
            <p className="text-orange-400 text-sm mb-6">Segunda violación de reglas hoy.<br />Tiempo para calmarte.</p>
          </>
        )}

        <div className={`rounded-2xl p-6 mb-6 ${es24h ? 'bg-red-900/50 border border-red-700' : 'bg-dark-800 border border-orange-800'}`}>
          <p className={`text-xs mb-2 uppercase tracking-widest ${es24h ? 'text-red-400' : 'text-orange-400'}`}>Disponible en</p>
          <p className={`text-5xl font-mono font-black ${es24h ? 'text-red-200' : 'text-orange-200'}`}>{fmt(resta)}</p>
        </div>

        <div className={`rounded-xl p-4 text-left text-sm ${es24h ? 'bg-red-900/30 border border-red-800' : 'bg-dark-800 border border-dark-600'}`}>
          <p className={`font-semibold mb-1 ${es24h ? 'text-red-300' : 'text-orange-300'}`}>
            <AlertTriangle size={14} className="inline mr-1" />
            Regla violada:
          </p>
          <p className={es24h ? 'text-red-400' : 'text-orange-400'}>{bloqueo.motivo}</p>
        </div>

        {es24h && (
          <div className="mt-6 p-4 bg-red-900/20 border border-red-900 rounded-xl">
            <p className="text-red-500 text-xs">
              Balance actual puede estar en riesgo.<br />
              Usa este tiempo para reflexionar.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
