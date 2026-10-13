# 02. Programa de preparación Saber 11° en 6 meses — estrategia pedagógica

Fecha: 25 de septiembre de 2026. Este documento es la PARTE 2 (estrategia pedagógica) del prompt maestro y justifica lo que ya está implementado en `content/programa.json`, `content/taxonomia.json` y `content/estructura-examen.json`.

**Etiquetas usadas en todo el documento**

- **[OFICIAL]**: dato tomado de `docs/01-investigacion-saber11.md` (ICFES/MEN) o de `docs/11-calendario-y-normativa.md`, con la salvedad de que el 25-sep-2026 `icfes.gov.co` respondía 404 y varios datos se verificaron vía índice de búsqueda o mirror.
- **[EVIDENCIA]**: hallazgo tomado de `docs/12-evidencia-academica.md`; se conserva su etiqueta de verificación (`VERIFICADO` o `VERIFICADO-META`) y su DOI.
- **[INTERPRETACIÓN]**: inferencia propia a partir de lo anterior.
- **[RECOMENDACIÓN]**: decisión de diseño del programa; puede cambiarse desde Administración.

---

## 1. Principios de diseño

### 1.1 Practicar recuperando, no releyendo

- [EVIDENCIA, VERIFICADO] Roediger & Karpicke (2006, doi:10.1111/j.1467-9280.2006.01693.x): a una semana, recuperar produce retención "sustancialmente mayor" que releer, aunque releer eleva más la confianza. [EVIDENCIA, VERIFICADO-META] Adesope et al. (2017, doi:10.3102/0034654316689306): la práctica con pruebas supera a releer y a toda condición de comparación (*g* ≈ 0,61, no confirmado en línea). [EVIDENCIA, VERIFICADO] Dunlosky et al. (2013, doi:10.1177/1529100612453266): solo práctica con pruebas y práctica distribuida reciben utilidad alta.
- [INTERPRETACIÓN] Para un examen de 254 preguntas de selección múltiple [OFICIAL], la unidad de estudio es la pregunta respondida y explicada; los simulacros son aprendizaje, no solo diagnóstico.
- [RECOMENDACIÓN] Toda actividad (práctica diaria, mini-prueba, simulacro, refuerzo) es una secuencia de preguntas con retroalimentación; los recursos conceptuales (`recurso_ids`) solo aparecen tras un error.

### 1.2 Espaciar e intercalar

- [EVIDENCIA, VERIFICADO] Cepeda et al. (2006, doi:10.1037/0033-2909.132.3.354), 317 experimentos: el intervalo óptimo entre repasos crece con la distancia al examen. [EVIDENCIA, VERIFICADO] Rohrer & Taylor (2007, doi:10.1007/s11251-007-9015-8) y Rohrer, Dedrick & Stershic (2015, doi:10.1037/edu0000001): el intercalado supera al bloqueo a 1 día (*d* = 0,42) y a 30 días (*d* = 0,79).
- [INTERPRETACIÓN] El ciclo vuelve sobre cada competencia al menos tres veces con semanas de separación (fases 2, 3 y 4-5); ninguna mini-prueba es de un solo tema.
- [RECOMENDACIÓN] La práctica diaria mezcla pruebas y competencias; los simulacros mezclan por diseño; la única práctica bloqueada es el refuerzo de 3 preguntas tras un error conceptual, alternado con práctica variada al día siguiente.

### 1.3 Retroalimentación elaborada, por distractor

- [EVIDENCIA, VERIFICADO] Van der Kleij et al. (2015, doi:10.3102/0034654314564881): retroalimentación **elaborada** *g* = 0,49 frente a 0,32 (solo respuesta correcta) y 0,05 (solo acierto/error). [EVIDENCIA, VERIFICADO] Wisniewski, Zierer & Hattie (2020, doi:10.3389/fpsyg.2019.03087): retroalimentación de alta información (tarea + proceso + autorregulación) *d* = 0,99. [EVIDENCIA, VERIFICADO] Gierl et al. (2017, doi:10.3102/0034654317726529): los distractores bien construidos son información diagnóstica de errores conceptuales. [EVIDENCIA, VERIFICADO] Bangert-Drowns et al. (1991, doi:10.3102/00346543061002213): si el estudiante puede copiar la respuesta antes de intentar ("disponibilidad previa"), el efecto se anula.
- [INTERPRETACIÓN] Mostrar solo "correcto/incorrecto" es casi inútil (*g* = 0,05); cada opción debe explicar qué razonamiento la produce.
- [RECOMENDACIÓN] Así está construido el banco: cada opción trae `explicacion`, `tipo_error`, `diagnostico` (confirmado / probable / insuficiente) y `razon_frecuente`; la retroalimentación aparece solo después de enviar, y en práctica cronometrada se aplaza al final del bloque.

### 1.4 Ejemplos resueltos que se desvanecen

- [EVIDENCIA, VERIFICADO] Sweller (1988; Sweller, van Merriënboer & Paas, 1998, doi:10.1023/A:1022193728205): resolver por ensayo-error sobrecarga la memoria de trabajo del novato; los ejemplos resueltos reducen la carga extrínseca. [EVIDENCIA, VERIFICADO] Renkl & Atkinson (2003, doi:10.1207/S15326985EP3801_3) y Atkinson, Renkl & Merrill (2003, doi:10.1037/0022-0663.95.4.774): quitar pasos progresivamente mejora la transferencia, sobre todo con prompts de autoexplicación.
- [RECOMENDACIÓN] La práctica `ejemplo_resuelto` sigue esa secuencia (ejemplo completo → pasos parciales → ítem completo) y se asigna a los errores de **procedimiento** y **razonamiento**.

### 1.5 Autoexplicación y registro de la razón del error

