# Brief para generar preguntas nuevas del banco

Este documento es la instrucción completa para producir un lote de preguntas de una prueba. Léelo entero antes de escribir la primera pregunta.

## Objetivo

100 preguntas nuevas por prueba, originales, estilo Saber 11, con el esquema exacto de `content/ESQUEMA-PREGUNTA.md`, validadas con `npm run validar-banco` y dentro de los umbrales de `node scripts/revisar-banco.mjs`.

## Investigación previa (obligatoria, 15-20 minutos, no más)

Consulta las fuentes oficiales del ICFES para alinear afirmaciones, evidencias, tipos de tarea y estilo de los enunciados. Sirven para la ESTRUCTURA; nunca copies un texto, un contexto ni una pregunta de ellas (son material protegido y de uso académico).

- Guía de orientación Saber 11 2026-2: https://www.icfes.gov.co/wp-content/uploads/2026/03/17-marzo-guia-de-orientacion-saber-11-2026-2.pdf
- Cuadernillo Lectura Crítica 2026: https://www.icfes.gov.co/wp-content/uploads/2026/03/16-feb-cuadernillo-de-preguntas-lectura-critica-saber-11-2026.pdf
- Cuadernillo Ciencias Naturales 2026: https://www.icfes.gov.co/wp-content/uploads/2026/03/24-feb-cuadernillo-preguntas-ciencias-naturales-saber-11-2026.pdf
- Página de la caja de herramientas: https://www.icfes.gov.co/evaluaciones-icfes/saber-11/ (busca ahí los cuadernillos de Matemáticas, Sociales e Inglés 2025 o 2026).

Si una URL no abre, busca en la web "cuadernillo de preguntas <prueba> saber 11 icfes pdf" y usa solo dominios icfes.gov.co. Anota en `fuente.nombre` que la pregunta es "Elaboración propia siguiendo la Guía de orientación Saber 11 2026-2 (ICFES)". Si tomas literalmente una afirmación o evidencia de la guía, va en `afirmacion`/`evidencia`; si la redactas de memoria, añade la etiqueta `afirmacion_por_verificar`.

## Archivos y numeración

- Cinco archivos nuevos por prueba, 20 preguntas cada uno: `content/banco/<prueba>-7.json` … `<prueba>-11.json`.
- Ids consecutivos a partir de 101: `LC-101…LC-200`, `MAT-101…MAT-200`, `SOC-101…SOC-200`, `CIE-101…CIE-200`, `ING-101…ING-200`. Siempre tres dígitos.
- Formato JSON con sangría de 2 espacios (como `content/banco/matematicas-6.json`). Lee ese archivo completo antes de empezar para copiar el estilo.
- `refuerzo_ids`: 1 o 2 ids de preguntas que existan (del banco actual, ids 001-100, o de tu lote). Nunca el propio id.
- `recurso_ids`: `[]`. `estado`: `"aprobada"`. `origen`: `"estilo"`.

## Reglas de calidad (se revisan automáticamente)

