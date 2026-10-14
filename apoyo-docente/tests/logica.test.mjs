import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const L = require("../assets/js/logica.js");

test("whatsappConfigurado rechaza vacío y número de demostración", () => {
  assert.equal(L.whatsappConfigurado(""), false);
  assert.equal(L.whatsappConfigurado("573000000000"), false);
  assert.equal(L.whatsappConfigurado("57 300 123 4567"), true);
});

test("waUrl limpia el número y codifica el texto", () => {
  assert.equal(L.waUrl("+57 300-123-4567", "hola ¿qué tal?"), "https://wa.me/573001234567?text=hola%20%C2%BFqu%C3%A9%20tal%3F");
});

test("waMessage reemplaza [necesidad] y usa valor por defecto", () => {
  assert.equal(L.waMessage("Necesito [necesidad].", "una rúbrica"), "Necesito una rúbrica.");
  assert.equal(L.waMessage("Necesito [necesidad].", ""), "Necesito mi trabajo docente.");
});

test("waTextoDesde distingue frase (mayúscula) de necesidad corta", () => {
  assert.equal(L.waTextoDesde("Ayuda con [necesidad]", "planeación"), "Ayuda con planeación");
  assert.equal(L.waTextoDesde("Ayuda con [necesidad]", "Quiero ver un ejemplo"), "Ayuda con mi trabajo docente\n\nQuiero ver un ejemplo.");
});

test("resumenDesdeFormulario solo incluye campos diligenciados", () => {
  const fd = new FormData();
  fd.append("nombre", " Profe Ana "); fd.append("grados", "4°–5°"); fd.append("grados", "6°–7°"); fd.append("apoyo", "Planeación"); fd.append("descripcion", "x");
  const d = L.resumenDesdeFormulario(fd);
  assert.deepEqual(d, { "Nombre / contacto": "Profe Ana", "Grados": "4°–5°, 6°–7°", "Tipo de apoyo": "Planeación", "Descripción de la necesidad": "x" });
  assert.match(L.textoResumen(d), /• Grados: 4°–5°, 6°–7°/);
});

test("validarPaso devuelve mensajes claros", () => {
  assert.match(L.validarPaso(1, { nombre: "" }), /nombre/);
  assert.match(L.validarPaso(1, { nombre: "Ana", correo: "malo" }), /correo/);
  assert.equal(L.validarPaso(1, { nombre: "Ana", correo: "a@b.co" }), "");
  assert.match(L.validarPaso(3, { apoyo: [] }), /al menos una/);
  assert.equal(L.validarPaso(5, { consentimiento: true }), "");
});

const items = [
  { nombre: "Planeación semanal de Matemáticas", categoria: "Planeaciones", area: "Matemáticas", grados: ["5°"], tipoRecurso: "Planeación", necesidad: "Organizar una semana" },
  { nombre: "Guía: el ciclo del agua", categoria: "Guías y talleres", area: "Ciencias Naturales", grados: ["4°"], tipoRecurso: "Guía", necesidad: "Material autónomo" },
  { nombre: "Rúbrica exposición oral", categoria: "Evaluaciones y rúbricas", area: "Cualquier área", grados: ["6°", "7°", "8°", "9°"], tipoRecurso: "Rúbrica", necesidad: "Evaluar con criterios" },
];
test("filtrarRecursos por texto sin tildes, categoría, área y grado", () => {
  assert.equal(L.filtrarRecursos(items, { q: "matematicas" }).length, 1);
  assert.equal(L.filtrarRecursos(items, { q: "rubrica criterios" })[0].tipoRecurso, "Rúbrica");
  assert.equal(L.filtrarRecursos(items, { categoria: "Guías y talleres" }).length, 1);
  assert.equal(L.filtrarRecursos(items, { grado: "7°" }).length, 1);
  assert.equal(L.filtrarRecursos(items, { area: "Matemáticas", grado: "4°" }).length, 0);
  assert.equal(L.filtrarRecursos(items, {}).length, 3);
});
test("opciones devuelve valores únicos, incluidos campos lista", () => {
  assert.deepEqual(L.opciones(items, "grados"), ["5°", "4°", "6°", "7°", "8°", "9°"]);
  assert.deepEqual(L.opciones(items, "area"), ["Matemáticas", "Ciencias Naturales", "Cualquier área"]);
});