- [EVIDENCIA, VERIFICADO] Chi et al. (1989, doi:10.1207/s15516709cog1302_1; 1994, doi:10.1207/s15516709cog1803_3): quien se autoexplica detecta su propia incomprensión; los demás creen entender cuando no. [EVIDENCIA, VERIFICADO] Bisra et al. (2018, doi:10.1007/s10648-018-9434-x): inducir autoexplicación, *g* = 0,55.
- [RECOMENDACIÓN] En toda pregunta fallada la app pregunta "¿por qué elegiste esa opción?"; esa respuesta convierte un diagnóstico **probable** (inferido del distractor) en **confirmado** (`niveles_diagnostico`) y alimenta la bitácora "Mis errores".

### 1.6 Lectura como eje transversal dentro de cada prueba, no taller aparte

- [OFICIAL] Las cinco pruebas exigen leer: LC evalúa 8 textos con 41 preguntas; Matemáticas, "comprende y transforma la información cuantitativa y esquemática presentada en distintos formatos"; Sociales, "contextualiza y evalúa usos de fuentes"; Ciencias, "derivar conclusiones… basándose en la evidencia"; Inglés, comprensión literal e inferencial (partes 5 y 6).
- [EVIDENCIA, VERIFICADO] National Reading Panel (2000): enseñar una **combinación** de estrategias mejora pruebas estandarizadas. [EVIDENCIA, VERIFICADO] Kintsch (1988, doi:10.1037/0033-295X.95.2.163): inferir exige un modelo de situación, no solo la base textual. [EVIDENCIA, VERIFICADO-META] Friel, Curcio & Bright (2001, doi:10.2307/749671): leer un gráfico tiene tres niveles (leer los datos, entre los datos, más allá de los datos). [EVIDENCIA, VERIFICADO] Elleman et al. (2009, doi:10.1080/19345740802539200): el vocabulario aislado apenas mueve pruebas estandarizadas (*d* = 0,10).
- [INTERPRETACIÓN] Un taller de lectura aparte transferiría poco; transfiere aplicar la misma rutina sobre preguntas reales de cada prueba, con sus tablas, gráficos, fuentes y textos en inglés.
- [RECOMENDACIÓN] De ahí el eje LEER → COMPRENDER → INTERPRETAR → REPRESENTAR → RAZONAR → RESOLVER → VERIFICAR (§2), que etiqueta cada pregunta (`habilidad`) y estructura su explicación.

### 1.7 Expectativa realista de efecto y cómo medirla

- [EVIDENCIA, VERIFICADO] Gómez Soler, Bernal & Herrera (2020, doi:10.15446/cuad.econ.v39n79.77106): el preicfes se asocia a **+0,06 DE** (≈3 puntos globales). Posso, Saravia & Uribe (2023, doi:10.1016/j.econedurev.2023.102459): programa por competencias en horario escolar para bajo NSE, **+0,074 DE** y reducción del 23 % de la brecha socioeconómica. [EVIDENCIA, VERIFICADO-META] Kulik et al. (1984) ~0,3 DE para entrenamiento, con rendimientos decrecientes; Briggs (2001) 0,1–0,2 DE para *coaching* comercial. [EVIDENCIA, VERIFICADO] Díaz Pinzón (2020): simulacros repetidos se asocian a mejoras, pero sin grupo de control.
- [OFICIAL/EVIDENCIA] Escala global: media 250, DE 50; Fundación Exe (2025): 0–9 puntos = efecto nulo, 10–24 = pequeño. Brechas de contexto: sector 30–35 puntos, NSE 1 vs 4 = 78 puntos.
- [INTERPRETACIÓN] Los mecanismos de §1.1–1.5 rinden 0,5–1,0 DE en metaanálisis, en condiciones controladas y con dosis alta. Con ~4 h semanales durante 24 semanas (≈96 h), sin grupo de control y con banco pequeño, una meta honesta está entre la cota colombiana (0,07 DE) y la de Kulik (0,3 DE).
- [RECOMENDACIÓN] **Meta: ≥ 0,20 DE** (≈10 puntos globales, umbral "pequeño" de Exe) entre el simulacro diagnóstico y el completo. Medición:
  1. Línea base: porcentaje de aciertos por prueba y global en el diagnóstico (semanas 2-3), ponderado 3-3-3-3-1 [OFICIAL vía prensa; documento ICFES pendiente].
  2. Post: mismo cálculo en el simulacro completo (semana 20), con ítems **no vistos** por el estudiante.
  3. Efecto = (media post − media pre) / DE de la distribución pre del grupo; se reporta en DE, por prueba y global, como "evolución" en el panel.
  4. Contraste externo: promedio institucional del Saber 11 real frente a la cohorte anterior, advirtiendo que no hay control y que el banco no está equiparado a la escala ICFES.

---

## 2. El eje transversal en cada prueba

Las siete habilidades de `taxonomia.json` describen qué hace un estudiante competente frente a **cualquier** pregunta; no son pasos obligatorios sino los lugares donde se rompe la cadena y, por tanto, donde se diagnostica. La tabla resume su sentido por prueba; después, un ítem real del banco por prueba.

