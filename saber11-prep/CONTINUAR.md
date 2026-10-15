# Cómo continuar este proyecto desde cualquier PC

Fuente de verdad: el repo **https://github.com/CarlosClaudeTIPS/saber11-prep**, rama `main`. Vercel publica `main` automáticamente en https://saber11-prep.vercel.app en 1-2 minutos. (El repo `mundial-2026-motor` tiene una copia en la carpeta `saber11-prep/` sincronizada por git subtree; si trabajas desde allí, `npm run saber11:push` envía a `main`.)

## Arrancar en el otro PC

Nada depende de un PC anterior ni de una sesión de Claude concreta: todo lo necesario está en este repositorio. Solo se requiere tener instalados Git y Node.js LTS.

```powershell
git clone https://github.com/CarlosClaudeTIPS/saber11-prep.git Saber11
cd Saber11
npm install
npm run dev -- --port 5180      # app en http://localhost:5180 (modo local, datos en el navegador)
npm run demo                    # igual, con usuarios demo (admin/docente/est1…, PIN 1234) en el puerto 5181
```

Para la nube real, copia `.env.example` a `.env.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (ver `INSTALAR-EN-OTRO-PC.md`). Si quieres entrar directo como un usuario local en desarrollo: `VITE_AUTOLOGIN=admin:1234`.

## Qué hay (13-oct-2026)

- **App:** modo carrera (el estudiante elige hasta 3 carreras y la app prioriza materias), banco con letras repartidas, sincronización robusta (un cambio fallido no bloquea la cola; el estado muestra errores en rojo), recarga automática al publicar versión nueva (PWA).
- **Plan de acceso por grupo** (`src/lib/acceso.js`): `completo` (todo el banco) o `mensual` (lotes de 100 por asignatura al mes (500 en total), acumulados desde `plan_inicio`; determinista, sin guardar nada). Se configura en Grupo → Resumen → Plan de acceso. Requiere `supabase/migracion-004-planes.sql` en la nube.
- **Informes de mejoramiento** (`src/lib/informes.js`, pantalla `src/components/Informe.jsx`, ruta `#/informe`): individual (desde el detalle del estudiante o "Mi informe" para el estudiante) y de grupo (botón en el grupo). Puntajes estimados 0-100 por prueba y global 0-500 (ponderación 3-3-3-3-1), niveles de desempeño, percentil nacional (distribución real de `content/referencia-nacional.json`, datos abiertos ICFES 2022, regenerable con `node scripts/referencia-nacional.mjs [periodo]`) y percentil local, aprendizajes por mejorar y fortalezas por afirmación, evolución por simulacro, base seleccionable (toda la práctica, 30 días o una prueba), PDF (imprimir) y CSV.
- **Nube:** migraciones aplicadas hasta `supabase/migracion-003-carreras.sql`; la 004 (planes) hay que ejecutarla en el SQL Editor.
- **Banco:** 995 preguntas aprobadas en `content/banco/` (500 originales + 420 nuevas + 75 oficiales del ICFES explicadas). Convención: `<prueba>-N.json` para lotes propios, `<prueba>-oficial-N.json` para preguntas liberadas del ICFES.
- **Importados pendientes** (`content/importados/`, no se cargan en la app): ~310 preguntas oficiales del ICFES (Matemáticas 2026 y 2021, Inglés 2024 y 2021, cuadernillos 2021 de Sociales, Lectura y Ciencias, guías 2017) que faltan por clasificar y explicar.

## Rendimiento (14-oct-2026)

Auditoría y resultados en `docs/18-auditoria-icfes.md`. El banco ya NO va en el paquete inicial: cada archivo de `content/banco/` es un trozo que se descarga bajo demanda y se vuelca a IndexedDB en segundo plano (`src/lib/banco.js`, `vite.config.js` calcula la huella `__BANCO_VERSION__` y el conteo `__BANCO_CONTEO__`). JS inicial: 612 KB (181 KB gzip); LCP en 4G lento 2,1 s (antes 11,4 s). Guión de medición: `scratchpad/perf.mjs` (Playwright + CDP) — reproducible con `npx vite preview` y un script similar.

## Comandos de calidad del banco

```bash
npm run validar-banco     # esquema, taxonomía, referencias, reparto de letras (falla si algo está mal)
npm run revisar-banco     # heurísticas de calidad por archivo (correcta más larga, letras sueltas, pasos…)
npm run balancear-banco   # reparte la letra correcta cuando es seguro (añade --aplicar para escribir)
```

## Para seguir ampliando el banco

1. Generación de preguntas nuevas: sigue `docs/14-brief-generacion-banco.md` (esquema, reglas, cobertura, flujo por archivo). Ids siguientes: `LC-201`, `MAT-201`, `SOC-201`, `CIE-201`, `ING-201`. Pendiente de la última ronda: `LC-181…200`, `MAT-161…200`, `SOC-181…200`.
2. Material oficial del ICFES: inventario y flujo en `docs/15-fuentes-icfes.md`; importadores en `scripts/importar-icfes*.mjs`. Las preguntas importadas se completan (competencia, explicaciones, siete pasos) y pasan a `content/banco/<prueba>-oficial-N.json` con estado `aprobada`; las que dependen de un gráfico no reconstruible quedan pendientes con etiqueta `sin_estimulo`.
3. Auditoría: en la app (docente → Banco) se filtra por etiquetas `revisar_docente`, `afirmacion_por_verificar`, `revisar_estimulo`, `revisar_clave`; con datos reales, el panel del docente muestra estadísticas por pregunta.

## Pendientes conocidos

