> **Nota (14-oct-2026):** la aplicación no usa inteligencia artificial en ningún componente, por decisión del proyecto. Las menciones a IA en este documento son históricas (diseño inicial) y no se implementarán.

# PARTE 7 — Sistema de contenido

Cómo entra, se clasifica, se valida y se distribuye el material. Fuentes: `content/ESQUEMA-PREGUNTA.md`, `content/taxonomia.json`, `scripts/validar-banco.mjs`, `src/lib/banco.js`, `src/components/docente/Banco.jsx`, `src/components/Biblioteca.jsx`, `src/lib/datos.js`.

## 1. Esquema de pregunta

Un archivo por prueba en `content/banco/` (`lectura_critica.json`, `matematicas.json`, `sociales_ciudadanas.json`, `ciencias_naturales.json`, `ingles.json`), cada uno un arreglo JSON. Claves en español, `snake_case`. Campos y reglas están en PARTE 5 §3 y en `ESQUEMA-PREGUNTA.md`; lo que distingue a este esquema de "un formulario de preguntas":

- **Cada distractor lleva diagnóstico**: `explicacion` (por qué no responde), `tipo_error` (id de la taxonomía), `diagnostico` (`probable` si la opción se construyó para un error concreto; `insuficiente` si puede venir de varias causas) y `razon_frecuente` (frase en primera persona que se ofrece al estudiante como chip). El nivel `confirmado` nunca se escribe en el banco: lo asigna la app cuando el estudiante explica.
- **Explicación en siete pasos** (LEER → COMPRENDER → INTERPRETAR → REPRESENTAR → RAZONAR → RESOLVER → VERIFICAR), más `que_identificar` y `que_revisar`.
- **Refuerzo explícito**: `refuerzo_ids` apunta a otra pregunta del banco de la misma habilidad; el validador exige que exista y que no sea la misma.
- **Estímulos estructurados** (tabla, barras, líneas) como datos, no como imagen: se dibujan en SVG, pesan poco, se imprimen y se pueden leer por programa. `imagen` existe pero se evita en el banco inicial.
- **Textos de Lectura Crítica originales** (120–300 palabras), compartidos entre varias preguntas mediante la etiqueta `texto:LC-T01`.
- **Contextos colombianos y cotidianos**, sin preguntas de memoria pura.

## 2. Taxonomía (`content/taxonomia.json`)

- **Pruebas** (5) con sesión y color. **Competencias** (14) según las guías del ICFES: LC1–LC3, M1–M3, S1–S3, C1–C3, I1–I2. **Componentes** (19): álgebra/geometría/estadística, los tres de Sociales, biología/física/química/CTS, texto continuo/discontinuo, partes 1–7 de Inglés.
- **Habilidades del eje transversal** (7), propias del programa: leer, comprender, interpretar, representar, razonar, resolver, verificar. Cada pregunta declara la que más pesa.
- **Tipos de error** (15): comprensión, interpretación, inferencia, conocimiento, procedimiento, cálculo, lectura de gráfico, lectura de tabla, razonamiento, argumentación, distractor, vocabulario, tiempo, descuido, verificación. Cada uno mapea a un **tipo de práctica** (8): lectura guiada, representación, refuerzo conceptual, ejemplo resuelto, ejercitación, contraste de argumentos, verificación, cronometrada.
- **Niveles de diagnóstico** (3): confirmado, probable, insuficiente.
- La taxonomía es **extensible desde Administración** (`config.taxonomia_extension`, fusionada por id en `aplicarExtension`); hoy la UI solo permite agregar tipos de error.

## 3. Pipeline de contenido (lo que existe)

```
1. Autor escribe/edita JSON en content/banco/      (git: historial y revisión por PR)
        │
2. npm run validar-banco                           (scripts/validar-banco.mjs)
        │  ids únicos · prueba/competencia/componente/habilidad válidos y coherentes
        │  · origen y fuente · 3–4 opciones, una correcta, claves A-D en orden
        │  · distractores con tipo_error y diagnostico · explicación ≥ 40 caracteres
        │  · estímulo bien formado · refuerzo_ids existen · tiempo numérico
        ▼
3. Build empaqueta los JSON (import.meta.glob)  →  sembrarBanco() en cada dispositivo
        │  huella del banco en config.banco_version; respeta editada_local
        ▼
4. Edición en la app (#/banco): nueva · editar JSON · duplicar · aprobar · archivar
        │  estados: borrador → pendiente → aprobada → archivada (→ pendiente al restaurar)
        │  solo `aprobada` llega a los estudiantes (listarPreguntas filtra por defecto)
        ▼
5. Exportar JSON (banco-saber11.json)  →  incorporar al repo  →  volver a 1
```

