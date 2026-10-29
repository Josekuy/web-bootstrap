/**
 * @typedef {Object} Fotografia
 * @property {number} id Identificador estable de la fotografía.
 * @property {string} titulo Título de la fotografía.
 * @property {string} descripcion Texto de acompañamiento; puede estar vacío.
 * @property {string} imagen Ruta pública o URL de una fotografía propia autorizada.
 * @property {string} imagenAlt Descripción accesible del contenido de la fotografía.
 * @property {number} orden Posición de presentación, de menor a mayor.
 * @property {"publicado" | "borrador"} estado Visibilidad en la galería pública.
 */

// La galería empieza vacía hasta incorporar fotografías propias.
// No se emplean imágenes de ejemplo como si fueran trabajos personales.
/** @type {Fotografia[]} */
export const fotografias = [];
