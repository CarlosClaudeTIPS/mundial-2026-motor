import { useState, useEffect } from 'react'
import { fetchSofaContexto } from '../lib/sofascore'
import { fetchClima } from '../lib/clima'

// ─── Contexto del partido: alineaciones, árbitro, estadio y clima ────────────
// Fuentes gratis: Sofascore (lineups/árbitro/estadio) + Open-Meteo (clima).
// IMPORTANTE: esto es CONTEXTO VISIBLE — ninguna de estas variables pesa en
// los modelos todavía (sin backtest no se inventan coeficientes). Sirven para
// que el usuario ajuste su lectura: extremos abiertos, bajas clave, lluvia.

export default function ContextoPartido({ homeTeam, awayTeam }) {
  const [ctx, setCtx] = useState(null)
  const [clima, setClima] = useState(null)
  const [estado, setEstado] = useState('cargando')

  useEffect(() => {
    let alive = true
    setCtx(null); setClima(null); setEstado('cargando')
    if (!homeTeam) { setEstado('sin'); return }

    fetchSofaContexto(homeTeam)
      .then(async c => {
        if (!alive) return
        if (!c) { setEstado('sin'); return }
        setCtx(c)
        setEstado('ok')
        // Clima: coordenadas del estadio o ciudad como fallback
        if (c.venue?.lat != null || c.venue?.city) {
          try {
            const w = await fetchClima({
              lat: c.venue.lat, lon: c.venue.lon,
              city: c.venue.city, whenTs: c.inicio ?? Date.now(),
            })
            if (alive) setClima(w)
          } catch {}
        }
      })
      .catch(() => alive && setEstado('sin'))

    return () => { alive = false }
  }, [homeTeam, awayTeam])

  if (estado === 'cargando') return (
    <p className="text-[11px] text-gray-600">📋 Cargando contexto (alineaciones, árbitro, clima)...</p>
  )
  if (estado === 'sin' || !ctx) return null

  const lu = ctx.lineups
  const side = (s, name) => s && (
    <div className="flex-1 min-w-0">
      <p className="text-[11px] text-white font-semibold truncate">{name} {s.formation && <span className="text-teal-400 font-mono">({s.formation})</span>}</p>
      {s.starters?.length > 0 && (
        <p className="text-[10px] text-gray-500 leading-tight">{s.starters.join(' · ')}</p>
      )}
      {s.missing?.length > 0 && (
        <p className="text-[10px] text-red-400/90 mt-0.5">🚑 {s.missing.map(m => `${m.name} (${m.reason})`).join(', ')}</p>
      )}
    </div>
  )

  return (
    <div className="card border border-dark-500 space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="font-semibold text-white text-sm">📋 Contexto del partido <span className="text-gray-600 font-normal text-[10px]">— informativo, sin peso en el modelo (aún)</span></p>
        {lu && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${lu.confirmed ? 'bg-green-900/60 text-green-300' : 'bg-yellow-900/60 text-yellow-300'}`}>
            {lu.confirmed ? '✓ Alineaciones CONFIRMADAS' : '~ Alineaciones probables'}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400">
        {ctx.referee?.name && (
          <span>⚖️ Árbitro: <strong className="text-white">{ctx.referee.name}</strong>
            {ctx.referee.yellowPerGame != null && <span className="text-gray-600"> ({ctx.referee.yellowPerGame} amarillas/partido)</span>}
          </span>
        )}
        {ctx.venue?.stadium && <span>🏟️ {ctx.venue.stadium}{ctx.venue.city ? `, ${ctx.venue.city}` : ''}</span>}
        {clima && (
          <span className={clima.lluvia || clima.vientoFuerte ? 'text-orange-300' : ''}>
            {clima.lluvia ? '🌧️' : '🌤️'} {clima.temp != null ? `${Math.round(clima.temp)}°C` : ''}
            {clima.probLluvia != null && ` · lluvia ${clima.probLluvia}%`}
            {clima.vientoKmh != null && ` · viento ${Math.round(clima.vientoKmh)} km/h`}
            {clima.lluvia && ' — cancha mojada: balón resbaloso, más pérdidas por banda'}
            {clima.vientoFuerte && ' — viento fuerte: balones largos imprecisos'}
          </span>
        )}
      </div>

      {lu && (lu.home?.starters?.length > 0 || lu.away?.starters?.length > 0) && (
        <div className="flex gap-4 pt-1 border-t border-dark-700">
          {side(lu.home, ctx.homeTeam)}
          {side(lu.away, ctx.awayTeam)}
        </div>
      )}
    </div>
  )
}
