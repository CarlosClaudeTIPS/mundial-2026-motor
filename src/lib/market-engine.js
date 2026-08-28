// ─── MARKET ENGINE — evaluación unificada de mercados (spec maestro §39-43) ──
//
// UNA sola lógica de: implícita (con/sin vig) → edge → EV → umbral dinámico →
// señal BET/NO BET → calidad A/B/C. Todos los módulos (tiros, córners,
// tarjetas, saques, futuros goles/faltas/offsides) delegan aquí — cero
// duplicación de la lógica de decisión.
//
// EDGE vs EV (§41): edge = p_modelo − p_implícita (puntos porcentuales de
// probabilidad). EV = p_modelo × cuota − 1 (retorno esperado por unidad
// apostada). Son cosas distintas: un edge de +5pp a cuota 1.30 renta menos
// que a cuota 2.50.
//
// CALIDAD (§43) — PROVISIONAL hasta calibrar con el live-backtest:
//   A = edge ≥ umbral+4pp y confianza ≥ 70 (fuerte y estable)
//   B = edge ≥ umbral+2pp y confianza ≥ 60
//   C = edge ≥ umbral (apuesta válida pero justa)
//   NO BET = todo lo demás (salida frecuente y correcta)

export const MARKET_ENGINE = {
  EDGE_MIN: 0.04,     // umbral base 4pp
  CONF_MIN: 50,       // confianza mínima para cualquier BET
  CONF_PENAL: 65,     // por debajo → +2pp al umbral
}

// ── Evaluación unificada ─────────────────────────────────────────────────────
// pOverFn: línea → P(Over) del modelo. extras: [{cond, pp, why}] castigos
// específicos del mercado (ej: "antes del 25' las tarjetas señalizan tarde").
export function evaluarMercado({ pOverFn, line, oddsOver, oddsUnder = null, confidence, minuto, minMinuto = 10, extras = [] }) {
  if (!pOverFn || !line || !oddsOver || oddsOver <= 1) return null
  const pOver = pOverFn(line)

  let impOver; let sinVig = false
  if (oddsUnder && oddsUnder > 1) {
    const x = 1 / oddsOver; const y = 1 / oddsUnder
    impOver = x / (x + y); sinVig = true
  } else impOver = 1 / oddsOver

  const edgeOver = pOver - impOver
  const edgeUnder = sinVig ? (1 - pOver) - (1 - impOver) : null

  // Umbral dinámico
  let minEdge = MARKET_ENGINE.EDGE_MIN
  const razonesUmbral = []
  if (confidence < MARKET_ENGINE.CONF_PENAL) { minEdge += 0.02; razonesUmbral.push(`confianza <${MARKET_ENGINE.CONF_PENAL} → +2pp`) }
  if (!sinVig) { minEdge += 0.01; razonesUmbral.push('sin cuota Under (no se quitó el vig) → +1pp') }
  for (const ex of extras) {
    if (ex.cond) { minEdge += ex.pp; razonesUmbral.push(ex.why) }
  }

  // Señal + lado
  let signal = 'NO BET'; let lado = null
  if (confidence >= MARKET_ENGINE.CONF_MIN && minuto >= minMinuto) {
    if (edgeOver >= minEdge) { signal = 'BET'; lado = 'OVER' }
    else if (sinVig && edgeUnder >= minEdge) { signal = 'BET'; lado = 'UNDER' }
  }

  // EV del lado elegido (o del mejor lado disponible, informativo)
  const pLado = lado === 'UNDER' ? 1 - pOver : pOver
  const cuotaLado = lado === 'UNDER' ? oddsUnder : oddsOver
  const ev = signal === 'BET' && cuotaLado ? +(pLado * cuotaLado - 1).toFixed(4) : null
  const edgeLado = lado === 'UNDER' ? edgeUnder : edgeOver

  // Calidad A/B/C — provisional hasta calibrar con datos propios
  let quality = null
  if (signal === 'BET') {
    if (edgeLado >= minEdge + 0.04 && confidence >= 70) quality = 'A'
    else if (edgeLado >= minEdge + 0.02 && confidence >= 60) quality = 'B'
    else quality = 'C'
  }

  return {
    line, oddsOver, oddsUnder,
    pOver: +(pOver * 100).toFixed(1),
    pUnder: +((1 - pOver) * 100).toFixed(1),
    impOver: +(impOver * 100).toFixed(2),
    sinVig,
    edgeOver: +(edgeOver * 100).toFixed(2),
    edgeUnder: sinVig ? +(edgeUnder * 100).toFixed(2) : null,
    minEdge: +(minEdge * 100).toFixed(1),
    razonesUmbral,
    signal, lado,
    ev, evPct: ev != null ? +(ev * 100).toFixed(1) : null,
    quality,
  }
}

