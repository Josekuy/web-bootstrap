import { contacto } from "../data/contenido";
import { obtenerEnlaceWeb } from "../utils/enlaces";

/** Muestra únicamente los canales configurados y evita enlaces vacíos o no válidos.
 * @param {{datos?: import("../data/contenido").DatosContacto}} propiedades
 */
function Contacto({ datos = contacto }) {
  // Se evita incorporar parámetros o saltos de línea en el enlace mailto.
  const correo = typeof datos.correo === "string" ? datos.correo.trim() : "";
  const correoValido = /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/u.test(correo);
  const enlaces = datos.enlaces
    .map((enlace) => ({ ...enlace, url: obtenerEnlaceWeb(enlace.url) }))
    .filter((enlace) => enlace.url !== null);
  const hayContacto = correoValido || enlaces.length > 0;

  return (
    <section className="content-section" id="contacto" aria-labelledby="contacto-titulo">
      <div className="container">
        <p className="content-section__eyebrow">{datos.etiqueta}</p>
        <h2 className="content-section__title" id="contacto-titulo">
          {datos.titulo}
        </h2>
        <p className="content-section__text">{datos.descripcion}</p>

        {hayContacto ? (
          <div>
            {correoValido && (
              <p className="content-section__text">
                <a href={`mailto:${correo}`}>{correo}</a>
              </p>
            )}

            {enlaces.length > 0 && (
              <ul className="content-section__links">
                {enlaces.map((enlace) => (
                  <li key={enlace.id}>
                    <a href={enlace.url}>{enlace.etiqueta}</a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="content-section__text">Todavía no hay vías de contacto publicadas.</p>
        )}
      </div>
    </section>
  );
}

export default Contacto;
