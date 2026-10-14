# 16 · Sistema inteligente de acompañamiento — Fase 0 (auditoría) y plan

Fecha: 14-oct-2026. Alcance: app `saber11-prep` (React + Dexie + Supabase). Antes de escribir código se revisó cada módulo que toca al estudiante. Este documento es la evidencia de esa revisión y el plan que se ejecuta después (ver §5 para lo hecho).

## 1. Qué se revisó (y qué no)

Leído completo: `src/lib/{feedback,reglas,analitica,pruebas,acceso,carreras,informes,datos,db}.js`, `src/components/{Retro,Guia,Informe}.jsx`, `src/components/estudiante/{Inicio,Practica,Refuerzo,MiRuta,MiProgreso,MisErrores,SesionPrueba}.jsx`, `content/{taxonomia,lecciones,programa}.json`, `api/ia-preguntas.js`, `supabase/*.sql`, `tests/logica.test.js`. Banco: 995 preguntas aprobadas, todas con `refuerzo_ids`, `tema`, y todos los distractores (2 861) con `tipo_error`, `diagnostico` y `razon_frecuente`.

No revisado a fondo: `Materia.jsx`, `Historial.jsx`, `Simulacros.jsx`, panel docente (`Grupo.jsx`, `EstudianteDetalle.jsx`), `Admin.jsx`, `sync.js` (ya revisado en la sesión anterior), `importar.js`. Ninguno hace falta tocarlo para este sistema; se asume que siguen funcionando como estaban. Tampoco se verificó el endpoint de IA en producción (requiere `ANTHROPIC_API_KEY` en Vercel; no se tiene acceso para comprobarlo).

## 2. Inventario de funciones existentes

| Función | Estado | Evidencia (archivo) | Problema detectado | Acción |
|---|---|---|---|---|
| Banco de preguntas con explicaciones por opción, tipo de error y pregunta de refuerzo | Funciona | `content/banco/*.json`, `src/lib/banco.js`, `scripts/validar-banco.mjs` | Ninguno para este alcance | Reutilizar |
| Práctica con retroalimentación inmediata (correcta / por qué cada opción no / qué identificar / qué revisar / tipo de error) | Funciona | `Practica.jsx`, `Retro.jsx`, `feedback.js evaluar()` | La retroalimentación es la misma sin importar la razón que el estudiante elige; solo cambia la etiqueta "tipo de error" | Mejorar: mensaje y micro-estrategia según la razón elegida |
| "¿Por qué elegiste X?" (razón del error, 7 opciones + razón frecuente del distractor + "otra") | Funciona | `feedback.js razonesPosibles()`, `datos.js explicarIntento()` | Cubre las 7 razones pedidas (no entendí, no leí, no sabía, cálculo, descuido, tiempo, adiviné). Falta la **pregunta de verificación obligatoria** después de elegir la razón: hoy hay un botón opcional "Intentar una pregunta similar" que usa solo `refuerzo_ids[0]` | Mejorar: tras la razón, proponer pregunta de verificación (refuerzo no vista → misma competencia y habilidad no vista) y registrar `verificacion_de` |
| Lista de verificación antes de enviar (regla `sin_verificar`) | Funciona | `Practica.jsx CHEQUEO`, `reglas.js` | Ninguno | Reutilizar |
| Prueba diagnóstica (25 preguntas, 5 por prueba, dificultad ≤ 2, una por competencia) | Funciona | `pruebas.js crearDiagnostico()`, `Inicio.jsx TarjetaDiagnostico` | Resultado = tabla de porcentajes. No produce un **perfil inicial** legible (nivel por competencia, prioridades) ni alimenta la ruta. No es adaptativa (no es necesario para 25 preguntas; se descarta por ahora) | Mejorar: `perfilDiagnostico()` que convierte el diagnóstico (y lo respondido después) en niveles y prioridades; mostrarlo en Resultados y usarlo en la ruta |
| Refuerzo por competencia (qué evalúa, cómo lo preguntan, pasos, errores típicos, ejemplo, recursos, práctica) | Funciona | `Refuerzo.jsx`, `content/lecciones.json` (14 competencias, 7 habilidades) | Cumple "Explícame desde cero" en modo sin conexión. No está accesible desde la retroalimentación de una pregunta (hay que ir a Refuerzo) | Mejorar: botón "Explícame desde cero" en `Retro` que muestra la lección de la competencia de esa pregunta |
| Recomendaciones por reglas (error repetido, lento pero bien, prueba débil, habilidad débil, sin verificar, refuerzo pendiente) | Funciona | `reglas.js recomendar()`, editable en Admin | Ninguno | Reutilizar en la ruta semanal |
| Mi ruta (programa de 24 semanas por fases, horas por materia en modo carrera) | Funciona, genérico | `MiRuta.jsx`, `ciclo.js`, `programa.json` | Es el mismo plan para todos: no usa diagnóstico, ni tiempo disponible, ni grado, ni meta. No hay sesiones diarias | Nuevo módulo `ruta.js` ("Mi ruta para mejorar") que reutiliza ciclo + diagnóstico + reglas + carreras |
| Mi progreso (precisión, evolución semanal, por prueba/competencia/habilidad, errores por tipo, qué practicar) | Funciona | `MiProgreso.jsx`, `analitica.js` | Mide porcentaje de aciertos, no **aprendizaje real** (si el error se superó con una pregunta nueva) | Mejorar: `aprendizaje.js` con errores superados / en proceso / nuevos y mostrarlo |
| Mis errores (bitácora con "superado" si la última vez acertó o un refuerzo salió bien) | Funciona | `MisErrores.jsx` | Considera superado repetir la misma pregunta; eso mide memoria, no aprendizaje | Usar también la verificación con pregunta nueva |
| Informe de mejoramiento (puntajes 0-100 y 0-500, niveles, percentil nacional y local) | Funciona | `informes.js`, `Informe.jsx` | Ninguno | Reutilizar; agregar bloque de aprendizaje real |
| Simulacros (por sesión, completo, a escala) y mini-pruebas | Funciona | `pruebas.js`, `Simulacros.jsx`, `SesionPrueba.jsx` | Ninguno | Reutilizar en la ruta |
| Modo carrera (prioridades por carrera) | Funciona | `carreras.js`, `Carreras.jsx` | Ninguno | Reutilizar en la ruta (reparto de minutos) |
| Guía del ICFES (qué es, cómo se califica, para qué sirve, calendario, cómo prepararse, FAQ, universidades) | Funciona (contenido parcial) | `Guia.jsx`, `content/guia/*.json` | Solo Antioquia y Eje Cafetero en universidades. No hay sección de manejo del tiempo y ansiedad el día del examen | Agregar sección "Mente y tiempo" en `general.json` |
| Panel docente (grupo, estudiante, asignaciones, sesiones cada 21 días, informes) | Funciona | `docente/*` | Ninguno en este alcance | Sin cambios; los nuevos datos (razón, verificación) ya llegan por `intentos` |
| Registro de intentos y sincronización local → nube | Funciona | `datos.js registrarIntento()`, `sync.js` | Ninguno | Reutilizar; los campos nuevos viajan en el mismo JSON del intento |
| IA (completar/generar preguntas) | Implementado, no verificado en producción | `api/ia-preguntas.js` | Solo para docentes; no hay tutor para estudiantes | Fuera de esta fase: el tutor funciona sin IA con las lecciones; un endpoint de IA queda como pendiente documentado |
| Equidad: sin conexión (PWA + IndexedDB), móvil primero, todo gratis | Funciona | `vite.config.js`, `db.js` | Ninguno | Mantener: todo lo nuevo debe funcionar sin red |

