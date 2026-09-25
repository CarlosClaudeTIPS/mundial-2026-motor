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
- `content/banco/*.json` — banco de preguntas (esquema en `content/ESQUEMA-PREGUNTA.md`). Cada distractor trae explicación, tipo de error y nivel de diagnóstico.

Validar el banco:

```bash
npm run validar-banco
```

## Supabase (opcional)

1. Crear proyecto en supabase.com y ejecutar `supabase/schema.sql` en el SQL Editor.
2. Copiar `.env.example` a `.env.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. En Vercel, agregar además `SUPABASE_SERVICE_ROLE_KEY` (solo servidor) para `api/estudiantes.js`.
4. Crear la cuenta del docente en Auth y su fila en `perfiles` con `rol = 'docente'`.

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

MVP funcional en modo local (25-sep-2026). Fechas del examen 2027 **provisionales** hasta que el ICFES publique el cronograma; se editan en Administración → Ciclos. Ver `docs/04-mvp.md` para el detalle de lo hecho y lo pendiente.
