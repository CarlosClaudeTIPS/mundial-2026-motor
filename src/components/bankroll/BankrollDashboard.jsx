import { TrendingUp, TrendingDown, Shield, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react'

function fmt(n) {
  return '$' + Math.abs(n).toLocaleString('es-CO')
}

export default function BankrollDashboard({ hook, onNuevaApuesta }) {
  const { state, bankActual, apuestasHoy, perdidasConsecutivas } = hook
  const { configuracion } = state

  const pct = Math.min(100, (bankActual / (configuracion.bank_inicial * 2)) * 100)
  const ganancia = bankActual - configuracion.bank_inicial
  const ganPct = ((ganancia / configuracion.bank_inicial) * 100).toFixed(1)
  const peligro = bankActual < 700000
  const critico = bankActual < 500000

  const pendientes = state.apuestas.filter(a => a.resultado === 'pendiente')
  const resueltas = state.apuestas.filter(a => a.resultado !== 'pendiente')
  const ganadas = resueltas.filter(a => a.resultado === 'ganada').length
  const perdidas = resueltas.filter(a => a.resultado === 'perdida').length
  const hitRate = resueltas.filter(a => a.resultado !== 'devuelta').length > 0
    ? ((ganadas / resueltas.filter(a => a.resultado !== 'devuelta').length) * 100).toFixed(0)
    : '--'

  const reglasOk = [
    { ok: apuestasHoy.length < configuracion.max_dia, label: `Apuestas hoy: ${apuestasHoy.length}/${configuracion.max_dia}` },
    { ok: perdidasConsecutivas < configuracion.max_perdidas_consecutivas, label: `Pérdidas seguidas: ${perdidasConsecutivas}/${configuracion.max_perdidas_consecutivas}` },
    { ok: !peligro, label: peligro ? 'ZONA DE PELIGRO — bank bajo $700k' : 'Bank en zona segura' },
  ]

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">

      {/* Bank card */}
      <div className={`rounded-2xl p-5 border ${critico ? 'bg-red-950 border-red-800' : peligro ? 'bg-orange-950 border-orange-800' : 'bg-dark-800 border-dark-600'}`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Bank actual</p>
            <p className={`text-3xl font-black ${critico ? 'text-red-300' : peligro ? 'text-orange-300' : 'text-white'}`}>
              {fmt(bankActual)}
            </p>
            <div className={`flex items-center gap-1 mt-1 text-sm font-semibold ${ganancia >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {ganancia >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {ganancia >= 0 ? '+' : '-'}{fmt(ganancia)} ({ganancia >= 0 ? '+' : ''}{ganPct}%)
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-1">Inicial</p>
            <p className="text-sm text-gray-400 font-mono">{fmt(configuracion.bank_inicial)}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-600">
            <span>$0</span>
            <span className="text-gray-500">Objetivo: {fmt(configuracion.bank_inicial * 2)}</span>
          </div>
          <div className="h-2 bg-dark-600 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${critico ? 'bg-red-500' : peligro ? 'bg-orange-500' : 'bg-green-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {peligro && (
            <p className={`text-xs ${critico ? 'text-red-400' : 'text-orange-400'}`}>
              {critico ? '🔴 CRÍTICO — App se bloqueará' : '⚠️ Zona de peligro — apuesta máx reducida a $15.000'}
            </p>
          )}
        </div>
      </div>

      {/* Hoy */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-white">{apuestasHoy.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">de {configuracion.max_dia} hoy</p>
        </div>
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-3 text-center">
          <p className={`text-2xl font-black ${perdidasConsecutivas >= configuracion.max_perdidas_consecutivas ? 'text-red-400' : 'text-white'}`}>
            {perdidasConsecutivas}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">pérd. seguidas</p>
        </div>
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-blue-400">{hitRate}%</p>
          <p className="text-xs text-gray-500 mt-0.5">hit rate</p>
        </div>
      </div>

      {/* Estado reglas */}
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1">
          <Shield size={12} /> Estado de reglas
        </p>
        <div className="space-y-2">
          {reglasOk.map(({ ok, label }) => (
            <div key={label} className="flex items-center gap-2">
              {ok
                ? <CheckCircle size={14} className="text-green-500 shrink-0" />
                : <XCircle size={14} className="text-red-500 shrink-0" />}
              <span className={`text-sm ${ok ? 'text-gray-300' : 'text-red-400'}`}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pendientes */}
      {pendientes.length > 0 && (
        <div className="bg-dark-800 border border-yellow-800/40 rounded-xl p-4">
          <p className="text-xs text-yellow-500 uppercase tracking-widest mb-3 flex items-center gap-1">
            <Clock size={12} /> Pendientes de resultado ({pendientes.length})
          </p>
          <div className="space-y-2">
            {pendientes.map(a => (
              <div key={a.id} className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-white font-medium">{a.partido}</p>
                  <p className="text-xs text-gray-500">{a.mercado} · {fmt(a.monto)}</p>
                </div>
                <span className="text-xs text-yellow-400 bg-yellow-900/30 px-2 py-1 rounded-lg">⏳ pendiente</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resumen global */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">Total apostado</p>
          <p className="text-lg font-bold text-white">{fmt(resueltas.reduce((s, a) => s + a.monto, 0))}</p>
        </div>
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">Apuestas totales</p>
          <p className="text-lg font-bold text-white">{ganadas}G / {perdidas}P</p>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={onNuevaApuesta}
        className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-black rounded-2xl text-lg transition-colors"
      >
        + Nueva apuesta
      </button>
    </div>
  )
}
