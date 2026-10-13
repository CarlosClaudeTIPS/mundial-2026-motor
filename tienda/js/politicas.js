(function () {
  const T = window.Tienda;
  T.iniciar('politicas', ({ config }) => {
    const pol = config.politicas || {};
    const sec = (id, titulo, txt) => `<section class="bloque" id="${id}"><h2 style="margin-top:0">${titulo}</h2>${txt ? `<p>${T.esc(txt).replace(/\n/g, '<br>')}</p>` : `<div class="aviso-pendiente">Esta información aún no ha sido confirmada por el negocio. Se publicará cuando esté definida. Mientras tanto, consúltala por WhatsApp.</div>`}</section>`;
    T.$('#contenido').innerHTML = `<h1>Políticas y condiciones</h1>
      <p style="color:var(--texto-suave)">Condiciones reales del negocio. Se muestran únicamente las que han sido confirmadas; las demás aparecen como pendientes para no publicar información inexacta.</p>
      ${sec('entregas', 'Entregas y envíos', pol.entregas)}
      ${sec('pagos', 'Métodos de pago', pol.pagos)}
      ${sec('cambios', 'Cambios, devoluciones y garantías', [pol.cambios, pol.garantia].filter(Boolean).join('\n\n'))}
      ${sec('privacidad', 'Privacidad y tratamiento de datos', pol.privacidad)}
      <section class="bloque"><h2 style="margin-top:0">Sobre los pedidos por WhatsApp</h2><p>Esta página es un catálogo. Los pedidos se gestionan por WhatsApp: abrir una conversación no constituye una compra confirmada ni garantiza inventario disponible. La disponibilidad, el precio final y el costo de envío se confirman en el chat antes de cerrar la venta.</p></section>`;
    if (location.hash) { const el = T.$(location.hash); if (el) setTimeout(() => el.scrollIntoView({ block: 'start' }), 50); }
  });
})();
