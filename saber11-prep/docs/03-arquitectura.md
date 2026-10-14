> **Nota (14-oct-2026):** la aplicación no usa inteligencia artificial en ningún componente, por decisión del proyecto. Las menciones a IA en este documento son históricas (diseño inicial) y no se implementarán.

# PARTE 3 — Arquitectura del producto

Documenta la arquitectura **tal como está implementada** en el repositorio (no la ideal). Referencias de código: `vite.config.js`, `src/lib/db.js`, `src/lib/sync.js`, `src/lib/sesion.js`, `src/lib/supabase.js`, `supabase/schema.sql`, `api/estudiantes.js`, `.env.example`.

## 1. Criterios (sección 43 del prompt)

Presupuesto limitado, mantenimiento por un desarrollador pequeño, PWA, funcionamiento offline (colegios públicos), seguridad y datos de menores, posibilidad de usar IA más adelante, base de datos y almacenamiento de archivos. Principio rector: **simple → funcional → medible → mejorable → inteligente**.

## 2. Alternativas consideradas

| Criterio | A. Supabase + Vercel (elegida) | B. Node + SQLite autoalojado | C. Firebase |
|---|---|---|---|
| Costo inicial | 0 (capas gratuitas) | VPS ≈ 5–10 USD/mes + dominio | 0 (Spark) |
| Mantenimiento | Bajo: Postgres, Auth y RLS gestionados; despliegue por `git push` | Alto: sistema operativo, copias, TLS, actualizaciones, monitoreo | Bajo |
| Offline / PWA | Neutro: el offline se resuelve en el cliente (IndexedDB), no depende del backend | Igual | Firestore trae caché offline, pero acopla el modelo a documentos NoSQL |
| Seguridad | RLS por fila en SQL, auditable en un archivo (`schema.sql`) | Hay que escribir toda la autorización a mano | Reglas de seguridad propietarias, difíciles de probar |
| Consultas analíticas | SQL completo (vistas, `filter (where …)`) | SQL completo | Agregaciones limitadas; el panel docente exigiría duplicar datos |
| Portabilidad | Postgres estándar: exportable con `pg_dump` | Total | Baja (lock-in) |
| Desarrollador pequeño | Un solo lenguaje (JS), sin servidores que operar | Requiere operar infraestructura | Fácil, pero el modelo relacional del dominio (intentos por pregunta, agregados por competencia) encaja mal |
| IA futura | Funciones serverless en Vercel + `pgvector` disponible en Supabase | Se puede, con más trabajo | Extensiones propietarias |

**Decisión:** React 18 + Vite + Tailwind en el cliente, Dexie/IndexedDB como almacenamiento primario, Supabase (Postgres + Auth + RLS) opcional para sincronizar, Vercel para hospedar el sitio estático y una función de servidor. Razones: cubre todos los criterios sin operar servidores, el dominio es relacional (SQL), y **es la misma pila que el otro proyecto de Carlos**, lo que reduce la curva de aprendizaje y permite reutilizar decisiones, scripts y hábitos de despliegue.

Lo descartado a propósito (sección 56): aplicación nativa, microservicios, cola de mensajes, contenedores, base de datos de grafos, motor de búsqueda externo.

## 3. Arquitectura local-first

