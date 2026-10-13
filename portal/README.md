# Portal unificado (rama de prueba)

Una portada con pestañas que reúne los proyectos del repositorio bajo un solo dominio:

| Dirección | Carpeta de origen | Tipo |
|---|---|---|
| `/` | `portal/site/` | Portada con las puertas |
| `/icfes/` | `saber11-prep/` | App React (se construye con Vite) |
| `/docentes/` | `apoyo-docente/` | Sitio estático |
| `/tienda/` | `tienda/` | Sitio estático |

Cada proyecto se sigue editando en su propia carpeta. El portal solo los **copia y construye** en `portal/dist/`.

## Armar el portal

```bash
node portal/build.mjs          # para Vercel o dominio propio (ICFES en /icfes/)
BASE=./ node portal/build.mjs  # rutas relativas (vista previa local)
```
Requiere haber instalado las dependencias del ICFES una vez: `cd saber11-prep && npm ci`.

## Cambiar la marca o agregar una pestaña

Todo está en `portal/site/shared/portal.config.js`: nombre de la marca, lema y la lista de secciones (nombre, carpeta, color, textos). Para un proyecto nuevo, crea su carpeta, agrégalo a la lista y vuelve a armar.

## Publicar en Vercel

Proyecto nuevo en Vercel apuntando a este repositorio con:
- Build command: `cd saber11-prep && npm ci && cd .. && node portal/build.mjs`
- Output directory: `portal/dist`

El `vercel.json` generado en `dist/` deja la app del ICFES como aplicación de una sola página y expone sus funciones de `api/`.
