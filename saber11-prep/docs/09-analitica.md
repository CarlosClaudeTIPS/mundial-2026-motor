# PARTE 9 — Analítica

Funciones puras en `src/lib/analitica.js` y `src/lib/reglas.js`: reciben intentos (y el mapa de preguntas) y devuelven objetos que las pantallas dibujan. Nada se precalcula ni se guarda; con decenas de miles de intentos en IndexedDB sigue siendo instantáneo en el cliente. Umbrales tal como están en el código.

## 1. Métricas por estudiante — `resumen(intentos, preguntasPorId)`

| Métrica | Cálculo |
|---|---|
| `total`, `aciertos`, `errores`, `precision` | conteo y `round(aciertos/total × 100)` |
| `sin_responder` | intentos con `opcion == null` |
| `tiempo_total_seg`, `tiempo_prom_seg` | sobre intentos con tiempo (papel no tiene) |
| `por_prueba`, `por_competencia`, `por_habilidad` | `porClave`: total, aciertos, precisión, tiempo promedio por valor |
| `por_tipo_error` | conteo y % sobre errores, con la práctica asociada, ordenado desc |
| `fortalezas` | competencias con ≥ 3 intentos y precisión ≥ 75 % |
| `dificultades` | competencias con ≥ 3 intentos y precisión < 50 % |

Se usa en Mi progreso, en el detalle del estudiante para el docente y como `resultado` de cada sesión de prueba.

**Evolución semanal** — `evolucionSemanal(intentos)`: agrupa por lunes de la semana (fecha local), devuelve `{semana, total, aciertos, precision}` ordenado; la UI muestra las últimas 12 como barras. Es precisión bruta: no controla por dificultad ni por prueba, por eso conviene leerla junto con `por_prueba`.

## 2. Métricas por grupo — `resumenGrupo(miembros, intentos, preguntasPorId)`

- `porEstudiante`: resumen individual + fecha del último intento; `n_activos` = con ≥ 1 intento; `promedio` = media de precisiones de los activos (no ponderada por número de intentos).
- `erroresFrecuentes`: por tipo de error, **número y % de estudiantes activos con ≥ 2 errores de ese tipo** (no el número bruto de errores, para que un estudiante muy activo no domine), más el total de errores y la práctica asociada.
- `competencias`, `habilidades` ordenadas de más débil a más fuerte; `pruebas`.
- `conDificultad`: ≥ 8 intentos y precisión < 50 %. `inactivos`: 0 intentos.
- `acciones`: ver §4.

## 3. Métricas por pregunta — `estadisticasPreguntas(intentos, preguntasPorId)`

Por pregunta: `total`, `aciertos`, `precision`, distribución de `opciones`, `distractor` más elegido (la opción incorrecta con más marcas), `tiempo_prom`. **Alertas "Revisar pregunta"** (sección 38 del prompt):

| Alerta | Condición |
|---|---|
| Muy pocos aciertos | ≥ 10 respuestas y precisión < 20 % |
| Dos opciones casi igual de elegidas | ≥ 10 respuestas y la diferencia entre las dos más marcadas ≤ max(1, 5 % del total) |
| Tiempo muy alto | ≥ 5 respuestas con tiempo y promedio > 2,5 × `tiempo_sugerido_seg` |

Se muestran en la pestaña Preguntas del grupo, ordenadas por precisión ascendente. No hay todavía índice de discriminación (correlación acierto/precisión global) ni agregación entre grupos: llegan en fase 3 (PARTE 10).

## 4. Acciones sugeridas al docente — `accionesSugeridas`

Cada acción tiene `titulo`, **`dato`** (un hecho contado), **`sugerencia`** (texto por reglas) y, cuando aplica, `accion` (una mini-prueba preconfigurada que el docente puede asignar con un clic) o `estudiantes`. La pantalla los rotula "Dato observado" y "Sugerencia (reglas)" y aclara que la decisión es del docente; esta separación es la respuesta a la sección 39 ("IA como asistente, no como autoridad").

