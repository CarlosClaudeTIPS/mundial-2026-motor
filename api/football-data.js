// Vercel Edge Function — proxy API-Football v3
// Evita CORS y protege la API key del cliente.
// Parametrizado por liga (?league=39) — spec v2 §2/§3.

export const config = { runtime: 'edge' }

const API_KEY  = process.env.API_FOOTBALL_KEY
const BASE_URL = 'https://v3.football.api-sports.io'

const VALID_LEAGUES = new Set([39, 140, 78, 135, 61, 94, 88, 253, 262, 239, 13, 11, 2, 3, 848, 40, 71, 128, 203, 307, 179, 144, 197, 207, 218, 235, 45, 48])

function defaultSeason() {
  const now = new Date()
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
}

async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'x-apisports-key': API_KEY,
      'Accept': 'application/json',
    },
  })
  if (!res.ok) throw new Error(`API-Football ${res.status}`)
  return res.json()
}

export default async function handler(req) {
  if (!API_KEY) {
    return json({ ok: false, error: 'API_FOOTBALL_KEY not configured' }, 503)
  }

  const { searchParams } = new URL(req.url)
  const endpoint = searchParams.get('endpoint')
  const league   = Number(searchParams.get('league') || 39)
  const season   = Number(searchParams.get('season') || defaultSeason())

  if (!VALID_LEAGUES.has(league)) return json({ ok: false, error: 'liga inválida' }, 400)

  try {
    if (endpoint === 'standings') {
      const data = await apiFetch(`/standings?league=${league}&season=${season}`)
      const raw = data?.response?.[0]?.league?.standings ?? []
      // Ligas: un solo array. Copas: array por grupo.
      const groups = raw.map(group => group.map(team => ({
        rank:   team.rank,
        id:     team.team.id,
        name:   team.team.name,
        logo:   team.team.logo,
        group:  team.group,
        pts:    team.points,
        pj:     team.all.played,
        pg:     team.all.win,
        pe:     team.all.draw,
        pp:     team.all.lose,
        gf:     team.all.goals.for,
        gc:     team.all.goals.against,
        gd:     team.goalsDiff,
        form:   team.form ?? '',
      })))
      return json({ ok: true, groups, season })
    }

    if (endpoint === 'fixtures') {
      // Ventana: últimos 7 días + próximos 7 (evita bajar toda la temporada)
      const from = dateStr(-7)
      const to   = dateStr(7)
      const data = await apiFetch(`/fixtures?league=${league}&season=${season}&from=${from}&to=${to}&timezone=America/Bogota`)
      const fixtures = (data?.response ?? []).map(mapFixture)
      return json({ ok: true, fixtures })
    }

    if (endpoint === 'live') {
      const data = await apiFetch(`/fixtures?live=all&league=${league}`)
      const live = (data?.response ?? []).map(f => ({
        ...mapFixture(f),
        stats: f.statistics ?? [],
      }))
      return json({ ok: true, live })
    }

    // Últimos N partidos terminados de un equipo (cross-season para ponderación §4)
    if (endpoint === 'teamlast') {
      const team = Number(searchParams.get('team'))
      const last = Math.min(Number(searchParams.get('last') || 10), 15)
      if (!team) return json({ ok: false, error: 'team requerido' }, 400)
      const data = await apiFetch(`/fixtures?team=${team}&league=${league}&last=${last}&status=FT-AET-PEN`)
      const fixtures = (data?.response ?? []).map(f => ({
        ...mapFixture(f),
        htHome: f.score?.halftime?.home,
        htAway: f.score?.halftime?.away,
      }))
      return json({ ok: true, fixtures })
    }

    // Estadísticas detalladas de UN partido (cachear permanente en cliente)
    if (endpoint === 'fixstats') {
      const fixture = Number(searchParams.get('fixture'))
      if (!fixture) return json({ ok: false, error: 'fixture requerido' }, 400)
      const data = await apiFetch(`/fixtures/statistics?fixture=${fixture}`)
      const stats = (data?.response ?? []).map(t => ({
        teamId: t.team.id,
        stats: Object.fromEntries((t.statistics ?? []).map(s => [s.type, s.value])),
      }))
      return json({ ok: true, fixture, stats })
    }

    return json({ ok: false, error: 'endpoint inválido' }, 400)
  } catch (e) {
    return json({ ok: false, error: e.message }, 200)
  }
}

function mapFixture(f) {
  return {
    id:        f.fixture.id,
    date:      f.fixture.date,
    status:    f.fixture.status.short,
    elapsed:   f.fixture.status.elapsed,
    venue:     f.fixture.venue?.city ?? '',
    referee:   f.fixture.referee ?? null,
    homeId:    f.teams.home.id,
    awayId:    f.teams.away.id,
    homeTeam:  f.teams.home.name,
    awayTeam:  f.teams.away.name,
    homeGoals: f.goals.home,
    awayGoals: f.goals.away,
    homeWinner: f.teams.home.winner,
    awayWinner: f.teams.away.winner,
  }
}

function dateStr(offsetDays) {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10)
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
