import { useMemo } from 'react'
import { buildGameState, explicarEstado, GAME_STATE_STATUS } from '../lib/game-state'

// ─── ESTADO DEL PARTIDO — motor EXPERIMENTAL, solo diagnóstico ───────────────
// No decide señales ni modifica proyecciones: muestra cómo el estado (marcador
// × tiempo × fuerza × respuesta observada) DEBERÍA modular la expectativa, y lo
// compara contra lo que aplica el baseline actual. Se promueve solo si el
// backtest demuestra mejora.

const NIVEL_COLOR = { ALTO: 'text-green-400', MEDIO: 'text-yellow-400', BAJO: 'text-red-400' }

export default function GameStatePanel({ minuto, golesA, golesB, preA, preB, perTeam, snaps, reds, homeName, awayName }) {
  const gs = useMemo(() => {
    if (!minuto) return null
    return buildGameState({
      minuto, golesH: golesA, golesA: golesB,
      priorH: preA, priorA: preB,
      shotsH: perTeam?.h?.shots, shotsA: perTeam?.a?.shots,
      priorShotsH: preA ? preA.shots_avg : null,
      priorShotsA: preB ? preB.shots_avg : null,
      snaps: snaps ?? [], redH: reds?.h ?? 0, redA: reds?.a ?? 0,
    })
  }, [minuto, golesA, golesB, preA, preB, perTeam, snaps, reds])

  const tn = { h: homeName?.trim() || 'Local', a: awayName?.trim() || 'Visitante' }
  const exH = useMemo(() => gs ? explicarEstado(gs, 'H', tn.h, tn.a) : null, [gs, tn.h, tn.a])
  const exA = useMemo(() => gs ? explicarEstado(gs, 'A', tn.a, tn.h) : null, [gs, tn.h, tn.a])

  if (!gs) return null
  const diffH = gs.diffH
  // El lado interesante: el que persigue; si hay empate, el que domina
  const foco = diffH < 0 ? 'H' : diffH > 0 ? 'A' : (gs.dominio.shareLocal >= 0.5 ? 'H' : 'A')
  const ex = foco === 'H' ? exH : exA
  const st = foco === 'H' ? gs.stateExpH : gs.stateExpA
  const base = foco === 'H' ? gs.stateBaseH : gs.stateBaseA

  return (
    <div className="rounded-2xl border-2 border-violet-700/50 bg-gradient-to-b from-violet-950/30 to-dark-800 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-black text-violet-300 tracking-wide">🧠 ESTADO DEL PARTIDO</h2>
        <span className="text-[10px] text-yellow-600/90">{GAME_STATE_STATUS} — diagnóstico, todavía NO decide las señales</span>
      </div>

      {/* Vector de estado */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center text-[11px]">
        {[
          ['Marcador', `${gs.marcador} · ${gs.minuto}'`],
          ['Favorito prepartido', gs.favorito],
          ['Persiguiendo', diffH < 0 ? tn.h : diffH > 0 ? tn.a : '—'],
          ['Persecución efectiva', diffH === 0 ? '—' : `${(foco === 'H' ? gs.chasingH : gs.chasingA).nivel}`, NIVEL_COLOR[(foco === 'H' ? gs.chasingH : gs.chasingA).nivel]],
          ['Dominio', gs.dominio.disponible ? gs.dominio.tipo : 'sin datos'],
          ['Cierre', gs.cierre.nivel],
        ].map(([l, v, cls]) => (
          <div key={l} className="bg-dark-800/70 rounded-lg p-2">
            <p className="text-[9px] text-gray-500">{l}</p>
            <p className={`font-bold ${cls ?? 'text-white'}`}>{v}</p>
          </div>
        ))}
      </div>

      {/* Comparación baseline vs experimental */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] bg-dark-800/50 rounded-lg px-2 py-1.5 border border-dark-600">
        <span className="text-gray-400">Ajuste por estado sobre <strong className="text-white">{foco === 'H' ? tn.h : tn.a}</strong>:</span>
        <span className="text-gray-400">baseline actual <strong className="text-gray-300">×{base.toFixed(2)}</strong> <span className="text-gray-600">(solo mira el marcador)</span></span>
        <span className="text-gray-400">→ experimental <strong className={st.factor > base ? 'text-green-400' : st.factor < base ? 'text-orange-400' : 'text-white'}>×{st.factor.toFixed(2)}</strong></span>
      </div>

      {/* Contribuciones REALES del cálculo */}
      <div className="flex flex-wrap gap-1.5 text-[10px]">
        {st.contribuciones.map(c => (
          <span key={c.factor} className={`px-2 py-1 rounded border ${
            c.valor > 0.01 ? 'bg-green-950/40 border-green-900/50 text-green-300' :
            c.valor < -0.01 ? 'bg-orange-950/40 border-orange-900/50 text-orange-300' :
            'bg-dark-700 border-dark-600 text-gray-400'}`}>
            {c.factor}: {c.valor > 0 ? '+' : ''}{Math.round(c.valor * 100)}% <span className="opacity-70">({c.nota})</span>
          </span>
        ))}
      </div>

      {/* Explicación en prosa, derivada de esos mismos factores */}
      {ex && (
        <div className="text-[11px] text-gray-300 space-y-0.5 bg-dark-800/40 rounded-lg p-2.5">
          <p>{ex.situacion} {ex.fuerza}</p>
          <p><strong className="text-white">Respuesta observada:</strong> {ex.respuesta}</p>
          <p>{ex.ritmo} {ex.tiempo} {ex.dominio}</p>
          {ex.chasing && <p>{ex.chasing}</p>}
          <p className="text-violet-300 font-semibold pt-1">{ex.proyeccion}</p>
          <p className="text-yellow-500/90">⚠️ {ex.riesgo}</p>
        </div>
      )}

      <p className="text-[10px] text-gray-600">
        Variables no disponibles en las fuentes (no se inventan): {gs.noDisponible.join(' · ')}.
      </p>
    </div>
  )
}