Validación mínima también en la app al guardar: id, opciones, exactamente una correcta, explicación en cada distractor. El validador del repo es más estricto; por eso el camino recomendado para contenido definitivo es siempre **repo → validador → semilla**.

Trazabilidad por pregunta: `origen`, `fuente {nombre, url, anio}`, `estado`, `editada_local/fecha_edicion`, etiqueta `afirmacion_por_verificar` cuando la afirmación/evidencia citada no pudo cotejarse con la guía oficial (se muestra como badge ámbar en el banco).

## 4. Importación y exportación

- **Importar JSON** (`Banco.jsx → importar`): acepta un objeto o un arreglo; cada pregunta con `id` y `opciones` se guarda con `estado: 'pendiente'` y `origen: 'generada'` si no vienen. Nada importado llega al estudiante sin aprobación.
- **Exportar JSON**: todo el banco local (incluye borradores y archivadas) para revisión externa o para llevarlo al repo.
- **Respaldo completo** (Administración → Datos): todas las tablas en un JSON; la importación fusiona por id.
- No hay CSV ni Excel (sección 50): se prefirió un único formato con validador antes que tres formatos sin él. Es fase 2 (PARTE 10).

## 5. Oficial, estilo, generada (sección 40)

| `origen` | Significado | Exigencias | Cómo se ve |
|---|---|---|---|
| `oficial` | Pregunta liberada por el ICFES | `fuente.url` obligatoria; al duplicar pasa a `estilo` y pierde la URL | Badge verde "Oficial ICFES" |
| `estilo` | Elaboración propia siguiendo la estructura de las guías | `fuente.nombre` | Badge "Estilo Saber 11" |
| `generada` | Importada sin origen declarado | Entra como `pendiente` | Badge ámbar "Sin origen declarado" |

Las 66 preguntas actuales son `estilo`. Regla del esquema: **nunca marcar como oficial lo que no lo es**.

## 6. Biblioteca de recursos

- Cada recurso: `titulo, tipo (enlace|video|pdf|texto|guia), url, descripcion, prueba, habilidades[], tipos_error[], categoria (esencial|refuerzo|opcional), fuente {nombre, institucion, autor, fecha, url}, estado (pendiente|aprobado|rechazado), propuesto_por, aprobado_por, fecha_incorporacion, version`. Es la cadena PRUEBA → HABILIDAD → TIPO DE ERROR de la sección 53 (falta el eslabón TEMA → ACTIVIDADES).
- Flujo: docente propone → `pendiente` → admin/docente aprueba o rechaza → solo `aprobado` es visible al estudiante y elegible por `recursoParaError`. Los recursos iniciales (`demo.js`) nacen `pendiente` a propósito, porque las URL del ICFES cambian.
- Los recursos de tipo `texto` guardan el contenido en `descripcion` (guías internas breves: leer una tabla, lista de chequeo, inferir sin inventar).

## 7. Propiedad intelectual

- **Enlazar, no copiar.** La biblioteca guarda URL y metadatos; la propia UI lo recuerda al proponer. No hay almacenamiento de archivos.
- **Textos propios** en Lectura Crítica; contextos de Sociales/Ciencias redactados para el banco; los datos de tablas y gráficos son ilustrativos y así se declara en el contexto.
- **Preguntas del ICFES**: solo se incorporan como `oficial` con enlace a la fuente y respetando los términos de uso del ICFES documentados en `docs/01-investigacion-saber11.md`; ante la duda, se escribe una pregunta `estilo` con la misma estructura.
- Cada recurso muestra fuente, institución, fecha de incorporación, versión y si fue aprobado (sección 22).

## 8. Fase 2: descubrimiento con aprobación humana (secciones 20–21)

No implementado. Diseño propuesto, compatible con el modelo actual:

1. **Detectar**: tarea programada (Vercel Cron o GitHub Action) que consulta un listado fijo de fuentes (índice de guías del ICFES, cuadernillos liberados, repositorios académicos) y compara con `recursos.url` para no repetir.
2. **Registrar**: crea un `recurso` con `estado: 'pendiente'`, `propuesto_por: 'sistema'`, `fuente` completa y un resumen corto generado por IA **marcado como generado**.
3. **Clasificar**: la IA sugiere `prueba`, `habilidades`, `tipos_error`, `categoria`; se guardan como sugerencia, nunca como verdad.
4. **Aprobar**: la pestaña "pendiente" de la Biblioteca ya es la bandeja de revisión; aprobar exige que un humano verifique el enlace y ajuste la clasificación.
5. Para preguntas: el mismo camino termina en `origen: 'generada'`, `estado: 'pendiente'` y pasa por el validador antes de aprobarse.

Criterio de la sección 39: la IA propone, el docente decide; nunca se publica nada automáticamente ni se oculta el origen.
