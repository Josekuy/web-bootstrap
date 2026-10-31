import { useSyncExternalStore } from "react";

function leerPreferencia() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function suscribirPreferencia(avisar) {
  const consulta = window.matchMedia("(prefers-reduced-motion: reduce)");
  consulta.addEventListener("change", avisar);
  return () => consulta.removeEventListener("change", avisar);
}

function leerPreferenciaServidor() {
  return true;
}

// React escucha el ajuste del sistema en vivo y libera la suscripción al desmontar.
export function useMovimientoReducido() {
  return useSyncExternalStore(suscribirPreferencia, leerPreferencia, leerPreferenciaServidor);
}
