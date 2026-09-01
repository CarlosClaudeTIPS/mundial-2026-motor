// ─── Catálogo de competiciones — spec v2 §2 ──────────────────────────────────
// K_base por liga calibra córners y throw-ins según el ritmo de cada competición.
// IDs de API-Football v3 (spec §3).

// lsId = competition_id en Live-Score API (live-score-api.com)
// main: true → aparece de primero en el selector; el resto va agrupado por país
export const LEAGUES = [
  { id: 39,  lsId: 2,   main: true, name: 'Premier League',    country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', kCorners: 1.08, kTI: 1.12, sportKey: 'soccer_epl',                  type: 'league' },
  { id: 140, lsId: 3,   main: true, name: 'La Liga',           country: 'España',     flag: '🇪🇸', kCorners: 0.95, kTI: 0.95, sportKey: 'soccer_spain_la_liga',          type: 'league' },
  { id: 78,  lsId: 1,   main: true, name: 'Bundesliga',        country: 'Alemania',   flag: '🇩🇪', kCorners: 1.10, kTI: 1.08, sportKey: 'soccer_germany_bundesliga',     type: 'league' },
  { id: 135, lsId: 4,   main: true, name: 'Serie A',           country: 'Italia',     flag: '🇮🇹', kCorners: 0.92, kTI: 0.92, sportKey: 'soccer_italy_serie_a',          type: 'league' },
  { id: 61,  lsId: 5,   main: true, name: 'Ligue 1',           country: 'Francia',    flag: '🇫🇷', kCorners: 1.00, kTI: 1.00, sportKey: 'soccer_france_ligue_one',       type: 'league' },
  { id: 94,  lsId: 8,   main: true, name: 'Liga Portugal',     country: 'Portugal',   flag: '🇵🇹', kCorners: 1.02, kTI: 0.98, sportKey: 'soccer_portugal_primeira_liga', type: 'league' },
  { id: 88,  lsId: 196, main: true, name: 'Eredivisie',        country: 'Holanda',    flag: '🇳🇱', kCorners: 1.12, kTI: 1.05, sportKey: null,                            type: 'league' },
  { id: 253, lsId: 76,  main: true, name: 'MLS',               country: 'USA',        flag: '🇺🇸', kCorners: 1.05, kTI: 1.06, sportKey: 'soccer_usa_mls',                type: 'league' },
  { id: 262, lsId: 45,  main: true, name: 'Liga MX',           country: 'México',     flag: '🇲🇽', kCorners: 0.98, kTI: 1.02, sportKey: 'soccer_mexico_ligamx',          type: 'league' },
  { id: 239, lsId: 51,  main: true, name: 'Liga BetPlay',      country: 'Colombia',   flag: '🇨🇴', kCorners: 1.00, kTI: 1.04, sportKey: null,                            type: 'league' },
  { id: 13,  lsId: 329, main: true, name: 'Copa Libertadores', country: 'Sudamérica', flag: '🏆', kCorners: 0.95, kTI: 1.06, sportKey: 'soccer_conmebol_copa_libertadores', type: 'cup' },
  { id: 11,  lsId: 330, main: true, name: 'Copa Sudamericana', country: 'Sudamérica', flag: '🌎', kCorners: 0.97, kTI: 1.06, sportKey: null,                            type: 'cup' },
  { id: 2,   lsId: 244, main: true, name: 'Champions League',  country: 'Europa',     flag: '⭐', kCorners: 0.90, kTI: 0.90, sportKey: 'soccer_uefa_champs_league',     type: 'cup' },
  { id: 3,   lsId: 245, main: true, name: 'Europa League',     country: 'Europa',     flag: '🥈', kCorners: 0.93, kTI: 0.94, sportKey: 'soccer_uefa_europa_league',     type: 'cup' },
  { id: 848, lsId: 446, main: true, name: 'Conference League', country: 'Europa',     flag: '🥉', kCorners: 1.00, kTI: 0.97, sportKey: null,                            type: 'cup' },
  // ── Más ligas (agrupadas por país en el selector) ──
  { id: 40,  lsId: 77,  main: false, name: 'Championship',       country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', kCorners: 1.06, kTI: 1.10, sportKey: 'soccer_efl_champ', type: 'league' },
  { id: 45,  lsId: 152, main: false, name: 'FA Cup',             country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', kCorners: 1.05, kTI: 1.10, sportKey: 'soccer_fa_cup', type: 'cup' },
  { id: 48,  lsId: 150, main: false, name: 'EFL Cup',            country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', kCorners: 1.04, kTI: 1.08, sportKey: 'soccer_england_efl_cup', type: 'cup' },
  { id: 71,  lsId: 24,  main: true,  name: 'Brasileirão Serie A', country: 'Brasil',    flag: '🇧🇷', kCorners: 1.02, kTI: 1.05, sportKey: 'soccer_brazil_campeonato', type: 'league' },
  { id: 128, lsId: 23,  main: false, name: 'Liga Profesional',   country: 'Argentina',  flag: '🇦🇷', kCorners: 0.98, kTI: 1.08, sportKey: 'soccer_argentina_primera_division', type: 'league' },
  { id: 203, lsId: 6,   main: false, name: 'Süper Lig',          country: 'Turquía',    flag: '🇹🇷', kCorners: 1.02, kTI: 1.02, sportKey: 'soccer_turkey_super_league', type: 'league' },
  { id: 307, lsId: 313, main: false, name: 'Saudi Pro League',   country: 'Arabia Saudita', flag: '🇸🇦', kCorners: 1.00, kTI: 1.00, sportKey: null, type: 'league' },
  { id: 235, lsId: 7,   main: true,  name: 'Premier Liga',       country: 'Rusia',      flag: '🇷🇺', kCorners: 1.00, kTI: 1.03, sportKey: null, type: 'league' },
  // Rusia: cobertura completa de stats (banda + portería) — principales
  { id: 309, lsId: 309, main: true,  name: 'Primera División',   country: 'Rusia',      flag: '🇷🇺', kCorners: 1.00, kTI: 1.00, sportKey: null, type: 'league' },
  { id: 311, lsId: 311, main: true,  name: 'Copa de Rusia',      country: 'Rusia',      flag: '🇷🇺', kCorners: 1.00, kTI: 1.00, sportKey: null, type: 'cup' },
  { id: 179, lsId: 75,  main: false, name: 'Premiership',        country: 'Escocia',    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', kCorners: 1.05, kTI: 1.10, sportKey: 'soccer_spl', type: 'league' },
  { id: 144, lsId: 68,  main: false, name: 'Pro League',         country: 'Bélgica',    flag: '🇧🇪', kCorners: 1.05, kTI: 1.04, sportKey: 'soccer_belgium_first_div', type: 'league' },
  { id: 197, lsId: 9,   main: false, name: 'Super League',       country: 'Grecia',     flag: '🇬🇷', kCorners: 0.95, kTI: 1.00, sportKey: 'soccer_greece_super_league', type: 'league' },
  { id: 207, lsId: 15,  main: false, name: 'Super League',       country: 'Suiza',      flag: '🇨🇭', kCorners: 1.04, kTI: 1.02, sportKey: 'soccer_switzerland_superleague', type: 'league' },
  { id: 218, lsId: 43,  main: false, name: 'Bundesliga',         country: 'Austria',    flag: '🇦🇹', kCorners: 1.06, kTI: 1.04, sportKey: 'soccer_austria_bundesliga', type: 'league' },
  // ── Segundas divisiones y copas con buen mercado (2026-08-29) ──
  // kCorners/kTI = 1.00 NEUTRO: sin muestra propia no se inventan factores
  // (arquitectura congelada). Se ajustarán solo con evidencia del backtest.
  { id: 95,  lsId: 95,  main: false, name: 'Brasileirão Serie B', country: 'Brasil',    flag: '🇧🇷', kCorners: 1.00, kTI: 1.00, sportKey: 'soccer_brazil_serie_b', type: 'league' },
  { id: 256, lsId: 256, main: true,  name: 'Copa do Brasil',      country: 'Brasil',    flag: '🇧🇷', kCorners: 1.00, kTI: 1.00, sportKey: null, type: 'cup' },
  { id: 136, lsId: 87,  main: false, name: 'Serie B',             country: 'Italia',    flag: '🇮🇹', kCorners: 1.00, kTI: 1.00, sportKey: 'soccer_italy_serie_b', type: 'league' },
  { id: 141, lsId: 79,  main: false, name: 'Segunda División',    country: 'España',    flag: '🇪🇸', kCorners: 1.00, kTI: 1.00, sportKey: 'soccer_spain_segunda_division', type: 'league' },
  { id: 258, lsId: 258, main: false, name: 'Premier League',      country: 'Canadá',    flag: '🇨🇦', kCorners: 1.00, kTI: 1.00, sportKey: null, type: 'league' },
  // ── Latinoamérica y segundas divisiones (2026-08-29) ──
  { id: 131, lsId: 96,  main: false, name: 'Primera Nacional',    country: 'Argentina', flag: '🇦🇷', kCorners: 1.00, kTI: 1.00, sportKey: null, type: 'league' },
  { id: 130, lsId: 230, main: false, name: 'Copa Argentina',      country: 'Argentina', flag: '🇦🇷', kCorners: 1.00, kTI: 1.00, sportKey: null, type: 'cup' },
  { id: 263, lsId: 98,  main: false, name: 'Liga de Expansión',   country: 'México',    flag: '🇲🇽', kCorners: 1.00, kTI: 1.00, sportKey: null, type: 'league' },
  { id: 265, lsId: 25,  main: false, name: 'Primera División',    country: 'Chile',     flag: '🇨🇱', kCorners: 1.00, kTI: 1.00, sportKey: null, type: 'league' },
  { id: 242, lsId: 50,  main: false, name: 'Liga Pro',            country: 'Ecuador',   flag: '🇪🇨', kCorners: 1.00, kTI: 1.00, sportKey: null, type: 'league' },
  { id: 268, lsId: 48,  main: false, name: 'Primera División',    country: 'Uruguay',   flag: '🇺🇾', kCorners: 1.00, kTI: 1.00, sportKey: null, type: 'league' },
  { id: 250, lsId: 49,  main: false, name: 'División Profesional', country: 'Paraguay', flag: '🇵🇾', kCorners: 1.00, kTI: 1.00, sportKey: null, type: 'league' },
  { id: 281, lsId: 47,  main: false, name: 'Primera División',    country: 'Perú',      flag: '🇵🇪', kCorners: 1.00, kTI: 1.00, sportKey: null, type: 'league' },
  { id: 255, lsId: 383, main: false, name: 'USL Championship',    country: 'USA',       flag: '🇺🇸', kCorners: 1.00, kTI: 1.00, sportKey: null, type: 'league' },
  { id: 240, lsId: 265, main: false, name: 'Primera B',           country: 'Colombia',  flag: '🇨🇴', kCorners: 1.00, kTI: 1.00, sportKey: null, type: 'league' },
  { id: 241, lsId: 116, main: false, name: 'Copa Colombia',       country: 'Colombia',  flag: '🇨🇴', kCorners: 1.00, kTI: 1.00, sportKey: null, type: 'cup' },
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
  13:  { gaAvg: 1.25, shotsAvg: 11.8, cornersAvg: 4.9, cardsAvg: 2.9, gkAvg: 9.5,  tiAvg: 21.5 },
  11:  { gaAvg: 1.28, shotsAvg: 11.5, cornersAvg: 4.8, cardsAvg: 3.0, gkAvg: 9.5,  tiAvg: 21.5 },
  2:   { gaAvg: 1.40, shotsAvg: 12.5, cornersAvg: 5.0, cardsAvg: 2.2, gkAvg: 9.0,  tiAvg: 18.5 },
  3:   { gaAvg: 1.45, shotsAvg: 12.8, cornersAvg: 5.1, cardsAvg: 2.3, gkAvg: 9.0,  tiAvg: 19.5 },
  848: { gaAvg: 1.50, shotsAvg: 13.0, cornersAvg: 5.2, cardsAvg: 2.3, gkAvg: 9.0,  tiAvg: 20.0 },
  40:  { gaAvg: 1.30, shotsAvg: 12.5, cornersAvg: 5.2, cardsAvg: 2.1, gkAvg: 9.0,  tiAvg: 22.0 },
  45:  { gaAvg: 1.55, shotsAvg: 13.0, cornersAvg: 5.2, cardsAvg: 2.0, gkAvg: 8.8,  tiAvg: 21.5 },
  48:  { gaAvg: 1.60, shotsAvg: 13.2, cornersAvg: 5.3, cardsAvg: 2.0, gkAvg: 8.8,  tiAvg: 21.5 },
  71:  { gaAvg: 1.20, shotsAvg: 12.5, cornersAvg: 5.3, cardsAvg: 2.6, gkAvg: 9.2,  tiAvg: 21.0 },
  128: { gaAvg: 1.10, shotsAvg: 11.5, cornersAvg: 5.0, cardsAvg: 3.0, gkAvg: 9.5,  tiAvg: 22.0 },
  203: { gaAvg: 1.40, shotsAvg: 12.8, cornersAvg: 5.2, cardsAvg: 2.7, gkAvg: 9.0,  tiAvg: 20.5 },
  307: { gaAvg: 1.45, shotsAvg: 12.5, cornersAvg: 5.0, cardsAvg: 2.3, gkAvg: 9.0,  tiAvg: 20.0 },
  235: { gaAvg: 1.30, shotsAvg: 12.0, cornersAvg: 4.9, cardsAvg: 2.5, gkAvg: 9.2,  tiAvg: 21.0 },
  179: { gaAvg: 1.35, shotsAvg: 12.2, cornersAvg: 5.0, cardsAvg: 2.2, gkAvg: 9.2,  tiAvg: 21.5 },
  144: { gaAvg: 1.45, shotsAvg: 13.0, cornersAvg: 5.2, cardsAvg: 2.3, gkAvg: 8.8,  tiAvg: 20.5 },
  197: { gaAvg: 1.25, shotsAvg: 11.8, cornersAvg: 4.9, cardsAvg: 2.8, gkAvg: 9.5,  tiAvg: 20.0 },
  207: { gaAvg: 1.50, shotsAvg: 13.0, cornersAvg: 5.2, cardsAvg: 2.2, gkAvg: 8.8,  tiAvg: 20.5 },
  218: { gaAvg: 1.50, shotsAvg: 13.2, cornersAvg: 5.3, cardsAvg: 2.3, gkAvg: 8.8,  tiAvg: 20.5 },
}

// Abreviatura de competición para las filas de historial
const COMP_ABBR = {
  'premier league': 'PL', 'laliga santander': 'LaLiga', 'la liga': 'LaLiga',
  'bundesliga': 'BUN', 'serie a': 'SerieA', 'ligue 1': 'L1',
  'primeira liga': 'LigaPT', 'eredivisie': 'ERE', 'major league soccer': 'MLS',
  'liga mx': 'LigaMX', 'primera a': 'BetPlay',
  'champions league': 'UCL', 'europa league': 'UEL', 'uefa conference league': 'UECL',
  'copa libertadores': 'LIB', 'copa sudamericana': 'SUD',
  'championship': 'CHAMP', 'super lig': 'SüperLig', 'club teams friendlies': 'Amistoso',
  'fa cup': 'FACup', 'efl cup': 'EFLCup', 'copa del rey': 'CopaRey', 'dfb pokal': 'Pokal',
  'liga professional': 'ARG',
}

export function compAbbr(name) {
  if (!name) return ''
  const key = name.toLowerCase().trim()
  if (COMP_ABBR[key]) return COMP_ABBR[key]
  // fallback: iniciales (máx 4)
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length === 1) return words[0].slice(0, 5)
  return words.map(w => w[0]).join('').slice(0, 4).toUpperCase()
}

export function getBaseline(leagueId) {
  return LEAGUE_BASELINES[leagueId] ?? { gaAvg: 1.40, shotsAvg: 12.8, cornersAvg: 5.1, cardsAvg: 2.3, gkAvg: 9.0, tiAvg: 20.5 }
}
