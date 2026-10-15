#!/usr/bin/env node
/**
 * Genera una página estática por producto en p/<id>.html con metaetiquetas
 * Open Graph (imagen, nombre y descripción) para que Facebook, WhatsApp e
 * Instagram muestren una vista previa correcta al compartir el enlace.
 *
 * Uso (desde la carpeta tienda/):   node generar-paginas.mjs [https://tu-dominio.com/ruta/]
 * Luego activa "paginasEstaticas": true en data/config.json (o en el panel admin).
 * Las páginas generadas cargan el mismo JavaScript que producto.html, así que
 * el contenido sigue saliendo de data/catalogo.json.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = dirname(fileURLToPath(import.meta.url));
const urlBase = process.argv[2] ? process.argv[2].replace(/\/?$/, '/') : '';
const catalogo = JSON.parse(readFileSync(join(raiz, 'data/catalogo.json'), 'utf8'));
const config = JSON.parse(readFileSync(join(raiz, 'data/config.json'), 'utf8'));
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const abs = (ruta) => /^https?:\/\//.test(ruta) ? ruta : (urlBase ? urlBase + ruta : '../' + ruta);

mkdirSync(join(raiz, 'p'), { recursive: true });
for (const f of readdirSync(join(raiz, 'p'))) if (f.endsWith('.html')) unlinkSync(join(raiz, 'p', f));

let n = 0;
for (const p of catalogo.productos) {
  if (p.visible === false) continue;
  const desc = (p.descripcionCorta || p.descripcion || '').slice(0, 155);
  const imagen = abs((p.imagenes && p.imagenes[0]) || 'img/og-default.jpg');
  const titulo = `${p.nombre} · ${config.negocio?.nombre || ''}`;
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="../">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(urlBase ? urlBase + 'p/' + p.id + '.html' : 'p/' + p.id + '.html')}">
<meta property="og:type" content="product">
<meta property="og:title" content="${esc(p.nombre)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(imagen)}">
<meta property="og:site_name" content="${esc(config.negocio?.nombre || '')}">
<meta property="product:price:amount" content="${Number(p.precio) || 0}">
<meta property="product:price:currency" content="COP">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="${esc(config.marca?.colorPrimario || '#1e3a5f')}">
<link rel="icon" href="img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=optional" rel="stylesheet">
<link rel="stylesheet" href="css/estilos.css">
</head>
<body data-producto="${esc(p.id)}">
<header class="encabezado" id="encabezado"></header>
<main class="contenedor" id="producto"><div class="ficha-esqueleto"><div class="esqueleto"></div><div class="esqueleto"></div></div></main>
<footer class="pie" id="pie"></footer>
<script src="js/app.js"></script>
<script src="js/producto.js"></script>
</body>
</html>
`;
  writeFileSync(join(raiz, 'p', `${p.id}.html`), html);
  n++;
}
/* sitemap sencillo */
if (urlBase) {
  const urls = ['', 'catalogo.html', 'preguntas.html', 'politicas.html', ...catalogo.productos.filter(p => p.visible !== false).map(p => `p/${p.id}.html`)];
  writeFileSync(join(raiz, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${esc(urlBase + u)}</loc></url>`).join('\n')}\n</urlset>\n`);
  console.log('sitemap.xml generado');
}
console.log(`${n} página(s) de producto generadas en p/. ${urlBase ? 'URL base: ' + urlBase : 'Sin URL base: las rutas de imagen OG son relativas; pasa tu dominio como argumento antes de publicar.'}`);
