# Auditoría y mejoras de la tienda digital

Fecha: 2026-10-14. Alcance: carpeta `tienda/` (sitio estático). Condiciones de prueba: Chromium 1194 (Playwright) sobre servidor local; escritorio 1280×900 sin limitación; móvil 390×844 con red simulada 1,6 Mb/s, 150 ms de latencia y CPU 4× más lenta. Las métricas se midieron con `PerformanceObserver` (layout-shift y largest-contentful-paint).

## 1. Estado real comprobado

| Función | Estado | Evidencia |
|---|---|---|
| Catálogo, categorías, buscador con autocompletado, filtros (categoría, precio, novedades, ofertas, disponibilidad), orden | REUTILIZAR | Pruebas automáticas `catalogo.html?q=cable` → 2 resultados; filtros y orden funcionan |
| Ficha de producto (galería, variantes, cantidad, especificaciones, FAQ, relacionados) | REUTILIZAR | Página probada en móvil y escritorio |
| Carrito (agregar, quitar, cantidades, persistencia en `localStorage`) | MEJORADO | Persistía tras recargar; aceptaba cantidad 500 y productos inexistentes desde el almacenamiento. Ahora se sanea al cargar: 1–99 unidades, solo productos existentes, visibles y disponibles |
| Pedido por WhatsApp (producto, disponibilidad, carrito, atajos) | REUTILIZAR | Enlaces `wa.me` verificados con número de prueba (no guardado) |
| Pagos en línea | NO EXISTE | No hay proveedor ni backend. La tienda **no cobra**: el pedido se cierra por WhatsApp. No se simula ningún checkout |
| Inventario conectado | NO EXISTE | `disponible` es un campo manual del catálogo. La ficha lo muestra como «sujeto a confirmación» |
| Pedidos, correo, mensajería automática | NO EXISTE | Solo enlaces oficiales de WhatsApp con mensaje precompletado |
| Panel de administración (`admin.html`) | SOLO LOCAL | Edita un borrador en el navegador y exporta/importa JSON y CSV. **No escribe en el sitio publicado**; el dueño reemplaza `data/*.json`. No tiene autenticación porque no puede modificar nada remoto |
| Datos que se guardan | VERIFICADO | En el navegador del visitante: carrito, vistos recientemente, contador local de clics, borradores del admin. En servidor: nada. Formularios: ninguno |
| Productos de demostración | MARCADOS | 6 productos con sufijo «(DEMO)» e imágenes de muestra; textos marcados «Pendiente de confirmar». Se eliminó el único descuento ficticio (cable 3 en 1) |
| Dependencias | VERIFICADO | Ninguna (sin npm). Recursos externos: Google Fonts, y GA4/Meta Pixel solo si se configuran |
| Imágenes PNG «pesadas» (auditoría previa) | NO CONFIRMADO | Productos 13–20 KB cada una. Solo la imagen OG pesaba 298 KB → convertida a JPG de 20 KB |
| CLS 0,99 (auditoría previa) | CONFIRMADO Y CORREGIDO | Ver métricas |

## 2. Problemas por gravedad y qué se hizo

1. **Alta – CLS ≈ 1 en todas las páginas.** Causa: el encabezado y los avisos se inyectaban por JavaScript y empujaban todo el contenido; los esqueletos no reservaban el tamaño real; la fuente web con `display=swap`. Corrección: altura mínima reservada para encabezado, banner, rejillas y ficha; avisos del dueño como capa superpuesta (no desplazan); `display=optional` en la fuente; `main` con altura mínima.
2. **Alta – Carrito confiaba en el almacenamiento local.** Corrección: saneo al cargar y límites 1–99 en todas las operaciones; productos agotados no se agregan.
3. **Media – Controles enfocables dentro del carrito y del editor ocultos (`aria-hidden`).** Corrección: atributo `inert` al cerrar, foco al botón de cerrar al abrir y retorno al botón del carrito al cerrar. Probado con teclado: el foco ya no entra al panel cerrado.
4. **Media – `admin.html` publicado.** Decisión: el panel no puede alterar el sitio ni expone secretos (los JSON ya son públicos por diseño), por lo que el riesgo es bajo. `robots.txt` lo marca `Disallow`. Se mantiene publicado porque desde allí se usa la función de IA, protegida con `ADMIN_SECRET`. En GitHub Pages no se puede excluir: usar el admin localmente y no subirlo, o publicar en Netlify/Cloudflare.
5. **Media – Sin cabeceras de seguridad.** Corrección: `_headers` (Netlify/Cloudflare) con CSP, `nosniff`, `frame-ancestors 'none'`, Referrer-Policy y Permissions-Policy. La CSP se probó con un servidor local que aplica esas cabeceras: fuentes, GA4 y Meta Pixel cargan sin violaciones. Las páginas estáticas por producto ya no usan `<script>` en línea (pasan el ID por `data-producto`).
6. **Baja – Sin `canonical`.** Corrección: se añade dinámicamente en todas las páginas (en fichas incluye `?p=ID`; las páginas estáticas `p/` ya lo traían).
7. **Baja – Error de carga poco útil.** Corrección: mensaje claro con botón «Reintentar» y detalle técnico.
8. **Baja – Demo con descuento ficticio.** Corregido (ver tabla).

