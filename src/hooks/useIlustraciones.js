import { useGaleriaPublica } from "./useGaleriaPublica";

export function useIlustraciones({ activa = true } = {}) {
  const { elementos, ...consulta } = useGaleriaPublica({
    ruta: "/api/ilustraciones",
    mensajeError: "No se han podido leer las ilustraciones del servidor.",
    activa,
  });
  return { ...consulta, ilustraciones: elementos };
}
