import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Modal from "bootstrap/js/dist/modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpRightFromSquare, faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { obtenerEnlaceWeb } from "../utils/enlaces";

// Bootstrap gestiona Escape, fondo y foco; React mantiene el contenido del proyecto.
function DetalleProyecto({ proyecto, identificadorModal }) {
  const referenciaModal = useRef(null);
  const [indiceImagen, establecerIndiceImagen] = useState(0);
  const identificadorTitulo = "titulo-proyecto-" + proyecto.id;
  const identificadorGaleria = "galeria-proyecto-" + proyecto.id;
  const enlaceProyecto = obtenerEnlaceWeb(proyecto.urlProyecto);
  const enlaceRepositorio = obtenerEnlaceWeb(proyecto.urlRepositorio);
  const detalles = Array.isArray(proyecto.imagenesDetalle) ? proyecto.imagenesDetalle : [];
  // Los proyectos anteriores conservan su portada hasta añadir imágenes de detalle.
  const imagenes = detalles.length ? detalles : [{ imagen: proyecto.imagen, imagenAlt: proyecto.imagenAlt }];
  const indiceActual = Math.min(indiceImagen, imagenes.length - 1);
  const imagenActual = imagenes[indiceActual];
  const tieneGaleria = imagenes.length > 1;

  function moverImagen(desplazamiento) {
    establecerIndiceImagen((anterior) => (Math.min(anterior, imagenes.length - 1) + desplazamiento + imagenes.length) % imagenes.length);
  }

  function recorrerGaleria(evento) {
    if (!tieneGaleria || evento.altKey || evento.ctrlKey || evento.metaKey) return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(evento.key)) return;
    evento.preventDefault();
    if (evento.key === "ArrowLeft") moverImagen(-1);
    if (evento.key === "ArrowRight") moverImagen(1);
    if (evento.key === "Home") establecerIndiceImagen(0);
    if (evento.key === "End") establecerIndiceImagen(imagenes.length - 1);
  }

  useEffect(() => {
    const elementoModal = referenciaModal.current;
    const modal = Modal.getOrCreateInstance(elementoModal);
    function reiniciarGaleria() {
      establecerIndiceImagen(0);
      const cuerpo = elementoModal.querySelector(".modal-body");
      if (cuerpo) cuerpo.scrollTop = 0;
    }
    elementoModal.addEventListener("show.bs.modal", reiniciarGaleria);
    elementoModal.addEventListener("hidden.bs.modal", reiniciarGaleria);

    // Sin la clase fade, hide termina antes de dispose: libera también fondo y bloqueo de scroll.
    // Esta limpieza se aplica al desmontar y en la comprobación de efectos de StrictMode.
    return () => {
      elementoModal.removeEventListener("show.bs.modal", reiniciarGaleria);
      elementoModal.removeEventListener("hidden.bs.modal", reiniciarGaleria);
      modal.hide();
      modal.dispose();
    };
  }, []);

  // El portal coloca el modal en body para que el grid o sus ancestros no limiten su posición.
  return createPortal(
    <div ref={referenciaModal} className="modal project-detail" id={identificadorModal}
      tabIndex={-1} aria-labelledby={identificadorTitulo} aria-hidden="true">
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable project-detail__dialog">
        <div className="modal-content project-detail__content">
          <div className="modal-header project-detail__header">
            <div className="project-detail__heading">
              <div className="project-detail__meta-row">
                <p className="project-detail__category">{proyecto.categoria}</p>
                {proyecto.tecnologias.length > 0 && (
                  <ul className="project-detail__technologies" aria-label="Tecnologías utilizadas">
                    {proyecto.tecnologias.map((tecnologia) => <li key={tecnologia}>{tecnologia}</li>)}
                  </ul>
                )}
              </div>
              <h2 className="modal-title project-detail__title" id={identificadorTitulo}>
                {proyecto.titulo}
              </h2>
            </div>
            {/* data-bs-dismiss utiliza el cierre oficial y conserva Escape y el retorno del foco. */}
            <button type="button" className="btn-close" data-bs-dismiss="modal"
              aria-label="Cerrar ficha del proyecto" />
          </div>

          <div className="modal-body project-detail__body">
            <section className="project-detail__gallery" aria-label="Imágenes del proyecto"
              onKeyDown={recorrerGaleria} tabIndex={tieneGaleria ? 0 : undefined}
              aria-describedby={tieneGaleria ? identificadorGaleria + "-ayuda" : undefined}>
              <div className="project-detail__image-frame" id={identificadorGaleria}>
                <img className="project-detail__image" src={imagenActual.imagen} alt={imagenActual.imagenAlt || ""}
                  width={imagenActual.ancho || undefined} height={imagenActual.alto || undefined}
                  loading="lazy" decoding="async" />
              </div>
              {tieneGaleria && (
                <>
                  <p className="visually-hidden" id={identificadorGaleria + "-ayuda"}>
                    Usa las flechas izquierda y derecha para cambiar de imagen, o elige una miniatura.
                  </p>
                  <div className="project-detail__gallery-controls">
                    <button type="button" className="project-detail__gallery-control" onClick={() => moverImagen(-1)}
                      aria-label="Imagen anterior" aria-controls={identificadorGaleria}>
                      <FontAwesomeIcon icon={faChevronLeft} /> Anterior
                    </button>
                    <p className="project-detail__gallery-status" role="status" aria-live="polite" aria-atomic="true">
                      <span className="visually-hidden">Imagen </span>{indiceActual + 1} / {imagenes.length}
                    </p>
                    <button type="button" className="project-detail__gallery-control" onClick={() => moverImagen(1)}
                      aria-label="Imagen siguiente" aria-controls={identificadorGaleria}>
                      Siguiente <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                  </div>
                  <div className="project-detail__thumbnails" role="group" aria-label="Elegir imagen del proyecto">
                    {imagenes.map((imagen, indice) => (
                      <button type="button" className="project-detail__thumbnail" key={imagen.id ?? imagen.imagen + indice}
                        aria-label={"Ver imagen " + (indice + 1) + " de " + imagenes.length}
                        aria-pressed={indiceActual === indice} aria-controls={identificadorGaleria}
                        onClick={() => establecerIndiceImagen(indice)}>
                        <img src={imagen.imagen} alt="" loading="lazy" decoding="async" />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>
            <p className="project-detail__description">{proyecto.descripcion}</p>

            {(enlaceProyecto || enlaceRepositorio) && (
              <div className="project-detail__links">
                {enlaceProyecto && (
                  <a href={enlaceProyecto} target="_blank" rel="noopener noreferrer">
                    Visitar proyecto <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                    <span className="visually-hidden"> (se abre en otra pestaña)</span>
                  </a>
                )}
                {enlaceRepositorio && (
                  <a href={enlaceRepositorio} target="_blank" rel="noopener noreferrer">
                    Ver repositorio <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                    <span className="visually-hidden"> (se abre en otra pestaña)</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default DetalleProyecto;
