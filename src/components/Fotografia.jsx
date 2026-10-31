import { useFotografias } from "../hooks/useFotografias";

/** La API es el origen habitual. Una colección explícita permite reutilizar y probar la vista sin red.
 * @param {{fotografias?: import("../data/fotografias").Fotografia[]}} propiedades
 */
function Fotografia({ fotografias }) {
  const consulta = useFotografias({ activa: fotografias === undefined });
  const usaApi = fotografias === undefined;
  const coleccion = usaApi ? consulta.fotografias : fotografias;
  // filter crea un nuevo array: el orden de los datos originales no se modifica.
  const fotografiasPublicadas = coleccion
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
          <div className="photography__grid" aria-busy={usaApi && consulta.cargando}>
            {fotografiasPublicadas.map((fotografia) => (
              <figure className="photography__item" key={fotografia.id}>
                <img
                  className="photography__image"
                  src={fotografia.imagen}
                  alt={fotografia.imagenAlt}
                  loading="lazy"
                  decoding="async"
                  width={fotografia.ancho || undefined}
                  height={fotografia.alto || undefined}
                />
                <figcaption>
                  <h3>{fotografia.titulo}</h3>
                  {fotografia.descripcion && <p>{fotografia.descripcion}</p>}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (!usaApi || (!consulta.cargando && !consulta.error)) && (
          <p className="content-section__text">Todavía no hay fotografías publicadas.</p>
        )}

        {usaApi && consulta.cargando && <p className="content-section__text mt-4" role="status">Cargando fotografías…</p>}
        {usaApi && consulta.error && (
          <div className="mt-4" role="alert">
            <p className="content-section__text">{consulta.error}</p>
            <button className="btn btn-outline-secondary" type="button" onClick={consulta.reintentar}>
              Reintentar
            </button>
          </div>
        )}
        {usaApi && consulta.hayMas && !consulta.error && (
          <button className="btn btn-outline-secondary mt-4" type="button"
            onClick={consulta.cargarMas} disabled={consulta.cargando}>
            {consulta.cargando ? "Cargando…" : "Cargar más fotografías"}
          </button>
        )}
      </div>
    </section>
  );
}

export default Fotografia;
