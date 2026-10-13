# Guía del ICFES: esquema de datos

Carpeta `content/guia/`. La app une todos los archivos `universidades-*.json` en una sola lista y muestra `general.json` como secciones de la guía.

## `universidades-<region>.json`

Arreglo de universidades (o instituciones: SENA, escuelas militares…). Cada una:

```json
{
  "id": "unal-bogota",
  "nombre": "Universidad Nacional de Colombia",
  "sigla": "UNAL",
  "ciudad": "Bogotá",
  "departamento": "Cundinamarca",
  "tipo": "pública",
  "sedes": ["Bogotá", "Medellín", "Manizales", "Palmira"],
  "web": "https://unal.edu.co",
  "admisiones_url": "https://admisiones.unal.edu.co",
  "uso_saber11": "examen_propio",
  "uso_saber11_detalle": "No usa el puntaje Saber 11 para admitir a pregrado: aplica su propio examen de admisión. El Saber 11 es requisito de ley para matricularse.",
  "puntaje_minimo": null,
  "ponderacion": null,
  "proceso": [
    { "paso": "Inscripción en línea", "detalle": "Formulario en admisiones.unal.edu.co y pago de derechos.", "url": "https://admisiones.unal.edu.co" },
    { "paso": "Examen de admisión", "detalle": "Prueba propia de 120 preguntas; se presenta en la ciudad elegida." },
    { "paso": "Resultados y selección de programa", "detalle": "Según puntaje se asigna el programa de la lista de preferencias." }
  ],
  "calendario": "Dos convocatorias al año: inscripciones en marzo-abril (para segundo semestre) y en septiembre-octubre (para primer semestre).",
  "costo_inscripcion": "Aprox. $110.000 (2025).",
  "becas_programas": ["Programa Especial de Admisión y Movilidad Académica (PEAMA)", "Admisión especial para población indígena, afrocolombiana y mejores bachilleres de municipios pobres"],
  "notas": "Verificado en octubre de 2026 en el sitio oficial; las fechas cambian cada semestre.",
  "fuentes": ["https://admisiones.unal.edu.co/pregrado/"],
  "verificado": "2026-10"
}
```

Valores de `uso_saber11`:
- `requisito`: solo exige haber presentado el examen (ley 1324 de 2009), sin puntaje mínimo publicado.
- `puntaje_minimo`: exige un puntaje global o por prueba mínimo (ponerlo en `puntaje_minimo`, p. ej. `{ "global": 300 }` o `{ "lectura_critica": 60 }`).
- `ponderado`: admite por el puntaje Saber 11 ponderado por programa (describir en `ponderacion`, p. ej. "Medicina: 30 % matemáticas, 30 % ciencias, 20 % lectura, 20 % sociales").
- `examen_propio`: tiene examen de admisión propio; el Saber 11 solo es requisito.
- `entrevista_o_mixto`: combina Saber 11 con entrevista, prueba o promedio del colegio.

## `general.json`

Secciones de la guía (qué es el ICFES, cómo se califica, para qué sirve, becas y créditos, calendario, preguntas frecuentes). Cada sección: `{ "id", "titulo", "parrafos": [markdown sencillo], "enlaces": [{ "texto", "url" }] }`.
