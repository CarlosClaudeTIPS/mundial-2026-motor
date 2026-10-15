/* ============================================================
   Panel de administración (sin servidor).
   Edita un borrador en localStorage; exporta/importa JSON y CSV.
   Los cambios se publican reemplazando data/catalogo.json y
   data/config.json en el sitio.
   ============================================================ */
(function () {
  const T = window.Tienda, $ = T.$, $$ = T.$$, esc = T.esc;
  let catalogo, config, sucio = false, editandoId = null;

  const marcar = (s) => { sucio = s; const e = $('#estado-guardado'); e.textContent = s ? 'Borrador guardado en este navegador · pendiente de publicar' : 'Sin cambios'; e.classList.toggle('pendiente', s); };
  const persistir = () => { T.guardarLS(T.LS.borradorCatalogo, catalogo); T.guardarLS(T.LS.borradorConfig, config); marcar(true); };
  const descargar = (nombre, contenido, tipo) => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([contenido], { type: tipo || 'application/json' })); a.download = nombre; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const json = (o) => JSON.stringify(o, null, 2);
  const hoy = () => new Date().toISOString().slice(0, 10);
  const idUnico = (base) => { let id = T.slug(base) || 'producto', i = 2; while (catalogo.productos.some(p => p.id === id && p.id !== editandoId)) id = T.slug(base) + '-' + i++; return id; };

  /* ---------- Carga ---------- */
  async function cargar() {
    const [c1, c2] = await Promise.all([fetch('data/config.json', { cache: 'no-cache' }).then(r => r.json()), fetch('data/catalogo.json', { cache: 'no-cache' }).then(r => r.json())]);
    const bc = T.leerLS(T.LS.borradorCatalogo, null), bcfg = T.leerLS(T.LS.borradorConfig, null);
    catalogo = bc || c2; config = bcfg || c1;
    catalogo.productos = catalogo.productos.map(T.normalizarProducto);
    T.datos = { config, catalogo };
    marcar(!!(bc || bcfg));
    T.aplicarMarca(config);
    renderTodo();
  }

  function renderTodo() { renderProductos(); renderCategorias(); renderConfig(); renderGenerador(); renderMetricas(); renderAyuda(); }

  /* ---------- Pestañas ---------- */
  $('.admin-nav').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    $$('.admin-nav button').forEach(x => x.classList.toggle('activo', x === b));
    $$('.tab').forEach(t => t.hidden = t.id !== 'tab-' + b.dataset.tab);
  });

  /* ---------- Productos ---------- */
  function renderProductos() {
    const q = ($('#buscar-admin').value || '').trim(), cat = $('#filtro-cat-admin').value;
    const sel = $('#filtro-cat-admin'); if (sel.options.length <= 1) sel.innerHTML = '<option value="">Todas las categorías</option>' + catalogo.categorias.map(c => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join('');
    let lista = catalogo.productos.slice().sort((a, b) => (a.orden || 0) - (b.orden || 0));
    if (cat) lista = lista.filter(p => p.categoria === cat);
    if (q) lista = T.buscar(lista, q);
    $('#tabla-productos tbody').innerHTML = lista.map((p, i) => {
      const c = T.categoria(p.categoria);
      return `<tr class="${p.visible === false ? 'oculto' : ''}" data-id="${esc(p.id)}">
        <td><span class="orden-btns"><button data-mover="-1" title="Subir">▲</button><button data-mover="1" title="Bajar">▼</button></span></td>
        <td><span class="nombre"><img class="mini" src="${esc(T.imagenProducto(p))}" alt="">${esc(p.nombre)}</span><br><small style="color:var(--texto-tenue)">${esc(c ? c.nombre : 'Sin categoría')} · ${esc(p.id)}</small></td>
        <td>${T.formatoPrecio(p.precio)}${p.precioAnterior ? `<br><small style="text-decoration:line-through;color:var(--texto-tenue)">${T.formatoPrecio(p.precioAnterior)}</small>` : ''}</td>
        <td><span class="etq ${p.disponible ? 'on' : 'off'}">${p.disponible ? 'Disponible' + (p.stock != null ? ' · ' + p.stock + ' ud.' : '') : (T.vendido(p) ? 'Vendido' : 'Agotado')}</span><span class="etq ${p.visible !== false ? 'on' : 'off'}">${p.visible !== false ? 'Visible' : 'Oculto'}</span></td>
        <td>${p.nuevo ? '<span class="etq">Nuevo</span>' : ''}${p.oferta ? '<span class="etq">Oferta</span>' : ''}${p.destacado ? '<span class="etq">Destacado</span>' : ''}${p.popular ? '<span class="etq">Popular</span>' : ''}</td>
        <td><div class="acciones"><button data-editar>Editar</button><button data-ocultar>${p.visible === false ? 'Mostrar' : 'Ocultar'}</button><button data-enlace>Enlace</button><button data-eliminar class="peligro">Eliminar</button></div></td></tr>`;
    }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--texto-suave)">No hay productos.</td></tr>';
  }
  $('#buscar-admin').addEventListener('input', renderProductos);
  $('#filtro-cat-admin').addEventListener('change', renderProductos);
  $('#tabla-productos').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const id = b.closest('tr').dataset.id; const p = T.producto(id); if (!p) return;
    if (b.hasAttribute('data-editar')) abrirEditor(p);
    else if (b.hasAttribute('data-ocultar')) { p.visible = p.visible === false; persistir(); renderProductos(); }
    else if (b.hasAttribute('data-enlace')) copiar(T.urlProducto(p, true));
    else if (b.hasAttribute('data-eliminar')) { if (confirm(`¿Eliminar "${p.nombre}"? Si solo quieres retirarlo temporalmente usa "Ocultar".`)) { catalogo.productos = catalogo.productos.filter(x => x.id !== id); persistir(); renderProductos(); renderGenerador(); } }
    else if (b.dataset.mover) { mover(catalogo.productos, id, Number(b.dataset.mover)); persistir(); renderProductos(); }
  });
  function mover(arr, id, delta) {
    arr.sort((a, b) => (a.orden || 0) - (b.orden || 0)); arr.forEach((x, i) => x.orden = i + 1);
    const i = arr.findIndex(x => x.id === id), j = i + delta; if (j < 0 || j >= arr.length) return;
    [arr[i].orden, arr[j].orden] = [arr[j].orden, arr[i].orden];
  }
  const copiar = async (txt) => { try { await navigator.clipboard.writeText(txt); T.toast('Enlace copiado: ' + txt); } catch (e) { prompt('Copia el enlace:', txt); } };

  /* ---------- Editor de producto ---------- */
  const campo = (id, label, tipo, val, extra) => `<label>${label}${extra && extra.ayuda ? `<small>${extra.ayuda}</small>` : ''}${tipo === 'textarea' ? `<textarea name="${id}" ${extra && extra.rows ? 'rows="' + extra.rows + '"' : ''}>${esc(val)}</textarea>` : `<input name="${id}" type="${tipo}" value="${esc(val)}" ${extra && extra.attrs || ''}>`}</label>`;
  const check = (id, label, val) => `<label class="check"><input type="checkbox" name="${id}" ${val ? 'checked' : ''}> ${label}</label>`;
  const listaEditable = (id, label, items, ayuda) => `<div><label>${label}${ayuda ? `<small>${ayuda}</small>` : ''}</label><div class="lista-editable" data-lista="${id}">${(items || []).map(v => `<div class="item"><input type="text" value="${esc(v)}"><button type="button" data-quitar aria-label="Quitar">✕</button></div>`).join('')}<button type="button" class="agregar" data-agregar>+ Agregar</button></div></div>`;
  const leerLista = (id) => $$(`[data-lista="${id}"] input`).map(i => i.value.trim()).filter(Boolean);

  function abrirEditor(p) {
    editandoId = p ? p.id : null;
    p = p || T.normalizarProducto({ id: '', nombre: '', categoria: (catalogo.categorias[0] || {}).id || '', precio: 0, fechaCreacion: hoy(), nuevo: true });
    $('#editor-titulo').textContent = editandoId ? 'Editar producto' : 'Nuevo producto';
    const specs = Object.entries(p.especificaciones || {}).map(([k, v]) => `${k}: ${v}`);
    const variantes = (p.variantes || []).map(v => `${v.nombre}: ${(v.opciones || []).join(', ')}`);
    const preguntas = (p.preguntas || []).map(q => `${q.p} | ${q.r}`);
    $('#form-producto').innerHTML = `
      <fieldset><legend>Datos básicos</legend>
        ${campo('nombre', 'Nombre comercial *', 'text', p.nombre, { attrs: 'required' })}
        <div class="fila">${campo('id', 'ID / enlace (se genera solo)', 'text', p.id, { ayuda: 'Solo letras, números y guiones. Cambiarlo rompe enlaces ya compartidos.' })}
        <label>Categoría<select name="categoria">${catalogo.categorias.map(c => `<option value="${esc(c.id)}" ${c.id === p.categoria ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></label></div>
        <div class="fila fila-3">${campo('precio', 'Precio de venta (COP) *', 'number', p.precio, { attrs: 'min="0" step="100" required inputmode="numeric"' })}${campo('precioAnterior', 'Precio anterior (solo si es real)', 'number', p.precioAnterior || '', { attrs: 'min="0" step="100" inputmode="numeric"' })}${campo('fechaCreacion', 'Fecha de ingreso', 'date', p.fechaCreacion || hoy())}</div>
        ${campo('stock', 'Unidades disponibles (opcional)', 'number', p.stock == null ? '' : p.stock, { ayuda: 'Si lo llenas, la tienda muestra «Quedan N unidades». Con 0 el producto queda como VENDIDO y muestra el botón «Quiero uno igual». Vacío = no se muestra.', attrs: 'min="0" step="1" inputmode="numeric"' })}
        ${campo('descripcionCorta', 'Descripción corta (1 frase)', 'text', p.descripcionCorta, { attrs: 'maxlength="120"' })}
        <div class="checks">${check('disponible', 'Disponible', p.disponible)}${check('visible', 'Visible en la tienda', p.visible !== false)}${check('nuevo', 'Etiqueta «Nuevo»', p.nuevo)}${check('oferta', 'Etiqueta «Oferta»', p.oferta)}${check('destacado', 'Destacado en inicio', p.destacado)}${check('popular', 'Popular', p.popular)}</div>
      </fieldset>
      <fieldset><legend>Fotos y video</legend>
        ${listaEditable('imagenes', 'Imágenes (ruta o URL)', p.imagenes, 'Sube los archivos a la carpeta img/ del sitio y escribe la ruta, por ejemplo img/productos/mi-foto.jpg. También sirve una URL completa (https://…).')}
        <div class="imagenes-preview" id="preview-imagenes">${(p.imagenes || []).map(i => `<img src="${esc(T.imagenProducto({ imagenes: [i] }))}" alt="">`).join('')}</div>
        ${campo('video', 'Video demostrativo (ruta .mp4 o URL)', 'text', p.video, { ayuda: 'Archivo MP4 en img/ o una URL directa. Los enlaces de YouTube/TikTok no se reproducen incrustados en esta versión.' })}
      </fieldset>
      <fieldset><legend>Contenido comercial</legend>
        ${campo('descripcion', 'Descripción completa', 'textarea', p.descripcion, { rows: 5 })}
        ${campo('problema', '¿Qué problema o necesidad resuelve?', 'textarea', p.problema, { rows: 2 })}
        ${listaEditable('beneficios', 'Beneficios concretos (verificables)', p.beneficios)}
        ${listaEditable('especificaciones', 'Características / especificaciones', specs, 'Formato: Clave: valor (ej. Material: acero inoxidable). Si no lo sabes, escribe "Pendiente de confirmar".')}
        ${listaEditable('incluye', 'Qué incluye la compra', p.incluye)}
        ${listaEditable('instrucciones', 'Instrucciones de uso (paso a paso)', p.instrucciones)}
        ${listaEditable('precauciones', 'Recomendaciones y precauciones', p.precauciones)}
        ${listaEditable('preguntas', 'Preguntas frecuentes del producto', preguntas, 'Formato: Pregunta | Respuesta')}
      </fieldset>
      <fieldset><legend>Variantes, búsqueda y relacionados</legend>
        ${listaEditable('variantes', 'Variantes', variantes, 'Formato: Nombre: opción1, opción2 (ej. Color: Negro, Blanco). El cliente elige antes de abrir WhatsApp.')}
        ${campo('palabrasClave', 'Palabras clave (separadas por coma)', 'text', (p.palabrasClave || []).join(', '), { ayuda: 'Ayudan al buscador: sinónimos, usos, marcas compatibles.' })}
        ${campo('relacionados', 'Productos relacionados (IDs separados por coma)', 'text', (p.relacionados || []).join(', '), { ayuda: 'Si se deja vacío se muestran otros de la misma categoría.' })}
      </fieldset>`;
    $('#editor').classList.add('abierto'); $('#capa-editor').classList.add('abierta'); $('#editor').setAttribute('aria-hidden', 'false'); $('#editor').removeAttribute('inert');
    $('#editor-cuerpo, .editor-cuerpo').scrollTop = 0;
  }
  const cerrarEditor = () => { $('#editor').classList.remove('abierto'); $('#capa-editor').classList.remove('abierta'); $('#editor').setAttribute('aria-hidden', 'true'); $('#editor').setAttribute('inert', ''); };
  $('#editor-cerrar').addEventListener('click', cerrarEditor); $('#capa-editor').addEventListener('click', cerrarEditor);
  $('#form-producto').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-agregar')) { const d = document.createElement('div'); d.className = 'item'; d.innerHTML = '<input type="text"><button type="button" data-quitar aria-label="Quitar">✕</button>'; b.before(d); d.querySelector('input').focus(); }
    else if (b.hasAttribute('data-quitar')) b.closest('.item').remove();
  });
  $('#form-producto').addEventListener('input', (e) => {
    if (e.target.name === 'nombre' && !editandoId) $('#form-producto [name=id]').value = T.slug(e.target.value);
    if (e.target.closest('[data-lista="imagenes"]')) $('#preview-imagenes').innerHTML = leerLista('imagenes').map(i => `<img src="${esc(T.imagenProducto({ imagenes: [i] }))}" alt="">`).join('');
  });
  function leerFormulario() {
    const f = $('#form-producto'), v = (n) => f.elements[n] ? f.elements[n].value.trim() : '', c = (n) => f.elements[n] && f.elements[n].checked;
    if (!v('nombre')) { T.toast('El nombre es obligatorio'); return null; }
    const precio = Number(v('precio')); if (!(precio >= 0)) { T.toast('Precio inválido'); return null; }
    const precioAnterior = v('precioAnterior') ? Number(v('precioAnterior')) : null;
    if (precioAnterior && precioAnterior <= precio) { T.toast('El precio anterior debe ser mayor al precio actual (o déjalo vacío).'); return null; }
    const especificaciones = {}; leerLista('especificaciones').forEach(s => { const i = s.indexOf(':'); if (i > 0) especificaciones[s.slice(0, i).trim()] = s.slice(i + 1).trim(); });
    const variantes = leerLista('variantes').map(s => { const i = s.indexOf(':'); return i > 0 ? { nombre: s.slice(0, i).trim(), opciones: s.slice(i + 1).split(',').map(x => x.trim()).filter(Boolean) } : null; }).filter(x => x && x.opciones.length);
    const preguntas = leerLista('preguntas').map(s => { const [p, ...r] = s.split('|'); return r.length ? { p: p.trim(), r: r.join('|').trim() } : null; }).filter(Boolean);
    const stock = v('stock') === '' ? null : Math.max(0, Math.round(Number(v('stock'))) || 0);
    return T.normalizarProducto({
      id: idUnico(v('id') || v('nombre')), nombre: v('nombre'), categoria: v('categoria'), precio, precioAnterior, stock,
      fechaCreacion: v('fechaCreacion') || hoy(), descripcionCorta: v('descripcionCorta'), descripcion: v('descripcion'), problema: v('problema'),
      disponible: stock === 0 ? false : c('disponible'), visible: c('visible'), nuevo: c('nuevo'), oferta: c('oferta'), destacado: c('destacado'), popular: c('popular'),
      imagenes: leerLista('imagenes'), video: v('video'), beneficios: leerLista('beneficios'), especificaciones, incluye: leerLista('incluye'),
      instrucciones: leerLista('instrucciones'), precauciones: leerLista('precauciones'), preguntas, variantes,
      palabrasClave: v('palabrasClave').split(',').map(x => x.trim()).filter(Boolean), relacionados: v('relacionados').split(',').map(x => x.trim()).filter(Boolean),
      orden: editandoId ? (T.producto(editandoId) || {}).orden || 0 : catalogo.productos.length + 1
    });
  }
  $('#editor-guardar').addEventListener('click', () => {
    const p = leerFormulario(); if (!p) return;
    if (editandoId) { const i = catalogo.productos.findIndex(x => x.id === editandoId); catalogo.productos[i] = p; } else catalogo.productos.push(p);
    editandoId = p.id; persistir(); renderProductos(); renderGenerador(); cerrarEditor(); T.toast('Producto guardado en el borrador');
  });
  $('#editor-duplicar').addEventListener('click', () => { const p = leerFormulario(); if (!p) return; editandoId = null; p.id = idUnico(p.id + '-copia'); p.nombre += ' (copia)'; catalogo.productos.push(p); persistir(); renderProductos(); abrirEditor(p); });
  $('#editor-enlace').addEventListener('click', () => { const id = $('#form-producto [name=id]').value; copiar(T.urlProducto({ id }, true)); });
  $('#btn-nuevo').addEventListener('click', () => abrirEditor(null));


  /* ---------- Completar ficha con IA ---------- */
  const LS_SECRET = 'tienda_admin_secret';
  const datosFormulario = () => {
    const f = $('#form-producto'), v = (n) => f.elements[n] ? f.elements[n].value.trim() : '';
    const cat = T.categoria(v('categoria'));
    const imgs = leerLista('imagenes');
    return { nombre: v('nombre'), categoria: cat ? cat.nombre : v('categoria'), precio: Number(v('precio')) || null, descripcionCorta: v('descripcionCorta'), descripcion: v('descripcion'),
      variantes: leerLista('variantes'), imagenUrl: (imgs.find(i => /^https:\/\//.test(i)) || null), notas: v('problema') };
  };
  const setLista = (id, items) => { const cont = $(`[data-lista="${id}"]`); if (!cont) return; cont.querySelectorAll('.item').forEach(x => x.remove()); const btn = cont.querySelector('[data-agregar]'); (items || []).forEach(v => { const d = document.createElement('div'); d.className = 'item'; d.innerHTML = '<input type="text"><button type="button" data-quitar aria-label="Quitar">✕</button>'; d.querySelector('input').value = v; btn.before(d); }); };
  /* Aplica la ficha generada al formulario SIN pisar lo que el dueño ya escribió */
  function aplicarFicha(fi) {
    const f = $('#form-producto'), set = (n, val) => { if (f.elements[n] && !f.elements[n].value.trim() && val) f.elements[n].value = val; };
    set('descripcionCorta', fi.descripcionCorta); set('descripcion', fi.descripcion); set('problema', fi.problema);
    const vacia = (id) => !leerLista(id).length;
    if (vacia('beneficios')) setLista('beneficios', fi.beneficios);
    if (vacia('especificaciones')) setLista('especificaciones', (fi.especificaciones || []).map(e => Array.isArray(e) ? e.join(': ') : (e.clave ? `${e.clave}: ${e.valor}` : String(e))));
    if (vacia('incluye')) setLista('incluye', fi.incluye);
    if (vacia('instrucciones')) setLista('instrucciones', fi.instrucciones);
    if (vacia('precauciones')) setLista('precauciones', fi.precauciones);
    if (vacia('preguntas')) setLista('preguntas', (fi.preguntas || []).map(q => `${q.p} | ${q.r}`));
    if (!f.elements.palabrasClave.value.trim() && fi.palabrasClave) f.elements.palabrasClave.value = fi.palabrasClave.join(', ');
    const pend = (fi.pendientes || []).length ? ' Pendientes de confirmar: ' + fi.pendientes.join('; ') : '';
    T.toast('Ficha completada. Revisa cada campo antes de guardar.' + pend);
  }
  const abrirDialogoIA = (html) => { $('#dialogo-ia-cuerpo').innerHTML = html; $('#dialogo-ia').hidden = false; $('#capa-ia').classList.add('abierta'); };
  const cerrarDialogoIA = () => { $('#dialogo-ia').hidden = true; $('#capa-ia').classList.remove('abierta'); };
  $('#dialogo-ia-cerrar').addEventListener('click', cerrarDialogoIA); $('#capa-ia').addEventListener('click', cerrarDialogoIA);

  const promptManual = (d) => `Actúa como copywriter de una tienda colombiana que vende por WhatsApp. Completa la ficha de este producto usando SOLO estos datos y el conocimiento general del tipo de producto. No inventes materiales, medidas, certificaciones, reseñas ni descuentos: donde no sepas, escribe exactamente "Pendiente de confirmar". Responde ÚNICAMENTE con un JSON con estas claves: descripcionCorta (string, máx. 110 caracteres), descripcion (string), problema (string), beneficios (array de strings), especificaciones (array de {"clave","valor"}), incluye (array), instrucciones (array de pasos), precauciones (array), preguntas (array de {"p","r"}), palabrasClave (array), pendientes (array de datos que el vendedor debe confirmar).\n\nDATOS: ${JSON.stringify(d)}`;

  function vistaManual(d, motivo) {
    abrirDialogoIA(`<p class="aviso-pendiente">${esc(motivo)}</p>
      <div class="paso-ia"><strong>1. Copia este prompt y pégalo en ChatGPT, Claude o Gemini</strong><textarea id="ia-prompt" readonly>${esc(promptManual(d))}</textarea><button class="btn btn-primario btn-sm" type="button" id="ia-copiar">Copiar prompt</button></div>
      <div class="paso-ia"><strong>2. Pega aquí la respuesta (el JSON) y aplícala al formulario</strong><textarea id="ia-json" placeholder='{"descripcionCorta": "...", ...}'></textarea><button class="btn btn-acento btn-sm" type="button" id="ia-aplicar">Aplicar al formulario</button></div>
      <details><summary>¿Prefieres que sea automático?</summary><p class="nota-legal">Publica la tienda en Netlify y configura las variables ANTHROPIC_API_KEY y ADMIN_SECRET. Luego escribe tu clave de administración aquí:</p><input class="campo" id="ia-secret" type="password" placeholder="Clave de administración (ADMIN_SECRET)" value="${esc(T.leerLS(LS_SECRET, ''))}"><button class="btn btn-suave btn-sm" type="button" id="ia-guardar-secret" style="margin-top:.4rem">Guardar clave en este navegador</button></details>`);
    $('#ia-copiar').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('#ia-prompt').value); T.toast('Prompt copiado'); } catch (e) { $('#ia-prompt').select(); } });
    $('#ia-aplicar').addEventListener('click', () => {
      let txt = $('#ia-json').value.trim(); const m = txt.match(/\{[\s\S]*\}/); if (m) txt = m[0];
      try { aplicarFicha(JSON.parse(txt)); cerrarDialogoIA(); } catch (e) { T.toast('No se pudo leer el JSON. Copia solo la respuesta JSON de la IA.'); }
    });
    $('#ia-guardar-secret').addEventListener('click', () => { T.guardarLS(LS_SECRET, $('#ia-secret').value.trim()); T.toast('Clave guardada. Vuelve a pulsar «Completar con IA».'); });
  }

  $('#editor-ia').addEventListener('click', async () => {
    const d = datosFormulario();
    if (!d.nombre) { T.toast('Escribe primero el nombre del producto.'); return; }
    const secret = T.leerLS(LS_SECRET, '');
    const b = $('#editor-ia'); b.disabled = true; b.innerHTML = '<span class="cargando"></span>Generando…';
    try {
      const r = await fetch('/.netlify/functions/completar-producto', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret }, body: JSON.stringify(d) });
      if (r.status === 404 || r.status === 503) { vistaManual(d, 'La generación automática no está disponible en este sitio (no está publicado en Netlify o faltan las claves). Usa la vía manual:'); return; }
      if (r.status === 401) { vistaManual(d, 'La clave de administración no es válida. Corrígela abajo o usa la vía manual:'); return; }
      const data = await r.json();
      if (!r.ok) { vistaManual(d, 'Error del servicio: ' + (data.error || r.status) + '. Puedes usar la vía manual:'); return; }
      aplicarFicha(data.ficha);
    } catch (e) {
      vistaManual(d, 'No se pudo conectar con el servicio de IA. Usa la vía manual:');
    } finally { b.disabled = false; b.innerHTML = '✨ Completar con IA'; }
  });

  /* ---------- Categorías ---------- */
  function renderCategorias() {
    const cats = catalogo.categorias.slice().sort((a, b) => (a.orden || 0) - (b.orden || 0));
    $('#tabla-categorias tbody').innerHTML = cats.map(c => `<tr data-id="${esc(c.id)}">
      <td><span class="orden-btns"><button data-mover="-1">▲</button><button data-mover="1">▼</button></span></td>
      <td><span style="display:inline-flex;width:24px;color:var(--primario)">${T.icono(c.icono, 'svg:etiqueta')}</span></td>
      <td><strong>${esc(c.nombre)}</strong><br><small style="color:var(--texto-tenue)">${esc(c.descripcion || '')}</small></td>
      <td><code>${esc(c.id)}</code></td><td>${catalogo.productos.filter(p => p.categoria === c.id).length}</td>
      <td>${c.visible !== false ? 'Sí' : 'No'}</td>
      <td><div class="acciones"><button data-editar>Editar</button><button data-eliminar class="peligro">Eliminar</button></div></td></tr>`).join('');
  }
  function editarCategoria(c) {
    const nombre = prompt('Nombre de la categoría:', c ? c.nombre : ''); if (nombre === null || !nombre.trim()) return;
    const descripcion = prompt('Descripción corta (opcional):', c ? c.descripcion || '' : '') || '';
    const icono = prompt('Icono: usa una clave svg:casa, svg:enchufe, svg:hoja, svg:bolso, svg:estrella, svg:etiqueta, svg:regalo, svg:herramienta, svg:corazon, svg:reloj, o un emoji:', c ? c.icono || 'svg:etiqueta' : 'svg:etiqueta') || 'svg:etiqueta';
    const visible = confirm('¿Mostrar esta categoría en la tienda? (Aceptar = sí)');
    if (c) Object.assign(c, { nombre: nombre.trim(), descripcion, icono, visible });
    else { let id = T.slug(nombre), i = 2; while (catalogo.categorias.some(x => x.id === id)) id = T.slug(nombre) + '-' + i++; catalogo.categorias.push({ id, nombre: nombre.trim(), descripcion, icono, visible, orden: catalogo.categorias.length + 1 }); }
    persistir(); renderCategorias(); $('#filtro-cat-admin').innerHTML = ''; renderProductos();
  }
  $('#btn-nueva-cat').addEventListener('click', () => editarCategoria(null));
  $('#tabla-categorias').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const id = b.closest('tr').dataset.id, c = T.categoria(id);
    if (b.hasAttribute('data-editar')) editarCategoria(c);
    else if (b.hasAttribute('data-eliminar')) {
      const n = catalogo.productos.filter(p => p.categoria === id).length;
      if (n && !confirm(`Esta categoría tiene ${n} producto(s). Al eliminarla pasarán a "Otros". ¿Continuar?`)) return;
      if (!n && !confirm(`¿Eliminar la categoría "${c.nombre}"?`)) return;
      if (n) { if (!T.categoria('otros')) catalogo.categorias.push({ id: 'otros', nombre: 'Otros', icono: 'svg:etiqueta', descripcion: '', visible: true, orden: 99 }); catalogo.productos.forEach(p => { if (p.categoria === id) p.categoria = 'otros'; }); }
      catalogo.categorias = catalogo.categorias.filter(x => x.id !== id); persistir(); renderCategorias(); $('#filtro-cat-admin').innerHTML = ''; renderProductos();
    } else if (b.dataset.mover) { mover(catalogo.categorias, id, Number(b.dataset.mover)); persistir(); renderCategorias(); }
  });

  /* ---------- Configuración ---------- */
  function renderConfig() {
    const n = config.negocio || {}, w = config.whatsapp || {}, r = config.redes || {}, m = config.marca || {}, h = config.portada || {}, pol = config.politicas || {}, a = config.analitica || {}, s = config.sitio || {};
    $('#form-config').innerHTML = `
      <fieldset><legend>Negocio</legend>
        <div class="fila">${campo('negocio.nombre', 'Nombre del negocio', 'text', n.nombre)}${campo('negocio.logo', 'Logotipo (ruta o URL)', 'text', n.logo, { ayuda: 'Sube tu logo a img/ y escribe la ruta. Ideal cuadrado, PNG o SVG.' })}</div>
        ${campo('negocio.eslogan', 'Eslogan', 'text', n.eslogan)}
        ${campo('negocio.descripcion', 'Descripción corta del negocio (pie de página y buscadores)', 'textarea', n.descripcion, { rows: 2 })}
        <div class="fila">${campo('negocio.ciudad', 'Ciudad / cobertura (opcional)', 'text', n.ciudad)}${campo('negocio.horario', 'Horario de atención (opcional)', 'text', n.horario)}</div>
      </fieldset>
      <fieldset><legend>WhatsApp (prioritario)</legend>
        ${campo('whatsapp.numero', 'Número de WhatsApp Business con indicativo, sin + ni espacios', 'text', w.numero, { ayuda: 'Ejemplo de formato para Colombia: 57 seguido de los 10 dígitos del celular. Déjalo vacío hasta tener el número real.', attrs: 'inputmode="numeric" pattern="[0-9]*"' })}
        ${campo('whatsapp.mensajeProducto', 'Mensaje al pedir un producto', 'textarea', w.mensajeProducto, { ayuda: 'Variables: {nombre}, {precio}, {enlace}, {variantes}', rows: 3 })}
        ${campo('whatsapp.mensajeDisponibilidad', 'Mensaje al consultar disponibilidad', 'textarea', w.mensajeDisponibilidad, { rows: 2 })}
        ${campo('whatsapp.mensajeCarrito', 'Mensaje del carrito', 'textarea', w.mensajeCarrito, { ayuda: 'Variables: {items}, {total}', rows: 3 })}
        <div class="fila">${campo('whatsapp.mensajeInteres', 'Mensaje «Quiero uno igual» (producto vendido)', 'textarea', w.mensajeInteres, { rows: 2 })}${campo('whatsapp.mensajeSugerencia', 'Mensaje de la encuesta «¿Qué te gustaría encontrar?»', 'textarea', w.mensajeSugerencia, { ayuda: 'Variable: {texto}', rows: 2 })}</div>
        <div class="fila fila-3">${campo('whatsapp.mensajeGeneral', 'Mensaje general', 'text', w.mensajeGeneral)}${campo('whatsapp.mensajeEnvios', 'Consulta de envíos', 'text', w.mensajeEnvios)}${campo('whatsapp.mensajePagos', 'Consulta de pagos', 'text', w.mensajePagos)}</div>
      </fieldset>
      <fieldset><legend>Redes sociales (URL completas; vacío = no se muestra)</legend>
        <div class="fila">${campo('redes.facebook', 'Facebook', 'url', r.facebook)}${campo('redes.instagram', 'Instagram', 'url', r.instagram)}${campo('redes.tiktok', 'TikTok', 'url', r.tiktok)}${campo('redes.marketplace', 'Perfil de Marketplace', 'url', r.marketplace)}</div>
      </fieldset>
      <fieldset><legend>Marca y portada</legend>
        <div class="fila"><label>Color principal<div class="color-fila"><input type="color" name="marca.colorPrimario" value="${esc(m.colorPrimario || '#1e3a5f')}"><span>${esc(m.colorPrimario || '')}</span></div></label><label>Color de acento (botones de acción)<div class="color-fila"><input type="color" name="marca.colorAcento" value="${esc(m.colorAcento || '#d97706')}"><span>${esc(m.colorAcento || '')}</span></div></label></div>
        <div class="fila">${campo('portada.etiqueta', 'Etiqueta pequeña del banner', 'text', h.etiqueta)}${campo('portada.imagen', 'Imagen del banner (ruta o URL)', 'text', h.imagen)}</div>
        ${campo('portada.titulo', 'Título del banner', 'text', h.titulo)}${campo('portada.subtitulo', 'Subtítulo del banner', 'text', h.subtitulo)}
      </fieldset>
      <fieldset><legend>Confianza (3 bloques en la portada)</legend>
        ${(config.confianza || [{}, {}, {}]).slice(0, 3).map((c, i) => `<div class="fila fila-3">${campo('confianza.' + i + '.icono', 'Icono (svg:camion, svg:tarjeta, svg:chat, svg:escudo, svg:reloj…)', 'text', c.icono)}${campo('confianza.' + i + '.titulo', 'Título', 'text', c.titulo)}${campo('confianza.' + i + '.texto', 'Texto (vacío = "pendiente")', 'text', c.texto)}</div>`).join('')}
      </fieldset>
      <fieldset><legend>Políticas reales del negocio (vacío = se muestra como pendiente, nunca se inventa)</legend>
        ${campo('politicas.entregas', 'Entregas y envíos', 'textarea', pol.entregas, { rows: 3 })}${campo('politicas.pagos', 'Métodos de pago', 'textarea', pol.pagos, { rows: 2 })}
        ${campo('politicas.cambios', 'Cambios y devoluciones', 'textarea', pol.cambios, { rows: 2 })}${campo('politicas.garantia', 'Garantías', 'textarea', pol.garantia, { rows: 2 })}
        ${campo('politicas.privacidad', 'Privacidad y tratamiento de datos', 'textarea', pol.privacidad, { rows: 4, ayuda: 'En Colombia aplica la Ley 1581 de 2012. Indica qué datos recibes por WhatsApp, para qué los usas y cómo puede el cliente pedir su eliminación.' })}
      </fieldset>
      <fieldset><legend>Preguntas frecuentes generales</legend>${listaEditable('faq', 'Preguntas', (config.preguntasFrecuentes || []).map(q => `${q.destacada ? '* ' : ''}${q.p} | ${q.r} | ${q.grupo || ''}`), 'Formato: Pregunta | Respuesta | Grupo. Empieza con * para destacarla en la portada y en las fichas de producto.')}</fieldset>
      <fieldset><legend>Pasos de «Cómo comprar» (portada)</legend>${listaEditable('pasos', 'Pasos', (config.pasosCompra || []).map(p => `${p.titulo} | ${p.texto}`), 'Formato: Título | Texto')}</fieldset>
      <fieldset><legend>Analítica y publicidad (opcional, gratuito)</legend>
        <div class="fila">${campo('analitica.ga4', 'ID de Google Analytics 4 (G-XXXXXXX)', 'text', a.ga4)}${campo('analitica.metaPixel', 'ID de Meta Pixel', 'text', a.metaPixel)}</div>
        <p class="nota-legal">Se envían los eventos view_item, whatsapp_click, add_to_cart y buscar. Si usas Meta Pixel, publica una política de privacidad que lo mencione.</p>
      </fieldset>
      <fieldset><legend>Sitio</legend>
        <div class="checks">${check('sitio.paginasEstaticas', 'Usar páginas estáticas por producto (p/ID.html) para vistas previas en redes — requiere ejecutar generar-paginas.mjs', s.paginasEstaticas)}${check('sitio.avisoDemo', 'Mostrar aviso de catálogo de demostración', s.avisoDemo)}</div>
      </fieldset>
      <div><button type="submit" class="btn btn-primario">Guardar configuración</button></div>`;
    $('#form-config').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || b.type === 'submit') return;
      if (b.hasAttribute('data-agregar')) { const d = document.createElement('div'); d.className = 'item'; d.innerHTML = '<input type="text"><button type="button" data-quitar aria-label="Quitar">✕</button>'; b.before(d); }
      else if (b.hasAttribute('data-quitar')) b.closest('.item').remove();
    });
  }
  $('#form-config').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const set = (ruta, val) => { const k = ruta.split('.'); let o = config; for (let i = 0; i < k.length - 1; i++) { if (o[k[i]] == null) o[k[i]] = /^\d+$/.test(k[i + 1]) ? [] : {}; o = o[k[i]]; } o[k[k.length - 1]] = val; };
    Array.from(f.elements).forEach(el => { if (!el.name || el.closest('[data-lista]')) return; set(el.name, el.type === 'checkbox' ? el.checked : el.value.trim()); });
    config.whatsapp.numero = String(config.whatsapp.numero || '').replace(/\D/g, '');
    config.preguntasFrecuentes = leerLista('faq').map(s => { const partes = s.split('|').map(x => x.trim()); if (partes.length < 2) return null; let p = partes[0]; const destacada = p.startsWith('*'); if (destacada) p = p.slice(1).trim(); return { p, r: partes[1], grupo: partes[2] || 'General', destacada }; }).filter(Boolean);
    config.pasosCompra = leerLista('pasos').map(s => { const [t, ...x] = s.split('|'); return x.length ? { titulo: t.trim(), texto: x.join('|').trim() } : null; }).filter(Boolean);
    persistir(); T.aplicarMarca(config); renderConfig(); T.toast('Configuración guardada en el borrador');
  });

  /* ---------- Generador de contenido ---------- */
  function renderGenerador() {
    $('#gen-producto').innerHTML = catalogo.productos.map(p => `<option value="${esc(p.id)}">${esc(p.nombre)}</option>`).join('');
  }
  $('#btn-generar').addEventListener('click', () => {
    const p = T.producto($('#gen-producto').value); if (!p) return;
    const faltan = window.Generador.faltantes(p);
    $('#gen-faltantes').innerHTML = faltan.length ? `<div class="aviso-pendiente" style="margin-bottom:1rem"><strong>Información pendiente en la ficha:</strong> ${faltan.map(esc).join(' · ')}. Los textos la señalan como [PENDIENTE]; complétala en el editor para mejores resultados.</div>` : '<div class="aviso-pendiente" style="background:#dcfce7;border-color:#86efac;color:#166534;margin-bottom:1rem">La ficha está completa.</div>';
    const res = window.Generador.generar(p, config, $('#gen-tono').value);
    $('#gen-resultados').innerHTML = res.map((r, i) => `<div class="gen-item"><span class="canal">${esc(r.canal)}</span><h3>${esc(r.titulo)}<button class="btn btn-suave btn-sm" data-copiar="${i}">Copiar</button></h3><pre id="gen-${i}">${esc(r.texto)}</pre></div>`).join('');
  });
  $('#gen-resultados').addEventListener('click', async (e) => { const b = e.target.closest('[data-copiar]'); if (!b) return; try { await navigator.clipboard.writeText($('#gen-' + b.dataset.copiar).textContent); T.toast('Texto copiado'); } catch (err) { T.toast('No se pudo copiar'); } });

  /* ---------- Importar / exportar ---------- */
  const CSV_COLS = ['id', 'nombre', 'categoria', 'precio', 'precioAnterior', 'stock', 'disponible', 'visible', 'nuevo', 'oferta', 'destacado', 'popular', 'orden', 'fechaCreacion', 'descripcionCorta', 'descripcion', 'problema', 'imagenes', 'video', 'beneficios', 'especificaciones', 'incluye', 'instrucciones', 'precauciones', 'preguntas', 'variantes', 'palabrasClave', 'relacionados'];
  const csvCelda = (v) => { v = v == null ? '' : String(v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  function exportarCSV() {
    const filas = catalogo.productos.map(p => CSV_COLS.map(c => {
      const v = p[c];
      if (c === 'especificaciones') return Object.entries(v || {}).map(([k, x]) => `${k}: ${x}`).join(' | ');
      if (c === 'preguntas') return (v || []).map(q => `${q.p} > ${q.r}`).join(' | ');
      if (c === 'variantes') return (v || []).map(x => `${x.nombre}: ${(x.opciones || []).join(', ')}`).join(' | ');
      if (Array.isArray(v)) return v.join(' | ');
      if (typeof v === 'boolean') return v ? 'si' : 'no';
      return v == null ? '' : v;
    }).map(csvCelda).join(','));
    descargar('productos.csv', '﻿' + CSV_COLS.join(',') + '\n' + filas.join('\n'), 'text/csv;charset=utf-8');
  }
  function parseCSV(txt) {
    const filas = [], sep = (txt.split('\n')[0].split(';').length > txt.split('\n')[0].split(',').length) ? ';' : ',';
    let fila = [], celda = '', q = false; txt = txt.replace(/^﻿/, '');
    for (let i = 0; i < txt.length; i++) {
      const ch = txt[i];
      if (q) { if (ch === '"') { if (txt[i + 1] === '"') { celda += '"'; i++; } else q = false; } else celda += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep) { fila.push(celda); celda = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && txt[i + 1] === '\n') i++; fila.push(celda); filas.push(fila); fila = []; celda = ''; }
      else celda += ch;
    }
    if (celda || fila.length) { fila.push(celda); filas.push(fila); }
    return filas.filter(f => f.some(c => c.trim()));
  }
  function importarCSV(txt) {
    const filas = parseCSV(txt); const cab = filas.shift().map(c => c.trim());
    const si = (v) => /^(si|sí|true|1|x)$/i.test(String(v).trim());
    const lista = (v) => String(v || '').split('|').map(x => x.trim()).filter(Boolean);
    let n = 0;
    filas.forEach(f => {
      const o = {}; cab.forEach((c, i) => o[c] = f[i] != null ? f[i].trim() : '');
      if (!o.nombre) return;
      const p = T.normalizarProducto({
        id: o.id || T.slug(o.nombre), nombre: o.nombre, categoria: o.categoria || 'otros', precio: Number(String(o.precio).replace(/[^\d.]/g, '')) || 0,
        precioAnterior: o.precioAnterior ? Number(String(o.precioAnterior).replace(/[^\d.]/g, '')) : null, stock: o.stock === '' || o.stock == null ? null : Number(o.stock),
        disponible: o.disponible === '' ? true : si(o.disponible), visible: o.visible === '' ? true : si(o.visible), nuevo: si(o.nuevo), oferta: si(o.oferta), destacado: si(o.destacado), popular: si(o.popular),
        orden: Number(o.orden) || 0, fechaCreacion: o.fechaCreacion || hoy(), descripcionCorta: o.descripcionCorta, descripcion: o.descripcion, problema: o.problema,
        imagenes: lista(o.imagenes), video: o.video, beneficios: lista(o.beneficios), incluye: lista(o.incluye), instrucciones: lista(o.instrucciones), precauciones: lista(o.precauciones),
        especificaciones: Object.fromEntries(lista(o.especificaciones).map(s => { const i = s.indexOf(':'); return i > 0 ? [s.slice(0, i).trim(), s.slice(i + 1).trim()] : [s, '']; })),
        preguntas: lista(o.preguntas).map(s => { const [p, ...r] = s.split('>'); return r.length ? { p: p.trim(), r: r.join('>').trim() } : null; }).filter(Boolean),
        variantes: lista(o.variantes).map(s => { const i = s.indexOf(':'); return i > 0 ? { nombre: s.slice(0, i).trim(), opciones: s.slice(i + 1).split(',').map(x => x.trim()).filter(Boolean) } : null; }).filter(Boolean),
        palabrasClave: o.palabrasClave ? o.palabrasClave.split(/[|,]/).map(x => x.trim()).filter(Boolean) : [], relacionados: o.relacionados ? o.relacionados.split(/[|,]/).map(x => x.trim()).filter(Boolean) : []
      });
      if (!T.categoria(p.categoria)) catalogo.categorias.push({ id: p.categoria, nombre: p.categoria, icono: 'svg:etiqueta', descripcion: '', visible: true, orden: catalogo.categorias.length + 1 });
      const i = catalogo.productos.findIndex(x => x.id === p.id); if (i >= 0) catalogo.productos[i] = p; else catalogo.productos.push(p); n++;
    });
    return n;
  }
  $('#tab-datos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-exportar]'); if (!b) return;
    if (b.dataset.exportar === 'catalogo') descargar('catalogo.json', json(catalogo));
    else if (b.dataset.exportar === 'config') descargar('config.json', json(config));
    else exportarCSV();
  });
  $('#btn-descargar').addEventListener('click', () => { descargar('catalogo.json', json(catalogo)); setTimeout(() => descargar('config.json', json(config)), 400); T.toast('Reemplaza ambos archivos en la carpeta data/ del sitio'); });
  $('#archivo-importar').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return; const txt = await f.text();
    try {
      if (/\.csv$/i.test(f.name)) { const n = importarCSV(txt); T.toast(`${n} producto(s) importado(s)`); }
      else { const o = JSON.parse(txt); if (o.productos) { catalogo = o; catalogo.productos = catalogo.productos.map(T.normalizarProducto); T.datos.catalogo = catalogo; T.toast('Catálogo importado'); } else if (o.negocio || o.whatsapp) { config = o; T.datos.config = config; T.toast('Configuración importada'); } else throw new Error('Formato no reconocido'); }
      persistir(); $('#filtro-cat-admin').innerHTML = ''; renderTodo();
    } catch (err) { alert('No se pudo importar: ' + err.message); }
    e.target.value = '';
  });
  $('#btn-descartar').addEventListener('click', () => { if (confirm('¿Descartar el borrador local y volver a los datos publicados en data/?')) { localStorage.removeItem(T.LS.borradorCatalogo); localStorage.removeItem(T.LS.borradorConfig); location.reload(); } });
  $('#btn-previsualizar').addEventListener('click', () => { T.guardarLS(T.LS.previsualizar, true); window.open('index.html?preview=1', '_blank'); });

  /* ---------- Métricas locales ---------- */
  function renderMetricas() {
    const m = T.leerLS(T.LS.metricas, {}); const filas = Object.entries(m).sort((a, b) => b[1] - a[1]);
    $('#metricas').innerHTML = filas.length ? `<table class="metricas-tabla"><tr><th>Evento</th><th>Clics / vistas</th></tr>${filas.map(([k, v]) => { const [ev, id] = k.split(':'); const p = id && T.producto(id); return `<tr><td>${esc(ev)}${p ? ' · ' + esc(p.nombre) : id ? ' · ' + esc(id) : ''}</td><td>${v}</td></tr>`; }).join('')}</table>` : '<p class="pendiente">Todavía no hay eventos registrados en este navegador.</p>';
  }
  $('#btn-limpiar-metricas').addEventListener('click', () => { localStorage.removeItem(T.LS.metricas); renderMetricas(); });

  /* ---------- Ayuda ---------- */
  function renderAyuda() {
    $('#ayuda').innerHTML = `<div class="ayuda">
      <h2 style="margin-top:0">Cómo funciona este panel</h2>
      <p>La tienda es un sitio estático: no tiene servidor ni base de datos, por eso es gratuita de alojar y muy rápida. Los productos viven en <code>data/catalogo.json</code> y la configuración en <code>data/config.json</code>.</p>
      <ol>
        <li>Edita productos, categorías o configuración aquí. Todo se guarda como <strong>borrador en este navegador</strong> (no se pierde al cerrar la pestaña, pero no se publica solo).</li>
        <li>Usa <strong>Vista previa</strong> para ver la tienda con el borrador antes de publicar.</li>
        <li>Pulsa <strong>Descargar archivos</strong> y reemplaza <code>catalogo.json</code> y <code>config.json</code> dentro de la carpeta <code>data/</code> del sitio (en GitHub, Netlify o la plataforma donde lo publiques). Al subirlos, la tienda queda actualizada para todos.</li>
      </ol>
      <h2>Fotos y videos</h2>
      <p>Este panel no puede subir archivos por sí mismo (no hay servidor). Guarda las fotos en la carpeta <code>img/</code> del sitio (por ejemplo <code>img/productos/nombre.jpg</code>) y escribe esa ruta en el producto. Recomendado: fotos cuadradas de 800×800 px, JPG o WebP de menos de 200 KB, y videos MP4 cortos (menos de 15 MB). Usa solo imágenes propias o con permiso de uso.</p>
      <h2>Vistas previas al compartir en redes</h2>
      <p>Por defecto, los enlaces <code>producto.html?p=ID</code> funcionan en todos lados, pero Facebook y WhatsApp muestran la imagen genérica de la tienda. Para que muestren la foto y el nombre de cada producto, ejecuta <code>node generar-paginas.mjs</code> en tu computador antes de publicar y activa «páginas estáticas» en Configuración → Sitio. Se explica en el README.</p>
      <h2>Limitaciones honestas de esta versión</h2>
      <ul><li>No hay inicio de sesión: cualquiera que conozca la dirección de <code>admin.html</code> puede abrirlo, pero <strong>no puede cambiar la tienda publicada</strong> (solo su propio borrador local). Aun así, si prefieres, no publiques <code>admin.html</code> y úsalo solo en tu computador.</li><li>No hay pagos en línea ni inventario automático: las ventas se cierran por WhatsApp.</li><li>El generador de contenido usa plantillas con tus datos; no es una IA. Incluye un prompt listo para pegar en una IA externa.</li></ul>
    </div>`;
  }

  cargar().catch(err => { document.body.innerHTML = '<div class="contenedor"><div class="vacio" style="margin:2rem 0">No se pudo cargar. Abre el panel desde un servidor (no con file://). ' + esc(err.message) + '</div></div>'; });
})();