## 3. Métricas antes y después

| Página | CLS antes | CLS después | LCP antes | LCP después |
|---|---|---|---|---|
| Inicio, escritorio | 1,00 | 0,04 | 908 ms | 524 ms |
| Catálogo, escritorio | 0,57 | 0,00 | 364 ms | 572 ms |
| Producto, escritorio | 0,90 | 0,02 | 352 ms | 300 ms |
| Inicio, móvil 4G lento | 1,00 | 0,04 | 1 332 ms | 1 360 ms |
| Catálogo, móvil 4G lento | 1,00 | 0,07 | 1 860 ms | 1 864 ms |
| Producto, móvil 4G lento | 0,97 | 0,04 | 1 436 ms | 1 480 ms |

Referencias: LCP ≤ 2,5 s, CLS ≤ 0,1. INP no se midió (requiere interacción real de usuarios; no hay tareas largas de JavaScript en el sitio). Las variaciones de LCP de ±200 ms entre corridas son ruido de medición.

## 4. Pruebas de aceptación ejecutadas

| # | Escenario | Resultado |
|---|---|---|
| 1 | Abrir catálogo y ver productos | Aprobado |
| 2 | Buscar («cable», «cab», «orga») y filtrar por categoría, precio, novedades, ofertas, disponibilidad; ordenar | Aprobado |
| 3 | Abrir ficha (dinámica y estática `p/`) | Aprobado |
| 4 | Agregar (dos clics = 1 línea con cantidad 2), cambiar cantidad, quitar, vaciar | Aprobado |
| 5 | Subtotal y total (total estimado sin envío, indicado en pantalla) | Aprobado |
| 6 | Recargar: el carrito persiste y se sanea (500 → 99; producto inexistente eliminado) | Aprobado |
| 7 | Catálogo vacío / sin resultados / producto inexistente / error de carga | Aprobado (mensajes y botón reintentar) |
| 8 | Flujo real de pedido: enlace `wa.me` con producto, variante, cantidad y enlace | Aprobado |
| 9 | Pago marcado como aprobado sin confirmación | No aplica: no hay pagos ni ninguna pantalla que los afirme |
| 10 | Permisos del panel admin | Verificado: solo local; excluido del despliegue en Netlify |
| 11 | Diseño móvil y navegación por teclado (foco, `inert`, Escape) | Aprobado |
| 12 | Regresión: encabezado, FAQ, pasos, vistos recientemente, autocompletado, CSP | Aprobado, sin errores de consola |

## 5. Flujo de compra que queda habilitado

Catálogo → ficha → (variante, cantidad) → «Pedir por WhatsApp» o carrito → mensaje precompletado al número del negocio → el vendedor confirma disponibilidad, precio final y envío en el chat → pago y entrega acordados fuera de la página. La tienda no cobra, no reserva inventario ni confirma pedidos por sí misma, y así lo indica en fichas, carrito, preguntas frecuentes y políticas.

## 6. Riesgos y pendientes

**Legales (Colombia), a verificar con asesoría antes de afirmar cumplimiento:**
- Ley 1480 de 2011 (Estatuto del Consumidor), art. 47: derecho de retracto en ventas a distancia (el consumidor puede retractarse en el plazo legal y el proveedor devuelve el dinero en 30 días; los costos de devolución los asume el consumidor). Art. 50: deberes de información en comercio electrónico (identidad del vendedor, características, precio total, condiciones de entrega y retracto). Decreto 1074 de 2015, arts. 2.2.2.37.x: información previa a la oferta. Fuentes: conceptos de la Superintendencia de Industria y Comercio (sic.gov.co). La página de políticas tiene estas secciones **vacías y marcadas como pendientes** hasta que el negocio defina sus condiciones; no se redactaron políticas ficticias.
- Ley 1581 de 2012 y Decreto 1377 de 2013 (datos personales): la tienda no recoge datos en formularios, pero los recibe por WhatsApp. Falta la política de tratamiento de datos (campo `politicas.privacidad`).
- Si se activa Meta Pixel o GA4, la política de privacidad debe mencionarlos.

**Técnicos:** sin servidor no hay validación de precio en origen; el precio del mensaje de WhatsApp es informativo y el vendedor lo confirma. El panel admin no sube fotos. INP no medido.

**Comerciales / datos que faltan:** número de WhatsApp, nombre y logo, ciudad y horario, políticas de envío, pago, cambios, garantía y privacidad, productos y fotos reales, decisión sobre dominio.

## 7. Despliegue y reversión

- Netlify: importar el repositorio con *base directory* `tienda`; `netlify.toml` publica la carpeta, elimina el panel admin y genera las páginas `p/` con la URL del sitio. `_headers` aplica las cabeceras de seguridad. Cloudflare Pages lee `_headers` igual; añadir el mismo comando de build.
- GitHub Pages: funciona, pero sin cabeceras personalizadas ni exclusión del admin.
- Reversión: cada cambio está en un commit de `master`; `git revert <sha>` deshace uno sin perder los demás. Los datos del catálogo no cambiaron de estructura (solo se retiró un descuento de demostración), por lo que no hubo migración ni copia de seguridad que restaurar.
