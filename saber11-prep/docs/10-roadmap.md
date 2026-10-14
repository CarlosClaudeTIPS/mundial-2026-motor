> **Nota (14-oct-2026):** la aplicación no usa inteligencia artificial en ningún componente, por decisión del proyecto. Las menciones a IA en este documento son históricas (diseño inicial) y no se implementarán.

# PARTE 10 — Roadmap

Fases según la sección 55 del prompt. Prioridad: **P1** imprescindible · **P2** importante · **P3** deseable. Dificultad: baja / media / alta para un desarrollador.

## Fase 0 — Investigación y arquitectura ✅ (hecha)

- **Entregado:** docs 01 (estructura del examen), 11 (calendario y normativa), 12 (evidencia académica), 03–10 (este conjunto), `content/taxonomia.json`, `estructura-examen.json`, `programa.json`, `ESQUEMA-PREGUNTA.md`.
- **Riesgo materializado:** el sitio del ICFES devolvía 404 el 25-sep-2026; fechas 2027 y ponderación del puntaje quedan marcadas como provisionales y editables.
- **Criterio de éxito:** cualquier dato oficial de la app señala su fuente y si es provisional. Cumplido.

## Fase 1 — MVP ✅ (construido, con pendientes)

Lo construido está en PARTE 4. Pendientes para cerrar la fase, en orden:

| Tarea | Prioridad | Dificultad | Dependencia |
|---|---|---|---|
| Llamar a `api/estudiantes.js` desde `Grupo.jsx` en modo nube y renombrar `usuarios` → `perfiles` en `sync.js` | P1 | baja | Proyecto Supabase real |
| `recomendar()` debe leer `config.reglas` | P1 | baja | — |
| Sincronizar `preguntas` editadas (agregar a `TABLAS`, incrementar `version`) | P2 | baja | — |
| Marcar `vio_explicacion` cuando se abre la retroalimentación | P2 | baja | — |
| Purgar IndexedDB al cerrar sesión (opción "dispositivo compartido") | P1 | baja | — |
| Ampliar el banco a ≥ 30 preguntas por prueba con al menos 3 de dificultad 3 y 2 oficiales enlazadas por prueba | P1 | media (contenido) | Validador existente |
| Piloto con un grupo real durante 4 semanas | P1 | — | Todo lo anterior |

**Riesgos:** banco pequeño (66) hace repetir preguntas en simulacros; PIN de 4 dígitos; docentes sin tiempo para revisar contenido. **Criterio de éxito:** un grupo real completa 2 mini-pruebas asignadas y el docente toma al menos una decisión (asignación) a partir de "Acciones sugeridas".

## Fase 2 — Biblioteca inteligente

| Funcionalidad | Prioridad | Dificultad | Dependencias | Riesgo |
|---|---|---|---|---|
| Vincular `recurso_ids` de la pregunta y el eslabón TEMA en recursos | P1 | baja | — | — |
| Importación CSV con validador en el navegador (mismo `validar-banco` empaquetado) | P2 | media | — | Contenido mal clasificado |
| "Buscar nuevo material" con lista fija de fuentes y bandeja pendiente (PARTE 7 §8) | P2 | media | Función serverless + cron | Enlaces rotos del ICFES; costo de IA |
| Ingesta asistida por IA de un PDF de preguntas → borradores `generada`/`pendiente` | P3 | alta | Clave de API; revisor humano | Alucinación de claves y fuentes: **nunca** aprobar sin validar |
| Búsqueda semántica sobre preguntas y recursos (`pgvector` en Supabase) | P3 | media | Modo nube | Poca utilidad con < 500 ítems; posponer |

**Criterio de éxito:** cada tipo de error de la taxonomía tiene ≥ 1 recurso aprobado por prueba y `recursoParaError` devuelve algo en el 100 % de los errores.

## Fase 3 — Analítica avanzada

- Índice de discriminación y dificultad empírica por pregunta (requiere ≥ 30 respuestas por ítem), comparación entre grupos, exportación CSV del docente, seguimiento de intervención (precisión antes/después de una asignación usando `asignacion_id` y `refuerzo_de`). P2, dificultad media, depende del volumen de datos de la fase 1.
- Riesgo: leer diferencias pequeñas como tendencias; mitigar mostrando siempre el `n`.
- Criterio de éxito: el docente ve, por asignación, "el grupo pasó de X % a Y % en el tipo de error trabajado".

## Fase 4 — Sistema adaptativo (sección 25)

### Qué datos hacen falta antes

