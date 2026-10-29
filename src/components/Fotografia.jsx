import { fotografias as fotografiasIniciales } from "../data/fotografias";

/** Presenta las fotografías publicadas o un mensaje si la colección sigue vacía.
 * @param {{fotografias?: import("../data/fotografias").Fotografia[]}} propiedades
 */
function Fotografia({ fotografias = fotografiasIniciales }) {
  // filter crea un nuevo array: el orden de los datos originales no se modifica.
  const fotografiasPublicadas = fotografias
    .filter((fotografia) => fotografia.estado === "publicado")
    .sort((primera, segunda) => primera.orden - segunda.orden || primera.id - segunda.id);

  return (
    <section className="content-section photography" id="fotografia" aria-labelledby="fotografia-titulo">
      <div className="container">
        <p className="content-section__eyebrow">Fotografía</p>
        <h2 className="content-section__title" id="fotografia-titulo">
          Una mirada personal
        </h2>

        {fotografiasPublicadas.length > 0 ? (
          <div className="photography__grid">
            {fotografiasPublicadas.map((fotografia) => (
              <figure className="photography__item" key={fotografia.id}>
                <img
                  className="photography__image"
                  src={fotografia.imagen}
                  alt={fotografia.imagenAlt}
                  loading="lazy"
                  decoding="async"
                />
                <figcaption>
                  <h3>{fotografia.titulo}</h3>
                  {fotografia.descripcion && <p>{fotografia.descripcion}</p>}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="content-section__text">Todavía no hay fotografías publicadas.</p>
        )}
      </div>
    </section>
  );
}

export default Fotografia;
