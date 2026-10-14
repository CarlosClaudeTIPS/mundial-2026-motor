# 17 · «Mi futuro»: orientación vocacional y proyecto de vida — auditoría, brechas y plan

Fecha: 14-oct-2026. Aplicación `saber11-prep` (React 18 + Vite + Tailwind, PWA, Dexie/IndexedDB local-first con sincronización a Supabase, Vercel). Este documento cumple la regla «primero auditar, después planificar, luego implementar». La sección 6 (informe final) se completa al terminar.

## 1. Qué se inspeccionó

Leído y verificado en esta sesión: estructura completa de `src/` (`App.jsx` rutas por hash, `Layout.jsx` menús, `lib/*`, `components/*`), `supabase/schema.sql` y migraciones 002-005, `content/*.json` (banco, taxonomía, lecciones, carreras, guía, referencia nacional, niveles de desempeño), `api/ia-preguntas.js`, `tests/*.test.js` (60 pruebas pasan), `vite.config.js` (PWA). Comportamiento verificado con pruebas unitarias y con recorridos Playwright en el modo demo (sesiones del 13 y 14 de octubre). Portales oficiales verificados con peticiones HTTP el 14-oct-2026 (ver §4).

No se verificó: el funcionamiento real de las funciones RPC en el Supabase del usuario (la app las usa con respaldo local).

## 2. Inventario previo

| Elemento | Estado | Evidencia | Decisión |
|---|---|---|---|
| Perfil del estudiante | Verificado | `perfiles` en Supabase (nombre, usuario, grupo, colegio, curso, carreras, modo_carrera, ruta_config); copia local en `db.usuarios`; patrón de guardado con función RPC + respaldo local (`carreras.js guardarCarreras`, `ruta.js guardarRutaConfig`) | Reutilizar el patrón: nueva columna `futuro` (jsonb) con RPC `guardar_futuro` (migración 006) y respaldo local |
| Test vocacional | No existe | Solo existe la elección de hasta 3 carreras «que te gustan» (`Carreras.jsx`, `content/carreras.json`: 9 áreas, 46 carreras con pesos por prueba). No hay cuestionario de intereses ni resultados orientativos | Crear: cuestionario original de intereses (inspirado en RIASEC, sin afirmar validez psicométrica), habilidades, valores y entorno |
| Inteligencia artificial | Retirada | `api/ia-preguntas.js` y los botones de IA del panel docente se eliminaron el 14-oct-2026 | Decisión del proyecto: la app no usa IA en ningún componente. El «orientador» es por reglas: preguntas de reflexión, interpretación del cuestionario, información faltante y conflictos de valores |
| Planificador | Verificado | «Mi ruta para mejorar» (`lib/ruta.js`, `RutaMejorar.jsx`): plan semanal académico con sesiones diarias | Reutilizar el concepto y el estilo; el plan de 30/90 días vocacional es distinto (acciones de exploración) y vive en «Mi futuro», enlazando a la ruta académica cuando una meta implique subir una prueba |
| Proyecto de vida | No existe | Sin funciones de metas, visión ni dimensiones | Crear: punto de partida, visión a 1/3/5 años, metas con acciones y revisión sin «fracaso» |
| Catálogo de carreras | Parcial | `content/carreras.json`: 46 carreras con pesos ICFES, sin descripción de ocupaciones, rutas, costos ni fuentes. `content/guia/universidades-*.json`: 17 universidades de Antioquia y Eje Cafetero con proceso de admisión y enlaces | Mejorar: nuevo catálogo `content/futuro/ocupaciones.json` enlazado a los ids de carreras existentes (sin duplicar pesos) y a la guía de universidades |
| Seguimiento de progreso | Verificado (académico) | `analitica.js`, `aprendizaje.js`, `informes.js`, `Historial`, `MiProgreso` | Reutilizar como «información complementaria» en Mi futuro (competencias a fortalecer por carrera, requisitos de admisión vs. puntaje estimado). Nunca para excluir opciones |
| Recursos externos | Parcial | `content/recursos.json` + `Biblioteca.jsx` (enlaces aprobados por docente), `content/guia/general.json` (enlaces ICFES) | Reutilizar la Biblioteca para materiales; nuevos `content/futuro/fuentes.json` y `oportunidades.json` con fecha de consulta y estado de verificación |
| Autenticación y permisos | Verificado | Supabase Auth + RLS; estudiantes con usuario+PIN; el docente ve a sus estudiantes; `App.jsx` separa rutas por rol | Reutilizar: los datos de Mi futuro se guardan en la fila del propio estudiante (RLS existente); el docente NO los ve (decisión de privacidad) |
| Panel de administración | Verificado | `Admin.jsx`: ciclos, usuarios, taxonomía, examen, reglas, datos | No ampliar ahora: el contenido vocacional vive en JSON versionado (`content/futuro/*`) con fecha de consulta; la edición es por archivo, como las lecciones y la guía |
| Diseño móvil, sin conexión, accesibilidad | Verificado | Tailwind mobile-first, PWA con precarga, Dexie local | Mantener: todo el contenido nuevo es estático y se precarga; guardado local inmediato |
| Guía del ICFES | Verificado (parcial en regiones) | `Guia.jsx`, `content/guia/*` | Reutilizar: enlazar desde Mi futuro a «para qué sirve» y a universidades |

