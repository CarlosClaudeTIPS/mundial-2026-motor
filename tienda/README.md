# Tienda digital (catálogo + pedidos por WhatsApp)

Sitio web estático, independiente del resto del repositorio, para exhibir productos y cerrar ventas por WhatsApp. No necesita servidor, base de datos ni suscripciones: se publica gratis en GitHub Pages, Netlify, Cloudflare Pages o Vercel.

```
tienda/
├── index.html          Portada
├── catalogo.html       Catálogo con buscador, filtros y orden
├── producto.html       Ficha de producto (producto.html?p=ID)
├── preguntas.html      Preguntas frecuentes
├── politicas.html      Entregas, pagos, cambios, privacidad
├── admin.html          Panel de administración (edita y exporta los datos)
├── data/config.json    Nombre, WhatsApp, colores, redes, políticas, analítica
├── data/catalogo.json  Categorías y productos
├── img/                Logo, portada y fotos de productos
├── p/                  Páginas estáticas por producto (generadas, opcional)
├── generar-paginas.mjs Genera p/ID.html con vista previa para redes
└── css/, js/           Estilos y lógica (sin frameworks)
```

## 1. Probarla en tu computador

Las páginas cargan los datos con `fetch`, así que hay que abrirlas desde un servidor local (no con doble clic):

```bash
cd tienda
python3 -m http.server 8080        # o: npx serve .
# abre http://localhost:8080
```

## 2. Configurar el negocio

Abre `admin.html` → pestaña **Configuración** y completa:

- Nombre, eslogan, logotipo (sube el archivo a `img/` y escribe la ruta).
- **Número de WhatsApp Business**: indicativo + número, sin `+` ni espacios (Colombia: `57` + 10 dígitos). Hasta que lo configures, la tienda muestra un aviso y los botones no abren WhatsApp.
- Mensajes predefinidos. Variables disponibles: `{nombre}`, `{precio}`, `{enlace}`, `{variantes}`, `{items}`, `{total}`.
- Redes sociales, colores de marca, textos del banner, bloques de confianza.
- Políticas reales (entregas, pagos, cambios, garantías, privacidad). Lo que dejes vacío se muestra como **pendiente**, nunca se inventa.
- Analítica: ID de Google Analytics 4 y/o Meta Pixel (opcional).

Pulsa **Guardar configuración** y luego **Descargar archivos**.

## 3. Agregar, editar y eliminar productos

En `admin.html` → **Productos**:

- **+ Nuevo producto**: nombre, categoría, precio, precio anterior (solo si es real), fotos, video, descripción, problema que resuelve, beneficios, especificaciones, qué incluye, instrucciones, precauciones, preguntas frecuentes, variantes (`Color: Negro, Blanco`), palabras clave y relacionados.
- Casillas: Disponible, Visible, Nuevo, Oferta, Destacado (sale en la portada), Popular.
- **Ocultar** retira un producto sin borrar su información. **Eliminar** lo borra.
- ▲ ▼ cambian el orden de visualización. **Enlace** copia la URL para compartir.
- **Categorías**: crear, editar, reordenar y eliminar (los productos huérfanos pasan a "Otros").
- **Importar / Exportar**: `catalogo.json`, `config.json` y CSV para Excel (listas separadas por `|`, especificaciones `Clave: valor | Clave: valor`, preguntas `Pregunta > Respuesta`).

### Cómo se publican los cambios (importante)

El panel guarda un **borrador en tu navegador**. Para que los clientes vean los cambios:

1. Pulsa **Vista previa** para revisar la tienda con el borrador.
2. Pulsa **Descargar archivos**: obtienes `catalogo.json` y `config.json`.
3. Reemplaza los dos archivos en `data/` del sitio publicado (súbelos a GitHub, Netlify, etc.). Si usas GitHub Pages, basta con arrastrarlos a la carpeta `tienda/data` en github.com y confirmar.

Las fotos se suben a mano a `img/` (recomendado 800×800 px, JPG/WebP < 200 KB; videos MP4 cortos). El panel no puede subir archivos porque no hay servidor.

## 4. Publicar la tienda y obtener el enlace

Opciones gratuitas (todas con HTTPS automático):

