/* =====================================================================
   CONFIGURACIÓN DEL PORTAL — un solo lugar para la marca y las pestañas
   ---------------------------------------------------------------------
   Para agregar una sección nueva (un curso, otro producto): copia un bloque
   de "secciones", cambia los textos y la carpeta, y vuelve a ejecutar
   vuelve a publicar. La pestaña aparece sola en la portada y en la barra.
   El portal se sirve en /portal/ dentro del mismo sitio de la app ICFES.
   ===================================================================== */
window.PORTAL_CONFIG = {
  marca: {
    nombre: "Tu Marca",                    // Nombre provisional, cámbialo aquí
    lema: "Tres servicios, una sola casa.",
    pregunta: "¿Qué estás buscando hoy?"
  },
  secciones: [
    {
      id: "icfes", carpeta: "../"   /* la app ICFES vive en la raíz del sitio */, nombre: "ICFES", color: "#2F4D8C",
      publico: "Estudiantes y familias",
      titulo: "Prepárate para el ICFES",
      texto: "Simulacros, preguntas explicadas y modo carrera para priorizar materias.",
      boton: "Entrar a ICFES", icono: "test"
    },
    {
      id: "docentes", carpeta: "docentes/", nombre: "Apoyo docente", color: "#F4845F",
      publico: "Docentes",
      titulo: "Apoyo docente personalizado",
      texto: "Planeaciones, guías, rúbricas y PIAR según tu grado, tu área y tu tiempo.",
      boton: "Entrar a Apoyo docente", icono: "calendar"
    },
    {
      id: "tienda", carpeta: "tienda/", nombre: "Tienda", color: "#1E9E7A",
      publico: "Compradores y emprendedores",
      titulo: "Tienda de productos",
      texto: "Catálogo con pedidos por WhatsApp. Productos útiles, listos para pedir hoy.",
      boton: "Ver catálogo", icono: "bag"
    }
  ]
};
