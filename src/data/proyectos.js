/**
 * @typedef {Object} Proyecto
 * @property {number} id Identificador estable; no representa la posición visual.
 * @property {string} slug Identificador legible y único para una futura ficha.
 * @property {string} titulo Nombre del proyecto.
 * @property {string} descripcion Resumen en texto plano.
 * @property {string} categoria Categoría visible.
 * @property {string[]} tecnologias Tecnologías o herramientas utilizadas.
 * @property {string} imagen Ruta pública o URL de la imagen.
 * @property {string} imagenAlt Descripción accesible; vacío si la imagen es decorativa.
 * @property {number} orden Posición de presentación, de menor a mayor.
 * @property {"publicado" | "borrador"} estado Visibilidad en el portfolio.
 * @property {string | null} urlProyecto URL HTTP(S) real, o null si todavía no existe.
 * @property {string | null} urlRepositorio URL HTTP(S) real, o null si no se publica.
 */

// Se conserva el contenido existente. Las imágenes actuales son ilustrativas:
// no se presentan como capturas reales ni como fotografías propias.
// Más adelante, una API podrá entregar este mismo formato.
/** @type {Proyecto[]} */
export const proyectos = [
  {
    id: 1,
    slug: "rediseno-campus-virtual",
    titulo: "Rediseño Campus Virtual",
    descripcion: "Interfaz moderna y accesible enfocada en la experiencia de usuario educativa.",
    categoria: "UI/UX & Front-End",
    tecnologias: ["React", "Bootstrap", "Figma"],
    imagen: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=600&auto=format&fit=crop",
    imagenAlt: "",
    orden: 1,
    estado: "publicado",
    urlProyecto: null,
    urlRepositorio: null,
  },
  {
    id: 2,
    slug: "sistema-diseno-editorial",
    titulo: "Sistema de Diseño Editorial",
    descripcion: "Automatización de maquetación y estructuración de contenidos complejos para publicaciones.",
    categoria: "Diseño Gráfico",
    tecnologias: ["InDesign", "ExtendScript", "XML"],
    imagen: "https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?q=80&w=600&auto=format&fit=crop",
    imagenAlt: "",
    orden: 2,
    estado: "publicado",
    urlProyecto: null,
    urlRepositorio: null,
  },
  {
    id: 3,
    slug: "landing-page-interactiva",
    titulo: "Landing Page Interactiva",
    descripcion: "Sitio web corporativo optimizado para conversión, velocidad y rendimiento web.",
    categoria: "Web Design",
    tecnologias: ["HTML/CSS", "JavaScript", "Bootstrap"],
    imagen: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=600&auto=format&fit=crop",
    imagenAlt: "",
    orden: 3,
    estado: "publicado",
    urlProyecto: null,
    urlRepositorio: null,
  },
  {
    id: 4,
    slug: "portada-de-disco",
    titulo: "Portada de disco",
    descripcion: "Diseño de portada para álbum musical con enfoque en la estética visual y el mensaje del artista.",
    categoria: "Ilustración & Diseño Gráfico",
    tecnologias: ["Photoshop", "Illustrator", "Indesign", "After Effects"],
    imagen: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop",
    imagenAlt: "",
    orden: 4,
    estado: "publicado",
    urlProyecto: null,
    urlRepositorio: null,
  },
];
