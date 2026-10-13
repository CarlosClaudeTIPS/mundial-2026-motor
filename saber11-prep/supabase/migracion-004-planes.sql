-- ─── Migración 004: plan de acceso al banco por grupo ────────────────────────
-- Ejecutar una vez en el SQL Editor de Supabase (después de migracion-003).
--
-- plan: 'completo' (todo el banco) o 'mensual' (plan_lote preguntas POR ASIGNATURA
-- cada mes desde plan_inicio, acumulando; 100 → 500 en total por mes). Lo calcula la app; aquí solo se guarda.
alter table grupos add column if not exists plan text not null default 'completo'
  check (plan in ('completo', 'mensual'));
alter table grupos add column if not exists plan_inicio timestamptz default now();
alter table grupos add column if not exists plan_lote int default 100;
