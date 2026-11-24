import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight } from "@fortawesome/free-solid-svg-icons";
import DetalleProyecto from "./ProjectDetail";

function resumirDescripcion(descripcion = "") {
  const texto = descripcion.replace(/\s+/gu, " ").trim();
  const caracteres = Array.from(texto);
  if (caracteres.length <= 180) return texto;
  const fragmento = caracteres.slice(0, 179).join("");
  const ultimoEspacio = fragmento.lastIndexOf(" ");
  return (ultimoEspacio > 0 ? fragmento.slice(0, ultimoEspacio) : fragmento).trimEnd() + "…";
}

// Presenta el resumen y enlaza el botón con el modal de Bootstrap de este proyecto.
function TarjetaProyecto({ proyecto }) {
  const identificadorModal = "detalle-proyecto-" + proyecto.id;
  const resumen = proyecto.resumen?.trim() || resumirDescripcion(proyecto.descripcion);

  return (
    <>
      <article className="project-card">
        <div className="project-card__image-wrapper">
          <img src={proyecto.imagen} alt={proyecto.imagenAlt} className="project-card__image"
            loading="lazy" decoding="async" />
        </div>
        <div className="project-card__body">
          <p className="project-card__meta">{proyecto.categoria}</p>
          <h3 className="project-card__title">{proyecto.titulo}</h3>
          <p className="project-card__description">{resumen}</p>

          {proyecto.tecnologias.length > 0 && (
            <ul className="project-card__technologies" aria-label="Tecnologías utilizadas">
              {proyecto.tecnologias.map((tecnologia) => <li key={tecnologia}>{tecnologia}</li>)}
            </ul>
          )}
          <button type="button" className="project-card__button"
            data-bs-toggle="modal" data-bs-target={"#" + identificadorModal}
            aria-controls={identificadorModal} aria-haspopup="dialog"
            aria-label={"Ver proyecto: " + proyecto.titulo}>
            Ver proyecto
            <span className="project-card__button-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faArrowRight} />
            </span>
          </button>
        </div>
      </article>

      <DetalleProyecto proyecto={proyecto} identificadorModal={identificadorModal} />
    </>
  );
}

export default TarjetaProyecto;