## 3. Cobertura de las 18 necesidades del estudiante

| # | Necesidad | Hoy | Después de esta fase |
|---|---|---|---|
| 1 | Saber en qué está fallando | Parcial (porcentajes) | Perfil de diagnóstico con niveles y 3 prioridades |
| 2 | Entender por qué se equivocó | Sí | Sí, con mensaje según su razón |
| 3 | Que le expliquen desde cero | Parcial (en Refuerzo) | En la misma pregunta ("Explícame desde cero") |
| 4 | Practicar justo lo que le falla | Sí (práctica dirigida) | Sí, programada en la ruta |
| 5 | Comprobar que ya lo entendió | No (repite la misma pregunta) | Pregunta de verificación nueva + medición de aprendizaje |
| 6 | Saber qué hacer hoy | No | Sesión del día en la ruta |
| 7 | Plan realista con su tiempo | No | Minutos/día configurables |
| 8 | Meta clara | No | Meta de puntaje y brecha |
| 9 | Ver si está mejorando de verdad | Parcial | Errores superados / tendencia en preguntas nuevas |
| 10 | Prepararse para el formato y el tiempo del examen | Sí (simulacros, cronómetro) | Igual, programados en la ruta |
| 11 | Saber para qué sirve el ICFES | Sí (Guía) | Igual |
| 12 | Manejar ansiedad y tiempo | No | Sección "Mente y tiempo" |
| 13 | Funcionar sin internet y en celular | Sí | Igual |
| 14 | Que el docente vea lo mismo | Sí | Igual (los datos nuevos están en intentos) |
| 15 | No perder el hilo entre sesiones | Parcial | Ruta recuerda la semana y lo hecho |
| 16 | Motivación/constancia | Parcial | Días activos y objetivos cumplidos de la semana |
| 17 | Priorizar según su carrera | Sí | Sí, también en la ruta |
| 18 | Material nuevo por meses | Sí (planes) | Igual |

## 4. Plan de intervención (orden de ejecución)

1. **Explicación del error + verificación** (`feedback.js`, `Retro.jsx`, `Practica.jsx`, `banco.js`): mensaje por razón; `preguntaVerificacion()`; intento con `verificacion_de`. Sin cambios de BD (campo nuevo dentro del JSON del intento; en Supabase la tabla `intentos` ya guarda columnas conocidas: hay que confirmar si acepta el campo; si no, se descarta en `aFilaNube`).
2. **Perfil de diagnóstico** (`src/lib/diagnostico.js` nuevo, puro): niveles por competencia (floja/proceso/fuerte/sin datos) y prioridades; usado en Resultados y en la ruta.
3. **Medición del aprendizaje real** (`src/lib/aprendizaje.js` nuevo, puro): por competencia y tipo de error, con preguntas nuevas; "superado", "en proceso", "sin verificar".
4. **Mi ruta para mejorar** (`src/lib/ruta.js` nuevo + `MiRuta.jsx` ampliado): configuración (grado, fecha del examen, minutos/día, meta) guardada en el perfil; semana actual con objetivos y sesión por día; marca lo hecho leyendo los intentos (sin tablas nuevas).
5. **Tutor sin conexión** en `Retro` (lección de la competencia) y sección "Mente y tiempo" en la Guía.
6. **Panel de progreso**: bloque de aprendizaje real y constancia.
7. Pruebas unitarias (vitest) de la lógica pura; build; prueba manual con Playwright; publicación a `main`; informe final (§5) y `CONTINUAR.md`.

Riesgos: el perfil en Supabase necesita columna `ruta_config` (migración 005) o se guarda solo local con aviso, igual que carreras; se hace con RPC y respaldo local. Nada de lo nuevo rompe lo existente si la migración no se corre.

## 5. Informe final

(Se completa al terminar; ver abajo.)
