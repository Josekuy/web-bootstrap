import { validarIdGaleria, validarMetadatosGaleria } from "../galerias/validacion.js";

export { validarPaginacion } from "../galerias/validacion.js";
export const validarIdIlustracion = (valor) => validarIdGaleria(valor, "ilustraciones");
export const validarMetadatosIlustracion = (cuerpo, opciones) => validarMetadatosGaleria(cuerpo, opciones, "ilustraciones");
