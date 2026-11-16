// Los nombres de tabla y de ruta nunca proceden de una petición.
const RECURSOS = Object.freeze({
  fotografias: Object.freeze({
    tabla: "fotografias",
    singular: "fotografía",
    codigoNoEncontrada: "FOTOGRAFIA_NO_ENCONTRADA",
  }),
  ilustraciones: Object.freeze({
    tabla: "ilustraciones",
    singular: "ilustración",
    codigoNoEncontrada: "ILUSTRACION_NO_ENCONTRADA",
  }),
});

export function obtenerRecursoGaleria(recurso) {
  if (typeof recurso !== "string" || !Object.hasOwn(RECURSOS, recurso)) {
    throw new TypeError("La galería solicitada no está permitida.");
  }
  return RECURSOS[recurso];
}
