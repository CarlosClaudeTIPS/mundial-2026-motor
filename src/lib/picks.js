// ─── Generador de Picks — Motor de Apuestas Ligas ────────────────────────────
import { poissonOver } from './engine'

// ─── Líneas realistas ────────────────────────────────────────────────────────
// Las casas ponen las líneas CERCA del expected del mercado, no en 4.5 tiros.
// Genera 5 líneas .5 centradas en el expected con el paso típico del mercado.
export function linesAround(expected, step = 1, count = 5) {
  if (expected == null || expected <= 0) return []
  // Ancla en la media línea (X.5) más cercana al expected — como las casas
  const c = Math.floor(expected) + 0.5
  const half = Math.floor(count / 2)
  const out = []
  for (let i = -half; i <= half; i++) {
    const l = +(c + i * step).toFixed(2)
    if (l > 0) out.push(l)
  }
  return out
}

// Margen creíble: las casas no dejan value de +70% — si el margen es absurdo,
// la línea no existiría. Solo recomendamos entre 4% y 15% de edge.
export const MARGIN_MIN = 0.04
export const MARGIN_MAX = 0.15

// Mejor línea recomendable dentro del rango creíble (o null).
// Usa las MISMAS 5 líneas que se muestran en la tarjeta.
export function bestRealisticLine(expected, step = 1) {
  let best = null
  for (const line of linesAround(expected, step, 5)) {
    const margin = (expected - line) / line
    const abs = Math.abs(margin)
    if (abs < MARGIN_MIN || abs > MARGIN_MAX) continue
    if (!best || abs > Math.abs(best.margin)) {
      best = { line, dir: margin > 0 ? 'OVER' : 'UNDER', margin, pct: Math.round(margin * 100) }
    }
  }
  return best
}

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
  // Saques (spec v2 §9): TI-córners 0.60 → límite, no combinar
  'gk-shots':      0.40,
  'gk-ti':         0.35,
  'gk-corners':    0.30,
  'gk-goals':      0.30,
  'gk-cards':      0.20,
  'corners-ti':    0.60,
  'shots-ti':      0.35,
  'cards-ti':      0.25,
  'goals-ti':      0.20,
  'sot-ti':        0.35,
  'gk-sot':        0.40,
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
  gk_totales:      { label: 'Saques Portería Tot.', risk: 28, category: 'gk'    },
  gk_local:        { label: 'GK Local',           risk: 30, category: 'gk'      },
  gk_visita:       { label: 'GK Visitante',       risk: 30, category: 'gk'      },
  ti_totales:      { label: 'Throw-ins Totales',  risk: 30, category: 'ti'      },
  // ── Mercados por equipo ──
  corners_local:   { label: 'Córners Local',      risk: 28, category: 'corners' },
  corners_visita:  { label: 'Córners Visitante',  risk: 28, category: 'corners' },
  sot_local:       { label: 'SOT Local',          risk: 32, category: 'sot'     },
  sot_visita:      { label: 'SOT Visitante',      risk: 32, category: 'sot'     },
  tarjetas_local:  { label: 'Tarjetas Local',     risk: 45, category: 'cards'   },
  tarjetas_visita: { label: 'Tarjetas Visitante', risk: 45, category: 'cards'   },
  ti_local:        { label: 'Throw-ins Local',    risk: 32, category: 'ti'      },
  ti_visita:       { label: 'Throw-ins Visitante', risk: 32, category: 'ti'     },
  goles_local:     { label: 'Goles Local',        risk: 42, category: 'goals'   },
  goles_visita:    { label: 'Goles Visitante',    risk: 42, category: 'goals'   },
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

  // Líneas dinámicas alrededor del expected con el paso típico de cada mercado
  const markets = [
    { key: 'shots_totales',    expected: calc.t.shots,    step: 2 },
    { key: 'sot_totales',      expected: calc.t.sot,      step: 1 },
    { key: 'corners_totales',  expected: calc.t.corners,  step: 1 },
    { key: 'goles_totales',    expected: calc.t.goals,    step: 0.5 },
    { key: 'tarjetas_totales', expected: calc.t.cards,    step: 1 },
    { key: 'tiros_local',      expected: calc.adj.shotsA, step: 1 },
    { key: 'tiros_visita',     expected: calc.adj.shotsB, step: 1 },
    { key: 'corners_local',    expected: calc.adj.cornA,  step: 1 },
    { key: 'corners_visita',   expected: calc.adj.cornB,  step: 1 },
    { key: 'sot_local',        expected: calc.adj.sotA,   step: 1 },
    { key: 'sot_visita',       expected: calc.adj.sotB,   step: 1 },
    { key: 'tarjetas_local',   expected: calc.adj.cardsA, step: 0.5 },
    { key: 'tarjetas_visita',  expected: calc.adj.cardsB, step: 0.5 },
    { key: 'ti_local',         expected: calc.adj.tiA,    step: 1 },
    { key: 'ti_visita',        expected: calc.adj.tiB,    step: 1 },
    { key: 'goles_local',      expected: calc.adj.goalsA, step: 0.5 },
    { key: 'goles_visita',     expected: calc.adj.goalsB, step: 0.5 },
    { key: 'corners_1h',       expected: calc.t.corn1h,   step: 1 },
    { key: 'corners_2h',       expected: calc.t.corn2h,   step: 1 },
    { key: 'tiros_1h',         expected: calc.t.shots1h,  step: 1 },
    { key: 'gk_totales',       expected: calc.t.gk,       step: 1 },
    { key: 'gk_local',         expected: calc.adj.gkA,    step: 1 },
    { key: 'gk_visita',        expected: calc.adj.gkB,    step: 1 },
    { key: 'ti_totales',       expected: calc.t.ti,       step: 2 },
  ]

  for (const { key, expected, step } of markets) {
    const meta = MARKET_META[key] ?? { label: key, risk: 35, category: 'other' }

    for (const line of linesAround(expected, step, 7)) {
      const margin = Math.abs((expected - line) / line)
      // Solo margen creíble: ni ruido (<4%) ni líneas que ninguna casa ofrecería (>22%)
      if (margin < MARGIN_MIN || margin > MARGIN_MAX) continue

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

// ─── Seleccionar top N (distintos mercados, baja correlación) ────────────────
export function selectTopPicks(candidates, max = 3) {
  const picks = []
  const usedCategories = new Set()

  for (const c of candidates) {
    if (picks.length >= max) break
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
    factors.push({ icon: '⚠️', text: `Fase ${ctx.jornada}: mod tiros ${getJornadaMod(ctx.jornada, 'shots')}`, weight: '5%', dir: ctx.jornada === 'inicio' || ctx.jornada === 'ko' ? 'down' : ctx.jornada === 'final' ? 'up' : 'neutral' })
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

  if (pick.category === 'gk') {
    factors.push({ icon: '✅', text: `${teamA.name} promedia ${teamA.goalkicks_avg.toFixed(1)} saques de portería/partido`, weight: '30%', dir: 'neutral' })
    factors.push({ icon: '✅', text: `${teamB.name} promedia ${teamB.goalkicks_avg.toFixed(1)} saques de portería/partido`, weight: '30%', dir: 'neutral' })
    const ppgDiff = Math.abs(teamA.ppg - teamB.ppg)
    if (ppgDiff > 0.4) {
      const debil = teamA.ppg < teamB.ppg ? teamA.name : teamB.name
      factors.push({ icon: '✅', text: `${debil} es claramente inferior → defenderá más → más GK (×${ppgDiff > 0.8 ? '1.28' : '1.10'})`, weight: '20%', dir: 'up' })
    }
    factors.push({ icon: '💡', text: 'Mercado mal calibrado por las casas — pocos apostadores lo estudian', weight: '—', dir: 'up' })
  }

  if (pick.category === 'ti') {
    factors.push({ icon: '✅', text: `${teamA.name} promedia ${teamA.throwins_avg.toFixed(1)} saques de banda/partido`, weight: '30%', dir: 'neutral' })
    factors.push({ icon: '✅', text: `${teamB.name} promedia ${teamB.throwins_avg.toFixed(1)} saques de banda/partido`, weight: '30%', dir: 'neutral' })
    if (teamA.style === 'bandas' || teamA.style === 'mixto-bandas') factors.push({ icon: '✅', text: `${teamA.name} ataca por bandas → más juego lateral → más TI`, weight: '15%', dir: 'up' })
    if (teamB.style === 'bandas' || teamB.style === 'mixto-bandas') factors.push({ icon: '✅', text: `${teamB.name} ataca por bandas → más juego lateral → más TI`, weight: '15%', dir: 'up' })
    if (ctx.checks?.lluvia) factors.push({ icon: '🌧️', text: 'Lluvia intensa → balón resbaladizo → TI ×1.15', weight: '10%', dir: 'up' })
    if (ctx.checks?.rivalidad) factors.push({ icon: '⚔️', text: 'Derby físico → más duelos → TI ×1.10', weight: '10%', dir: 'up' })
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
  if (teamA.est || teamB.est) risks.push('Muestra de partidos pobre en uno o ambos equipos (−10 Confidence)')
  if (ctx.jornada === 'inicio') risks.push('Inicio de temporada: equipos irregulares, más varianza')
  if (ctx.jornada === 'ko') risks.push('Eliminatoria KO: partidos más cerrados de lo que dicen las stats')
  if (pick.category === 'gk' || pick.category === 'ti') risks.push('GK/TI estimados (API no da el dato real) — verificar en Sofascore')
  if (!pick.cuota) risks.push('Cuota no disponible — EV no calculado')
  if (pick.confidence < 65) risks.push('Confidence bajo 65 — señal moderada')

  return { summary, pushUp, pushDown, neutral, keyVars, risks }
}

function getStat(team, category) {
  if (category === 'shots' || category === 'sot') return team.shots_avg.toFixed(1)
  if (category === 'corners') return team.corners_avg.toFixed(1)
  if (category === 'goals') return team.gf_avg.toFixed(2)
  if (category === 'cards') return team.cards_avg.toFixed(1)
  if (category === 'gk') return team.goalkicks_avg.toFixed(1)
  if (category === 'ti') return team.throwins_avg.toFixed(1)
  return '—'
}

function getJornadaMod(fase, category) {
  if (fase === 'inicio') return category === 'cards' ? '×0.92' : '×0.94'
  if (fase === 'final')  return category === 'cards' ? '×1.12' : '×1.05'
  if (fase === 'ko')     return category === 'cards' ? '×1.10' : '×0.92'
  return '×1.00'
}
