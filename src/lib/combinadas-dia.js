// ─── COMBINADAS ENTRE PARTIDOS DISTINTOS ─────────────────────────────────────
//
// La casa del usuario NO deja combinar dos mercados del mismo partido, así que
// la combinada real es entre DOS PARTIDOS: ~1.22 × ~1.23 ≈ 1.50.
//
// Ventaja metodológica sobre la combinada intra-partido: picks de partidos
// distintos SÍ son independientes de verdad (no comparten tempo ni marcador),
// así que P(A∩B) = P(A)×P(B) sin supuestos heurísticos.
//
// Cuotas: si hay cuota real (API de odds) se usa; si no, se estima la cuota
// mínima jugable = 1.025 / p (margen típico de casa ~2.5% por pata) y se
// marca como ESTIMADA — el usuario confirma en su casa antes de apostar.

import { pOficial } from './picks'

const MARGEN_CASA = 1.025 // recargo por pata que suele meter la casa

export function cuotaJusta(p) { return p > 0 ? 1 / p : null }
export function cuotaEstimada(p) { return p > 0.05 ? +(MARGEN_CASA / p).toFixed(2) : null }

// pick "anotado": { ...pick, partido: 'A vs B', leagueId, matchKey }
function pDe(pick) {
  // pMod viene en % del panel; pOficial recalcula si hay datos completos
  if (pick.expected != null && pick.line != null && pick.category) {
    try { return pOficial(pick) } catch { /* datos recortados de localStorage */ }
  }
  return pick.pMod != null ? pick.pMod / 100 : null
}

// ─── Sugerir combinadas del día entre partidos DISTINTOS ─────────────────────
// picksPorPartido: [{ partido, leagueId, matchKey, picks: [...] }]
// Devuelve las mejores parejas cuya cuota combinada estimada ≥ target.
export function sugerirCombinadasDia(picksPorPartido, target = 1.50, maxSugerencias = 5) {
  // La mejor pata de cada partido: probabilidad alta manda (patas seguras),
  // pero necesita cuota ≥ ~1.18 para que dos patas lleguen al target.
  const patas = []
  for (const m of picksPorPartido) {
    for (const p of m.picks ?? []) {
      const prob = pDe(p)
      if (prob == null || prob <= 0 || prob >= 1) continue
      const cuota = p.cuota ?? cuotaEstimada(prob)
      if (!cuota || cuota < Math.sqrt(target) * 0.92) continue // pata demasiado corta: ni en pareja llega
      patas.push({
        ...p, prob, cuota, cuotaEsReal: p.cuota != null,
        partido: m.partido, leagueId: m.leagueId, matchKey: m.matchKey,
      })
    }
  }

  const combos = []
  for (let i = 0; i < patas.length; i++) {
    for (let j = i + 1; j < patas.length; j++) {
      const a = patas[i]; const b = patas[j]
      if (a.matchKey === b.matchKey) continue // patas de partidos DISTINTOS
      const cuotaTotal = +(a.cuota * b.cuota).toFixed(2)
      if (cuotaTotal < target) continue
      // Independencia real: partidos distintos no comparten estado
      const pJoint = a.prob * b.prob
      combos.push({
        a, b, cuotaTotal,
        pJoint: +(pJoint * 100).toFixed(1),
        cuotaJusta: +(1 / pJoint).toFixed(2),
        // EV con la cuota estimada (o real si la hay)
        ev: +((pJoint * cuotaTotal - 1) * 100).toFixed(1),
        estimada: !(a.cuotaEsReal && b.cuotaEsReal),
      })
    }
  }

  // Mejores primero: mayor probabilidad conjunta entre las que llegan al target
  combos.sort((x, y) => y.pJoint - x.pJoint)

  // Diversificar: no repetir el mismo partido en todas las sugerencias
  const usados = {}
  const out = []
  for (const c of combos) {
    if (out.length >= maxSugerencias) break
    const nA = usados[c.a.matchKey] ?? 0
    const nB = usados[c.b.matchKey] ?? 0
    if (nA >= 2 || nB >= 2) continue
    out.push(c)
    usados[c.a.matchKey] = nA + 1
    usados[c.b.matchKey] = nB + 1
  }
  return out
}
