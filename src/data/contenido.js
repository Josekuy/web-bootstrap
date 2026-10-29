/**
 * @typedef {Object} ElementoNavegacion
 * @property {string} etiqueta Texto del enlace.
 * @property {string} href Ancla de una sección existente, empezando por #.
 *
 * @typedef {Object} TextoSeccion
 * @property {string} etiqueta Texto breve que identifica la sección.
 * @property {string} titulo Encabezado de la sección.
 * @property {string} descripcion Contenido en texto plano.
 *
 * @typedef {Object} Presentacion
 * @property {string} especialidad Texto introductorio del Hero.
 * @property {[string, string]} titulo Las dos líneas del título, unidas visualmente por +.
 * @property {string} descripcion Presentación en texto plano.
 * @property {{etiqueta: string, href: string}} accion Enlace a una sección del portfolio.
 *
 * @typedef {Object} EnlaceContacto
 * @property {string} id Identificador estable del enlace.
 * @property {string} etiqueta Texto visible, por ejemplo el nombre de una red profesional.
 * @property {string} url URL absoluta HTTP(S), sin credenciales.
 *
 * @typedef {Object} DatosContacto
 * @property {string} etiqueta Texto breve que identifica la sección.
 * @property {string} titulo Encabezado de la sección.
 * @property {string} descripcion Texto de introducción al contacto.
 * @property {string | null} correo Correo público autorizado, sin parámetros de mailto.
 * @property {EnlaceContacto[]} enlaces Perfiles o vías de contacto confirmados.
 */

/** @type {ElementoNavegacion[]} */
export const navegacion = [
  { etiqueta: "Proyectos", href: "#proyectos" },
  { etiqueta: "Sobre mí", href: "#sobre-mi" },
  { etiqueta: "Fotografía", href: "#fotografia" },
  { etiqueta: "Contacto", href: "#contacto" },
];

/** @type {Presentacion} */
export const presentacion = {
  especialidad: "Diseño gráfico · Desarrollo web",
  titulo: ["Diseño", "Código"],
  descripcion: "Creo experiencias digitales donde el diseño gráfico se encuentra con el desarrollo web.",
  accion: { etiqueta: "Ver proyectos", href: "#proyectos" },
};

// Texto provisional solicitado hasta disponer de una biografía confirmada.
/** @type {TextoSeccion} */
export const sobreMi = {
  etiqueta: "Perfil",
  titulo: "Sobre mí",
  descripcion: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
};

// No se inventan correos ni perfiles: añadir únicamente datos públicos confirmados.
/** @type {DatosContacto} */
export const contacto = {
  etiqueta: "Contacto",
  titulo: "Hablemos",
  descripcion: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
  correo: null,
  enlaces: [],
};