| Habilidad | Lectura Crítica | Matemáticas | Sociales y Ciudadanas | Ciencias Naturales | Inglés |
|---|---|---|---|---|---|
| **Leer** | Todo el texto y el paratexto (título, notas, viñetas) | Enunciado, unidades, tabla o gráfico completos | Fuente, fecha, autor, criterios explícitos | Diseño experimental, variables, tabla de resultados | Texto completo incl. la oración anterior/posterior a la cita |
| **Comprender** | Qué se pregunta: literal, global o crítico | Qué se pide (cantidad, expresión, validez) | Qué se pide: hecho, perspectiva o decisión | Qué respalda el conjunto de datos, ni más ni menos | Literal vs. inferencial; "wants to" vs. hecho |
| **Interpretar** | Sentido de expresiones, función de un párrafo | Tendencias, máximos, cambios en tablas/gráficos | Intención de una fuente, perspectiva de un actor | Qué variable cambia y cuál se controla | Tono, intención, condición |
| **Representar** | Tabla → frase propia; texto → esquema de argumentos | Situación → ecuación, esquema o perímetro | Matriz alternativa × criterio | "Sin X → nada; con X → efecto" | Intención + condición en una frase propia |
| **Razonar** | Evaluar validez de un argumento | Contrastar una regla con todos los casos | Descartar lo que incumple un criterio obligatorio | Comparar con el control, no con otro tratamiento | Descartar lo que contradice una frase explícita |
| **Resolver** | Elegir la opción que no añade ni deforma | Ejecutar el plan y calcular | Elegir la alternativa que cumple todos los criterios | Elegir la conclusión que ninguna fila contradice | Elegir la opción que el texto sugiere |
| **Verificar** | ¿La opción responde lo preguntado o algo parecido? | ¿Unidades, redondeo, x = 0 da lo esperado? | ¿Sustituí un criterio del enunciado por uno mío? | ¿Fui más allá de lo medido? | ¿Contradice algo dicho literalmente? |

### 2.1 Lectura Crítica — `LC-013` (LC2, texto discontinuo, habilidad *representar*, dificultad 2)

Afiche del comité ambiental con una tabla de cuatro medios de transporte (tiempo, costo, emisiones, recomendación). Pregunta: cuál afirmación **resume** la tabla. **Leer**: las cuatro filas y la nota "emisiones por pasajero". **Comprender**: se pide un resumen fiel, no una regla. **Interpretar**: a pie y bicicleta cuestan 0 y emiten 0; el carro es el más rápido, caro y contaminante. **Representar**: traducir la tabla a una frase propia y compararla con las opciones. **Razonar**: la opción B ("cuanto más rápido, más contamina") falla con la bicicleta (18 min, 0 g) frente al bus (25 min, 60 g) → `razonamiento`; la D atribuye al comité una recomendación que la tabla no hace → `lectura_tabla`. **Resolver**: A. **Verificar**: ¿la frase elegida contradice alguna fila? El ítem hermano `LC-014` (habilidad *verificar*) trabaja la nota al pie, que es exactamente lo que un lector apresurado omite.

### 2.2 Matemáticas — `MAT-012` (M2, geometría, habilidad *resolver*, dificultad 2)

Lote rectangular de 60 × 25 m, cerca con 3 vueltas de alambre, rollos de 50 m sin fracciones. **Leer**: tres datos numéricos y una restricción ("no se venden fracciones"). **Comprender**: número **mínimo** de rollos. **Interpretar**: cercar el borde es perímetro, no área (el distractor D, 90 rollos, usa el área → `conocimiento`). **Representar**: P = 2(60 + 25) = 170 m; alambre = 3 × 170 = 510 m; rollos = 510 ÷ 50. **Razonar**: 10,2 rollos exige redondear hacia arriba. **Resolver**: 11. **Verificar**: 10 rollos son 500 m y faltan 10 m (distractor B → `verificacion`); 4 rollos cubren una sola vuelta (distractor A → `comprension`). Cada distractor corresponde a una ruptura distinta de la cadena, lo que permite al panel decir *dónde* se rompió y no solo *que* se rompió.

### 2.3 Sociales y Ciudadanas — `SOC-012` (S3, espacio/territorio, habilidad *resolver*, dificultad 3)

Un concejo debe elegir cómo manejar residuos con tres criterios **simultáneos** (presupuesto ≤ 900 millones, no afectar agua, aceptación comunitaria) y una tabla con cuatro alternativas. **Leer**: los tres criterios y la tabla completa, incluida la columna "empleos", que no es criterio. **Comprender**: se pide la alternativa que cumple lo fijado por el concejo, no la que "parezca mejor". **Interpretar**: cada celda como cumple/incumple. **Representar**: matriz alternativa × criterio. **Razonar**: A1 incumple agua y aceptación; A2 incumple aceptación; A4 supera el presupuesto. **Resolver**: A3. **Verificar**: ¿sustituí un criterio del enunciado por uno propio? El distractor D lo hace (decide por empleo) → `razonamiento`; el A privilegia el costo → `comprension`. Es el mismo movimiento cognitivo que exige la competencia "pensamiento reflexivo y sistémico" del marco [OFICIAL].

### 2.4 Ciencias Naturales — `CIE-007` (C2, química, habilidad *razonar*, dificultad 3)

Cuatro tubos con clavos de hierro: aire seco, agua hervida y sellada, agua con aire, agua salada con aire; resultados a 7 días. **Leer**: qué falta en cada tubo (tubo 1: agua; tubo 2: oxígeno). **Comprender**: la conclusión "mejor sustentada por el **conjunto**" es la que ninguna fila contradice. **Interpretar**: sin agua → nada; sin oxígeno → nada; agua + oxígeno → óxido; con sal → más óxido. **Representar**: ese esquema de cuatro líneas. **Razonar**: la opción A ("el agua por sí sola") choca con el tubo 2; la B ("la sal es la causa") choca con el tubo 3; la C ("el oxígeno basta") choca con el tubo 1. **Resolver**: D. **Verificar**: ¿mi conclusión respeta los tubos de control? La retroalimentación de cada distractor nombra la fila que lo refuta; ese es el nivel "leer entre los datos" de Friel et al. [EVIDENCIA, VERIFICADO-META].

### 2.5 Inglés — `ING-012` (I2, parte 6, habilidad *interpretar*, dificultad 3)

