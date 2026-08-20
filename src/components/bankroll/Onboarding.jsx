import { useState } from 'react'
import { Shield, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react'

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0)
  const [config, setConfig] = useState({
    bank_inicial: 1000000,
    apuesta_maxima: 25000,
    max_dia: 4,
    max_perdidas_consecutivas: 2,
  })
  const [acepto, setAcepto] = useState(false)

  const pasos = [
    {
      icon: DollarSign,
      title: 'Tu bankroll inicial',
      color: 'green',
      content: (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">Este es tu capital de partida. La app trackea todo desde aquí.</p>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-widest block mb-2">Bank inicial</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-400 font-bold">$</span>
              <input
                type="number"
                value={config.bank_inicial}
                onChange={e => setConfig(c => ({ ...c, bank_inicial: Number(e.target.value) }))}
                className="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 pl-8 text-white text-lg font-bold focus:outline-none focus:border-green-500"
              />
            </div>
            <p className="text-xs text-gray-600 mt-2">Configurado en $1.000.000 por defecto</p>
          </div>
        </div>
      ),
    },
    {
      icon: Shield,
      title: 'Tus reglas de disciplina',
      color: 'blue',
      content: (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">Estas reglas se validarán antes de cada apuesta. Si las violas, hay consecuencias.</p>
          {[
            { key: 'apuesta_maxima', label: 'Máximo por apuesta', prefix: '$', min: 5000, step: 5000 },
            { key: 'max_dia', label: 'Apuestas máx por día', prefix: '', min: 1, step: 1 },
            { key: 'max_perdidas_consecutivas', label: 'Pérdidas consecutivas máx', prefix: '', min: 1, step: 1 },
          ].map(({ key, label, prefix, min, step: s }) => (
            <div key={key}>
              <label className="text-xs text-gray-500 uppercase tracking-widest block mb-2">{label}</label>
              <div className="relative">
                {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 font-bold">{prefix}</span>}
                <input
                  type="number"
                  value={config[key]}
                  min={min}
                  step={s}
                  onChange={e => setConfig(c => ({ ...c, [key]: Number(e.target.value) }))}
                  className={`w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 ${prefix ? 'pl-8' : ''} text-white font-bold focus:outline-none focus:border-blue-500`}
                />
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: AlertTriangle,
      title: 'Consecuencias por incumplir',
      color: 'orange',
      content: (
        <div className="space-y-3">
          <p className="text-gray-400 text-sm">Si violas tus reglas, esto pasa automáticamente:</p>
          {[
            { n: '1ra vez', desc: 'Pantalla de advertencia roja. Debes escribir "ENTIENDO" para continuar.' },
            { n: '2da vez', desc: 'La app se bloquea por 2 horas. No puedes registrar nada.' },
            { n: '3ra vez', desc: 'Bloqueo de 24 horas + interfaz en modo incumplimiento.' },
          ].map(({ n, desc }) => (
            <div key={n} className="flex gap-3 bg-dark-700 rounded-xl p-3 border border-dark-500">
              <span className="text-orange-400 font-bold text-xs w-14 shrink-0 pt-0.5">{n}</span>
              <span className="text-gray-300 text-sm">{desc}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: CheckCircle,
      title: 'Compromiso',
      color: 'green',
      content: (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">Antes de empezar, confirma que entiendes esto:</p>
          <div className="bg-dark-700 rounded-xl p-4 border border-dark-500 space-y-3">
            {[
              'Puedo perder el dinero que apuesto',
              'Las apuestas son entretenimiento, no ingreso principal',
              'Este tracker me ayuda con disciplina, no garantiza ganancias',
            ].map(txt => (
              <div key={txt} className="flex items-start gap-2">
                <CheckCircle size={14} className="text-green-500 shrink-0 mt-0.5" />
                <span className="text-gray-300 text-sm">{txt}</span>
              </div>
            ))}
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acepto}
              onChange={e => setAcepto(e.target.checked)}
              className="w-4 h-4 accent-green-500"
            />
            <span className="text-sm text-gray-300">Entiendo todo lo anterior y quiero empezar</span>
          </label>
          <p className="text-xs text-gray-600">
            Línea de juego responsable Colombia: <span className="text-gray-500">01-8000-522-521</span>
          </p>
        </div>
      ),
    },
  ]

  const paso = pasos[step]
  const Icon = paso.icon
  const colors = {
    green: 'bg-green-600/20 border-green-600/30 text-green-400',
    blue: 'bg-blue-600/20 border-blue-600/30 text-blue-400',
    orange: 'bg-orange-600/20 border-orange-600/30 text-orange-400',
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {pasos.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-green-500' : 'bg-dark-600'}`} />
          ))}
        </div>

        <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center mb-4 ${colors[paso.color]}`}>
          <Icon size={24} />
        </div>

        <h2 className="text-xl font-black text-white mb-1">{paso.title}</h2>
        <p className="text-xs text-gray-600 mb-6">Paso {step + 1} de {pasos.length}</p>

        <div className="mb-8">{paso.content}</div>

        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex-1 py-3 rounded-xl border border-dark-500 text-gray-400 hover:text-white transition-colors font-medium"
            >
              Atrás
            </button>
          )}
          <button
            onClick={() => {
              if (step < pasos.length - 1) setStep(s => s + 1)
              else if (acepto) onComplete(config)
            }}
            disabled={step === pasos.length - 1 && !acepto}
            className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition-colors"
          >
            {step < pasos.length - 1 ? 'Siguiente' : 'Empezar'}
          </button>
        </div>
      </div>
    </div>
  )
}
