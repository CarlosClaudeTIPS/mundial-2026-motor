// Genera últimos 5 partidos sintéticos basados en promedios del equipo
// Varianza determinística (seed por nombre) → datos consistentes entre renders

function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

function jitter(base, pct, seed) {
  const factor = 1 + ((seed % 200) / 100 - 1) * pct
  return Math.max(0, Math.round(base * factor * 10) / 10)
}

function intJitter(base, range, seed) {
  return Math.max(0, Math.round(base) + ((seed % (range * 2 + 1)) - range))
}

const OPPONENTS = ['vs URU', 'vs ARG', 'vs BRA', 'vs COL', 'vs MEX', 'vs USA', 'vs FRA', 'vs ALE', 'vs ENG', 'vs POR']

export function generateLast5(team) {
  const matches = []
  const base = hash(team.name)
  for (let i = 0; i < 5; i++) {
    const s = hash(team.name + i)
    const goalsFor  = intJitter(team.gf_avg, 1, s)
    const goalsAgainst = intJitter(team.ga_avg, 1, hash(team.name + i + 'ga'))
    const result = goalsFor > goalsAgainst ? 'W' : goalsFor < goalsAgainst ? 'L' : 'D'

    matches.push({
      rival:   OPPONENTS[(base + i * 3) % OPPONENTS.length],
      result,
      gf: goalsFor,
      ga: goalsAgainst,
      shots:   intJitter(team.shots_avg,   3, hash(team.name + i + 'sh')),
      sot:     intJitter(team.sot_avg,     2, hash(team.name + i + 'sot')),
      corners: intJitter(team.corners_avg, 2, hash(team.name + i + 'cor')),
      cards:   intJitter(team.cards_avg,   1, hash(team.name + i + 'crd')),
      fouls:   intJitter(team.fouls_avg,   3, hash(team.name + i + 'fls')),
      passes:  intJitter(team.passes_avg,  30, hash(team.name + i + 'pas')),
    })
  }
  return matches
}
