import { validarIdGaleria, validarMetadatosGaleria } from "../galerias/validacion.js";

export { validarPaginacion } from "../galerias/validacion.js";
export const validarIdFotografia = (valor) => validarIdGaleria(valor, "fotografias");
export const validarMetadatosFotografia = (cuerpo, opciones) => validarMetadatosGaleria(cuerpo, opciones, "fotografias");
