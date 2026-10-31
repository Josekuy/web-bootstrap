import { useEffect, useRef, useState } from "react";

function ListadoFotografias({ listado, ocupado, eliminando, alEditar, alEliminar, alCambiarPagina, alReintentar }) {
  const [confirmacion, establecerConfirmacion] = useState(null);
  const referenciaCancelar = useRef(null);
  const referenciaActivador = useRef(null);
  const referenciaTitulo = useRef(null);
  const deshabilitado = ocupado || listado.cargando;
  const paginas = Math.max(1, Math.ceil(listado.meta.total / listado.meta.limite));

  useEffect(() => {
    if (confirmacion) referenciaCancelar.current?.focus();
  }, [confirmacion]);

  function solicitarEliminacion(fotografia, evento) {
    referenciaActivador.current = evento.currentTarget;
    establecerConfirmacion(fotografia);
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
    <section className="admin__bloque admin__listado" aria-labelledby="listado-fotografias-titulo">
      <h2 ref={referenciaTitulo} id="listado-fotografias-titulo" tabIndex={-1}>Fotografías guardadas</h2>
      <p className="admin__texto">{listado.meta.total} {listado.meta.total === 1 ? "fotografía" : "fotografías"}. Los borradores solo aparecen aquí.</p>
      {confirmacion && (
        <div className="admin__confirmacion" role="group" aria-labelledby="confirmacion-eliminar-titulo">
          <p id="confirmacion-eliminar-titulo" role="alert">
            ¿Eliminar «{confirmacion.titulo}»? Se borrará también su imagen. Esta acción no se puede deshacer.
          </p>
          <div className="admin__acciones">
            <button type="button" className="btn btn-danger" disabled={deshabilitado} onClick={confirmarEliminacion}>
              {eliminando ? "Eliminando…" : "Eliminar definitivamente"}
            </button>
            <button ref={referenciaCancelar} type="button" className="btn btn-outline-secondary"
              disabled={deshabilitado} onClick={cancelarEliminacion}>Conservar fotografía</button>
          </div>
        </div>
      )}
      {listado.error && (
        <div className="alert alert-danger" role="alert">
          <p>{listado.error}</p>
          <button type="button" className="btn btn-outline-secondary" disabled={deshabilitado} onClick={alReintentar}>Reintentar listado</button>
        </div>
      )}
      {listado.cargando && <p role="status">Cargando fotografías…</p>}
      <div className="admin__tabla" role="region" aria-labelledby="listado-fotografias-titulo"
        aria-busy={listado.cargando} tabIndex={0}>
        {listado.datos.length > 0 ? (
          <table className="table align-middle">
            <caption className="visually-hidden">Listado de fotografías y acciones de edición</caption>
            <thead><tr><th scope="col">Imagen</th><th scope="col">Título</th><th scope="col">Estado</th><th scope="col">Orden</th><th scope="col">Acciones</th></tr></thead>
            <tbody>
              {listado.datos.map((fotografia) => (
                <tr key={fotografia.id}>
                  <td><img className="admin__miniatura" src={fotografia.imagen} alt="" loading="lazy" /></td>
                  <th scope="row">{fotografia.titulo}</th>
                  <td>{fotografia.estado === "publicado" ? "Publicado" : "Borrador"}</td>
                  <td>{fotografia.orden}</td>
                  <td><div className="admin__acciones">
                    <button type="button" className="btn btn-sm btn-outline-secondary" disabled={deshabilitado}
                      aria-label={"Editar " + fotografia.titulo} onClick={() => { establecerConfirmacion(null); alEditar(fotografia); }}>Editar</button>
                    <button type="button" className="btn btn-sm btn-outline-danger" disabled={deshabilitado}
                      aria-label={"Eliminar " + fotografia.titulo} onClick={(evento) => solicitarEliminacion(fotografia, evento)}>Eliminar</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : !listado.cargando && !listado.error && <p>Todavía no hay fotografías. Añade la primera con el formulario.</p>}
      </div>
      <nav className="admin__paginacion" aria-label="Páginas de fotografías">
        <button type="button" className="btn btn-outline-secondary" disabled={deshabilitado || listado.meta.pagina <= 1}
          onClick={() => cambiarPagina(listado.meta.pagina - 1)}>Anterior</button>
        <span aria-live="polite">Página {listado.meta.pagina} de {paginas}</span>
        <button type="button" className="btn btn-outline-secondary" disabled={deshabilitado || listado.meta.pagina >= paginas}
          onClick={() => cambiarPagina(listado.meta.pagina + 1)}>Siguiente</button>
      </nav>
    </section>
  );
}

export default ListadoFotografias;
