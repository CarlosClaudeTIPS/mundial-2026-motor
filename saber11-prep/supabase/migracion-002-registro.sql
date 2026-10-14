-- ─── Migración 002: registro de estudiantes con aprobación ───────────────────
-- Ejecutar una vez en el SQL Editor de Supabase (después de schema.sql).

-- Estado del perfil: los que se registran solos quedan "pendiente" hasta que
-- un docente o admin los acepte. Los perfiles existentes quedan "activo".
alter table perfiles add column if not exists estado text not null default 'activo'
  check (estado in ('pendiente', 'activo', 'rechazado'));

-- Siguiente usuario libre: base, base1, base2… (lo puede llamar cualquiera antes de registrarse)
create or replace function siguiente_usuario(base text) returns text
language plpgsql security definer set search_path = public, auth as $$
declare
  limpio text := lower(regexp_replace(coalesce(base, ''), '[^a-zA-Z]', '', 'g'));
  candidato text;
  n int := 0;
begin
  if length(limpio) < 4 or length(limpio) > 40 then raise exception 'Nombre de usuario inválido'; end if;
  candidato := limpio;
  while exists (select 1 from perfiles where usuario = candidato)
     or exists (select 1 from auth.users where email = candidato || '@estudiantes.saber11.local') loop
    n := n + 1;
    candidato := limpio || n::text;
  end loop;
  return candidato;
end $$;
grant execute on function siguiente_usuario(text) to anon, authenticated;

-- El estudiante ya no puede editar su propio perfil (así no puede aprobarse a sí mismo).
drop policy if exists perfiles_editar_propio on perfiles;

-- Puede crear SOLO su propio perfil, como estudiante pendiente y sin grupo.
drop policy if exists perfiles_registro_propio on perfiles;
create policy perfiles_registro_propio on perfiles for insert with check (
  id = auth.uid() and rol = 'estudiante' and estado = 'pendiente' and grupo_id is null
);

-- Docentes y admin ven a todos los estudiantes (para revisar solicitudes) y pueden aceptarlos o rechazarlos.
drop policy if exists perfiles_leer on perfiles;
create policy perfiles_leer on perfiles for select using (
  id = auth.uid() or rol_actual() = 'admin' or es_mi_estudiante(id)
  or (rol_actual() = 'docente' and rol = 'estudiante')
);
drop policy if exists perfiles_docente_aprueba on perfiles;
create policy perfiles_docente_aprueba on perfiles for update
  using (rol_actual() in ('docente', 'admin') and rol = 'estudiante')
  with check (rol = 'estudiante');
