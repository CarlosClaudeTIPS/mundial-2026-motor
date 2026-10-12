# Material oficial del ICFES para alimentar el banco

Inventario de documentos públicos del ICFES (Saber 11) útiles para el banco: cuadernillos con preguntas liberadas (se importan como `origen: "oficial"` con su URL) y guías/marcos (sirven para alinear afirmaciones, evidencias y tipos de tarea, y como base para redactar preguntas nuevas de `origen: "estilo"`).

Condición de uso: el ICFES publica este material "para fines exclusivamente académicos". La app es gratuita y de preparación escolar; cada pregunta importada conserva `fuente.url` y `fuente.referencia`. No se redistribuyen los PDF.

## Estado de la red (octubre 2026)

- `www.icfes.gov.co` (WordPress): accesible con `curl`. Su biblioteca de medios se puede inventariar completa con la API REST: `https://www.icfes.gov.co/wp-json/wp/v2/media?per_page=100&page=N&_fields=source_url,date,title` (≈13 600 adjuntos, 137 páginas). **Se recorrió completa**: los únicos cuadernillos de Saber 11 alojados allí son los cinco de la tabla siguiente; no hay cuadernillos de Sociales ni de años anteriores a 2024 en ese dominio.
- `www2.icfes.gov.co` (portal Liferay antiguo, Evaluar para Avanzar, documentos `/documents/20143/...`): **bloqueado** desde el entorno (el proxy responde 502 a `CONNECT`; `WebFetch` tampoco lo resuelve). Ahí viven los cuadernillos 2018-2021 de Saber 11 y todos los de Evaluar para Avanzar.
- `icfes.acendra.com.co`: host externo al que enlaza la propia caja de herramientas oficial (`/caja-de-herramientas-saber-11/practica/`). **Bloqueado**: no resuelve DNS por el proxy y por HTTPS presenta certificado autofirmado (no se desactiva la verificación TLS).

## Cuadernillos de preguntas Saber 11 (preguntas liberadas) en www.icfes.gov.co

| Prueba | Año | URL | Preguntas detectadas | Clave | Estado |
|---|---|---|---|---|---|
| Lectura Crítica | 2026 | https://www.icfes.gov.co/wp-content/uploads/2026/03/16-feb-cuadernillo-de-preguntas-lectura-critica-saber-11-2026.pdf | 49 | sí | importado `LCO26` |
| Matemáticas | 2026 | https://www.icfes.gov.co/wp-content/uploads/2026/04/09-Marzo_Cuadernillo-de-Preguntas-Matematicas-Saber-11-2026.pdf (copia idéntica en `/2026/05/`) | 44 | sí | importado `MATO26` |
| Ciencias Naturales | 2026 | https://www.icfes.gov.co/wp-content/uploads/2026/03/24-feb-cuadernillo-preguntas-ciencias-naturales-saber-11-2026.pdf | 41 | sí | importado `CIEO26` |
| Ciencias Naturales | 2025 | https://www.icfes.gov.co/wp-content/uploads/2025/12/22-diciembre-cuadernillo-de-preguntas-ciencias-naturales-saber-11-2025.pdf | 41 | sí | importado `CIEO25` · **39 de 41 preguntas repiten CIEO26** (mismo enunciado y opciones): conviene conservar solo una de las dos series al aprobar |
| Inglés | 2024 | https://www.icfes.gov.co/wp-content/uploads/2025/12/16-octubre-cuadernillo-ingles-saber-11-2024.pdf | 50 (2 exámenes × 25) | sí (tabla por examen, con nivel MCER) | importado `INGO24` con `scripts/importar-icfes-ingles.mjs`: 42 preguntas (E1 20 + E2 22). Las 8 de la Parte 1 (emparejamiento A-H) no caben en el esquema de 3-4 opciones. Parte 2 (avisos en imagen) → `revisar_estimulo`. El PDF numera mal el Examen 1 Parte 3 (ítems "6" y "7" bajo "preguntas 7 y 8"): se renumeran por posición (`etiqueta renumerada`, referencia "impresa como N") |
| Sociales y Ciudadanas | — | no existe ningún cuadernillo de Sociales en www.icfes.gov.co (inventario completo de medios). Los oficiales (2018, 2019, 2021) están solo en www2 / caja de herramientas (bloqueados), ver abajo | — | — | pendiente |