Texto "Screen-Free Fridays"; pregunta: qué quiere decir el rector con "to remember what it feels like to be bored". **Leer**: la cita completa, incluida la razón "because that is when the best ideas appear" y la oración anterior "We are not against technology". **Comprender**: se pide el sentido intencional, no el literal. **Interpretar**: tono (laughing, admits), aburrimiento como condición de la creatividad. **Representar**: sin pantalla → aburrimiento → ideas. **Razonar**: D contradice una frase explícita; C toma "bored" literal y lo aplica a las clases → `interpretacion`; B lee castigo donde hay humor → `interpretacion`. **Resolver**: A. **Verificar**: ¿la opción elegida contradice algo dicho literalmente? En la parte 5, `ING-010` entrena la distinción "wants to open" (intención) frente a "already has" (hecho), una inferencia de nivel B1 según el marco [OFICIAL].

[INTERPRETACIÓN] En las cinco pruebas los distractores más elegidos rompen la cadena en **comprender** (responder otra pregunta), **interpretar** (regla falsa a partir de casos parciales) o **verificar** (no contrastar con todos los datos). Por eso las tres habilidades reciben más semanas foco en el ciclo (§3).

---

## 3. Ciclo de 24 semanas

Parámetros de `programa.json`: 24 semanas; 1 h de clase + 3 h autónomas por semana [RECOMENDACIÓN]; sesión docente con panel cada 21 días (semanas 1, 4, 7, 10, 13, 16, 19, 22 = 8 sesiones); seis fases. Estructura del examen [OFICIAL]: dos sesiones de 4 h 30 el mismo día; sesión 1 = LC 41 + Mat 25 + Soc 25 + Cie 29 (+ 23 de cuestionarios); sesión 2 = Mat 25 + Soc 25 + Cie 29 + Inglés 55 (+ 25 de cuestionarios). El orden de los bloques puede variar según el cuadernillo [OFICIAL].

### 3.1 Escala de los simulacros

| Escala | Sesión 1 (preguntas / minutos) | Sesión 2 (preguntas / minutos) | Uso |
|---|---|---|---|
| 25 % | LC 10, Mat 6, Soc 6, Cie 7 = 29 / 68 min | Mat 6, Soc 6, Cie 7, Ing 14 = 33 / 68 min | Diagnóstico (F1) y calentamiento (F6) |
| 50 % | LC 21, Mat 13, Soc 13, Cie 15 = 62 / 135 min | Mat 13, Soc 13, Cie 15, Ing 28 = 69 / 135 min | Primera práctica larga (F3) |
| 100 % por sesión | 120 / 270 min | 134 / 270 min | Resistencia y ritmo (F4) |
| Completo | Sesión 1 + sesión 2 el mismo día, 270 + 270 min, con pausa | | Condiciones reales (F5) |

[INTERPRETACIÓN] La escala mantiene la proporción de preguntas por prueba y el ritmo real (≈1,9 min por pregunta en sesión 1 y ≈1,7 en sesión 2 si se descuentan los cuestionarios no calificables). Empezar en 25 % evita que el diagnóstico sea un castigo de 9 horas para estudiantes que nunca han sostenido un examen largo; subir por etapas entrena la resistencia (Kulik et al.: el efecto crece con la duración). [RECOMENDACIÓN] El simulacro completo de la semana 20 se aplica un sábado en jornada única si el colegio lo permite; si no, sesión 1 el viernes y sesión 2 el sábado, y se anota la diferencia en el panel.

### 3.2 Tabla semana a semana (fechas de Calendario B 2027, inicio 27-sep-2026 → examen provisional 14-mar-2027)

