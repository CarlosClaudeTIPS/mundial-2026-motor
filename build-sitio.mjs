/* Construye el sitio completo para Vercel en dist/:
     /            portal de tres puertas (portal/site)
     /icfes/      app ICFES (saber11-prep, construida con Vite)
     /docentes/   apoyo docente (estático)
     /tienda/     tienda (estática)
     /motor/      Motor Mundial 2026 (esta app React, sin cambios en su código)
   Uso: npm run build   (Vercel lo ejecuta solo en cada push a master) */
import { rmSync, mkdirSync, cpSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const run = (cmd, cwd) => execSync(cmd, { stdio: "inherit", cwd });
rmSync("dist", { recursive: true, force: true }); mkdirSync("dist");

// 1. Dependencias del ICFES (una vez por build)
if (!existsSync("saber11-prep/node_modules")) run("npm ci --no-audit --no-fund", "saber11-prep");

// 2. Portal + secciones → portal/dist → dist/
run("node portal/build.mjs");
cpSync("portal/dist", "dist", { recursive: true });

// 3. Motor Mundial → dist/motor (base /motor/)
run("npx vite build --base=/motor/ --outDir dist/motor --emptyOutDir");

console.log("Sitio completo en dist/: portal, icfes, docentes, tienda y motor");
