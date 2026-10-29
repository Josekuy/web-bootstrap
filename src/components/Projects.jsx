import { proyectos } from "../data/proyectos";
import TarjetaProyecto from "./ProjectCard";

// Filtra y ordena una copia: el identificador del registro no determina su posición visual.
function Proyectos({ listaProyectos = proyectos }) {
  const proyectosPublicados = listaProyectos
    .filter((proyecto) => proyecto.estado === "publicado")
    .sort((primero, segundo) => primero.orden - segundo.orden || primero.id - segundo.id);

  return (
    <section className="projects" id="proyectos" aria-labelledby="titulo-proyectos">
      <div className="container">
        <div className="projects__header">
          <div>
            <p className="projects__eyebrow">Trabajos seleccionados</p>
            <h2 className="projects__title" id="titulo-proyectos">Proyectos</h2>
          </div>
          <p className="projects__intro">
            Una selección de trabajos de diseño gráfico, branding y desarrollo web.
          </p>
        </div>
        {proyectosPublicados.length > 0 ? (
          <div className="projects__grid">
            {proyectosPublicados.map((proyecto, indice) => (
              <TarjetaProyecto key={proyecto.id} proyecto={proyecto} numero={indice + 1} />
            ))}
          </div>
        ) : (
          <p className="content-section__text">Los proyectos estarán disponibles próximamente.</p>
        )}
      </div>
    </section>
  );
}

export default Proyectos;
