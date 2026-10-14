-- ─── Migración 005: configuración de "Mi ruta para mejorar" ──────────────────
-- Ejecutar una vez en el SQL Editor de Supabase (después de migracion-004).
-- Guarda, por estudiante, lo que él mismo define: grado, fecha del examen,
-- minutos por día, días por semana y meta de puntaje global. La app funciona
-- sin esto (lo guarda en el dispositivo); con esto, la ruta lo sigue entre equipos.
alter table perfiles add column if not exists ruta_config jsonb;

create or replace function guardar_ruta(p_config jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if jsonb_typeof(p_config) <> 'object' then raise exception 'config inválida'; end if;
  update perfiles set ruta_config = p_config where id = auth.uid();
end $$;
grant execute on function guardar_ruta(jsonb) to authenticated;
