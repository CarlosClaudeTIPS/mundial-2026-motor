# PARTE 8 — Retroalimentación

Implementada en `src/lib/feedback.js` (lógica pura, probada en `tests/logica.test.js`) y mostrada por `src/components/Retro.jsx`. Principio (sección 11 del prompt): **no adivinar el pensamiento**; el nivel de diagnóstico dice cuánta evidencia hay.

## 1. `evaluar(pregunta, clave, { tiempoSeg, razon })`

Devuelve `{ esCorrecta, clave, claveCorrecta, elegida, correcta, tipoError, diagnostico, lento, habilidad, practicaSugerida, bloques }`.

1. Busca la opción elegida y la correcta. `esCorrecta` solo si la elegida tiene `correcta: true`.
2. Si es incorrecta y **no hay opción** (tiempo agotado o pregunta saltada en una sesión): `tipoError = 'tiempo'`, `diagnostico = 'insuficiente'`.
3. Si es incorrecta con opción: `tipoError = opción.tipo_error ?? 'distractor'` y `diagnostico = opción.diagnostico ?? 'insuficiente'` (lo que escribió el autor del banco).
4. Si además hay `razon` del estudiante:
   - si `razon.tipo_error === tipoError` → `diagnostico = 'confirmado'`;
   - si `razon.tipo_error` es otro → se **reasigna** `tipoError` al que dijo el estudiante y queda `confirmado` (su explicación pesa más que la hipótesis del banco);
   - si `razon.tipo_error === null` y `razon.texto === 'azar'` → `tipoError = 'distractor'`, `insuficiente`;
   - una razón libre ("otra", `tipo_error: null`) no cambia el diagnóstico.
5. `lento = tiempoSeg > tiempo_sugerido_seg × 1,6`. Se registra como señal, nunca como error; en respuesta correcta genera un aviso.
6. `practicaSugerida = practicaParaError(tipoError)` (taxonomía) o `'cronometrada'` si solo fue lento.

### Niveles de diagnóstico

| Nivel | Cuándo | Texto mostrado (`textoDiagnostico`) | Badge |
|---|---|---|---|
| confirmado | El estudiante explicó y su razón coincide (o él mismo nombró otro tipo) | "<Error> (confirmado por tu propia explicación)." | rojo |
| probable | La opción se construyó para un error concreto (`diagnostico: 'probable'` en el banco) y el estudiante no ha explicado | "Probablemente <error>: esta opción suele elegirse por esa razón, pero solo tú sabes si fue así." | ámbar |
| insuficiente | La opción admite varias causas, respondió al azar o no respondió | "No hay información suficiente para saber qué tipo de error fue. Si quieres, cuéntanos por qué elegiste esa opción." | gris |

## 2. Bloques mostrados

**Si es correcta** (`tono` en paréntesis): Respuesta correcta (ok) · Por qué es correcta (`opción.explicacion`) · Razonamiento completo (`pregunta.explicacion`) · Habilidad evaluada · Tiempo (aviso, solo si `lento`) · **Comprobación** (meta): "Acertar no siempre significa comprender. ¿Podrías explicar por qué las otras opciones no sirven?".

**Si es incorrecta**: Tu respuesta (error; "Sin responder" si no hay opción) · Respuesta correcta (ok) · Por qué X no funciona (`elegida.explicacion`, solo si eligió) · Qué debías identificar · Por qué la correcta es la correcta · Habilidad involucrada · Qué debes revisar · **Tipo de error** (neutro si insuficiente, aviso si probable/confirmado).

Después de los bloques, `Retro.jsx` agrega, solo en incorrectas con opción y fuera del modo compacto: la tarjeta **"¿Por qué elegiste X?"**, el **recurso recomendado** (también cuando la lista es de repaso) y el botón **"Intentar una pregunta similar"** si hay `refuerzo_ids`.

## 3. Razones posibles (`razonesPosibles`)

Primero la `razon_frecuente` del distractor elegido (id `frecuente`, hereda su `tipo_error`); luego siempre: "No entendí bien qué preguntaban" (comprension) · "No leí todo el contexto o el gráfico" (comprension) · "No conocía el tema" (conocimiento) · "Me equivoqué al calcular o al hacer el procedimiento" (calculo) · "Sabía la respuesta pero marqué otra" (descuido) · "Me faltó tiempo" (tiempo) · "Adiviné" (null → azar). Más un campo "Otra razón". Al elegir, `explicarIntento` actualiza el intento y el bloque "Tipo de error" cambia en pantalla.

## 4. Recurso por tipo de error

`recursoParaError({ prueba, tipo_error, habilidad })` entre recursos **aprobados**: (1) misma prueba y ese tipo de error → (2) ese tipo de error en cualquier prueba → (3) misma prueba y la habilidad de la pregunta → (4) nada. `pregunta.recurso_ids` no se usa todavía. La práctica sugerida (lectura guiada, representación, etc.) sale de `tipos_error[].practica` en la taxonomía y alimenta las recomendaciones (PARTE 9).