- Verificar actividad real de los estudiantes en Supabase (consulta SQL en el historial del proyecto; o token de administración para revisarlo desde Claude).
- Propuestas de auditoría: resolución a ciegas de cada pregunta por un revisor independiente; botón "Reportar esta pregunta" en la práctica.
- Reducir la pista "la correcta es la opción más larga" en los archivos originales (1-6) de Sociales y Ciencias.

Para retomar con Claude en el otro PC basta con abrir la carpeta del repo y pedir: "continúa el banco según CONTINUAR.md".

## Sistema inteligente de acompañamiento (hecho el 14-oct-2026)

Auditoría, plan e informe final en `docs/16-acompanamiento.md`. Resumen de lo que ya está en producción:
- "¿Por qué me equivoqué?" con consejo por razón, "Explícame desde cero" (lecciones sin conexión) y pregunta de verificación NUEVA (`modo: 'verificacion'`).
- Perfil inicial al terminar el diagnóstico (`src/lib/diagnostico.js`).
- Aprendizaje real y constancia en Mi progreso e Informe (`src/lib/aprendizaje.js`).
- "Mi ruta para mejorar": `src/lib/ruta.js` + `src/components/estudiante/RutaMejorar.jsx`; tarjeta "Hoy en mi ruta" en Inicio.
- Guía: sección "Mente y tiempo".
- Pruebas: `tests/acompanamiento.test.js`. Migración opcional: `supabase/migracion-005-ruta.sql`.

Pendientes de ese sistema: notificaciones (falta decidir canal), vista de ruta/aprendizaje en el panel docente. **Decisión: la app no usa inteligencia artificial en ningún componente**; el tutor son las lecciones escritas en `content/lecciones.json`.

## «Mi futuro»: orientación vocacional y proyecto de vida (Etapa 1 hecha el 14-oct-2026)

Auditoría, plan e informe en `docs/17-mi-futuro.md`. Ruta `#/futuro`; lógica en `src/lib/futuro.js`; contenido en `content/futuro/*.json` (fuentes con fecha de verificación: revisarlas cada semestre); pruebas en `tests/futuro.test.js`. Migración opcional `supabase/migracion-006-futuro.sql`. Etapa 2 pendiente: catálogo de programas por ciudad, métricas antes/después. Sin asistente con IA (decisión del proyecto).

Otros pendientes: correr `supabase/migracion-005-ruta.sql`, `migracion-006-futuro.sql` y `migracion-007-intentos-docente.sql` (reenvío de intentos registrados por el docente) (opcional, para que la ruta siga al estudiante entre dispositivos); guía ICFES solo tiene Antioquia y Eje Cafetero (faltan Bogotá, Caribe, Pacífico/sur, Oriente/Llanos; enlaces de `content/guia/*.json` aún sin verificar uno a uno); la migración `supabase/migracion-004-planes.sql` debe correrla Carlos en el SQL Editor de Supabase.

## Roles, revisor y portal (hecho el 15-oct-2026)

- **Roles** (`src/lib/roles.js`): `estudiante`, `docente`, `admin` (el jefe / super admin de la app ICFES) y
  **`revisor`** (admin de solo lectura: ve todos los grupos, estudiantes, estadísticas, banco y biblioteca,
  sin botones de crear/editar/aprobar/borrar). En la nube lo garantizan las políticas RLS de
  `supabase/migracion-008-revisor.sql` (solo `for select`). Para dar revisor a alguien: Administración →
  Usuarios → «Nuevo docente / admin / revisor» (modo local) o, en Supabase, invitar el correo y
  `update perfiles set rol='revisor' where id='<uuid>'`. Usuario demo local: `revisor` / 1234.
- **Banco → vista corrida**: botón de lista en el encabezado del Banco; muestra todas las preguntas seguidas
  y numeradas (1, 2, 3…) con la correcta en verde, casilla «Con explicaciones», «Imprimir», por tandas de 100.
- **Gráficos de las preguntas** (`src/components/Estimulo.jsx`): halo en los números, título del eje en su
  banda, ancho real del contenedor (no se encogen en celular), leyenda numerada para rótulos largos,
  decimales con coma. Prueba `tests/estimulo.test.js` revisa que todo gráfico del banco tenga números válidos.
- **Logo → inicio** y **franja del portal** (`src/components/BarraPortal.jsx`, `src/lib/portal.js`): en la
  portada y el inicio se ven las tres secciones (ICFES · Apoyo docente · Tienda). Si la app vive dentro del
  portal (carpeta `icfes/`), los enlaces son relativos; si no, usa `VITE_PORTAL_URL` (sin ella enlaza a la
  portada del portal de vista previa en claude.ai).

### Super admin en las TRES páginas (pendiente, decisión de arquitectura)
Hoy solo la app ICFES tiene cuentas (Supabase Auth). «Apoyo docente» y «Tienda» son sitios estáticos sin
inicio de sesión (la tienda tiene un `admin.html` que genera archivos, no cuentas). Para un único super
admin y revisores en las tres:
1. Un solo proyecto Supabase para el portal, tabla `perfiles` con `rol` (`admin`, `revisor`, `docente`, …).
2. Cada sección carga la misma sesión (misma `VITE_SUPABASE_URL`/anon key) y muestra su panel según el rol.
3. Para docentes/tienda hay que crear primero lo que se administraría (pedidos, catálogo editable,
   plantillas por docente); hoy no existe en servidor, solo en el navegador.
Estimación: una etapa propia (portal con login + 2 paneles). Mientras tanto, el admin de ICFES ya es el
jefe de esa app y el revisor es la cuenta «solo mirar».

Migraciones pendientes de correr en Supabase (SQL Editor, en orden): 004, 005, 006, 007 y **008**.
