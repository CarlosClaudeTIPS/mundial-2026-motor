# Apoyo docente personalizado — sitio web

Página web estática (HTML + CSS + JavaScript) para ofrecer apoyo y acompañamiento personalizado a docentes en Colombia.
No necesita servidor, base de datos ni pagos para funcionar. Se puede publicar gratis.

> **Principio del proyecto:** no vender documentos genéricos, sino apoyo con un alcance definido según la necesidad, el contexto, los objetivos y el tiempo de cada docente.

## Estructura

```
apoyo-docente/
├── index.html          ← la página (no hace falta tocarla para cambiar textos)
├── config.js           ← TODO el contenido editable: WhatsApp, marca, servicios, ejemplos, FAQ
├── assets/
│   ├── css/styles.css  ← diseño
│   ├── js/app.js       ← funcionamiento (pestañas, portafolio, formulario, WhatsApp)
│   ├── img/            ← favicon, imagen para compartir, foto de la profesional
│   └── portafolio/     ← aquí van las capturas o PDF de ejemplos reales
└── README.md
```

## 1. Lo primero: configurar el WhatsApp

Abre `config.js` y cambia:

```js
whatsapp: "573000000000",   // tu número con el 57 delante, sin "+", espacios ni guiones
```

Todos los botones de WhatsApp de la página usan ese único número.

## 2. Cambiar textos, servicios, ejemplos y preguntas

Todo está en `config.js`, organizado por bloques numerados. Solo se editan los textos entre comillas.

| Quiero cambiar… | Bloque en config.js |
|---|---|
| Nombre de la marca, lema, foto | `marca` |
| Número, correo, horario, mensaje inicial de WhatsApp | `contacto` |
| Tarjetas resumen de la portada | `areas` |
| Detalle de cada servicio (qué se puede pedir, para qué sirve, qué se necesita) | `servicios` |
| Ejemplos del portafolio | `portafolio` |
| Ejemplos de flexibilidad (sección «Cómo trabajamos») | `ejemplosFlexibilidad` |
| Modalidades orientativas (sección «Cotización») | `modalidades` |
| Preguntas frecuentes | `faq` |

Los textos de la portada, el proceso de 4 pasos, las condiciones y la política de privacidad están directamente en `index.html` (busca el texto y cámbialo).

### Poner la foto de la profesional
1. Guarda la foto (o la ilustración basada en ella) en `assets/img/`, por ejemplo `perfil.png` (cuadrada, mínimo 600×600 px).
2. En `config.js`: `foto: "assets/img/perfil.png"`.
Si `foto` queda vacío, se muestra la ilustración incluida.

### Agregar un ejemplo real al portafolio
1. Guarda la captura en `assets/portafolio/` (ej. `guia-ciencias.webp` o `.png`) y, si quieres, el PDF (`guia-ciencias.pdf`).
2. En `config.js`, bloque `portafolio`, copia un bloque y edítalo:
```js
{ categoria: "Guías y talleres", nombre: "Guía de ciencias: la célula",
  necesidad: "Material autónomo con explicación y actividades.",
  contexto: "Grado 6° · Ciencias Naturales", tipo: "guia",
  personalizacion: "Se adapta al nivel del grupo y al formato de la institución.",
  imagen: "assets/portafolio/guia-ciencias.png", archivo: "assets/portafolio/guia-ciencias.pdf" },
```
Valores posibles de `tipo` (define la ilustración cuando no hay imagen): `planeacion`, `guia`, `rubrica`, `material`, `inclusion`, `documento`, `presentacion`.
Las categorías se crean solas a partir del campo `categoria`.

**Importante:** usa documentos demostrativos o reales autorizados, siempre con datos ficticios o anonimizados. Nunca publiques información identificable de estudiantes.

## 2b. Catálogo de ejemplos con buscador

Los ejemplos del portafolio se pueden buscar por texto y filtrar por área, grado y tipo de recurso. Esos filtros salen
de los campos `area`, `grados`, `tipoRecurso`, `duracion`, `modalidad` y `adaptacion` de cada ejemplo en `config.js`.
Si agregas un ejemplo nuevo, llena esos campos para que aparezca en los filtros.

## 2c. Plantillas editables (sin IA, sin servidor)

La sección «Plantillas» permite al docente generar un plan de clase, guía, taller, evaluación, rúbrica, actividad
diferenciada o material de refuerzo a partir de sus datos (área, grado, tema…). El documento se edita en la misma página,
se copia, se descarga como Word (`.doc`) o se imprime. El borrador se guarda en el navegador del docente.
Las estructuras están en `assets/js/plantillas.js`; para cambiar un texto o agregar un tipo, edita ese archivo.
Los referentes curriculares (DBA, estándares) se dejan como espacio en blanco: no se inventan.