## 3. Cobertura de las 16 preguntas del estudiante

| # | Pregunta | Antes | Etapa 1 (esta entrega) |
|---|---|---|---|
| 1-4 | Quién soy, qué disfruto, qué sé hacer, qué problemas quiero resolver | No cubierto | Conócete: intereses, habilidades, valores, entorno |
| 5-7 | Qué trabajos existen, cómo es el día a día, qué estudiar | No cubierto | Explora: fichas de ocupaciones (qué hace, jornada, dificultades, rutas) |
| 8 | Diferencias técnica / tecnológica / universitaria / SENA / trabajo | No cubierto | Explora: tipos de formación con duración típica y fuente oficial |
| 9-11 | Opciones en Colombia, costos, requisitos, becas | Parcial (17 universidades en la Guía) | Explora: fuentes oficiales verificadas (SNIES, SENA, ICETEX, OLE) y oportunidades con estado de verificación. Sin inventar costos |
| 12 | Cómo comprobar si me gusta | No cubierto | Pasa a la acción: actividades con reflexión posterior |
| 13 | Presión familiar | No cubierto | Módulo de conversación (preguntas y recomendaciones) |
| 14 | Alternativas si no puedo pagar o no entro | No cubierto | Explora: rutas alternativas por ocupación; comparador con criterio «viable económicamente» |
| 15 | Qué hacer en 30 y 90 días | No cubierto | Proyecto de vida: plan 30/90 generado desde metas y circunstancias |
| 16 | Cambiar de rumbo | No cubierto | Metas con estado «replanteada» y preguntas de revisión, sin etiqueta de fracaso |

## 4. Fuentes externas verificadas (14-oct-2026, petición HTTP desde el servidor)

| Fuente | URL vigente | Resultado |
|---|---|---|
| Ministerio de Educación | https://www.mineducacion.gov.co/portal/ | 200 |
| SNIES (consulta de programas) | https://snies.mineducacion.gov.co/portal/ y https://hecaa.mineducacion.gov.co/consultaspublicas/programas | 200 |
| SENA | https://www.sena.edu.co/ · oferta: https://oferta.senasofiaplus.edu.co/sofia-oferta/ (redirige a betowa.sena.edu.co/oferta) | 200 |
| Observatorio Laboral para la Educación | https://ole.mineducacion.gov.co/portal/ | 200 |
| ICETEX | https://web.icetex.gov.co/portal | 200 |
| Colombia Aprende | https://www.colombiaaprende.edu.co/ | 200 |
| UNICEF Colombia | https://www.unicef.org/colombia/ | 200 |
| Datos abiertos | https://www.datos.gov.co/ | 200 |
| Servicio Público de Empleo | https://www.serviciodeempleo.gov.co/ | Sin respuesta desde el servidor (bloqueo o caída); se enlaza con estado «no verificado» |
| Ministerio del Trabajo | https://www.mintrabajo.gov.co/ | Conexión rechazada desde el servidor; «no verificado» |
| Descubre TÚ | ver §6 | pendiente de confirmar URL |

