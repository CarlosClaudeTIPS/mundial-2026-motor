# Material oficial del ICFES para alimentar el banco

Inventario de documentos públicos del ICFES (Saber 11) útiles para el banco: cuadernillos con preguntas liberadas (se importan como `origen: "oficial"` con su URL) y guías/marcos (sirven para alinear afirmaciones, evidencias y tipos de tarea, y como base para redactar preguntas nuevas de `origen: "estilo"`).

Condición de uso: el ICFES publica este material "para fines exclusivamente académicos". La app es gratuita y de preparación escolar; cada pregunta importada conserva `fuente.url` y `fuente.referencia`. No se redistribuyen los PDF.

Nota de red: desde el entorno de desarrollo en la nube, `icfes.gov.co` está bloqueado por la política de red del entorno; hay que permitir `www.icfes.gov.co` y `www2.icfes.gov.co` (o descargar los PDF a mano y subirlos) para correr la importación.

## Cuadernillos de preguntas Saber 11 (preguntas liberadas)

| Prueba | Año | URL | Notas |
|---|---|---|---|
| Lectura Crítica | 2026 | https://www.icfes.gov.co/wp-content/uploads/2026/03/16-feb-cuadernillo-de-preguntas-lectura-critica-saber-11-2026.pdf | 49 preguntas de aplicaciones anteriores |
| Matemáticas | 2026 | https://www.icfes.gov.co/wp-content/uploads/2026/04/09-Marzo_Cuadernillo-de-Preguntas-Matematicas-Saber-11-2026.pdf | |
| Ciencias Naturales | 2026 | https://www.icfes.gov.co/wp-content/uploads/2026/03/24-feb-cuadernillo-preguntas-ciencias-naturales-saber-11-2026.pdf | |
| Ciencias Naturales | 2025 | https://www.icfes.gov.co/wp-content/uploads/2025/12/22-diciembre-cuadernillo-de-preguntas-ciencias-naturales-saber-11-2025.pdf | 50 preguntas |
| Inglés | 2024 | https://www.icfes.gov.co/wp-content/uploads/2025/12/16-octubre-cuadernillo-ingles-saber-11-2024.pdf | |
| Sociales y Ciudadanas | ? | pendiente: no apareció en búsqueda; buscar en la caja de herramientas | |

## Cuadernillos "Evaluar para Avanzar" grado 11 (2021 y 2023)

Páginas índice con PDF por área (Ciencias Naturales, Sociales y Ciudadanas, Lectura Crítica, Matemáticas, Inglés) y hojas de respuestas:

- 2021 cuadernillo 2: https://www2.icfes.gov.co/en/cuadernillo-2-competencias-basicas-2021
- 2021 guías cuadernillo 1 y 2: https://www2.icfes.gov.co/en/guias-de-orientacion-competencias-basicas-2021-cuadernillo-1 · https://www2.icfes.gov.co/en/guias-de-orientacion-competencias-b%C3%A1sicas-2021-cuadernillo-2
- 2023 cuadernillo 1 y 2: https://www2.icfes.gov.co/en/cuadernillo-1-2023 · https://www2.icfes.gov.co/cuadernillo-2-2023
- Caja de herramientas Evaluar para Avanzar 3.º a 11.º: https://www2.icfes.gov.co/en/caja-de-herramientas1

## Guías de orientación y marcos de referencia (estructura, afirmaciones, evidencias, ejemplos explicados)

- Guía 2026-2 Calendario A: https://www.icfes.gov.co/wp-content/uploads/2026/03/17-marzo-guia-de-orientacion-saber-11-2026-2.pdf
- Guía 2026-1 Calendario B: https://www.icfes.gov.co/wp-content/uploads/2025/12/02-diciembre-guia-de-orientacion-saber-11-2026.pdf
- Guía 2025-2 Calendario A: https://www.icfes.gov.co/wp-content/uploads/2025/04/30-abril-guia-orientacion-saber-11o-2025-2.pdf
- Guía 2025-1 Calendario B: https://www.icfes.gov.co/wp-content/uploads/2024/11/07-Noviembre_Guii%CC%80a-de-Orientacioi%CC%80n-Saber-11.o-2025-1.pdf
- Guías 2017-1 y 2017-2 (traen ejemplos de preguntas con justificación): https://www.icfes.gov.co/wp-content/uploads/2024/11/Guia-de-orientacion-saber-11-2017-1.pdf · https://www.icfes.gov.co/wp-content/uploads/2024/11/Guia-de-orientacion-saber-11-2017-2.pdf
- Marco de referencia Inglés: https://www.icfes.gov.co/wp-content/uploads/2024/11/Marco-de-referencia-Prueba-de-ingles-Saber-11.pdf · https://www.icfes.gov.co/wp-content/uploads/2025/03/Marcos-de-referencia-ingle%CC%81s-saber-11-tyt-pro-1.pdf
- Infografía Inglés: https://www.icfes.gov.co/wp-content/uploads/2024/11/Infografia-Ingles-Saber-11.o.pdf
- Página "Familiarízate con el examen" (caja de herramientas): https://www.icfes.gov.co/evaluaciones-icfes/saber-11/familiarizate-con-el-examen-saber-11/
- Buscador interno: https://www.icfes.gov.co/search/cuadernillo++11/

## Compilaciones de terceros (no oficiales, solo como pista para ubicar años faltantes)

- universate.co: archivos y cuadernillos 2019-2024 (verificar siempre contra icfes.gov.co).

## Flujo de importación

1. Descargar el PDF (con la red permitida) a una carpeta temporal.
2. `node scripts/importar-cuadernillo.mjs <pdf> --prueba <id> --prefijo <PREFIJO> --url <url> --anio <año>` → `content/importados/<prefijo>.json` (estado `pendiente`, sin explicaciones).
3. Completar clasificación y explicaciones (IA desde la app con `Completar con IA`, o un lote de revisión) y mover al banco con `estado: "aprobada"` solo lo revisado.
4. `npm run validar-banco` y `npm run revisar-banco`.

Prefijos sugeridos: `LCO26`, `MATO26`, `CIEO26`, `CIEO25`, `INGO24`, `SOCO<año>`; para Evaluar para Avanzar: `EPA21-LC`, `EPA23-MAT`, etc.
