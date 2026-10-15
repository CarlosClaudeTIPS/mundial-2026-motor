-- Migración 008: rol "revisor" (admin de solo lectura).
-- Ejecutar en el SQL Editor de Supabase después de la 007.
--
-- El revisor ve todos los grupos, estudiantes, intentos, sesiones, banco y
-- biblioteca, pero NO puede insertar, actualizar ni borrar nada: solo se le
-- agregan políticas "for select". Las políticas de escritura siguen siendo
-- exclusivas de docente (sobre lo suyo) y admin.

alter table perfiles drop constraint if exists perfiles_rol_check;
alter table perfiles add constraint perfiles_rol_check check (rol in ('estudiante','docente','admin','revisor'));

create or replace function es_revisor() returns boolean language sql stable security definer as $$
  select coalesce((select rol from perfiles where id = auth.uid()) = 'revisor', false)
$$;

drop policy if exists perfiles_revisor on perfiles;
create policy perfiles_revisor on perfiles for select using (es_revisor());

drop policy if exists grupos_revisor on grupos;
create policy grupos_revisor on grupos for select using (es_revisor());

drop policy if exists intentos_revisor on intentos;
create policy intentos_revisor on intentos for select using (es_revisor());

drop policy if exists sesiones_revisor on sesiones;
create policy sesiones_revisor on sesiones for select using (es_revisor());

drop policy if exists asignaciones_revisor on asignaciones;
create policy asignaciones_revisor on asignaciones for select using (es_revisor());

drop policy if exists sesiones_docente_revisor on sesiones_docente;
create policy sesiones_docente_revisor on sesiones_docente for select using (es_revisor());

drop policy if exists preguntas_revisor on preguntas;
create policy preguntas_revisor on preguntas for select using (es_revisor());

drop policy if exists recursos_revisor on recursos;
create policy recursos_revisor on recursos for select using (es_revisor());

-- Cómo crear un revisor en la nube: invitar el correo desde Authentication →
-- Users y luego:  update perfiles set rol = 'revisor' where id = '<uuid>';
