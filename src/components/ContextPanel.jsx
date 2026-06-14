import {
  JORNADA_OPTIONS, DESCANSO_OPTIONS, MOTIVACION_OPTIONS, CONTEXTO_CHECKS,
} from '../lib/context'

function Block({ title, children }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-dark-600 pb-1">{title}</h3>
      {children}
    </div>
  )
}

function ToggleGroup({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            value === opt.value
              ? 'bg-green-700 text-white'
              : 'bg-dark-700 text-gray-400 hover:text-white'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export default function ContextPanel({ ctx, onChange, teamAName, teamBName, sameGroup }) {
  const set = (key, val) => onChange({ ...ctx, [key]: val })

  return (
    <div className="space-y-5">

      {/* ── Bloque 1: Jornada ── */}
      {sameGroup && (
        <Block title="Jornada">
          <ToggleGroup
            options={JORNADA_OPTIONS}
            value={ctx.jornada}
            onChange={v => set('jornada', v)}
          />
        </Block>
      )}

      {/* ── Bloque 2: Días de descanso ── */}
      <Block title="Días de Descanso">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: teamAName || 'Equipo A', keyDias: 'descansoA', keyViaje: 'viajeA' },
            { label: teamBName || 'Equipo B', keyDias: 'descansoB', keyViaje: 'viajeB' },
          ].map(({ label, keyDias, keyViaje }) => (
            <div key={keyDias} className="space-y-2">
              <p className="text-xs text-gray-300 font-medium">{label}</p>
              <ToggleGroup
                options={DESCANSO_OPTIONS}
                value={ctx[keyDias]}
                onChange={v => set(keyDias, v)}
              />
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ctx[keyViaje] ?? false}
                  onChange={e => set(keyViaje, e.target.checked)}
                  className="accent-green-500"
                />
                Viaje largo (&gt;5h vuelo o zona horaria &gt;5h)
              </label>
            </div>
          ))}
        </div>
      </Block>

      {/* ── Bloque 3: Motivación ── */}
      <Block title="Situación en el Torneo">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: teamAName || 'Equipo A', key: 'motA' },
            { label: teamBName || 'Equipo B', key: 'motB' },
          ].map(({ label, key }) => (
            <div key={key} className="space-y-2">
              <p className="text-xs text-gray-300 font-medium">{label}</p>
              <div className="flex flex-col gap-1">
                {MOTIVACION_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => set(key, opt.value)}
                    className={`text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      ctx[key] === opt.value
                        ? 'bg-green-700 text-white'
                        : 'bg-dark-700 text-gray-400 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Block>

      {/* ── Bloque 4: Contexto adicional ── */}
      <Block title="Contexto Adicional">
        <div className="space-y-2">
          {CONTEXTO_CHECKS.map(c => (
            <label key={c.key} className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={ctx.checks?.[c.key] ?? false}
                onChange={e => set('checks', { ...(ctx.checks ?? {}), [c.key]: e.target.checked })}
                className="accent-green-500"
              />
              {c.label}
            </label>
          ))}
        </div>
      </Block>
    </div>
  )
}
