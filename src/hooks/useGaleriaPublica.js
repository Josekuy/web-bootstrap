import { useEffect, useState } from "react";
import { solicitarApi } from "../services/api";

const limitePagina = 12;

// Ilustración y Fotografía comparten paginación, pero conservan colecciones y rutas propias.
export function useGaleriaPublica({ ruta, mensajeError, activa = true }) {
  const [paginaSolicitada, establecerPaginaSolicitada] = useState(1);
  const [intento, establecerIntento] = useState(0);
  const [estado, establecerEstado] = useState({
    elementos: [], pagina: 0, total: 0, cargando: activa, error: "",
  });

  useEffect(() => {
    if (!activa) return;
    const controlador = new AbortController();

    async function cargarPagina() {
      try {
        const respuesta = await solicitarApi(
          `${ruta}?pagina=${paginaSolicitada}&limite=${limitePagina}`,
          { signal: controlador.signal },
        );
        if (controlador.signal.aborted) return;
        if (!Array.isArray(respuesta.datos) || respuesta.meta?.pagina !== paginaSolicitada
          || !Number.isSafeInteger(respuesta.meta?.total) || respuesta.meta.total < 0) {
          throw new Error(mensajeError);
        }

        establecerEstado((anterior) => {
          const anteriores = paginaSolicitada === 1 ? [] : anterior.elementos;
          const identificadores = new Set(anteriores.map((elemento) => elemento.id));
          const nuevos = respuesta.datos.filter((elemento) => {
            if (identificadores.has(elemento.id)) return false;
            identificadores.add(elemento.id);
            return true;
          });
          return {
            elementos: [...anteriores, ...nuevos],
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
  }, [activa, ruta, mensajeError, paginaSolicitada, intento]);

  function cargarMas() {
    if (estado.cargando || estado.pagina * limitePagina >= estado.total) return;
    establecerEstado((anterior) => ({ ...anterior, cargando: true, error: "" }));
    establecerPaginaSolicitada(estado.pagina + 1);
  }

  function reintentar() {
    if (estado.cargando) return;
    establecerEstado((anterior) => ({ ...anterior, cargando: true, error: "" }));
    establecerIntento((anterior) => anterior + 1);
  }

  return { ...estado, hayMas: estado.pagina * limitePagina < estado.total, cargarMas, reintentar };
}
