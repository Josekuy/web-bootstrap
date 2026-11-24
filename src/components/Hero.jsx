import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowDown } from "@fortawesome/free-solid-svg-icons";
import { presentacion } from "../data/contenido";

// La presentación recibe contenido separado del diseño para poder alimentarse de una API.
function Presentacion({ datos = presentacion }) {
  return (
    <header className="hero" id="inicio">
      <div className="container">
        <p className="hero__eyebrow">{datos.especialidad}</p>
        <h1 className="hero__title">
          {datos.titulo[0]}
          <br />
          <span>+</span> {datos.titulo[1]}
        </h1>
        <div className="hero__bottom">
          <p className="hero__description">{datos.descripcion}</p>
          <a href={datos.accion.href} className="hero__button">
            {datos.accion.etiqueta}
            <FontAwesomeIcon icon={faArrowDown} aria-hidden="true" />
          </a>
        </div>
      </div>
    </header>
  );
}

export default Presentacion;
