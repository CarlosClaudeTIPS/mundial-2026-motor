-- ─── Esquema Supabase — Plataforma Saber 11 ──────────────────────────────────
-- Ejecutar en SQL Editor. Refleja las tablas locales (src/lib/db.js): la app
-- escribe primero en el dispositivo y sincroniza con upsert (src/lib/sync.js).
--
-- Roles: estudiante | docente | admin (columna perfiles.rol).
-- Estudiantes: usuario de Auth con correo sintético <codigo>@estudiantes.saber11.local
-- creado por la función api/estudiantes.js (service role). Docentes/admin: correo real.

create extension if not exists "pgcrypto";

-- Perfiles (uno por usuario de Auth)
create table if not exists perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  rol text not null default 'estudiante' check (rol in ('estudiante','docente','admin')),
  nombre text not null,
  usuario text unique not null,
  grupo_id uuid,
  colegio text,
  curso text,
  ciclo_id text,
  demo boolean default false,
  carreras jsonb default '[]'::jsonb,       -- ids de content/carreras.json (hasta 3)
  modo_carrera boolean default false,       -- prioriza las pruebas que pesan para esas carreras
  carreras_definidas boolean default false, -- ya pasó por la pantalla inicial de carreras
  creado timestamptz default now()
);

create table if not exists grupos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  docente_id uuid references perfiles(id) on delete set null,
  colegio text,
  curso text,
  ciclo_id text,
  codigo text unique,
  plan text not null default 'completo' check (plan in ('completo', 'mensual')), -- acceso al banco (migración 004)
  plan_inicio timestamptz default now(),
  plan_lote int default 100,
  creado timestamptz default now()
);
alter table perfiles add constraint perfiles_grupo_fk foreign key (grupo_id) references grupos(id) on delete set null;

create table if not exists ciclos (
  id text primary key,
  nombre text not null,
  calendario text check (calendario in ('A','B')),
  anio int,
  fecha_inicio date not null,
  fecha_examen date not null,
  fecha_provisional boolean default true,
  semanas int default 24,
  activo boolean default false
);

