(function () {
  const T = window.Tienda;
  T.iniciar('preguntas', ({ config }) => {
    const faqs = config.preguntasFrecuentes || [];
    const wa = config.whatsapp || {};
    T.$('#contenido').innerHTML = `<h1>Preguntas frecuentes</h1>
      <div class="bloque">${faqs.length ? faqs.map(q => `<details class="faq"><summary>${T.esc(q.p)}</summary><p>${T.esc(q.r).replace(/\n/g, '<br>')}</p></details>`).join('') : '<p class="pendiente">Aún no hay preguntas frecuentes configuradas.</p>'}</div>
      <div class="bloque"><h2>¿No encontraste tu respuesta?</h2><p>Escríbenos y te respondemos directamente.</p>
        <div class="atajos">
          <button class="btn btn-whatsapp" data-msg="${T.esc(wa.mensajeGeneral)}">${T.ico.wa} Escribir por WhatsApp</button>
          <button class="btn btn-suave" data-msg="${T.esc(wa.mensajeEnvios)}">Consultar envíos</button>
          <button class="btn btn-suave" data-msg="${T.esc(wa.mensajePagos)}">Métodos de pago</button>
        </div></div>`;
    T.$('#contenido').addEventListener('click', (e) => { const b = e.target.closest('[data-msg]'); if (b) T.abrirWA(b.dataset.msg, 'whatsapp_click', { origen: 'preguntas' }); });
  });
})();
