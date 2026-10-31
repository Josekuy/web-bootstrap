import { useEffect, useRef, useState } from "react";
import { solicitarApi } from "../services/api";
import FormularioProyecto from "./FormularioProyecto";
import ListadoProyectos from "./ListadoProyectos";

function GestionProyectos({ activo = false, bloqueado = false, csrfToken, alRecuperarAcceso, alCambiarOcupado }) {
  const [pagina, establecerPagina] = useState(1);
  const [revisionListado, establecerRevisionListado] = useState(0);
  const [listado, establecerListado] = useState({
    datos: [], meta: { pagina: 1, limite: 20, total: 0 }, cargando: true, error: "",
  });
  const [proyectoEditado, establecerProyectoEditado] = useState(null);
  const [revisionFormulario, establecerRevisionFormulario] = useState(0);
  const [operacion, establecerOperacion] = useState("");
  const [errorOperacion, establecerErrorOperacion] = useState("");
  const [mensajeExito, establecerMensajeExito] = useState("");
  const referenciaOperacion = useRef(null);
  const referenciaError = useRef(null);
  const referenciaExito = useRef(null);
  const ocupado = Boolean(operacion) || bloqueado;

  useEffect(() => {
    if (!activo) return;
    const controlador = new AbortController();

    async function cargarListado() {
      establecerListado((anterior) => ({ ...anterior, cargando: true, error: "" }));
      try {
        const respuesta = await solicitarApi(`/api/admin/proyectos?pagina=${pagina}&limite=20`, {
          signal: controlador.signal,
        });
        if (controlador.signal.aborted) return;
        if (!Array.isArray(respuesta.datos) || !respuesta.meta) {
          throw new Error("No se ha podido leer el listado de proyectos.");
        }
        const ultimaPagina = Math.max(1, Math.ceil(respuesta.meta.total / respuesta.meta.limite));
        if (pagina > ultimaPagina) {
          establecerPagina(ultimaPagina);
          return;
        }
        establecerListado({ datos: respuesta.datos, meta: respuesta.meta, cargando: false, error: "" });
      } catch (error) {
        if (controlador.signal.aborted || error.name === "AbortError") return;
        const recuperado = await alRecuperarAcceso(error, controlador.signal);
        if (!controlador.signal.aborted) {
          establecerListado((anterior) => ({ ...anterior, cargando: false, error: recuperado ? "" : error.message }));
        }
      }
    }

    // Cambiar de pestaña cancela la lectura; mantener el componente conserva el formulario.
    cargarListado();
    return () => controlador.abort();
  }, [activo, pagina, revisionListado, alRecuperarAcceso]);

  useEffect(() => () => referenciaOperacion.current?.abort(), []);
  useEffect(() => { if (activo && errorOperacion) referenciaError.current?.focus(); }, [activo, errorOperacion]);
  useEffect(() => { if (activo && mensajeExito) referenciaExito.current?.focus(); }, [activo, mensajeExito]);

  function comenzarOperacion(nombre) {
    if (!activo || bloqueado || referenciaOperacion.current) return null;
    const controlador = new AbortController();
    referenciaOperacion.current = controlador;
    establecerOperacion(nombre);
    alCambiarOcupado(true);
    establecerErrorOperacion("");
    establecerMensajeExito("");
    return controlador;
  }

  function terminarOperacion(controlador) {
    if (referenciaOperacion.current === controlador) {
      referenciaOperacion.current = null;
      if (!controlador.signal.aborted) establecerOperacion("");
      alCambiarOcupado(false);
    }
  }

  function limpiarFormulario() {
    establecerProyectoEditado(null);
    establecerRevisionFormulario((anterior) => anterior + 1);
    establecerErrorOperacion("");
  }

  function editarProyecto(proyecto) {
    establecerProyectoEditado(proyecto);
    establecerRevisionFormulario((anterior) => anterior + 1);
    establecerErrorOperacion("");
    establecerMensajeExito("");
  }

  function informarResultadoIncierto(error) {
    if (error.estado !== 503 || error.codigo !== "GUARDADO_NO_CONFIRMADO") return false;
    // No repetimos una escritura cuyo commit podría haberse aplicado.
    establecerErrorOperacion("No se ha podido confirmar el resultado. El listado se está actualizando: comprueba si la operación se aplicó antes de repetirla. Tus cambios se conservan en el formulario.");
    establecerPagina(1);
    establecerRevisionListado((anterior) => anterior + 1);
    return true;
  }

  async function guardarProyecto(formulario) {
    const controlador = comenzarOperacion("guardar");
    if (!controlador) return false;
    try {
      const ruta = proyectoEditado ? `/api/admin/proyectos/${proyectoEditado.id}` : "/api/admin/proyectos";
      const respuesta = await solicitarApi(ruta, {
        method: proyectoEditado ? "PUT" : "POST", body: formulario, csrfToken, signal: controlador.signal,
      });
      if (controlador.signal.aborted) return false;
      limpiarFormulario();
      establecerMensajeExito(`«${respuesta.datos.titulo}» se ha guardado como ${respuesta.datos.estado === "publicado" ? "publicado" : "borrador"}.`);
      establecerPagina(1);
      establecerRevisionListado((anterior) => anterior + 1);
      return true;
    } catch (error) {
      if (controlador.signal.aborted || error.name === "AbortError") return false;
      if (informarResultadoIncierto(error)) return false;
      const recuperado = await alRecuperarAcceso(error, controlador.signal);
      if (!controlador.signal.aborted && !recuperado) establecerErrorOperacion(error.message);
      return false;
    } finally {
      terminarOperacion(controlador);
    }
  }

  async function eliminarProyecto(proyecto) {
    const controlador = comenzarOperacion("eliminar");
    if (!controlador) return false;
    try {
      await solicitarApi(`/api/admin/proyectos/${proyecto.id}`, {
        method: "DELETE", csrfToken, signal: controlador.signal,
      });
      if (controlador.signal.aborted) return false;
      if (proyectoEditado?.id === proyecto.id) limpiarFormulario();
      establecerMensajeExito(`Se ha eliminado «${proyecto.titulo}».`);
      const ultimaPagina = Math.max(1, Math.ceil((listado.meta.total - 1) / listado.meta.limite));
      establecerPagina((anterior) => Math.min(anterior, ultimaPagina));
      establecerRevisionListado((anterior) => anterior + 1);
      return true;
    } catch (error) {
      if (controlador.signal.aborted || error.name === "AbortError") return false;
      if (informarResultadoIncierto(error)) return false;
      const recuperado = await alRecuperarAcceso(error, controlador.signal);
      if (!controlador.signal.aborted && !recuperado) establecerErrorOperacion(error.message);
      return false;
    } finally {
      terminarOperacion(controlador);
    }
  }

  return (
    <>
      <div className="admin__acciones mb-4">
        <button type="button" className="btn btn-outline-secondary" disabled={!activo || ocupado} onClick={limpiarFormulario}>Nuevo proyecto</button>
      </div>
      {errorOperacion && <p ref={referenciaError} className="alert alert-danger" role="alert" tabIndex={-1}>{errorOperacion}</p>}
      {mensajeExito && <p ref={referenciaExito} className="alert alert-success" role="status" tabIndex={-1}>{mensajeExito}</p>}
      <div className="admin__columnas">
        <FormularioProyecto key={revisionFormulario} proyecto={proyectoEditado} activo={activo}
          ocupado={ocupado} guardando={operacion === "guardar"} alGuardar={guardarProyecto}
          alCancelar={limpiarFormulario} enfocarAlMontar={revisionFormulario > 0} />
        <ListadoProyectos listado={listado} activo={activo} ocupado={ocupado} eliminando={operacion === "eliminar"}
          alEditar={editarProyecto} alEliminar={eliminarProyecto} alCambiarPagina={establecerPagina}
          alReintentar={() => establecerRevisionListado((anterior) => anterior + 1)} />
      </div>
    </>
  );
}

export default GestionProyectos;
