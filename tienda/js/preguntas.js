(function () {
  const T = window.Tienda;
  T.iniciar('preguntas', ({ config }) => {
    const faqs = T.faqs();
    const wa = config.whatsapp || {};
    const grupos = []; faqs.forEach(q => { const g = q.grupo || 'General'; if (!grupos.includes(g)) grupos.push(g); });
    const render = (filtro) => {
      const f = T.slug(filtro || '').replace(/-/g, ' ');
      const lista = f ? faqs.filter(q => T.slug(q.p + ' ' + q.r).replace(/-/g, ' ').includes(f)) : faqs;
      const html = grupos.map(g => { const qs = lista.filter(q => (q.grupo || 'General') === g); return qs.length ? `<section class="bloque" id="g-${T.slug(g)}"><h2 style="margin-top:0">${T.esc(g)}</h2>${T.renderFaq(qs)}</section>` : ''; }).join('');
      T.$('#faq-lista').innerHTML = html || '<div class="vacio">No encontramos una pregunta con esas palabras. Escríbenos por WhatsApp y te respondemos.</div>';
      if (f) T.$$('#faq-lista details').forEach(d => d.open = true);
    };
    T.$('#contenido').innerHTML = `<h1>Preguntas frecuentes</h1>
      <p style="color:var(--texto-suave)">Queremos que compres con tranquilidad. Aquí respondemos lo que más nos preguntan; si falta algo, escríbenos y te lo aclaramos antes de que decidas.</p>
      <div class="buscador" style="max-width:none;margin:0 0 1rem">${T.ico.buscar}<label class="visualmente-oculto" for="buscar-faq">Buscar pregunta</label><input id="buscar-faq" type="search" placeholder="Buscar una pregunta (envíos, pagos, cambios…)" autocomplete="off"></div>
      <div class="chips">${grupos.map(g => `<a class="chip" href="#g-${T.slug(g)}">${T.esc(g)}</a>`).join('')}</div>
      <div id="faq-lista"></div>
      <div class="bloque"><h2 style="margin-top:0">¿Sigues con dudas?</h2><p>Pregúntanos directamente. Respondemos antes de que compres, sin compromiso.</p>
        <div class="atajos">
          <button class="btn btn-whatsapp" data-msg="${T.esc(wa.mensajeGeneral)}">${T.ico.wa} Escribir por WhatsApp</button>
          <button class="btn btn-suave" data-msg="${T.esc(wa.mensajeEnvios)}">Consultar envíos</button>
          <button class="btn btn-suave" data-msg="${T.esc(wa.mensajePagos)}">Métodos de pago</button>
        </div></div>`;
    render('');
    T.$('#buscar-faq').addEventListener('input', (e) => render(e.target.value));
    T.$('#contenido').addEventListener('click', (e) => { const b = e.target.closest('[data-msg]'); if (b) T.abrirWA(b.dataset.msg, 'whatsapp_click', { origen: 'preguntas' }); });
  });
})();