| Plataforma | Cómo | Enlace resultante |
|---|---|---|
| **GitHub Pages** | Settings → Pages → Deploy from branch, carpeta raíz. Como la tienda está en `tienda/`, la URL incluye esa carpeta. | `https://USUARIO.github.io/REPO/tienda/` |
| **Netlify** (recomendado) | "Add new site → Import from Git", *Base directory* = `tienda`, sin comando de build, *Publish directory* = `tienda`. O arrastra la carpeta `tienda` en app.netlify.com/drop. | `https://nombre.netlify.app` |
| **Cloudflare Pages** | Conectar repo, *Build output directory* = `tienda`. | `https://nombre.pages.dev` |
| **Vercel** | Importar repo, *Root Directory* = `tienda`, framework "Other". | `https://nombre.vercel.app` |

Si prefieres que la tienda sea su propio repositorio, copia la carpeta `tienda/` a uno nuevo; no depende de nada más.

### Vistas previas al compartir en redes

Los enlaces `producto.html?p=ID` funcionan siempre, pero Facebook/WhatsApp mostrarán la imagen genérica. Para que muestren la foto y el nombre de cada producto:

```bash
cd tienda
node generar-paginas.mjs https://TU-DOMINIO/ruta/     # crea p/ID.html y sitemap.xml
```

y activa **Configuración → Sitio → páginas estáticas**. Repite el comando cada vez que agregues productos (o automatízalo en la plataforma de publicación con el comando de build `node generar-paginas.mjs https://...`).

## 5. Costos

| Concepto | Costo | Notas |
|---|---|---|
| Alojamiento (GitHub Pages, Netlify, Cloudflare, Vercel) | **Gratis** | Planes gratuitos sobrados para un catálogo. |
| Dominio propio (`.com`, `.co`, `.com.co`) | ~USD 10–20 al año (`.com`) · `.co` suele costar más (~USD 25–35) | Opcional; sin dominio usas el subdominio gratuito. Verifica precios actuales en el registrador. |
| WhatsApp Business (app) | Gratis | Los enlaces `wa.me` no requieren la API de pago. |
| Google Analytics 4 / Meta Pixel | Gratis | Solo requieren crear las cuentas. |
| Generador de contenido del panel | Gratis | Plantillas locales. Una IA externa (ChatGPT, Claude, Gemini) tiene planes gratuitos y de pago. |
| Pagos en línea, API de WhatsApp, automatizaciones | No incluidos | Solo cuando el volumen lo justifique (Wompi/Mercado Pago cobran comisión por transacción). |

## 6. Qué incluye esta versión y qué no

Incluido y verificado: portada por secciones, categorías dinámicas, buscador con palabras clave, filtros (categoría, precio, novedades, ofertas, disponibilidad), orden, etiquetas Nuevo/Oferta/Agotado/Popular, ficha completa con galería y video, variantes que viajan en el mensaje de WhatsApp, botón flotante, botones en tarjetas, carrito con resumen por WhatsApp, atajos de envíos/pagos, páginas de preguntas y políticas, SEO básico (title, description, Open Graph, datos estructurados Product), eventos de analítica, panel admin con CRUD, orden, ocultar, duplicar, copiar enlace, importar/exportar JSON y CSV, generador de borradores por canal.

No incluido (y por qué):

- **Subida de fotos desde el panel**: requiere un servidor o un servicio de almacenamiento. Alternativa: subirlas a `img/` o usar URLs de un servicio gratuito como Cloudinary.
- **Inicio de sesión del panel**: no hace falta para la seguridad (el panel no puede modificar el sitio publicado), pero si no quieres que sea visible, no publiques `admin.html` y úsalo localmente.
- **Edición de fotos/videos con IA**: no existe en la página. Herramientas externas: CapCut (subtítulos, 9:16), Canva (fondos de producto), remove.bg (fondos).
- **Redacción con IA real**: el panel genera borradores por plantilla y un *prompt* para pegar en una IA externa. Conectar una IA directamente exigiría una clave de API expuesta o un servidor (costo mensual).
- **Pagos en línea e inventario automático**: fuera del alcance del modelo inicial.

## 7. Mejoras futuras (sin complicar la v1)