| Sem. | Semana del | Fase | Pruebas foco | Habilidad foco | Práctica autónoma (≈3 h) | Mini-prueba (semanal) | Simulacro | Sesión docente |
|---|---|---|---|---|---|---|---|---|
| 1 | 27-sep | F1 Diagnóstico y hábitos | Las cinco (reconocimiento) | Leer | 5 preguntas/día mezcladas con retro completa; registrar razón del error | 8 preg. / 16 min, dif. 1-2 | — | **S1**: arranque, acceso, PIN, modo papel |
| 2 | 4-oct | F1 | Sesión 1 del examen | Leer / comprender | 5/día; releer explicaciones de fallos | 8 / 16 | **Diagnóstico sesión 1 (25 %)** | — |
| 3 | 11-oct | F1 | Sesión 2 del examen | Comprender | 5/día; primera visita a "Mis errores" | 8 / 16 | **Diagnóstico sesión 2 (25 %)** | — |
| 4 | 18-oct | F2 Comprensión por competencia | LC + Mat | Leer | 5/día + lectura guiada en la prueba débil | 10 / 20, LC y Mat | — | **S2**: línea base, errores frecuentes, primera asignación |
| 5 | 25-oct | F2 | Soc + Cie | Comprender | 5/día + refuerzo automático por tipo de error | 10 / 20 | — | — |
| 6 | 1-nov | F2 | LC + Inglés | Interpretar | 5/día + ejemplo resuelto si hay error de procedimiento | 10 / 20 | — | — |
| 7 | 8-nov | F2 | Mat + Cie | Leer / comprender | 5/día + refuerzo pendiente | 10 / 20 | — | **S3**: volver a medir el error atacado en S2 |
| 8 | 15-nov | F2 | Soc + LC | Interpretar | 5/día + contraste de argumentos | 10 / 20 | — | — |
| 9 | 22-nov | F2 | Mat + Inglés | Integración leer→interpretar | 5/día + preguntas de refuerzo | 10 / 20 | — | — |
| 10 | 29-nov | F3 Aplicación y representación | Mat + Cie (tablas, gráficos) | Representar | Tabla → frase; gráfico → dato (3 niveles de Friel) | 12 / 24, con estímulo | — | **S4**: competencias débiles, planificar 50 % |
| 11 | 6-dic | F3 | LC + Soc (discontinuos, fuentes) | Interpretar | Texto → esquema; fuente → contexto | 12 / 24 | — | — |
| 12 | 13-dic | F3 | Sesión 1 | Representar | Repaso de errores del 50 % | 12 / 24 | **Sesión 1 al 50 %** | — |
| 13 | 20-dic | F3 | Cie + Soc | Razonar (contraste de argumentos) | 5/día + contraste de dos opciones plausibles | 12 / 24 | — | **S5**: lectura del 50 % |
| 14 | 27-dic | F3 | Sesión 2 | Razonar | Primera práctica cronometrada por bloque | 12 / 24 | **Sesión 2 al 50 %** | — |
| 15 | 3-ene | F4 Resolución y verificación | Mat + Cie | Resolver | Práctica cronometrada; lista de chequeo antes de enviar | 12 / 22, dif. 2-3 | — | — |
| 16 | 10-ene | F4 | Sesión 1 | Resolver / verificar | Revisar cada fallo con la lista de chequeo | 12 / 22 | **Sesión 1 completa (100 %)** | **S6**: ritmo y tiempo por bloque |
| 17 | 17-ene | F4 | LC + Soc + Inglés | Verificar | Cronometrada + verificación | 12 / 22 | — | — |
| 18 | 24-ene | F4 | Sesión 2 | Resolver / verificar | Revisar fallos; refuerzo pendiente | 12 / 22 | **Sesión 2 completa (100 %)** | — |
| 19 | 31-ene | F5 Simulacros completos e intervención | Las cinco | Los dos tipos de error más frecuentes de cada estudiante | Intervención focalizada (práctica asociada al error) | 10 / 20, errores frecuentes | — | **S7**: preparar el completo; casos con dificultad |
| 20 | 7-feb | F5 | Las cinco | Integración | Descanso relativo antes del completo | — | **Completo: dos sesiones, 270 + 270 min** | — |
| 21 | 14-feb | F5 | Según resultados | Error 1 del estudiante | Revisión del completo por tipo de error | 10 / 20 | — | — |
| 22 | 21-feb | F5 | Según resultados | Error 2 del estudiante | Intervención focalizada | 10 / 20 | — | **S8**: efecto pre-post, plan final individual |
| 23 | 28-feb | F6 Preparación final | Repaso de "Mis errores" | Verificar | Reintentar preguntas falladas ya explicadas | 8 / 16, repaso | **Calentamiento corto (25 %)** | — |
| 24 | 7-mar | F6 | — | — | Sin simulacros largos; 5 preguntas/día máximo hasta el jueves | — | — | Charla logística (15 min): citación, documentos, horario |

[INTERPRETACIÓN] La rotación de F2 da tres semanas foco a Lectura Crítica y Matemáticas y dos a las demás porque LC, Mat, Soc y Cie ponderan 3 y Inglés 1 en el global [OFICIAL vía prensa], y porque LC concentra sus 41 preguntas en la sesión 1, al inicio del día [OFICIAL]. Las sesiones docentes caen siempre una semana **después** de un simulacro (S2, S5, S6, S8) para leer sus datos, o una semana **antes** (S4, S7) para prepararlo.

### 3.3 El descanso de la última semana

- [EVIDENCIA, VERIFICADO] Cepeda et al. (2006): cuando el examen está cerca, el intervalo óptimo entre repasos se acorta, pero lo que se repasa debe ser material ya aprendido; el programa lo materializa con "volver a intentar las preguntas falladas que ya se explicaron" (F6).
- [INTERPRETACIÓN] Un simulacro largo en la semana del examen no añade aprendizaje medible y sí fatiga y ansiedad; la meta de la semana 24 es llegar con la rutina de verificación automatizada y con la logística resuelta (citación publicada ~2 semanas antes [OFICIAL, patrón 2023-2026]).
- [RECOMENDACIÓN] Semana 24: máximo 5 preguntas al día hasta el jueves, ninguna el sábado; el panel no genera acciones nuevas esa semana.

---

## 4. Reutilizar el ciclo en Calendario B 2027 y Calendario A 2027

`src/lib/ciclo.js` crea un ciclo por fecha de examen, calcula `fecha_inicio` = examen − 24 semanas y **escala las fases proporcionalmente** si el docente cambia la duración. Las fechas 2027 están marcadas `fecha_provisional: true` porque el ICFES no había publicado el cronograma 2027 al 25-sep-2026 [OFICIAL: NO ENCONTRADO]; se espera entre octubre y noviembre de 2026 [INTERPRETACIÓN, patrón histórico].

| Ciclo | Examen | Inicio (24 sem.) | Fuente de la fecha | Vacaciones que cruzan el ciclo |
|---|---|---|---|---|
| Calendario B 2027 | dom **14-mar-2027** (provisional) | dom 27-sep-2026 | Proyección secundaria (universate.co) a partir de B 2025 = 6-abr, B 2026 = 15-mar [OFICIAL] | Fin de año: ≈3 semanas entre mediados de diciembre y mediados de enero (semanas 13-15) |
| Calendario A 2027 | dom **25-jul-2027** (provisional) | dom 7-feb-2027 | Rango histórico 26-jul a 18-ago (A 2023 = 13-ago, 2024 = 18-ago, 2025 = 10-ago, 2026 = 26-jul) [OFICIAL] | Semana Santa (≈semana 7) y receso de mitad de año (≈2-3 semanas de junio-julio, semanas 19-21) |

### 4.1 Calendario B 2027: perder tres semanas en diciembre-enero

[INTERPRETACIÓN] Los colegios de Calendario B cierran aproximadamente del 18-dic al 11-ene; en la tabla anterior eso son las semanas 13, 14 y 15: el final de F3 (simulacro de sesión 2 al 50 %) y el inicio de F4. Hay dos formas de ajustar; ambas son configurables desde Administración.

