# PARTE 5 — Modelo de datos

Fuentes: `src/lib/db.js` (Dexie, versión 1), `supabase/schema.sql`, `content/ESQUEMA-PREGUNTA.md`. El modelo es el mismo en el dispositivo y en la nube; las diferencias se anotan.

## 1. Entidades

Frente a la lista de la sección 44 del prompt, el modelo real fusiona entidades que no necesitan tabla propia: `User/Student/Teacher` → `usuarios`/`perfiles` con `rol`; `School/Course` → columnas `colegio`/`curso`; `Option` → arreglo `opciones` dentro de la pregunta; `Answer/Attempt/Error` → un solo `intento` (el error es un intento con `correcta = false` y `tipo_error`); `Skill/Competency/Evidence/Assertion/Topic` → taxonomía en JSON + columnas de la pregunta; `Video/Source` → `recursos` con `tipo` y `fuente`; `MiniTest/MockExam` → `sesiones` con `tipo`; `Progress/Recommendation` → **calculados** por `analitica.js` y `reglas.js`, no persistidos.

| Tabla | Clave | Índices Dexie | Propósito |
|---|---|---|---|
| `preguntas` | `id` (texto, p. ej. `MAT-001`) | `prueba, competencia, habilidad, componente, dificultad, estado, origen, *etiquetas` | Banco: semilla del repo + editadas/creadas en la app |
| `intentos` | `uid` (uuid) | `estudiante_id, pregunta_id, fecha, sesion_id, sincronizado, [estudiante_id+pregunta_id], [estudiante_id+fecha]` | Cada respuesta enviada (práctica, mini, simulacro, papel) |
| `usuarios` (SQL: `perfiles`) | `id` (uuid) | `rol, usuario, grupo_id` | Estudiantes, docentes, admin. Estudiante: `carreras` (ids de `content/carreras.json`, máx. 3), `modo_carrera`, `carreras_definidas`; en nube se guardan con la función `guardar_carreras` (migración 003) |
| `grupos` | `id` | `docente_id, codigo` | Curso de un docente |
| `asignaciones` | `id` | `grupo_id, tipo, fecha_creacion` | Tarea del docente al grupo (mini o simulacro) |
| `sesiones` | `id` | `estudiante_id, tipo, estado, fecha_inicio, asignacion_id` | Una mini-prueba o simulacro en curso o terminado |
| `recursos` | `id` | `prueba, estado, tipo, *habilidades, *tipos_error` | Biblioteca |
| `ciclos` | `id` (`saber11-B-2027`) | `calendario` | Preparación hacia una fecha de examen |
| `config` | `clave` | — | Valores sueltos: `banco_version`, `sesion_usuario_id`, `taxonomia_extension`, `programa`, `estructura_examen`, `reglas`, `papel:P-…` |
| `cola` (solo local) | `++id` | `tabla, fecha` | Cambios pendientes de subir |

## 2. Diagrama ER (texto)

```
ciclos 1 ──< grupos (ciclo_id)          ciclos 1 ──< usuarios (ciclo_id)
usuarios(docente) 1 ──< grupos (docente_id)
grupos 1 ──< usuarios(estudiante) (grupo_id)
grupos 1 ──< asignaciones (grupo_id) >── 1 usuarios(docente) (docente_id)
usuarios(estudiante) 1 ──< sesiones (estudiante_id) >── 0..1 asignaciones (asignacion_id)
usuarios(estudiante) 1 ──< intentos (estudiante_id)
preguntas 1 ──< intentos (pregunta_id)
sesiones 1 ──< intentos (sesion_id)            intentos 0..1 ──< intentos (refuerzo_de)
preguntas ──< preguntas (refuerzo_ids[])       preguntas ──< recursos (recurso_ids[], no usado aún)
recursos: etiquetado por prueba, habilidades[], tipos_error[] (ids de taxonomia.json)
```

## 3. Campos de una pregunta

Definidos en `content/ESQUEMA-PREGUNTA.md` y validados por `scripts/validar-banco.mjs`:

- Identidad y trazabilidad: `id`, `prueba`, `origen` (`oficial | estilo | generada`), `fuente {nombre, url, anio}` (una `oficial` exige `url`), `estado` (`borrador | pendiente | aprobada | archivada`), `version`, `editada_por`, `actualizado` (SQL); en local además `semilla`, `fecha_carga`, `editada_local`, `fecha_edicion`.
- Clasificación: `competencia`, `componente`, `afirmacion`, `evidencia`, `habilidad` (una de las 7 del eje transversal), `tema`, `subtema`, `dificultad` (1–3), `etiquetas[]`.
- Contenido: `contexto` (Markdown mínimo), `estimulo` (`null | tabla | barras | lineas | imagen`), `enunciado`, `opciones[]` de 3–4 con `{clave, texto, correcta, explicacion, tipo_error, diagnostico, razon_frecuente}`; exactamente una correcta; cada distractor con `tipo_error` de la taxonomía y `diagnostico ∈ {probable, insuficiente}`.
- Retroalimentación: `explicacion` (paso a paso LEER → VERIFICAR), `que_identificar`, `que_revisar`, `refuerzo_ids[]`, `recurso_ids[]`, `tiempo_sugerido_seg`.

