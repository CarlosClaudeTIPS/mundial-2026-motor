(function () {
  const T = window.Tienda;
  T.iniciar('catalogo', ({ config }) => {
    const id = window.PRODUCTO_ID || T.param('p');
    const p = T.producto(id);
    const main = T.$('#producto');
    if (!p || p.visible === false) {
      main.innerHTML = `<div class="vacio" style="margin:2rem 0"><h1>Producto no disponible</h1><p>Es posible que haya sido retirado del catálogo.</p><a class="btn btn-primario" href="${T.ruta('catalogo.html')}">Ver el catálogo</a></div>`;
      return;
    }
    T.registrar('view_item', { producto: p.id });
    const cat = T.categoria(p.categoria);
    const d = T.descuento(p);
    const url = T.urlProducto(p, true);
    const seleccion = {};
    (p.variantes || []).forEach(v => { if (v.opciones && v.opciones.length) seleccion[v.nombre] = v.opciones[0]; });

    /* SEO dinámico */
    document.title = `${p.nombre} · ${config.negocio.nombre}`;
    const setMeta = (sel, val) => { const m = document.querySelector(sel); if (m) m.setAttribute('content', val); };
    const descMeta = (p.descripcionCorta || p.descripcion || '').slice(0, 155);
    setMeta('meta[name="description"]', descMeta); setMeta('meta[property="og:title"]', p.nombre);
    setMeta('meta[property="og:description"]', descMeta); setMeta('meta[property="og:image"]', new URL(T.imagenProducto(p), location.href).href);
    const ld = document.createElement('script'); ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: p.nombre, image: p.imagenes.map(i => new URL(/^https?:/.test(i) ? i : T.ruta(i), location.href).href), description: descMeta, url, offers: { '@type': 'Offer', priceCurrency: 'COP', price: p.precio, availability: p.disponible ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' } });
    document.head.appendChild(ld);

    const medios = p.imagenes.map(src => ({ tipo: 'img', src: T.imagenProducto({ imagenes: [src] }) }));
    if (p.video) medios.push({ tipo: 'video', src: /^https?:/.test(p.video) ? p.video : T.ruta(p.video) });
    if (!medios.length) medios.push({ tipo: 'img', src: T.ruta('img/sin-imagen.svg') });

    const lista = (arr) => arr && arr.length ? `<ul>${arr.map(x => `<li>${T.esc(x)}</li>`).join('')}</ul>` : '';
    const listaNum = (arr) => arr && arr.length ? `<ol>${arr.map(x => `<li>${T.esc(x)}</li>`).join('')}</ol>` : '';
    const pendiente = (txt) => `<p class="pendiente">${txt}</p>`;
    const specs = Object.entries(p.especificaciones || {});
    const pol = config.politicas || {};
    const polItem = (t, v, ancla) => `<li><strong>${t}:</strong> ${v ? T.esc(v) : `<span class="pendiente">pendiente de confirmar</span>`} <a href="${T.ruta('politicas.html#' + ancla)}">Ver más</a></li>`;

    const rel = (p.relacionados || []).map(T.producto).filter(x => x && x.visible !== false);
    const relFinal = rel.length ? rel : T.visibles().filter(x => x.id !== p.id && x.categoria === p.categoria).slice(0, 4);

    main.innerHTML = `
      <nav class="migas" aria-label="Ruta"><a href="${T.ruta('index.html')}">Inicio</a> › <a href="${T.ruta('catalogo.html')}">Catálogo</a> ${cat ? `› <a href="${T.ruta('catalogo.html?cat=' + encodeURIComponent(cat.id))}">${T.esc(cat.nombre)}</a>` : ''} › <span>${T.esc(p.nombre)}</span></nav>
      <div class="producto-layout">
        <div>
          <div class="galeria-principal" id="galeria">
            <div class="etiquetas">${!p.disponible ? '<span class="etiqueta etiqueta-agotado">Agotado</span>' : ''}${p.oferta && d > 0 ? `<span class="etiqueta etiqueta-oferta">-${d}%</span>` : ''}${p.nuevo ? '<span class="etiqueta etiqueta-nuevo">Nuevo</span>' : ''}</div>
            <img src="${T.esc(medios[0].src)}" alt="${T.esc(p.nombre)}" id="imagen-principal" width="800" height="800">
          </div>
          ${medios.length > 1 ? `<div class="galeria-miniaturas" id="miniaturas">${medios.map((m, i) => `<button class="${i === 0 ? 'activo' : ''}" data-i="${i}" aria-label="Ver ${m.tipo === 'video' ? 'video' : 'imagen ' + (i + 1)}">${m.tipo === 'video' ? '<span class="mini-video">▶️</span>' : `<img src="${T.esc(m.src)}" alt="" loading="lazy">`}</button>`).join('')}</div>` : ''}
        </div>
        <div class="ficha aparece">
          ${cat ? `<span class="tarjeta-categoria-txt">${T.esc(cat.nombre)}</span>` : ''}
          <h1>${T.esc(p.nombre)}</h1>
          ${p.descripcionCorta ? `<p class="descripcion-corta">${T.esc(p.descripcionCorta)}</p>` : ''}
          <div class="precio"><span class="precio-actual">${T.formatoPrecio(p.precio)}</span>${d > 0 ? `<span class="precio-anterior">${T.formatoPrecio(p.precioAnterior)}</span><span class="precio-descuento">Ahorras ${T.formatoPrecio(p.precioAnterior - p.precio)}</span>` : ''}</div>
          <span class="disponibilidad ${p.disponible ? '' : 'agotado'}">${p.disponible ? '● Disponible (sujeto a confirmación)' : '○ Agotado por ahora'}</span>
          ${p.variantes.length ? `<div class="variantes" id="variantes">${p.variantes.map(v => `<div class="variante"><label>${T.esc(v.nombre)}</label><div class="opciones" data-variante="${T.esc(v.nombre)}">${(v.opciones || []).map((o, i) => `<button type="button" class="opcion ${i === 0 ? 'activo' : ''}" data-opcion="${T.esc(o)}">${T.esc(o)}</button>`).join('')}</div></div>`).join('')}</div>` : ''}
          <div class="ficha-acciones">
            ${p.disponible
              ? `<button class="btn btn-whatsapp" id="btn-pedir">${T.ico.wa} Pedir por WhatsApp</button>
                 <button class="btn btn-contorno" id="btn-consultar">Consultar disponibilidad</button>
                 <button class="btn btn-suave" id="btn-carrito-add">${T.ico.carrito} Agregar al carrito</button>`
              : `<button class="btn btn-whatsapp" id="btn-consultar">${T.ico.wa} Avísame cuando esté disponible</button>`}
          </div>
          <p class="nota-legal">Abrir WhatsApp no confirma la compra ni garantiza inventario. Te confirmamos disponibilidad, precio final y envío en el chat.</p>
          <ul style="font-size:.9rem;color:var(--texto-suave);margin-top:1rem;padding-left:1rem">
            ${polItem('Entrega', pol.entregas, 'entregas')}${polItem('Pago', pol.pagos, 'pagos')}${polItem('Cambios', pol.cambios, 'cambios')}${polItem('Garantía', pol.garantia, 'cambios')}
          </ul>
          <div class="compartir"><span>Compartir:</span>
            <a href="https://wa.me/?text=${encodeURIComponent(p.nombre + ' ' + url)}" target="_blank" rel="noopener" aria-label="Compartir por WhatsApp">${T.ico.wa}</a>
            <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" rel="noopener" aria-label="Compartir en Facebook">${T.ico.fb}</a>
            <button type="button" id="btn-copiar" aria-label="Copiar enlace" title="Copiar enlace">${T.ico.enlace}</button>
            <button type="button" id="btn-compartir" aria-label="Más opciones" title="Compartir" hidden>${T.ico.compartir}</button>
          </div>
        </div>
      </div>

      <div class="bloque"><h2>Descripción</h2>${p.descripcion ? `<p>${T.esc(p.descripcion).replace(/\n/g, '<br>')}</p>` : pendiente('Descripción pendiente de completar.')}
        ${p.problema ? `<h3 style="margin-top:1rem">¿Qué resuelve?</h3><p>${T.esc(p.problema)}</p>` : ''}
        ${p.beneficios.length ? `<h3 style="margin-top:1rem">Beneficios</h3>${lista(p.beneficios)}` : ''}</div>
      ${specs.length ? `<div class="bloque"><h2>Características y especificaciones</h2><table class="tabla-specs">${specs.map(([k, v]) => `<tr><th>${T.esc(k)}</th><td>${/pendiente/i.test(v) ? `<span class="pendiente">${T.esc(v)}</span>` : T.esc(v)}</td></tr>`).join('')}</table></div>` : ''}
      ${p.incluye.length ? `<div class="bloque"><h2>¿Qué incluye?</h2>${lista(p.incluye)}</div>` : ''}
      ${p.instrucciones.length ? `<div class="bloque"><h2>Cómo se usa</h2>${listaNum(p.instrucciones)}</div>` : ''}
      ${p.precauciones.length ? `<div class="bloque"><h2>Recomendaciones y precauciones</h2>${lista(p.precauciones)}</div>` : ''}
      ${p.preguntas.length ? `<div class="bloque"><h2>Preguntas frecuentes</h2>${p.preguntas.map(q => `<details class="faq"><summary>${T.esc(q.p)}</summary><p>${T.esc(q.r)}</p></details>`).join('')}</div>` : ''}
      ${T.faqs().length ? `<div class="bloque"><h2>Compra con tranquilidad</h2><p style="color:var(--texto-suave)">Respuestas a lo que más preguntan antes de pedir.</p>${T.renderFaq((T.faqs().filter(q => q.destacada).length ? T.faqs().filter(q => q.destacada) : T.faqs()).slice(0, 4))}<p style="margin:.8rem 0 0"><a href="${T.ruta('preguntas.html')}">Ver todas las preguntas frecuentes →</a></p></div>` : ''}
      ${relFinal.length ? `<section class="seccion"><div class="seccion-cabecera"><h2>Productos relacionados</h2></div><div class="grid-productos">${relFinal.slice(0, 4).map(T.tarjeta).join('')}</div></section>` : '<div style="height:1.5rem"></div>'}

      ${p.disponible ? `<div class="barra-fija"><span class="precio-actual">${T.formatoPrecio(p.precio)}</span><button class="btn btn-whatsapp" id="btn-pedir-fijo">${T.ico.wa} Pedir por WhatsApp</button></div>` : ''}`;
    if (p.disponible) document.body.classList.add('con-barra-fija');

    /* galería */
    const minis = T.$('#miniaturas');
    if (minis) minis.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const m = medios[Number(b.dataset.i)];
      T.$$('#miniaturas button').forEach(x => x.classList.toggle('activo', x === b));
      const g = T.$('#galeria'); const old = g.querySelector('img,video');
      const nuevo = m.tipo === 'video' ? Object.assign(document.createElement('video'), { src: m.src, controls: true, playsInline: true, preload: 'metadata' }) : Object.assign(document.createElement('img'), { src: m.src, alt: p.nombre });
      if (m.tipo === 'img') nuevo.id = 'imagen-principal';
      old.replaceWith(nuevo);
    });

    /* variantes */
    const vars = T.$('#variantes');
    if (vars) vars.addEventListener('click', (e) => {
      const b = e.target.closest('.opcion'); if (!b) return;
      const grupo = b.closest('.opciones');
      grupo.querySelectorAll('.opcion').forEach(x => x.classList.toggle('activo', x === b));
      seleccion[grupo.dataset.variante] = b.dataset.opcion;
    });

    /* acciones */
    const pedir = () => T.abrirWA(T.mensajeProducto(p, seleccion), 'whatsapp_click', { producto: p.id, origen: 'producto' });
    const consultar = () => T.abrirWA(T.mensajeProducto(p, seleccion, 'disponibilidad'), 'whatsapp_click', { producto: p.id, origen: 'disponibilidad' });
    const on = (id, fn) => { const el = T.$(id); if (el) el.addEventListener('click', fn); };
    on('#btn-pedir', pedir); on('#btn-pedir-fijo', pedir); on('#btn-consultar', consultar);
    on('#btn-carrito-add', () => T.carrito.agregar(p, Object.assign({}, seleccion), 1));
    on('#btn-copiar', async () => { try { await navigator.clipboard.writeText(url); T.toast('Enlace copiado'); } catch (e) { prompt('Copia el enlace:', url); } });
    if (navigator.share) { const bc = T.$('#btn-compartir'); bc.hidden = false; bc.addEventListener('click', () => navigator.share({ title: p.nombre, text: p.descripcionCorta || p.nombre, url }).catch(() => { })); }
    if (T.param('carrito') === '1' && p.variantes.length) { T.toast('Elige las opciones y agrega al carrito'); const v = T.$('#variantes'); if (v) v.scrollIntoView({ block: 'center' }); }
  });
})();
