# Saber 11 · Plataforma de preparación

Plataforma web (PWA, móvil primero, con modo sin conexión) para preparar estudiantes de colegio público para la prueba Saber 11° del ICFES: práctica con retroalimentación por distractor, mini-pruebas, simulacros cronometrados por sesión, bitácora de errores, panel del docente con errores frecuentes y acciones sugeridas, y un programa de ~6 meses reutilizable para Calendario B y Calendario A.

Diseño completo en [docs/00-indice.md](docs/00-indice.md). Prompt de origen: *Prompt maestro — Construcción de plataforma web Saber 11°*.

## Stack

- **Frontend:** React 18 + Vite + Tailwind CSS, PWA con `vite-plugin-pwa`.
- **Datos en el dispositivo:** IndexedDB (Dexie). La app funciona completa sin servidor (**modo local**).
- **Nube (opcional):** Supabase (Postgres + Auth + RLS). Ver `supabase/schema.sql` y `api/estudiantes.js` (función Vercel para inscribir estudiantes).
- **Hosting:** Vercel.

## Correr en local

Doble clic en `INICIAR-SABER11.bat` (instala dependencias la primera vez y abre http://localhost:5180), o:

```bash
npm install
npm run dev -- --port 5180
```

Usuarios de demostración (modo local, PIN `1234`): `admin`, `docente`, `est1` … `est6`.

## Contenido

- `content/taxonomia.json` — pruebas, competencias, componentes, habilidades del eje transversal, tipos de error → tipo de práctica.
- `content/estructura-examen.json` — dos sesiones de 4 h 30 min, preguntas por prueba (Guía 2026-2).
- `content/programa.json` — programa de 24 semanas en 6 fases.
- `content/carreras.json` — catálogo de carreras por área con el peso (1-3) de cada prueba. Alimenta el **modo carrera**: al entrar por primera vez el estudiante elige hasta 3 carreras y la app prioriza (orden de materias, práctica enfocada, horas en Mi ruta) sin dejar ninguna prueba por fuera. Se cambia en Inicio → Mi carrera. En nube requiere `supabase/migracion-003-carreras.sql`.
- `content/banco/*.json` — banco de preguntas (esquema en `content/ESQUEMA-PREGUNTA.md`). Cada distractor trae explicación, tipo de error y nivel de diagnóstico.

Importar preguntas: en el panel del docente, Banco → **Importar** admite PDF o texto (cuadernillos del ICFES, guías); detecta preguntas numeradas con opciones A-D y la hoja de respuestas, y las guarda como pendientes. Con la nube y la variable `ANTHROPIC_API_KEY` en Vercel, el botón **Completar con IA** clasifica cada pregunta y escribe las explicaciones de cada opción, y **Generar con IA** redacta preguntas nuevas a partir de un texto (`api/ia-preguntas.js`, modelo `claude-opus-5-5`). Todo queda pendiente hasta que el docente lo apruebe.

Validar el banco:

```bash
npm run validar-banco
```

## Nube (Supabase + Vercel)

**App publicada:** https://saber11-prep.vercel.app (proyecto Supabase `saber11-prep`, región Américas; despliegue automático desde la rama `main`).

Para reproducir la configuración en otro proyecto:

1. Crear proyecto en supabase.com y ejecutar `supabase/schema.sql` en el SQL Editor.
2. Authentication → Sign In / Providers → desactivar **Confirm email** (los estudiantes usan correo sintético + PIN de 6 dígitos y se registran desde el navegador del docente; no hace falta clave secreta).
3. Invitar al docente/admin desde Authentication → Users y crear su fila en `perfiles` (`rol = 'admin'` o `'docente'`).
4. Copiar `.env.example` a `.env.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (clave *publishable*). En Vercel, las mismas dos variables.
5. `api/estudiantes.js` es opcional (alternativa con clave secreta `SUPABASE_SERVICE_ROLE_KEY`, solo en servidor).

Sin estas variables la app queda en modo local: cada navegador guarda sus propios datos (haz respaldos desde Administración → Datos).

## Estructura

```
src/lib/        lógica: db, banco, sesion, datos, pruebas, analitica, reglas, feedback, sync, ciclo
src/components/ pantallas por rol (estudiante/, docente/, admin/) y piezas compartidas
content/        taxonomía, programa, estructura del examen, banco de preguntas
docs/           investigación, programa pedagógico, arquitectura, modelo de datos, roadmap
supabase/       esquema SQL con políticas por rol
api/            funciones de servidor (Vercel)
scripts/        validador del banco
```

## Estado

App publicada (29-sep-2026) con 500 preguntas explicadas: 100 por materia. Fechas del examen 2027 **provisionales** hasta que el ICFES publique el cronograma; se editan en Administración → Ciclos. Ver `docs/04-mvp.md` para el detalle de lo hecho y lo pendiente.
