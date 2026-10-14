/* =========================================================
   Apoyo Docente — generador único de plantillas editables
   Un solo componente configurable produce 7 tipos de documento.
   No usa IA ni inventa referencias oficiales: deja espacios marcados
   con [corchetes] para que el docente complete y verifique con su malla.
   Se usa en la página (window.Plantillas) y en las pruebas (Node).
   ========================================================= */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Plantillas = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const o = (v, alt) => (v && String(v).trim()) || alt;
  const n = (v, def, min, max) => { const x = parseInt(v, 10); return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : def; };

  const CAMPOS_BASE = [
    { id: "area", etiqueta: "Asignatura o área", tipo: "text", placeholder: "Ej.: Matemáticas", requerido: true },
    { id: "grado", etiqueta: "Grado", tipo: "text", placeholder: "Ej.: 5°", requerido: true },
    { id: "tema", etiqueta: "Tema", tipo: "text", placeholder: "Ej.: Fracciones equivalentes", requerido: true },
    { id: "objetivo", etiqueta: "Objetivo de aprendizaje", tipo: "textarea", placeholder: "Lo que el estudiante debe lograr al final" },
    { id: "duracion", etiqueta: "Duración", tipo: "text", placeholder: "Ej.: 2 horas de clase" }
  ];

  const TIPOS = {
    plan: {
      nombre: "Plan de clase", descripcion: "Inicio, desarrollo y cierre por sesión, con recursos y evaluación.",
      campos: [...CAMPOS_BASE, { id: "sesiones", etiqueta: "Número de sesiones", tipo: "number", valor: 3, min: 1, max: 10 }],
      secciones(d) {
        const s = n(d.sesiones, 3, 1, 10);
        return [
          ["Datos generales", `<table><tr><th>Área</th><td>${esc(d.area)}</td><th>Grado</th><td>${esc(d.grado)}</td></tr><tr><th>Tema</th><td>${esc(d.tema)}</td><th>Duración</th><td>${esc(o(d.duracion, "[duración]"))}</td></tr><tr><th>Referente curricular</th><td colspan="3">[Escribe aquí el estándar, DBA o malla que usa tu institución. Verifícalo con tu plan de área.]</td></tr></table>`],
          ["Objetivo de aprendizaje", `<p>${esc(o(d.objetivo, "[Al finalizar, el estudiante podrá …]"))}</p>`],
          ["Secuencia de sesiones", `<table><tr><th>Sesión</th><th>Inicio (exploración)</th><th>Desarrollo</th><th>Cierre y evidencia</th></tr>${Array.from({ length: s }, (_, i) => `<tr><td><b>Sesión ${i + 1}</b></td><td>[Pregunta detonadora o actividad corta]</td><td>[Actividad principal sobre ${esc(d.tema)}]</td><td>[Qué entrega o muestra el estudiante]</td></tr>`).join("")}</table>`],
          ["Recursos", `<ul><li>[Material impreso o digital]</li><li>[Material concreto]</li><li>[Enlaces o textos que ya tienes]</li></ul>`],
          ["Evaluación", `<ul><li>Formativa: [lista de cotejo, ticket de salida]</li><li>Sumativa: [taller, prueba, producto]</li></ul>`],
          ["Ajustes y flexibilización", `<ul><li>[Estudiantes que requieren más apoyo: …]</li><li>[Estudiantes que terminan antes: …]</li><li>[Ajustes según PIAR, si aplica]</li></ul>`],
          ["Observaciones del docente", `<p>[ ]</p>`]
        ];
      }
    },
    guia: {
      nombre: "Guía de aprendizaje", descripcion: "Para trabajo autónomo: qué sé, aprendo, practico, aplico y me evalúo.",
      campos: CAMPOS_BASE,
      secciones(d) {
        return [
          ["Encabezado", `<table><tr><th>Área</th><td>${esc(d.area)}</td><th>Grado</th><td>${esc(d.grado)}</td></tr><tr><th>Tema</th><td>${esc(d.tema)}</td><th>Tiempo sugerido</th><td>${esc(o(d.duracion, "[tiempo]"))}</td></tr><tr><th>Nombre del estudiante</th><td colspan="3">__________________________</td></tr></table>`],
          ["¿Qué voy a aprender?", `<p>${esc(o(d.objetivo, "[Explica en una frase sencilla qué va a lograr el estudiante]"))}</p>`],
          ["1. Para empezar: ¿qué sé?", `<p>[Pregunta o situación cercana al estudiante sobre ${esc(d.tema)}]</p><p>Escribe tu idea: ________________________________</p>`],
          ["2. Aprendo", `<p>[Explicación corta, con un ejemplo. Si el grupo necesita menos texto, usa viñetas o imágenes.]</p>`],
          ["3. Practico", `<ol><li>[Ejercicio guiado]</li><li>[Ejercicio semiguiado]</li><li>[Ejercicio autónomo]</li></ol>`],
          ["4. Aplico", `<p>[Situación problema o reto en contexto real]</p>`],
          ["5. ¿Cómo me fue?", `<table><tr><th>Yo puedo…</th><th>Sí</th><th>Casi</th><th>Todavía no</th></tr><tr><td>[Desempeño 1]</td><td></td><td></td><td></td></tr><tr><td>[Desempeño 2]</td><td></td><td></td><td></td></tr></table>`],
          ["Para el docente", `<p>[Versión de refuerzo: menos ítems, apoyos visuales. Versión de profundización: reto adicional.]</p>`]
        ];
      }
    },
    taller: {
      nombre: "Taller", descripcion: "Actividades graduadas para trabajar en clase, individual o en grupo.",
      campos: [...CAMPOS_BASE, { id: "actividades", etiqueta: "Número de actividades", tipo: "number", valor: 4, min: 1, max: 12 }, { id: "modalidad", etiqueta: "Modalidad", tipo: "select", opciones: ["Individual", "En parejas", "En grupos", "Mixta"] }],
      secciones(d) {
        const a = n(d.actividades, 4, 1, 12);
        return [
          ["Encabezado", `<table><tr><th>Área</th><td>${esc(d.area)}</td><th>Grado</th><td>${esc(d.grado)}</td></tr><tr><th>Tema</th><td>${esc(d.tema)}</td><th>Modalidad</th><td>${esc(o(d.modalidad, "Individual"))}</td></tr></table>`],
          ["Objetivo", `<p>${esc(o(d.objetivo, "[Objetivo del taller]"))}</p>`],
          ["Instrucciones", `<p>[Qué debe hacer el estudiante, con qué materiales y en cuánto tiempo: ${esc(o(d.duracion, "[tiempo]"))}]</p>`],
          ["Actividades", Array.from({ length: a }, (_, i) => `<h4>Actividad ${i + 1} · [nivel: literal / inferencial / crítico, o básico / medio / avanzado]</h4><p>[Consigna]</p><p>______________________________________________</p>`).join("")],
          ["Reto (opcional)", `<p>[Actividad adicional para quienes terminan antes]</p>`],
          ["Criterios de valoración", `<ul><li>[Criterio 1]</li><li>[Criterio 2]</li></ul>`]
        ];
      }
    },
    evaluacion: {
      nombre: "Evaluación", descripcion: "Prueba con desempeños evaluados, ítems por partes y lista de cotejo.",
      campos: [...CAMPOS_BASE, { id: "preguntas", etiqueta: "Número de preguntas", tipo: "number", valor: 6, min: 1, max: 30 }, { id: "formato", etiqueta: "Tipo de preguntas", tipo: "select", opciones: ["Selección múltiple", "Abiertas", "Mixta"] }],
      secciones(d) {
        const q = n(d.preguntas, 6, 1, 30), mixta = (d.formato || "Mixta") === "Mixta";
        const item = (i) => (d.formato === "Abiertas" || (mixta && i % 2 === 1))
          ? `<p><b>${i + 1}.</b> [Pregunta abierta sobre ${esc(d.tema)}]</p><p>________________________________________________</p>`
          : `<p><b>${i + 1}.</b> [Enunciado]</p><p>A. [opción] &nbsp; B. [opción] &nbsp; C. [opción] &nbsp; D. [opción]</p>`;
        return [
          ["Encabezado", `<table><tr><th>Área</th><td>${esc(d.area)}</td><th>Grado</th><td>${esc(d.grado)}</td></tr><tr><th>Tema</th><td>${esc(d.tema)}</td><th>Tiempo</th><td>${esc(o(d.duracion, "[tiempo]"))}</td></tr><tr><th>Nombre</th><td colspan="3">__________________________ &nbsp; Fecha: ________</td></tr></table>`],
          ["Desempeños evaluados", `<ol><li>${esc(o(d.objetivo, "[Desempeño 1]"))}</li><li>[Desempeño 2]</li></ol>`],
          ["Preguntas", Array.from({ length: q }, (_, i) => item(i)).join("")],
          ["Lista de cotejo para el docente", `<table><tr><th>Desempeño</th><th>Lo logra</th><th>En proceso</th><th>Requiere apoyo</th></tr><tr><td>${esc(o(d.objetivo, "[Desempeño 1]"))}</td><td></td><td></td><td></td></tr><tr><td>[Desempeño 2]</td><td></td><td></td><td></td></tr></table>`]
        ];
      }
    },
    rubrica: {
      nombre: "Rúbrica", descripcion: "Criterios por niveles de desempeño, ajustables a la escala de tu institución.",
      campos: [...CAMPOS_BASE.filter((c) => c.id !== "duracion"), { id: "criterios", etiqueta: "Criterios (uno por línea)", tipo: "textarea", placeholder: "Dominio del tema\nOrganización\nExpresión oral" }, { id: "escala", etiqueta: "Niveles", tipo: "select", opciones: ["Superior / Alto / Básico / Bajo", "Excelente / Bueno / Aceptable / Insuficiente", "4 / 3 / 2 / 1"] }],
      secciones(d) {
        const crit = String(d.criterios || "").split("\n").map((s) => s.trim()).filter(Boolean);
        const lista = crit.length ? crit : ["[Criterio 1]", "[Criterio 2]", "[Criterio 3]"];
        const niveles = (d.escala || "Superior / Alto / Básico / Bajo").split("/").map((s) => s.trim());
        return [
          ["Encabezado", `<table><tr><th>Área</th><td>${esc(d.area)}</td><th>Grado</th><td>${esc(d.grado)}</td></tr><tr><th>Producto o desempeño</th><td colspan="3">${esc(d.tema)}</td></tr></table>`],
          ["Objetivo", `<p>${esc(o(d.objetivo, "[Qué se evalúa y para qué]"))}</p>`],
          ["Rúbrica", `<table><tr><th>Criterio</th>${niveles.map((x) => `<th>${esc(x)}</th>`).join("")}<th>Nota</th></tr>${lista.map((c) => `<tr><td><b>${esc(c)}</b></td>${niveles.map(() => `<td>[Descripción observable]</td>`).join("")}<td></td></tr>`).join("")}</table>`],
          ["Observaciones", `<p>[ ]</p>`],
          ["Nota para el docente", `<p>Ajusta los niveles y la escala al sistema de evaluación (SIEE) de tu institución.</p>`]
        ];
      }
    },
    actividad: {
      nombre: "Actividad diferenciada", descripcion: "La misma meta en tres niveles de apoyo: básico, medio y avanzado.",
      campos: CAMPOS_BASE,
      secciones(d) {
        return [
          ["Encabezado", `<table><tr><th>Área</th><td>${esc(d.area)}</td><th>Grado</th><td>${esc(d.grado)}</td></tr><tr><th>Tema</th><td>${esc(d.tema)}</td><th>Duración</th><td>${esc(o(d.duracion, "[tiempo]"))}</td></tr></table>`],
          ["Meta común", `<p>${esc(o(d.objetivo, "[Lo que todos los estudiantes deben lograr]"))}</p>`],
          ["Nivel de apoyo alto (básico)", `<ul><li>Consigna corta, de un paso: [ ]</li><li>Apoyos: pictogramas, ejemplo resuelto, material concreto</li><li>Respuesta por selección o con plantilla</li></ul>`],
          ["Nivel medio", `<ul><li>Consigna: [ ]</li><li>Apoyos: ejemplo parcial, pistas</li><li>Respuesta breve</li></ul>`],
          ["Nivel avanzado (reto)", `<ul><li>Consigna: [ ]</li><li>Sin apoyos adicionales; justificar o crear</li></ul>`],
          ["Cómo agrupar y evaluar", `<p>[Mismo criterio de logro para todos; varía el camino, no la meta.]</p>`]
        ];
      }
    },
    refuerzo: {
      nombre: "Material de refuerzo", descripcion: "Repaso guiado para estudiantes que no alcanzaron el desempeño.",
      campos: [...CAMPOS_BASE, { id: "dificultad", etiqueta: "Dificultad observada", tipo: "textarea", placeholder: "Ej.: confunde numerador y denominador" }],
      secciones(d) {
        return [
          ["Encabezado", `<table><tr><th>Área</th><td>${esc(d.area)}</td><th>Grado</th><td>${esc(d.grado)}</td></tr><tr><th>Tema</th><td>${esc(d.tema)}</td><th>Tiempo</th><td>${esc(o(d.duracion, "[tiempo]"))}</td></tr></table>`],
          ["Desempeño a reforzar", `<p>${esc(o(d.objetivo, "[Desempeño]"))}</p><p><b>Dificultad observada:</b> ${esc(o(d.dificultad, "[ ]"))}</p>`],
          ["1. Recordemos", `<p>[Idea clave en una frase, con un ejemplo resuelto paso a paso]</p>`],
          ["2. Practiquemos juntos", `<ol><li>[Ejercicio con pistas]</li><li>[Ejercicio con pistas]</li></ol>`],
          ["3. Ahora tú", `<ol><li>[Ejercicio]</li><li>[Ejercicio]</li><li>[Ejercicio]</li></ol>`],
          ["4. ¿Qué aprendí?", `<p>Explica con tus palabras: ______________________________</p>`],
          ["Seguimiento del docente", `<table><tr><th>Fecha</th><th>Avance</th><th>Próximo paso</th></tr><tr><td></td><td></td><td></td></tr></table>`]
        ];
      }
    }
  };

  function validar(tipo, datos) {
    const t = TIPOS[tipo]; if (!t) return ["Tipo de plantilla desconocido."];
    return t.campos.filter((c) => c.requerido && !(datos[c.id] || "").toString().trim()).map((c) => `Falta: ${c.etiqueta}.`);
  }

  /** Genera el documento. Devuelve { titulo, html, texto }. */
  function generar(tipo, datos = {}) {
    const t = TIPOS[tipo]; if (!t) throw new Error("Tipo de plantilla desconocido: " + tipo);
    const titulo = `${t.nombre} · ${o(datos.tema, "[tema]")} · ${o(datos.area, "[área]")} ${o(datos.grado, "")}`.trim();
    const secs = t.secciones(datos);
    const html = `<h1>${esc(titulo)}</h1>` + secs.map(([h, cuerpo]) => `<section><h2>${esc(h)}</h2>${cuerpo}</section>`).join("") +
      `<p class="pie-plantilla">Plantilla elaborada por el docente. Los espacios entre [corchetes] se completan y se verifican con el plan de área y las orientaciones de la institución.</p>`;
    return { titulo, html, texto: aTexto(html) };
  }

  /** Versión en texto plano (para copiar) a partir del HTML generado. */
  function aTexto(html) {
    return html
      .replace(/<\/(h1|h2|h4|p|li|tr|section)>/g, "\n")
      .replace(/<\/(th|td)>/g, "\t")
      .replace(/<li>/g, "• ")
      .replace(/<h2>/g, "\n== ").replace(/<h4>/g, "\n-- ")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  /** Documento completo listo para guardar como .doc (Word lo abre) o imprimir. */
  function documentoHtml(titulo, cuerpoHtml) {
    return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>
body{font-family:Calibri,Arial,sans-serif;font-size:12pt;line-height:1.4;color:#1D2433;max-width:19cm;margin:1.5cm auto}
h1{font-size:18pt;color:#2F4D8C;margin:0 0 .5em}h2{font-size:13pt;color:#2F4D8C;border-bottom:2px solid #2F4D8C;margin:1.2em 0 .4em}h4{font-size:12pt;margin:.8em 0 .2em}
table{border-collapse:collapse;width:100%;margin:.4em 0}th,td{border:1px solid #999;padding:5px 7px;text-align:left;vertical-align:top}th{background:#E7EEFB}
.pie-plantilla{font-size:9pt;color:#666;margin-top:2em}</style></head><body>${cuerpoHtml}</body></html>`;
  }

  return { TIPOS, validar, generar, aTexto, documentoHtml };
});
