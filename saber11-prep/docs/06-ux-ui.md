# PARTE 6 — UX / UI

Enrutador por hash (`src/lib/nav.js`): `#/ruta?a=1&b=2`. `App.jsx → elegirVista()` decide la pantalla según rol y ruta. Menú por rol en `Layout.jsx`: barra lateral en escritorio (≥ 768 px) y barra inferior fija en móvil.

## 1. Mapa de pantallas por rol

### Comunes
| Ruta | Componente | Qué hace |
|---|---|---|
| (sin sesión) | `Login.jsx` | Pestañas Estudiante / Docente-Admin; usuario + PIN (local) o correo + contraseña / código + PIN (nube). Muestra los usuarios demo en modo local. |
| `#/biblioteca` | `Biblioteca.jsx` | Estudiante: recursos aprobados con filtro por prueba. Docente/admin: pestañas aprobado/pendiente/rechazado, proponer, aprobar, rechazar. |
| `#/practica?n=5&prueba=…&tipo_error=…&ids=A,B&modo=refuerzo&verificacion=1` | `Practica.jsx` | Práctica con retroalimentación inmediata. |
| `#/sesion?id=<uuid>` | `SesionPrueba.jsx` | Mini-prueba o simulacro en curso; al terminar, resultados. |

### Estudiante (menú: Inicio · Pruebas · Mis errores · Progreso · Biblioteca)
| Ruta | Componente | Contenido |
|---|---|---|
| `#/inicio` | `Inicio.jsx` | Saludo, semana/fase del ciclo y días al examen (badge "fecha provisional"), progreso en el banco, respuestas/aciertos/errores, asignaciones del docente, 6 accesos (práctica, mini-prueba de la fase, errores, progreso, simulacros, ruta), 2 recomendaciones por reglas con su dato. |
| `#/simulacros` | `Simulacros.jsx` | Mini-prueba configurable (prueba, competencia, habilidad, dificultad, cantidad 3–40, tiempo), simulacro por sesión 1/2 con escala 10/25/50/100 %, historial con precisión. |
| `#/errores` | `MisErrores.jsx` | Bitácora: filtro por tipo de error, badges de diagnóstico y "superado"/"refuerzo resuelto", detalle expandible con la pregunta revisada y `Retro`, botón "Repasar N errores sin superar". |
| `#/progreso` | `MiProgreso.jsx` | Aciertos, respuestas, tiempo promedio; evolución semanal (barras de las últimas 12 semanas); por prueba, competencia, habilidad; errores por tipo; "Qué practicar ahora". |
| `#/ruta` | `MiRuta.jsx` | Ciclo activo, avance, fases del programa de 24 semanas con objetivo, actividades, mini-prueba y simulacro sugeridos; la fase actual resaltada. |

### Docente (menú: Grupos · Banco · Biblioteca · Papel · Programa)
| Ruta | Componente | Contenido |
|---|---|---|
| `#/inicio` | `PanelDocente.jsx` | Estado del ciclo, crear grupo, tarjetas de grupos con promedio, activos y error más frecuente. |
| `#/grupo?id=` | `Grupo.jsx` | Pestañas **Resumen** (métricas, acciones sugeridas con "dato observado / sugerencia", errores frecuentes, por prueba/competencia/habilidad, modo papel, asignar), **Estudiantes** (alta individual o lista, credenciales, lista ordenada por precisión con badges "dificultad"/"sin actividad"), **Preguntas** (precisión, distractor más elegido, tiempo, alerta "Revisar pregunta"), **Asignaciones** (crear mini/simulacro, ver hechas/promedio). |
| `#/estudiante?id=` | `EstudianteDetalle.jsx` | Métricas, por prueba y habilidad, errores por tipo, recomendaciones, pruebas hechas, últimos 20 errores con la razón que dio, restablecer PIN. |
| `#/banco` | `Banco.jsx` | Filtros (prueba, competencia, habilidad, estado, texto), vista previa con explicación de cada opción, editar JSON, duplicar, aprobar, archivar, importar/exportar. |
| `#/imprimir?grupo=` | `Imprimir.jsx` | Generar prueba imprimible / registrar resultados de papel. |
| `#/simulacros`, `#/ruta` | — | Mismas vistas que el estudiante, para probar y para ver el programa. |

### Administrador (menú: Admin · Grupos · Banco · Biblioteca · Programa)
| Ruta | Componente | Pestañas |
|---|---|---|
| `#/admin` (y `#/inicio` por defecto) | `Admin.jsx` | Ciclos · Usuarios · Taxonomía · Examen y programa · Reglas · Datos (respaldo, conteos, borrar demo). |
| `#/inicio?vista=docente` | `PanelDocente.jsx` | El admin ve todos los grupos. |

## 2. Flujo detallado de una pregunta (sección 47)

Implementado en `Practica.jsx` + `PreguntaVista.jsx` + `Retro.jsx` + `feedback.js` + `datos.js`.

