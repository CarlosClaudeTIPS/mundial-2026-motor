# 18 · Auditoría y mejora del módulo ICFES / Saber 11 (14-oct-2026)

Regla seguida: primero auditar con evidencia, después plan, luego cambios pequeños y reversibles. Nada se reconstruye ni se duplica.

## Fase 1 · Diagnóstico con evidencia

### 1.1 Qué se inspeccionó y cómo
- Repositorio completo de `saber11-prep` (React 18 + Vite 5 + Tailwind + `vite-plugin-pwa`; Supabase opcional con RLS; Dexie/IndexedDB local-first).
- Compilación: `vite build` ✔ (14,9 s). Pruebas: `vitest run` ✔ 71/71 (`tests/logica.test.js`, `tests/acompanamiento.test.js`, `tests/futuro.test.js`).
- Banco: `npm run validar-banco` ✔ (995 preguntas aprobadas, esquema completo, referencias de refuerzo válidas); `npm run revisar-banco` (heurísticas); análisis propio de duplicados sobre las 995.
- Rendimiento: medido con Chromium headless (Playwright + CDP) sobre `vite preview` del build de producción, pantalla móvil 390×844, dos condiciones: sin límite y «4G lento» (1,6 Mb/s bajada, 150 ms de latencia, CPU ×4). Estas son condiciones de laboratorio, no de campo.
- Seguridad: `supabase/schema.sql` (políticas RLS), variables de entorno, ausencia de secretos.

### 1.2 Datos del informe anterior frente a la medición de hoy
| Dato | Informe 14-oct (previo) | Medido hoy (antes de cambios) |
|---|---|---|
| Preguntas en el banco | 500 | **995** aprobadas (920 propias «estilo», 75 oficiales liberadas con enlace) + ~310 importadas pendientes |
| Peso de la app | 5,3 MB | `dist/` 7,4 MB; **JS principal 5,79 MB sin comprimir / 1,44 MB transferidos (gzip)**; el banco entero (5,4 MB de JSON) va dentro del paquete inicial |
| Lighthouse móvil | rendimiento 55, LCP 27,8 s | No se ejecutó Lighthouse (no disponible en este entorno). LCP medido: **1,76 s sin límite; 11,4 s en 4G lento**; FCP 7,8 s en 4G lento; CLS 0,002; 12 peticiones |

Conclusión: el problema principal es real y está localizado: `src/lib/banco.js` importa todas las preguntas con `import.meta.glob(..., { eager: true })`, y `src/components/Guia.jsx` hace lo mismo con la guía (364 KB). Además `App.jsx` espera a `sembrarBanco()` (volcar las 995 preguntas a IndexedDB) **antes** de pintar nada, y no hay división de código por rutas (`React.lazy` ausente): Admin, Informe, Guía, Mi futuro y el panel docente viajan en el paquete inicial.

