import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye } from "@fortawesome/free-solid-svg-icons";
import DetalleProyecto from "./ProjectDetail";

// Presenta el resumen y enlaza el botón con el modal de Bootstrap de este proyecto.
function TarjetaProyecto({ proyecto, numero }) {
  const identificadorModal = "detalle-proyecto-" + proyecto.id;

  return (
    <>
      <article className="project-card">
        <div className="project-card__image-wrapper">
          <img src={proyecto.imagen} alt={proyecto.imagenAlt} className="project-card__image"
            loading="lazy" decoding="async" />
        </div>
        <div className="project-card__body">
          <div className="project-card__meta">
            <span>{proyecto.categoria}</span>
            <span>#{String(numero).padStart(2, "0")}</span>
          </div>
          <h3 className="project-card__title">{proyecto.titulo}</h3>
          <p className="project-card__description">{proyecto.descripcion}</p>

          <div className="project-card__technologies" aria-label="Tecnologías utilizadas">
            {proyecto.tecnologias.map((tecnologia) => (
              <span key={tecnologia}>{tecnologia}</span>
            ))}
          </div>
          <button type="button" className="project-card__button"
            data-bs-toggle="modal" data-bs-target={"#" + identificadorModal}
            aria-controls={identificadorModal} aria-haspopup="dialog"
            aria-label={"Ver proyecto: " + proyecto.titulo}>
            Ver proyecto <FontAwesomeIcon icon={faEye} />
          </button>
        </div>
      </article>

      <DetalleProyecto proyecto={proyecto} identificadorModal={identificadorModal} />
    </>
  );
}

export default TarjetaProyecto;
