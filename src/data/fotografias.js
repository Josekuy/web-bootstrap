/**
 * @typedef {Object} Fotografia
 * @property {number} id Identificador estable de la fotografía.
 * @property {string} titulo Título de la fotografía.
 * @property {string} descripcion Texto de acompañamiento; puede estar vacío.
 * @property {string} imagen Ruta pública o URL de una fotografía propia autorizada.
 * @property {string} imagenAlt Descripción accesible del contenido de la fotografía.
 * @property {number} orden Posición de presentación, de menor a mayor.
 * @property {"publicado" | "borrador"} estado Visibilidad en la galería pública.
 * @property {number} ancho Ancho de la imagen procesada, en píxeles.
 * @property {number} alto Alto de la imagen procesada, en píxeles.
 * @property {string} creadoEn Fecha de creación que devuelve la API.
 * @property {string} actualizadoEn Fecha de la última edición que devuelve la API.
 */

// La galería utiliza ahora la API. Esta colección vacía queda como referencia para pruebas.
/** @type {Fotografia[]} */
export const fotografias = [];