| Opción | Qué se hace | Ventaja | Costo |
|---|---|---|---|
| **A. Mantener 24 semanas y declarar "mantenimiento"** [RECOMENDACIÓN por defecto] | Adelantar el simulacro de sesión 2 al 50 % y la S5 a la semana 12. Semanas 13-15: solo 5 preguntas/día desde la PWA o un cuadernillo impreso, sin mini-pruebas ni sesiones. F4 arranca en la 16; sus simulacros al 100 % pasan a las semanas 17 y 18. | Respeta el espaciado (Cepeda): tres semanas de recuperación ligera sobre material visto son repetición espaciada, no pérdida | F4 se comprime a 3 semanas efectivas; la app no tiene aún "semana de pausa", hay que anotarlo en la asignación |
| **B. Iniciar tres semanas antes (6-sep-2026)** | `fecha_inicio` = 2026-09-06; el ciclo dura 27 semanas y `ciclo.js` escala las fases ×1,125 | Conserva 24 semanas efectivas | Exige grupo listo en septiembre; el escalado reparte la pausa entre todas las fases, así que el docente reubica los simulacros a mano |

[RECOMENDACIÓN] Añadir al modelo de ciclo un campo `pausas: [{desde, hasta}]` que el motor descuente al calcular la semana efectiva; hasta entonces, usar la opción A.

### 4.2 Calendario A 2027: mismo ciclo, otras interrupciones

- Si el ICFES fija el examen entre el 26-jul y el 18-ago, el inicio se mueve entre el 7-feb y el 3-mar-2027; el docente corrige `fecha_examen` cuando salga la resolución y el motor recalcula.
- [INTERPRETACIÓN] Las interrupciones típicas son Semana Santa (2027: 22 a 28 de marzo, semana 7, sesión docente S3) y el receso de mitad de año, que en muchos colegios oficiales cae entre mediados de junio y comienzos de julio, es decir, semanas 19-21: justo el simulacro completo de la semana 20. Ajuste: aplicar el simulacro completo en la semana 18 o 19 (antes del receso), tratar el receso como mantenimiento y usar las semanas 21-22 para la intervención focalizada. Verificar contra el calendario académico de la entidad territorial, que no está en las fuentes de este proyecto.
- Registro ordinario del examen: entre finales de marzo y abril [OFICIAL, patrón 2023-2026]; conviene incluirlo en la sesión docente S3 o S4 como recordatorio logístico.
- Los estudiantes de Calendario A que presentan en 2027 también pueden usar el ciclo B 2027 como "ciclo largo" (dos pasadas, la segunda con banco nuevo), pero el efecto de una segunda pasada no está medido en la evidencia disponible [INTERPRETACIÓN].

---

## 5. Sesiones del docente (1 hora cada ~21 días)

El panel de grupo (`src/lib/analitica.js`, `src/components/docente/Grupo.jsx`) muestra: desempeño por prueba, competencia y habilidad; **errores más frecuentes** (porcentaje de estudiantes con ≥2 errores de ese tipo); **acciones sugeridas** generadas por reglas explícitas, cada una con el dato que la motiva; estudiantes con dificultad (<50 % de aciertos con ≥8 intentos) e inactivos; y un botón "Asignar al grupo" que convierte una acción en mini-prueba o simulacro con fecha límite. Las reglas del lado del estudiante (`src/lib/reglas.js`) funcionan igual: error repetido (≥3 del mismo tipo en los últimos 30 intentos), lento pero bien, prueba débil, habilidad débil, sin verificar (≥2 por descuido/verificación), refuerzo pendiente.

### 5.1 Guion de una sesión tipo (ejemplo: S3, semana 7)

| Min. | Paso | Qué se hace con el panel | Fundamento |
|---|---|---|---|
| 0-5 | Volver a medir lo de la sesión anterior | Abrir "evolución semanal" y el error atacado en S2 (p. ej., *interpretación de la información*, 46 % del grupo). Comparar con la mini-prueba filtrada por ese `tipo_error` asignada entonces. Si bajó, cerrar; si no, la acción se repite con otra práctica. | Retroalimentación al docente sobre su propia intervención (Hattie & Timperley: nivel de autorregulación) |
| 5-15 | Leer los errores frecuentes de hoy | Tomar los dos primeros. Abrir 2-3 preguntas donde más se concentró el error y leer en voz alta la explicación del distractor más elegido. | Gierl et al.: el distractor dice *qué* piensa el grupo, no solo que falló |
| 15-35 | Trabajar el error con el grupo | Modelar la cadena LEER→…→VERIFICAR sobre una de esas preguntas (ejemplo resuelto), luego una segunda pregunta con pasos parciales dictados por los estudiantes, luego una tercera sola. Pedir a dos estudiantes que expliquen por qué el distractor "atrae". | Ejemplos desvanecidos (Renkl & Atkinson) + autoexplicación (Bisra) |
| 35-45 | Asignar | Botón "Asignar al grupo" sobre la acción sugerida: mini-prueba de 8 preguntas / 16 min filtrada por `tipo_error`, fecha límite antes de la próxima sesión. Para los estudiantes marcados con dificultad, asignación individual de dificultad 1 en su prueba más débil. Para los inactivos, generar cuadernillo en modo papel. | Práctica de recuperación inmediata y espaciada (semanas siguientes) |
| 45-55 | Casos individuales | Abrir 2-3 fichas de estudiante (bitácora "Mis errores", diagnóstico confirmado vs. probable). Anotar en la sesión qué se acordó. | Retroalimentación elaborada e individual (Van der Kleij) |
| 55-60 | Cerrar el ciclo de medición | Registrar en el panel: error atacado, acción, fecha de la mini-prueba de control. En la sesión siguiente empieza por aquí. | Medición pre/post por error, no solo global |

