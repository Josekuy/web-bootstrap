/**
 * @typedef {Object} Ilustracion
 * @property {number} id Identificador estable de la ilustración.
 * @property {string} titulo Título de la ilustración.
 * @property {string} descripcion Texto de acompañamiento; puede estar vacío.
 * @property {string} imagen Ruta pública o URL de una ilustración propia autorizada.
 * @property {string} imagenAlt Descripción accesible del contenido de la ilustración.
 * @property {number} orden Posición de presentación, de menor a mayor.
 * @property {"publicado" | "borrador"} estado Visibilidad en la galería pública.
 * @property {number} ancho Ancho de la imagen procesada, en píxeles.
 * @property {number} alto Alto de la imagen procesada, en píxeles.
 * @property {string} creadoEn Fecha de creación que devuelve la API.
 * @property {string} actualizadoEn Fecha de la última edición que devuelve la API.
 */

// La galería utiliza ahora la API. Esta colección vacía queda como referencia para pruebas.
/** @type {Ilustracion[]} */
export const ilustraciones = [];
