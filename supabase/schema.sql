-- ─── Schema Supabase — Motor Mundial 2026 ────────────────────────────────────

-- Equipos
create table if not exists teams (
  id text primary key,
  name text not null,
  "group" char(1) not null,
  flag text,
  matches int default 15,
  ppg numeric(4,2) default 0,
  gf_avg numeric(4,2) default 0,
  ga_avg numeric(4,2) default 0,
  cs_pct numeric(5,2) default 0,
  btts_pct numeric(5,2) default 0,
  shots_avg numeric(5,2) default 0,
  sot_avg numeric(5,2) default 0,
  shots_against_avg numeric(5,2) default 0,
  corners_avg numeric(5,2) default 0,
  corners_against_avg numeric(5,2) default 0,
  cards_avg numeric(5,2) default 0,
  throwins_avg numeric(5,2) default 0,
  goalkicks_avg numeric(5,2) default 0,
  freekicks_avg numeric(5,2) default 0,
  corners_1h numeric(5,2) default 0,
  corners_2h numeric(5,2) default 0,
  shots_1h numeric(5,2) default 0,
  shots_2h numeric(5,2) default 0,
  sot_1h numeric(5,2) default 0,
  sot_2h numeric(5,2) default 0,
  cards_1h numeric(5,2) default 0,
  cards_2h numeric(5,2) default 0,
  goals_1h numeric(5,2) default 0,
  goals_2h numeric(5,2) default 0,
  ou_corners_75 numeric(5,2) default 0,
  ou_corners_85 numeric(5,2) default 0,
  ou_corners_95 numeric(5,2) default 0,
  ou_corners_105 numeric(5,2) default 0,
  ou_goals_15 numeric(5,2) default 0,
  ou_goals_25 numeric(5,2) default 0,
  ou_goals_35 numeric(5,2) default 0,
  ou_sot_75 numeric(5,2) default 0,
  ou_sot_85 numeric(5,2) default 0,
  ou_sot_95 numeric(5,2) default 0,
  ou_cards_15 numeric(5,2) default 0,
  ou_cards_25 numeric(5,2) default 0,
  ou_cards_35 numeric(5,2) default 0,
  ou_cards_45 numeric(5,2) default 0,
  updated_at timestamptz default now()
);

-- Standings de grupo
create table if not exists standings (
  id serial primary key,
  team_id text references teams(id),
  pj int default 0,
  pg int default 0,
  pe int default 0,
  pp int default 0,
  gf int default 0,
  gc int default 0,
  pts int default 0,
  updated_at timestamptz default now()
);

-- Partidos
create table if not exists matches (
  id serial primary key,
  team_a text references teams(id),
  team_b text references teams(id),
  venue text,
  city text,
  altitude_msnm int default 0,
  match_date timestamptz,
  temperature_c numeric(4,1),
  humidity_pct int,
  distance_a_km int default 0,
  distance_b_km int default 0,
  timezone_diff_h int default 0,
  group_situation_a text check (group_situation_a in ('necesita_ganar','empate_sirve','ya_clasificado','eliminado')),
  group_situation_b text check (group_situation_b in ('necesita_ganar','empate_sirve','ya_clasificado','eliminado')),
  yellow_accum_a int default 0,
  yellow_accum_b int default 0,
  score_a int,
  score_b int,
  status text default 'scheduled' check (status in ('scheduled','live','finished')),
  created_at timestamptz default now()
);

-- Picks (historial)
create table if not exists picks (
  id serial primary key,
  match_id int references matches(id),
  partido text not null,
  mercado text not null,
  linea numeric(5,2) not null,
  cuota numeric(6,2) not null,
  p_modelo numeric(5,2),
  ev_pct numeric(6,2),
  confidence int,
  risk int,
  resultado text check (resultado in ('ganado','perdido','void')),
  created_at timestamptz default now()
);

-- Índices
create index if not exists idx_picks_resultado on picks(resultado);
create index if not exists idx_picks_mercado on picks(mercado);
create index if not exists idx_matches_status on matches(status);
create index if not exists idx_standings_team on standings(team_id);

-- RLS (Row Level Security) — habilitar en producción
alter table teams enable row level security;
alter table picks enable row level security;
alter table matches enable row level security;
alter table standings enable row level security;

-- Política pública de lectura (ajustar en producción)
create policy "public read teams" on teams for select using (true);
create policy "public read standings" on standings for select using (true);
create policy "public read matches" on matches for select using (true);
create policy "public read picks" on picks for select using (true);
create policy "public insert picks" on picks for insert with check (true);
create policy "public update picks" on picks for update using (true);