## Guías de orientación con ejemplos de preguntas explicadas (importadas)

Las guías 2017-1 y 2017-2 traen, por prueba, ejemplos reales con competencia/afirmación, nivel de desempeño, respuesta correcta y justificación oficial (va a `explicacion`). Se importan con `scripts/importar-icfes-guia2017.mjs` (una salida por prueba, etiqueta `explicada_oficial`). La sección de Inglés de estas guías (partes con imágenes, texto superpuesto, claves múltiples "19: A, 21: A") no es procesable.

| Guía | URL | Ejemplos detectados | Estado |
|---|---|---|---|
| 2017-1 (4.ª ed.) | https://www.icfes.gov.co/wp-content/uploads/2024/11/Guia-de-orientacion-saber-11-2017-1.pdf | LC 6 · MAT 9 · SOC 9 · CIE 10 (todas con clave y justificación) | importado `G17-1-LC/MAT/SOC/CIE` (34). MAT 5 y CIE 6 con `revisar_estimulo` (figuras; opciones en figura quedan como `[Opción X: figura, ver PDF p. N]`) |
| 2017-2 (5.ª ed.) | https://www.icfes.gov.co/wp-content/uploads/2024/11/Guia-de-orientacion-saber-11-2017-2.pdf | LC 8 · MAT 11 · SOC 12 · CIE 12 | importado `G17-2-*` con `--sin-duplicados`: 24 nuevas (LC 3, MAT 7, SOC 4, CIE 10); 19 repetían la 2017-1 y no se importaron (LC 5, MAT 4, SOC 8, CIE 2) |
| 2021-1 (PDF accesible) | https://www.icfes.gov.co/wp-content/uploads/2024/11/Guia-de-orientacion-Saber-11.°-2021-1-Pdf-accesible.pdf | 0 | no trae ejemplos: remite a "Descargue aquí ejemplos de preguntas" (enlaces a www2, bloqueados) |
| 2025-1, 2025-2, 2026-1, 2026-2 | ver sección de marcos | 0 | solo estructura; sin preguntas |
| Niveles de desempeño por prueba (sep. 2025) | https://www.icfes.gov.co/wp-content/uploads/2025/09/22-septiembre-nd-prueba-{lectura-critica,matematicas,sociales-y-ciudadanas,ciencias-naturales,ingles}-saber-11.pdf | 0 | 5 páginas de imagen sin texto extraíble (`pdftotext` vacío); no procesable |

## Caja de herramientas Saber 11 (oficial) → archivos bloqueados

Página oficial: https://www.icfes.gov.co/caja-de-herramientas-saber-11/practica/ ("Cuadernillo preguntas explicadas" y "Cuadernillo preguntas práctica" por prueba). Enlaza a `http://icfes.acendra.com.co/wp-content/uploads/2024/12/`:

| Archivo | Prueba | Estado |
|---|---|---|
| 01_EXPLICADAS_LECTURA.pdf · 02_PRACTICA_LECTURA.pdf | Lectura Crítica | no descargable desde el entorno (host bloqueado) |
| 03_EXPLICADAS_MATEMATICAS.pdf · 04_PRACTICA_MATEMATICAS.pdf | Matemáticas | ídem |
| 05_EXPLICADAS_SOCIALES.pdf · 06_PRACTICA_SOCIALES.pdf | **Sociales y Ciudadanas** | ídem — es la fuente oficial prioritaria para Sociales; descargar a mano y correr `importar-icfes.mjs` (si es el formato "Pregunta N" + tabla) o `importar-cuadernillo.mjs` |
| 07_EXPLICADAS_CIENCIAS.pdf · 08_PRACTICA_CIENCIAS.pdf | Ciencias Naturales | ídem (probablemente repite CIEO25/26: deduplicar) |
| 09_EXPLICADAS_INGLES.pdf · 10_PRACTICA_INGLES.pdf | Inglés | ídem (probablemente repite INGO24) |

La página hermana `/caja-de-herramientas-saber-11/que-se-evalua/` enlaza en el mismo host las infografías y marcos (`0N_INFOGRAFIA_*.pdf`, `0N_MARCO_*.pdf`).

