---
description: Cerrar el día — sube todo a GitHub y actualiza la web en Vercel
---

Rutina de cierre de sesión de trabajo en el Motor de Apuestas:

1. Verifica que el proyecto compila (`npx vite build`). Si no compila, arréglalo antes de subir nada.
2. `git add -A` y `git commit` con un mensaje descriptivo REAL de lo que se hizo en esta sesión (revisa el diff si hace falta — nunca un mensaje genérico).
3. `git push origin main`.
4. Despliega a Vercel: `npx vercel build --prod --yes` y luego `npx vercel deploy --prebuilt --prod --yes` (si da "Not authorized" transitorio, reintenta el deploy una vez).
5. Confirma: "Subido y desplegado ✅ — https://motor-apuestas-xi.vercel.app" con un resumen de 1-2 líneas de lo que quedó publicado.

Si no hay cambios que subir, dilo y no hagas deploy.
