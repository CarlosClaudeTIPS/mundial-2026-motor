-- ─── Migración 007: el docente puede reenviar intentos y sesiones de sus estudiantes ──
-- Ejecutar una vez en el SQL Editor de Supabase (después de migracion-006).
-- Hasta ahora el docente/admin podía INSERTAR intentos de sus estudiantes (registro en
-- papel) pero no actualizarlos; si la app reintentaba subir uno ya existente, Supabase
-- respondía "new row violates row-level security policy (USING expression)". Con esto
-- el reenvío es idempotente para el docente de ese estudiante y para el administrador.
create policy intentos_docente_actualiza on intentos for update
  using (es_mi_estudiante(estudiante_id) or rol_actual() = 'admin')
  with check (es_mi_estudiante(estudiante_id) or rol_actual() = 'admin');
create policy sesiones_docente_actualiza on sesiones for update
  using (es_mi_estudiante(estudiante_id) or rol_actual() = 'admin')
  with check (es_mi_estudiante(estudiante_id) or rol_actual() = 'admin');