## Cuadernillos antiguos (2018-2021) y "Evaluar para Avanzar" → www2 (bloqueado)

Pistas de terceros (solo para localizar la URL oficial; no se usan como fuente):

- Cuadernillos Saber 11 por prueba de 2018/2019/2021 ("Cuadernillo de preguntas Saber 11- Sociales y ciudadanas.pdf", "...Matemáticas.pdf", "...Lectura crítica.pdf", "...Ciencias naturales.pdf", "Cuadernillo de preguntas inglés Saber 11.pdf"): rutas oficiales antiguas `https://www.icfes.gov.co/documents/20143/{490699,1150353,1500084}/...` (hoy 404 en www; la copia viva está en www2). Mirrors: valledelcauca.gov.co (2019), eduka.occidente.co, eservicioseducativos.com (2021), universate.co (2019-2024).
- Evaluar para Avanzar grado 11 (cuadernillos 1 y 2 de 2021, 2022 y 2023, cinco áreas + hojas de respuestas + guías "Guia-PC-*-11-N.pdf"): páginas índice oficiales
  - 2021: https://www2.icfes.gov.co/en/cuadernillo-1-competencias-b%C3%A1sicas-2021 · https://www2.icfes.gov.co/en/cuadernillo-2-competencias-basicas-2021
  - 2021 guías: https://www2.icfes.gov.co/en/guias-de-orientacion-competencias-basicas-2021-cuadernillo-1 · https://www2.icfes.gov.co/en/guias-de-orientacion-competencias-b%C3%A1sicas-2021-cuadernillo-2
  - 2023: https://www2.icfes.gov.co/en/cuadernillo-1-2023 · https://www2.icfes.gov.co/cuadernillo-2-2023
  - Caja de herramientas 3.º a 11.º: https://www2.icfes.gov.co/en/caja-de-herramientas1
  - Nombres de archivo esperados (según índices de terceros): `Cuadernillo-{CienciasNaturales,SocialesyCiudadanas,LecturaCritica,Matematicas,Ingles}-11-{1,2}.pdf`, `Hoja_de_Respuestas_Cuadernillo-*-11-{1,2}.pdf`, `Guia-PC-*-11-{1,2}.pdf`. Prefijos previstos: `EPA21-SOC`, `EPA23-MAT`, etc.
- Ninguno está en www.icfes.gov.co (verificado en el inventario completo de medios). Estado: **pendiente hasta que se permita www2 o se suban los PDF a mano**.

## Guías de orientación y marcos de referencia (estructura, afirmaciones, evidencias)

