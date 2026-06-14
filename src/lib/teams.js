// Base de datos inicial — 48 equipos Mundial 2026
// Stats basadas en últimos 15 partidos (placeholder hasta pegar JSON real)
// Estructura lista para reemplazar con datos de FootyStats

export const GRUPOS = {
  A: ['Estados Unidos', 'Panamá', 'Honduras', 'Jamaica'],
  B: ['México', 'Bolivia', 'Venezuela', 'Nueva Zelanda'],
  C: ['Argentina', 'Chile', 'Perú', 'Australia'],
  D: ['Brasil', 'Ecuador', 'Paraguay', 'Marruecos'],
  E: ['Colombia', 'Costa Rica', 'Canadá', 'Senegal'],
  F: ['Uruguay', 'Haití', 'Guatemala', 'Nigeria'],
  G: ['Francia', 'Bélgica', 'Suiza', 'Arabia Saudita'],
  H: ['España', 'Portugal', 'Turquía', 'Irán'],
  I: ['Alemania', 'Países Bajos', 'Serbia', 'Japón'],
  J: ['Inglaterra', 'Polonia', 'Eslovaquia', 'Argelia'],
  K: ['Italia', 'Dinamarca', 'Escocia', 'Camerún'],
  L: ['Croacia', 'Eslovenia', 'Ucrania', 'Costa de Marfil'],
}

function makeTeam(name, group, overrides = {}) {
  return {
    id: name.toLowerCase().replace(/\s+/g, '_'),
    name,
    group,
    flag: '',
    matches: 15,
    ppg: 1.8,
    gf_avg: 1.5,
    ga_avg: 1.0,
    cs_pct: 33,
    btts_pct: 45,
    shots_avg: 13.5,
    sot_avg: 5.2,
    shots_against_avg: 11.0,
    corners_avg: 5.5,
    corners_against_avg: 4.8,
    cards_avg: 2.2,
    throwins_avg: 38,
    goalkicks_avg: 22,
    freekicks_avg: 14,
    // 1H desglose
    corners_1h: 2.8,
    corners_2h: 2.7,
    shots_1h: 6.5,
    shots_2h: 7.0,
    sot_1h: 2.4,
    sot_2h: 2.8,
    cards_1h: 0.9,
    cards_2h: 1.3,
    goals_1h: 0.6,
    goals_2h: 0.9,
    // Over/Under %
    ou: {
      corners: { 7.5: 55, 8.5: 42, 9.5: 31, 10.5: 22 },
      goals: { 1.5: 78, 2.5: 52, 3.5: 30 },
      sot: { 7.5: 48, 8.5: 35, 9.5: 24 },
      cards: { 1.5: 82, 2.5: 58, 3.5: 34, 4.5: 18 },
    },
    ...overrides,
  }
}

export const TEAMS = Object.entries(GRUPOS).flatMap(([group, names]) =>
  names.map(name => makeTeam(name, group))
)

export const TEAMS_BY_ID = Object.fromEntries(TEAMS.map(t => [t.id, t]))

export function getTeamsByGroup(group) {
  return TEAMS.filter(t => t.group === group)
}

export function findTeam(id) {
  return TEAMS_BY_ID[id] ?? null
}

// Sedes del Mundial 2026
export const SEDES = [
  { ciudad: 'Ciudad de México', estadio: 'Estadio Azteca', altitud: 2240, pais: 'México' },
  { ciudad: 'Guadalajara', estadio: 'Estadio Akron', altitud: 1566, pais: 'México' },
  { ciudad: 'Monterrey', estadio: 'Estadio BBVA', altitud: 538, pais: 'México' },
  { ciudad: 'Nueva York', estadio: 'MetLife Stadium', altitud: 6, pais: 'EE.UU.' },
  { ciudad: 'Los Ángeles', estadio: 'SoFi Stadium', altitud: 27, pais: 'EE.UU.' },
  { ciudad: 'Dallas', estadio: 'AT&T Stadium', altitud: 183, pais: 'EE.UU.' },
  { ciudad: 'San Francisco', estadio: "Levi's Stadium", altitud: 12, pais: 'EE.UU.' },
  { ciudad: 'Miami', estadio: 'Hard Rock Stadium', altitud: 5, pais: 'EE.UU.' },
  { ciudad: 'Seattle', estadio: 'Lumen Field', altitud: 8, pais: 'EE.UU.' },
  { ciudad: 'Boston', estadio: 'Gillette Stadium', altitud: 12, pais: 'EE.UU.' },
  { ciudad: 'Kansas City', estadio: 'Arrowhead Stadium', altitud: 264, pais: 'EE.UU.' },
  { ciudad: 'Atlanta', estadio: 'Mercedes-Benz Stadium', altitud: 320, pais: 'EE.UU.' },
  { ciudad: 'Toronto', estadio: 'BMO Field', altitud: 76, pais: 'Canadá' },
  { ciudad: 'Vancouver', estadio: 'BC Place', altitud: 14, pais: 'Canadá' },
]