## 2d. WhatsApp pendiente

Mientras `contacto.whatsapp` esté vacío en `config.js`, la página no muestra un número falso: los botones de WhatsApp
avisan que el número está pendiente y copian el mensaje al portapapeles; el resumen del formulario ofrece copiarlo.
En cuanto escribas el número real, todo queda activo sin tocar nada más.

## 3. Cómo funciona el formulario (sin costo)

- Es un formulario de 5 pasos que **no envía datos a ningún servidor**.
- Al terminar, muestra un resumen y un botón **«Continuar por WhatsApp»** que abre el chat con el resumen ya escrito.
- También permite copiar el resumen al portapapeles.
- Guarda un borrador en el navegador del docente por si recarga la página.
- No permite adjuntar archivos (para no almacenar documentos de terceros). La página explica que los documentos se envían por WhatsApp o correo después.

### Opcional: recibir también una copia por correo
1. Crea una cuenta gratuita en [formspree.io](https://formspree.io) (plan gratuito: 50 envíos al mes).
2. Crea un formulario y copia el enlace que te dan (`https://formspree.io/f/xxxxxxx`).
3. Pégalo en `config.js`: `formulario: { endpoint: "https://formspree.io/f/xxxxxxx" }`.
La página solo dice «copia enviada» si el servicio confirma el envío; si falla, lo indica y el docente puede continuar por WhatsApp.

## 4. Publicar la página (gratis)

### Opción A — GitHub Pages
1. Sube la carpeta `apoyo-docente` a un repositorio de GitHub.
2. En el repositorio: **Settings → Pages → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)` o la carpeta donde esté `index.html`.
3. En unos minutos tendrás una URL tipo `https://tuusuario.github.io/nombre-repo/`.

### Opción B — Netlify Drop (la más fácil)
1. Entra a [app.netlify.com/drop](https://app.netlify.com/drop).
2. Arrastra la carpeta `apoyo-docente`. Listo: obtienes una URL pública al instante.
3. Para actualizar, vuelve a arrastrar la carpeta.

### Opción C — Vercel
`vercel deploy` desde la carpeta, o importa el repositorio desde vercel.com.

### Dominio propio (opcional, de pago)
Un dominio `.com` o `.com.co` cuesta aproximadamente entre $40.000 y $80.000 COP al año. Se conecta en la configuración de Pages, Netlify o Vercel.

## 5. Qué es gratis y qué tiene costo

| Función | Costo |
|---|---|
| Página completa, formulario, resumen y WhatsApp | Gratis |
| Publicación en GitHub Pages / Netlify / Vercel | Gratis |
| Copia del formulario por correo (Formspree) | Gratis hasta 50/mes; luego plan de pago |
| Dominio propio | De pago (anual) |
| Adjuntar archivos desde la página | No incluido. Alternativa gratuita: enviar por WhatsApp o correo. Si se quiere en el futuro: Formspree de pago o un formulario de Google |
| Pagos en línea, usuarios, agenda | No incluidos a propósito. Se cotiza y se cobra por WhatsApp/transferencia |

## 5b. Pruebas automáticas

```bash
cd apoyo-docente
npm test
```
Corre con el ejecutor de pruebas de Node (sin dependencias). Cubre la lógica del formulario y del WhatsApp
(`assets/js/logica.js`) y el generador de plantillas (`assets/js/plantillas.js`).

## 6. Probar en tu computador

Abre `index.html` con doble clic. Para una prueba más fiel (fuentes, enlaces), desde la carpeta:

```bash
python3 -m http.server 8080
```
y entra a `http://localhost:8080`.

## 7. Buenas prácticas de contenido

- No inventes títulos, certificaciones, testimonios ni clientes. La página no incluye ninguno a propósito.
- Revisa que la política de privacidad y las condiciones (al final de `index.html`) correspondan a cómo trabajas realmente.
- Actualiza las preguntas frecuentes con lo que te pregunten los docentes de verdad.

## 8. Documentos de muestra incluidos

En `assets/portafolio/` hay 11 documentos demostrativos (PDF + imagen de vista previa), uno por cada tipo de material. Todos usan datos ficticios y llevan el sello «Documento demostrativo».

Sus fuentes editables están en `assets/portafolio/fuentes/` (archivos HTML + `base.css`). Para modificar uno:
1. Abre el `.html` con cualquier editor de texto, cambia el contenido y guárdalo.
2. Ábrelo en el navegador y usa **Imprimir → Guardar como PDF** (tamaño Carta, sin márgenes, con gráficos de fondo).
3. Toma una captura de la parte superior para la vista previa y reemplaza el `.png` del mismo nombre.

Cuando tengas trabajos reales autorizados, reemplaza estos archivos por los tuyos siguiendo la sección 2.
