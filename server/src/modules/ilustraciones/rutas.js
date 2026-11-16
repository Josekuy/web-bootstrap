import { crearRutasGaleria } from "../galerias/rutas.js";

export function crearRutasIlustraciones(opciones) {
  return crearRutasGaleria({ ...opciones, recurso: "ilustraciones" });
}
