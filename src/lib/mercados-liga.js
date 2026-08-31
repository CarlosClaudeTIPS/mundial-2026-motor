// ─── MERCADOS DISPONIBLES POR LIGA ───────────────────────────────────────────
//
// Define QUÉ mercados tiene sentido analizar en cada competición, según lo que
// la CASA DE APUESTAS ofrece realmente. No es una limitación de datos:
// verificado (2026-08-29) que Live-Score da tiros/SOT/córners/banda/faltas en
// todas las ligas principales y Sofascore da saques de portería en el 100% de
// la muestra. Lo que varía es el MERCADO ofrecido por el bookmaker.
//
// Configuración inicial dada por el usuario (tipster) según su casa. Es
// EDITABLE desde la app: él es quien ve la oferta real y las casas cambian.
//
// Filtrar aquí evita perder tiempo analizando mercados que no se pueden jugar
// y reduce llamadas a las fuentes.

const KEY = 'motor_mercados_liga_v1'

// Mercados cuantitativos del motor
export const MERCADOS = ['shots', 'sot', 'corners', 'ti', 'gk', 'cards']

export const MERCADO_LABEL = {
  shots: 'Tiros', sot: 'Tiros al arco', corners: 'Córners',
  ti: 'Saques de banda', gk: 'Saques de portería', cards: 'Tarjetas',
}

// Perfiles de oferta
export const PERFILES = {
  completo: { label: 'Completo', mercados: ['shots', 'sot', 'corners', 'ti', 'gk', 'cards'] },
  tiros:    { label: 'Tiros + córners', mercados: ['shots', 'sot', 'corners', 'cards'] },
  sot:      { label: 'Solo tiros al arco + córners', mercados: ['sot', 'corners'] },
  basico:   { label: 'Básico (córners)', mercados: ['corners'] },
}

// Configuración por defecto (la que indicó el usuario según su casa).
// Clave = id interno de liga (leagues.js)
export const PERFIL_POR_LIGA_DEFAULT = {
  // Completo: saques de banda Y portería disponibles
  140: 'completo',  // España — LaLiga
  39:  'completo',  // Inglaterra — Premier League
  135: 'completo',  // Italia — Serie A
  235: 'completo',  // Rusia — Premier League
  309: 'completo',  // Rusia — Football National League
  311: 'completo',  // Rusia — Copa

  // Tiros + córners (sin saques)
  78:  'tiros',     // Alemania — Bundesliga
  71:  'tiros',     // Brasil — Serie A
  256: 'tiros',     // Brasil — Copa do Brasil

  // Solo tiros al arco + córners (sin tiros totales ni saques)
  61:  'sot',       // Francia — Ligue 1
}

// Todo lo no listado usa 'basico' — así las ligas secundarias no gastan
// llamadas ni generan picks de mercados que no se pueden apostar.
export const PERFIL_FALLBACK = 'basico'

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? {} } catch { return {} }
}

export function perfilDeLiga(leagueId) {
  const custom = load()
  return custom[leagueId] ?? PERFIL_POR_LIGA_DEFAULT[leagueId] ?? PERFIL_FALLBACK
}

export function mercadosDeLiga(leagueId) {
  const p = PERFILES[perfilDeLiga(leagueId)] ?? PERFILES[PERFIL_FALLBACK]
  return p.mercados
}

export function tieneMercado(leagueId, mercado) {
  // Sin liga identificada (partidos de competiciones no configuradas): básico
  if (leagueId == null) return PERFILES[PERFIL_FALLBACK].mercados.includes(mercado)
  return mercadosDeLiga(leagueId).includes(mercado)
}

export function setPerfilLiga(leagueId, perfil) {
  if (!PERFILES[perfil]) return false
  try {
    const all = load()
    all[leagueId] = perfil
    localStorage.setItem(KEY, JSON.stringify(all))
    return true
  } catch { return false }
}

export function resetPerfiles() {
  try { localStorage.removeItem(KEY); return true } catch { return false }
}

// Resumen para mostrar en la UI
export function resumenLiga(leagueId) {
  const perfil = perfilDeLiga(leagueId)
  const m = mercadosDeLiga(leagueId)
  return {
    perfil,
    label: PERFILES[perfil]?.label ?? 'Básico',
    mercados: m,
    etiquetas: m.map(x => MERCADO_LABEL[x]),
    personalizado: Object.prototype.hasOwnProperty.call(load(), leagueId),
  }
}
