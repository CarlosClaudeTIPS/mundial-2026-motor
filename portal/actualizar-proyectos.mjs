/* YA NO ES NECESARIO: desde el 15/10/2026 todos los proyectos viven en la rama master.
   Se conserva solo por si alguna conversación antigua vuelve a empujar a su rama claude/*.
   Trae a esta rama la versión más reciente de cada proyecto desde su propia rama.
   Úsalo si editaste el ICFES, la tienda o apoyo docente en su conversación/rama
   y quieres que el portal los incluya. Luego: node portal/build.mjs
   Uso: node portal/actualizar-proyectos.mjs */
import { execSync } from "node:child_process";
const fuentes = [
  { carpeta: "apoyo-docente", rama: "claude/relaxed-ptolemy-h4qeca" },
  { carpeta: "tienda",        rama: "master" },
  { carpeta: "saber11-prep",  rama: "claude/compassionate-euler-iilze8" },
];
execSync("git fetch origin", { stdio: "inherit" });
for (const f of fuentes) {
  try {
    execSync(`git checkout origin/${f.rama} -- ${f.carpeta}`, { stdio: "inherit" });
    console.log(`✓ ${f.carpeta} actualizado desde ${f.rama}`);
  } catch { console.log(`· ${f.carpeta}: la rama ${f.rama} no tiene cambios o no existe; se deja como está`); }
}
console.log("\nListo. Revisa con `git status`, luego `git commit` y `git push`.");