1. ≥ 300 preguntas aprobadas (≥ 50 por prueba, distribuidas en las 3 dificultades) para que "elegir la siguiente" tenga de dónde.
2. ≥ 30 respuestas por pregunta para estimar su dificultad empírica y validar el `tipo_error` de cada distractor (¿los que marcan C de verdad dicen "no comparé"?).
3. ≥ 100 estudiantes con ≥ 80 intentos cada uno, repartidos en al menos 8 semanas, para ver evolución.
4. Tasa de razones registradas (`razon != null`) ≥ 40 % de los errores; sin eso el diagnóstico sigue siendo "probable".
5. Evidencia de fase 3 de que alguna intervención mueve la precisión.

### Propuesta concreta y simple (sin ML pesado)

**Modelo de conocimiento por habilidad con ventana móvil**, calculable en el cliente con los datos que ya existen:

- Para cada estudiante y cada celda (prueba × competencia, y aparte cada habilidad transversal) se mantiene una estimación `dominio ∈ [0,1]` = media ponderada de los últimos 20 intentos de esa celda, con peso por dificultad (1, 1.5, 2) y decaimiento por antigüedad (un intento de hace 6 semanas pesa la mitad).
- Selección de la siguiente pregunta: entre las no vistas, elegir dificultad objetivo `d = 1` si `dominio < 0,4`, `2` si `< 0,7`, `3` si `≥ 0,7`; alternar la celda más débil con una celda aleatoria (80/20) para no encerrar al estudiante en su punto flaco y mantener la práctica variada que pide el programa.
- Hipótesis de dificultad = tipo de error dominante en la celda en los últimos 20; intervención = la práctica asociada en la taxonomía (ya existe); nueva prueba = mini de 8 en esa celda; cambio = diferencia de `dominio` antes/después, mostrada al docente con el `n`.
- Todo sigue siendo explicable en una frase ("te propongo dificultad 2 en Interpretación porque acertaste 6 de los últimos 10"), configurable en Administración y desactivable por grupo.

Dificultad media. Riesgos: sobreajustar a un banco pequeño; que el estudiante perciba que "la app lo castiga"; solución: nunca bajar de dificultad 1 ni ocultar el criterio. Criterio de éxito: en un A/B por grupo, la cohorte adaptativa mejora más en errores por tipo que la de práctica aleatoria, con `n` suficiente.

## Fase 5 — IA avanzada

Solo si la fase 4 demuestra efecto: explicaciones personalizadas generadas a partir de la razón que dio el estudiante (siempre con la explicación del banco como fuente y etiquetadas "generado"), tutor conversacional acotado a la pregunta actual, generación de variantes de preguntas para revisión humana. Prioridad P3, dificultad alta, riesgo principal: costo por estudiante y respuestas incorrectas presentadas con autoridad (sección 39). Criterio de entrada: presupuesto para inferencia y un revisor de contenido con horas asignadas.

## Cuestionamientos a supuestos del prompt (regla 61)

1. **Gamificación / rankings.** No se construyeron ni se recomiendan. La evidencia sobre recompensas externas en aprendizaje es mixta y un ranking en un grupo de 11° tiende a desmotivar a quienes más lo necesitan. Lo que sí motiva y está: ver "superado" en un error y una recomendación con su dato.
2. **YouTube.** Un catálogo de videos exige curaduría continua (enlaces que mueren, canales que cambian) y su efecto en Saber 11 no está demostrado; en cambio, cada video consume datos móviles. Se dejó `tipo: 'video'` en recursos para que un docente enlace uno que ya usa, y nada más. Antes de invertir en filtros de calidad, conviene medir si los estudiantes abren los recursos de texto.
3. **IA de ingesta y "buscar nuevo material".** Su valor depende de que exista un revisor humano con tiempo; sin él produce una bandeja pendiente que nadie vacía. Primero, medir cuántos recursos pendientes revisa el docente real en la fase 1.
4. **Sesiones del docente cada 21 días.** Se implementó como registro liviano (Grupo → Sesiones) que congela el resumen del periodo y las notas; no obliga a crear sesiones y no hay recordatorios automáticos, para no convertir una sugerencia pedagógica en una regla rígida.
5. **API REST propia.** No aporta valor mientras un solo cliente hable con Supabase bajo RLS; se construirá cuando exista otro consumidor (por ejemplo, un sistema del colegio).
6. **Simulacro completo de dos sesiones (9 horas).** Está disponible (sesión 1 → descanso → sesión 2, resultado global), pero con un banco pequeño produce repetición y en celular fuera del aula es poco realista; se recomienda hacerlo a escala o en una jornada organizada por el colegio (sala de informática o papel).
7. **Modelo de datos con 25 entidades.** Se redujo a 9 tablas; `Progress` y `Recommendation` se calculan, no se guardan, lo que evita datos desactualizados y simplifica el habeas data.
8. **Un banco grande pronto.** Mejor 66 preguntas con distractores diagnosticados que 1 000 sin clasificar (sección 56); el cuello de botella es la autoría con calidad, no el software.
