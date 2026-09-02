-- ─── Tabla de estado del usuario (bankroll y demás) ─────────────────────────
-- Pegar TODO esto en Supabase → SQL Editor → Run.
-- RLS: cada usuario solo puede leer y escribir SUS filas.

create table if not exists public.estado (
  user_id    uuid not null references auth.users (id) on delete cascade,
  clave      text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, clave)
);

alter table public.estado enable row level security;

drop policy if exists "estado_select_propio" on public.estado;
create policy "estado_select_propio" on public.estado
  for select using (auth.uid() = user_id);

drop policy if exists "estado_upsert_propio" on public.estado;
create policy "estado_upsert_propio" on public.estado
  for insert with check (auth.uid() = user_id);

drop policy if exists "estado_update_propio" on public.estado;
create policy "estado_update_propio" on public.estado
  for update using (auth.uid() = user_id);

drop policy if exists "estado_delete_propio" on public.estado;
create policy "estado_delete_propio" on public.estado
  for delete using (auth.uid() = user_id);
