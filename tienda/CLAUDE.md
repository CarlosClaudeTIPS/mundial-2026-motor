# Tienda digital — instrucciones para Claude Code

- Esta carpeta es un proyecto independiente. No tocar `src/`, `api/`, `supabase/`, `saber11-prep/`, `apoyo-docente/` ni `portal/` al trabajar en la tienda.
- La tienda se publica en `/tienda/` dentro del portal (`build-sitio.mjs` en la raíz la copia y le añade la barra común `portal/site/shared/barra.js`). No hace falta configurar nada para eso.
- **Antes de cualquier cambio, traer lo último del repositorio** (`git fetch origin master && git merge --ff-only origin/master`). El dueño trabaja desde varios computadores y sus cambios deben respetarse siempre.
- Después de cada cambio: probar con un servidor local (`python3 -m http.server`), hacer commit y `git push` a `master` (o a la rama indicada) sin que el usuario tenga que pedirlo.
- Si el usuario comparte `catalogo.json` o `config.json` exportados desde `admin.html`, reemplazarlos en `data/` y subirlos.
- No inventar datos del negocio (número de WhatsApp, políticas, precios anteriores, reseñas). Lo que falte se deja como pendiente.
- Lee `README.md` de esta carpeta para la estructura, el modelo de datos y la publicación.
