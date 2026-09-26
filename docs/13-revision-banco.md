# 13 · Revisión del banco de preguntas (control de calidad)

Revisión pregunta por pregunta de `content/banco/*.json` realizada el 25-sep-2026. Se excluyó `sociales_ciudadanas-2.json` porque estaba en redacción por otro proceso en el mismo momento; debe revisarse con este mismo método cuando esté cerrado.

## 1. Método

Cada pregunta se leyó completa (contexto, estímulo, enunciado, cuatro opciones con sus explicaciones, explicación paso a paso, `que_identificar`, `que_revisar`, `refuerzo_ids`, `etiquetas`) y se verificó contra `content/ESQUEMA-PREGUNTA.md` y `content/taxonomia.json`. Criterios aplicados:

1. **Clave única y correcta.** En Matemáticas y Ciencias se recalculó toda la aritmética a mano (promedios, medianas, porcentajes, descuentos sucesivos, áreas, volúmenes, conversiones, densidades, periodos del péndulo con T = 2π√(L/g), corrientes por ley de Ohm, estequiometría NaHCO₃ → CO₂, totales de tablas). En Ciencias y Sociales se comprobaron los hechos científicos, históricos y normativos (punto de ebullición en Bogotá, norma colombiana de agua potable, fechas del proceso constituyente de 1990-1991, artículos 23, 86, 88 y 103 de la Constitución). En Lectura Crítica e Inglés se confirmó que el texto sustenta la clave y que ningún distractor sea también defendible.
2. **Claridad del enunciado**, sin ambigüedades.
3. **Coherencia de los datos del estímulo** (tablas, gráficos) con el texto y con la clave: se sumaron totales, se recomputaron porcentajes y diferencias.
4. **Explicación de cada distractor**: que describa un error real y plausible.
5. **Uso de `diagnostico`**: `probable` solo cuando la opción se construyó para un error específico; `insuficiente` cuando puede provenir de varias causas.
6. **`refuerzo_ids`**: que apunte a una pregunta realmente similar (mismo tema o subhabilidad).
7. **Lenguaje**: ortografía, concordancia; inglés natural en Inglés.

Además se corrieron comprobaciones automáticas: unicidad de ids, referencias de refuerzo dentro de la misma prueba, proporción `probable`/`insuficiente`, dobles espacios y puntuación anómala, y `node scripts/validar-banco.mjs` al final.

**Reglas de acción.** Los errores claros se corrigieron directamente en el JSON con el mínimo cambio y sin tocar ids. Las dudas u opiniones no se corrigieron: se añadió la etiqueta `revisar` a la pregunta y se registran abajo.

## 2. Resumen por prueba

| Prueba | Archivos | Revisadas | Corregidas | Marcadas `revisar` |
|---|---|---|---|---|
| Matemáticas | `matematicas.json`, `matematicas-2.json` | 28 | 3 (MAT-005, MAT-010, MAT-011: refuerzo) | 1 (MAT-016) |
| Ciencias Naturales | `ciencias_naturales.json`, `ciencias_naturales-2.json` | 24 | 3 (CIE-001, CIE-003, CIE-004: refuerzo) | 0 |
| Lectura Crítica | `lectura_critica.json`, `lectura_critica-2.json` | 28 | 4 (LC-002, LC-007, LC-011, LC-014: refuerzo) | 0 |
| Sociales y Ciudadanas | `sociales_ciudadanas.json` | 12 | 0 | 0 |
| Inglés | `ingles.json`, `ingles-2.json` | 28 | 1 (ING-008: lenguaje) | 0 |
| **Total** | 9 archivos | **120** | **11** | **1** |

Resultado global: **ninguna clave incorrecta, ningún error aritmético, ningún dato científico o histórico falso, ninguna tabla incoherente y ningún caso de dos opciones correctas.** Las correcciones son de referencia cruzada (`refuerzo_ids`) y una de lenguaje. `node scripts/validar-banco.mjs` termina en 0 errores (120 preguntas).

## 3. Correcciones aplicadas (detalle)

### 3.1 Lenguaje

| Id | Qué estaba mal | Qué se cambió |
|---|---|---|
| ING-008 | El texto decía "a farm **near** Boyacá". Boyacá es un departamento, no una localidad; "near Boyacá" sugiere que es un pueblo y no es inglés natural. | `contexto`: "a farm **in** Boyacá". |

### 3.2 `refuerzo_ids` desactualizados

Las referencias de refuerzo de los archivos de primera generación (`matematicas.json`, `ciencias_naturales.json`, `lectura_critica.json`) se escribieron cuando solo existían 14 (o 12) preguntas por prueba, así que varias apuntaban a la única pregunta disponible aunque fuera de otro tema. Con los archivos `-2` ya existe una pregunta del mismo subtema. La plataforma usa el **primer** id del arreglo como pregunta de refuerzo (`src/components/Retro.jsx`), por lo que se antepuso la referencia adecuada y, salvo en dos casos claramente ajenos, se conservó la anterior.

