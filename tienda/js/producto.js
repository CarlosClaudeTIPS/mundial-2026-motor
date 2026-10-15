(function () {
  const T = window.Tienda;
  T.iniciar('catalogo', ({ config }) => {
    const id = document.body.dataset.producto || T.param('p');
    const p = T.producto(id);
    const main = T.$('#producto');
    if (!p || p.visible === false) {
      main.innerHTML = `<div class="vacio" style="margin:2rem 0"><h1>Producto no disponible</h1><p>Es posible que haya sido retirado del catálogo.</p><a class="btn btn-primario" href="${T.ruta('catalogo.html')}">Ver el catálogo</a></div>`;
      return;
    }
    T.registrar('view_item', { producto: p.id });
    T.vistos.agregar(p.id);
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
          <div class="galeria-wrap">
            <div class="etiquetas">${!p.disponible ? `<span class="etiqueta etiqueta-agotado">${T.vendido(p) ? 'Vendido' : 'Agotado'}</span>` : ''}${p.oferta && d > 0 ? `<span class="etiqueta etiqueta-oferta">-${d}%</span>` : ''}${p.nuevo ? '<span class="etiqueta etiqueta-nuevo">Nuevo</span>' : ''}</div>
            <div class="galeria-principal" id="galeria" aria-label="Galería de imágenes">
              ${medios.map((m, i) => `<div class="slide" data-i="${i}">${m.tipo === 'video' ? `<video src="${T.esc(m.src)}" controls playsinline preload="metadata"></video>` : `<img src="${T.esc(m.src)}" alt="${T.esc(p.nombre)}${i ? ' ' + (i + 1) : ''}" width="800" height="800" ${i ? 'loading="lazy"' : ''}>`}</div>`).join('')}
            </div>
            ${medios.length > 1 ? `<span class="galeria-contador" id="galeria-contador">1 / ${medios.length}</span>` : ''}
          </div>
          ${medios.length > 1 ? `<div class="galeria-puntos" id="galeria-puntos">${medios.map((m, i) => `<span class="${i === 0 ? 'activo' : ''}"></span>`).join('')}</div>
          <div class="galeria-miniaturas" id="miniaturas">${medios.map((m, i) => `<button class="${i === 0 ? 'activo' : ''}" data-i="${i}" aria-label="Ver ${m.tipo === 'video' ? 'video' : 'imagen ' + (i + 1)}">${m.tipo === 'video' ? '<span class="mini-video">▶</span>' : `<img src="${T.esc(m.src)}" alt="" loading="lazy">`}</button>`).join('')}</div>` : ''}
        </div>
        <div class="ficha aparece">
          ${cat ? `<span class="tarjeta-categoria-txt">${T.esc(cat.nombre)}</span>` : ''}
          <h1>${T.esc(p.nombre)}</h1>
          ${p.descripcionCorta ? `<p class="descripcion-corta">${T.esc(p.descripcionCorta)}</p>` : ''}
          <div class="precio"><span class="precio-actual">${T.formatoPrecio(p.precio)}</span>${d > 0 ? `<span class="precio-anterior">${T.formatoPrecio(p.precioAnterior)}</span><span class="precio-descuento">Ahorras ${T.formatoPrecio(p.precioAnterior - p.precio)}</span>` : ''}</div>
          <span class="disponibilidad ${p.disponible ? '' : 'agotado'}">${p.disponible ? '● Disponible (sujeto a confirmación)' + (T.textoStock(p) ? ' · ' + T.textoStock(p) : '') : T.vendido(p) ? '○ Vendido' : '○ Agotado por ahora'}</span>
          ${T.vendido(p) ? '<p class="aviso-pendiente" style="margin:.5rem 0 0">Este producto ya se vendió. Si te interesa, dinos y buscamos conseguir otro igual.</p>' : ''}
          ${p.variantes.length ? `<div class="variantes" id="variantes">${p.variantes.map(v => `<div class="variante"><label>${T.esc(v.nombre)}</label><div class="opciones" data-variante="${T.esc(v.nombre)}">${(v.opciones || []).map((o, i) => `<button type="button" class="opcion ${i === 0 ? 'activo' : ''}" data-opcion="${T.esc(o)}">${T.esc(o)}</button>`).join('')}</div></div>`).join('')}</div>` : ''}
          ${p.disponible ? `<div class="fila-cantidad"><span>Cantidad</span><div class="cantidad"><button type="button" id="cant-menos" aria-label="Menos">−</button><span id="cant-val">1</span><button type="button" id="cant-mas" aria-label="Más">+</button></div></div>` : ''}
          <div class="ficha-acciones">
            ${p.disponible
              ? `<button class="btn btn-whatsapp" id="btn-pedir">${T.ico.wa} Pedir por WhatsApp</button>
                 <button class="btn btn-contorno" id="btn-consultar">Consultar disponibilidad</button>
                 <button class="btn btn-suave" id="btn-carrito-add">${T.ico.carrito} Agregar al carrito</button>`
              : `<button class="btn btn-whatsapp" id="btn-consultar">${T.ico.wa} ${T.vendido(p) ? 'Quiero uno igual' : 'Avísame cuando esté disponible'}</button>`}
          </div>
          ${config.negocio.horario ? `<p class="horario">${T.icoCat.reloj} Atención: ${T.esc(config.negocio.horario)}</p>` : ''}
          <div class="micro-confianza">
            <div>${T.icoCat.chat}Atención por una persona real</div>
            <div>${T.icoCat.escudo}Pagas solo tras confirmar</div>
            <div>${T.icoCat.camion}Envío cotizado antes de pagar</div>
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

      <div class="bloque">${T.encuesta('¿Necesitas algo más? Cuéntanos')}</div>
      <section class="seccion" id="sec-vistos" hidden><div class="seccion-cabecera"><h2>Vistos recientemente</h2></div><div class="grid-productos"></div></section>
      <div class="lightbox" id="lightbox" role="dialog" aria-label="Imagen ampliada"><button type="button" id="lb-cerrar" aria-label="Cerrar">${T.ico.cerrar}</button><button type="button" class="lb-nav lb-prev" id="lb-prev" aria-label="Anterior">‹</button><img src="" alt=""><button type="button" class="lb-nav lb-next" id="lb-next" aria-label="Siguiente">›</button></div>
      ${p.disponible ? `<div class="barra-fija"><span class="precio-actual">${T.formatoPrecio(p.precio)}</span><button class="btn btn-whatsapp" id="btn-pedir-fijo">${T.ico.wa} Pedir por WhatsApp</button></div>` : ''}`;
    if (p.disponible) document.body.classList.add('con-barra-fija');

    /* galería: deslizable, puntos, miniaturas y zoom */
    const gal = T.$('#galeria');
    let actual = 0;
    const marcar = (i) => {
      actual = i;
      T.$$('#galeria-puntos span').forEach((x, k) => x.classList.toggle('activo', k === i));
      T.$$('#miniaturas button').forEach((x, k) => x.classList.toggle('activo', k === i));
      const c = T.$('#galeria-contador'); if (c) c.textContent = `${i + 1} / ${medios.length}`;
    };
    const irA = (i) => { gal.scrollTo({ left: gal.clientWidth * i, behavior: 'smooth' }); marcar(i); };
    gal.addEventListener('scroll', () => { const i = Math.round(gal.scrollLeft / gal.clientWidth); if (i !== actual) marcar(i); }, { passive: true });
    const minis = T.$('#miniaturas');
    if (minis) minis.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) irA(Number(b.dataset.i)); });
    /* zoom */
    const lb = T.$('#lightbox'), lbImg = lb.querySelector('img');
    const imgs = medios.map((m, i) => ({ ...m, i })).filter(m => m.tipo === 'img');
    let lbIdx = 0;
    const abrirLb = (i) => { const k = imgs.findIndex(m => m.i === i); if (k < 0) return; lbIdx = k; lbImg.src = imgs[k].src; lb.classList.add('abierto'); document.body.style.overflow = 'hidden'; lb.querySelectorAll('.lb-nav').forEach(n => n.hidden = imgs.length < 2); };
    const cerrarLb = () => { lb.classList.remove('abierto'); document.body.style.overflow = ''; };
    gal.addEventListener('click', (e) => { const sl = e.target.closest('.slide'); if (sl && !e.target.closest('video')) abrirLb(Number(sl.dataset.i)); });
    T.$('#lb-cerrar').addEventListener('click', cerrarLb);
    lb.addEventListener('click', (e) => { if (e.target === lb) cerrarLb(); });
    T.$('#lb-prev').addEventListener('click', () => { lbIdx = (lbIdx - 1 + imgs.length) % imgs.length; lbImg.src = imgs[lbIdx].src; });
    T.$('#lb-next').addEventListener('click', () => { lbIdx = (lbIdx + 1) % imgs.length; lbImg.src = imgs[lbIdx].src; });
    document.addEventListener('keydown', (e) => { if (!lb.classList.contains('abierto')) return; if (e.key === 'Escape') cerrarLb(); if (e.key === 'ArrowRight') T.$('#lb-next').click(); if (e.key === 'ArrowLeft') T.$('#lb-prev').click(); });

    /* cantidad */
    let cantidad = 1;
    const setCant = (n) => { cantidad = Math.max(1, Math.min(p.stock != null ? Math.max(1, p.stock) : 99, n)); const v = T.$('#cant-val'); if (v) v.textContent = cantidad; };
    const cm = T.$('#cant-menos'), cp = T.$('#cant-mas');
    if (cm) cm.addEventListener('click', () => setCant(cantidad - 1));
    if (cp) cp.addEventListener('click', () => setCant(cantidad + 1));

    /* barra fija: aparece solo cuando el bloque de compra sale de pantalla */
    const barra = T.$('.barra-fija'), acciones = T.$('.ficha-acciones');
    if (barra && acciones && 'IntersectionObserver' in window) {
      new IntersectionObserver(([en]) => barra.classList.toggle('visible', !en.isIntersecting && en.boundingClientRect.top < 0), { threshold: 0 }).observe(acciones);
    } else if (barra) barra.classList.add('visible');

    T.renderVistos('#sec-vistos', p.id);

    /* variantes */
    const vars = T.$('#variantes');
    if (vars) vars.addEventListener('click', (e) => {
      const b = e.target.closest('.opcion'); if (!b) return;
      const grupo = b.closest('.opciones');
      grupo.querySelectorAll('.opcion').forEach(x => x.classList.toggle('activo', x === b));
      seleccion[grupo.dataset.variante] = b.dataset.opcion;
    });

    /* acciones */
    const pedir = () => T.abrirWA(T.mensajeProducto(p, seleccion, null, cantidad), 'whatsapp_click', { producto: p.id, origen: 'producto' });
    const consultar = () => T.abrirWA(T.mensajeProducto(p, seleccion, T.vendido(p) ? 'interes' : 'disponibilidad'), 'whatsapp_click', { producto: p.id, origen: T.vendido(p) ? 'interes' : 'disponibilidad' });
    const on = (id, fn) => { const el = T.$(id); if (el) el.addEventListener('click', fn); };
    on('#btn-pedir', pedir); on('#btn-pedir-fijo', pedir); on('#btn-consultar', consultar);
    on('#btn-carrito-add', () => T.carrito.agregar(p, Object.assign({}, seleccion), cantidad));
    on('#btn-copiar', async () => { try { await navigator.clipboard.writeText(url); T.toast('Enlace copiado'); } catch (e) { prompt('Copia el enlace:', url); } });
    if (navigator.share) { const bc = T.$('#btn-compartir'); bc.hidden = false; bc.addEventListener('click', () => navigator.share({ title: p.nombre, text: p.descripcionCorta || p.nombre, url }).catch(() => { })); }
    if (T.param('carrito') === '1' && p.variantes.length) { T.toast('Elige las opciones y agrega al carrito'); const v = T.$('#variantes'); if (v) v.scrollIntoView({ block: 'center' }); }
  });
})();
