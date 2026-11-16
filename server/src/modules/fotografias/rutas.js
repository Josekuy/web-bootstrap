import { crearRutasGaleria } from "../galerias/rutas.js";

export function crearRutasFotografias(opciones) {
  return crearRutasGaleria({ ...opciones, recurso: "fotografias" });
}
