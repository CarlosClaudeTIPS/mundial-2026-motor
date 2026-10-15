# Portal unificado

Una portada con pestañas que reúne los proyectos del repositorio bajo un solo dominio:

| Dirección | Carpeta de origen | Tipo |
|---|---|---|
| `/` | `portal/site/` | Portada con las puertas |
| `/icfes/` | `saber11-prep/` | App React (se construye con Vite) |
| `/docentes/` | `apoyo-docente/` | Sitio estático |
| `/tienda/` | `tienda/` | Sitio estático |

Cada proyecto se sigue editando en su propia carpeta. El portal solo los **copia y construye** en `portal/dist/`.

> **Publicación actual:** el sitio de Vercel `mundial-2026-motor.vercel.app` publica la rama `master` con `build-sitio.mjs` (en la raíz del repositorio), que arma este portal en `/` y añade el Motor Mundial en `/motor/`. No hace falta crear otro proyecto de Vercel salvo que quieras un dominio aparte.

## Armar el portal

```bash
node portal/build.mjs          # para Vercel o dominio propio (ICFES en /icfes/)
BASE=./ node portal/build.mjs  # rutas relativas (vista previa local)
```
Requiere haber instalado las dependencias del ICFES una vez: `cd saber11-prep && npm ci`.

## Cambiar la marca o agregar una pestaña

Todo está en `portal/site/shared/portal.config.js`: nombre de la marca, lema y la lista de secciones (nombre, carpeta, color, textos). Para un proyecto nuevo, crea su carpeta, agrégalo a la lista y vuelve a armar.

## Publicar en Vercel (gratis) y conectar el dominio

1. Entra a https://vercel.com con tu cuenta de GitHub → **Add New → Project** → elige `mundial-2026-motor`.
2. En la configuración del proyecto:
   - **Root Directory:** `portal`
   - **Framework Preset:** Other
   - **Build Command:** `npm run build` (ya viene en `portal/package.json`)
   - **Output Directory:** `dist`
   - **Production Branch:** `main`
3. Variables de entorno (solo si quieres el ICFES con nube; sin ellas funciona en modo local):
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` (opcional, botones de IA).
4. **Deploy.** En dos o tres minutos tendrás una dirección `algo.vercel.app` con las tres secciones.
5. Dominio propio: **Settings → Domains → Add** → escribe `tumarca.com`. Vercel te muestra dos registros
   (un `A` y un `CNAME`). Los copias en el panel de tu registrador (Porkbun o MI.COM.CO) → DNS. En menos de una hora responde.

Cada vez que hagas `git push` a `main`, Vercel vuelve a publicar solo.

`portal/vercel.json` deja la app del ICFES como aplicación de una sola página y `portal/api/` publica
sus funciones de servidor (`/api/estudiantes`, `/api/ia-preguntas`).
