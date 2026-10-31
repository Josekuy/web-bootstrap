import { useCallback, useEffect, useRef, useState } from "react";
import SelectorTema from "../components/ThemeToggle";
import { solicitarApi } from "../services/api";
import AccesoAdmin from "./AccesoAdmin";
import FormularioFotografia from "./FormularioFotografia";
import ListadoFotografias from "./ListadoFotografias";
import GestionProyectos from "./GestionProyectos";
import "../styles/admin.css";

function PanelAdmin() {
  const [seccion, establecerSeccion] = useState("fotografias");
  const [ocupadoProyectos, establecerOcupadoProyectos] = useState(false);
  const [estadoSesion, establecerEstadoSesion] = useState({ cargando: true, datos: null, error: "" });
  const [revisionSesion, establecerRevisionSesion] = useState(0);
  const [avisoSesion, establecerAvisoSesion] = useState("");
  const [errorAcceso, establecerErrorAcceso] = useState("");
  const [operacion, establecerOperacion] = useState("");
  const [errorOperacion, establecerErrorOperacion] = useState("");
  const [mensajeExito, establecerMensajeExito] = useState("");
  const [pagina, establecerPagina] = useState(1);
  const [revisionListado, establecerRevisionListado] = useState(0);
  const [listado, establecerListado] = useState({
    datos: [], meta: { pagina: 1, limite: 20, total: 0 }, cargando: true, error: "",
  });
  const [fotografiaEditada, establecerFotografiaEditada] = useState(null);
  const [revisionFormulario, establecerRevisionFormulario] = useState(0);
  const referenciaOperacion = useRef(null);
  const referenciaError = useRef(null);
  const referenciaExito = useRef(null);
  const referenciaTitulo = useRef(null);
  const autenticado = Boolean(estadoSesion.datos?.autenticado);
  const ocupado = Boolean(operacion) || ocupadoProyectos;

  // Un nuevo intento de proyectos también retira los avisos globales de una sesión ya renovada.
  const cambiarOcupadoProyectos = useCallback((nuevoEstado) => {
    establecerOcupadoProyectos(nuevoEstado);
    if (nuevoEstado) {
      establecerErrorOperacion("");
      establecerMensajeExito("");
    }
  }, []);

  const renovarSesion = useCallback(async (senal) => {
    const respuesta = await solicitarApi("/api/admin/sesion", { signal: senal });
    if (senal?.aborted) return null;
    const datos = respuesta.datos;
    if (typeof datos?.autenticado !== "boolean" || typeof datos.csrfToken !== "string") {
      throw new Error("No se ha podido comprobar la sesión. Vuelve a intentarlo.");
    }
    establecerEstadoSesion({ datos, cargando: false, error: "" });
    return datos;
  }, []);

  const volverAlAcceso = useCallback(() => {
    establecerOcupadoProyectos(false);
    establecerAvisoSesion("La sesión ha caducado. Identifícate de nuevo para continuar.");
    establecerErrorAcceso("");
    establecerEstadoSesion({ datos: null, cargando: true, error: "" });
    establecerFotografiaEditada(null);
    establecerErrorOperacion("");
    establecerMensajeExito("");
    establecerPagina(1);
    establecerRevisionSesion((anterior) => anterior + 1);
  }, []);

  // Un 403 puede indicar un token antiguo: renovarlo no debe borrar una edición en curso.
  const recuperarAcceso = useCallback(async (error, senal) => {
    if (error.estado === 401) {
      volverAlAcceso();
      return true;
    }
    if (error.estado !== 403) return false;
    try {
      const datos = await renovarSesion(senal);
      if (!datos) return true;
      if (datos.autenticado) {
        establecerErrorOperacion("Se ha renovado la sesión de acceso. Tus cambios siguen en el formulario; vuelve a enviar la operación.");
      } else {
        establecerAvisoSesion("La sesión ha cambiado. Identifícate de nuevo para continuar.");
        establecerErrorAcceso("Se ha renovado el acceso. Vuelve a introducir tus datos.");
      }
    } catch (fallo) {
      if (senal?.aborted || fallo.name === "AbortError") return true;
      establecerErrorOperacion("No se ha podido renovar la sesión. Vuelve a cargar esta página antes de continuar.");
      establecerErrorAcceso("No se ha podido renovar la sesión. Vuelve a cargar esta página.");
    }
    return true;
  }, [renovarSesion, volverAlAcceso]);

  useEffect(() => {
    const controlador = new AbortController();
    renovarSesion(controlador.signal).catch((error) => {
      if (controlador.signal.aborted || error.name === "AbortError") return;
      establecerEstadoSesion({ datos: null, cargando: false, error: error.message });
    });
    return () => controlador.abort();
  }, [revisionSesion, renovarSesion]);

  useEffect(() => {
    if (!autenticado || seccion !== "fotografias") return;
    const controlador = new AbortController();

    async function cargarListado() {
      establecerListado((anterior) => ({ ...anterior, cargando: true, error: "" }));
      try {
        const respuesta = await solicitarApi(`/api/admin/fotografias?pagina=${pagina}&limite=20`, {
          signal: controlador.signal,
        });
        if (controlador.signal.aborted) return;
        establecerListado({ datos: respuesta.datos, meta: respuesta.meta, cargando: false, error: "" });
      } catch (error) {
        if (controlador.signal.aborted || error.name === "AbortError") return;
        const recuperado = await recuperarAcceso(error, controlador.signal);
        if (!controlador.signal.aborted) {
          establecerListado((anterior) => ({ ...anterior, cargando: false, error: recuperado ? "" : error.message }));
        }
      }
    }

    cargarListado();
    return () => controlador.abort();
  }, [autenticado, seccion, pagina, revisionListado, recuperarAcceso]);

  useEffect(() => () => referenciaOperacion.current?.abort(), []);
  useEffect(() => { if (errorOperacion) referenciaError.current?.focus(); }, [errorOperacion]);
  useEffect(() => { if (mensajeExito) referenciaExito.current?.focus(); }, [mensajeExito]);
  useEffect(() => { if (autenticado) referenciaTitulo.current?.focus(); }, [autenticado]);

  // Una sola operación activa evita envíos duplicados incluso antes del siguiente render.
  function comenzarOperacion(nombre) {
    if (referenciaOperacion.current || ocupadoProyectos) return null;
    const controlador = new AbortController();
    referenciaOperacion.current = controlador;
    establecerOperacion(nombre);
    establecerErrorOperacion("");
    establecerMensajeExito("");
    return controlador;
  }

  function terminarOperacion(controlador) {
    if (referenciaOperacion.current === controlador) {
      referenciaOperacion.current = null;
      if (!controlador.signal.aborted) establecerOperacion("");
    }
  }

  async function acceder(credenciales) {
    const controlador = comenzarOperacion("acceso");
    if (!controlador) return false;
    establecerErrorAcceso("");
    try {
      const respuesta = await solicitarApi("/api/admin/login", {
        method: "POST", body: credenciales, csrfToken: estadoSesion.datos.csrfToken,
        signal: controlador.signal,
      });
      if (controlador.signal.aborted) return false;
      // El servidor regenera sesión y token al entrar: sustituimos ambos datos juntos.
      establecerEstadoSesion({ datos: respuesta.datos, cargando: false, error: "" });
      establecerAvisoSesion("");
      establecerPagina(1);
      return true;
    } catch (error) {
      if (controlador.signal.aborted || error.name === "AbortError") return false;
      if (error.estado !== 403 || !(await recuperarAcceso(error, controlador.signal))) {
        establecerErrorAcceso(error.message);
      }
      return false;
    } finally {
      terminarOperacion(controlador);
    }
  }

  async function salir() {
    const controlador = comenzarOperacion("salir");
    if (!controlador) return;
    try {
      await solicitarApi("/api/admin/logout", {
        method: "POST", csrfToken: estadoSesion.datos.csrfToken, signal: controlador.signal,
      });
      if (controlador.signal.aborted) return;
      establecerAvisoSesion("Has cerrado sesión.");
      establecerEstadoSesion({ datos: null, cargando: true, error: "" });
      establecerFotografiaEditada(null);
      establecerPagina(1);
      // GET crea el token anónimo necesario para el siguiente inicio de sesión.
      establecerRevisionSesion((anterior) => anterior + 1);
    } catch (error) {
      if (controlador.signal.aborted || error.name === "AbortError") return;
      if (!(await recuperarAcceso(error, controlador.signal))) establecerErrorOperacion(error.message);
    } finally {
      terminarOperacion(controlador);
    }
  }

  function limpiarFormulario() {
    establecerFotografiaEditada(null);
    establecerRevisionFormulario((anterior) => anterior + 1);
    establecerErrorOperacion("");
  }

  function editarFotografia(fotografia) {
    establecerFotografiaEditada(fotografia);
    establecerRevisionFormulario((anterior) => anterior + 1);
    establecerErrorOperacion("");
    establecerMensajeExito("");
  }

  function informarResultadoIncierto(error) {
    if (error.estado !== 503 || error.codigo !== "GUARDADO_NO_CONFIRMADO") return false;
    // Un corte al confirmar puede suceder después de aplicar los cambios en MySQL.
    // Solo consultamos el resultado: el formulario y la mutación no se repiten.
    establecerErrorOperacion("No se ha podido confirmar el resultado. El listado se está actualizando: comprueba si la operación se aplicó antes de repetirla. Tus cambios se conservan en el formulario.");
    establecerPagina(1);
    establecerRevisionListado((anterior) => anterior + 1);
    return true;
  }

  async function guardarFotografia(formulario) {
    const controlador = comenzarOperacion("guardar");
    if (!controlador) return false;
    try {
      const ruta = fotografiaEditada ? `/api/admin/fotografias/${fotografiaEditada.id}` : "/api/admin/fotografias";
      const respuesta = await solicitarApi(ruta, {
        method: fotografiaEditada ? "PUT" : "POST", body: formulario,
        csrfToken: estadoSesion.datos.csrfToken, signal: controlador.signal,
      });
      if (controlador.signal.aborted) return false;
      limpiarFormulario();
      establecerMensajeExito(`«${respuesta.datos.titulo}» se ha guardado como ${respuesta.datos.estado === "publicado" ? "publicada" : "borrador"}.`);
      establecerPagina(1);
      establecerRevisionListado((anterior) => anterior + 1);
      return true;
    } catch (error) {
      if (controlador.signal.aborted || error.name === "AbortError") return false;
      if (informarResultadoIncierto(error)) return false;
      if (!(await recuperarAcceso(error, controlador.signal))) establecerErrorOperacion(error.message);
      return false;
    } finally {
      terminarOperacion(controlador);
    }
  }

  async function eliminarFotografia(fotografia) {
    const controlador = comenzarOperacion("eliminar");
    if (!controlador) return false;
    try {
      await solicitarApi(`/api/admin/fotografias/${fotografia.id}`, {
        method: "DELETE", csrfToken: estadoSesion.datos.csrfToken, signal: controlador.signal,
      });
      if (controlador.signal.aborted) return false;
      if (fotografiaEditada?.id === fotografia.id) limpiarFormulario();
      establecerMensajeExito(`Se ha eliminado «${fotografia.titulo}».`);
      const ultimaPagina = Math.max(1, Math.ceil((listado.meta.total - 1) / listado.meta.limite));
      establecerPagina((anterior) => Math.min(anterior, ultimaPagina));
      establecerRevisionListado((anterior) => anterior + 1);
      return true;
    } catch (error) {
      if (controlador.signal.aborted || error.name === "AbortError") return false;
      if (informarResultadoIncierto(error)) return false;
      if (!(await recuperarAcceso(error, controlador.signal))) establecerErrorOperacion(error.message);
      return false;
    } finally {
      terminarOperacion(controlador);
    }
  }

  function reintentarSesion() {
    establecerEstadoSesion({ datos: null, cargando: true, error: "" });
    establecerRevisionSesion((anterior) => anterior + 1);
  }

  // Los formularios permanecen montados al cambiar de sección para conservar los cambios.
  function cambiarSeccion(nuevaSeccion) {
    if (ocupado || nuevaSeccion === seccion) return;
    establecerErrorOperacion("");
    establecerMensajeExito("");
    establecerSeccion(nuevaSeccion);
  }

  return (
    <div className="admin">
      <a className="skip-link" href="#contenido-admin">Ir al contenido del panel</a>
      <header className="admin__cabecera">
        <div className="container admin__barra">
          <a className="admin__marca" href="/">Volver al portfolio</a>
          <div className="admin__acciones">
            <SelectorTema />
            {autenticado && <button type="button" className="btn btn-outline-light" onClick={salir} disabled={ocupado}>
              {operacion === "salir" ? "Cerrando sesión…" : "Cerrar sesión"}
            </button>}
          </div>
        </div>
      </header>
      <main className="container admin__principal" id="contenido-admin" tabIndex={-1}>
        {estadoSesion.cargando ? <p role="status">Comprobando sesión…</p> : estadoSesion.error ? (
          <div className="admin__acceso" role="alert">
            <h1>No se ha podido abrir el panel</h1><p>{estadoSesion.error}</p>
            <button type="button" className="btn btn-primary" onClick={reintentarSesion}>Reintentar acceso</button>
          </div>
        ) : !autenticado ? (
          <AccesoAdmin alAcceder={acceder} ocupado={ocupado} error={errorAcceso} aviso={avisoSesion} />
        ) : (
          <>
            <nav className="nav nav-pills admin__secciones" aria-label="Secciones de administración">
              <button type="button" className={"nav-link" + (seccion === "proyectos" ? " active" : "")}
              data-seccion="proyectos" aria-pressed={seccion === "proyectos"}
              aria-controls="gestion-proyectos" disabled={ocupado}
              onClick={() => cambiarSeccion("proyectos")}>Proyectos</button>
              <button type="button" className={"nav-link" + (seccion === "fotografias" ? " active" : "")}
                data-seccion="fotografias" aria-pressed={seccion === "fotografias"}
                aria-controls="gestion-fotografias" disabled={ocupado}
                onClick={() => cambiarSeccion("fotografias")}>Fotografía</button>
            </nav>
            <div className="admin__introduccion">
              <div>
                <p className="admin__etiqueta">Panel de administración</p>
                <h1 ref={referenciaTitulo} tabIndex={-1}>{seccion === "proyectos" ? "Proyectos" : "Fotografía"}</h1>
                <p className="admin__texto">Sesión de {estadoSesion.datos.usuario?.usuario}. Publica, ordena y actualiza tu portfolio.</p>
              </div>
              {seccion === "fotografias" && (
                <button type="button" className="btn btn-outline-secondary" onClick={limpiarFormulario} disabled={ocupado}>Nueva fotografía</button>
              )}
            </div>
            {errorOperacion && <p ref={referenciaError} className="alert alert-danger" role="alert" tabIndex={-1}>{errorOperacion}</p>}
            {mensajeExito && <p ref={referenciaExito} className="alert alert-success" role="status" tabIndex={-1}>{mensajeExito}</p>}
            <div id="gestion-fotografias" hidden={seccion !== "fotografias"}>
              <div className="admin__columnas">
              <FormularioFotografia key={revisionFormulario} fotografia={fotografiaEditada}
                ocupado={ocupado} guardando={operacion === "guardar"} alGuardar={guardarFotografia}
                alCancelar={limpiarFormulario} enfocarAlMontar={revisionFormulario > 0} />
              <ListadoFotografias listado={listado} ocupado={ocupado} eliminando={operacion === "eliminar"}
                alEditar={editarFotografia} alEliminar={eliminarFotografia} alCambiarPagina={establecerPagina}
                alReintentar={() => establecerRevisionListado((anterior) => anterior + 1)} />
              </div>
            </div>
            <div id="gestion-proyectos" hidden={seccion !== "proyectos"}>
              <GestionProyectos activo={seccion === "proyectos"} bloqueado={Boolean(operacion)}
                csrfToken={estadoSesion.datos.csrfToken}
                alRecuperarAcceso={recuperarAcceso} alCambiarOcupado={cambiarOcupadoProyectos} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default PanelAdmin;