// ─── OPPORTUNITY ENGINE (§47) — registro vivo de oportunidades por partido ───
// Cada panel reporta su evaluación actual; el tablero las ordena.
const oportunidades = new Map() // matchId → Map(marketKey → data)

export function reportarOportunidad(matchId, marketKey, data) {
  if (!matchId || !marketKey) return
  if (!oportunidades.has(matchId)) oportunidades.set(matchId, new Map())
  if (data == null) { oportunidades.get(matchId).delete(marketKey); return }
  oportunidades.get(matchId).set(marketKey, { ...data, ts: Date.now() })
}

export function listarOportunidades(matchId) {
  const m = oportunidades.get(matchId)
  if (!m) return []
  const QW = { A: 3, B: 2, C: 1 }
  return [...m.values()]
    .filter(o => Date.now() - o.ts < 5 * 60_000) // evaluaciones frescas (<5 min)
    .sort((a, b) => {
      const qa = QW[a.quality] ?? 0; const qb = QW[b.quality] ?? 0
      if (qa !== qb) return qb - qa
      return (b.edgeLado ?? -99) - (a.edgeLado ?? -99)
    })
}

// ─── CORRELATION ENGINE básico (§37, §46) ────────────────────────────────────
// Grupos de mercados que comparten el mismo motor causal — apostar dos del
// mismo grupo en el mismo partido NO son apuestas independientes.
export const GRUPOS_CORRELACION = [
  { id: 'tempo', motor: 'ritmo/presión del partido', markets: ['corners', 'shots', 'sot', 'cards', 'goals'] },
  { id: 'pausas', motor: 'juego cortado y balón fuera', markets: ['ti', 'gk'] },
]

export function avisosCorrelacion(bets) {
  // bets: [{marketBase, label}] con señal BET
  const avisos = []
  for (const g of GRUPOS_CORRELACION) {
    const enGrupo = bets.filter(b => g.markets.includes(b.marketBase))
    if (enGrupo.length >= 2) {
      avisos.push(`⚠️ ${enGrupo.map(b => b.label).join(' + ')} dependen del mismo motor (${g.motor}) — NO son independientes: si el partido cambia de carácter, caen juntas. Considera la exposición como UNA posición, no ${enGrupo.length}.`)
    }
  }
  return avisos
}

// ─── AUDIT LOG (§57) — cada evaluación con línea/cuota queda registrada ──────
const AUDIT_KEY = 'motor_audit_v1'
const AUDIT_MAX = 300

export function logDecision(entry) {
  // entry: { matchId, match, market, line, odds, baseline, live, pModelo, pImplicita, edge, ev, confidence, signal, quality, minuto }
  if (!entry?.matchId || !entry?.market || !entry?.line) return
  try {
    const all = JSON.parse(localStorage.getItem(AUDIT_KEY)) ?? {}
    // clave por partido+mercado+línea: se actualiza la evaluación, no se duplica
    const k = `${entry.matchId}_${entry.market}_${entry.line}`
    const prev = all[k]
    all[k] = { ...entry, ts: prev?.ts ?? Date.now(), tsUltimo: Date.now() }
    const ids = Object.keys(all)
    if (ids.length > AUDIT_MAX) {
      ids.sort((a, b) => (all[a].tsUltimo ?? 0) - (all[b].tsUltimo ?? 0))
      for (const id of ids.slice(0, ids.length - AUDIT_MAX)) delete all[id]
    }
    localStorage.setItem(AUDIT_KEY, JSON.stringify(all))
  } catch {}
}

export function listDecisiones() {
  try {
    return Object.values(JSON.parse(localStorage.getItem(AUDIT_KEY)) ?? {})
      .sort((a, b) => (b.tsUltimo ?? 0) - (a.tsUltimo ?? 0))
  } catch { return [] }
}
