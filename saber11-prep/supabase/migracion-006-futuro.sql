-- ─── Migración 006: «Mi futuro» (orientación vocacional y proyecto de vida) ──
-- Ejecutar una vez en el SQL Editor de Supabase (después de migracion-005).
-- Guarda, por estudiante, su cuestionario de intereses, valores, entorno, opciones
-- guardadas, comparaciones, proyecto de vida y actividades. Solo el propio
-- estudiante escribe su fila (auth.uid()). La app funciona sin esto (guarda en el
-- dispositivo); con esto, el avance sigue al estudiante entre equipos.
-- Privacidad: el docente no consulta esta columna desde la app.
alter table perfiles add column if not exists futuro jsonb;

create or replace function guardar_futuro(p_futuro jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_futuro is not null and jsonb_typeof(p_futuro) <> 'object' then raise exception 'datos inválidos'; end if;
  update perfiles set futuro = p_futuro where id = auth.uid();
end $$;
grant execute on function guardar_futuro(jsonb) to authenticated;