## 5. Tres ejemplos completos (sección 48), tomados literalmente del banco

### 5.1 Matemáticas — `MAT-001` (M1 Interpretación y representación · estadística · habilidad **leer** · dificultad 1 · 90 s)

**Contexto:** "En un colegio de Bogotá se preguntó a los 120 estudiantes de grado décimo cuál deporte prefieren practicar en el descanso. Cada estudiante eligió un solo deporte. El gráfico muestra los resultados."

**Estímulo (barras, "Deporte preferido en el descanso (grado décimo)"):** Fútbol 48 · Baloncesto 30 · Voleibol 24 · Atletismo 18 (eje y: número de estudiantes).

**Enunciado:** ¿Cuántos estudiantes más prefieren fútbol que voleibol?

| Opción | Correcta | Tipo de error · diagnóstico | Explicación (banco) | Razón frecuente |
|---|---|---|---|---|
| A. 18 | no | lectura_grafico · insuficiente | 18 es atletismo (la barra más baja) y también 48 − 30. Ninguna lectura compara fútbol con voleibol. | Tomó la barra de atletismo, o restó la de baloncesto. |
| **B. 24** | **sí** | — | Fútbol 48 y voleibol 24; 48 − 24 = 24. | — |
| C. 48 | no | comprension · probable | 48 es el total de fútbol, no cuántos MÁS; la pregunta pide una diferencia. | Leyó la barra de fútbol y la reportó sin comparar. |
| D. 72 | no | procedimiento · probable | 72 = 48 + 24; "cuántos más" pide la diferencia, y 72 supera cualquier barra. | Sumó las dos barras en lugar de restarlas. |

**Explicación completa:** Leer: fútbol 48, baloncesto 30, voleibol 24, atletismo 18. Comprender: se pregunta cuántos MÁS prefieren fútbol que voleibol; es una comparación entre dos barras. Interpretar: la altura es el número de estudiantes. Representar: diferencia = 48 − 24. Razonar: "cuántos más" indica resta. Resolver: 24. Verificar: 24 + 24 = 48 coincide con la barra de fútbol y la diferencia es menor que ambas barras.

**Qué debías identificar:** las barras de fútbol (48) y voleibol (24), y que el enunciado pide una diferencia. **Qué revisar:** lectura de gráficos de barras y "cuántos más" como resta.

**Qué ve un estudiante que marca C:** "Incorrecto · Error probable" → bloques anteriores → "Probablemente comprensión del enunciado: esta opción suele elegirse por esa razón, pero solo tú sabes si fue así." → chips: "Leyó la barra de fútbol y la reportó sin hacer la comparación…" y los genéricos. Si elige el chip frecuente pasa a **confirmado**; si elige "Adiviné", pasa a distractor/insuficiente. **Recurso:** con la biblioteca inicial aprobada, "Cómo leer una tabla o un gráfico antes de responder" (matemáticas, `lectura_grafico`/`lectura_tabla`) si el tipo es lectura de gráfico; para `comprension` caería en la guía del ICFES por tipo de error, o en el recurso de matemáticas por habilidad. **Refuerzo:** `MAT-002` (tabla, misma competencia).

### 5.2 Lectura Crítica — `LC-001` (LC1 · texto continuo · habilidad **leer** · dificultad 1 · 90 s)

**Contexto:** cuento original "El reloj de la sala" (≈ 230 palabras): Manuela llega a vivir con su abuela Rosa; el reloj de la sala marca las cuatro y veinte y no se mueve; ella intenta arreglarlo (pilas, limpieza, manecillas) y "Nada"; al proponer un relojero, la abuela revela que ella lo paró a la hora en que el abuelo salió el día que no volvió; Manuela entiende que hay cosas que no necesitan arreglo sino compañía y esa noche le quita las pilas a su despertador.

**Enunciado:** En el primer párrafo, la expresión «El reloj seguía clavado en las cuatro y veinte» significa que el reloj

| Opción | Correcta | Tipo de error · diagnóstico | Explicación (banco) | Razón frecuente |
|---|---|---|---|---|
| A. estaba sujeto a la pared con un clavo a esa altura. | no | vocabulario · probable | Lectura literal de «clavado»; el párrafo habla de que «no se movía», no de cómo está colgado. | Tomó «clavado» en sentido literal. |
| **B. marcaba siempre esa hora, sin avanzar.** | **sí** | — | «Clavado» = fijo; lo confirman «no se movía» y el «Nada» tras los intentos. | — |
| C. se atrasaba veinte minutos cada día. | no | interpretacion · insuficiente | El texto no menciona atraso; «cuatro y veinte» es la hora, no minutos de retraso. | Asoció «veinte» con retraso, o supuso un problema típico sin releer. |
| D. había sido reparado a esa hora por Manuela. | no | comprension · probable | Ocurre lo contrario: la frase sigue al «Nada» que niega los intentos. | Asumió que los arreglos funcionaron sin advertir el «Nada». |

