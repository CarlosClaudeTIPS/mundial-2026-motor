# Documentación — Plataforma de preparación Saber 11°

Índice de los documentos en `docs/`. Cada uno documenta lo que existe en el código a 25-sep-2026; lo que no está construido se marca como pendiente o fase futura.

| Doc | Parte | Contenido |
|---|---|---|
| [01-investigacion-saber11.md](01-investigacion-saber11.md) | 1 | Estructura oficial vigente del examen (pruebas, competencias, sesiones, puntaje), términos de uso del ICFES y fuentes verificadas. |
| [02-programa-6-meses.md](02-programa-6-meses.md) | 2 | Programa pedagógico de 24 semanas en 6 fases: principios con evidencia, eje transversal por prueba, tabla semana a semana, reutilización Calendario B/A, sesiones docentes, riesgos. |
| [03-arquitectura.md](03-arquitectura.md) | 3 | Alternativas tecnológicas, decisión (React + Vite + Dexie local-first, Supabase opcional, Vercel), diagrama, limitaciones offline y de seguridad, despliegue y costos. |
| [04-mvp.md](04-mvp.md) | 4 | Qué se construyó contra los criterios de aceptación (estudiante, docente, admin), cómo correr, usuarios demo, y qué no está. |
| [05-modelo-datos.md](05-modelo-datos.md) | 5 | Tablas Dexie y SQL, campos de pregunta e intento, ER en texto, índices, ids, versionado del banco, RLS, retención y habeas data. |
| [06-ux-ui.md](06-ux-ui.md) | 6 | Mapa de pantallas por rol con rutas hash, flujo detallado de una pregunta, mobile-first, impresión, accesibilidad pendiente. |
| [07-sistema-contenido.md](07-sistema-contenido.md) | 7 | Esquema de pregunta, taxonomía, pipeline JSON → validador → semilla → edición → estados, importación/exportación, oficial/estilo/generada, propiedad intelectual, descubrimiento con aprobación humana (fase 2). |
| [08-retroalimentacion.md](08-retroalimentacion.md) | 8 | Cómo funciona `feedback.js`: bloques, niveles confirmado/probable/insuficiente, razones, recurso, refuerzo; tres ejemplos completos (MAT-001, LC-001, CIE-001). |
| [09-analitica.md](09-analitica.md) | 9 | Métricas por estudiante, grupo y pregunta; reglas de recomendación con umbrales; acciones sugeridas al docente; preguntas a revisar; evolución semanal. |
| [10-roadmap.md](10-roadmap.md) | 10 | Fases 0–5 con prioridad, dependencias, dificultad, riesgos y criterios de éxito; datos necesarios y propuesta simple para el motor adaptativo; cuestionamientos a supuestos del prompt. |
| [11-calendario-y-normativa.md](11-calendario-y-normativa.md) | Anexo | Fechas de aplicación Saber 11 (2025–2027, oficiales y provisionales) y normativa colombiana de datos personales aplicable a menores. |
| [12-evidencia-academica.md](12-evidencia-academica.md) | Anexo | Referencias académicas verificadas que sustentan el programa (práctica distribuida, retroalimentación, metacognición, simulacros). |
| [13-revision-banco.md](13-revision-banco.md) | Anexo | Revisión de calidad de las 120 preguntas del banco: método, tabla por prueba, correcciones aplicadas y dudas marcadas con la etiqueta `revisar`. |

Otros archivos de referencia: `content/ESQUEMA-PREGUNTA.md` (formato de pregunta), `content/taxonomia.json`, `content/estructura-examen.json`, `content/programa.json`, `supabase/schema.sql`, `.env.example`, `INICIAR-SABER11.bat`.
