/**
 * @typedef {Object} Proyecto
 * @property {number} id Identificador estable; no representa la posición visual.
 * @property {string} slug Identificador legible y único para una futura ficha.
 * @property {string} titulo Nombre del proyecto.
 * @property {string} descripcion Resumen en texto plano.
 * @property {string} categoria Categoría visible.
 * @property {string[]} tecnologias Tecnologías o herramientas utilizadas.
 * @property {string} imagen Ruta pública o URL de la imagen.
 * @property {string | null} imagenExterna URL HTTPS si no se ha subido un archivo propio.
 * @property {string} imagenAlt Descripción accesible; vacío si la imagen es decorativa.
 * @property {number} orden Posición de presentación, de menor a mayor.
 * @property {"publicado" | "borrador"} estado Visibilidad en el portfolio.
 * @property {string | null} urlProyecto URL HTTP(S) real, o null si todavía no existe.
 * @property {string | null} urlRepositorio URL HTTP(S) real, o null si no se publica.
 * @property {number | null} ancho Ancho de la imagen subida; null para imágenes externas.
 * @property {number | null} alto Alto de la imagen subida; null para imágenes externas.
 * @property {string} creadoEn Fecha de creación que entrega la API.
 * @property {string} actualizadoEn Fecha de la última edición que entrega la API.
 */

// Contrato de la API. Los datos se guardan en MySQL y se editan desde /admin.
export {};
