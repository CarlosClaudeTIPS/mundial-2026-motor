/* ============================================================
   Generador de borradores de contenido comercial.
   Funciona sin inteligencia artificial externa: usa plantillas
   con los datos reales del producto, señala lo que falta y
   NO inventa reseñas, resultados ni características.
   Incluye un "prompt" listo para pegar en una IA externa.
   ============================================================ */
(function () {
  const G = window.Generador = {};
  const limpio = (s) => String(s || '').trim();
  const esPendiente = (s) => !limpio(s) || /pendiente/i.test(s);
  const precio = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');

  G.faltantes = (p) => {
    const f = [];
    if (esPendiente(p.descripcion)) f.push('Descripción completa');
    if (esPendiente(p.problema)) f.push('Problema o necesidad que resuelve');
    if (!(p.beneficios || []).filter(b => !esPendiente(b)).length) f.push('Beneficios concretos');
    const specs = Object.entries(p.especificaciones || {}).filter(([k, v]) => !esPendiente(v));
    if (!specs.length) f.push('Especificaciones (material, medidas, compatibilidad)');
    if (!(p.incluye || []).filter(x => !esPendiente(x)).length) f.push('Qué incluye la compra');
    if (!(p.instrucciones || []).length) f.push('Instrucciones de uso');
    if (!(p.imagenes || []).length) f.push('Fotografías');
    if (!p.video) f.push('Video demostrativo');
    return f;
  };

  G.generar = (p, cfg, tono) => {
    tono = tono || 'cercano';
    const n = cfg.negocio || {};
    const nombre = limpio(p.nombre).replace(/\s*\(DEMO\)/i, '');
    const beneficios = (p.beneficios || []).filter(b => !esPendiente(b));
    const specs = Object.entries(p.especificaciones || {}).filter(([k, v]) => !esPendiente(v));
    const incluye = (p.incluye || []).filter(x => !esPendiente(x));
    const problema = esPendiente(p.problema) ? '' : limpio(p.problema);
    const desc = esPendiente(p.descripcion) ? '' : limpio(p.descripcion);
    const corta = esPendiente(p.descripcionCorta) ? '' : limpio(p.descripcionCorta);
    const variantes = (p.variantes || []).map(v => `${v.nombre}: ${(v.opciones || []).join(' / ')}`).join(' · ');
    const dcto = p.precioAnterior && p.precioAnterior > p.precio ? Math.round((1 - p.precio / p.precioAnterior) * 100) : 0;
    const P = '[PENDIENTE: completar]';
    const saludo = { cercano: '¡Hola! 👋', directo: 'Atención:', profesional: 'Le informamos que' }[tono];
    const cierre = { cercano: 'Escríbenos por WhatsApp y te contamos más 💬', directo: 'Pídelo por WhatsApp.', profesional: 'Consulte disponibilidad por WhatsApp.' }[tono];
    const enlace = window.Tienda && window.Tienda.datos ? window.Tienda.urlProducto(p, true) : '[enlace del producto]';
    const li = (arr, b) => arr.map(x => `${b || '•'} ${x}`).join('\n');
    const benefTxt = beneficios.length ? li(beneficios, '✔') : `✔ ${P} (agrega beneficios verificables en la ficha)`;
    const hook = problema ? `¿${problema.replace(/\.$/, '')}?` : corta ? corta : `${nombre}: ${P} (define el problema que resuelve)`;

    const titulos = [
      `${nombre}${corta ? ' – ' + corta.replace(/\.$/, '') : ''}`,
      beneficios[0] ? `${nombre} | ${beneficios[0]}` : `${nombre} | ${P} beneficio principal`,
      `${nombre}${variantes ? ' (' + (p.variantes[0].opciones || []).length + ' opciones)' : ''} – ${precio(p.precio)}`
    ];

    const descripcion = [
      hook,
      desc || `${P}: describe en 2–3 frases qué es ${nombre} y cómo se usa.`,
      '',
      'Lo que obtienes:',
      benefTxt,
      specs.length ? '\nCaracterísticas:\n' + li(specs.map(([k, v]) => `${k}: ${v}`)) : `\nCaracterísticas: ${P}`,
      incluye.length ? '\nIncluye: ' + incluye.join(', ') : `\nIncluye: ${P}`,
      variantes ? '\nOpciones: ' + variantes : '',
      `\nPrecio: ${precio(p.precio)}${dcto ? ' (antes ' + precio(p.precioAnterior) + ', -' + dcto + '%)' : ''}`,
      cierre
    ].join('\n');

    const guionVideo = [
      `GUION VIDEO CORTO (15–30 s) – ${nombre}`,
      `0–3 s | GANCHO: "${hook}" (mostrar el problema en cámara)`,
      `3–8 s | PRESENTACIÓN: aparece ${nombre}. Texto en pantalla: "${beneficios[0] || P}"`,
      `8–18 s | DEMOSTRACIÓN: ${(p.instrucciones || []).length ? p.instrucciones.slice(0, 3).join(' → ') : P + ' (graba el uso real paso a paso)'}`,
      `18–24 s | BENEFICIOS: ${beneficios.slice(0, 3).join(' · ') || P}`,
      `24–30 s | CIERRE: precio ${precio(p.precio)} + "Pídelo por WhatsApp, enlace en la bio".`,
      'Formato vertical 9:16, subtítulos grandes, música sin derechos.'
    ].join('\n');

    const reel = [
      `TEXTO EN PANTALLA (reel/historia):`,
      `1) ${hook}`,
      `2) ${nombre} ✨`,
      `3) ${beneficios[0] || P}`,
      `4) ${precio(p.precio)} · ${cierre}`,
      '',
      `CAPTION: ${nombre} ${corta ? '– ' + corta : ''} ${beneficios.length ? '\n' + li(beneficios, '✔') : ''}\nPídelo por WhatsApp 📲 (enlace en la bio)\n#${nombre.replace(/[^a-záéíóúñ0-9]/gi, '').toLowerCase()} ${(p.palabrasClave || []).map(k => '#' + k.replace(/\s+/g, '')).join(' ')}`
    ].join('\n');

    const marketplace = [
      `TÍTULO: ${titulos[0]}`,
      `PRECIO: ${precio(p.precio)}`,
      `ESTADO: Nuevo`,
      `DESCRIPCIÓN:`,
      desc || `${P}: descripción del producto.`,
      beneficios.length ? '\n' + li(beneficios) : '',
      specs.length ? '\n' + li(specs.map(([k, v]) => `${k}: ${v}`)) : '',
      incluye.length ? `\nIncluye: ${incluye.join(', ')}` : '',
      variantes ? `\nDisponible en: ${variantes}` : '',
      `\n${n.ciudad ? 'Entrega en ' + n.ciudad + '. ' : ''}Escríbeme por WhatsApp para confirmar disponibilidad y envío.`,
      `Más información: ${enlace}`
    ].join('\n');

    const instagram = [
      `${hook} ✨`,
      '',
      `${nombre}${corta ? ' – ' + corta : ''}`,
      beneficios.length ? li(beneficios, '✔') : `✔ ${P}`,
      '',
      `💰 ${precio(p.precio)}${dcto ? ' (antes ' + precio(p.precioAnterior) + ')' : ''}`,
      `📲 Pídelo por WhatsApp (enlace en la bio)`,
      '',
      (p.palabrasClave || []).map(k => '#' + k.replace(/\s+/g, '')).concat(['#emprendimiento', '#colombia']).join(' ')
    ].join('\n');

    const facebook = [
      `${saludo} ${hook}`,
      '',
      `Te presentamos ${nombre}. ${desc || P}`,
      '',
      beneficios.length ? li(beneficios, '👉') : `👉 ${P}`,
      '',
      `Precio: ${precio(p.precio)}${dcto ? ' · Antes ' + precio(p.precioAnterior) : ''}`,
      `Pídelo aquí: ${enlace}`,
      `O escríbenos por WhatsApp 💬`
    ].join('\n');

    const whatsappFaq = [
      `RESPUESTAS RÁPIDAS DE WHATSAPP – ${nombre}`,
      `[Precio] "¡Hola! El ${nombre} cuesta ${precio(p.precio)}${dcto ? ' (antes ' + precio(p.precioAnterior) + ')' : ''}. ¿Te confirmo disponibilidad y envío a tu ciudad?"`,
      `[Disponibilidad] "Déjame confirmarte en inventario y te escribo en unos minutos. ¿Para qué ciudad sería?"`,
      `[Envío] "${(cfg.politicas || {}).entregas || P + ' (define tu política de envíos)'}"`,
      `[Pago] "${(cfg.politicas || {}).pagos || P + ' (define tus métodos de pago)'}"`,
      `[Cómo funciona] "${(p.instrucciones || []).length ? p.instrucciones.join(' ') : P}"`,
      `[Qué incluye] "${incluye.length ? 'Incluye ' + incluye.join(', ') + '.' : P}"`,
      ...(p.preguntas || []).map(q => `[${q.p}] "${q.r}"`)
    ].join('\n');

    const ideas = [
      `IDEAS DE DEMOSTRACIÓN – ${nombre}`,
      `1. Antes / después: muestra el problema ("${problema || P}") y luego el producto en uso.`,
      `2. Unboxing rápido: qué incluye (${incluye.join(', ') || P}) y primeras impresiones honestas.`,
      `3. Paso a paso: ${(p.instrucciones || []).length ? p.instrucciones.length + ' pasos de uso grabados en primera persona.' : P + ' (necesitas las instrucciones).'}`,
      `4. Comparación de opciones: ${variantes || 'si hay variantes, muéstralas una al lado de otra.'}`,
      `5. Responde una pregunta frecuente en cámara: ${(p.preguntas || [])[0] ? '"' + p.preguntas[0].p + '"' : P}`,
      'Nota: graba con tu propio producto; no uses videos de terceros sin permiso.'
    ].join('\n');

    const prompt = [
      `Actúa como copywriter de ventas para un emprendimiento en Colombia que vende por WhatsApp. Escribe textos para los canales que te indique usando SOLO estos datos. Si falta información, escribe [PENDIENTE] en lugar de inventarla. No inventes reseñas, testimonios, certificaciones, resultados ni características.`,
      '',
      `DATOS DEL PRODUCTO`,
      `Nombre: ${nombre}`,
      `Precio: ${precio(p.precio)}${dcto ? ' (antes ' + precio(p.precioAnterior) + ')' : ''}`,
      `Categoría: ${p.categoria}`,
      `Descripción corta: ${corta || '[PENDIENTE]'}`,
      `Descripción: ${desc || '[PENDIENTE]'}`,
      `Problema que resuelve: ${problema || '[PENDIENTE]'}`,
      `Beneficios: ${beneficios.join('; ') || '[PENDIENTE]'}`,
      `Especificaciones: ${specs.map(([k, v]) => k + ': ' + v).join('; ') || '[PENDIENTE]'}`,
      `Incluye: ${incluye.join(', ') || '[PENDIENTE]'}`,
      `Instrucciones: ${(p.instrucciones || []).join(' ') || '[PENDIENTE]'}`,
      `Precauciones: ${(p.precauciones || []).join(' ') || 'ninguna indicada'}`,
      `Variantes: ${variantes || 'ninguna'}`,
      `Palabras clave: ${(p.palabrasClave || []).join(', ')}`,
      `Enlace: ${enlace}`,
      '',
      `Entrega: 3 títulos, descripción para la web, publicación para Facebook Marketplace, copy para Instagram, copy para Facebook, guion de video de 20 s, textos para historia y 5 respuestas de WhatsApp. Tono: ${tono}.`
    ].join('\n');

    return [
      { canal: 'Web / catálogo', titulo: 'Títulos comerciales', texto: titulos.map((t, i) => `${i + 1}. ${t}`).join('\n') },
      { canal: 'Web / catálogo', titulo: 'Descripción persuasiva', texto: descripcion },
      { canal: 'Web / catálogo', titulo: 'Beneficios verificables', texto: benefTxt },
      { canal: 'Video corto', titulo: 'Guion de video (9:16)', texto: guionVideo },
      { canal: 'Instagram / TikTok', titulo: 'Reel e historias', texto: reel },
      { canal: 'Facebook Marketplace', titulo: 'Publicación Marketplace', texto: marketplace },
      { canal: 'Instagram', titulo: 'Copy para Instagram', texto: instagram },
      { canal: 'Facebook', titulo: 'Copy para Facebook', texto: facebook },
      { canal: 'WhatsApp', titulo: 'Respuestas rápidas', texto: whatsappFaq },
      { canal: 'Contenido', titulo: 'Ideas de demostración', texto: ideas },
      { canal: 'IA externa', titulo: 'Prompt para ChatGPT / Claude / Gemini', texto: prompt }
    ];
  };
})();
