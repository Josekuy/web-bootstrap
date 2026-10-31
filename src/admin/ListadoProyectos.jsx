import { useEffect, useRef, useState } from "react";

function ListadoProyectos({ listado, activo, ocupado, eliminando, alEditar, alEliminar, alCambiarPagina, alReintentar }) {
  const [confirmacion, establecerConfirmacion] = useState(null);
  const referenciaCancelar = useRef(null);
  const referenciaActivador = useRef(null);
  const referenciaTitulo = useRef(null);
  const deshabilitado = !activo || ocupado || listado.cargando;
  const paginas = Math.max(1, Math.ceil(listado.meta.total / listado.meta.limite));

  useEffect(() => {
    if (activo && confirmacion) referenciaCancelar.current?.focus();
  }, [activo, confirmacion]);

  function solicitarEliminacion(proyecto, evento) {
    referenciaActivador.current = evento.currentTarget;
    establecerConfirmacion(proyecto);
  }

  function cancelarEliminacion() {
    establecerConfirmacion(null);
    referenciaActivador.current?.focus();
  }

  async function confirmarEliminacion() {
    if (deshabilitado) return;
    if (await alEliminar(confirmacion)) {
      establecerConfirmacion(null);
      referenciaTitulo.current?.focus();
    }
  }

  function cambiarPagina(pagina) {
    establecerConfirmacion(null);
    alCambiarPagina(pagina);
  }

  return (
    <section className="admin__bloque admin__listado" aria-labelledby="listado-proyectos-titulo">
      <h2 ref={referenciaTitulo} id="listado-proyectos-titulo" tabIndex={-1}>Proyectos guardados</h2>
      <p className="admin__texto">{listado.meta.total} {listado.meta.total === 1 ? "proyecto" : "proyectos"}. Los borradores solo aparecen en el panel.</p>
      {confirmacion && (
        <div className="admin__confirmacion" role="group" aria-labelledby="confirmacion-eliminar-proyecto-titulo">
          <p id="confirmacion-eliminar-proyecto-titulo" role="alert">
            ¿Eliminar «{confirmacion.titulo}» del portfolio? Esta acción no se puede deshacer.
          </p>
          <div className="admin__acciones">
            <button type="button" className="btn btn-danger" disabled={deshabilitado} onClick={confirmarEliminacion}>
              {eliminando ? "Eliminando…" : "Eliminar definitivamente"}
            </button>
            <button ref={referenciaCancelar} type="button" className="btn btn-outline-secondary"
              disabled={deshabilitado} onClick={cancelarEliminacion}>Conservar proyecto</button>
          </div>
        </div>
      )}
      {listado.error && (
        <div className="alert alert-danger" role="alert">
          <p>{listado.error}</p>
          <button type="button" className="btn btn-outline-secondary" disabled={deshabilitado} onClick={alReintentar}>Reintentar listado de proyectos</button>
        </div>
      )}
      {listado.cargando && <p role="status">Cargando proyectos…</p>}
      <div className="admin__tabla admin__tabla--proyectos" role="region" aria-labelledby="listado-proyectos-titulo"
        aria-busy={listado.cargando} tabIndex={0}>
        {listado.datos.length > 0 ? (
          <table className="table align-middle">
            <caption className="visually-hidden">Listado de proyectos y acciones de edición</caption>
            <thead><tr><th scope="col">Imagen</th><th scope="col">Título</th><th scope="col">Categoría</th><th scope="col">Estado</th><th scope="col">Orden</th><th scope="col">Acciones</th></tr></thead>
            <tbody>
              {listado.datos.map((proyecto) => (
                <tr key={proyecto.id}>
                  <td><img className="admin__miniatura" src={proyecto.imagen} alt="" loading="lazy" /></td>
                  <th scope="row">{proyecto.titulo}</th>
                  <td>{proyecto.categoria}</td>
                  <td>{proyecto.estado === "publicado" ? "Publicado" : "Borrador"}</td>
                  <td>{proyecto.orden}</td>
                  <td><div className="admin__acciones">
                    <button type="button" className="btn btn-sm btn-outline-secondary" disabled={deshabilitado}
                      aria-label={"Editar " + proyecto.titulo} onClick={() => { establecerConfirmacion(null); alEditar(proyecto); }}>Editar</button>
                    <button type="button" className="btn btn-sm btn-outline-danger" disabled={deshabilitado}
                      aria-label={"Eliminar " + proyecto.titulo} onClick={(evento) => solicitarEliminacion(proyecto, evento)}>Eliminar</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : !listado.cargando && !listado.error && <p>Todavía no hay proyectos. Añade el primero con el formulario.</p>}
      </div>
      <nav className="admin__paginacion" aria-label="Páginas de proyectos">
        <button type="button" className="btn btn-outline-secondary" disabled={deshabilitado || listado.meta.pagina <= 1}
          onClick={() => cambiarPagina(listado.meta.pagina - 1)}>Anterior</button>
        <span aria-live="polite">Página {listado.meta.pagina} de {paginas}</span>
        <button type="button" className="btn btn-outline-secondary" disabled={deshabilitado || listado.meta.pagina >= paginas}
          onClick={() => cambiarPagina(listado.meta.pagina + 1)}>Siguiente</button>
      </nav>
    </section>
  );
}

export default ListadoProyectos;
