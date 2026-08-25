// ─── Registro de predicciones del motor ──────────────────────────────────────
// Cada vez que analizas un partido, el snapshot de lo proyectado queda guardado
// 7 días. Después del partido se compara contra las stats reales → calibración.

const KEY = 'motor_predicciones_v1'
const TTL = 7 * 24 * 3600_000

const norm = s => (s ?? '').toLowerCase().trim()

function matchKey(leagueId, nameA, nameB) {
  return `${leagueId}_${[norm(nameA), norm(nameB)].sort().join('__')}`
}

function loadAll() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}')
    // limpiar viejas
    const now = Date.now()
    let dirty = false
    for (const k of Object.keys(raw)) {
      if (now - (raw[k].ts ?? 0) > TTL) { delete raw[k]; dirty = true }
    }
    if (dirty) localStorage.setItem(KEY, JSON.stringify(raw))
    return raw
  } catch { return {} }
}

export function savePrediccion({ leagueId, teamAName, teamBName, expected, picks }) {
  try {
    const all = loadAll()
    all[matchKey(leagueId, teamAName, teamBName)] = {
      ts: Date.now(),
      leagueId,
      home: teamAName,
      away: teamBName,
      expected,
      picks: (picks ?? []).map(p => ({
        label: p.label, marketKey: p.marketKey, dir: p.dir,
        line: p.line, pMod: p.pMod, confidence: p.confidence,
      })),
    }
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {}
}

export function getPrediccion(leagueId, homeName, awayName) {
  const all = loadAll()
  return all[matchKey(leagueId, homeName, awayName)] ?? null
}
