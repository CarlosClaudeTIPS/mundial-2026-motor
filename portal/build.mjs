/* Arma el portal unificado en portal/dist a partir de las carpetas de cada proyecto.
   Uso:  node portal/build.mjs            → base /icfes/ (para Vercel / dominio propio)
         BASE=./ node portal/build.mjs    → rutas relativas (vista previa)
   Cada proyecto sigue viviendo en su carpeta y se edita por separado. */
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync, symlinkSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const dist = join(here, "dist");
const BASE = process.env.BASE || "/icfes/";

rmSync(dist, { recursive: true, force: true }); mkdirSync(dist, { recursive: true });

// 1. Portada y recursos compartidos
cpSync(join(here, "site"), dist, { recursive: true });

// 2. Apoyo docente → /docentes
cpSync(join(root, "apoyo-docente"), join(dist, "docentes"), { recursive: true, filter: (p) => !/README\.md$|\/fuentes(\/|$)/.test(p) });

// 3. Tienda → /tienda
cpSync(join(root, "tienda"), join(dist, "tienda"), { recursive: true, filter: (p) => !/README\.md$|generar-paginas\.mjs$/.test(p) });

// 4. ICFES (app React) → /icfes  (se construye en una copia temporal para no tocar el proyecto)
const src = join(root, "saber11-prep"), tmp = join(here, ".tmp-icfes");
rmSync(tmp, { recursive: true, force: true });
cpSync(src, tmp, { recursive: true, filter: (p) => !/node_modules|\/dist(\/|$)|\.git(\/|$)/.test(p) });
symlinkSync(join(src, "node_modules"), join(tmp, "node_modules"), "dir");
// rutas absolutas del icono → relativas a la base
for (const f of walk(join(tmp, "src")).filter((f) => /\.jsx?$/.test(f))) {
  const t = readFileSync(f, "utf8").replace(/src="\/icono\.svg"/g, 'src={import.meta.env.BASE_URL + "icono.svg"}');
  writeFileSync(f, t);
}
execSync(`npx vite build --base=${BASE} --outDir ${JSON.stringify(join(dist, "icfes"))} --emptyOutDir`, { cwd: tmp, stdio: "inherit" });
rmSync(tmp, { recursive: true, force: true });

// 5. Barra común en cada página de las secciones
for (const f of walk(dist).filter((f) => f.endsWith(".html") && relative(dist, f) !== "index.html")) {
  const up = relative(dirname(f), dist).split("\\").join("/") || ".";
  const tag = `<link rel="stylesheet" href="${up}/shared/barra.css"><script src="${up}/shared/portal.config.js"></script><script defer src="${up}/shared/barra.js"></script>`;
  const html = readFileSync(f, "utf8");
  if (!html.includes("shared/barra.js")) writeFileSync(f, html.replace(/<\/head>/i, tag + "\n</head>"));
}

// 6. Vercel: la configuración vive en portal/vercel.json y las funciones en portal/api (reexportan las del ICFES)

console.log("Portal listo en", relative(root, dist), "· base ICFES:", BASE, "·", walk(dist).length, "archivos");

function walk(d) { return readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; }); }
