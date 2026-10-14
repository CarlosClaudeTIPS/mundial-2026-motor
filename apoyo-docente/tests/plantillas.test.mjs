import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const P = require("../assets/js/plantillas.js");

test("existen los 7 tipos y cada uno genera secciones", () => {
  assert.deepEqual(Object.keys(P.TIPOS), ["plan", "guia", "taller", "evaluacion", "rubrica", "actividad", "refuerzo"]);
  for (const t of Object.keys(P.TIPOS)) {
    const r = P.generar(t, { area: "Matemáticas", grado: "5°", tema: "Fracciones" });
    assert.match(r.titulo, /Fracciones/);
    assert.ok((r.html.match(/<section>/g) || []).length >= 4, t + " tiene pocas secciones");
    assert.ok(r.texto.length > 100);
  }
});

test("validar exige área, grado y tema", () => {
  assert.deepEqual(P.validar("plan", {}), ["Falta: Asignatura o área.", "Falta: Grado.", "Falta: Tema."]);
  assert.deepEqual(P.validar("plan", { area: "L", grado: "8°", tema: "Crónica" }), []);
});

test("plan de clase respeta el número de sesiones y lo acota", () => {
  const r = P.generar("plan", { area: "L", grado: "8°", tema: "Crónica", sesiones: "4" });
  assert.equal((r.html.match(/Sesión \d/g) || []).length, 4);
  assert.equal((P.generar("plan", { area: "L", grado: "8°", tema: "x", sesiones: "99" }).html.match(/Sesión \d+/g) || []).length, 10);
});

test("rúbrica usa los criterios y niveles indicados", () => {
  const r = P.generar("rubrica", { area: "L", grado: "8°", tema: "Exposición", criterios: "Dominio\nOrganización", escala: "4 / 3 / 2 / 1" });
  assert.match(r.html, /<b>Dominio<\/b>/);
  assert.equal((r.html.match(/<th>[1-4]<\/th>/g) || []).length, 4);
});

test("los datos del docente se escapan (sin inyección de HTML)", () => {
  const r = P.generar("guia", { area: "<script>alert(1)</script>", grado: "5°", tema: "x" });
  assert.ok(!r.html.includes("<script>"));
  assert.ok(r.html.includes("&lt;script&gt;"));
});

test("evaluación mixta alterna selección múltiple y abiertas", () => {
  const r = P.generar("evaluacion", { area: "M", grado: "3°", tema: "Sumas", preguntas: "4", formato: "Mixta" });
  assert.equal((r.html.match(/A\. \[opción\]/g) || []).length, 2);
  assert.equal((r.html.match(/Pregunta abierta/g) || []).length, 2);
});

test("no inventa referentes oficiales: deja el espacio marcado", () => {
  const r = P.generar("plan", { area: "M", grado: "3°", tema: "Sumas" });
  assert.match(r.html, /\[Escribe aquí el estándar, DBA o malla/);
  assert.ok(!/aprobado por el Ministerio/i.test(r.html));
});

test("documentoHtml produce un documento completo con el título", () => {
  const d = P.documentoHtml("Mi plan", "<p>hola</p>");
  assert.match(d, /^<!DOCTYPE html>/); assert.match(d, /<title>Mi plan<\/title>/); assert.match(d, /<p>hola<\/p>/);
});