-- Banco de preguntas (la semilla viene de content/banco/*.json; aquí viven las editadas/creadas)
create table if not exists preguntas (
  id text primary key,
  prueba text not null,
  origen text not null check (origen in ('oficial','estilo','generada')),
  fuente jsonb,
  competencia text not null,
  componente text,
  afirmacion text,
  evidencia text,
  habilidad text not null,
  tema text,
  subtema text,
  dificultad int check (dificultad between 1 and 3),
  contexto text,
  estimulo jsonb,
  enunciado text not null,
  opciones jsonb not null,
  explicacion text,
  que_identificar text,
  que_revisar text,
  refuerzo_ids text[] default '{}',
  recurso_ids text[] default '{}',
  tiempo_sugerido_seg int,
  etiquetas text[] default '{}',
  estado text not null default 'pendiente' check (estado in ('borrador','pendiente','aprobada','archivada')),
  version int default 1,
  editada_por uuid,
  actualizado timestamptz default now()
);

create table if not exists intentos (
  uid uuid primary key,
  estudiante_id uuid not null references perfiles(id) on delete cascade,
  pregunta_id text not null,
  prueba text, competencia text, componente text, habilidad text, dificultad int,
  opcion text,
  correcta boolean not null,
  tiempo_seg int,
  lento boolean,
  tipo_error text,
  diagnostico text,
  razon jsonb,
  modo text,
  sesion_id uuid,
  refuerzo_de uuid,
  vio_explicacion boolean default false,
  fecha timestamptz not null,
  demo boolean default false
);
create index if not exists intentos_estudiante_fecha on intentos (estudiante_id, fecha desc);
create index if not exists intentos_pregunta on intentos (pregunta_id);

create table if not exists sesiones (
  id uuid primary key,
  estudiante_id uuid not null references perfiles(id) on delete cascade,
  tipo text check (tipo in ('mini','simulacro')),
  titulo text,
  config jsonb,
  pregunta_ids text[] not null,
  respuestas jsonb default '{}',
  tiempos jsonb default '{}',
  indice int default 0,
  estado text default 'en_curso',
  fecha_inicio timestamptz,
  fecha_fin timestamptz,
  agotado boolean default false,
  duracion_seg int,
  resultado jsonb,
  asignacion_id uuid
);

create table if not exists asignaciones (
  id uuid primary key,
  grupo_id uuid not null references grupos(id) on delete cascade,
  docente_id uuid references perfiles(id) on delete set null,
  tipo text not null,
  titulo text not null,
  config jsonb default '{}',
  nota text,
  fecha_limite date,
  fecha_creacion timestamptz default now(),
  estado text default 'activa'
);

create table if not exists recursos (
  id text primary key,
  titulo text not null,
  tipo text,
  url text,
  descripcion text,
  prueba text,
  competencia text,
  habilidades text[] default '{}',
  tipos_error text[] default '{}',
  temas text[] default '{}',
  nivel text,
  categoria text default 'refuerzo' check (categoria in ('esencial','refuerzo','opcional')),
  fuente jsonb,
  estado text default 'pendiente' check (estado in ('pendiente','aprobado','rechazado')),
  propuesto_por text,
  aprobado_por uuid,
  fecha_incorporacion timestamptz,
  version int default 1,
  actualizado timestamptz default now()
);

-- Sesiones del docente con el grupo (cada ~21 días): resumen del periodo y notas
create table if not exists sesiones_docente (
  id uuid primary key,
  grupo_id uuid not null references grupos(id) on delete cascade,
  docente_id uuid references perfiles(id) on delete set null,
  fecha date not null,
  titulo text,
  notas text,
  resumen jsonb,
  creada timestamptz default now()
);

-- ─── Funciones auxiliares para RLS ───────────────────────────────────────────
create or replace function rol_actual() returns text language sql stable security definer as $$
  select rol from perfiles where id = auth.uid()
$$;
create or replace function mi_grupo() returns uuid language sql stable security definer as $$
  select grupo_id from perfiles where id = auth.uid()
$$;
create or replace function es_mi_estudiante(est uuid) returns boolean language sql stable security definer as $$
  select exists (
    select 1 from perfiles p join grupos g on g.id = p.grupo_id
    where p.id = est and g.docente_id = auth.uid()
  )
$$;

-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table perfiles enable row level security;
alter table grupos enable row level security;
alter table ciclos enable row level security;
alter table preguntas enable row level security;
alter table intentos enable row level security;
alter table sesiones enable row level security;
alter table asignaciones enable row level security;
alter table recursos enable row level security;
alter table sesiones_docente enable row level security;
create policy sesiones_docente_gestion on sesiones_docente for all using (docente_id = auth.uid() or rol_actual() = 'admin') with check (docente_id = auth.uid() or rol_actual() = 'admin');

-- perfiles: cada quien ve el suyo; el docente ve los de sus grupos; admin todo.
create policy perfiles_leer on perfiles for select using (
  id = auth.uid() or rol_actual() = 'admin' or es_mi_estudiante(id)
);
create policy perfiles_editar_propio on perfiles for update using (id = auth.uid());
create policy perfiles_admin on perfiles for all using (rol_actual() = 'admin');
create policy perfiles_docente_edita_estudiantes on perfiles for update using (es_mi_estudiante(id));
-- El docente inscribe estudiantes de sus propios grupos (la cuenta de Auth se crea con signUp desde su navegador).
create policy perfiles_docente_inserta on perfiles for insert with check (
  rol = 'estudiante' and exists (select 1 from grupos g where g.id = grupo_id and g.docente_id = auth.uid())
);

-- grupos: docente ve/edita los suyos; estudiante ve el suyo; admin todo.
create policy grupos_leer on grupos for select using (
  docente_id = auth.uid() or id = mi_grupo() or rol_actual() = 'admin'
);
create policy grupos_docente on grupos for all using (docente_id = auth.uid() or rol_actual() = 'admin') with check (docente_id = auth.uid() or rol_actual() = 'admin');

-- ciclos: lectura para todos los autenticados; escritura admin.
create policy ciclos_leer on ciclos for select using (auth.uid() is not null);
create policy ciclos_admin on ciclos for all using (rol_actual() = 'admin');

-- preguntas: aprobadas para todos; docente/admin ven todo y editan.
create policy preguntas_leer on preguntas for select using (
  estado = 'aprobada' or rol_actual() in ('docente','admin')
);
create policy preguntas_editar on preguntas for all using (rol_actual() in ('docente','admin')) with check (rol_actual() in ('docente','admin'));

-- intentos: el estudiante escribe/lee los suyos; docente lee los de sus estudiantes; admin todo.
create policy intentos_propios on intentos for all using (estudiante_id = auth.uid()) with check (estudiante_id = auth.uid());
create policy intentos_docente on intentos for select using (es_mi_estudiante(estudiante_id) or rol_actual() = 'admin');
create policy intentos_docente_papel on intentos for insert with check (es_mi_estudiante(estudiante_id) or rol_actual() = 'admin');

-- sesiones: igual que intentos.
create policy sesiones_propias on sesiones for all using (estudiante_id = auth.uid()) with check (estudiante_id = auth.uid());
create policy sesiones_docente on sesiones for select using (es_mi_estudiante(estudiante_id) or rol_actual() = 'admin');

-- asignaciones: docente del grupo crea/edita; estudiantes del grupo leen.
create policy asignaciones_leer on asignaciones for select using (
  grupo_id = mi_grupo() or docente_id = auth.uid() or rol_actual() = 'admin'
);
create policy asignaciones_docente on asignaciones for all using (docente_id = auth.uid() or rol_actual() = 'admin') with check (docente_id = auth.uid() or rol_actual() = 'admin');

-- recursos: aprobados para todos; docente/admin gestionan.
create policy recursos_leer on recursos for select using (estado = 'aprobado' or rol_actual() in ('docente','admin'));
create policy recursos_gestion on recursos for all using (rol_actual() in ('docente','admin')) with check (rol_actual() in ('docente','admin'));

-- ─── Vista de apoyo para el panel docente ────────────────────────────────────
create or replace view resumen_estudiante as
select estudiante_id,
       count(*) as total,
       count(*) filter (where correcta) as aciertos,
       round(100.0 * count(*) filter (where correcta) / nullif(count(*), 0)) as precision,
       max(fecha) as ultimo
from intentos group by estudiante_id;

-- Notas:
--  * Los PIN de estudiantes son la contraseña de Auth; nunca se guardan en perfiles.
--  * Para eliminar una cuenta (habeas data): borrar el usuario en Auth → cascada en perfiles, intentos, sesiones.
--  * Retención sugerida: exportar y borrar intentos de ciclos terminados hace más de 12 meses.

-- Registro de estudiantes con aprobación: ejecutar también supabase/migracion-002-registro.sql