No existe una API pública documentada para SNIES ni para la oferta del SENA que pueda consumirse desde el navegador del estudiante; se integran como búsquedas guiadas (enlace directo con instrucciones). No se copia contenido de esos portales.

## 5. Plan de implementación

**Etapa 1 (esta entrega, MVP):** ruta `#/futuro` «Mi futuro» con cinco áreas; cuestionario de intereses original (36 ítems, 6 áreas), habilidades, valores (con detección de conflictos) y entorno (opcional, sin datos sensibles); resultado orientativo (nunca «tu carrera ideal»); explorador de ocupaciones (catálogo propio con rutas, dificultades y fuentes) y tipos de formación; oportunidades económicas con estado de verificación; comparador de 2 a 4 opciones con pesos del estudiante y «sin dato» explícito; proyecto de vida (punto de partida, visión 1/3/5, metas con acciones, plan 30/90, revisión); actividades de exploración con reflexión; módulo de conversación con familia/mentor; persistencia local + nube (migración 006); conexión con el ICFES (competencias a fortalecer por carrera, enlace a Mi ruta y a la Guía); pruebas unitarias y recorridos de extremo a extremo (escenarios A-H).

**Etapa 2:** catálogo de programas por región (ampliar `universidades-*.json`), más ocupaciones y actividades, seguimiento de acciones con recordatorios.

**Etapa 3:** recursos para docentes/orientadores, instrumentos breves antes/después para medir si ayuda a decidir, comparación avanzada de escenarios.

Riesgos: contenido vocacional es texto propio (riesgo de imprecisión: cada ficha cita fuentes para ampliar); datos variables (costos, convocatorias) no se inventan y se marcan «pendiente de verificar»; privacidad: los datos de Mi futuro no se muestran al docente ni al grupo.

## 6. Informe final (Etapa 1, 14-oct-2026)

### Funciones reutilizadas y mejoradas
- Perfil del estudiante y patrón de persistencia (RPC + respaldo local), igual que carreras y ruta: `lib/futuro.js leerFuturo/guardarFuturo`.
- Catálogo `content/carreras.json`: cada ocupación enlaza sus rutas a esas carreras; desde la ficha se puede activar el modo carrera y ver las pruebas ICFES que pesan (complementario, nunca excluyente).
- Guía ICFES (universidades) enlazada desde Oportunidades; «Mi ruta» y «Carreras» siguen intactas.
- Menú del estudiante, Inicio y enrutador (`#/futuro`, `?area=…&ocupacion=…&actividad=…`).

### Funciones nuevas (y por qué)
- Cuestionario de intereses original (no existía ningún instrumento). 36 ítems, 6 áreas; resultado con áreas, actividades, ocupaciones afines, «para abrir el panorama» y preguntas de reflexión; nunca «carrera ideal».
- Habilidades (5 estados), valores con detección de conflictos, entorno opcional sin datos sensibles.
- Explorador: 24 fichas de ocupaciones (qué hace, jornada, problemas, actividades, habilidades, lo difícil, sectores, rutas, especializaciones, fuentes); 9 tipos de formación; fuentes oficiales con estado de verificación; 8 oportunidades con vigencia y fecha de consulta.
- Comparador de 2 a 4 opciones con 11 criterios ponderados por el estudiante; «sin dato» explícito y cobertura; sin ranking definitivo.
- Proyecto de vida: dimensiones, punto de partida, visión 1/3/5 años, metas con 11 campos y estados (idea, en curso, pausa, lograda, replanteada) con historial; plan 30/90 días generado según circunstancias; impresión.
- Pasa a la acción: 12 actividades con pasos, duración, registro y 5 preguntas de reflexión; módulo de conversación con familia/mentor con frases y recomendaciones.
- «Siguiente paso recomendado» por reglas (sin IA).

