# PARTE 4 — MVP: qué se construyó

Estado verificado contra el código el 25-sep-2026. Leyenda: ✅ funciona de extremo a extremo · ⚠️ funciona con limitaciones · ❌ no existe.

## 1. Cómo correr

- **Windows, sin configurar nada:** doble clic en `INICIAR-SABER11.bat`. Instala dependencias la primera vez, abre `http://localhost:5180` y corre `npm run dev`. Deja la ventana abierta.
- **Manual:** `npm install`, `npm run dev` (puerto 5180). `npm run build` genera `dist/` para Vercel.
- **Usuarios de demostración (solo modo local, se crean en el primer arranque, `src/lib/demo.js`):** `admin` / `docente` / `est1` … `est6`, todos con PIN **1234**. Grupo demo `11-02 (demo)` con seis estudiantes. En el panel del grupo hay un botón para generar respuestas ficticias y ver el panel con datos; en Administración → Datos se pueden borrar los datos demo.
- **Validar el banco:** `npm run validar-banco` (revisa `content/banco/*.json` contra la taxonomía; hoy 66 preguntas válidas: LC 14, MAT 14, SOC 12, CIE 12, ING 14).
- **Pruebas unitarias:** `npm test` (Vitest, `tests/logica.test.js`: `feedback.evaluar`, `reglas.recomendar`, `analitica`, `ciclo.estadoCiclo`).

## 2. Criterios de aceptación (sección 59)

### Estudiante

| # | Criterio | Estado | Dónde / observación |
|---|---|---|---|
| 1 | Registrarse / iniciar sesión | ⚠️ | `Login.jsx`: usuario + PIN (local) o código + PIN / correo + contraseña (nube). **No hay autorregistro**: las cuentas las crea el docente o el admin, decisión deliberada por tratarse de menores. |
| 2 | Entrar a su dashboard | ✅ | `#/inicio` (`Inicio.jsx`): semana del ciclo y fase, progreso en el banco, aciertos, errores, asignaciones pendientes, accesos rápidos y 2 recomendaciones por reglas. |
| 3 | Resolver una pregunta | ✅ | `#/practica` (`Practica.jsx`): 5 preguntas por defecto, filtros por URL, estímulos (tabla, barras, líneas) dibujados en SVG. |
| 4 | Ver retroalimentación | ✅ | `Retro.jsx` con los bloques de `feedback.js` (PARTE 8). |
| 5 | Registrar el error | ✅ | Cada envío crea un `intento` con `tipo_error` y `diagnostico`; el estudiante puede decir por qué eligió (`explicarIntento`) y el diagnóstico se reevalúa. |
| 6 | Resolver una pregunta de refuerzo | ✅ | Botón "Intentar una pregunta similar" usa `refuerzo_ids[0]`; el nuevo intento guarda `refuerzo_de`. |
| 7 | Consultar sus errores | ✅ | `#/errores` (`MisErrores.jsx`): filtro por tipo, estado "superado" si el último intento de esa pregunta fue correcto, "refuerzo resuelto", reintento individual o de hasta 8 errores. |
| 8 | Realizar una mini-prueba | ✅ | `#/simulacros` → `crearMiniPrueba` (cantidad, tiempo, prueba, competencia, habilidad, dificultad); `#/sesion?id=` con cronómetro persistente, navegación por número y confirmación al terminar. |
| 9 | Ver resultados | ✅ | `Resultados` en `SesionPrueba.jsx`: precisión, por prueba/competencia/habilidad, errores por tipo, fortalezas/dificultades, revisión pregunta por pregunta con `Retro`. |
| 10 | Consultar recursos | ✅ | `#/biblioteca`: solo recursos `aprobado`, filtro por prueba, enlace y fuente. Tras un error, `recursoParaError` sugiere uno por tipo de error y prueba. |

### Docente

