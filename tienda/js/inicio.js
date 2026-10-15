(function () {
  const T = window.Tienda;
  T.iniciar('inicio', ({ config, catalogo }) => {
    const n = config.negocio || {}, h = config.portada || {};
    T.$('#hero').innerHTML = `
      <div>
        ${h.etiqueta ? `<span class="hero-etiqueta">${T.esc(h.etiqueta)}</span>` : ''}
        <h1>${T.esc(h.titulo || n.eslogan || 'Bienvenido')}</h1>
        <p>${T.esc(h.subtitulo || n.descripcion || '')}</p>
        <div class="hero-acciones">
          <a class="btn btn-acento" href="catalogo.html">Explorar todos los productos</a>
          <a class="btn btn-contorno" href="catalogo.html?f=ofertas">Ver ofertas</a>
        </div>
      </div>
      ${h.imagen ? `<div class="hero-imagen"><img src="${T.esc(T.ruta(h.imagen))}" alt="" width="380" height="380"></div>` : ''}`;

    const vis = T.visibles();
    const conteo = (id) => vis.filter(p => p.categoria === id).length;
    T.$('#categorias').classList.add('rail', 'rail-cat');
    T.$$('#destacados, #populares, #nuevos, #ofertas, #recomendados, #sec-vistos .grid-productos').forEach(g => g.classList.add('rail'));
    T.$('#categorias').innerHTML = catalogo.categorias.filter(c => c.visible !== false && conteo(c.id) > 0).map(c => `
      <a class="tarjeta-categoria aparece" href="catalogo.html?cat=${encodeURIComponent(c.id)}">
        <span class="icono">${T.icono(c.icono, 'svg:etiqueta')}</span><strong>${T.esc(c.nombre)}</strong>
        <span>${conteo(c.id)} producto${conteo(c.id) === 1 ? '' : 's'}</span></a>`).join('') ||
      '<div class="vacio" style="grid-column:1/-1">Aún no hay categorías con productos.</div>';

    const seccion = (idSec, idGrid, lista) => {
      const s = T.$(idSec); if (!lista.length) { s.hidden = true; return; }
      s.hidden = false; T.renderGrid(idGrid, lista.slice(0, 8));
    };
    seccion('#sec-destacados', '#destacados', vis.filter(p => p.destacado));
    seccion('#sec-populares', '#populares', vis.filter(p => p.popular));
    seccion('#sec-nuevos', '#nuevos', vis.filter(p => p.nuevo).sort((a, b) => (b.fechaCreacion || '').localeCompare(a.fechaCreacion || '')));
    seccion('#sec-ofertas', '#ofertas', vis.filter(p => p.oferta && p.disponible));
    const mostrados = new Set([...T.$$('.tarjeta')].map(t => t.dataset.id));
    seccion('#sec-recomendados', '#recomendados', vis.filter(p => p.disponible && !mostrados.has(p.id)).slice(0, 4));

    T.$('#confianza').innerHTML = (config.confianza || []).map(c => `
      <div class="confianza-item"><span class="icono">${T.icono(c.icono, 'svg:escudo')}</span>
        <div><strong>${T.esc(c.titulo)}</strong><span>${c.texto ? T.esc(c.texto) : '<em class="pendiente">Información pendiente de confirmar por el negocio.</em>'}</span></div></div>`).join('');

    T.renderVistos('#sec-vistos');
    T.$('#encuesta-inicio').innerHTML = T.encuesta('¿Qué te gustaría encontrar en la tienda?');
    T.$('#pasos').innerHTML = (config.pasosCompra || []).map((p, i) => `<div class="paso aparece"><span class="paso-num">${i + 1}</span><strong>${T.esc(p.titulo)}</strong><span>${T.esc(p.texto)}</span></div>`).join('');
    if (!(config.pasosCompra || []).length) T.$('#sec-pasos').hidden = true;
    const faqs = T.faqs(); const dest = faqs.filter(q => q.destacada);
    T.$('#faq-inicio').innerHTML = T.renderFaq((dest.length ? dest : faqs).slice(0, 5));
    if (!faqs.length) T.$('#sec-faq').hidden = true;

    const wa = config.whatsapp || {};
    const atajo = (txt, msg, ev) => `<button class="btn btn-whatsapp btn-sm" data-msg="${T.esc(msg)}" data-ev="${ev}">${T.ico.wa} ${txt}</button>`;
    T.$('#atajos-wa').innerHTML = atajo('Consultar envíos', wa.mensajeEnvios, 'envios') + atajo('Métodos de pago', wa.mensajePagos, 'pagos') + atajo('Hablar con nosotros', wa.mensajeGeneral, 'general');
    T.$('#atajos-wa').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) T.abrirWA(b.dataset.msg, 'whatsapp_click', { origen: b.dataset.ev }); });
  });
})();
