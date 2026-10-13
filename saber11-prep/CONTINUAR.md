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
- **Plan de acceso por grupo** (`src/lib/acceso.js`): `completo` (todo el banco) o `mensual` (lotes de 100, 20 por prueba, acumulados desde `plan_inicio`; determinista, sin guardar nada). Se configura en Grupo → Resumen → Plan de acceso. Requiere `supabase/migracion-004-planes.sql` en la nube.
- **Informes de mejoramiento** (`src/lib/informes.js`, pantalla `src/components/Informe.jsx`, ruta `#/informe`): individual (desde el detalle del estudiante o "Mi informe" para el estudiante) y de grupo (botón en el grupo). Puntajes estimados 0-100 por prueba y global 0-500 (ponderación 3-3-3-3-1), niveles de desempeño, percentil nacional (distribución real de `content/referencia-nacional.json`, datos abiertos ICFES 2022, regenerable con `node scripts/referencia-nacional.mjs [periodo]`) y percentil local, aprendizajes por mejorar y fortalezas por afirmación, evolución por simulacro, base seleccionable (toda la práctica, 30 días o una prueba), PDF (imprimir) y CSV.
- **Nube:** migraciones aplicadas hasta `supabase/migracion-003-carreras.sql`; la 004 (planes) hay que ejecutarla en el SQL Editor.
- **Banco:** 995 preguntas aprobadas en `content/banco/` (500 originales + 420 nuevas + 75 oficiales del ICFES explicadas). Convención: `<prueba>-N.json` para lotes propios, `<prueba>-oficial-N.json` para preguntas liberadas del ICFES.
- **Importados pendientes** (`content/importados/`, no se cargan en la app): ~310 preguntas oficiales del ICFES (Matemáticas 2026 y 2021, Inglés 2024 y 2021, cuadernillos 2021 de Sociales, Lectura y Ciencias, guías 2017) que faltan por clasificar y explicar.

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