### Archivos
Creados: `content/futuro/{cuestionario,ocupaciones,formacion,fuentes,oportunidades,actividades,conversacion}.json`, `src/lib/futuro.js`, `src/components/estudiante/MiFuturo.jsx`, `supabase/migracion-006-futuro.sql`, `tests/futuro.test.js`, `docs/17-mi-futuro.md`. Modificados: `src/App.jsx`, `src/components/Layout.jsx`, `src/components/estudiante/Inicio.jsx`, `src/lib/sync.js`, `CONTINUAR.md`.

### Base de datos
Opcional: `migracion-006-futuro.sql` (columna `perfiles.futuro` jsonb + función `guardar_futuro`, solo escribe la fila propia). Sin ella, todo queda en el dispositivo y la app avisa. `sync.js` excluye `futuro` del upsert de perfiles. El docente no lee esta columna desde la app.

### Fuentes externas
Enlazadas (no integradas por API, porque no existe una pública): ver §4. No se copió contenido de los portales. «Descubre TÚ»: solo se confirmó el comunicado oficial; la herramienta no respondió desde el servidor, se marca «no verificada».

### Pruebas
- Unitarias: 71 pasan (11 nuevas de `futuro`).
- `vite build` sin errores.
- Extremo a extremo (Playwright, modo demo, pantalla de 400 px): escenarios A (indeciso), B (recursos limitados), C (valores contradictorios), D (presión familiar), E (información incompleta), F (cambio de rumbo), G (continuidad al salir y volver), H (regresión de Inicio, Práctica, Refuerzo, Guía, Informe). Todos pasan, sin errores de JavaScript.

### Criterios de aceptación (§18)
1 sin formulario largo (bloques de 6, retomable) ✔ · 2 guarda y produce resultado ✔ · 3 no definitivo ✔ · 4 explora ocupaciones y rutas ✔ · 5 fichas con fuentes y «pendiente de verificar» ✔ · 6 comparador con criterios ✔ · 7-8 proyecto y metas ✔ · 9 actividades con registro ✔ · 10 no aplica: la app no usa inteligencia artificial; el contenido está escrito y citado · 11 persistencia ✔ (local; nube con migración 006) · 12 móvil ✔ · 13 privacidad ✔ (fila propia, no visible al docente) · 14 regresión ✔ · 15 errores corregidos antes de publicar ✔ (bloque del cuestionario que saltaba al responder).

### Pendiente / limitaciones
- Sin asistente conversacional: la aplicación no usa inteligencia artificial en ningún componente (decisión del proyecto). El «orientador por reglas» cubre interpretación, siguiente paso y preguntas de reflexión.
- Catálogo de programas por ciudad (solo 17 universidades en la Guía); costos no se muestran (varían por institución).
- Métricas (§16): los datos para medirlas ya existen en el objeto `futuro` (áreas identificadas, alternativas guardadas, criterios valorados, metas con primer paso, actividades registradas, metas replanteadas). Falta un instrumento breve antes/después y un panel agregado y anónimo; no se implementó para no convertirlo en etiquetas.
- Panel de administración: el contenido se edita en los JSON versionados; no se amplió `Admin.jsx`.
- Servicio Público de Empleo, Mintrabajo, Sapiencia y Jóvenes a la U no respondieron desde el servidor; quedan como «no verificadas».
- Riesgo emocional: el pie de la sección remite a un adulto de confianza y al orientador; no hay detección automática de riesgo (no hay chat).