## 4. Campos de un intento

Creado en `registrarIntento` (`datos.js`):

`uid`, `estudiante_id`, `pregunta_id`, copia desnormalizada de `prueba, competencia, componente, habilidad, dificultad` (para agregar sin unir tablas y para que el análisis sobreviva a ediciones de la pregunta), `opcion` (letra o `null` si no respondió), `correcta`, `tiempo_seg`, `lento` (> 1,6 × tiempo sugerido), `tipo_error`, `diagnostico` (`confirmado | probable | insuficiente | null`), `razon {id, texto, tipo_error}` (lo que dijo el estudiante), `modo` (`practica | refuerzo | mini | simulacro | papel`), `sesion_id`, `refuerzo_de` (uid del intento fallido que originó este refuerzo), `vio_explicacion`, `fecha`, `sincronizado`, `demo`.

Una `sesion` guarda además `pregunta_ids[]`, `respuestas {pregunta_id: letra}`, `tiempos {pregunta_id: seg}`, `indice`, `config` (cantidad, tiempo, filtros o bloques/escala/faltantes del simulacro), `resultado` (salida de `resumen()`), `agotado`, `duracion_seg`.

## 5. Estrategia de identificadores

- **Preguntas:** ids legibles por prueba (`LC-001`, `MAT-013`, `ING-014`) escritos a mano en el repo; nuevas en la app: `NUEVA-<base36>`; duplicadas: `<id>-copia-<base36>`. Son texto para poder referenciarlas en `refuerzo_ids` y en material impreso.
- **Todo lo demás:** UUID v4 generado **en el dispositivo** (`crypto.randomUUID` con respaldo). Así un registro creado sin conexión ya tiene su clave definitiva y el `upsert` en la nube es idempotente: reenviar no duplica.
- **Ciclos:** `saber11-<calendario>-<año>`; **grupos** llevan además un `codigo` corto de 6 caracteres sin ambigüedades (sin 0/O, 1/I) para dictarlo en clase.
- **Pruebas en papel:** `P-<base36 del timestamp>`.

## 6. Versionado del banco

1. `sembrarBanco()` concatena todos los JSON, calcula una **huella** (hash de 32 bits, tipo Java `hashCode`) y la compara con `config.banco_version`. Si coincide no toca nada; si cambia, hace `put` de cada pregunta **excepto** las que tienen `editada_local: true`.
2. `guardarPregunta()` marca `editada_local` y `fecha_edicion`; esas preguntas quedan protegidas de futuras semillas hasta que se exporten y se incorporen al repo (flujo en PARTE 7).
3. En SQL, `version` y `editada_por` existen pero la app aún no los incrementa (no hay sync de preguntas). Los recursos sí incrementan `version` en cada cambio de estado.

## 7. Políticas RLS (resumen de `schema.sql`)

Funciones auxiliares `security definer`: `rol_actual()`, `mi_grupo()`, `es_mi_estudiante(uuid)`.

| Tabla | Lectura | Escritura |
|---|---|---|
| perfiles | el propio, los estudiantes de mis grupos, admin todo | propio (update); docente actualiza a sus estudiantes; admin todo |
| grupos | docente dueño, estudiante de ese grupo, admin | docente dueño o admin |
| ciclos | cualquier autenticado | admin |
| preguntas | `aprobada` para todos; docente/admin todas | docente/admin |
| intentos, sesiones | propios; docente los de sus estudiantes; admin | propios; docente puede **insertar** intentos de sus estudiantes (modo papel) |
| asignaciones | estudiantes del grupo, docente dueño, admin | docente dueño o admin |
| recursos | `aprobado` para todos; docente/admin todo | docente/admin |

Vista `resumen_estudiante` (total, aciertos, precisión, último intento) como apoyo al panel. Índices SQL: `intentos (estudiante_id, fecha desc)` y `intentos (pregunta_id)`.

## 8. Retención y borrado (habeas data, Ley 1581 de 2012; ver docs/11)

- **Minimización:** solo nombre, usuario, curso, colegio, ciclo y resultados. Sin correo real, documento, fecha de nacimiento ni foto de estudiantes; el "correo" de Auth es sintético.
- **PIN:** en local se guarda solo el hash; en nube es la contraseña de Auth y `perfiles` nunca lo almacena (`aFilaNube` lo elimina).
- **Borrado de cuenta:** en local, Administración → Usuarios → Eliminar borra `intentos`, `sesiones` y el usuario. En nube, borrar el usuario en Auth cascada a `perfiles`, `intentos` y `sesiones` (`on delete cascade`); `grupos.docente_id` y `asignaciones.docente_id` quedan en `null`.
- **Retención sugerida** (nota en `schema.sql`): exportar y borrar los intentos de ciclos terminados hace más de 12 meses. La exportación JSON de Administración → Datos permite entregar al titular o al colegio una copia antes de borrar.
- **Datos demo** marcados con `demo: true` y borrables en bloque.
- **Pendiente:** aviso de tratamiento de datos y autorización del representante legal (documento, no código), y purga de IndexedDB al cerrar sesión en equipos compartidos.
