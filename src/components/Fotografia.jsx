import { useEffect, useId, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faArrowRight, faArrowUpRightFromSquare, faExpand, faXmark } from "@fortawesome/free-solid-svg-icons";
import { useFotografias } from "../hooks/useFotografias";
import "../styles/photography.css";

function describirOrientacion(fotografia) {
  if (fotografia.alto > fotografia.ancho) return "vertical";
  if (fotografia.alto === fotografia.ancho) return "cuadrada";
  return "horizontal";
}

/** Un book con imágenes completas: el orden editorial procede del panel.
 * @param {{fotografias?: import("../data/fotografias").Fotografia[]}} propiedades
 */
function Fotografia({ fotografias }) {
  const usaApi = fotografias === undefined;
  const consulta = useFotografias({ activa: usaApi });
  const coleccion = usaApi ? consulta.fotografias : fotografias;
  const publicadas = coleccion
    .filter((fotografia) => fotografia.estado === "publicado")
    .sort((primera, segunda) => primera.orden - segunda.orden || primera.id - segunda.id);
  const cantidad = publicadas.length;
  const identificador = "book-fotografia-" + useId().replace(/:/gu, "");
  const referenciaDialogo = useRef(null);
  const referenciaApertura = useRef(null);
  const [idAbierto, establecerIdAbierto] = useState(null);
  const indiceActual = publicadas.findIndex((fotografia) => fotografia.id === idAbierto);
  const fotografiaActual = publicadas[indiceActual];
  const estaAbierto = Boolean(fotografiaActual);

  useEffect(() => {
    if (!estaAbierto) return;
    const dialogo = referenciaDialogo.current;
    const apertura = referenciaApertura.current;
    const desbordamientoAnterior = document.body.style.overflow;
    if (!dialogo.open) dialogo.showModal();
    document.body.style.overflow = "hidden";

    // showModal mantiene el foco y vuelve inerte el documento que queda detrás.
    // La limpieza también funciona al desmontar la sección o con StrictMode.
    return () => {
      if (dialogo.open) dialogo.close();
      document.body.style.overflow = desbordamientoAnterior;
      if (apertura?.isConnected) apertura.focus({ preventScroll: true });
    };
  }, [estaAbierto]);

  function abrirFotografia(fotografia, evento) {
    referenciaApertura.current = evento.currentTarget;
    establecerIdAbierto(fotografia.id);
  }

  function cerrarFotografia() {
    establecerIdAbierto(null);
  }

  function mostrarFotografia(indice) {
    if (indice >= 0 && indice < cantidad) establecerIdAbierto(publicadas[indice].id);
  }

  function manejarTeclado(evento) {
    if (evento.altKey || evento.ctrlKey || evento.metaKey) return;
    if (evento.key === "Tab") {
      const controles = [...evento.currentTarget.querySelectorAll("button:not(:disabled), a[href]")];
      const primero = controles[0];
      const ultimo = controles[controles.length - 1];
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo?.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero?.focus();
      }
    }
    if (evento.key === "ArrowLeft" || evento.key === "ArrowRight") {
      evento.preventDefault();
      mostrarFotografia(indiceActual + (evento.key === "ArrowRight" ? 1 : -1));
    }
  }

  function cerrarDesdeFondo(evento) {
    if (evento.target !== evento.currentTarget) return;
    const limites = evento.currentTarget.getBoundingClientRect();
    if (evento.clientX < limites.left || evento.clientX > limites.right
      || evento.clientY < limites.top || evento.clientY > limites.bottom) cerrarFotografia();
  }

  return (
    <section className="content-section photography" id="fotografia" aria-labelledby="fotografia-titulo">
      <div className="container">
        <div className="photography__header">
          <div className="photography__heading">
            <p className="content-section__eyebrow">Fotografía</p>
            <h2 className="content-section__title" id="fotografia-titulo">Una mirada<br />sin prisa.</h2>
          </div>
          <div className="photography__introduction">
            <p className="photography__intro">Una selección de fotografías. Distintos encuadres, una misma mirada.</p>
            {cantidad > 0 && <p className="photography__hint">Selecciona una imagen para verla en detalle.</p>}
          </div>
        </div>

        {cantidad > 0 ? (
          <ol className="photography__grid" role="list" aria-label="Book de fotografía" aria-busy={usaApi && consulta.cargando}>
            {publicadas.map((fotografia) => (
              <li className="photography__entry" key={fotografia.id} data-orientacion={describirOrientacion(fotografia)}>
                <figure className="photography__item">
                  <button className="photography__open" type="button" aria-haspopup="dialog"
                    aria-controls={identificador} aria-label={"Ampliar fotografía: " + fotografia.titulo}
                    onClick={(evento) => abrirFotografia(fotografia, evento)}>
                    <img className="photography__image" src={fotografia.imagen} alt={fotografia.imagenAlt}
                      loading="lazy" decoding="async" width={fotografia.ancho || undefined} height={fotografia.alto || undefined} />
                    <span className="photography__zoom" aria-hidden="true"><FontAwesomeIcon icon={faExpand} /></span>
                  </button>
                  <figcaption className="photography__caption">
                    <h3 className="photography__title">{fotografia.titulo}</h3>
                    {fotografia.descripcion && <p className="photography__description">{fotografia.descripcion}</p>}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ol>
        ) : (!usaApi || (!consulta.cargando && !consulta.error)) && (
          <p className="content-section__text photography__empty">Todavía no hay fotografías publicadas.</p>
        )}

        {usaApi && consulta.cargando && <p className="content-section__text mt-4" role="status">Cargando fotografías…</p>}
        {usaApi && consulta.error && (
          <div className="mt-4" role="alert">
            <p className="content-section__text">{consulta.error}</p>
            <button className="btn btn-outline-secondary" type="button" onClick={consulta.reintentar}>Reintentar</button>
          </div>
        )}
        {usaApi && consulta.hayMas && !consulta.error && (
          <div className="photography__more">
            <button className="btn btn-outline-secondary" type="button"
              onClick={consulta.cargarMas} disabled={consulta.cargando}>
              {consulta.cargando ? "Cargando…" : "Cargar más fotografías"}
            </button>
            <p className="photography__loaded">{cantidad} de {consulta.total} fotografías cargadas.</p>
          </div>
        )}

        <dialog className="photography__lightbox" id={identificador} ref={referenciaDialogo}
          aria-labelledby={identificador + "-titulo"}
          aria-describedby={fotografiaActual?.descripcion ? identificador + "-descripcion" : undefined}
          onCancel={(evento) => { evento.preventDefault(); cerrarFotografia(); }}
          onClick={cerrarDesdeFondo} onKeyDown={manejarTeclado}>
          {fotografiaActual && (
            <div className="photography__lightbox-panel">
              <div className="photography__lightbox-header">
                <div className="photography__lightbox-info">
                  <h3 className="photography__lightbox-title" id={identificador + "-titulo"}>{fotografiaActual.titulo}</h3>
                  {fotografiaActual.descripcion && (
                    <p className="photography__lightbox-description" id={identificador + "-descripcion"}>{fotografiaActual.descripcion}</p>
                  )}
                </div>
                <button className="photography__lightbox-button photography__lightbox-close" type="button"
                  aria-label="Cerrar fotografía" onClick={cerrarFotografia} autoFocus>
                  <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                </button>
              </div>
              <div className="photography__lightbox-image-frame">
                <img className="photography__lightbox-image" src={fotografiaActual.imagen}
                  alt={fotografiaActual.imagenAlt} width={fotografiaActual.ancho || undefined} height={fotografiaActual.alto || undefined} />
              </div>
              <div className="photography__lightbox-footer">
                <p className="photography__position" aria-live="polite" aria-atomic="true">
                  <span className="visually-hidden">Fotografía </span>{String(indiceActual + 1).padStart(2, "0")}
                  <span aria-hidden="true"> / </span><span className="visually-hidden"> de </span>{String(cantidad).padStart(2, "0")}
                </p>
                {cantidad > 1 && (
                  <div className="photography__lightbox-navigation" role="group" aria-label="Recorrer fotografías">
                    <button className="photography__lightbox-button" type="button" aria-label="Fotografía anterior"
                      disabled={indiceActual === 0} onClick={() => mostrarFotografia(indiceActual - 1)}>
                      <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
                    </button>
                    <button className="photography__lightbox-button" type="button" aria-label="Fotografía siguiente"
                      disabled={indiceActual === cantidad - 1} onClick={() => mostrarFotografia(indiceActual + 1)}>
                      <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" />
                    </button>
                  </div>
                )}
                <a className="photography__original" href={fotografiaActual.imagen} target="_blank" rel="noopener noreferrer"
                  aria-label={"Ver imagen original: " + fotografiaActual.titulo + " (se abre en otra pestaña)"}>
                  <span>Original</span><FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" />
                </a>
              </div>
            </div>
          )}
        </dialog>
      </div>
    </section>
  );
}

export default Fotografia;
