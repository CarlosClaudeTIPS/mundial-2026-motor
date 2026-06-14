-- Ejecutar en Supabase > SQL Editor
create table if not exists picks (
  id          bigint primary key,
  partido     text,
  mercado     text,
  linea       text,
  cuota       numeric,
  ev          numeric,
  stake       numeric,
  resultado   text default 'pendiente',
  created_at  timestamptz default now()
);

-- Habilitar acceso público (Row Level Security desactivado para MVP)
alter table picks enable row level security;
create policy "public read" on picks for select using (true);
create policy "public insert" on picks for insert with check (true);
create policy "public update" on picks for update using (true);
create policy "public delete" on picks for delete using (true);
