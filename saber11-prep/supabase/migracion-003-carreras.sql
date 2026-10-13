-- ─── Migración 003: carreras y modo carrera ──────────────────────────────────
-- Ejecutar una vez en el SQL Editor de Supabase (después de migracion-002).

-- Carreras que le gustan al estudiante (ids de content/carreras.json, hasta 3)
-- y si quiere priorizar las pruebas que más pesan para ellas.
alter table perfiles add column if not exists carreras jsonb default '[]'::jsonb;
alter table perfiles add column if not exists modo_carrera boolean default false;
alter table perfiles add column if not exists carreras_definidas boolean default false;

-- El estudiante no puede editar su perfil (migración 002), pero sí debe poder
-- guardar SUS carreras. Esta función solo toca esas tres columnas de su propia fila.
create or replace function guardar_carreras(p_carreras jsonb, p_modo boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  if jsonb_typeof(p_carreras) <> 'array' or jsonb_array_length(p_carreras) > 3 then
    raise exception 'Carreras inválidas (máximo 3)';
  end if;
  update perfiles
     set carreras = p_carreras,
         modo_carrera = coalesce(p_modo, false) and jsonb_array_length(p_carreras) > 0,
         carreras_definidas = true
   where id = auth.uid();
end $$;
grant execute on function guardar_carreras(jsonb, boolean) to authenticated;