La app funciona completa **sin backend**. Supabase es una capa opcional que se activa solo si existen `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (`src/lib/supabase.js` exporta `NUBE_DISPONIBLE`).

```
┌──────────────────────── Navegador / PWA ─────────────────────────┐
│  React 18 (Vite)  ·  enrutador por hash (src/lib/nav.js)          │
│                                                                    │
│  Capa de datos (src/lib/*.js)                                      │
│   banco.js  datos.js  pruebas.js  analitica.js  reglas.js          │
│   feedback.js  ciclo.js  taxonomia.js  sesion.js  demo.js          │
│                    │ escribe primero aquí                          │
│                    ▼                                               │
│  IndexedDB "saber11" (Dexie, src/lib/db.js)                        │
│   preguntas · intentos · usuarios · grupos · asignaciones          │
│   sesiones · recursos · ciclos · config · cola                     │
│                    │ cada escritura agrega una fila a `cola`       │
│                    ▼                                               │
│  sync.js: cola ─► upsert por clave (uid/id) ─► Supabase            │
│   dispara: al arrancar, al volver `online`, cada 60 s, botón       │
│   descargarDeNube(): baja asignaciones/grupos/perfiles/intentos…   │
└────────────────────────────────┬───────────────────────────────────┘
                                 │ HTTPS (anon key + JWT de sesión)
┌────────────────────────────────▼───────────────────────────────────┐
│ Supabase: Postgres + Auth + RLS (supabase/schema.sql)              │
│  perfiles · grupos · ciclos · preguntas · intentos · sesiones      │
│  asignaciones · recursos · vista resumen_estudiante                │
└────────────────────────────────┬───────────────────────────────────┘
                                 │ service role (solo servidor)
┌────────────────────────────────▼───────────────────────────────────┐
│ Vercel: sitio estático (dist/) + función api/estudiantes.js        │
│  POST /api/estudiantes: crea usuarios de Auth con correo sintético │
│  <usuario>@estudiantes.saber11.local y contraseña = PIN            │
└────────────────────────────────────────────────────────────────────┘
```

Piezas clave:

- **Banco empaquetado.** `content/banco/*.json` se importan con `import.meta.glob` y se siembran en IndexedDB en el arranque (`sembrarBanco`). Una huella (hash) del JSON evita resembrar si no cambió; las preguntas con `editada_local` no se sobrescriben.
- **Arranque único** (`App.jsx → arrancar()`): aplica extensión de taxonomía, siembra banco, asegura ciclos, crea datos demo (solo modo local), restaura sesión, inicia sync.
- **PWA** (`vite-plugin-pwa`, `registerType: 'autoUpdate'`): Workbox precachea `js, css, html, svg, png, woff2` y `navigateFallback: /index.html`. Manifest `standalone`, `lang es-CO`. Los datos no viven en la caché del service worker sino en IndexedDB, por eso la práctica funciona sin red.
- **Sesión.** Modo local: usuario + PIN (SHA-256 de `saber11:<pin>` vía Web Crypto, en `usuarios.pin_hash`). Modo nube: docentes/admin con correo y contraseña de Supabase Auth; estudiantes con código + PIN convertido a correo sintético. La sesión se persiste en `config.sesion_usuario_id`.
- **Sincronización.** `TABLAS = { intentos: 'uid', usuarios: 'id', grupos, asignaciones, sesiones, recursos: 'id' }`; cada fila de `cola` se envía con `upsert(..., { onConflict: clave })` y se borra de la cola al confirmar. `aFilaNube` quita `sincronizado`, `semilla` y, para usuarios, `pin_hash` (el PIN nunca viaja como hash a la tabla de perfiles).

## 4. Limitaciones del modo sin conexión y de seguridad

Están declaradas en el encabezado de `sync.js` y aquí se amplían:

1. **Última escritura gana.** No hay resolución de conflictos ni control de versiones por fila. En la práctica los `intentos` se crean una vez desde un solo dispositivo, así que no colisionan; `sesiones` y `recursos` sí podrían pisarse si se editan en dos equipos.
2. **Lectura de otros dispositivos solo al recargar.** `descargarDeNube` corre al iniciar sesión; no hay suscripción en tiempo real. El docente ve lo que sus estudiantes sincronizaron hasta ese momento.
3. **Datos visibles en el navegador.** IndexedDB es legible con las herramientas de desarrollador. En un celular o computador compartido, quien lo use puede ver intentos y nombres de otros estudiantes que iniciaron sesión ahí. Mitigaciones existentes: PIN por estudiante, botón de salir, minimización de datos (solo nombre, usuario, curso, colegio y resultados). Mitigación pendiente: borrar tablas locales al cerrar sesión (hoy no se hace).
4. **Cola no cifrada** y sin límite de tamaño; si el estudiante nunca vuelve a tener red, los datos solo existen en su equipo. El respaldo JSON desde Administración es la única copia en modo local.
5. **PIN de 4 dígitos como contraseña de Auth** en modo nube: cómodo para menores, débil ante fuerza bruta. Supabase limita intentos, pero conviene PIN de 6 dígitos para docentes y correo real para ellos (ya es así).
6. **Modo nube sin probar contra un proyecto real.** `sync.js` mapea la tabla local `usuarios` a `perfiles` y `Grupo.jsx` inscribe estudiantes a través de `api/estudiantes.js` cuando hay nube, pero el flujo completo (Auth + RLS + función en Vercel) todavía no se ha ejecutado contra un proyecto Supabase real.
7. **Reglas editadas en Administración** se guardan en `config.reglas` y `reglasVigentes()` las fusiona con las de por defecto antes de llamar a `recomendar()`.
8. **Preguntas editadas en la app** se encolan (`guardarPregunta` → tabla `preguntas`) y viajan a la nube con upsert; la exportación JSON sigue siendo el respaldo en modo local.
9. **Sin cifrado de transporte adicional ni rate limiting propio**; se confía en HTTPS de Vercel/Supabase y en RLS.

## 5. Despliegue

1. `npm install && npm run build` genera `dist/`. En Vercel basta importar el repo (framework Vite); la carpeta `api/` se despliega como funciones serverless.
2. Variables en Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (expuestas al cliente, es lo esperado) y `SUPABASE_SERVICE_ROLE_KEY` (**solo servidor, nunca con prefijo `VITE_`**, ver `.env.example`).
3. En Supabase: crear proyecto, ejecutar `supabase/schema.sql` en el SQL Editor, crear docentes/admin en Auth y su fila en `perfiles`.
4. Sin variables, el mismo build corre en **modo local** (útil para demo, colegios sin conectividad, o servir desde un computador del aula con `INICIAR-SABER11.bat`, que instala dependencias y abre `http://localhost:5180`).
5. Desarrollo: `npm run dev` (puerto 5180, `.claude/launch.json`), `npm test` (Vitest, `tests/logica.test.js`), `npm run validar-banco`.

## 6. Costos estimados

| Recurso | Capa gratuita | Suficiente para |
|---|---|---|
| Vercel Hobby | 100 GB de transferencia/mes, funciones serverless incluidas | Un colegio o varios; el sitio pesa < 1 MB |
| Supabase Free | 500 MB Postgres, 50 000 usuarios activos/mes de Auth, 5 GB de egreso | Decenas de grupos: un intento pesa < 1 KB; 200 estudiantes × 2 000 intentos ≈ 400 MB en el peor caso, por eso se recomienda exportar y purgar ciclos cerrados (ver PARTE 5) |
| Dominio | 10–15 USD/año (opcional) | — |
| Almacenamiento de archivos | No se usa: la biblioteca guarda enlaces y metadatos, no copias (PARTE 7) | — |

Costo mensual esperado en fase MVP: **0 USD**. El primer costo real aparecería al pasar Supabase a Pro (25 USD/mes) por retención de datos o por la pausa automática de proyectos inactivos en la capa gratuita, que conviene tener presente en vacaciones escolares.
