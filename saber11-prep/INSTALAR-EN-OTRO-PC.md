# Abrir este proyecto en otro PC

## Si solo quieres USAR la app (docente o estudiantes)

No hay que instalar nada. Entra desde cualquier navegador o celular a:

**https://saber11-prep.vercel.app**

## Si quieres EDITAR el proyecto con Claude en el otro PC

1. Instala **Git** (https://git-scm.com/download/win) y **Node.js LTS** (https://nodejs.org) si no los tienes.
2. Abre PowerShell en la carpeta donde quieras el proyecto (por ejemplo `Documentos`) y ejecuta:

```powershell
git clone https://github.com/CarlosClaudeTIPS/saber11-prep.git Saber11
```

3. Entra a la carpeta `Saber11` y haz doble clic en `INICIAR-SABER11.bat`. La primera vez instala las dependencias y crea el archivo `.env.local` con la conexión a la nube (son claves públicas). Abre http://localhost:5180.
4. Abre la carpeta `Saber11` en Claude Code y continúa. Para traer cambios hechos en el otro PC: `git pull`. Para subir los tuyos: `git add -A`, `git commit -m "mensaje"`, `git push`.

Nota: Vercel solo publica commits cuyo autor coincide con tu cuenta de GitHub. En el otro PC configura una vez, dentro de la carpeta del proyecto:

```powershell
git config user.name "CarlosClaudeTIPS"
git config user.email "293462398+CarlosClaudeTIPS@users.noreply.github.com"
```
