// ─── Generador de Picks — Motor Mundial 2026 ─────────────────────────────────
import { poissonOver } from './engine'

const CORRELATION = {
  'shots-sot':     0.85,
  'shots-corners': 0.45,
  'shots-goals':   0.55,
  'shots-cards':   0.30,
  'sot-corners':   0.50,
  'sot-goals':     0.65,
  'corners-goals': 0.35,
  'cards-goals':   0.20,
  'corners-cards': 0.25,
}

function corr(mktA, mktB) {
  const key = [mktA, mktB].sort().join('-')
  return CORRELATION[key] ?? 0.30
}

const MARKET_META = {
  shots_totales:   { label: 'Tiros Totales',     risk: 22, category: 'shots'   },
  sot_totales:     { label: 'SOT Totales',        risk: 28, category: 'sot'     },
  corners_totales: { label: 'Córners Totales',    risk: 22, category: 'corners' },
  goles_totales:   { label: 'Goles Totales',      risk: 38, category: 'goals'   },
  tarjetas_totales:{ label: 'Tarjetas Totales',   risk: 42, category: 'cards'   },
  tiros_local:     { label: 'Tiros Local',        risk: 30, category: 'shots'   },
  tiros_visita:    { label: 'Tiros Visitante',    risk: 30, category: 'shots'   },
  corners_1h:      { label: 'Córners 1H',         risk: 28, category: 'corners' },
  corners_2h:      { label: 'Córners 2H',         risk: 28, category: 'corners' },
  tiros_1h:        { label: 'Tiros Totales 1H',   risk: 30, category: 'shots'   },
}

// ─── Calcular P_modelo y EV para una línea ────────────────────────────────────
function evalLine(expected, line, cuota) {
  if (expected <= 0) return null
  const pOver  = poissonOver(expected, line)
  const pUnder = 1 - pOver
  const margin = (expected - line) / line

  // Decidir dirección
  const dir  = margin >= 0 ? 'OVER' : 'UNDER'
  const pMod = dir === 'OVER' ? pOver : pUnder
  const ev   = cuota ? pMod * cuota - 1 : null

  return { dir, pMod: +(pMod * 100).toFixed(1), ev: ev != null ? +(ev * 100).toFixed(1) : null, margin }
}

// ─── Generar candidatos de picks desde calc ───────────────────────────────────
export function generateCandidates(calc, _odds, teamA, teamB) {
  if (!calc) return []
  const candidates = []

  const markets = [
    { key: 'shots_totales',    expected: calc.t.shots,    lines: [19.5,21.5,23.5,25.5,27.5] },
    { key: 'sot_totales',      expected: calc.t.sot,      lines: [6.5,7.5,8.5,9.5,10.5] },
    { key: 'corners_totales',  expected: calc.t.corners,  lines: [7.5,8.5,9.5,10.5,11.5] },
    { key: 'goles_totales',    expected: calc.t.goals,    lines: [0.5,1.5,2.5,3.5] },
    { key: 'tarjetas_totales', expected: calc.t.cards,    lines: [1.5,2.5,3.5,4.5,5.5] },
    { key: 'tiros_local',      expected: calc.adj.shotsA, lines: [4.5,5.5,6.5,7.5,8.5,9.5] },
    { key: 'tiros_visita',     expected: calc.adj.shotsB, lines: [4.5,5.5,6.5,7.5,8.5,9.5] },
    { key: 'corners_1h',       expected: calc.t.corn1h,   lines: [3.5,4.5,5.5] },
    { key: 'corners_2h',       expected: calc.t.corn2h,   lines: [4.5,5.5,6.5] },
    { key: 'tiros_1h',         expected: calc.t.shots1h,  lines: [5.5,7.5,9.5,11.5] },
  ]

  for (const { key, expected, lines } of markets) {
    const meta = MARKET_META[key] ?? { label: key, risk: 35, category: 'other' }

    for (const line of lines) {
      const margin = Math.abs((expected - line) / line)
      if (margin < 0.03) continue // descarta sin señal clara

      const result = evalLine(expected, line, null)
      if (!result) continue

      let confidence = 50
      if (margin > 0.15) confidence += 20
      else if (margin > 0.08) confidence += 12
      else if (margin > 0.03) confidence += 5
      if (teamA.est || teamB.est) confidence -= 10
      confidence = Math.min(85, Math.max(30, confidence))

      candidates.push({
        marketKey: key,
        label: meta.label,
        category: meta.category,
        expected: +expected.toFixed(2),
        line,
        dir: result.dir,
        pMod: result.pMod,
        ev: null,
        evNum: -999,
        margin: result.margin,
        cuota: null,
        confidence,
        risk: meta.risk,
      })
    }
  }

  // Ordenar por EV desc (si hay cuota), si no por margen abs desc
  candidates.sort((a, b) => b.evNum - a.evNum || Math.abs(b.margin) - Math.abs(a.margin))
  return candidates
}

