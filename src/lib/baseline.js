// ─── PREMATCH BASELINE — la predicción prepartido, guardada y congelada ──────
//
// Regla (spec §4, §15): el prior prepartido de cada mercado se persiste como
// PREMATCH BASELINE la primera vez que se calcula, y NO se pisa después.
// Nota anti-leakage: el prior SOLO usa historial de partidos terminados
// (buildTeamStats), así que aunque se calcule con el partido ya empezado,
// sigue siendo información 100% prepartido — por eso es válido congelarlo
// en cualquier momento.
//
// Con el baseline congelado la app puede:
//   - mostrar "PREMATCH: X → LIVE ahora: Y" y explicar el cambio (§21-22)
//   - calcular EDGE PREMATCH separado del EDGE LIVE (§16-18)
//   - medir error prematch vs error live cuando el partido resuelve (§14)

import { nbOver } from './throwins'

const KEY = 'motor_baselines_v1'
const MAX = 120 // baselines guardados (4 mercados × ~30 partidos)

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? {} } catch { return {} }
}
function save(all) {
  const ids = Object.keys(all)
  if (ids.length > MAX) {
    ids.sort((a, b) => (all[a].ts ?? 0) - (all[b].ts ?? 0))
    for (const id of ids.slice(0, ids.length - MAX)) delete all[id]
  }
  try { localStorage.setItem(KEY, JSON.stringify(all)) } catch {}
}

// Congela (si no existe ya) y devuelve el baseline de un mercado en un partido.
// expected: media prepartido · sd: desviación prepartido (del prior empírico).
// La distribución prematch es NB sobre el TOTAL del partido con
// phi efectivo = var/media (acotado ≥1.05 para no sub-dispersar).
export function ensureBaseline(matchId, market, { expected, sd }) {
  if (!matchId || expected == null) return null
  const all = load()
  const k = `${matchId}_${market}`
  if (!all[k]) {
    all[k] = { expected: +expected.toFixed(1), sd: sd != null ? +sd.toFixed(1) : +(expected * 0.22).toFixed(1), ts: Date.now() }
    save(all)
  }
  return withDist(all[k])
}

export function getBaseline(matchId, market) {
  const b = load()[`${matchId}_${market}`]
  return b ? withDist(b) : null
}

function withDist(b) {
  const phiEff = Math.max(1.05, (b.sd * b.sd) / Math.max(0.5, b.expected))
  return {
    ...b,
    phiEff: +phiEff.toFixed(2),
    // P(total del partido > línea) según SOLO información prepartido
    pOver: line => nbOver(b.expected, line, phiEff),
  }
}
