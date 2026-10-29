import { sobreMi } from "../data/contenido";

/** Muestra la biografía desde los datos, sin mezclar el texto con la estructura visual.
 * @param {{datos?: import("../data/contenido").TextoSeccion}} propiedades
 */
function SobreMi({ datos = sobreMi }) {
  return (
    <section className="content-section" id="sobre-mi" aria-labelledby="sobre-mi-titulo">
      <div className="container">
        <p className="content-section__eyebrow">{datos.etiqueta}</p>
        <h2 className="content-section__title" id="sobre-mi-titulo">
          {datos.titulo}
        </h2>
        <p className="content-section__text">{datos.descripcion}</p>
      </div>
    </section>
  );
}

export default SobreMi;