| # | Criterio | Estado | Observación |
|---|---|---|---|
| 1 | Crear grupo | ✅ | `PanelDocente.jsx`: nombre, colegio, curso, ciclo; código de 6 caracteres. |
| 2 | Agregar estudiantes | ⚠️ | `Grupo.jsx` → pestaña Estudiantes: uno a uno o lista pegada (`Nombre; usuario; pin`, usuario y PIN se generan si faltan); muestra credenciales una sola vez. En modo nube llama a `api/estudiantes.js`, que crea las cuentas de Auth y las filas en `perfiles` (pendiente de probar contra un proyecto Supabase real). |
| 3 | Ver resultados | ✅ | Resumen del grupo (promedio, activos, por prueba/competencia/habilidad), lista de estudiantes ordenada de menor a mayor precisión, detalle por estudiante (`#/estudiante?id=`) con evolución semanal y pruebas hechas. |
| 4 | Ver errores | ✅ | Errores más frecuentes del grupo (% de activos con ≥ 2 errores de ese tipo), últimos 20 errores por estudiante con la razón que dio. |
| 5 | Crear / asignar prueba | ✅ | Pestaña Asignaciones: mini-prueba con filtros o simulacro por sesión y escala, fecha límite y nota; el estudiante la ve en su inicio; el docente ve cuántos la hicieron y promedio. Las acciones sugeridas se convierten en asignación con un clic. |
| 6 | Agregar preguntas | ✅ | `#/banco` (`Banco.jsx`): nueva desde plantilla, editar como JSON con validación mínima, duplicar (una oficial duplicada pasa a `estilo`), aprobar, archivar, restaurar, importar/exportar JSON. |
| 7 | Agregar recursos | ✅ | Biblioteca → Proponer: título, tipo, categoría, prueba, URL, habilidades, tipos de error, fuente. Queda `pendiente` si lo propone un docente, `aprobado` si lo crea un admin. |
| 8 | Revisar material pendiente | ✅ | Pestañas aprobado/pendiente/rechazado; aprobar, rechazar o devolver a revisión (versión +1, `aprobado_por`, `fecha_incorporacion`). |

Extra no pedido en la lista pero sí en el prompt (sección 35): **modo papel** (`#/imprimir`): generar prueba imprimible con hoja de respuestas y clave aparte (código `P-…` guardado en `config`), y registrar después las letras marcadas por estudiante (`modo: 'papel'`, sin tiempo).

### Administrador

| # | Criterio | Estado | Observación |
|---|---|---|---|
| 1 | Administrar usuarios | ⚠️ | `Admin.jsx` → Usuarios: crear docente/admin, cambiar rol, restablecer PIN, eliminar cuenta con sus intentos y sesiones. En modo nube solo aplica a la copia local; las cuentas reales se gestionan en Supabase. |
| 2 | Administrar ciclos | ✅ | Editar nombre, inicio, fecha del examen, calendario, marcar provisional/oficial, activar, crear nuevo. Fechas 2027 provisionales por defecto (`FECHAS_REFERENCIA`). |
| 3 | Administrar contenido | ✅ | Banco (igual que docente) + Taxonomía (agregar tipos de error como extensión local) + Examen y programa (editar los JSON base). |
| 4 | Aprobar recursos | ✅ | Igual que docente; además lo que crea el admin nace aprobado. |
| 5 | Consultar estadísticas | ⚠️ | Pestaña Datos: conteos globales (preguntas aprobadas/total, estudiantes, grupos, respuestas, pruebas, recursos, pendientes de sync) y respaldo JSON completo. No hay analítica agregada entre colegios ni gráficos históricos. |

## 3. Qué NO está (y por qué)

- **Motor adaptativo.** Solo reglas explícitas (`reglas.js`). Decisión del prompt (secciones 25 y 54): primero datos reales.
- **IA de ingesta de documentos, generación de preguntas o "buscar nuevo material"** (secciones 21 y 51). El campo `origen: 'generada'` y el estado `pendiente` ya dejan el sitio, pero no hay ninguna llamada a un modelo.
- **Búsqueda semántica** (sección 52). Solo búsqueda por texto en id/enunciado/tema del banco.
- **Biblioteca de videos / YouTube** (sección 23). El tipo `video` existe como valor del selector, sin integración ni filtro de calidad.
- **Banco pequeño para simulacros a escala real.** Existe el simulacro completo (sesión 1 → descanso → sesión 2 con resultado global, `crearSimulacroCompleto`), pero el banco inicial no cubre una sesión real de 120 preguntas sin repetir; por eso se ofrecen escalas del 10 al 100 %.
- **Sesiones del docente: solo registro y resumen.** Existe la entidad `sesiones_docente` (Grupo → Sesiones: preparar con los datos del periodo, notas, próxima fecha sugerida a 21 días), pero no hay recordatorios ni calendario compartido.
- **Importación CSV/Excel/formulario** (sección 50). Solo JSON.
- **API REST propia** (sección 45). La app habla directamente con Supabase bajo RLS; la única función de servidor es `api/estudiantes.js`.
- **Pantallas públicas** (inicio/información). Solo el acceso.
- **Tiempo de lectura de la explicación.** `vio_explicacion` se marca `true` cuando se muestra la retroalimentación, pero no se mide cuánto tiempo la leyó el estudiante.
- **Sincronización de preguntas editadas y de reglas editadas.** Ver PARTE 3 §4.
- **Gamificación, rankings, notificaciones push.** Excluidos por el prompt (sección 56) y por criterio pedagógico (PARTE 10).
- **Accesibilidad auditada, modo claro, i18n.** Pendientes (PARTE 6).