### 1.3 Inventario
| Elemento | Evidencia | Estado | Decisión |
|---|---|---|---|
| Diagnóstico inicial (25 preguntas, 5 por prueba, dificultad ≤ 2) + perfil con niveles y prioridades | `lib/pruebas.js crearDiagnostico`, `lib/diagnostico.js`, tarjeta «Tu perfil inicial» en `SesionPrueba.jsx` | Funciona; explica limitaciones («primera lectura, se afina con la práctica») | REUTILIZAR; MEJORAR: aviso explícito de que no es psicométrico y de que el puntaje es estimado ya existe en informes; añadir «nivel de confianza» se descarta en esta etapa (no hay evidencia de utilidad y alarga el diagnóstico) |
| Práctica por asignatura / competencia / habilidad / dificultad / tipo de error / ids | `Practica.jsx` (filtros por `params`), `Materia.jsx`, `Refuerzo.jsx`, `reglas.js` | Funciona | REUTILIZAR; MEJORAR: en `Materia.jsx` el tema solo se muestra como etiqueta, no se puede practicar por tema → CREAR filtro por tema |
| Práctica basada en errores | `MisErrores.jsx`, regla `refuerzo_pendiente`, verificación con pregunta nueva | Funciona | REUTILIZAR |
| Aleatorización | `banco.js mezclar` (Fisher-Yates) y `elegirPreguntas` (bloques con texto compartido no se parten; no vistas primero) | Funciona; las opciones no se reordenan (correcto: las explicaciones citan letras) | REUTILIZAR |
| Registro de intentos | `datos.js registrarIntento` (local) + `sync.js` (cola a Supabase, reintentos por ítem) | Funciona | REUTILIZAR |
| Explicación del error: correcta, paso a paso, competencia, por qué la elegida convence, estrategia, refuerzo, «explícame desde cero» | `feedback.js`, `Retro.jsx`, `lecciones.json` | Funciona (los 7 puntos del pedido ya están cubiertos sin IA) | REUTILIZAR |
| Simulacros: selección, orden, cronómetro, navegación, guardado, entrega, resumen | `pruebas.js`, `SesionPrueba.jsx` | Funciona; el cronómetro se calcula desde `fecha_inicio`, así que sobrevive a recargas; respuestas y posición se guardan en IndexedDB por pregunta | REUTILIZAR; VERIFICAR con prueba de recarga a mitad de sesión (ver §5) |
| Ruta personalizada | `lib/ruta.js`, `RutaMejorar.jsx` | Funciona (fecha, minutos/día, días/semana, meta, sesiones con «hecho» automático) | REUTILIZAR |
| Progreso | `MiProgreso.jsx`, `aprendizaje.js`, `Informe.jsx` | Funciona | REUTILIZAR |
| Banco embebido en el JS inicial | `banco.js` glob eager; JS inicial 5,79 MB | Problema principal de rendimiento | MEJORAR: carga bajo demanda por archivo, siembra en segundo plano |
| Guía embebida | `Guia.jsx` glob eager (364 KB) | Mismo problema | MEJORAR: carga perezosa |
| Rutas pesadas sin división | sin `React.lazy` en `App.jsx` | Problema | MEJORAR: `lazy` para Admin, docente, Informe, Guía, Mi futuro, Biblioteca |
| Arranque bloqueado por la siembra | `App.jsx arrancar()` espera `sembrarBanco()` | Problema (LCP) | MEJORAR: siembra no bloqueante con estado visible |
| PWA / sin conexión | `vite.config.js` precache de todo (12 MB máx.) | Funciona; descarga 1,4 MB al instalar | MEJORAR: los trozos del banco no se precargan (quedan en IndexedDB tras la siembra); caché en tiempo de ejecución para ellos |
| Estados de carga / error / vacío | 15 «Cargando…», 21 `catch`, componente `Vacio` | Parcial: el arranque muestra solo texto | MEJORAR: estado de siembra con progreso |
| Accesibilidad | 12 botones solo con icono sin `aria-label`; sin estilo `:focus-visible` global; controles ≥ 40 px en su mayoría | Parcial | MEJORAR |
| IA | Retirada el 14-oct-2026 (decisión del proyecto) | No existe | ELIMINADO; no se reintroduce |
| Supabase RLS | `schema.sql`: `intentos_propios` y `sesiones_propias` solo `estudiante_id = auth.uid()`; docente solo `es_mi_estudiante()`; `perfiles_editar_propio`; funciones `guardar_*` con `auth.uid()` | Correcto en el esquema | VERIFICAR en el proyecto real (no hay acceso desde aquí); REUTILIZAR |
| Secretos | `.env.local` solo claves públicas (anon); sin claves de IA | Correcto | REUTILIZAR |