1. **Pregunta.** `elegirPreguntas` prioriza preguntas no vistas por el estudiante; si no alcanzan, mezcla vistas (Fisher-Yates con semilla). Se muestra encabezado "Práctica · k de N", badges de prueba, competencia, habilidad y origen (Oficial ICFES / Estilo Saber 11 / Generada por IA), el `contexto` en Markdown, el `estimulo` (tabla o gráfico SVG propio, sin librerías, imprimible y offline) y el enunciado. Se arranca un cronómetro silencioso (`inicio.current`).
2. **Lee.** No hay límite de tiempo en práctica; el tiempo se registra pero no presiona. Las opciones son botones grandes (`.opcion`, altura táctil ≥ 44 px) con la letra en negrita.
3. **Selecciona.** La opción elegida se resalta (`opcion-elegida`); se puede cambiar. El botón principal pasa de "Elige una opción" a "Enviar respuesta B".
4. **Enviar.** Si la práctica viene de la regla `sin_verificar` (`?verificacion=1`), antes de enviar aparece la **lista de chequeo** (¿respondí lo que preguntan?, ¿usé el dato correcto?, ¿unidades y tamaño tienen sentido?, ¿puedo descartar las otras?) con "Revisar mi elección" o "Enviar". `registrarIntento` evalúa, escribe en IndexedDB y encola.
5. **Resultado.** Encabezado verde "Correcto" o rojo "Incorrecto"/"Sin responder" con badge del nivel de diagnóstico (rojo confirmado, ámbar probable, gris insuficiente). Las opciones quedan en modo `revisar`: la correcta en verde, la elegida en rojo, las demás atenuadas.
6. **Explicación.** Bloques de `feedback.js` (PARTE 8): tu respuesta, respuesta correcta, por qué X no funciona, qué debías identificar, por qué la correcta es la correcta, habilidad involucrada, qué debes revisar, tipo de error. Si acertó: respuesta correcta, por qué, razonamiento completo, habilidad, aviso de tiempo si fue lento y una pregunta metacognitiva.
7. **Análisis del error.** Tarjeta "¿Por qué elegiste B?" con la razón frecuente de ese distractor y siete razones genéricas como chips, más un campo libre. Texto explícito: "Esto no cambia tu resultado. Sirve para que la plataforma no adivine". Al elegir, `explicarIntento` reevalúa y el bloque "Tipo de error" se actualiza en el acto.
8. **Recurso recomendado.** `recursoParaError` busca un recurso aprobado por (prueba + tipo de error) → (tipo de error) → (prueba + habilidad). Se muestra "Si quieres reforzar esta habilidad", título, descripción, enlace externo y fuente.
9. **Refuerzo.** Botón "Intentar una pregunta similar" carga `refuerzo_ids[0]` como siguiente pregunta, marcada "· refuerzo" en el encabezado; el intento guarda `refuerzo_de`.
10. **Registro.** Todo quedó en `intentos`; el estudiante lo verá en Mis errores (con "superado" si después acierta la misma pregunta) y el docente en el detalle del estudiante y en las estadísticas por pregunta. Al final de la ronda: aciertos/total, tiempo promedio, "Otra ronda" o "Ver mis errores".

En **mini-pruebas y simulacros** el flujo cambia a propósito: sin retroalimentación hasta el final, cronómetro visible (ámbar < 5 min, rojo < 1 min) que sigue contando aunque se cierre la app, navegación por número, confirmación al terminar con conteo de no respondidas; al cerrar se crea un intento por pregunta y se muestra la revisión pregunta por pregunta con el mismo `Retro`.

## 3. Principios mobile-first aplicados

- Diseño de una sola columna con `max-w-4xl`; la barra inferior solo en móvil, con `env(safe-area-inset-bottom)` para iPhone; `viewport-fit=cover`.
- Tema oscuro fijo (`#0F172A`) para ahorrar batería en OLED y coincidir con el manifest; tipografía 14–15 px en cuerpo, botones de ancho completo en acciones principales.
- Sin librerías de gráficos ni de formularios: bundle pequeño, carga rápida en redes 3G; iconos `lucide-react` por árbol.
- Estados vacíos con instrucción ("Crea tu primer grupo…"), listas colapsables en vez de modales, chips desplazables horizontalmente para filtros.
- Todo persiste al instante en IndexedDB: cerrar la pestaña en medio de una sesión no pierde respuestas ni cronómetro.

## 4. Impresión

`@media print` en `src/index.css`: oculta `.no-print` (menús, botones), pasa tarjetas y opciones a fondo blanco con borde gris y `break-inside: avoid`. `Imprimir.jsx` genera portada con nombre/curso/fecha, preguntas numeradas en modo `papel`, hoja de respuestas y clave del docente en páginas separadas (`breakBefore: 'page'`). Los gráficos SVG se imprimen tal cual.

## 5. Accesibilidad pendiente

- No hay modo claro ni control de tamaño de letra; contraste no auditado (texto gris `#94A3B8` sobre `#0F172A` está cerca del mínimo AA).
- Gráficos SVG llevan `role="img"` y `aria-label` con el título, pero no una tabla de datos alternativa; las imágenes de estímulo exigen `alt` (validador).
- Navegación por teclado funciona en botones nativos, pero los chips de filtro y la navegación por número no anuncian estado (`aria-pressed`, `aria-current`).
- Faltan `aria-live` para el cronómetro y el resultado, y un salto al contenido.
- Formularios usan `label` visual pero no siempre asociado con `htmlFor`.
- Falta prueba con lectores de pantalla (TalkBack/VoiceOver) y con zoom al 200 %.
