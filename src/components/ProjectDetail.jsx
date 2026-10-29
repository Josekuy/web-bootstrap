import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Modal from "bootstrap/js/dist/modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import { obtenerEnlaceWeb } from "../utils/enlaces";

// Bootstrap gestiona Escape, fondo y foco; React mantiene el contenido del proyecto.
function DetalleProyecto({ proyecto, identificadorModal }) {
  const referenciaModal = useRef(null);
  const identificadorTitulo = "titulo-proyecto-" + proyecto.id;
  const enlaceProyecto = obtenerEnlaceWeb(proyecto.urlProyecto);
  const enlaceRepositorio = obtenerEnlaceWeb(proyecto.urlRepositorio);

  useEffect(() => {
    const modal = Modal.getOrCreateInstance(referenciaModal.current);

    // Sin la clase fade, hide termina antes de dispose: libera también fondo y bloqueo de scroll.
    // Esta limpieza se aplica al desmontar y en la comprobación de efectos de StrictMode.
    return () => {
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
            <div>
              <p className="project-detail__category">{proyecto.categoria}</p>
              <h2 className="modal-title project-detail__title" id={identificadorTitulo}>
                {proyecto.titulo}
              </h2>
            </div>
            {/* data-bs-dismiss utiliza el cierre oficial y conserva Escape y el retorno del foco. */}
            <button type="button" className="btn-close" data-bs-dismiss="modal"
              aria-label="Cerrar ficha del proyecto" />
          </div>

          <div className="modal-body project-detail__body">
            <img className="project-detail__image" src={proyecto.imagen} alt={proyecto.imagenAlt}
              loading="lazy" decoding="async" />
            <p className="project-detail__description">{proyecto.descripcion}</p>

            <ul className="project-detail__technologies" aria-label="Tecnologías utilizadas">
              {proyecto.tecnologias.map((tecnologia) => <li key={tecnologia}>{tecnologia}</li>)}
            </ul>
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
