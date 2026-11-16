import { useCallback, useEffect, useRef, useState } from "react";
import SelectorTema from "../components/ThemeToggle";
import { solicitarApi } from "../services/api";
import AccesoAdmin from "./AccesoAdmin";
import GestionGaleria from "./GestionGaleria";
import { galerias } from "./galerias";
import GestionProyectos from "./GestionProyectos";
import "../styles/admin.css";

const secciones = [
  { recurso: "proyectos", titulo: "Proyectos" },
  galerias.ilustraciones,
  galerias.fotografias,
];

async function consultarSesion(senal) {
  const respuesta = await solicitarApi("/api/admin/sesion", { signal: senal });
  if (senal?.aborted) return null;
  const datos = respuesta.datos;
  if (typeof datos?.autenticado !== "boolean" || typeof datos.csrfToken !== "string") {
    throw new Error("No se ha podido comprobar la sesión. Vuelve a intentarlo.");
  }
  return datos;
}

function PanelAdmin() {
  const [seccion, establecerSeccion] = useState("ilustraciones");
  const [ocupadoGestion, establecerOcupadoGestion] = useState(false);
  const [estadoSesion, establecerEstadoSesion] = useState({ cargando: true, datos: null, error: "" });
  const [revisionSesion, establecerRevisionSesion] = useState(0);
  const [avisoSesion, establecerAvisoSesion] = useState("");
  const [errorAcceso, establecerErrorAcceso] = useState("");
  const [operacion, establecerOperacion] = useState("");
  const [errorOperacion, establecerErrorOperacion] = useState("");
  const referenciaOperacion = useRef(null);
  const referenciaError = useRef(null);
  const referenciaTitulo = useRef(null);
  const autenticado = Boolean(estadoSesion.datos?.autenticado);
  const ocupado = Boolean(operacion) || ocupadoGestion;

  // Cada gestor comunica sus escrituras para bloquear navegación y cierre de sesión.
  const cambiarOcupadoGestion = useCallback((nuevoEstado) => {
    establecerOcupadoGestion(nuevoEstado);
    if (nuevoEstado) {
      establecerErrorOperacion("");
    }
  }, []);

  const renovarSesion = useCallback(async (senal) => {
    const datos = await consultarSesion(senal);
    if (!datos) return null;
    establecerEstadoSesion({ datos, cargando: false, error: "" });
    return datos;
  }, []);

  const volverAlAcceso = useCallback(() => {
    establecerOcupadoGestion(false);
    establecerAvisoSesion("La sesión ha caducado. Identifícate de nuevo para continuar.");
    establecerErrorAcceso("");
    establecerEstadoSesion({ datos: null, cargando: true, error: "" });
    establecerErrorOperacion("");
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
    consultarSesion(controlador.signal).then((datos) => {
      if (datos) establecerEstadoSesion({ datos, cargando: false, error: "" });
    }).catch((error) => {
      if (controlador.signal.aborted || error.name === "AbortError") return;
      establecerEstadoSesion({ datos: null, cargando: false, error: error.message });
    });
    return () => controlador.abort();
  }, [revisionSesion]);

  useEffect(() => () => referenciaOperacion.current?.abort(), []);
  useEffect(() => { if (errorOperacion) referenciaError.current?.focus(); }, [errorOperacion]);
  useEffect(() => { if (autenticado) referenciaTitulo.current?.focus(); }, [autenticado]);

  // Una sola operación activa evita envíos duplicados incluso antes del siguiente render.
  function comenzarOperacion(nombre) {
    if (referenciaOperacion.current || ocupadoGestion) return null;
    const controlador = new AbortController();
    referenciaOperacion.current = controlador;
    establecerOperacion(nombre);
    establecerErrorOperacion("");
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
      // GET crea el token anónimo necesario para el siguiente inicio de sesión.
      establecerRevisionSesion((anterior) => anterior + 1);
    } catch (error) {
      if (controlador.signal.aborted || error.name === "AbortError") return;
      if (!(await recuperarAcceso(error, controlador.signal))) establecerErrorOperacion(error.message);
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
              {secciones.map((elemento) => (
                <button key={elemento.recurso} type="button" className={"nav-link" + (seccion === elemento.recurso ? " active" : "")}
                  data-seccion={elemento.recurso} aria-pressed={seccion === elemento.recurso}
                  aria-controls={`gestion-${elemento.recurso}`} disabled={ocupado}
                  onClick={() => cambiarSeccion(elemento.recurso)}>{elemento.titulo}</button>
              ))}
            </nav>
            <div className="admin__introduccion">
              <div>
                <p className="admin__etiqueta">Panel de administración</p>
                <h1 ref={referenciaTitulo} tabIndex={-1}>{secciones.find((elemento) => elemento.recurso === seccion).titulo}</h1>
                <p className="admin__texto">Sesión de {estadoSesion.datos.usuario?.usuario}. Publica, ordena y actualiza tu portfolio.</p>
              </div>

            </div>
            {errorOperacion && <p ref={referenciaError} className="alert alert-danger" role="alert" tabIndex={-1}>{errorOperacion}</p>}
            <div id="gestion-proyectos" hidden={seccion !== "proyectos"}>
              <GestionProyectos activo={seccion === "proyectos"} bloqueado={Boolean(operacion)}
                csrfToken={estadoSesion.datos.csrfToken}
                alRecuperarAcceso={recuperarAcceso} alCambiarOcupado={cambiarOcupadoGestion} />
            </div>
            {Object.values(galerias).map((galeria) => (
              <div key={galeria.recurso} id={`gestion-${galeria.recurso}`} hidden={seccion !== galeria.recurso}>
                <GestionGaleria galeria={galeria} activo={seccion === galeria.recurso} bloqueado={Boolean(operacion)}
                  csrfToken={estadoSesion.datos.csrfToken}
                  alRecuperarAcceso={recuperarAcceso} alCambiarOcupado={cambiarOcupadoGestion} />
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  );
}

export default PanelAdmin;
