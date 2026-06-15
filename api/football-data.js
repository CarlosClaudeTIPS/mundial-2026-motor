// Vercel Edge Function — proxy API-Football v3
// Evita CORS y protege la API key del cliente

export const config = { runtime: 'edge' }

const API_KEY  = process.env.API_FOOTBALL_KEY
const BASE_URL = 'https://v3.football.api-sports.io'
const LEAGUE   = 1      // FIFA World Cup
const SEASON   = 2026

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
    return new Response(JSON.stringify({ error: 'API_FOOTBALL_KEY not configured' }), { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const endpoint = searchParams.get('endpoint') // standings | fixtures | live

  try {
    let data

    if (endpoint === 'standings') {
      data = await apiFetch(`/standings?league=${LEAGUE}&season=${SEASON}`)
      const raw = data?.response?.[0]?.league?.standings ?? []
      // raw es array de grupos, cada uno array de equipos
      const groups = raw.map(group => group.map(team => ({
        rank:   team.rank,
        id:     team.team.id,
        name:   team.team.name,
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
        status: team.status ?? '',
      })))
      return json({ ok: true, groups })
    }

    if (endpoint === 'fixtures') {
      data = await apiFetch(`/fixtures?league=${LEAGUE}&season=${SEASON}`)
      const fixtures = (data?.response ?? []).map(f => ({
        id:       f.fixture.id,
        date:     f.fixture.date,
        status:   f.fixture.status.short,   // NS, 1H, HT, 2H, FT, etc.
        elapsed:  f.fixture.status.elapsed,
        venue:    f.fixture.venue?.city ?? '',
        homeTeam: f.teams.home.name,
        awayTeam: f.teams.away.name,
        homeGoals: f.goals.home,
        awayGoals: f.goals.away,
        homeWinner: f.teams.home.winner,
        awayWinner: f.teams.away.winner,
      }))
      return json({ ok: true, fixtures })
    }

    if (endpoint === 'live') {
      data = await apiFetch(`/fixtures?live=all&league=${LEAGUE}`)
      const live = (data?.response ?? []).map(f => ({
        id:       f.fixture.id,
        elapsed:  f.fixture.status.elapsed,
        status:   f.fixture.status.short,
        homeTeam: f.teams.home.name,
        awayTeam: f.teams.away.name,
        homeGoals: f.goals.home,
        awayGoals: f.goals.away,
        stats:    f.statistics ?? [],
      }))
      return json({ ok: true, live })
    }

    return json({ error: 'endpoint inválido' }, 400)
  } catch (e) {
    return json({ ok: false, error: e.message }, 200)
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