// ─── Seleccionar top 3 (distintos mercados, baja correlación) ────────────────
export function selectTopPicks(candidates) {
  const picks = []
  const usedCategories = new Set()

  for (const c of candidates) {
    if (picks.length >= 3) break
    if (c.confidence < 55) continue

    // No repetir misma categoría para picks principales
    if (picks.length < 2 && usedCategories.has(c.category)) continue

    // Verificar correlación con picks ya elegidos
    const maxCorr = picks.reduce((max, p) => Math.max(max, corr(p.category, c.category)), 0)
    if (maxCorr > 0.80) continue

    picks.push(c)
    usedCategories.add(c.category)
  }

  return picks
}

// ─── Combinada ───────────────────────────────────────────────────────────────
export function suggestCombo(picks) {
  if (picks.length < 2) return null
  const [p1, p2] = picks
  const c = corr(p1.category, p2.category)
  if (c > 0.70) return null

  const pCombo = +((p1.pMod / 100) * (p2.pMod / 100) * 100).toFixed(1)
  return { p1, p2, pCombo, correlation: +c.toFixed(2) }
}

// ─── Generar explicación textual ─────────────────────────────────────────────
export function generateExplanation(pick, teamA, teamB, ctx, calc, modsA, modsB) {
  const dir    = pick.dir === 'OVER' ? 'por encima' : 'por debajo'
  const pctStr = `${Math.abs(Math.round(pick.margin * 100))}%`

  const summary = `El motor espera ${pick.expected} ${pick.label.toLowerCase()} en este partido. La línea es ${pick.line}. El expected está ${pctStr} ${dir}.`

  const factors = []

  if (pick.category === 'shots' || pick.category === 'sot') {
    factors.push({ icon: '✅', text: `${teamA.name} promedia ${teamA.shots_avg.toFixed(1)} tiros/partido (últimos 15)`, weight: '28%', dir: pick.dir === 'OVER' && calc.adj.shotsA > calc.base?.shotsA ? 'up' : 'neutral' })
    factors.push({ icon: '✅', text: `${teamB.name} promedia ${teamB.shots_avg.toFixed(1)} tiros/partido (últimos 15)`, weight: '28%', dir: 'neutral' })
    if (modsA.shots > 1.05) factors.push({ icon: '✅', text: `${teamA.name} motivado → tiros ×${modsA.shots.toFixed(2)}`, weight: '12%', dir: 'up' })
    if (modsB.shots > 1.05) factors.push({ icon: '✅', text: `${teamB.name} motivado → tiros ×${modsB.shots.toFixed(2)}`, weight: '12%', dir: 'up' })
    if (modsA.shots < 0.95) factors.push({ icon: '⚠️', text: `${teamA.name}: modificador bajo (×${modsA.shots.toFixed(2)})`, weight: '12%', dir: 'down' })
    if (modsB.shots < 0.95) factors.push({ icon: '⚠️', text: `${teamB.name}: modificador bajo (×${modsB.shots.toFixed(2)})`, weight: '12%', dir: 'down' })
    factors.push({ icon: '⚠️', text: `Jornada ${ctx.jornada}: mod tiros ×${getJornadaMod(ctx.jornada, 'shots')}`, weight: '5%', dir: ctx.jornada === 'J1' ? 'down' : ctx.jornada === 'J3' ? 'up' : 'neutral' })
  }

  if (pick.category === 'corners') {
    factors.push({ icon: '✅', text: `${teamA.name} promedia ${teamA.corners_avg.toFixed(1)} córners/partido`, weight: '30%', dir: 'neutral' })
    factors.push({ icon: '✅', text: `${teamB.name} promedia ${teamB.corners_avg.toFixed(1)} córners/partido`, weight: '30%', dir: 'neutral' })
    if (teamA.style === 'bandas' || teamA.style === 'mixto-bandas') factors.push({ icon: '✅', text: `${teamA.name} juega por bandas → genera más córners`, weight: '15%', dir: 'up' })
    if (teamB.style === 'bandas' || teamB.style === 'mixto-bandas') factors.push({ icon: '✅', text: `${teamB.name} juega por bandas → genera más córners`, weight: '15%', dir: 'up' })
    if (modsA.corners > 1.05) factors.push({ icon: '✅', text: `Situación motivacional → córners ${teamA.name} ×${modsA.corners.toFixed(2)}`, weight: '8%', dir: 'up' })
  }

  if (pick.category === 'goals') {
    factors.push({ icon: '✅', text: `${teamA.name} promedia ${teamA.gf_avg.toFixed(2)} goles/partido`, weight: '25%', dir: 'neutral' })
    factors.push({ icon: '✅', text: `${teamB.name} promedia ${teamB.gf_avg.toFixed(2)} goles/partido`, weight: '25%', dir: 'neutral' })
    factors.push({ icon: '⚠️', text: `BTTS ${teamA.name}: ${teamA.btts_pct}% · ${teamB.name}: ${teamB.btts_pct}%`, weight: '15%', dir: 'neutral' })
  }

  if (pick.category === 'cards') {
    factors.push({ icon: '✅', text: `${teamA.name} promedia ${teamA.cards_avg.toFixed(1)} tarjetas/partido`, weight: '25%', dir: 'neutral' })
    factors.push({ icon: '✅', text: `${teamB.name} promedia ${teamB.cards_avg.toFixed(1)} tarjetas/partido`, weight: '25%', dir: 'neutral' })
    if (modsA.cards > 1.10 || modsB.cards > 1.10) factors.push({ icon: '✅', text: 'Alta motivación → más agresividad esperada', weight: '20%', dir: 'up' })
    if (ctx.checks?.rivalidad) factors.push({ icon: '✅', text: 'Clásico regional → tarjetas ×1.20', weight: '12%', dir: 'up' })
  }

  const pushUp   = factors.filter(f => f.dir === 'up')
  const pushDown = factors.filter(f => f.dir === 'down')
  const neutral  = factors.filter(f => f.dir === 'neutral')

  const keyVars = [
    { label: `${teamA.name} ${pick.category === 'shots' ? 'tiros' : pick.category === 'corners' ? 'córners' : 'stats'}/P`, value: getStat(teamA, pick.category), weight: '28%' },
    { label: `${teamB.name} ${pick.category === 'shots' ? 'tiros' : pick.category === 'corners' ? 'córners' : 'stats'}/P`, value: getStat(teamB, pick.category), weight: '28%' },
    { label: `Motivación ${teamA.name}`, value: `×${modsA[pick.category] ?? modsA.shots}`, weight: '12%' },
    { label: `Mod. jornada ${ctx.jornada}`, value: `×${getJornadaMod(ctx.jornada, pick.category)}`, weight: '5%' },
    { label: 'Expected final', value: pick.expected, weight: '—' },
  ]

  const risks = []
  if (teamA.est || teamB.est) risks.push('Datos estimados en uno o ambos equipos (−10 Confidence)')
  if (ctx.jornada === 'J1') risks.push('J1: equipos pueden ser más cautos de lo normal')
  if (!pick.cuota) risks.push('Cuota no disponible — EV no calculado')
  if (pick.confidence < 65) risks.push('Confidence bajo 65 — señal moderada')

  return { summary, pushUp, pushDown, neutral, keyVars, risks }
}

function getStat(team, category) {
  if (category === 'shots' || category === 'sot') return team.shots_avg.toFixed(1)
  if (category === 'corners') return team.corners_avg.toFixed(1)
  if (category === 'goals') return team.gf_avg.toFixed(2)
  if (category === 'cards') return team.cards_avg.toFixed(1)
  return '—'
}

function getJornadaMod(jornada, category) {
  if (jornada === 'J1') return category === 'cards' ? '×0.90' : '×0.95'
  if (jornada === 'J3') return category === 'cards' ? '×1.15' : '×1.05'
  return '×1.00'
}