**Explicación completa:** LEER: ubico la frase y las oraciones que la rodean. COMPRENDER: piden el significado en uso, no el de diccionario. INTERPRETAR: «no se movía» y «Nada» hacen de «clavado» un sinónimo de inmóvil. REPRESENTAR: "el reloj seguía detenido en esa hora". RAZONAR: A es literal; C inventa un atraso; D contradice el «Nada». RESOLVER: B. VERIFICAR: al sustituir por "seguía marcando fijamente las cuatro y veinte" el párrafo conserva el sentido.

**Qué identificar:** «no se movía» y «Nada». **Qué revisar:** sentido literal y figurado; uso del contexto inmediato. **Habilidad:** leer. **Error probable al marcar A:** vocabulario (probable). **Recurso:** por `vocabulario` no hay recurso inicial → cae en (3) prueba + habilidad; si el docente aprueba "Inferir sin inventar" solo cubre `inferencia`, así que este caso muestra la necesidad de un recurso de vocabulario en contexto. **Refuerzo:** `LC-008`.

### 5.3 Ciencias Naturales — `CIE-001` (C1 Uso comprensivo · biología · habilidad **interpretar** · dificultad 1 · 100 s)

**Contexto:** en clase de Biología de 10° midieron frecuencia cardíaca y respiratoria de una compañera en reposo, justo después de saltar lazo un minuto y cinco minutos después.

**Estímulo (tabla "Frecuencias medidas en tres momentos"):** En reposo 72 / 16 · Justo después de saltar 130 / 30 · 5 minutos después 80 / 18 (latidos/min, respiraciones/min). Nota: misma persona, mismo día y lugar.

**Enunciado:** ¿Cuál es la explicación más adecuada del aumento simultáneo de la frecuencia cardíaca y de la frecuencia respiratoria justo después del ejercicio?

| Opción | Correcta | Tipo de error · diagnóstico | Explicación (banco) | Razón frecuente |
|---|---|---|---|---|
| **A. Los músculos en actividad consumen más oxígeno y producen más CO₂, por lo que el corazón bombea más rápido y los pulmones ventilan más…** | **sí** | — | Mayor respiración celular → ambos sistemas aceleran coordinados (130 y 30) y vuelven casi al reposo (80 y 18). | — |
| B. El corazón late más rápido porque el ejercicio lo debilita… | no | conocimiento · probable | El ejercicio no debilita el corazón en un minuto; además no explica la subida respiratoria de 16 a 30. | Interpreta el aumento como fallo o cansancio. |
| C. La respiración aumenta solo para enfriar el cuerpo y el corazón por una causa independiente… | no | inferencia · probable | Ambas suben y bajan juntas (72→130→80, 16→30→18): misma causa. El enfriamiento humano es por sudoración. | Trata los sistemas como independientes; no usa el patrón conjunto. |
| D. Ambas aumentaron porque estaba nerviosa, como muestra que a los 5 min no volvieron a 72 y 16. | no | inferencia · insuficiente | 80 y 18 están muy cerca del reposo: recuperación esperada; la tabla no mide estado emocional. | Concluye una causa ausente en los datos a partir de una diferencia pequeña. |

**Explicación completa:** LEER: tres momentos, dos frecuencias. COMPRENDER: causa del aumento simultáneo. INTERPRETAR: ambas suben mucho y ambas casi regresan; el patrón es el mismo. REPRESENTAR: ejercicio → músculos gastan más O₂ y producen más CO₂ → corazón bombea más → pulmones ventilan más. RAZONAR: solo A conecta las dos frecuencias con una misma causa; B y C no explican la coordinación; D atribuye a algo no medido. RESOLVER: A. VERIFICAR: la recuperación a los 5 minutos es coherente con A.

**Qué identificar:** que las dos frecuencias cambian juntas y el máximo coincide con la actividad muscular. **Qué revisar:** transporte de gases; respiración celular y demanda de oxígeno. **Error probable al marcar C:** inferencia (probable) → práctica "lectura guiada". **Recurso:** por `inferencia` → "Inferir sin inventar" está etiquetado para lectura crítica, así que aplica la búsqueda (2) por tipo de error en cualquier prueba. **Refuerzo:** `CIE-008` (tabla).

## 6. Comprobación metacognitiva

- En correctas: pregunta abierta "¿podrías explicar por qué las otras opciones no sirven?" (sin registro, es una invitación).
- En incorrectas: chips de razón con la advertencia de que no cambian el resultado; la respuesta modifica el diagnóstico y queda en el intento (`razon`), visible para el docente ("dijo: …").
- En la regla `sin_verificar`: lista de chequeo antes de enviar (PARTE 6 §2.4).
- Al revisar Mis errores o los resultados de una prueba, se vuelve a mostrar el mismo `Retro` con la razón que ya dio, para que pueda corregirla.