[RECOMENDACIÓN] La regla de oro de la sesión: **una acción por error frecuente, medida con una mini-prueba antes de la siguiente sesión**. Más de dos acciones simultáneas hacen imposible saber cuál funcionó. La hora semanal de clase restante (las otras dos de cada tres semanas) se usa para práctica acompañada, no para exposición.

---

## 6. Diferenciación por tipo de error

Correspondencia de `taxonomia.json` (`tipos_error` → `practica`), con la justificación de cada emparejamiento.

| Tipo de error | Práctica asignada | Por qué esa práctica |
|---|---|---|
| Comprensión del enunciado | Lectura guiada | Antes de responder, decir qué se pregunta y qué datos sirven; ataca la ruptura en "comprender", la más frecuente en los distractores del banco (NRP: monitoreo y responder preguntas con retroalimentación) |
| Interpretación de la información | Representación | Traducir a tabla, esquema o frase propia obliga a construir el modelo de situación (Kintsch) en lugar de quedarse en la base textual |
| Inferencia | Lectura guiada | La inferencia falla cuando no se han identificado las piezas de las que inferir; el andamiaje las hace explícitas antes de saltar |
| Conocimiento del tema | Refuerzo conceptual | Recurso breve y 3 preguntas del mismo tema: es el único caso en que se practica bloqueado, y es corto para no perder el intercalado (Rohrer) |
| Procedimiento o estrategia | Ejemplo resuelto | Ejemplo modelado → pasos parciales → ítem completo: reduce carga cognitiva del novato (Sweller) y transfiere mejor que el par ejemplo-problema (Atkinson et al. 2003) |
| Cálculo | Ejercitación | Serie corta sin tiempo y con verificación entre preguntas: el error es de ejecución, no de comprensión, y la práctica de recuperación repetida lo automatiza |
| Lectura de gráfico | Representación | Pasar del gráfico al dato y del dato a la frase recorre los tres niveles de Friel et al. y enseña explícitamente ejes y escalas (Shah & Hoeffner, VERIFICADO-META) |
| Lectura de tabla | Representación | Ídem: máximos y mínimos por columna, filas que comparten valores, notas al pie (véase `LC-013`/`LC-014`) |
| Razonamiento | Ejemplo resuelto | Ver encadenado un razonamiento completo (p. ej., descartar por tubos de control en `CIE-007`) antes de producirlo |
| Argumentación | Contraste de argumentos | Comparar dos opciones plausibles y justificar por qué una no responde: es la afirmación "reflexiona y evalúa" de LC y "argumentación" de Mat [OFICIAL], entrenada por autoexplicación (Chi) |
| Distractor atractivo (parcialmente correcto) | Verificación | El distractor es correcto para otra pregunta; la lista de chequeo ("¿responde lo preguntado?") es la única defensa |
| Vocabulario | Refuerzo conceptual | Siempre dentro de textos y preguntas reales; nunca listas aisladas (Elleman: *d* = 0,10 en pruebas estandarizadas) |
| Tiempo (correcta pero lenta, o sin responder) | Práctica cronometrada | Tiempo objetivo por pregunta según prueba; la regla "lento pero bien" la dispara solo con ≥70 % de aciertos, para no cronometrar a quien aún no comprende |
| Descuido (marcó mal, respondió otra cosa) | Verificación | Lista de chequeo antes de enviar; la regla "sin verificar" la activa con ≥2 casos recientes |
| No verificó la respuesta | Verificación | Ídem; en F4 la lista de chequeo se vuelve obligatoria antes de cada envío |

[INTERPRETACIÓN] Tres prácticas (lectura guiada, representación, verificación) cubren nueve de los quince errores: son las que corresponden a las tres rupturas más frecuentes de la cadena (§2). Los diagnósticos **probable** e **insuficiente** se tratan igual que el confirmado en la primera asignación, pero el panel muestra la proporción de cada nivel para que el docente no sobreinterprete un patrón basado en respuestas al azar.

---

## 7. Estudiantes sin conexión: modo papel y PWA

**PWA** (`vite.config.js`, `src/lib/db.js`, `src/lib/sync.js`): la app se instala en el celular; el cascarón queda en caché y las preguntas, intentos y asignaciones viven en IndexedDB. La práctica diaria, las mini-pruebas y los simulacros funcionan sin conexión, con retroalimentación por distractor y registro de la razón del error; los intentos entran en una cola y se sincronizan con la nube cuando hay conexión y sesión. Limitaciones documentadas: sin resolución de conflictos (gana la última escritura) y lo que otros dispositivos escriben solo se ve al recargar. [RECOMENDACIÓN] Descargar el banco y las asignaciones en el colegio (o en un punto con wifi) una vez por semana basta para cubrir las 3 h autónomas; el estudiante sin datos móviles no pierde ninguna función pedagógica, solo la actualización del panel hasta que sincroniza.

**Modo papel** (`src/components/docente/Imprimir.jsx`): el docente genera una prueba imprimible con filtros (prueba, competencia, habilidad, tipo de error, dificultad), con hoja de respuestas y clave aparte, identificadas por un código; después registra las respuestas de cada estudiante como una cadena (p. ej., `ABDC-ABBA`, con `-` para no respondida) y los intentos entran al historial con modo "papel". Así el estudiante sin dispositivo aparece en el mismo panel, con los mismos tipos de error inferidos del distractor.

