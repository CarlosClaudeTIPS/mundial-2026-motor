/* =========================================================
   Apoyo Docente — lógica pura (sin DOM)
   Se usa en la página (window.Logica) y en las pruebas (Node).
   ========================================================= */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Logica = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const limpiarNumero = (n) => String(n ?? "").replace(/\D/g, "");
  const NUMERO_DEMO = /^5730{9}$/;

  /** true si hay un número de WhatsApp real configurado (no vacío ni de demostración). */
  function whatsappConfigurado(numero) {
    const n = limpiarNumero(numero);
    return n.length >= 10 && !NUMERO_DEMO.test(n);
  }

  function waUrl(numero, texto) {
    return `https://wa.me/${limpiarNumero(numero)}?text=${encodeURIComponent(texto)}`;
  }

  /** Mensaje inicial con [necesidad] reemplazada. */
  function waMessage(plantilla, necesidad) {
    return (plantilla || "Hola, quisiera información sobre el servicio de apoyo docente.").replace("[necesidad]", necesidad || "mi trabajo docente");
  }

  /** Texto del botón/enlace de WhatsApp a partir de data-wa. */
  function waTextoDesde(plantilla, custom) {
    const c = (custom || "").trim();
    const esFrase = /^[A-ZÁÉÍÓÚÑ]/.test(c);
    return esFrase ? `${waMessage(plantilla, "")}\n\n${c}.` : waMessage(plantilla, c);
  }

  /** Convierte las respuestas del formulario en un objeto etiqueta → valor (solo lo diligenciado). */
  function resumenDesdeFormulario(fd) {
    const get = (n) => (fd.get(n) || "").toString().trim();
    const many = (n) => fd.getAll(n).map(String).filter(Boolean);
    const d = {
      "Nombre / contacto": get("nombre"), "Correo": get("correo"), "Medio de contacto preferido": get("medio"),
      "Asignatura o área": get("area"), "Grados": many("grados").join(", "), "Tipo de institución": get("institucion"),
      "Tipo de apoyo": many("apoyo").join("; "), "Descripción de la necesidad": get("descripcion"),
      "Materiales que ya tiene": get("tienes"), "Formatos disponibles": many("formatos").join(", "),
      "Duración del apoyo": get("duracion"), "Fecha límite": get("fecha"), "Presupuesto estimado": get("presupuesto")
    };
    return Object.fromEntries(Object.entries(d).filter(([, v]) => v));
  }

  function textoResumen(datos) {
    const lines = Object.entries(datos).map(([k, v]) => `• ${k}: ${v}`);
    return `Hola, quisiera conocer más sobre el servicio de apoyo docente. Te comparto el resumen de mi solicitud:\n\n${lines.join("\n")}\n\nMe gustaría saber cómo podemos organizar una propuesta personalizada.`;
  }

  /** Validación de un paso del formulario. Devuelve "" si está bien o el mensaje de error. */
  function validarPaso(paso, datos) {
    const vacio = (k) => !(datos[k] || "").toString().trim();
    if (paso === 1) {
      if (vacio("nombre")) return "Escribe tu nombre o una forma de contacto.";
      if (datos.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(datos.correo)) return "Revisa el correo electrónico.";
    }
    if (paso === 3 && !(datos.apoyo || []).length) return "Marca al menos una opción. Si no estás segura o seguro, elige «Aún no lo sé».";
    if (paso === 4 && vacio("descripcion")) return "Cuéntanos en pocas palabras qué necesitas.";
    if (paso === 5 && !datos.consentimiento) return "Necesitamos tu autorización para usar los datos y responderte.";
    return "";
  }

  const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  /** Filtra recursos del portafolio por texto, categoría, área, grado y tipo. */
  function filtrarRecursos(items, f = {}) {
    const q = norm(f.q || "").trim();
    return (items || []).filter((it) => {
      if (f.categoria && f.categoria !== "Todos" && it.categoria !== f.categoria) return false;
      if (f.area && it.area !== f.area) return false;
      if (f.grado && !(it.grados || []).includes(f.grado)) return false;
      if (f.tipoRecurso && it.tipoRecurso !== f.tipoRecurso) return false;
      if (q) {
        const texto = norm([it.nombre, it.necesidad, it.contexto, it.categoria, it.area, it.tipoRecurso, (it.grados || []).join(" "), it.personalizacion].join(" "));
        if (!q.split(/\s+/).every((w) => texto.includes(w))) return false;
      }
      return true;
    });
  }

  /** Valores únicos de un campo (o de un campo lista) para armar filtros. */
  function opciones(items, campo) {
    const set = new Set();
    (items || []).forEach((it) => { const v = it[campo]; (Array.isArray(v) ? v : [v]).forEach((x) => x && set.add(x)); });
    return [...set];
  }

  return { esc, whatsappConfigurado, waUrl, waMessage, waTextoDesde, resumenDesdeFormulario, textoResumen, validarPaso, filtrarRecursos, opciones, limpiarNumero };
});
