---
description: Sincronizar al empezar — baja los cambios del otro PC y resume qué hay de nuevo
---

Rutina de inicio de sesión de trabajo en el Motor de Apuestas:

1. Corre `git pull` en la carpeta del proyecto.
2. Si bajaron commits nuevos, lista en 2-3 puntos qué cambió (mensajes de commit en lenguaje simple) y a qué hora fueron.
3. Verifica que el proyecto compila (`npx vite build`). Si algo se rompió con el merge, arréglalo.
4. Confirma en una línea: "Sincronizado ✅ — [resumen]" o "Ya estabas al día".

No despliegues a Vercel en este paso — solo sincronizar y verificar.
