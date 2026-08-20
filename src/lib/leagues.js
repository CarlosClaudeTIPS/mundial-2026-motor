// ─── Catálogo de competiciones — spec v2 §2 ──────────────────────────────────
// K_base por liga calibra córners y throw-ins según el ritmo de cada competición.
// IDs de API-Football v3 (spec §3).

export const LEAGUES = [
  { id: 39,  name: 'Premier League',    country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', kCorners: 1.08, kTI: 1.12, sportKey: 'soccer_epl',                  type: 'league' },
  { id: 140, name: 'La Liga',           country: 'España',     flag: '🇪🇸', kCorners: 0.95, kTI: 0.95, sportKey: 'soccer_spain_la_liga',          type: 'league' },
  { id: 78,  name: 'Bundesliga',        country: 'Alemania',   flag: '🇩🇪', kCorners: 1.10, kTI: 1.08, sportKey: 'soccer_germany_bundesliga',     type: 'league' },
  { id: 135, name: 'Serie A',           country: 'Italia',     flag: '🇮🇹', kCorners: 0.92, kTI: 0.92, sportKey: 'soccer_italy_serie_a',          type: 'league' },
  { id: 61,  name: 'Ligue 1',           country: 'Francia',    flag: '🇫🇷', kCorners: 1.00, kTI: 1.00, sportKey: 'soccer_france_ligue_one',       type: 'league' },
  { id: 94,  name: 'Liga Portugal',     country: 'Portugal',   flag: '🇵🇹', kCorners: 1.02, kTI: 0.98, sportKey: 'soccer_portugal_primeira_liga', type: 'league' },
  { id: 88,  name: 'Eredivisie',        country: 'Holanda',    flag: '🇳🇱', kCorners: 1.12, kTI: 1.05, sportKey: null,                            type: 'league' },
  { id: 253, name: 'MLS',               country: 'USA',        flag: '🇺🇸', kCorners: 1.05, kTI: 1.06, sportKey: 'soccer_usa_mls',                type: 'league' },
  { id: 262, name: 'Liga MX',           country: 'México',     flag: '🇲🇽', kCorners: 0.98, kTI: 1.02, sportKey: 'soccer_mexico_ligamx',          type: 'league' },
  { id: 239, name: 'Liga BetPlay',      country: 'Colombia',   flag: '🇨🇴', kCorners: 1.00, kTI: 1.04, sportKey: null,                            type: 'league' },
  { id: 2,   name: 'Champions League',  country: 'Europa',     flag: '🏆', kCorners: 0.90, kTI: 0.90, sportKey: 'soccer_uefa_champs_league',     type: 'cup' },
  { id: 3,   name: 'Europa League',     country: 'Europa',     flag: '🥈', kCorners: 0.93, kTI: 0.94, sportKey: 'soccer_uefa_europa_league',     type: 'cup' },
  { id: 848, name: 'Conference League', country: 'Europa',     flag: '🥉', kCorners: 1.00, kTI: 0.97, sportKey: null,                            type: 'cup' },
]

export const DEFAULT_LEAGUE_ID = 39

export function getLeague(id) {
  return LEAGUES.find(l => l.id === Number(id)) ?? LEAGUES[0]
}

// Temporada actual por liga.
// Europeas 2026-27 → season=2026 en API-Football. MLS/Liga MX/BetPlay: año calendario.
export function currentSeason() {
  const now = new Date()
  const y = now.getFullYear()
  // Todas coinciden en 2026 durante ago-dic 2026; en ene-jul el año europeo es y-1
  return now.getMonth() >= 7 ? y : y - 1
}

// Promedios de liga para normalizar la defensa rival (goles concedidos/partido)
// y estimar mercados sin dato directo (GK/TI no vienen en API-Football).
export const LEAGUE_BASELINES = {
  39:  { gaAvg: 1.42, shotsAvg: 13.0, cornersAvg: 5.3, cardsAvg: 2.2, gkAvg: 8.5,  tiAvg: 21.5 },
  140: { gaAvg: 1.30, shotsAvg: 12.2, cornersAvg: 4.9, cardsAvg: 2.6, gkAvg: 9.0,  tiAvg: 20.0 },
  78:  { gaAvg: 1.55, shotsAvg: 13.8, cornersAvg: 5.2, cardsAvg: 2.0, gkAvg: 8.8,  tiAvg: 20.8 },
  135: { gaAvg: 1.32, shotsAvg: 12.8, cornersAvg: 5.0, cardsAvg: 2.5, gkAvg: 9.2,  tiAvg: 19.5 },
  61:  { gaAvg: 1.38, shotsAvg: 12.5, cornersAvg: 5.0, cardsAvg: 2.3, gkAvg: 9.0,  tiAvg: 20.5 },
  94:  { gaAvg: 1.35, shotsAvg: 12.0, cornersAvg: 5.1, cardsAvg: 2.4, gkAvg: 9.0,  tiAvg: 20.0 },
  88:  { gaAvg: 1.60, shotsAvg: 14.0, cornersAvg: 5.5, cardsAvg: 2.0, gkAvg: 8.5,  tiAvg: 20.5 },
  253: { gaAvg: 1.50, shotsAvg: 13.2, cornersAvg: 5.2, cardsAvg: 2.2, gkAvg: 8.8,  tiAvg: 21.0 },
  262: { gaAvg: 1.40, shotsAvg: 12.8, cornersAvg: 5.0, cardsAvg: 2.4, gkAvg: 9.0,  tiAvg: 20.8 },
  239: { gaAvg: 1.20, shotsAvg: 11.5, cornersAvg: 4.8, cardsAvg: 2.7, gkAvg: 9.5,  tiAvg: 21.0 },
  2:   { gaAvg: 1.40, shotsAvg: 12.5, cornersAvg: 5.0, cardsAvg: 2.2, gkAvg: 9.0,  tiAvg: 18.5 },
  3:   { gaAvg: 1.45, shotsAvg: 12.8, cornersAvg: 5.1, cardsAvg: 2.3, gkAvg: 9.0,  tiAvg: 19.5 },
  848: { gaAvg: 1.50, shotsAvg: 13.0, cornersAvg: 5.2, cardsAvg: 2.3, gkAvg: 9.0,  tiAvg: 20.0 },
}

export function getBaseline(leagueId) {
  return LEAGUE_BASELINES[leagueId] ?? { gaAvg: 1.40, shotsAvg: 12.8, cornersAvg: 5.1, cardsAvg: 2.3, gkAvg: 9.0, tiAvg: 20.5 }
}