| Regla | Condición | Acción propuesta |
|---|---|---|
| Pocos datos | < 3 estudiantes activos | Mini diagnóstica de 10 preguntas / 20 min (y no evalúa las demás reglas) |
| Error frecuente | Hasta 3 tipos con ≥ 40 % de activos con ≥ 2 errores | Mini de 8 / 16 min filtrada por ese `tipo_error` + práctica asociada en clase |
| Competencia débil | Primera con ≥ 10 respuestas y < 50 % | Mini de 8 filtrada por competencia + lectura guiada |
| Habilidad débil | Primera con ≥ 10 respuestas y < 50 % | Mini de 8 filtrada por habilidad; trabajarla dentro de cada área |
| Estudiantes con dificultad | ≥ 8 intentos y < 50 % | Revisar su bitácora; práctica de dificultad 1 en su prueba más débil |
| Sin actividad | 0 intentos | Verificar usuario/PIN o usar modo papel |

## 5. Reglas de recomendación al estudiante — `recomendar(intentos, { reglas, preguntasPorId })`

`REGLAS_POR_DEFECTO` (editables en Administración → Reglas, aunque hoy el motor sigue leyendo los valores por defecto del código). Los intentos se ordenan del más reciente al más antiguo; cada recomendación trae `dato` con la evidencia y `accion` ejecutable (`lanzarAccion` en `Inicio.jsx`).

| id | Condición | Recomendación → acción | Prioridad |
|---|---|---|---|
| `error_repetido` | En los últimos 30 intentos, ≥ 3 errores del mismo `tipo_error` (excluye `tiempo`) | Práctica asociada a ese error → 5 preguntas filtradas por `tipo_error` | 1,1–1,7 (más errores, más prioridad) |
| `sin_verificar` | ≥ 2 errores por `descuido` o `verificacion` en los últimos 30 | Lista de chequeo → 5 preguntas con `verificacion=1` | 1,5 |
| `prueba_debil` | Alguna prueba con ≥ 6 intentos y precisión < 50 % | Lectura guiada → 5 preguntas de esa prueba, dificultad 1 | 2 + precisión |
| `habilidad_debil` | Alguna habilidad con ≥ 6 intentos y < 50 % | Representación → 5 preguntas de esa habilidad | 2,5 + precisión |
| `lento_pero_bien` | ≥ 8 aciertos con tiempo, precisión global ≥ 70 % y ≥ 50 % de los aciertos `lento` | Práctica cronometrada → mini de 8 con tiempo 1,5 min/pregunta | 3 |
| `refuerzo_pendiente` | Hay preguntas falladas cuyo `refuerzo_ids` no se ha intentado | Ejercitación → hasta 5 ids de refuerzo | 4 |
| `inicio` | Ninguna anterior | "Empieza/Sigue con práctica variada" → 5 preguntas | 9 |

Se devuelven ordenadas por prioridad y con el nombre y la descripción del tipo de práctica. Inicio muestra 2, Mi progreso 3, el docente ve 3 en el detalle del estudiante. Corresponde a los ejemplos de la sección 26 del prompt: 3 fallos del mismo tipo → recurso + 5 preguntas; alto porcentaje pero tiempo excesivo → cronometrada.

## 6. Lo que la analítica **no** hace todavía

- No pondera por dificultad ni estima habilidad latente: una precisión del 60 % en dificultad 3 vale igual que en dificultad 1.
- No mide el efecto de una intervención (¿mejoró tras la mini-prueba asignada?); `refuerzo_de` y `asignacion_id` ya guardan el vínculo necesario.
- No usa `vio_explicacion` (se marca al mostrar la retroalimentación) ni mide el tiempo de lectura de la explicación.
- No compara grupos ni colegios; la vista SQL `resumen_estudiante` es el único agregado en servidor.
- Los umbrales son fijos y pensados para grupos de 20–40; con 6 usuarios demo, "40 % de activos" son 2–3 estudiantes.