- Guía 2026-2 Calendario A: https://www.icfes.gov.co/wp-content/uploads/2026/03/17-marzo-guia-de-orientacion-saber-11-2026-2.pdf
- Guía 2026-1 Calendario B: https://www.icfes.gov.co/wp-content/uploads/2025/12/02-diciembre-guia-de-orientacion-saber-11-2026.pdf (borrador previo: `/2025/11/guia-orientacion-saber-11-2026-26-noviembre.pdf`)
- Guía 2025-2 Calendario A: https://www.icfes.gov.co/wp-content/uploads/2025/04/30-abril-guia-orientacion-saber-11o-2025-2.pdf
- Guía 2025-1 Calendario B: https://www.icfes.gov.co/wp-content/uploads/2024/11/07-Noviembre_Guii%CC%80a-de-Orientacioi%CC%80n-Saber-11.o-2025-1.pdf (copia: `/2025/02/07-Noviembre-Guia-de-Orientacion-Saber-11-2025-1.pdf`)
- Guía 2021-1 accesible: https://www.icfes.gov.co/wp-content/uploads/2024/11/Guia-de-orientacion-Saber-11.°-2021-1-Pdf-accesible.pdf
- Guías 2017-1 y 2017-2 (ejemplos explicados, ya importados): ver tabla anterior.
- Marco de referencia Sociales y Ciudadanas 2022: https://www.icfes.gov.co/wp-content/uploads/2024/11/MR-Sociales-y-Ciudadanas-Saber-11.°-2022.pdf
- Marco de referencia Lectura Crítica (Saber 11, TyT, Pro): https://www.icfes.gov.co/wp-content/uploads/2025/03/MR-Lectura-Crítica-Saber-11.°-Saber-TyT-y-Saber-Pro.pdf
- Marco de referencia Inglés: https://www.icfes.gov.co/wp-content/uploads/2024/11/Marco-de-referencia-Prueba-de-ingles-Saber-11.pdf · https://www.icfes.gov.co/wp-content/uploads/2025/03/Marcos-de-referencia-ingle%CC%81s-saber-11-tyt-pro-1.pdf · https://www.icfes.gov.co/wp-content/uploads/2025/03/MR-Inglés-Saber-11.o-Pro-y-TyT.pdf
- Infografías por prueba (sep. 2025): https://www.icfes.gov.co/wp-content/uploads/2025/09/17-septiembre-infografia-prueba-{lectura-critica,matematicas,sociales-y-ciudadanas,ciencias-naturales,ingles}-saber-11.pdf · generalidades: `/2025/09/15-septiembre-infografia-generalidades-examen-saber-11.pdf`
- Niveles de desempeño Matemáticas 2022: https://www.icfes.gov.co/wp-content/uploads/2024/11/Niveles-de-desempeno-Matematicas-Saber-11.o-2022.pdf
- Página "Familiarízate con el examen": https://www.icfes.gov.co/evaluaciones-icfes/saber-11/familiarizate-con-el-examen-saber-11/ · Caja de herramientas: https://www.icfes.gov.co/caja-de-herramientas-saber-11/ · Buscador interno: https://www.icfes.gov.co/search/cuadernillo++11/ (no indexa los PDF; usar la API REST de medios).

## Compilaciones de terceros (no oficiales, solo como pista para ubicar años faltantes)

- universate.co (2019-2024), altopuntaje.com, icfesresultados.com, elestudiante.com.co, sites.google.com/view/evaluar-para-avanzar-2021 (índices de Evaluar para Avanzar 2020-2023 con nombres de archivo), valledelcauca.gov.co (cuadernillos 2019). Verificar siempre contra icfes.gov.co.

## Flujo de importación

1. Descargar el PDF (con la red permitida) a una carpeta temporal; comprobar con `pdfinfo` y `pdftotext -layout x.pdf - | head` que tiene texto.
2. Elegir el script según el formato:
   - Cuadernillo "Pregunta N" + "Tabla de respuestas correctas" (LC/MAT/CIE/SOC): `node scripts/importar-icfes.mjs <pdf> --prueba <id> --prefijo <PREFIJO> --url <url> --anio <año>`
   - Cuadernillo de Inglés (dos exámenes, siete partes): `node scripts/importar-icfes-ingles.mjs <pdf> --prefijo INGO<aa> --url <url> --anio <año>`
   - Guías 2017 con ejemplos explicados: `node scripts/importar-icfes-guia2017.mjs <pdf> --prefijo G17-N --url <url> --anio 2017 [--solo <prueba>] [--sin-duplicados]`
   - Formato genérico numerado (p. ej. Evaluar para Avanzar): `node scripts/importar-cuadernillo.mjs <pdf> --prueba <id> --prefijo <PREFIJO> --url <url> --anio <año>`
   Salida: `content/importados/<prefijo>.json` (estado `pendiente`, sin explicaciones por opción).
3. Deduplicar: comparar enunciado + opciones normalizados contra `content/importados/*.json` y `content/banco/*.json` (la opción `--sin-duplicados` del script de guías lo hace sola). Pendiente de resolver: CIEO25 vs CIEO26 (39 repetidas).
4. Completar clasificación y explicaciones (IA desde la app con `Completar con IA`, o un lote de revisión) y mover al banco con `estado: "aprobada"` solo lo revisado. Las etiquetadas `revisar_estimulo` necesitan reconstruir tabla/gráfico o descartarse.
5. `npm run validar-banco` y `npm run revisar-banco`.

Prefijos: `LCO26`, `MATO26`, `CIEO26`, `CIEO25`, `INGO24`, `SOCO<año>`; guías: `G17-1-*`, `G17-2-*`; Evaluar para Avanzar: `EPA21-LC`, `EPA23-MAT`, etc.
