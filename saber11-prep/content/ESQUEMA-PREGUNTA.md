# Esquema de una pregunta (content/banco/*.json)

Cada archivo del banco es un arreglo JSON de preguntas. Todas las claves en español, snake_case.

```json
{
  "id": "MAT-001",
  "prueba": "matematicas",
  "origen": "estilo",
  "fuente": { "nombre": "Elaboración propia siguiendo la estructura de la Guía de orientación Saber 11 (ICFES)", "url": null, "anio": 2026 },
  "competencia": "M1",
  "componente": "aleatorio",
  "afirmacion": "Comprende y transforma la información cuantitativa y esquemática presentada en distintos formatos",
  "evidencia": "Da cuenta de las características básicas de la información presentada en diferentes formatos como series, gráficas, tablas y esquemas",
  "habilidad": "interpretar",
  "tema": "Estadística descriptiva",
  "subtema": "Lectura de gráficos de barras",
  "dificultad": 2,
  "contexto": "Texto de contexto en Markdown sencillo (párrafos, **negrita**). Puede ser null.",
  "estimulo": null,
  "enunciado": "Pregunta concreta que el estudiante debe responder.",
  "opciones": [
    { "clave": "A", "texto": "…", "correcta": false, "explicacion": "Por qué NO responde la pregunta, en concreto.", "tipo_error": "lectura_grafico", "diagnostico": "probable", "razon_frecuente": "Leyó la barra equivocada porque no revisó la leyenda." },
    { "clave": "B", "texto": "…", "correcta": true,  "explicacion": "Por qué es la correcta, con el razonamiento.", "tipo_error": null, "diagnostico": null, "razon_frecuente": null },
    { "clave": "C", "texto": "…", "correcta": false, "explicacion": "…", "tipo_error": "calculo", "diagnostico": "probable", "razon_frecuente": "…" },
    { "clave": "D", "texto": "…", "correcta": false, "explicacion": "…", "tipo_error": "distractor", "diagnostico": "insuficiente", "razon_frecuente": "…" }
  ],
  "explicacion": "Razonamiento completo paso a paso, siguiendo LEER → COMPRENDER → INTERPRETAR → REPRESENTAR → RAZONAR → RESOLVER → VERIFICAR.",
  "que_identificar": "La información relevante que el estudiante debía ubicar en el contexto o el estímulo.",
  "que_revisar": "Concepto o estrategia que conviene repasar.",
  "refuerzo_ids": ["MAT-002"],
  "recurso_ids": [],
  "tiempo_sugerido_seg": 120,
  "etiquetas": ["graficos", "barras"],
  "estado": "aprobada"
}
```

## Reglas

- `origen`: `oficial` (pregunta liberada por el ICFES, con URL), `estilo` (elaboración propia siguiendo la estructura oficial) o `generada` (importada sin origen declarado; la app no usa inteligencia artificial). NUNCA marcar como `oficial` algo que no lo sea.
- `prueba`: `lectura_critica` | `matematicas` | `sociales_ciudadanas` | `ciencias_naturales` | `ingles`.
- `competencia` y `componente`: ids de `content/taxonomia.json`.
- `habilidad`: la habilidad del eje transversal que MÁS pesa en la pregunta: `leer` | `comprender` | `interpretar` | `representar` | `razonar` | `resolver` | `verificar`.
- `dificultad`: 1 (básica), 2 (media), 3 (alta).
- `opciones`: exactamente 4 (Inglés partes 1-4 y 7 pueden tener 3), una sola `correcta: true`. Cada distractor DEBE tener `explicacion`, `tipo_error` (id de `tipos_error` en la taxonomía) y `diagnostico` (`probable` si la opción se construyó para un error específico; `insuficiente` si puede provenir de varias causas). El nivel `confirmado` nunca se escribe en el banco: lo asigna la plataforma cuando el estudiante explica su razonamiento.
- La letra de la opción correcta debe variar entre preguntas (A, B, C y D por igual dentro de cada archivo, sin más de tres seguidas iguales). `npm run validar-banco` lo revisa y `node scripts/balancear-banco.mjs --aplicar` las reparte.
- En explicaciones y razones, cita la opción por su contenido ("la opción que propone 40 °C") o como "opción X"; evita letras sueltas ("la B", "(C)", "A y D") porque impiden reordenar las opciones después.
- `estimulo`: `null`, o uno de:
  - tabla: `{ "tipo": "tabla", "titulo": "…", "columnas": ["Año", "Ventas"], "filas": [["2020", 12], ["2021", 15]], "nota": "…" }`
  - barras: `{ "tipo": "barras", "titulo": "…", "eje_x": "Mes", "eje_y": "Litros", "series": [{ "nombre": "Ventas", "valores": [["Ene", 12], ["Feb", 15]] }] }`
  - lineas: igual que barras con `"tipo": "lineas"`.
  - imagen: `{ "tipo": "imagen", "url": "…", "alt": "descripción textual completa (obligatoria)" }` — evitar en el banco inicial.
- Textos de Lectura Crítica: ORIGINALES (no copiar textos protegidos). Extensión 120-300 palabras en `contexto`. Varias preguntas pueden compartir el mismo `contexto` (repetirlo tal cual y usar `etiquetas` con un id común, p. ej. `"texto:LC-T01"`).
- Inglés: enunciado y opciones en inglés; explicaciones en español.
- Contextos colombianos y cotidianos cuando sea natural (transporte, recibos de servicios, cultivos, clima, elecciones escolares), sin estereotipos.
- Sin preguntas de memoria pura: toda pregunta debe exigir leer e interpretar el contexto.