| Momento del ciclo | Con PWA (sin datos) | Solo papel |
|---|---|---|
| Práctica diaria | Igual que en línea | Cuadernillo semanal de 30 preguntas impreso en la sesión de clase; corrección con la clave el mismo día |
| Retroalimentación por distractor | Inmediata | Diferida: el docente entrega la hoja de explicaciones tras registrar las respuestas [RECOMENDACIÓN: verificar que el modo papel imprima también las explicaciones por opción; si no, añadirlo] |
| Razón del error (autoexplicación) | Se captura en la app | Casilla "¿por qué la elegiste?" en la hoja de respuestas; el docente la transcribe solo para los errores frecuentes |
| Mini-prueba | Igual | Impresa; el tiempo lo controla el docente en clase |
| Simulacro | Igual | Impreso por sesión; es el formato más parecido al examen real de lápiz y papel, que sigue siendo mayoritario en 2026 [OFICIAL, MEN] |
| Lo que se pierde | Nada pedagógico; datos llegan al panel con retraso | Tiempo por pregunta (no se detecta el error "tiempo") y diagnóstico "confirmado" salvo transcripción |

[INTERPRETACIÓN] Como los intentos en papel no tienen tiempo, la regla "lento pero bien" nunca se dispara para esos estudiantes; el docente debe observar el ritmo en los simulacros impresos y asignar práctica cronometrada a mano.

---

## 8. Riesgos y supuestos

| Riesgo o supuesto | Estado | Mitigación |
|---|---|---|
| **Fechas 2027 provisionales** (B: 14-mar; A: 25-jul) | Cronograma no publicado [OFICIAL: NO ENCONTRADO]; B 2025 se movió de 23-mar a 6-abr sobre la marcha [OFICIAL] | Ciclos con `fecha_provisional`; al salir la resolución, cambiar `fecha_examen` y reubicar simulacros; si se corre más de dos semanas, aplicar el "mantenimiento" de §4.1 |
| **Banco pequeño: 66 preguntas** (LC 14, Mat 14, Soc 12, Cie 12, Ing 14) | El diagnóstico al 25 % consume ~62 ítems; un simulacro completo necesita 254 distintos y medir el efecto exige ítems no vistos | Llegar a ≥ 300 ítems antes de la semana 12 y ≥ 600 antes de la 20; usar cuadernillos liberados del ICFES bajo sus términos (uso académico con cita, sin lucro ni alteración) [OFICIAL]; mientras tanto, aceptar repetición en práctica (es recuperación espaciada) pero **no** en simulacros de medición |
| **Afirmaciones oficiales por verificar** | Fórmula del global solo vía prensa; orden de bloques no fijo; dos escalas de Inglés; descriptores N3-N4 de LC y Ciencias; Ley 2503/2025 [OFICIAL: NO ENCONTRADO] | El panel usa la ponderación reportada y lo declara (`_nota` en `estructura-examen.json`); los simulacros no fijan orden de bloques |
| **Tiempo real de los estudiantes** | 3 h autónomas/semana es un supuesto; Collazos et al. (2021, VERIFICADO): la jornada completa es la palanca mayor (+2,3 a +9,4 puntos por área), es decir, el tiempo efectivo pesa más que la técnica | Si el grupo promedia < 15 preguntas/semana, bajar la meta a 3 preguntas/día antes que abandonar; usar la hora de clase para práctica, no exposición |
| **Sin grupo de control** | El pre-post confunde programa, maduración y familiaridad con el formato (Díaz Pinzón) | Reportar en DE con ítems no vistos y contrastar con la cohorte anterior; no prometer puntos ICFES |
| **Vacaciones y calendario escolar** | Cal. B pierde ~3 semanas en dic-ene; Cal. A, el receso de mitad de año | §4; añadir `pausas` al modelo de ciclo |
| **Dispositivos compartidos y conectividad** | Datos locales visibles en un celular compartido; sin datos móviles no hay sincronización | PIN y cierre de sesión; modo papel; descarga semanal en el colegio |
| **Datos de menores** | Ley 1581/2012 y Decreto 1074/2015: autorización del representante legal y minimización [OFICIAL, docs/11 B] | Solo nombre, curso y resultados; autorización antes del primer intento (`docs/11` §B.3) |
| **Transición a examen electrónico** | Gradual 2026-2028 [OFICIAL, MEN]; cobertura 2027 desconocida | La app entrena en pantalla y el modo papel cubre el formato tradicional; enlazar la plataforma de familiarización del ICFES cuando responda |

---

## 9. Qué verificar cuando icfes.gov.co vuelva a estar disponible

1. **Cronograma 2027** (resolución y PDF): aplicación de Calendario B y A, registro, citaciones y resultados. Actualizar `FECHAS_REFERENCIA` en `src/lib/ciclo.js` y quitar `fecha_provisional`.
2. **Guías de orientación 2026-2 y 2027-1**: tabla de sesiones (143 + 159, 4 h 30 cada una), preguntas por prueba (41/50/50/58/55), cuestionarios no calificables y cambios derivados de la Ley 2503 de 2025.
3. **Fórmula del puntaje global** (3-3-3-3-1, escala 0-500) en un documento del ICFES, para reemplazar la cita de prensa en `estructura-examen.json`.
4. **Orden de los bloques por versión de cuadernillo**, para el orden por defecto de los simulacros.
5. **Niveles de desempeño**: descriptores N3-N4 de Lectura Crítica y Ciencias, rango N3 de Sociales y escala de Inglés del reporte individual (A–/A1/A2/B1/B+ vs. Pre A1/A1/A2/B1).
6. **Cuadernillos liberados 2025-2026** y ZIP de la Caja de herramientas: descargar, respetar términos de uso y usarlos para ampliar la práctica y calibrar la dificultad del banco.
7. **Plataforma de familiarización** (`demoplexi.icfes.gov.co/preIcfes`) y cobertura 2027 del examen por computador, para dosificar práctica en pantalla frente a papel.
8. **Examen Pre Saber 11** (simulacro oficial pago): fechas e inscripción, como simulacro completo con escala ICFES real para quien pueda pagarlo.
9. **Informe nacional de resultados 2024** y Data ICFES: promedios por sector, zona y NSE para la línea base institucional.
10. **Ley 2503 de 2025**: articulado y reglamentación, para confirmar que 2027 no añade una prueba calificable.
