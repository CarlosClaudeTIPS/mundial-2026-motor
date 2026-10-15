/* ============================================================
   Tienda digital — núcleo compartido (sin dependencias)
   Carga config.json + catalogo.json, construye encabezado/pie,
   enlaces de WhatsApp, carrito, tarjetas y analítica.
   ============================================================ */
(function () {
  'use strict';

  const T = window.Tienda = window.Tienda || {};
  const BASE = (document.querySelector('base') && document.querySelector('base').getAttribute('href')) || '';
  const LS = {
    carrito: 'tienda_carrito',
    borradorCatalogo: 'tienda_borrador_catalogo',
    borradorConfig: 'tienda_borrador_config',
    previsualizar: 'tienda_previsualizar',
    metricas: 'tienda_metricas'
  };
  T.LS = LS;

  /* ---------- Utilidades ---------- */
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  T.$ = $; T.$$ = $$;

  T.esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  T.formatoPrecio = (n) => {
    if (n == null || isNaN(n)) return '';
    return '$' + Math.round(Number(n)).toLocaleString('es-CO');
  };

  T.descuento = (p) => {
    if (!p.precioAnterior || p.precioAnterior <= p.precio) return 0;
    return Math.round((1 - p.precio / p.precioAnterior) * 100);
  };

  T.slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  T.leerLS = (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } };
  T.guardarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };

  T.param = (k) => new URLSearchParams(location.search).get(k);

  T.ruta = (rel) => BASE + rel;

  T.toast = (msg) => {
    let t = $('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('visible');
    clearTimeout(t._tm); t._tm = setTimeout(() => t.classList.remove('visible'), 2200);
  };

  /* ---------- Carga de datos ---------- */
  T.previsualizando = () => T.param('preview') === '1' || T.leerLS(LS.previsualizar, false) === true;

  T.cargar = async function () {
    if (T.datos) return T.datos;
    const [cfgRes, catRes] = await Promise.all([
      fetch(T.ruta('data/config.json'), { cache: 'no-cache' }),
      fetch(T.ruta('data/catalogo.json'), { cache: 'no-cache' })
    ]);
    let config = await cfgRes.json();
    let catalogo = await catRes.json();
    T.modoBorrador = false;
    if (T.previsualizando()) {
      const bc = T.leerLS(LS.borradorCatalogo, null);
      const bcfg = T.leerLS(LS.borradorConfig, null);
      if (bc) { catalogo = bc; T.modoBorrador = true; }
      if (bcfg) { config = bcfg; T.modoBorrador = true; }
    }
    catalogo.productos = (catalogo.productos || []).map(T.normalizarProducto);
    catalogo.categorias = (catalogo.categorias || []).slice().sort((a, b) => (a.orden || 0) - (b.orden || 0));
    T.datos = { config, catalogo };
    T.aplicarMarca(config);
    T.analitica(config);
    return T.datos;
  };

  T.normalizarProducto = (p) => Object.assign({
    precioAnterior: null, disponible: true, nuevo: false, oferta: false, destacado: false, popular: false,
    visible: true, orden: 0, imagenes: [], video: '', descripcionCorta: '', descripcion: '', problema: '',
    beneficios: [], especificaciones: {}, incluye: [], instrucciones: [], precauciones: [], preguntas: [],
    variantes: [], palabrasClave: [], relacionados: [], fechaCreacion: '', stock: null
  }, p, { precio: Number(p.precio) || 0, precioAnterior: p.precioAnterior ? Number(p.precioAnterior) : null, stock: (p.stock === '' || p.stock == null) ? null : Math.max(0, Math.round(Number(p.stock)) || 0) });

  T.vendido = (p) => !p.disponible && p.stock === 0;
  T.textoStock = (p) => (p.disponible && p.stock != null && p.stock > 0) ? `Quedan ${p.stock} unidad${p.stock === 1 ? '' : 'es'}` : '';
  T.visibles = () => T.datos.catalogo.productos.filter(p => p.visible !== false).sort((a, b) => (a.orden || 0) - (b.orden || 0));
  T.categoria = (id) => T.datos.catalogo.categorias.find(c => c.id === id);
  T.producto = (id) => T.datos.catalogo.productos.find(p => p.id === id);

  T.aplicarMarca = (config) => {
    const m = config.marca || {};
    const r = document.documentElement.style;
    if (m.colorPrimario) {
      r.setProperty('--primario', m.colorPrimario);
      r.setProperty('--primario-oscuro', T.oscurecer(m.colorPrimario, 14));
      r.setProperty('--primario-claro', T.aclarar(m.colorPrimario, 82));
    }
    if (m.colorAcento) {
      r.setProperty('--acento', m.colorAcento);
      r.setProperty('--acento-oscuro', T.oscurecer(m.colorAcento, 10));
    }
    const nombre = config.negocio && config.negocio.nombre;
    if (nombre && document.title.indexOf('{negocio}') >= 0) document.title = document.title.replace('{negocio}', nombre);
  };

  function hexRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function rgbHex(r, g, b) { return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
  T.oscurecer = (hex, pct) => { const [r, g, b] = hexRgb(hex); const f = 1 - pct / 100; return rgbHex(r * f, g * f, b * f); };
  T.aclarar = (hex, pct) => { const [r, g, b] = hexRgb(hex); const f = pct / 100; return rgbHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f); };

  /* ---------- URL del producto y compartir ---------- */
  T.urlProducto = (p, absoluta) => {
    const cfg = T.datos.config.sitio || {};
    const rel = cfg.paginasEstaticas ? ('p/' + encodeURIComponent(p.id) + '.html') : ('producto.html?p=' + encodeURIComponent(p.id));
    if (!absoluta) return T.ruta(rel);
    const base = new URL(T.ruta(rel), location.href);
    return base.href;
  };

  T.imagenProducto = (p, i) => {
    const src = (p.imagenes && p.imagenes[i || 0]) || 'img/sin-imagen.svg';
    return /^https?:\/\//.test(src) ? src : T.ruta(src);
  };

  /* ---------- WhatsApp ---------- */
  T.numeroWA = () => String((T.datos.config.whatsapp || {}).numero || '').replace(/\D/g, '');
  T.hayWA = () => T.numeroWA().length >= 10;

  T.enlaceWA = (mensaje) => {
    const num = T.numeroWA();
    const txt = encodeURIComponent(mensaje || '');
    return num ? `https://wa.me/${num}?text=${txt}` : '#';
  };

  T.plantilla = (txt, vars) => String(txt || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : ''));

  T.mensajeProducto = (p, variantes, tipo, cantidad) => {
    const wa = T.datos.config.whatsapp || {};
    const tpl = tipo === 'interes' ? (wa.mensajeInteres || 'Hola, vi que el producto {nombre} ya se vendió. Me interesa si consiguen otro. {enlace}') : tipo === 'disponibilidad' ? wa.mensajeDisponibilidad : wa.mensajeProducto;
    let vTxt = variantes && Object.keys(variantes).length
      ? Object.entries(variantes).map(([k, v]) => `${k}: ${v}`).join(', ') + '\n' : '';
    if (cantidad && cantidad > 1) vTxt = `Cantidad: ${cantidad}\n` + vTxt;
    return T.plantilla(tpl || 'Hola, estoy interesado en {nombre}. {enlace}', {
      nombre: p.nombre, precio: T.formatoPrecio(p.precio), enlace: T.urlProducto(p, true), variantes: vTxt
    }).trim();
  };

  T.mensajeSugerencia = (texto) => T.plantilla((T.datos.config.whatsapp || {}).mensajeSugerencia || 'Hola, me gustaría que tuvieran en la tienda: {texto}', { texto });
  /* Cuadro "¿Qué te gustaría encontrar?" reutilizable */
  T.encuesta = (titulo) => `<div class="encuesta"><strong>${T.esc(titulo || '¿Qué te gustaría encontrar en la tienda?')}</strong><p>Cuéntanos qué producto buscas y lo tenemos en cuenta para traerlo.</p><form class="encuesta-form"><label class="visualmente-oculto" for="enc-${Math.random().toString(36).slice(2, 7)}">Producto que te gustaría</label><input type="text" maxlength="140" placeholder="Ej.: audífonos inalámbricos, control de PS5…" required><button class="btn btn-whatsapp btn-sm" type="submit">${T.ico.wa} Enviar</button></form></div>`;
  document.addEventListener('submit', (e) => { const f = e.target.closest('.encuesta-form'); if (!f || !T.datos) return; e.preventDefault(); const v = f.querySelector('input').value.trim(); if (!v) return; if (T.abrirWA(T.mensajeSugerencia(v), 'sugerencia', { texto: v.slice(0, 60) })) f.reset(); });

  T.abrirWA = (mensaje, evento, extra) => {
    if (!T.hayWA()) { T.toast('El número de WhatsApp aún no está configurado (admin → Configuración).'); return false; }
    T.registrar(evento || 'whatsapp_click', extra || {});
    window.open(T.enlaceWA(mensaje), '_blank', 'noopener');
    return true;
  };

  /* ---------- Analítica (GA4 / Meta Pixel / contador local) ---------- */
  T.analitica = (config) => {
    const a = config.analitica || {};
    if (a.ga4 && !window.gtag) {
      const s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(a.ga4);
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date()); window.gtag('config', a.ga4);
    }
    if (a.metaPixel && !window.fbq) {
      /* Carga estándar de Meta Pixel */
      !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', a.metaPixel); window.fbq('track', 'PageView');
    }
  };

  T.registrar = (evento, datos) => {
    datos = datos || {};
    try { if (window.gtag) window.gtag('event', evento, datos); } catch (e) { }
    try { if (window.fbq) window.fbq('trackCustom', evento, datos); } catch (e) { }
    /* contador local (solo este navegador) para ver en el panel admin */
    const m = T.leerLS(LS.metricas, {});
    const clave = evento + (datos.producto ? ':' + datos.producto : '');
    m[clave] = (m[clave] || 0) + 1;
    T.guardarLS(LS.metricas, m);
  };

  /* ---------- Carrito ---------- */
  const MAX_CANT = 99;
  T.carrito = {
    items: T.leerLS(LS.carrito, []),
    /* Sanea lo que venga del almacenamiento local: productos inexistentes/ocultos y cantidades fuera de rango */
    sanear() {
      if (!T.datos) return;
      const antes = JSON.stringify(this.items);
      this.items = (Array.isArray(this.items) ? this.items : []).filter(i => { const p = i && T.producto(i.id); return p && p.visible !== false && p.disponible; })
        .map(i => ({ clave: i.clave || this.clave(i.id, i.variantes), id: i.id, variantes: (i.variantes && typeof i.variantes === 'object') ? i.variantes : {}, cantidad: Math.min(MAX_CANT, Math.max(1, Math.round(Number(i.cantidad)) || 1)) }));
      if (JSON.stringify(this.items) !== antes) this.guardar();
    },
    guardar() { T.guardarLS(LS.carrito, this.items); T.renderContador(); },
    clave(id, variantes) { return id + '|' + JSON.stringify(variantes || {}); },
    agregar(p, variantes, cant) {
      const k = this.clave(p.id, variantes);
      const ex = this.items.find(i => i.clave === k);
      if (!p.disponible) { T.toast('Este producto está agotado por ahora.'); return; }
      cant = Math.min(MAX_CANT, Math.max(1, Math.round(Number(cant)) || 1));
      const tope = p.stock != null ? Math.min(MAX_CANT, p.stock) : MAX_CANT;
      if (ex && ex.cantidad + cant > tope) { T.toast(`Solo hay ${tope} unidad${tope === 1 ? '' : 'es'} disponible${tope === 1 ? '' : 's'}.`); ex.cantidad = tope; this.guardar(); return; }
      if (ex) ex.cantidad = Math.min(tope, ex.cantidad + cant);
      else this.items.push({ clave: k, id: p.id, variantes: variantes || {}, cantidad: Math.min(tope, cant) });
      this.guardar(); T.registrar('add_to_cart', { producto: p.id });
      T.toast('Agregado al carrito');
    },
    cambiar(k, delta) {
      const it = this.items.find(i => i.clave === k); if (!it) return;
      it.cantidad = Math.min(MAX_CANT, it.cantidad + delta); if (it.cantidad <= 0) this.items = this.items.filter(i => i.clave !== k);
      this.guardar(); T.renderCarrito();
    },
    quitar(k) { this.items = this.items.filter(i => i.clave !== k); this.guardar(); T.renderCarrito(); },
    vaciar() { this.items = []; this.guardar(); T.renderCarrito(); },
    total() { return this.items.reduce((s, i) => { const p = T.producto(i.id); return s + (p ? p.precio * i.cantidad : 0); }, 0); },
    cantidad() { return this.items.reduce((s, i) => s + i.cantidad, 0); },
    mensaje() {
      const wa = T.datos.config.whatsapp || {};
      const lineas = this.items.map(i => {
        const p = T.producto(i.id); if (!p) return '';
        const v = Object.keys(i.variantes).length ? ' (' + Object.entries(i.variantes).map(([k, val]) => `${k}: ${val}`).join(', ') + ')' : '';
        return `• ${i.cantidad} x ${p.nombre}${v} — ${T.formatoPrecio(p.precio)}\n  ${T.urlProducto(p, true)}`;
      }).filter(Boolean).join('\n');
      return T.plantilla(wa.mensajeCarrito || 'Hola, quiero pedir:\n{items}\nTotal: {total}', { items: lineas, total: T.formatoPrecio(this.total()) });
    }
  };

  T.renderContador = () => {
    const n = T.carrito.cantidad();
    $$('.contador').forEach(c => { c.textContent = n || ''; if (!n) c.setAttribute('data-cero', ''); else c.removeAttribute('data-cero'); });
  };

  T.renderCarrito = () => {
    const lista = $('#carrito-lista'); if (!lista) return;
    const items = T.carrito.items;
    if (!items.length) {
      lista.innerHTML = '<div class="vacio">Tu carrito está vacío.<br><a href="' + T.ruta('catalogo.html') + '">Explorar el catálogo</a></div>';
    } else {
      lista.innerHTML = items.map(i => {
        const p = T.producto(i.id); if (!p) return '';
        const v = Object.entries(i.variantes).map(([k, val]) => `${T.esc(k)}: ${T.esc(val)}`).join(' · ');
        return `<div class="carrito-item">
          <img src="${T.esc(T.imagenProducto(p))}" alt="" loading="lazy">
          <div><strong>${T.esc(p.nombre)}</strong>${v ? `<small>${v}</small>` : ''}<small>${T.formatoPrecio(p.precio)}</small>
            <button class="quitar" data-quitar="${T.esc(i.clave)}">Quitar</button></div>
          <div class="cantidad"><button data-menos="${T.esc(i.clave)}" aria-label="Menos">−</button><span>${i.cantidad}</span><button data-mas="${T.esc(i.clave)}" aria-label="Más">+</button></div>
        </div>`;
      }).join('');
    }
    const tot = $('#carrito-total'); if (tot) tot.textContent = T.formatoPrecio(T.carrito.total());
    const btn = $('#carrito-enviar'); if (btn) btn.classList.toggle('deshabilitado', !items.length);
  };

  T.abrirCarrito = (abrir) => {
    const c = $('#carrito'), capa = $('#capa');
    if (!c) return;
    c.classList.toggle('abierto', abrir); capa.classList.toggle('abierta', abrir);
    c.setAttribute('aria-hidden', abrir ? 'false' : 'true');
    if (abrir) { c.removeAttribute('inert'); T.renderCarrito(); setTimeout(() => $('#cerrar-carrito').focus(), 50); }
    else { c.setAttribute('inert', ''); const b = $('#btn-carrito'); if (b && c.contains(document.activeElement)) b.focus(); }
  };

  /* ---------- Iconos ---------- */
  T.ico = {
    wa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.6c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.2-.6-.4zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.4c1.4.8 3.1 1.2 4.8 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3.1.8.8-3-.2-.3C4 15 3.7 13.5 3.7 12c0-4.6 3.7-8.3 8.3-8.3s8.3 3.7 8.3 8.3-3.7 8.2-8.3 8.2z"/></svg>',
    carrito: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>',
    buscar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    cerrar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    mas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    fb: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z"/></svg>',
    ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.5 3c.3 2.3 1.6 3.7 3.9 3.9v3.3c-1.4 0-2.7-.4-3.9-1.2v6.5a5.7 5.7 0 1 1-5.7-5.7c.4 0 .7 0 1 .1v3.4a2.4 2.4 0 1 0 1.4 2.2V3h3.3z"/></svg>',
    enlace: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5"/></svg>',
    compartir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
    tienda: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l1.5-5h15L21 9M3 9h18v11H3zM3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/></svg>'
  };


  /* Iconos de línea para categorías/confianza. En los datos: "svg:casa" o un emoji/texto. */
  const L = (d) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  T.icoCat = {
    casa: L('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
    enchufe: L('<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4"/>'),
    hoja: L('<path d="M5 21c0-9 4-15 15-16-1 11-7 15-15 16zM5 21c3-5 7-9 11-11"/>'),
    bolso: L('<path d="M4 8h16l-1 12H5zM9 8V6a3 3 0 0 1 6 0v2"/>'),
    estrella: L('<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>'),
    etiqueta: L('<path d="M3 3h8l10 10-8 8L3 11zM7.5 7.5h.01"/>'),
    camion: L('<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7zM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>'),
    tarjeta: L('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>'),
    chat: L('<path d="M4 5h16v11H8l-4 4z"/>'),
    escudo: L('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>'),
    reloj: L('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    regalo: L('<path d="M3 9h18v4H3zM5 13h14v8H5zM12 9v12M12 9c-3 0-5-1-5-3s2-3 5 0c3-3 5-2 5 0s-2 3-5 3"/>'),
    herramienta: L('<path d="M14.7 6.3a4 4 0 0 0 5 5L13 18a2 2 0 0 1-3 0l-1-1a2 2 0 0 1 0-3l6.7-6.7z"/>'),
    corazon: L('<path d="M12 21s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z"/>')
  };
  T.icono = (v, def) => {
    v = v || def || '';
    if (typeof v === 'string' && v.startsWith('svg:')) return T.icoCat[v.slice(4)] || T.icoCat.etiqueta;
    return T.esc(v);
  };

  /* ---------- Encabezado y pie ---------- */
  T.renderEncabezado = (activa) => {
    const cfg = T.datos.config, n = cfg.negocio || {};
    const el = $('#encabezado'); if (!el) return;
    const buscador = (id) => `<form class="buscador" role="search" action="${T.ruta('catalogo.html')}" method="get">
        ${T.ico.buscar}<label class="visualmente-oculto" for="${id}">Buscar productos</label>
        <input id="${id}" type="search" name="q" placeholder="Buscar productos…" autocomplete="off">
        <button type="submit" aria-label="Buscar">${T.ico.buscar}</button></form>`;
    /* el elemento activo depende también del filtro de la URL (ofertas / novedades) */
    const f = T.param('f');
    if (activa === 'catalogo' && f === 'ofertas') activa = 'ofertas';
    else if (activa === 'catalogo' && f === 'nuevos') activa = 'nuevos';
    const act = (k) => activa === k ? 'class="activo" aria-current="page"' : '';
    const enlaces = `<a href="${T.ruta('index.html')}" ${act('inicio')}>Inicio</a>
        <a href="${T.ruta('catalogo.html')}" ${act('catalogo')}>Catálogo</a>
        <a href="${T.ruta('catalogo.html?f=ofertas')}" ${act('ofertas')}>Ofertas</a>
        <a href="${T.ruta('catalogo.html?f=nuevos')}" ${act('nuevos')}>Novedades</a>
        <a href="${T.ruta('preguntas.html')}" ${act('preguntas')}>Preguntas</a>`;
    const avisos = [];
    if (!T.hayWA()) avisos.push(`<div class="aviso-config" role="status"><span>Falta configurar el número de WhatsApp: los botones de pedido no funcionarán. Hazlo en <a href="${T.ruta('admin.html')}">el panel de administración</a>.</span></div>`);
    if (T.modoBorrador) avisos.push(`<div class="aviso-demo" role="status"><span>Estás viendo el <strong>borrador local</strong> del panel admin. <a href="#" id="salir-preview">Salir de la vista previa</a></span></div>`);
    else if ((cfg.sitio || {}).avisoDemo) avisos.push(`<div class="aviso-demo" role="status"><span>Catálogo de demostración: los productos marcados (DEMO) son ejemplos y no están a la venta.</span><button type="button" data-cerrar-aviso aria-label="Cerrar aviso">✕</button></div>`);
    if (avisos.length && !T.leerLS('tienda_avisos_cerrados', false)) {
      const caja = document.createElement('div'); caja.className = 'avisos-fijos'; caja.innerHTML = avisos.join('');
      document.body.appendChild(caja);
      caja.addEventListener('click', (e) => { if (e.target.closest('[data-cerrar-aviso]')) { e.target.closest('div').remove(); } });
    }
    el.innerHTML = `
      <div class="contenedor">
        <div class="encabezado-barra">
          <button class="icono-btn solo-movil" id="btn-menu" aria-label="Abrir menú" aria-expanded="false">${T.ico.menu}</button>
          <a class="logo" href="${T.ruta('index.html')}">${n.logo ? `<img src="${T.esc(T.ruta(n.logo))}" alt="">` : T.ico.tienda}<span class="logo-texto">${T.esc(n.nombre || 'Mi Tienda')}</span></a>
          <nav class="nav" aria-label="Principal">${enlaces}</nav>
          ${buscador('buscar-escritorio')}
          <button class="icono-btn" id="btn-carrito" aria-label="Abrir carrito">${T.ico.carrito}<span class="contador"></span></button>
        </div>
        <div class="menu-movil" id="menu-movil">${buscador('buscar-movil')}${enlaces}</div>
      </div>`;
    $('#btn-menu').addEventListener('click', () => {
      const m = $('#menu-movil'); const ab = m.classList.toggle('abierto');
      $('#btn-menu').setAttribute('aria-expanded', ab ? 'true' : 'false');
    });
    $('#btn-carrito').addEventListener('click', () => T.abrirCarrito(true));
    const sp = $('#salir-preview'); if (sp) sp.addEventListener('click', (e) => { e.preventDefault(); T.guardarLS(LS.previsualizar, false); location.href = location.pathname; });
    T.renderContador();
  };

  T.renderPie = () => {
    const cfg = T.datos.config, n = cfg.negocio || {}, r = cfg.redes || {};
    const el = $('#pie'); if (!el) return;
    const redes = [
      r.facebook && `<a href="${T.esc(r.facebook)}" target="_blank" rel="noopener" aria-label="Facebook">${T.ico.fb}</a>`,
      r.instagram && `<a href="${T.esc(r.instagram)}" target="_blank" rel="noopener" aria-label="Instagram">${T.ico.ig}</a>`,
      r.tiktok && `<a href="${T.esc(r.tiktok)}" target="_blank" rel="noopener" aria-label="TikTok">${T.ico.tiktok}</a>`,
      r.marketplace && `<a href="${T.esc(r.marketplace)}" target="_blank" rel="noopener" aria-label="Facebook Marketplace">${T.ico.tienda}</a>`
    ].filter(Boolean).join('');
    const cats = T.datos.catalogo.categorias.filter(c => c.visible !== false && T.visibles().some(p => p.categoria === c.id)).map(c => `<li><a href="${T.ruta('catalogo.html?cat=' + encodeURIComponent(c.id))}">${T.esc(c.nombre)}</a></li>`).join('');
    const contacto = [
      T.hayWA() ? `<li><a href="${T.enlaceWA((cfg.whatsapp || {}).mensajeGeneral)}" target="_blank" rel="noopener">WhatsApp: +${T.numeroWA()}</a></li>` : '<li class="pendiente">WhatsApp: pendiente de configurar</li>',
      n.ciudad ? `<li>${T.esc(n.ciudad)}</li>` : '',
      n.horario ? `<li>${T.esc(n.horario)}</li>` : ''
    ].join('');
    el.innerHTML = `<div class="contenedor">
      <div class="pie-grid">
        <div><a class="logo" href="${T.ruta('index.html')}" style="color:#fff">${n.logo ? `<img src="${T.esc(T.ruta(n.logo))}" alt="">` : ''}<span>${T.esc(n.nombre || 'Mi Tienda')}</span></a>
          <p style="margin-top:.6rem;font-size:.92rem">${T.esc(n.descripcion || '')}</p>
          ${redes ? `<div class="pie-redes">${redes}</div>` : ''}</div>
        <div><h4>Categorías</h4><ul>${cats}</ul></div>
        <div><h4>Ayuda</h4><ul>
          <li><a href="${T.ruta('preguntas.html')}">Preguntas frecuentes</a></li>
          <li><a href="${T.ruta('politicas.html#entregas')}">Entregas</a></li>
          <li><a href="${T.ruta('politicas.html#pagos')}">Pagos</a></li>
          <li><a href="${T.ruta('politicas.html#cambios')}">Cambios y garantías</a></li>
          <li><a href="${T.ruta('politicas.html#privacidad')}">Privacidad y datos</a></li></ul></div>
        <div><h4>Contacto</h4><ul>${contacto}</ul></div>
      </div>
      <div class="pie-bajo"><span>© ${new Date().getFullYear()} ${T.esc(n.nombre || '')}. Todos los derechos reservados.</span>
        <span>Abrir WhatsApp no confirma una compra ni garantiza inventario disponible.</span></div>
    </div>`;
  };

  T.renderGlobales = () => {
    /* botón flotante, carrito y capa */
    const cfg = T.datos.config;
    if (!$('#carrito')) {
      const wrap = document.createElement('div');
      wrap.innerHTML = `<div class="capa" id="capa"></div>
        <aside class="carrito" id="carrito" aria-hidden="true" inert aria-label="Carrito">
          <div class="carrito-cabecera"><h2>Tu pedido</h2><button class="icono-btn" id="cerrar-carrito" aria-label="Cerrar">${T.ico.cerrar}</button></div>
          <div class="carrito-lista" id="carrito-lista"></div>
          <div class="carrito-pie">
            <div class="carrito-total"><span>Total estimado</span><span id="carrito-total">$0</span></div>
            <button class="btn btn-whatsapp btn-bloque" id="carrito-enviar">${T.ico.wa} Enviar pedido por WhatsApp</button>
            <button class="btn btn-suave btn-sm" id="carrito-vaciar">Vaciar carrito</button>
            <p class="nota-legal">El total es estimado y no incluye envío. Te confirmamos disponibilidad y valor final por WhatsApp.</p>
          </div>
        </aside>
        <a class="wa-flotante" id="wa-flotante" href="${T.enlaceWA((cfg.whatsapp || {}).mensajeGeneral)}" target="_blank" rel="noopener" aria-label="Escribir por WhatsApp">${T.ico.wa}<span>WhatsApp</span></a>`;
      document.body.appendChild(wrap);
      $('#capa').addEventListener('click', () => T.abrirCarrito(false));
      $('#cerrar-carrito').addEventListener('click', () => T.abrirCarrito(false));
      $('#carrito-vaciar').addEventListener('click', () => T.carrito.vaciar());
      $('#carrito-enviar').addEventListener('click', () => { if (T.carrito.items.length) T.abrirWA(T.carrito.mensaje(), 'whatsapp_carrito', { items: T.carrito.cantidad() }); });
      $('#carrito-lista').addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.mas) T.carrito.cambiar(b.dataset.mas, 1);
        else if (b.dataset.menos) T.carrito.cambiar(b.dataset.menos, -1);
        else if (b.dataset.quitar) T.carrito.quitar(b.dataset.quitar);
      });
      $('#wa-flotante').addEventListener('click', (e) => { if (!T.hayWA()) { e.preventDefault(); T.toast('El número de WhatsApp aún no está configurado.'); } else T.registrar('whatsapp_click', { origen: 'flotante' }); });
    }
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') T.abrirCarrito(false); });
  };

  /* ---------- Tarjeta de producto ---------- */
  T.tarjeta = (p) => {
    const cat = T.categoria(p.categoria);
    const d = T.descuento(p);
    const etiquetas = [
      !p.disponible && `<span class="etiqueta etiqueta-agotado">${T.vendido(p) ? 'Vendido' : 'Agotado'}</span>`,
      p.disponible && p.oferta && d > 0 && `<span class="etiqueta etiqueta-oferta">-${d}%</span>`,
      p.disponible && p.oferta && d === 0 && '<span class="etiqueta etiqueta-oferta">Oferta</span>',
      p.nuevo && '<span class="etiqueta etiqueta-nuevo">Nuevo</span>',
      p.popular && '<span class="etiqueta etiqueta-popular">Popular</span>'
    ].filter(Boolean).join('');
    const url = T.urlProducto(p);
    return `<article class="tarjeta aparece ${p.disponible ? '' : 'agotada'}" data-id="${T.esc(p.id)}">
      <a class="tarjeta-imagen" href="${url}" tabindex="-1" aria-hidden="true">
        <img src="${T.esc(T.imagenProducto(p))}" alt="" loading="lazy" width="400" height="400">
        ${p.imagenes && p.imagenes[1] ? `<img class="img-hover" src="${T.esc(T.imagenProducto(p, 1))}" alt="" loading="lazy" width="400" height="400">` : ''}
      </a>
      <div class="etiquetas">${etiquetas}</div>
      <div class="tarjeta-cuerpo">
        ${cat ? `<span class="tarjeta-categoria-txt">${T.esc(cat.nombre)}</span>` : ''}
        <h3 class="tarjeta-titulo"><a href="${url}">${T.esc(p.nombre)}</a></h3>
        ${p.descripcionCorta ? `<p class="tarjeta-desc">${T.esc(p.descripcionCorta)}</p>` : ''}
        <div class="precio"><span class="precio-actual">${T.formatoPrecio(p.precio)}</span>${d > 0 ? `<span class="precio-anterior">${T.formatoPrecio(p.precioAnterior)}</span>` : ''}</div>
        ${T.textoStock(p) ? `<span class="stock-txt">${T.textoStock(p)}</span>` : ''}
        <div class="tarjeta-acciones">
          ${p.disponible
            ? `<button class="btn btn-whatsapp" data-wa="${T.esc(p.id)}">${T.ico.wa} Pedir</button>
               <button class="icono-btn" data-carrito="${T.esc(p.id)}" aria-label="Agregar al carrito" title="Agregar al carrito">${T.ico.mas}</button>`
            : `<button class="btn btn-suave" data-wa-disp="${T.esc(p.id)}">${T.ico.wa} ${T.vendido(p) ? 'Quiero uno igual' : 'Avísame'}</button>`}
        </div>
      </div>
    </article>`;
  };

  T.renderGrid = (contenedor, productos, vacioTxt) => {
    const el = typeof contenedor === 'string' ? $(contenedor) : contenedor; if (!el) return;
    if (!productos.length) { el.innerHTML = `<div class="vacio" style="grid-column:1/-1">${vacioTxt || 'No hay productos para mostrar.'}</div>`; return; }
    el.innerHTML = productos.map(T.tarjeta).join('');
  };

  /* Delegación global: botones de tarjeta */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-wa],[data-carrito],[data-wa-disp]'); if (!b || !T.datos) return;
    e.preventDefault();
    if (b.dataset.wa) { const p = T.producto(b.dataset.wa); if (p) T.abrirWA(T.mensajeProducto(p), 'whatsapp_click', { producto: p.id, origen: 'tarjeta' }); }
    else if (b.dataset.carrito) {
      const p = T.producto(b.dataset.carrito); if (!p) return;
      if (p.variantes && p.variantes.length) { location.href = T.urlProducto(p) + (T.datos.config.sitio.paginasEstaticas ? '?' : '&') + 'carrito=1'; return; }
      T.carrito.agregar(p, {}, 1);
    }
    else if (b.dataset.waDisp) { const p = T.producto(b.dataset.waDisp); if (p) T.abrirWA(T.mensajeProducto(p, null, T.vendido(p) ? 'interes' : 'disponibilidad'), 'whatsapp_click', { producto: p.id, origen: T.vendido(p) ? 'interes' : 'disponibilidad' }); }
  });

  /* ---------- Búsqueda / filtros ---------- */
  T.buscar = (productos, q) => {
    q = T.slug(q || '').replace(/-/g, ' ').trim();
    if (!q) return productos;
    const terminos = q.split(/\s+/);
    return productos.map(p => {
      const cat = T.categoria(p.categoria);
      const txt = T.slug([p.nombre, p.descripcionCorta, p.descripcion, (p.palabrasClave || []).join(' '), cat && cat.nombre].join(' ')).replace(/-/g, ' ');
      const nombre = T.slug(p.nombre).replace(/-/g, ' ');
      let score = 0;
      for (const t of terminos) { if (nombre.includes(t)) score += 3; else if (txt.includes(t)) score += 1; else return null; }
      return { p, score };
    }).filter(Boolean).sort((a, b) => b.score - a.score).map(x => x.p);
  };


  /* ---------- Preguntas frecuentes (reutilizable) ---------- */
  T.faqs = () => (T.datos.config.preguntasFrecuentes || []).filter(q => q.p && q.r);
  T.renderFaq = (lista) => lista.map(q => `<details class="faq"><summary>${T.esc(q.p)}</summary><p>${T.esc(q.r).replace(/\n/g, '<br>')}</p></details>`).join('');


  /* ---------- Vistos recientemente ---------- */
  T.vistos = {
    lista() { return T.leerLS('tienda_vistos', []).filter(id => { const p = T.producto(id); return p && p.visible !== false; }); },
    agregar(id) { const l = T.leerLS('tienda_vistos', []).filter(x => x !== id); l.unshift(id); T.guardarLS('tienda_vistos', l.slice(0, 12)); }
  };
  T.renderVistos = (sel, excluir) => {
    const sec = $(sel); if (!sec) return;
    const lista = T.vistos.lista().filter(id => id !== excluir).map(T.producto).slice(0, 8);
    if (!lista.length) { sec.hidden = true; return; }
    sec.hidden = false; T.renderGrid(sec.querySelector('.grid-productos'), lista);
  };

  /* ---------- Autocompletado del buscador ---------- */
  T.autocompletar = () => {
    $$('.buscador').forEach(form => {
      const input = form.querySelector('input'); if (!input || form.dataset.ac) return; form.dataset.ac = '1';
      const caja = document.createElement('div'); caja.className = 'sugerencias'; caja.hidden = true; form.appendChild(caja);
      const cerrar = () => { caja.hidden = true; };
      const render = () => {
        const q = input.value.trim();
        if (q.length < 2) { cerrar(); return; }
        const prods = T.buscar(T.visibles(), q).slice(0, 5);
        const cats = T.datos.catalogo.categorias.filter(c => c.visible !== false && T.slug(c.nombre).includes(T.slug(q))).slice(0, 2);
        if (!prods.length && !cats.length) { caja.innerHTML = `<div class="sug-vacio">Sin resultados para “${T.esc(q)}”. <a href="${T.ruta('catalogo.html')}">Ver todo el catálogo</a></div>`; caja.hidden = false; return; }
        caja.innerHTML = cats.map(c => `<a class="sug sug-cat" href="${T.ruta('catalogo.html?cat=' + encodeURIComponent(c.id))}"><span class="sug-ico">${T.icono(c.icono, 'svg:etiqueta')}</span><span>Categoría: <strong>${T.esc(c.nombre)}</strong></span></a>`).join('') +
          prods.map(p => `<a class="sug" href="${T.urlProducto(p)}"><img src="${T.esc(T.imagenProducto(p))}" alt="" loading="lazy"><span><strong>${T.esc(p.nombre)}</strong><small>${T.formatoPrecio(p.precio)}${p.disponible ? '' : ' · Agotado'}</small></span></a>`).join('') +
          `<a class="sug sug-todos" href="${T.ruta('catalogo.html?q=' + encodeURIComponent(q))}">Ver todos los resultados para “${T.esc(q)}” →</a>`;
        caja.hidden = false;
      };
      input.addEventListener('input', render);
      input.addEventListener('focus', render);
      input.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
      document.addEventListener('click', (e) => { if (!form.contains(e.target)) cerrar(); });
    });
  };

  /* ---------- Barra de navegación inferior (móvil) ---------- */
  T.renderBarraInferior = (activa) => {
    if ($('.barra-inferior')) return;
    const cfg = T.datos.config;
    const nav = document.createElement('nav'); nav.className = 'barra-inferior'; nav.setAttribute('aria-label', 'Navegación móvil');
    const it = (href, ico, txt, k, extra) => `<a href="${href}" class="${activa === k ? 'activo' : ''}" ${extra || ''}>${ico}<span>${txt}</span></a>`;
    nav.innerHTML = it(T.ruta('index.html'), T.icoCat.casa, 'Inicio', 'inicio') +
      it(T.ruta('catalogo.html'), T.ico.tienda, 'Catálogo', 'catalogo') +
      `<a href="#" id="bi-buscar">${T.ico.buscar}<span>Buscar</span></a>` +
      `<a href="#" id="bi-carrito">${T.ico.carrito}<span class="contador"></span><span>Carrito</span></a>` +
      `<a href="${T.enlaceWA((cfg.whatsapp || {}).mensajeGeneral)}" id="bi-wa" class="bi-wa" target="_blank" rel="noopener">${T.ico.wa}<span>WhatsApp</span></a>`;
    document.body.appendChild(nav); document.body.classList.add('con-barra-inferior');
    $('#bi-buscar').addEventListener('click', (e) => { e.preventDefault(); const m = $('#menu-movil'); if (m) { m.classList.add('abierto'); window.scrollTo({ top: 0, behavior: 'smooth' }); const i = m.querySelector('input'); if (i) setTimeout(() => i.focus(), 250); } });
    $('#bi-carrito').addEventListener('click', (e) => { e.preventDefault(); T.abrirCarrito(true); });
    $('#bi-wa').addEventListener('click', (e) => { if (!T.hayWA()) { e.preventDefault(); T.toast('El número de WhatsApp aún no está configurado.'); } else T.registrar('whatsapp_click', { origen: 'barra-inferior' }); });
    T.renderContador();
  };

  /* ---------- Arranque común ---------- */
  T.iniciar = async (activa, fn) => {
    try {
      await T.cargar();
      T.carrito.sanear();
      if (!$('link[rel="canonical"]')) { const l = document.createElement('link'); l.rel = 'canonical'; l.href = location.origin + location.pathname + (location.pathname.endsWith('producto.html') && T.param('p') ? '?p=' + encodeURIComponent(T.param('p')) : ''); document.head.appendChild(l); }
      T.renderEncabezado(activa);
      T.renderGlobales();
      T.renderBarraInferior(activa);
      T.autocompletar();
      if (fn) await fn(T.datos);
      T.renderPie();
    } catch (err) {
      console.error(err);
      const m = $('main') || document.body;
      m.innerHTML = '<div class="contenedor"><div class="vacio" style="margin:2rem 0"><h1 style="font-size:1.3rem">No pudimos cargar el catálogo</h1><p>Revisa tu conexión e inténtalo de nuevo. Si el problema continúa, escríbenos por WhatsApp.</p><button class="btn btn-primario" onclick="location.reload()">Reintentar</button><p class="nota-legal" style="margin-top:1rem">Detalle técnico: ' + T.esc(err.message) + (location.protocol === 'file:' ? ' (la tienda debe abrirse desde un servidor, no con doble clic)' : '') + '</p></div></div>';
    }
  };
})();
