# Continuar el trabajo en otro computador

Todo está guardado en GitHub, en el repositorio `CarlosClaudeTIPS/mundial-2026-motor`.
Nada vive solo en el computador donde se hizo.

## 1. Descargar el repositorio

Necesitas tener instalado [Git](https://git-scm.com/downloads) y [Node.js](https://nodejs.org) (versión 20 o superior).

```bash
git clone https://github.com/CarlosClaudeTIPS/mundial-2026-motor.git
cd mundial-2026-motor
```

## 2. Qué hay en cada rama

| Rama | Qué contiene |
|---|---|
| `claude/portal-unificado` | **La más completa.** Portal con las tres puertas + apoyo docente + tienda + ICFES. Empieza por aquí. |
| `claude/relaxed-ptolemy-h4qeca` | Solo la página de apoyo docente (`apoyo-docente/`). |
| `claude/compassionate-euler-iilze8` | Solo la app del ICFES (`saber11-prep/`). |
| `claude/gifted-clarke-y62a56` | Solo la tienda (`tienda/`). |
| `main` | Motor Mundial 2026 (otro proyecto, no se toca). |

Para ponerte en la rama del portal:

```bash
git checkout claude/portal-unificado
```

## 3. Ver cada cosa en el navegador

**Apoyo docente** (no necesita instalar nada):
```bash
cd apoyo-docente
python -m http.server 8080
```
y abre http://localhost:8080

**Tienda**:
```bash
cd tienda
python -m http.server 8081
```

**ICFES** (la primera vez instala dependencias):
```bash
cd saber11-prep
npm ci
npm run dev -- --port 5180
```

**Portal completo** (las tres juntas con la portada):
```bash
cd saber11-prep && npm ci && cd ..
node portal/build.mjs
cd portal/dist
python -m http.server 8090
```
y abre http://localhost:8090

## 4. Dónde se cambian los textos

| Quiero cambiar… | Archivo |
|---|---|
| Nombre de la marca y pestañas del portal | `portal/site/shared/portal.config.js` |
| WhatsApp, servicios, ejemplos y preguntas de apoyo docente | `apoyo-docente/config.js` |
| Nombre, WhatsApp y productos de la tienda | `tienda/data/config.json` y `tienda/data/catalogo.json` (o `tienda/admin.html` en el navegador) |
| Banco de preguntas del ICFES | `saber11-prep/content/banco/` |

## 4b. Si cambiaste un proyecto en su propia conversación

Cada proyecto puede seguir editándose en su propia rama. Para que el portal
incluya esos cambios, desde la rama `claude/portal-unificado`:

```bash
node portal/actualizar-proyectos.mjs
node portal/build.mjs
git add . && git commit -m "actualizar proyectos en el portal" && git push
```

## 5. Guardar cambios en GitHub

```bash
git add .
git commit -m "describe lo que cambiaste"
git push
```

## 6. Seguir con Claude Code desde el otro PC (o desde la web)

Nada depende de un computador en particular: todo se lee de GitHub.
- **Claude Code en la web** (claude.ai/code): elige el repositorio `mundial-2026-motor`
  y pide trabajar en la rama `claude/portal-unificado`. No necesitas descargar nada.
- **Claude Code instalado en el otro PC**: abre la carpeta del repositorio y pídele lo que necesites.
Verá las mismas carpetas y ramas. Si quieres seguir una conversación anterior,
dile en qué rama trabajar (por ejemplo: «trabaja en la rama claude/portal-unificado»).

## 7. Vistas previas publicadas

- Apoyo docente: https://claude.ai/artifact/QbwsQTY5ojVWWyfsg3NgNZ
- Portal unificado (prueba): https://claude.ai/artifact/KtjAKB8wc9KLYsSEbMDA1m

Son privadas; se comparten desde el menú «Compartir» de cada una.

## 8. Publicar en internet

Ver `portal/README.md` (sección «Publicar en Vercel») y `apoyo-docente/README.md` (sección 4).
