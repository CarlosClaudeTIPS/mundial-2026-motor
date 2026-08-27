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
  gk_totales:      { label: 'Saques Portería Totales', risk: 28, category: 'gk' },
  gk_local:        { label: 'Saques Portería Local',   risk: 30, category: 'gk' },
  gk_visita:       { label: 'Saques Portería Visitante', risk: 30, category: 'gk' },
  ti_totales:      { label: 'Saques Banda Totales', risk: 30, category: 'ti'    },
  // ── Mercados por equipo ──
  corners_local:   { label: 'Córners Local',      risk: 28, category: 'corners' },
  corners_visita:  { label: 'Córners Visitante',  risk: 28, category: 'corners' },
  sot_local:       { label: 'SOT Local',          risk: 32, category: 'sot'     },
  sot_visita:      { label: 'SOT Visitante',      risk: 32, category: 'sot'     },
  tarjetas_local:  { label: 'Tarjetas Local',     risk: 45, category: 'cards'   },
  tarjetas_visita: { label: 'Tarjetas Visitante', risk: 45, category: 'cards'   },
  ti_local:        { label: 'Saques Banda Local',    risk: 32, category: 'ti'   },
  ti_visita:       { label: 'Saques Banda Visitante', risk: 32, category: 'ti'  },
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
  const run = (minConf) => {
    const picks = []
    const usedCategories = new Set()
    for (const c of candidates) {
      if (picks.length >= max) break
      if (c.confidence < minConf) continue

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

  // Umbral estricto; si nada pasa (equipos con muestra pobre pierden -10 de
  // confianza — típico en fases previas, copas y recién ascendidos), relajar:
  // mejor mostrar los mejores picks con su confianza real que no mostrar nada.
  let picks = run(55)
  if (!picks.length) picks = run(45)
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

  // ── Mercado por equipo vs total, y dirección del pick ──
  // Cada razón debe hablar DEL EQUIPO del pick y APOYAR su dirección; lo que
  // vaya en contra se muestra como advertencia, nunca como argumento a favor.
  const isLocal  = /_local$/.test(pick.marketKey)
  const isVisita = /_visita$/.test(pick.marketKey)
  const target   = isLocal ? teamA : isVisita ? teamB : null
  const rival    = isLocal ? teamB : isVisita ? teamA : null
  const over     = pick.dir === 'OVER'
  const cat      = pick.category

  const statName = { shots: 'tiros', sot: 'tiros a puerta', corners: 'córners', goals: 'goles', cards: 'tarjetas', gk: 'saques de portería', ti: 'saques de banda' }[cat] ?? cat
  const avgOf = t => parseFloat(getStat(t, cat))
  const againstOf = t => cat === 'shots' ? t.shots_against_avg
    : cat === 'corners' ? t.corners_against_avg
    : cat === 'goals' ? t.ga_avg
    : cat === 'ti' ? t.ti_against_avg
    : cat === 'gk' ? t.gk_against_avg
    : null // sot: no hay dato de SOT concedidos — no inventar

  const factors = []
  // supports: el dato apoya la dirección del pick → 'up'; si la contradice → 'down'
  const add = (value, textUp, textDown) => {
    if (value == null || isNaN(value)) return
    const apoya = (value > pick.line) === over || Math.abs(value - pick.line) < 0.01
    factors.push(apoya
      ? { icon: '✅', text: textUp, dir: 'up' }
      : { icon: '⚠️', text: textDown, dir: 'down' })
  }

  if (target) {
    // ── Pick de UN equipo: hablar SOLO de ese equipo y su rival directo ──
    const avg = avgOf(target)
    add(avg,
      `${target.name} promedia ${avg} ${statName}/partido — ${over ? 'por encima' : 'por debajo'} de la línea ${pick.line}`,
      `OJO: ${target.name} promedia ${avg} ${statName}/partido, que contradice el ${pick.dir} ${pick.line} — el motor lo ajustó por el rival y el contexto`)
    const ag = rival ? againstOf(rival) : null
    if (ag != null) add(ag,
      `${rival.name} concede ${ag.toFixed(1)} ${statName}/partido a sus rivales — apoya el ${pick.dir}`,
      `OJO: ${rival.name} concede ${ag.toFixed(1)} ${statName}/partido — factor en contra del ${pick.dir}`)
    // Localía del equipo del pick
    const split = isLocal ? target.split?.home : target.split?.away
    const splitVal = split ? (cat === 'shots' || cat === 'sot' ? split.shots : cat === 'corners' ? split.corners : cat === 'goals' ? split.gf : cat === 'cards' ? split.cards : null) : null
    if (splitVal != null) add(splitVal,
      `${isLocal ? 'En casa' : 'De visita'} promedia ${splitVal} (${split.n} PJ) — apoya el ${pick.dir}`,
      `OJO: ${isLocal ? 'en casa' : 'de visita'} promedia ${splitVal} (${split.n} PJ) — no acompaña el ${pick.dir}`)
    // Estilo bandas del equipo del pick (solo córners/TI)
    if ((cat === 'corners' || cat === 'ti') && (target.style === 'bandas' || target.style === 'mixto-bandas')) {
      factors.push(over
        ? { icon: '✅', text: `${target.name} ataca por bandas → genera más ${statName}`, dir: 'up' }
        : { icon: '⚠️', text: `OJO: ${target.name} ataca por bandas (empuja los ${statName}) — factor en contra del UNDER; el motor igual proyecta ${pick.expected} por su volumen y el rival`, dir: 'down' })
    }
    // Modificadores del equipo del pick
    const modsT = isLocal ? modsA : modsB
    const modKey = cat === 'sot' ? 'sot' : cat === 'ti' || cat === 'gk' ? null : cat
    const m = modKey ? modsT[modKey] : null
    if (m != null && Math.abs(m - 1) > 0.05) {
      const sube = m > 1
      factors.push((sube === over)
        ? { icon: '✅', text: `Contexto de ${target.name}: ${statName} ×${m.toFixed(2)} — empuja hacia el ${pick.dir}`, dir: 'up' }
        : { icon: '⚠️', text: `Contexto de ${target.name}: ${statName} ×${m.toFixed(2)} — va en contra del ${pick.dir}`, dir: 'down' })
    }
  } else {
    // ── Pick de TOTALES: la suma de ambos ──
    const sumAvg = +(avgOf(teamA) + avgOf(teamB)).toFixed(1)
    add(sumAvg,
      `Entre los dos suman ${sumAvg} ${statName}/partido de promedio — ${over ? 'por encima' : 'por debajo'} de la línea ${pick.line}`,
      `OJO: entre los dos suman ${sumAvg} ${statName}/partido, que contradice el ${pick.dir} ${pick.line} — el ajuste viene del contexto (defensas, ritmo de liga, copa)`)
    if (cat === 'corners' || cat === 'ti') {
      for (const t of [teamA, teamB]) {
        if (t.style === 'bandas' || t.style === 'mixto-bandas') {
          factors.push(over
            ? { icon: '✅', text: `${t.name} ataca por bandas → más ${statName}`, dir: 'up' }
            : { icon: '⚠️', text: `OJO: ${t.name} ataca por bandas (empuja los ${statName}) — factor en contra del UNDER`, dir: 'down' })
        }
      }
    }
    if (cat === 'goals') {
      factors.push({ icon: 'ℹ️', text: `BTTS: ${teamA.name} ${teamA.btts_pct}% · ${teamB.name} ${teamB.btts_pct}%`, dir: 'neutral' })
    }
    if (cat === 'gk') {
      const ppgDiff = Math.abs(teamA.ppg - teamB.ppg)
      if (ppgDiff > 0.4) {
        const debil = teamA.ppg < teamB.ppg ? teamA.name : teamB.name
        factors.push(over
          ? { icon: '✅', text: `${debil} es claramente inferior → defenderá más → más GK`, dir: 'up' }
          : { icon: '⚠️', text: `OJO: ${debil} es muy inferior y defenderá mucho (más GK) — factor en contra del UNDER`, dir: 'down' })
      }
    }
    if (cat === 'cards' && ctx.checks?.rivalidad) {
      factors.push(over
        ? { icon: '✅', text: 'Clásico/rivalidad → tarjetas ×1.20', dir: 'up' }
        : { icon: '⚠️', text: 'OJO: es un clásico (tarjetas ×1.20) — factor en contra del UNDER', dir: 'down' })
    }
    if (cat === 'ti' && ctx.checks?.lluvia) {
      factors.push(over
        ? { icon: '🌧️', text: 'Lluvia → balón resbaladizo → más saques de banda', dir: 'up' }
        : { icon: '⚠️', text: 'OJO: lluvia prevista (sube los saques de banda) — en contra del UNDER', dir: 'down' })
    }
  }

  // Eliminación directa apoya los UNDER de volumen y los OVER de tarjetas
  if (ctx.checks?.eliminacion && ['shots', 'sot', 'goals', 'corners', 'cards'].includes(cat)) {
    const favoreceUnder = cat !== 'cards'
    const apoya = favoreceUnder ? !over : over
    factors.push(apoya
      ? { icon: '⚔️', text: `Eliminación directa: partidos más cerrados → apoya el ${pick.dir}`, dir: 'up' }
      : { icon: '⚠️', text: `OJO: en eliminación directa ${favoreceUnder ? 'suele haber MENOS volumen' : 'suele haber MÁS tarjetas'} — factor en contra del ${pick.dir}`, dir: 'down' })
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

  // Los factores en contra van de primeros en los riesgos — el usuario debe verlos
  const risks = pushDown.map(f => f.text.replace(/^OJO: /, ''))
  if (teamA.est || teamB.est) risks.push('Muestra de partidos pobre en uno o ambos equipos (−10 Confidence)')
  if (ctx.jornada === 'inicio') risks.push('Inicio de temporada: equipos irregulares, más varianza')
  if (ctx.jornada === 'ko') risks.push('Eliminatoria KO: partidos más cerrados de lo que dicen las stats')
  if (pick.category === 'gk' || pick.category === 'ti') risks.push('GK/TI estimados (API no da el dato real) — verificar en Sofascore')
  if (!pick.cuota) risks.push('Cuota no disponible — EV no calculado')
  if (pick.confidence < 65) risks.push('Confidence bajo 65 — señal moderada')

  return { summary, pushUp, pushDown, neutral, keyVars, risks }
}

function getStat(team, category) {
  if (category === 'sot') return team.sot_avg.toFixed(1)
  if (category === 'shots') return team.shots_avg.toFixed(1)
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
