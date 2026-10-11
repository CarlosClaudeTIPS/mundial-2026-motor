/* =========================================================
   Apoyo Docente — lógica de la página
   Todo el contenido editable vive en config.js
   ========================================================= */
(function () {
  "use strict";
  const CFG = window.SITE_CONFIG || {};
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const get = (path) => path.split(".").reduce((o, k) => (o ? o[k] : undefined), CFG);

  /* ---------- Iconos SVG (línea) ---------- */
  const ICONS = {
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 15h3M13 15h3"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M8 3v18M12 8h5M12 12h5"/>',
    check: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 12l3 3 5-6"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    edit: '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="M13 7l4 4"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.7"/><path d="M12 17h.01"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    scale: '<path d="M12 3v18M4 7h16"/><path d="M6 7l-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    send: '<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/>'
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.doc}</svg>`;
  $$("[data-icon]").forEach((el) => { el.innerHTML = icon(el.dataset.icon); });

  /* ---------- Vistas previas ilustradas de documentos ---------- */
  const PREVIEWS = {
    planeacion: `<svg viewBox="0 0 200 150"><rect width="200" height="150" rx="8" fill="#fff" stroke="#D6DEEE"/><rect x="16" y="16" width="90" height="10" rx="3" fill="#2F4D8C"/><rect x="16" y="34" width="168" height="1.5" fill="#E2E8F2"/><g font-size="0"><rect x="16" y="44" width="40" height="18" rx="3" fill="#E7EEFB"/><rect x="60" y="44" width="40" height="18" rx="3" fill="#E7EEFB"/><rect x="104" y="44" width="40" height="18" rx="3" fill="#E7EEFB"/><rect x="148" y="44" width="36" height="18" rx="3" fill="#E7EEFB"/></g><g fill="#C9D3E8"><rect x="16" y="68" width="40" height="60" rx="3"/><rect x="60" y="68" width="40" height="60" rx="3"/><rect x="104" y="68" width="40" height="60" rx="3"/><rect x="148" y="68" width="36" height="60" rx="3"/></g><rect x="22" y="76" width="28" height="4" rx="2" fill="#fff"/><rect x="22" y="86" width="22" height="4" rx="2" fill="#fff"/><rect x="66" y="76" width="28" height="4" rx="2" fill="#fff"/><rect x="110" y="76" width="28" height="4" rx="2" fill="#fff"/><rect x="154" y="76" width="24" height="4" rx="2" fill="#fff"/><rect x="22" y="110" width="20" height="10" rx="2" fill="#FFD166"/><rect x="66" y="110" width="20" height="10" rx="2" fill="#DDF3EA"/></svg>`,
    guia: `<svg viewBox="0 0 200 150"><rect width="200" height="150" rx="8" fill="#fff" stroke="#D6DEEE"/><rect x="16" y="14" width="110" height="12" rx="3" fill="#F4845F"/><rect x="16" y="34" width="168" height="5" rx="2" fill="#C9D3E8"/><rect x="16" y="44" width="150" height="5" rx="2" fill="#C9D3E8"/><rect x="16" y="54" width="160" height="5" rx="2" fill="#C9D3E8"/><rect x="16" y="70" width="80" height="60" rx="6" fill="#E7EEFB"/><circle cx="56" cy="100" r="18" fill="#2F4D8C" opacity=".8"/><path d="M48 100l6 6 10-12" stroke="#fff" stroke-width="3" fill="none"/><rect x="106" y="72" width="78" height="6" rx="3" fill="#2F4D8C"/><rect x="106" y="86" width="12" height="12" rx="3" fill="#DDF3EA"/><rect x="122" y="88" width="56" height="5" rx="2" fill="#C9D3E8"/><rect x="106" y="104" width="12" height="12" rx="3" fill="#DDF3EA"/><rect x="122" y="106" width="48" height="5" rx="2" fill="#C9D3E8"/><rect x="106" y="122" width="12" height="12" rx="3" fill="#DDF3EA"/><rect x="122" y="124" width="52" height="5" rx="2" fill="#C9D3E8"/></svg>`,
    rubrica: `<svg viewBox="0 0 200 150"><rect width="200" height="150" rx="8" fill="#fff" stroke="#D6DEEE"/><rect x="16" y="14" width="80" height="10" rx="3" fill="#2BB58A"/><g fill="#2F4D8C"><rect x="16" y="34" width="56" height="18" rx="2"/><rect x="74" y="34" width="36" height="18" rx="2" opacity=".85"/><rect x="112" y="34" width="36" height="18" rx="2" opacity=".7"/><rect x="150" y="34" width="34" height="18" rx="2" opacity=".55"/></g><g fill="#F6F8FC" stroke="#E2E8F2"><rect x="16" y="54" width="56" height="22"/><rect x="74" y="54" width="36" height="22"/><rect x="112" y="54" width="36" height="22"/><rect x="150" y="54" width="34" height="22"/><rect x="16" y="78" width="56" height="22"/><rect x="74" y="78" width="36" height="22"/><rect x="112" y="78" width="36" height="22"/><rect x="150" y="78" width="34" height="22"/><rect x="16" y="102" width="56" height="22"/><rect x="74" y="102" width="36" height="22"/><rect x="112" y="102" width="36" height="22"/><rect x="150" y="102" width="34" height="22"/></g><g fill="#C9D3E8"><rect x="22" y="62" width="40" height="5" rx="2"/><rect x="22" y="86" width="34" height="5" rx="2"/><rect x="22" y="110" width="44" height="5" rx="2"/></g><g fill="#FFD166"><circle cx="130" cy="65" r="6"/><circle cx="92" cy="89" r="6"/><circle cx="167" cy="113" r="6"/></g></svg>`,
    material: `<svg viewBox="0 0 200 150"><rect width="200" height="150" rx="8" fill="#fff" stroke="#D6DEEE"/><rect x="60" y="14" width="80" height="10" rx="3" fill="#2F4D8C"/><rect x="70" y="40" width="60" height="30" rx="8" fill="#FFD166"/><rect x="80" y="51" width="40" height="6" rx="3" fill="#fff"/><g stroke="#2F4D8C" stroke-width="2"><path d="M100 70v12M60 82h80M60 82v10M100 82v10M140 82v10"/></g><rect x="30" y="92" width="60" height="40" rx="8" fill="#DDF3EA"/><rect x="110" y="92" width="60" height="40" rx="8" fill="#E7EEFB"/><rect x="40" y="104" width="40" height="5" rx="2" fill="#2BB58A"/><rect x="40" y="114" width="30" height="5" rx="2" fill="#2BB58A" opacity=".6"/><rect x="120" y="104" width="40" height="5" rx="2" fill="#2F4D8C"/><rect x="120" y="114" width="30" height="5" rx="2" fill="#2F4D8C" opacity=".6"/></svg>`,
    inclusion: `<svg viewBox="0 0 200 150"><rect width="200" height="150" rx="8" fill="#fff" stroke="#D6DEEE"/><rect x="16" y="14" width="100" height="10" rx="3" fill="#6B4FBB"/><rect x="16" y="34" width="80" height="100" rx="8" fill="#F6F8FC" stroke="#E2E8F2"/><rect x="24" y="44" width="60" height="5" rx="2" fill="#C9D3E8"/><rect x="24" y="54" width="52" height="5" rx="2" fill="#C9D3E8"/><rect x="24" y="64" width="56" height="5" rx="2" fill="#C9D3E8"/><rect x="24" y="74" width="48" height="5" rx="2" fill="#C9D3E8"/><path d="M100 84l12 0" stroke="#F4845F" stroke-width="3"/><path d="M108 78l6 6-6 6" stroke="#F4845F" stroke-width="3" fill="none"/><rect x="118" y="34" width="66" height="100" rx="8" fill="#EFE9FB" stroke="#D9CEF5"/><rect x="126" y="44" width="40" height="22" rx="4" fill="#FFD166"/><rect x="126" y="72" width="50" height="7" rx="3" fill="#6B4FBB"/><rect x="126" y="86" width="44" height="7" rx="3" fill="#6B4FBB" opacity=".6"/><circle cx="138" cy="112" r="8" fill="#2BB58A"/><rect x="150" y="108" width="26" height="7" rx="3" fill="#C9D3E8"/></svg>`,
    documento: `<svg viewBox="0 0 200 150"><rect width="200" height="150" rx="8" fill="#fff" stroke="#D6DEEE"/><rect x="16" y="14" width="168" height="20" rx="4" fill="#2F4D8C"/><rect x="24" y="20" width="70" height="8" rx="3" fill="#fff" opacity=".8"/><g fill="#C9D3E8"><rect x="16" y="44" width="80" height="5" rx="2"/><rect x="104" y="44" width="80" height="5" rx="2"/><rect x="16" y="56" width="168" height="5" rx="2"/><rect x="16" y="68" width="140" height="5" rx="2"/></g><rect x="16" y="84" width="168" height="1.5" fill="#E2E8F2"/><g fill="#F6F8FC" stroke="#E2E8F2"><rect x="16" y="92" width="168" height="14"/><rect x="16" y="108" width="168" height="14"/><rect x="16" y="124" width="168" height="14"/></g><g fill="#C9D3E8"><rect x="22" y="96" width="60" height="5" rx="2"/><rect x="22" y="112" width="48" height="5" rx="2"/><rect x="22" y="128" width="56" height="5" rx="2"/></g><rect x="150" y="95" width="28" height="8" rx="2" fill="#2BB58A"/><rect x="150" y="111" width="28" height="8" rx="2" fill="#FFD166"/></svg>`,
    presentacion: `<svg viewBox="0 0 200 150"><rect width="200" height="150" rx="8" fill="#fff" stroke="#D6DEEE"/><rect x="16" y="16" width="168" height="94" rx="8" fill="#2F4D8C"/><rect x="30" y="30" width="90" height="12" rx="3" fill="#FFD166"/><rect x="30" y="50" width="70" height="5" rx="2" fill="#fff" opacity=".8"/><rect x="30" y="60" width="60" height="5" rx="2" fill="#fff" opacity=".6"/><circle cx="150" cy="60" r="22" fill="#F4845F"/><path d="M150 38v22h22" stroke="#fff" stroke-width="3" fill="none"/><g fill="#E7EEFB"><rect x="16" y="118" width="38" height="20" rx="3"/><rect x="59" y="118" width="38" height="20" rx="3"/><rect x="102" y="118" width="38" height="20" rx="3"/><rect x="145" y="118" width="39" height="20" rx="3"/></g></svg>`
  };
  const preview = (item) => item.imagen ? `<img src="${esc(item.imagen)}" alt="Vista previa: ${esc(item.nombre)}" loading="lazy">` : (PREVIEWS[item.tipo] || PREVIEWS.documento);

  /* ---------- Textos desde config ---------- */
  $$("[data-cfg]").forEach((el) => { const v = get(el.dataset.cfg); if (v) el.textContent = v; });
  $("#year").textContent = new Date().getFullYear();
  document.title = `${get("marca.nombre") || "Apoyo docente"} | Apoyo docente personalizado`;

  // Foto de la profesional (si está configurada)
  if (get("marca.foto")) {
    $("#heroVisual").innerHTML = `<img class="hero-photo" src="${esc(get("marca.foto"))}" alt="${esc(get("marca.profesional") || "Profesional")}">`;
  }

  /* ---------- WhatsApp ---------- */
  const WA = (get("contacto.whatsapp") || "").replace(/\D/g, "");
  const waUrl = (text) => `https://wa.me/${WA}?text=${encodeURIComponent(text)}`;
  const waMessage = (necesidad) => (get("contacto.mensajeInicial") || "Hola, quisiera información.").replace("[necesidad]", necesidad || "mi trabajo docente");
  // data-wa="" → mensaje estándar. data-wa="frase corta" → se inserta como [necesidad].
  // data-wa="Frase con mayúscula inicial" → se añade como línea adicional al mensaje estándar.
  function bindWaLinks(root = document) {
    $$(".wa-link", root).forEach((a) => {
      const custom = (a.dataset.wa || "").trim();
      const isSentence = /^[A-ZÁÉÍÓÚÑ]/.test(custom);
      const text = isSentence ? `${waMessage("")}\n\n${custom}.` : waMessage(custom);
      a.href = waUrl(text); a.target = "_blank"; a.rel = "noopener";
    });
  }
  bindWaLinks();
  const contactBits = [];
  if (WA) contactBits.push(`<a href="${waUrl(waMessage(""))}" target="_blank" rel="noopener">WhatsApp: +${esc(WA)}</a>`);
  if (get("contacto.correo")) contactBits.push(`<a href="mailto:${esc(get("contacto.correo"))}">${esc(get("contacto.correo"))}</a>`);
  $("#footerContact").innerHTML = contactBits.join("<br>") || "Configura tu número de WhatsApp en config.js";

  /* ---------- Menú móvil ---------- */
  const nav = $("#mainNav"), toggle = $("#navToggle");
  toggle.addEventListener("click", () => { const open = nav.classList.toggle("open"); toggle.setAttribute("aria-expanded", String(open)); });
  nav.addEventListener("click", (e) => { if (e.target.tagName === "A") { nav.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); } });

  /* ---------- Servicios ---------- */
  const servicios = CFG.servicios || [];
  const areaIcon = (id) => ((CFG.areas || []).find((a) => a.id === id) || {}).icono || "doc";
  $("#serviceTabs").innerHTML = servicios.map((s, i) => `<button class="tab" role="tab" id="tab-${esc(s.id)}" aria-selected="${i === 0}" aria-controls="panel-${esc(s.id)}" data-id="${esc(s.id)}">${icon(areaIcon(s.id))}<span>${esc(s.titulo)}</span></button>`).join("");
  $("#servicePanels").innerHTML = servicios.map((s, i) => `
    <article class="service-panel${i === 0 ? " active" : ""}" id="panel-${esc(s.id)}" role="tabpanel" aria-labelledby="tab-${esc(s.id)}">
      <header><h3>${esc(s.titulo)}</h3><p>${esc(s.descripcion)}</p></header>
      <div class="service-cols">
        <div><h4>Qué puedes solicitar</h4><ul class="check-list">${s.puedes.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>
        <div><h4>Para qué sirve</h4><p>${esc(s.sirve)}</p></div>
        <div><h4>Qué necesitamos de ti</h4><ul class="info-list">${s.necesitamos.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></div>
      </div>
      ${s.nota ? `<div class="service-note${s.alerta ? " alert" : ""}">${icon("info")}<span>${esc(s.nota)}</span></div>` : ""}
      <footer>
        <a class="btn btn-primary" href="#formulario" data-preselect="${esc(s.titulo)}">Solicitar este apoyo</a>
        <a class="btn btn-ghost wa-link" href="#" data-wa="${esc(s.titulo.toLowerCase())}">Consultar por WhatsApp</a>
      </footer>
    </article>`).join("");
  function showService(id) {
    $$(".tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.id === id)));
    $$(".service-panel").forEach((p) => p.classList.toggle("active", p.id === `panel-${id}`));
  }
  $("#serviceTabs").addEventListener("click", (e) => { const t = e.target.closest(".tab"); if (t) showService(t.dataset.id); });
  bindWaLinks($("#servicePanels"));

  /* ---------- Ejemplos de flexibilidad y modalidades ---------- */
  $("#flexGrid").innerHTML = (CFG.ejemplosFlexibilidad || []).map((e) => `<div class="flex-card reveal"><h4>${esc(e.titulo)}</h4><p>${esc(e.texto)}</p></div>`).join("");
  $("#modalidades").innerHTML = (CFG.modalidades || []).map((m) => `<div class="mod reveal"><div class="mod-icon">${icon(m.icono)}</div><h4>${esc(m.titulo)}</h4><p>${esc(m.texto)}</p><span class="ej">${esc(m.ejemplo)}</span></div>`).join("");

  /* ---------- Portafolio ---------- */
  const port = CFG.portafolio || [];
  const cats = ["Todos", ...new Set(port.map((p) => p.categoria))];
  $("#portfolioFilters").innerHTML = cats.map((c, i) => `<button class="filter" aria-pressed="${i === 0}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
  $("#portfolioGrid").innerHTML = port.map((p, i) => `
    <button class="pcard reveal" data-index="${i}" data-cat="${esc(p.categoria)}" type="button" aria-haspopup="dialog">
      <div class="preview">${preview(p)}</div>
      <div class="body"><span class="cat">${esc(p.categoria)}</span><h3>${esc(p.nombre)}</h3><p>${esc(p.necesidad)}</p>${p.contexto ? `<span class="ctx">${esc(p.contexto)}</span>` : ""}</div>
    </button>`).join("");
  $("#portfolioFilters").addEventListener("click", (e) => {
    const b = e.target.closest(".filter"); if (!b) return;
    $$(".filter").forEach((f) => f.setAttribute("aria-pressed", String(f === b)));
    $$(".pcard").forEach((c) => c.classList.toggle("hidden", b.dataset.cat !== "Todos" && c.dataset.cat !== b.dataset.cat));
  });

  /* ---------- Modal ---------- */
  const modal = $("#modal"), modalBody = $("#modalBody");
  let lastFocus = null;
  function openModal(html) {
    lastFocus = document.activeElement; modalBody.innerHTML = html; modal.hidden = false; document.body.style.overflow = "hidden";
    bindWaLinks(modalBody); $(".modal-close").focus();
  }
  function closeModal() { modal.hidden = true; document.body.style.overflow = ""; if (lastFocus) lastFocus.focus(); }
  modal.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });
  $("#portfolioGrid").addEventListener("click", (e) => {
    const c = e.target.closest(".pcard"); if (!c) return;
    const p = port[+c.dataset.index];
    openModal(`
      <span class="eyebrow">${esc(p.categoria)}</span>
      <h3 id="modalTitle">${esc(p.nombre)}</h3>
      ${Array.isArray(p.paginas) && p.paginas.length
        ? `<div class="modal-pages" aria-label="Páginas de la muestra">${p.paginas.map((src, i) => `<figure><img src="${esc(src)}" alt="${esc(p.nombre)}, página ${i + 1}" loading="lazy"><figcaption>Página ${i + 1} de ${p.paginas.length}</figcaption></figure>`).join("")}</div>`
        : `<div class="modal-preview">${preview(p)}</div>`}
      <dl class="modal-meta">
        <dt>Necesidad que resuelve</dt><dd>${esc(p.necesidad)}</dd>
        ${p.contexto ? `<dt>Grado o contexto</dt><dd>${esc(p.contexto)}</dd>` : ""}
        <dt>Cómo se personaliza</dt><dd>${esc(p.personalizacion)}</dd>
      </dl>
      <p class="small" style="color:var(--c-ink-3)">Documento demostrativo con datos ficticios. El resultado final depende de tu contexto.</p>
      <div class="modal-actions">
        ${p.archivo ? `<a class="btn btn-ghost" href="${esc(p.archivo)}" download>Descargar PDF</a>` : ""}
        <a class="btn btn-primary" href="#formulario" data-close data-preselect="${esc(p.categoria)}">Quiero algo similar</a>
        <a class="btn btn-wa wa-link" href="#" data-wa="un material similar a: ${esc(p.nombre)}">Preguntar por WhatsApp</a>
      </div>`);
  });
  document.addEventListener("click", (e) => {
    const l = e.target.closest("[data-modal]"); if (!l) return;
    e.preventDefault(); const tpl = $(`#tpl-${l.dataset.modal}`); if (tpl) openModal(tpl.innerHTML);
  });

  /* ---------- FAQ ---------- */
  $("#faqList").innerHTML = (CFG.faq || []).map((f) => `<details class="faq reveal"><summary>${esc(f.p)}</summary><p>${esc(f.r)}</p></details>`).join("");

  /* ---------- Preselección de tipo de apoyo desde botones ---------- */
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-preselect]"); if (!a) return;
    const val = a.dataset.preselect.toLowerCase();
    $$('input[name="apoyo"]').forEach((cb) => { if (val.includes(cb.value.toLowerCase().split(" ")[0]) || cb.value.toLowerCase().includes(val.split(" ")[0])) cb.checked = true; });
  });

  /* ---------- Formulario por pasos ---------- */
  const form = $("#needsForm"), steps = $$(".wstep", form), TOTAL = steps.length;
  const btnPrev = $("#btnPrev"), btnNext = $("#btnNext"), btnSubmit = $("#btnSubmit"), errBox = $("#formError");
  let current = 1;
  const DRAFT_KEY = "apoyo-docente-borrador";

  function renderStep() {
    steps.forEach((s) => s.classList.toggle("active", +s.dataset.step === current));
    $("#wizardBar").style.width = `${(current / TOTAL) * 100}%`;
    $$("#wizardDots li").forEach((li, i) => li.classList.toggle("active", i + 1 === current));
    $("#wizardCount").textContent = `Paso ${current} de ${TOTAL}`;
    btnPrev.hidden = current === 1; btnNext.hidden = current === TOTAL; btnSubmit.hidden = current !== TOTAL;
    errBox.hidden = true;
    const first = $("input:not([type=checkbox]):not([type=radio]),textarea,select", steps[current - 1]); if (first && window.innerWidth > 820) first.focus({ preventScroll: true });
  }
  function validateStep() {
    const s = steps[current - 1]; let ok = true, msg = "";
    $$("[required]", s).forEach((el) => {
      const bad = el.type === "checkbox" ? !el.checked : !el.value.trim();
      el.classList.toggle("invalid", bad); if (bad) ok = false;
    });
    if (!ok) msg = "Completa los campos marcados con *.";
    if (ok && current === 3 && !$$('input[name="apoyo"]:checked').length) { ok = false; msg = "Marca al menos una opción. Si no estás segura o seguro, elige «Aún no lo sé»."; }
    const email = $("#f_correo"); if (ok && current === 1 && email.value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value)) { ok = false; email.classList.add("invalid"); msg = "Revisa el correo electrónico."; }
    errBox.textContent = msg; errBox.hidden = ok; return ok;
  }
  btnNext.addEventListener("click", () => { if (validateStep()) { current++; renderStep(); saveDraft(); } });
  btnPrev.addEventListener("click", () => { current--; renderStep(); });
  form.addEventListener("input", saveDraft);
  form.addEventListener("change", saveDraft);

  function collect() {
    const fd = new FormData(form), many = (n) => fd.getAll(n).filter(Boolean);
    return {
      "Nombre / contacto": fd.get("nombre"), "Correo": fd.get("correo") || "", "Medio de contacto preferido": fd.get("medio"),
      "Asignatura o área": fd.get("area") || "", "Grados": many("grados").join(", "), "Tipo de institución": fd.get("institucion") || "",
      "Tipo de apoyo": many("apoyo").join("; "), "Descripción de la necesidad": fd.get("descripcion"),
      "Materiales que ya tiene": fd.get("tienes") || "", "Formatos disponibles": many("formatos").join(", "),
      "Duración del apoyo": fd.get("duracion"), "Fecha límite": fd.get("fecha") || "", "Presupuesto estimado": fd.get("presupuesto") || ""
    };
  }
  function saveDraft() { try { const o = {}; new FormData(form).forEach((v, k) => { (o[k] ||= []).push(v); }); localStorage.setItem(DRAFT_KEY, JSON.stringify(o)); } catch (_) { } }
  function loadDraft() {
    try {
      const o = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); if (!o) return;
      Object.entries(o).forEach(([k, vals]) => {
        $$(`[name="${k}"]`, form).forEach((el) => {
          if (el.type === "checkbox" || el.type === "radio") el.checked = vals.includes(el.value); else el.value = vals[0] ?? "";
        });
      });
      $("#f_consent").checked = false;
    } catch (_) { }
  }
  loadDraft();

  const summaryText = (d) => {
    const lines = Object.entries(d).filter(([, v]) => v).map(([k, v]) => `• ${k}: ${v}`);
    return `Hola, quisiera conocer más sobre el servicio de apoyo docente. Te comparto el resumen de mi solicitud:\n\n${lines.join("\n")}\n\nMe gustaría saber cómo podemos organizar una propuesta personalizada.`;
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!validateStep()) return;
    const data = collect(), text = summaryText(data);
    $("#summaryList").innerHTML = Object.entries(data).filter(([, v]) => v).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("");
    $("#summaryWa").href = waUrl(text);
    const status = $("#summaryStatus"); status.hidden = true; status.className = "summary-status";
    form.hidden = true; const sum = $("#summary"); sum.hidden = false; sum.scrollIntoView({ behavior: "smooth", block: "start" });
    // Envío opcional por correo (solo si hay endpoint configurado). Nunca afirmamos envío sin confirmación real.
    const endpoint = get("formulario.endpoint");
    if (endpoint) {
      status.hidden = false; status.textContent = "Enviando copia por correo…";
      try {
        const r = await fetch(endpoint, { method: "POST", headers: { "Accept": "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ ...data, _subject: "Nueva solicitud de apoyo docente" }) });
        if (r.ok) status.textContent = "✓ Copia enviada por correo. Puedes continuar por WhatsApp.";
        else throw new Error(r.status);
      } catch (_) { status.className = "summary-status err"; status.textContent = "No se pudo enviar la copia por correo. Continúa por WhatsApp: el resumen va en el mensaje."; }
    }
    try { localStorage.removeItem(DRAFT_KEY); } catch (_) { }
    $("#summaryCopy").onclick = async () => { try { await navigator.clipboard.writeText(text); $("#summaryCopy").textContent = "¡Copiado!"; setTimeout(() => $("#summaryCopy").textContent = "Copiar resumen", 2000); } catch (_) { window.prompt("Copia el resumen:", text); } };
    $("#summaryEdit").onclick = () => { sum.hidden = true; form.hidden = false; current = 1; renderStep(); form.scrollIntoView({ behavior: "smooth" }); };
  });
  renderStep();


  /* ---------- Simulador de personalización ---------- */
  (function () {
    const sim = $("#simulador"); if (!sim) return;
    const NEC = {
      planeacion: { tag: "Planeación", doc: (a, g) => `Planeación · ${a} · ${g}`, lines: ["t", "w", "y", "", "g", "w"],
        inc: (t) => [t === "periodo" ? "Planeaciones de todas las semanas del periodo" : t === "semana" ? "Planeación de una semana completa" : "Una sola planeación de clase", "Objetivos, actividades y evidencias en tu formato institucional", "Distribución realista del tiempo de clase"] },
      guia: { tag: "Guía de aprendizaje", doc: (a, g) => `Guía · ${a} · ${g}`, lines: ["t", "w", "", "g", "g", "y"],
        inc: (t) => [t === "periodo" ? "Guías de cada tema del periodo" : t === "semana" ? "Guías de la semana, conectadas con tu planeación" : "Una guía sobre el tema que indiques", "Explicación, ejemplos y actividades al nivel del grupo", "Versión imprimible y digital"] },
      rubrica: { tag: "Rúbrica", doc: (a, g) => `Rúbrica · ${a} · ${g}`, lines: ["t", "y", "y", "y", "g", ""],
        inc: (t) => [t === "periodo" ? "Instrumentos de evaluación de todo el periodo" : "Una rúbrica con criterios, niveles y escala", "Ajustada al sistema de evaluación (SIEE) de tu institución", "Lista de cotejo opcional para seguimiento"] },
      inclusion: { tag: "Actividad adaptada", doc: (a, g) => `Adaptación · ${a} · ${g}`, lines: ["t", "g", "w", "y", "", "g"],
        inc: (t) => [t === "periodo" ? "Adaptación de las actividades del periodo" : "Adaptación de la actividad que nos envíes", "Ajustes razonables a partir de la información que tú y tu institución proporcionen", "Organización de la información para el PIAR, si la necesitas"] },
      revision: { tag: "Revisión y ajustes", doc: (a, g) => `Revisión · ${a} · ${g}`, lines: ["t", "w", "y", "w", "", "g"],
        inc: (t) => [t === "periodo" ? "Revisión del material de todo el periodo" : "Revisión del material que ya tienes", "Correcciones, mejoras y ajuste al formato institucional", "Comentarios para que sepas qué cambió y por qué"] }
    };
    const TIEMPO = { semana: "una semana", periodo: "un periodo académico", puntual: "un trabajo puntual" };
    const NOTES = {
      puntual: "Solo pagas por esta tarea. No necesitas contratar nada más.",
      semana: "Un alcance corto y claro: una semana de clase, lista para usar.",
      periodo: "Un acompañamiento con entregas programadas durante el periodo."
    };
    const val = (n) => (sim.querySelector(`input[name="${n}"]:checked`) || {}).value;
    function update() {
      const g = val("s_grado"), a = val("s_area"), n = val("s_nec"), t = val("s_tiempo"), cfg = NEC[n];
      $("#simTag").textContent = cfg.tag;
      $("#simTitle").textContent = cfg.doc(a, g);
      $("#simSub").textContent = `Para ${TIEMPO[t]} · con el formato de tu institución`;
      $("#simLines").innerHTML = cfg.lines.map((c) => `<li class="${c}"></li>`).join("");
      $("#simIncluye").innerHTML = cfg.inc(t).map((x) => `<li>${esc(x)}</li>`).join("");
      $("#simNote").textContent = NOTES[t];
      $("#simStamp").textContent = `Hecho para ${g}`;
      $("#simCta").dataset.preselect = n === "revision" ? "Revisión" : n === "inclusion" ? "Inclusión" : n === "rubrica" ? "Evaluación" : n === "guia" ? "Material" : "Planeación";
      const doc = $("#simDoc"); doc.classList.remove("bump"); void doc.offsetWidth; doc.classList.add("bump");
    }
    sim.addEventListener("change", update); update();
  })();

  /* ---------- Plegables solo en celular ---------- */
  const mq = window.matchMedia("(max-width: 820px)");
  const syncCollapse = () => $$(".mobile-collapse").forEach((d) => { d.open = !mq.matches; });
  syncCollapse(); mq.addEventListener("change", syncCollapse);
  $$(".mobile-collapse").forEach((d) => d.addEventListener("toggle", () => { if (d.open) setTimeout(observeAll, 50); }));

  /* ---------- Barra fija inferior (celular) ---------- */
  const bar = $("#mobileCta"), formSec = $("#formulario");
  if (bar && formSec && "IntersectionObserver" in window) {
    new IntersectionObserver((en) => { document.body.classList.toggle("form-in-view", en[0].isIntersecting); }, { threshold: .15 }).observe(formSec);
    new IntersectionObserver((en) => { document.body.classList.toggle("past-hero", !en[0].isIntersecting); }).observe($(".hero"));
  }

  /* ---------- Animaciones al hacer scroll ---------- */
  const io = "IntersectionObserver" in window ? new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { threshold: .08, rootMargin: "0px 0px -40px 0px" }) : null;
  const observeAll = () => $$(".reveal:not(.in)").forEach((el) => io ? io.observe(el) : el.classList.add("in"));
  observeAll();
  // Los paneles ocultos deben revelarse al cambiar de pestaña
  $("#serviceTabs").addEventListener("click", observeAll);
  $("#portfolioFilters").addEventListener("click", observeAll);

  /* ---------- Aviso si falta configurar WhatsApp ---------- */
  if (!WA || /^5730{9}$/.test(WA)) console.warn("[Apoyo Docente] Configura tu número real de WhatsApp en config.js → contacto.whatsapp");
})();
