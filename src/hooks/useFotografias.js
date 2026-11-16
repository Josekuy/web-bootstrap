import { useGaleriaPublica } from "./useGaleriaPublica";

export function useFotografias({ activa = true } = {}) {
  const { elementos, ...consulta } = useGaleriaPublica({
    ruta: "/api/fotografias",
    mensajeError: "No se han podido leer las fotografías del servidor.",
    activa,
  });
  return { ...consulta, fotografias: elementos };
}
