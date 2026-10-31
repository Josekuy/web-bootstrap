import { useEffect, useState } from "react";
import { solicitarApi } from "../services/api";

// Cada petición pertenece a un efecto: al desmontar o cambiar de página se cancela.
export function useFotografias({ activa = true } = {}) {
  const [paginaSolicitada, establecerPaginaSolicitada] = useState(1);
  const [intento, establecerIntento] = useState(0);
  const [estado, establecerEstado] = useState({
    fotografias: [], pagina: 0, total: 0, cargando: activa, error: "",
  });

  useEffect(() => {
    if (!activa) return;
    const controlador = new AbortController();

    async function cargarPagina() {
      try {
        const respuesta = await solicitarApi(
          `/api/fotografias?pagina=${paginaSolicitada}&limite=12`,
          { signal: controlador.signal }
        );
        if (controlador.signal.aborted) return;
        if (!Array.isArray(respuesta.datos) || !respuesta.meta) {
          throw new Error("No se han podido leer las fotografías del servidor.");
        }

        establecerEstado((anterior) => {
          const anteriores = paginaSolicitada === 1 ? [] : anterior.fotografias;
          const identificadores = new Set(anteriores.map((fotografia) => fotografia.id));
          return {
            fotografias: [
              ...anteriores,
              ...respuesta.datos.filter((fotografia) => !identificadores.has(fotografia.id)),
            ],
            pagina: respuesta.meta.pagina,
            total: respuesta.meta.total,
            cargando: false,
            error: "",
          };
        });
      } catch (error) {
        if (controlador.signal.aborted || error.name === "AbortError") return;
        establecerEstado((anterior) => ({ ...anterior, cargando: false, error: error.message }));
      }
    }

    cargarPagina();
    return () => controlador.abort();
  }, [activa, paginaSolicitada, intento]);

  function cargarMas() {
    if (estado.cargando || estado.pagina * 12 >= estado.total) return;
    establecerEstado((anterior) => ({ ...anterior, cargando: true, error: "" }));
    establecerPaginaSolicitada(estado.pagina + 1);
  }

  function reintentar() {
    if (estado.cargando) return;
    establecerEstado((anterior) => ({ ...anterior, cargando: true, error: "" }));
    establecerIntento((anterior) => anterior + 1);
  }

  return { ...estado, hayMas: estado.pagina * 12 < estado.total, cargarMas, reintentar };
}