1. **Letra correcta repartida**: en cada archivo de 20, cinco correctas en A, cinco en B, cinco en C y cinco en D (Inglés con 3 opciones: reparte A/B/C), y nunca tres seguidas iguales.
2. **La correcta no puede ser sistemáticamente la más larga**: en cada archivo, como máximo 6 de 20 preguntas pueden tener la correcta como opción más larga. Escribe los distractores con la misma extensión y el mismo nivel de detalle que la correcta. Si la correcta necesita ser larga, alarga igual los distractores con razonamientos plausibles pero equivocados.
3. **Nada de letras sueltas en explicaciones**: no escribas "la B", "(C)", "A y D", "VERIFICAR: B". Cita las opciones por su contenido ("la opción que propone 40 °C") o, si hace falta, como "opción B" (con la palabra "opción"). Esto permite reordenar después.
4. **Explicación general** con los siete pasos en mayúsculas: `LEER: … COMPRENDER: … INTERPRETAR: … REPRESENTAR: … RAZONAR: … RESOLVER: … VERIFICAR: …`, entre 400 y 900 caracteres.
5. **Cada distractor**: `explicacion` de 60 a 300 caracteres que diga por qué NO responde, citando el dato o pasaje que lo descarta; `tipo_error` de la taxonomía; `diagnostico` `probable` (construido para un error específico) o `insuficiente`; `razon_frecuente` en una frase. La correcta lleva `tipo_error: null, diagnostico: null, razon_frecuente: null` y una `explicacion` que razone, no que solo diga "es la correcta".
6. **Sin preguntas de memoria pura**: toda pregunta exige leer e interpretar el `contexto` o el `estimulo`. Contextos colombianos y cotidianos cuando sea natural, sin estereotipos. Cifras verosímiles.
7. **Sin "todas/ninguna de las anteriores"**, sin opciones de una palabra cuando la pregunta exige razonamiento (salvo vocabulario de Inglés), sin opciones repetidas.
8. **Originalidad**: textos, tablas y situaciones inventados por ti. Nada tomado de cuadernillos, libros, prensa o Wikipedia de forma literal. Para Lectura Crítica, escribe los textos tú (120-300 palabras), con etiqueta `texto:LC-Txx` compartida por 2-4 preguntas sobre el mismo texto, repitiendo el `contexto` tal cual en cada una. Numera los textos nuevos desde `LC-T30`.
9. **Cobertura**: reparte las 100 preguntas de forma pareja entre las competencias de la prueba (ver taxonomía) y entre los componentes; dificultad aproximada 30 % nivel 1, 45 % nivel 2, 25 % nivel 3; varía `habilidad` (`leer, comprender, interpretar, representar, razonar, resolver, verificar`). Prioriza temas que NO estén en el banco actual (revisa los `tema` existentes con `grep -h '"tema"' content/banco/<prueba>*.json | sort | uniq -c`).
10. **Estímulos**: al menos 30 de las 100 preguntas con `estimulo` (`tabla`, `barras` o `lineas`, según el esquema), con datos coherentes con el contexto. Nunca `imagen`.
11. `tiempo_sugerido_seg` entre 60 y 240 según la dificultad y la longitud.
12. **Inglés**: enunciados y opciones en inglés, explicaciones en español. Reparte las 100 preguntas entre las siete partes (`componente: parte_1 … parte_7`): partes 1-4 y 7 con **3 opciones** (A, B, C); partes 5 y 6 con 4 opciones. Parte 1: descripción → palabra; parte 2: aviso/letrero → significado; parte 3: conversación corta → respuesta adecuada; parte 4: texto con espacio → estructura gramatical; parte 5: lectura literal; parte 6: lectura inferencial; parte 7: texto con espacio → léxico. Niveles A1 a B1 (etiqueta `A1`, `A2` o `B1`).

## Taxonomía (ids válidos; ver `content/taxonomia.json`)

- Lectura Crítica: competencias `LC1` (contenidos locales), `LC2` (sentido global, articulación de partes), `LC3` (reflexión y evaluación); componentes `texto_continuo`, `texto_discontinuo`.
- Matemáticas: `M1` (interpretación y representación), `M2` (formulación y ejecución), `M3` (argumentación); componentes `algebra_calculo`, `geometria`, `estadistica`.
- Sociales y Ciudadanas: `S1` (pensamiento social), `S2` (interpretación y análisis de perspectivas), `S3` (pensamiento reflexivo y sistémico); componentes `espacio_territorio_ambiente`, `historia_cultura`, `etico_politico`.
- Ciencias Naturales: `C1` (uso comprensivo del conocimiento), `C2` (explicación de fenómenos), `C3` (indagación); componentes `biologia`, `fisica`, `quimica`, `cts`.
- Inglés: `I1` (lingüística), `I2` (pragmática); componentes `parte_1` … `parte_7`.
- `tipos_error`: `comprension, interpretacion, inferencia, conocimiento, procedimiento, calculo, lectura_grafico, lectura_tabla, razonamiento, argumentacion, distractor, vocabulario, tiempo, descuido, verificacion`.

## Flujo de trabajo

1. Investiga (sección anterior) y lee `content/ESQUEMA-PREGUNTA.md`, `content/banco/<prueba>-6.json` completo y la lista de temas existentes.
2. Planifica en una tabla las 100 preguntas: id, competencia, componente, tema, dificultad, letra correcta, con/sin estímulo. Reparte las letras ANTES de escribir.
3. Escribe el archivo `-7.json` (20 preguntas). Corre `node scripts/validar-banco.mjs` y `node scripts/revisar-banco.mjs content/banco/<prueba>-7.json`. Corrige hasta que ambos pasen (el validador debe decir "Banco válido" y el revisor no debe marcar ✖ en tu archivo).
4. Repite con `-8` a `-11`.
5. Al final corre los dos scripts sobre todo el banco y reporta: temas cubiertos, distribución de letras, cuántas preguntas tienen estímulo, y cualquier duda de contenido que un docente deba revisar (márcalas también con la etiqueta `revisar_docente`).

No modifiques archivos existentes del banco ni ningún otro archivo del proyecto. No hagas commits.