### 1.4 Muestra del banco
- 995 preguntas, 0 ids repetidos, 0 preguntas sin exactamente una correcta, 0 explicaciones faltantes o cortas, letras correctas repartidas (A 265, B 265, C 253, D 212).
- 94 pares con el mismo enunciado y 465 pares «casi iguales» por palabras: al revisar, son enunciados de plantilla («¿Cuál conclusión está respaldada por los datos?», «Which word matches the description?») con contexto y opciones distintos, o preguntas que comparten un mismo texto (Inglés partes 4 y 7). **0 duplicados reales** (enunciado + contexto + opciones). Un par a revisar por el docente: ING-086 y ING-090 (mismo enunciado y mismas opciones con contextos distintos).
- Sesgo detectado por `revisar-banco`: en `sociales_ciudadanas.json` la opción correcta es la más larga en el 50 % de las preguntas (meta ≤ 35 %). No se corrige automáticamente (requiere reescritura humana); queda como tarea.
- Origen: 920 «estilo Saber 11» (propias), 75 «oficial» con URL del cuadernillo liberado; ninguna se presenta como oficial sin serlo.

## Fase 2 · Plan (etapas pequeñas y reversibles)
1. Rendimiento (prioridad): carga perezosa del banco y de la guía, siembra en segundo plano, `React.lazy` por rutas, precache sin los trozos del banco. Medir antes/después con el mismo guion.
2. Accesibilidad: `aria-label` en botones de icono, `:focus-visible`, revisión de contraste de badges.
3. Pedagogía: práctica por tema en Materia; aviso de limitaciones del diagnóstico ya visible; sin cambios en explicación (cumple).
4. Pruebas: unitarias nuevas para la carga perezosa y la versión del banco; recorrido completo (entrar → diagnóstico → práctica → error → explicación → progreso); recarga a mitad de simulacro; sin conexión.
5. Entrega: informe §5 con métricas antes/después, archivos y cómo revertir (cada etapa es un commit).

## Fase 5 · Resultados (se completa al terminar)

### 5.1 Rendimiento medido antes y después (mismo guion, Chromium headless, móvil 390×844)
| Métrica | Antes | Después |
|---|---|---|
| JS principal (sin comprimir / gzip) | 5 795 KB / ~1 400 KB | **612 KB / 181 KB** |
| Transferido hasta mostrar contenido (4G lento) | 1 444 KB | **257 KB** |
| FCP · 4G lento (1,6 Mb/s, 150 ms, CPU ×4) | 7,8 s | **1,4 s** |
| LCP · 4G lento | 11,4 s | **2,1 s** |
| LCP · sin límite | 1,76 s | **0,76 s** |
| CLS | 0,002 | 0,001 |
| INP | No medido (no hay interacción automatizable comparable); los cambios no añaden trabajo en el hilo principal al interactuar |

Nota: el build local de la tabla no incluye el cliente de Supabase (sin claves en el entorno de medición); el build publicado en Vercel sí lo incluye y su JS principal es de 851 KB sin comprimir / 246 KB gzip (verificado el 14-oct-2026 descargando `assets/index-*.js` de saber11-prep.vercel.app). Sigue siendo 7 veces menor que antes y sin ninguna pregunta ni dato de la guía dentro.

Entorno: `vite preview` del build de producción en el mismo servidor; CDP `Network.emulateNetworkConditions` y `Emulation.setCPUThrottlingRate`. No es Lighthouse ni medición de campo; sirve para comparar antes/después. En campo, el primer arranque además descarga el banco en segundo plano (~1,2 MB comprimidos, con barra de progreso); las visitas siguientes no lo descargan (queda en IndexedDB) y los trozos se cachean en el service worker si se pidieron.

