/* =====================================================================
   CONFIGURACIÓN DEL SITIO — Apoyo Docente Personalizado
   ---------------------------------------------------------------------
   Este es el ÚNICO archivo que necesitas editar para cambiar:
   - El número de WhatsApp
   - El nombre de la marca y los textos principales
   - Los servicios, el portafolio y las preguntas frecuentes
   No se necesita saber programar: solo cambia los textos entre comillas.
   ===================================================================== */

window.SITE_CONFIG = {

  /* ---------- 1. IDENTIDAD ---------- */
  marca: {
    nombre: "Aula Organizada",            // Nombre provisional. Cámbialo cuando definas el nombre definitivo.
    lema: "Tu trabajo docente, organizado según tus necesidades.",
    profesional: "Docente especialista",  // Cómo aparece la persona que presta el servicio (sin inventar títulos).
    ciudad: "Colombia",
    // Foto o ilustración de la profesional. Si dejas "" se muestra la ilustración incluida.
    // Ejemplo: "assets/img/perfil.png"
    foto: ""
  },

  /* ---------- 2. CONTACTO ---------- */
  contacto: {
    // Número de WhatsApp en formato internacional, SIN "+", espacios ni guiones. Colombia empieza por 57.
    // PENDIENTE: mientras esté vacío, la página muestra "número pendiente" y ofrece copiar el resumen.
    whatsapp: "",
    correo: "",                           // Opcional. Si lo dejas vacío no se muestra.
    horario: "Lunes a viernes, 8:00 a.m. – 6:00 p.m. (respuesta en máximo 24 horas hábiles)",
    // Mensaje inicial del botón principal de WhatsApp. [necesidad] se reemplaza con lo que elija el docente.
    mensajeInicial: "Hola, quisiera conocer más sobre el servicio de apoyo docente. Necesito ayuda con [necesidad] y me gustaría saber cómo podemos organizar una propuesta personalizada."
  },

  /* ---------- 3. ENVÍO DEL FORMULARIO (opcional) ---------- */
  formulario: {
    // El formulario SIEMPRE funciona generando un resumen y un enlace de WhatsApp (gratis, sin servidor).
    // Si además quieres recibir una copia por correo, crea una cuenta gratuita en https://formspree.io
    // y pega aquí el enlace que te entregan (ej: "https://formspree.io/f/abcdwxyz"). Si queda vacío, no se envía nada por correo.
    endpoint: ""
  },

  /* ---------- 4. ÁREAS DE APOYO (resumen de portada) ---------- */
  areas: [
    { id: "planeacion", icono: "calendar", titulo: "Planeación y organización académica",
      corto: "Planeaciones de clase, periodos, unidades, planes de área y mejoramiento." },
    { id: "material", icono: "book", titulo: "Material pedagógico y didáctico",
      corto: "Guías, talleres, presentaciones, refuerzo y organizadores gráficos." },
    { id: "evaluacion", icono: "check", titulo: "Evaluación y seguimiento",
      corto: "Evaluaciones, rúbricas, listas de cotejo e instrumentos de seguimiento." },
    { id: "inclusion", icono: "heart", titulo: "Inclusión educativa y PIAR",
      corto: "Adaptación de actividades, ajustes razonables y organización del PIAR." },
    { id: "documentacion", icono: "folder", titulo: "Documentación institucional",
      corto: "Formatos, informes, registros y adaptación de plantillas." }
  ],

  /* ---------- 5. SERVICIOS DETALLADOS ---------- */
  servicios: [
    {
      id: "planeacion",
      titulo: "Planeación y organización académica",
      descripcion: "Organizamos lo que vas a enseñar, cuándo y con qué, según el formato que usa tu institución.",
      puedes: [
        "Planeaciones de clase",
        "Planeación por periodos académicos",
        "Organización de unidades y secuencias didácticas",
        "Planes de área y de asignatura",
        "Organización de objetivos, competencias y evidencias de aprendizaje",
        "Distribución de contenidos y actividades",
        "Organización de materiales para cada clase",
        "Planes de mejoramiento académico"
      ],
      sirve: "Para llegar a cada clase con una ruta clara, cumplir con los formatos institucionales y distribuir el tiempo de forma realista.",
      necesitamos: [
        "Grado y asignatura",
        "Tiempo disponible (horas por semana, duración del periodo)",
        "Objetivos o temas que debes cubrir",
        "El formato de planeación que usa tu institución (si existe)"
      ],
      nota: "Las planeaciones se elaboran según el grado, la asignatura, el tiempo disponible, los objetivos y el formato institucional que nos compartas."
    },
    {
      id: "material",
      titulo: "Material pedagógico y didáctico",
      descripcion: "Recursos para trabajar en el aula o en casa, pensados para tus estudiantes y tu forma de enseñar.",
      puedes: [
        "Guías de aprendizaje",
        "Talleres y actividades",
        "Presentaciones para clases",
        "Ejercicios prácticos",
        "Material de refuerzo",
        "Actividades de recuperación",
        "Recursos visuales y organizadores gráficos",
        "Materiales diferenciados según el nivel de aprendizaje"
      ],
      sirve: "Para tener material listo y coherente con tu planeación, sin partir de cero cada semana.",
      necesitamos: [
        "Tema y objetivo de aprendizaje",
        "Grado y características generales del grupo",
        "Formato deseado (Word, PDF, PowerPoint, Canva, etc.)",
        "Materiales que ya tengas y quieras reutilizar"
      ],
      nota: "Cada recurso se diseña para un grupo y un objetivo concretos. No asumimos que un mismo material funciona igual para todos los estudiantes."
    },
    {
      id: "evaluacion",
      titulo: "Evaluación y seguimiento",
      descripcion: "Instrumentos claros para saber qué están aprendiendo tus estudiantes y registrar su avance.",
      puedes: [
        "Evaluaciones y cuestionarios",
        "Rúbricas de evaluación",
        "Listas de cotejo",
        "Indicadores de desempeño",
        "Actividades de refuerzo",
        "Instrumentos para hacer seguimiento al aprendizaje",
        "Informes y formatos de evaluación"
      ],
      sirve: "Para evaluar lo que realmente enseñaste, con criterios transparentes para estudiantes y familias.",
      necesitamos: [
        "Aprendizajes o desempeños que quieres evaluar",
        "Escala o sistema de evaluación de tu institución (SIEE)",
        "Tipo de instrumento que prefieres",
        "Número aproximado de estudiantes o grupos, si es relevante"
      ],
      nota: "Los instrumentos se construyen en función de los aprendizajes que se pretende evaluar y de las orientaciones de tu institución."
    },
    {
      id: "inclusion",
      titulo: "Inclusión educativa y PIAR",
      descripcion: "Apoyo para adaptar materiales y organizar la documentación de los procesos de inclusión.",
      puedes: [
        "Adaptación de guías y actividades",
        "Materiales accesibles y diferenciados",
        "Apoyo en la organización de información para el PIAR",
        "Propuestas de ajustes razonables",
        "Organización de estrategias pedagógicas",
        "Apoyo en el seguimiento de los compromisos educativos"
      ],
      sirve: "Para que los ajustes queden organizados, documentados y conectados con lo que trabajas en clase.",
      necesitamos: [
        "La información pertinente que ya tengan el docente y la institución (sin datos identificables si no es necesario)",
        "Actividades o guías que quieres adaptar",
        "Formato de PIAR o de seguimiento que usa tu institución"
      ],
      nota: "Importante: estos apoyos se construyen únicamente a partir de la información que proporcionan el docente y la institución. No elaboramos ni inventamos diagnósticos, ni reemplazamos la valoración profesional, la participación de la familia ni las responsabilidades institucionales.",
      alerta: true
    },
    {
      id: "documentacion",
      titulo: "Documentación y organización institucional",
      descripcion: "Ponemos en orden los documentos que tu institución te pide, en el formato que te pide.",
      puedes: [
        "Formatos académicos",
        "Informes y registros",
        "Organización de documentos",
        "Materiales para reuniones y seguimiento",
        "Apoyo en la preparación de documentos pedagógicos",
        "Adaptación de plantillas institucionales"
      ],
      sirve: "Para cumplir con entregas institucionales sin sacrificar el tiempo de clase.",
      necesitamos: [
        "El formato o plantilla que debes seguir (cada institución usa el suyo)",
        "La información que debe ir en el documento",
        "Fecha de entrega"
      ],
      nota: "No todas las instituciones usan los mismos formatos. Por eso siempre partimos del formato que tú nos envíes."
    }
  ],

  /* ---------- 6. PORTAFOLIO (ejemplos demostrativos) ----------
     Para agregar un ejemplo real: copia un bloque, cambia los textos y pon la ruta de tu imagen o PDF.
     "imagen": ruta a una captura (ej: "assets/portafolio/guia-ciencias.webp"). Si queda vacío se muestra una vista previa ilustrada.
     "archivo": ruta a un PDF de muestra (ej: "assets/portafolio/guia-ciencias.pdf"). Opcional (se ofrece como descarga).
     "paginas": lista de imágenes, una por página, para ver la muestra completa dentro de la página (ej: ["assets/portafolio/guia-p1.webp","assets/portafolio/guia-p2.webp"]). Opcional.
     "area", "grados", "tipoRecurso", "duracion", "modalidad", "adaptacion": alimentan el buscador y los filtros.
     Usa siempre datos ficticios o anonimizados. Nunca publiques información de estudiantes reales.           */
  portafolio: [
    { categoria: "Planeaciones", nombre: "Planeación semanal de Matemáticas",
      necesidad: "Organizar una semana de clase con objetivos, actividades y evidencias.",
      contexto: "Grado 5° · Básica primaria", tipo: "planeacion",
      area: "Matemáticas", grados: ["5°"], tipoRecurso: "Planeación",
      duracion: "1 semana de clase", modalidad: "Presencial · imprimible", adaptacion: "Incluye casilla de ajustes y flexibilización",
      personalizacion: "Se adapta al formato de tu institución, a las horas semanales y a los DBA o estándares que trabajes.",
      imagen: "assets/portafolio/planeacion-semanal-matematicas-5.webp", archivo: "assets/portafolio/planeacion-semanal-matematicas-5.pdf",
      paginas: ["assets/portafolio/planeacion-semanal-matematicas-5-p1.webp"] },
    { categoria: "Planeaciones", nombre: "Plan de periodo de Lenguaje",
      necesidad: "Distribuir contenidos, competencias y evaluaciones de un periodo completo.",
      contexto: "Grado 8° · Básica secundaria", tipo: "planeacion",
      area: "Lenguaje", grados: ["8°"], tipoRecurso: "Planeación",
      duracion: "10 semanas", modalidad: "Presencial", adaptacion: "Textos graduados y opción oral según PIAR",
      personalizacion: "Ajustable al número de semanas, a la malla curricular y al sistema de evaluación institucional.",
      imagen: "assets/portafolio/plan-periodo-lenguaje-8.webp", archivo: "assets/portafolio/plan-periodo-lenguaje-8.pdf",
      paginas: ["assets/portafolio/plan-periodo-lenguaje-8-p1.webp"] },
    { categoria: "Guías y talleres", nombre: "Guía de aprendizaje: el ciclo del agua",
      necesidad: "Material autónomo con explicación, ejemplos y actividades.",
      contexto: "Grado 4° · Ciencias Naturales", tipo: "guia",
      area: "Ciencias Naturales", grados: ["4°"], tipoRecurso: "Guía",
      duracion: "2 sesiones", modalidad: "Trabajo autónomo · imprimible", adaptacion: "Versión de refuerzo y de profundización",
      personalizacion: "Se puede cambiar el nivel de lectura, el tipo de actividades y agregar versión para refuerzo.",
      imagen: "assets/portafolio/guia-ciclo-del-agua-4.webp", archivo: "assets/portafolio/guia-ciclo-del-agua-4.pdf",
      paginas: ["assets/portafolio/guia-ciclo-del-agua-4-p1.webp", "assets/portafolio/guia-ciclo-del-agua-4-p2.webp"] },
    { categoria: "Guías y talleres", nombre: "Taller de comprensión lectora",
      necesidad: "Ejercitar lectura inferencial con textos cortos y preguntas graduadas.",
      contexto: "Grado 6° · Lenguaje", tipo: "guia",
      area: "Lenguaje", grados: ["6°"], tipoRecurso: "Taller",
      duracion: "1 sesión", modalidad: "Individual · imprimible", adaptacion: "Preguntas graduadas por nivel",
      personalizacion: "Textos y preguntas se eligen según los intereses del grupo y el nivel de desempeño.",
      imagen: "assets/portafolio/taller-comprension-lectora-6.webp", archivo: "assets/portafolio/taller-comprension-lectora-6.pdf",
      paginas: ["assets/portafolio/taller-comprension-lectora-6-p1.webp"] },
    { categoria: "Evaluaciones y rúbricas", nombre: "Rúbrica para exposición oral",
      necesidad: "Evaluar con criterios claros y compartibles con los estudiantes.",
      contexto: "Secundaria · Cualquier área", tipo: "rubrica",
      area: "Cualquier área", grados: ["6°", "7°", "8°", "9°", "10°", "11°"], tipoRecurso: "Rúbrica",
      duracion: "Uso en cada exposición", modalidad: "Evaluación", adaptacion: "Escala ajustable al SIEE",
      personalizacion: "Criterios, niveles y escala se ajustan al SIEE de tu institución.",
      imagen: "assets/portafolio/rubrica-exposicion-oral.webp", archivo: "assets/portafolio/rubrica-exposicion-oral.pdf",
      paginas: ["assets/portafolio/rubrica-exposicion-oral-p1.webp"] },
    { categoria: "Evaluaciones y rúbricas", nombre: "Evaluación de periodo con lista de cotejo",
      necesidad: "Verificar desempeños esperados al cierre del periodo.",
      contexto: "Grado 3° · Matemáticas", tipo: "rubrica",
      area: "Matemáticas", grados: ["3°"], tipoRecurso: "Evaluación",
      duracion: "60 minutos", modalidad: "Evaluación · imprimible", adaptacion: "Ítems por partes y lista de cotejo",
      personalizacion: "Se construye a partir de los desempeños que efectivamente trabajaste en clase.",
      imagen: "assets/portafolio/evaluacion-lista-cotejo-matematicas-3.webp", archivo: "assets/portafolio/evaluacion-lista-cotejo-matematicas-3.pdf",
      paginas: ["assets/portafolio/evaluacion-lista-cotejo-matematicas-3-p1.webp"] },
    { categoria: "Material didáctico", nombre: "Organizador gráfico: causas y consecuencias",
      necesidad: "Recurso visual para estructurar ideas en Sociales.",
      contexto: "Grado 7° · Ciencias Sociales", tipo: "material",
      area: "Ciencias Sociales", grados: ["7°"], tipoRecurso: "Material didáctico",
      duracion: "1 sesión", modalidad: "Individual o en parejas · imprimible", adaptacion: "Se adapta a cualquier tema",
      personalizacion: "Se adapta al tema y se entrega en versión imprimible y digital.",
      imagen: "assets/portafolio/organizador-causas-consecuencias-7.webp", archivo: "assets/portafolio/organizador-causas-consecuencias-7.pdf",
      paginas: ["assets/portafolio/organizador-causas-consecuencias-7-p1.webp"] },
    { categoria: "Inclusión y PIAR", nombre: "Guía adaptada con apoyos visuales",
      necesidad: "Versión diferenciada de una actividad con ajustes razonables.",
      contexto: "Primaria · Adaptación de actividad existente", tipo: "inclusion",
      area: "Ciencias Naturales", grados: ["4°"], tipoRecurso: "Guía adaptada",
      duracion: "2 sesiones", modalidad: "Lectura acompañada · imprimible", adaptacion: "Pictogramas, texto corto, respuesta por selección",
      personalizacion: "Los ajustes se definen a partir de la información que entregan el docente y la institución.",
      imagen: "assets/portafolio/guia-adaptada-apoyos-visuales.webp", archivo: "assets/portafolio/guia-adaptada-apoyos-visuales.pdf",
      paginas: ["assets/portafolio/guia-adaptada-apoyos-visuales-p1.webp"] },
    { categoria: "Inclusión y PIAR", nombre: "Organización de información para el PIAR",
      necesidad: "Ordenar la información disponible en el formato institucional del PIAR.",
      contexto: "Cualquier grado · Formato de la institución", tipo: "inclusion",
      area: "Cualquier área", grados: ["Preescolar", "1°", "2°", "3°", "4°", "5°", "6°", "7°", "8°", "9°", "10°", "11°"], tipoRecurso: "Documento PIAR",
      duracion: "Por periodo", modalidad: "Documento institucional", adaptacion: "Se diligencia con la información de la institución",
      personalizacion: "Trabajamos sobre el formato que use tu institución y con la información que ya exista.",
      imagen: "assets/portafolio/organizacion-informacion-piar.webp", archivo: "assets/portafolio/organizacion-informacion-piar.pdf",
      paginas: ["assets/portafolio/organizacion-informacion-piar-p1.webp"] },
    { categoria: "Documentación institucional", nombre: "Informe de seguimiento académico",
      necesidad: "Registrar avances y acuerdos para entregar a coordinación.",
      contexto: "Cualquier grado · Formato institucional", tipo: "documento",
      area: "Cualquier área", grados: ["Preescolar", "1°", "2°", "3°", "4°", "5°", "6°", "7°", "8°", "9°", "10°", "11°"], tipoRecurso: "Informe",
      duracion: "Por periodo", modalidad: "Documento institucional", adaptacion: "Sobre la plantilla de la institución",
      personalizacion: "Se diligencia sobre la plantilla que nos envíes.",
      imagen: "assets/portafolio/informe-seguimiento-academico.webp", archivo: "assets/portafolio/informe-seguimiento-academico.pdf",
      paginas: ["assets/portafolio/informe-seguimiento-academico-p1.webp"] },
    { categoria: "Presentaciones y recursos visuales", nombre: "Presentación de clase: fracciones",
      necesidad: "Explicar un tema con apoyo visual claro y ejemplos.",
      contexto: "Grado 4° · Matemáticas", tipo: "presentacion",
      area: "Matemáticas", grados: ["4°"], tipoRecurso: "Presentación",
      duracion: "1 clase", modalidad: "Proyección · editable", adaptacion: "Se entrega editable",
      personalizacion: "Se entrega editable (PowerPoint o Canva) para que puedas modificarla.",
      imagen: "assets/portafolio/presentacion-fracciones-4.webp", archivo: "assets/portafolio/presentacion-fracciones-4.pdf",
      paginas: ["assets/portafolio/presentacion-fracciones-4-p1.webp", "assets/portafolio/presentacion-fracciones-4-p2.webp", "assets/portafolio/presentacion-fracciones-4-p3.webp", "assets/portafolio/presentacion-fracciones-4-p4.webp"] }
  ],

  /* ---------- 7. EJEMPLOS DE FLEXIBILIDAD (sección de proceso) ---------- */
  ejemplosFlexibilidad: [
    { titulo: "Solo una semana", texto: "Un docente que solo necesita una planeación para una semana puede solicitar ese trabajo puntual." },
    { titulo: "Un periodo completo", texto: "Un docente que requiere organizar un periodo académico puede solicitar un conjunto de planeaciones y materiales." },
    { titulo: "Adaptar actividades", texto: "Un docente que necesita adaptar actividades puede solicitar apoyo específico en inclusión educativa." },
    { titulo: "Mejorar lo que ya tiene", texto: "Un docente que ya tiene sus materiales elaborados, pero necesita mejorarlos, puede solicitar revisión y ajustes." }
  ],

  /* ---------- 8. MODALIDADES ORIENTATIVAS (sin precios fijos) ---------- */
  modalidades: [
    { titulo: "Trabajo puntual", icono: "bolt",
      texto: "Un solo entregable: una planeación, una guía, una rúbrica, un informe.",
      ejemplo: "Ej.: planeación de una semana o una evaluación de periodo." },
    { titulo: "Conjunto de materiales", icono: "layers",
      texto: "Varios entregables relacionados para una unidad o un periodo.",
      ejemplo: "Ej.: planeaciones + guías + evaluación de un periodo." },
    { titulo: "Acompañamiento por tiempo", icono: "clock",
      texto: "Apoyo continuo durante un plazo acordado (semanas o un periodo), con entregas programadas.",
      ejemplo: "Ej.: apoyo semanal durante un periodo académico." },
    { titulo: "Revisión y ajustes", icono: "edit",
      texto: "Tú ya tienes el material; lo revisamos, corregimos y mejoramos.",
      ejemplo: "Ej.: ajustar guías existentes al nuevo formato institucional." }
  ],

  /* ---------- 9. PREGUNTAS FRECUENTES ---------- */
  faq: [
    { p: "¿Tengo que contratar un paquete completo?",
      r: "No. Puedes solicitar un solo trabajo puntual o un acompañamiento más amplio. El alcance se define contigo, según lo que realmente necesitas." },
    { p: "¿Cómo se define el precio?",
      r: "Cada cotización es personalizada. Se tiene en cuenta la cantidad de materiales, la complejidad, los grados y asignaturas, el formato, el nivel de adaptación, el plazo, las revisiones y la duración del acompañamiento. Antes de comenzar recibes una propuesta con entregables, plazo, precio y condiciones." },
    { p: "¿Qué pasa si no sé exactamente qué necesito?",
      r: "Es muy común. En el formulario puedes marcar que deseas orientación. Conversamos sobre tu situación y te proponemos opciones." },
    { p: "¿Trabajan con el formato de mi institución?",
      r: "Sí. Siempre partimos del formato o plantilla que nos envíes. No asumimos que todas las instituciones usan los mismos documentos." },
    { p: "¿Cuántas revisiones incluye un trabajo?",
      r: "Se acuerdan en la propuesta antes de comenzar. Normalmente se incluye al menos una ronda de ajustes sobre lo acordado; los cambios de alcance se cotizan aparte." },
    { p: "¿Qué pasa con mis documentos y la información de mis estudiantes?",
      r: "Los documentos que compartes se usan solo para elaborar tu trabajo y se tratan de forma confidencial. Te recomendamos no enviar datos identificables de estudiantes si no son necesarios." },
    { p: "¿El material reemplaza mi trabajo como docente?",
      r: "No. Es un apoyo profesional para organizar, preparar y adaptar tu trabajo pedagógico. Tú defines lo que necesitas, validas el resultado y lo revisas antes de usarlo en tu institución." },
    { p: "¿Cómo envío archivos o formatos?",
      r: "Por WhatsApp o por correo, después de enviar el formulario. El sitio no almacena archivos; así protegemos tu información." },
    { p: "¿Cuánto tiempo tarda un trabajo?",
      r: "Depende del alcance. El plazo se acuerda en la propuesta. Si tienes una fecha límite cercana, indícala en el formulario para revisar si es viable." }
  ]
};