| Id | Qué estaba mal | Qué se cambió |
|---|---|---|
| MAT-005 (probabilidad simple con gráfico) | Refuerzo `MAT-002` (porcentaje a partir de tabla). | `["MAT-025", "MAT-002"]` — MAT-025 es probabilidad simple con tabla. |
| MAT-010 (descuentos sucesivos) | Refuerzo `MAT-002` (porcentaje simple). | `["MAT-018", "MAT-002"]` — MAT-018 es aumentos sucesivos (mismo concepto, ya apuntaba de vuelta a MAT-010). |
| MAT-011 (escala de un plano) | Refuerzo `MAT-014` (área y baldosas). | `["MAT-020", "MAT-014"]` — MAT-020 es escala de un mapa. |
| CIE-001 (respuesta circulatoria/respiratoria al ejercicio) | Refuerzo `CIE-008` (memoria inmunológica). | `["CIE-017", "CIE-008"]` — CIE-017 es flujo sanguíneo durante el ejercicio. |
| CIE-003 (mezclas y filtración) | Refuerzo `CIE-007` (oxidación del hierro). | `["CIE-023", "CIE-007"]` — CIE-023 es separación de mezclas (ya apuntaba de vuelta a CIE-003). |
| CIE-004 (energía en el hogar) | Refuerzo `CIE-012` (correlación lluvia-dengue). | `["CIE-020", "CIE-012"]` — CIE-020 es transformaciones de energía (ya apuntaba a CIE-004). |
| LC-002 (inferir la motivación de un personaje, cuento) | Refuerzo `LC-014` (función de la nota de una tabla en un afiche): sin relación. | `["LC-017"]` — función del párrafo final en un microrrelato (literario, LC2, interpretar). |
| LC-014 (nota de una tabla, afiche) | Refuerzo `LC-002` (cuento): sin relación. | `["LC-013"]` — síntesis de la misma tabla del afiche (texto discontinuo, LC2). |
| LC-007 (implicaciones de un enunciado) | Refuerzo `LC-011` (evaluar la validez de un argumento). | `["LC-021", "LC-011"]` — LC-021 es exactamente "implicaciones de un enunciado" (ya apuntaba a LC-007). |
| LC-011 (evaluar la validez de un argumento) | Refuerzo `LC-007` (implicaciones). | `["LC-024", "LC-007"]` — LC-024 es "evaluación de la validez de un argumento" (ya apuntaba a LC-011). |

## 4. Dudas marcadas con `revisar`

| Id | Motivo | Sugerencia |
|---|---|---|
| MAT-016 | El enunciado dice "Si x representa el número de arepas vendidas **y y** el número de jugos vendidos…". Es gramaticalmente correcto (conjunción + variable *y*), pero en pantalla se lee como una errata y puede confundir; las opciones usan dobles espacios (`x + y = 45  y  3.000x…`) para separar la conjunción de las ecuaciones, lo que depende del renderizado. | Distinguir las variables tipográficamente (`**x**`, `**y**` en negrita, como ya hace MAT-009 con **x**), de modo que se lea "…vendidas y **y** el número de jugos…", y separar las dos ecuaciones de cada opción con punto y coma en lugar de dobles espacios. |

## 5. Observaciones sin acción (no afectan la validez)

- **MAT-020.** En el mapa ficticio, Tunja–Villa de Leyva miden 6 cm a 1:500.000 (30 km). La distancia real en línea recta es de unos 21 km (por carretera ~37 km). Como el dato es del mapa del ejercicio y la pregunta es de conversión, no se cambió; si se quiere realismo, usar 4 cm (20 km).
- **CIE-002.** La gráfica de calentamiento es didáctica: la meseta de fusión (min 1-3) y la pendiente del agua líquida (≈30 °C/min) no guardan la proporción exacta de calores latente y específico, pero la pregunta solo exige interpretar la meseta a 92 °C, que es correcta para Bogotá.
- **Inglés, `refuerzo_ids`.** Todas las referencias apuntan a la misma parte y nivel, así que se dejaron. Si se quiere afinar: ING-001→ING-017, ING-002→ING-018, ING-005→ING-019, ING-006→ING-020, ING-009→ING-023, ING-010→ING-025, ING-012→ING-026, ING-013→ING-021, ING-014→ING-022 (mismo subtema en el archivo `-2`).
- **`diagnostico`.** Proporción global 267 `probable` / 73 `insuficiente` (79 %). Se revisó caso por caso: cada distractor marcado `probable` tiene una ruta de error concreta descrita en `explicacion` y `razon_frecuente` (una operación equivocada, un dato mal leído, un falso cognado). Los `insuficiente` corresponden a opciones que admiten varias causas o respuesta al azar. No se detectó sobreuso que justifique cambios.
- **Etiqueta `afirmacion_por_verificar`.** Está en casi todas las preguntas de estilo; es una marca del proceso de generación, no un hallazgo de esta revisión.
- **`sociales_ciudadanas-2.json`** queda pendiente de revisar con este método.

## 6. Verificación final

```
node scripts/validar-banco.mjs
Preguntas por prueba: { ciencias_naturales: 24, ingles: 28, lectura_critica: 28, matematicas: 28, sociales_ciudadanas: 12 } · total: 120
Banco válido ✔
```