### 5.2 Problemas encontrados y qué se hizo
| Problema (evidencia) | Cambio | Archivos |
|---|---|---|
| Banco completo en el paquete inicial (`import.meta.glob` eager en `banco.js`) | Carga perezosa por archivo; cada archivo es un trozo `banco-*.js` (`manualChunks`); huella del contenido calculada al compilar (`__BANCO_VERSION__`) para no descargar nada si el banco local está al día | `vite.config.js`, `src/lib/banco.js` |
| Arranque bloqueado por la siembra en IndexedDB | Siembra en segundo plano con estado observable; barra de progreso y botón de reintento; `listarPreguntas` espera a la siembra solo cuando hace falta | `src/App.jsx`, `src/lib/banco.js` |
| Portada contaba preguntas leyendo el banco entero | Conteo calculado al compilar (`__BANCO_CONTEO__`) | `vite.config.js`, `src/components/Login.jsx` |
| Guía (364 KB) en el paquete inicial | Carga perezosa con esqueleto de carga y reintento | `src/components/Guia.jsx` |
| Sin división por rutas | `React.lazy` + `Suspense` para Admin, panel docente, Banco, Imprimir, Informe, Guía, Mi futuro, Biblioteca, Historial | `src/App.jsx` |
| Precache de 7 MB al instalar la PWA | Los trozos del banco y del lector PDF no se precargan; caché en tiempo de ejecución (CacheFirst) | `vite.config.js` |
| 12 botones solo con icono sin nombre accesible; sin foco visible global | `aria-label` en todos; regla `:focus-visible` (contorno 3 px) | `ui.jsx`, `Layout.jsx`, `Guia.jsx`, `MiFuturo.jsx`, `ImportarPreguntas.jsx`, `Banco.jsx`, `index.css` |
| Botón dentro de botón en la tarjeta del diagnóstico (aviso de React, foco ambiguo) | Estructura corregida | `Inicio.jsx` |
| Sin aviso de «sin conexión» en modo local | Indicador en la barra lateral y la cabecera | `Layout.jsx` |
| No se podía practicar por tema (solo etiqueta) | Chips «Practicar por tema» en cada materia (temas con ≥ 3 preguntas) | `Materia.jsx` |

### 5.3 Pruebas ejecutadas
- Unitarias: **73/73** (`tests/banco-carga.test.js` nuevo: carga por trozos con progreso, sin ids repetidos, estado observable).
- `vite build` ✔.
- Extremo a extremo (Playwright, modo demo): (1) la app pinta a los 0,3 s antes de terminar la siembra; (2) diagnóstico → recarga a mitad (posición 3/25 y cronómetro conservados, respuestas guardadas) → resultados con perfil inicial y limitaciones → práctica hasta fallar con los 7 elementos de la explicación → progreso; (3) sin conexión: práctica desde IndexedDB, registro y explicación, indicador visible; (4) guía bajo demanda con 76 instituciones; (5) 0 botones sin nombre accesible y foco visible por teclado. Regresión: guiones previos del sistema de acompañamiento (ruta, verificación, progreso, guía) y de «Mi futuro» (escenarios A-H) pasan sin errores de JavaScript.

### 5.4 Seguridad y privacidad
Sin secretos en el repositorio ni en el build; sin IA. RLS en `schema.sql`: intentos y sesiones solo del propio estudiante; docente solo sus estudiantes. **No verificado en el proyecto Supabase real** (sin acceso): recomendación, abrir el panel de Supabase → Authentication → Policies y comprobar que las políticas del esquema estén aplicadas, y correr las migraciones 004-006 si no se han corrido.

### 5.5 Riesgos pendientes y recomendaciones
- Primer arranque en datos móviles: descarga del banco (~1,2 MB) en segundo plano; se muestra el progreso. Si se quiere menos, siguiente paso: sembrar solo la prueba que el estudiante abre primero.
- Sesgo «la correcta es la más larga» (50 %) en `sociales_ciudadanas.json`: requiere reescritura humana de opciones.
- Par ING-086 / ING-090 por revisar (mismo enunciado y opciones con contexto distinto).
- Lighthouse no se ejecutó (no disponible aquí); conviene correrlo desde Chrome en un celular real para tener la cifra oficial.
- ~310 preguntas importadas siguen pendientes de explicación (no cargan en la app).

### 5.6 Desplegar y revertir
Desplegar: cada commit en `main` de `saber11-prep` publica en Vercel en 1-2 minutos (ya hecho). Revertir: `git revert <commit>` del commit «rendimiento y accesibilidad» (o `git checkout <commit-anterior> -- vite.config.js src/lib/banco.js src/App.jsx src/components/Guia.jsx src/components/Login.jsx`) y volver a publicar; no hay migraciones ni cambios de datos: la versión anterior vuelve a sembrar el banco con su propio método al arrancar.