1. Dominio propio y Google Search Console (gratis) para aparecer en Google.
2. Automatizar `generar-paginas.mjs` como comando de build en Netlify/Cloudflare.
3. Formulario de pedido opcional (Netlify Forms, gratis hasta 100/mes) como respaldo cuando WhatsApp no esté disponible.
4. Catálogo de WhatsApp Business sincronizado a mano con el CSV exportado.
5. Si el volumen crece: CMS gratuito (Decap CMS) sobre los mismos JSON para editar con usuario y contraseña y subir fotos desde el navegador.

## 7a. Completar fichas con IA

En el editor de producto hay un botón **✨ Completar con IA**. Con solo nombre, categoría y precio rellena descripción, problema, beneficios, especificaciones (marcando «Pendiente de confirmar» lo que no pueda saber), qué incluye, instrucciones, precauciones, preguntas y palabras clave. Nunca pisa lo que ya escribiste; tú revisas y guardas.

Dos modos:

1. **Automático** (sitio publicado en Netlify). La función `netlify/functions/completar-producto.mjs` llama a la API de Claude con tu clave, que nunca sale del servidor. Configura en Netlify → Site configuration → Environment variables:
   - `ANTHROPIC_API_KEY`: clave creada en console.anthropic.com (requiere comprar créditos prepagados; el mínimo suele ser USD 5).
   - `ADMIN_SECRET`: una contraseña que inventes. La escribes una vez en el panel (botón → «¿Prefieres que sea automático?») y queda guardada en tu navegador. Sin ella nadie puede usar la función ni gastar tus créditos.
   Costo aproximado por producto con el modelo Claude Opus 5.5: USD 0,03 (unos 120 COP). 100 productos ≈ USD 3. Netlify Functions es gratis hasta 125 000 llamadas al mes.
2. **Manual** (gratis, sin publicar). Si la función no está disponible, el botón muestra un prompt para copiar en ChatGPT, Claude o Gemini y un cuadro para pegar la respuesta JSON, que se aplica al formulario.

También puedes pedirle a Claude Code en el chat: «agrega el producto X a $Y con esta foto» y él completa la ficha y la sube al repositorio.

## 7b. Seguridad y despliegue

- `_headers`: cabeceras de seguridad (CSP compatible con Google Fonts, GA4 y Meta Pixel) para Netlify y Cloudflare Pages.
- `netlify.toml`: publica la carpeta, genera las páginas `p/` con la URL real y despliega la función de IA. El panel admin se publica (no puede modificar el sitio; la función de IA exige `ADMIN_SECRET`).
- `AUDITORIA.md`: auditoría completa, métricas antes/después, pruebas y pendientes legales.

## 8. Prácticas de conversión aplicadas (basadas en investigación de usabilidad)

- Barra de navegación inferior en móvil (Inicio, Catálogo, Buscar, Carrito, WhatsApp), como las apps de Mercado Libre y Amazon.
- Autocompletado del buscador con productos y categorías mientras se escribe.
- Galería deslizable con puntos, contador y zoom a pantalla completa; miniaturas visibles (Baymard: solo el 24 % de los sitios móviles las muestra).
- Barra de compra fija que aparece solo cuando el bloque de compra sale de pantalla.
- Señales de confianza junto al botón de compra, no en el pie de página.
- Selector de cantidad; la cantidad y la variante viajan en el mensaje de WhatsApp.
- Segunda foto al pasar el cursor sobre la tarjeta y descripción corta en la tarjeta.
- Carruseles horizontales en la portada móvil y sección «Vistos recientemente».
- Contenido completo visible en la ficha (sin esconderlo en subpáginas, un error frecuente en móvil según Baymard).

## 9. Seguir trabajando desde otro computador

El código vive en el repositorio `CarlosClaudeTIPS/mundial-2026-motor`, rama `claude/gifted-clarke-y62a56`, carpeta `tienda/`. En el otro PC:

```bash
git clone https://github.com/CarlosClaudeTIPS/mundial-2026-motor.git
cd mundial-2026-motor
git checkout claude/gifted-clarke-y62a56
cd tienda
python3 -m http.server 8080      # abre http://localhost:8080
```

Para guardar cambios:

```bash
git add tienda
git commit -m "Describe el cambio"
git push
```

Para moverla a su propio repositorio (recomendado cuando la publiques): crea un repositorio vacío en GitHub, copia la carpeta `tienda/` dentro, y ejecuta `git init && git add . && git commit -m "Tienda digital" && git branch -M main && git remote add origin URL && git push -u origin main`. No depende de ningún otro archivo del repositorio actual.
