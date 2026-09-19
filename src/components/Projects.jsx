import { proyectos } from "../data/proyectos";
import ProjectCard from "./ProjectCard";

function Projects() {
  return (
    <section className="projects" id="proyectos">

      <div className="container">

        <div className="projects__header">

          <div>
            <p className="projects__eyebrow">
              Selected work
            </p>

            <h2 className="projects__title">
              Proyectos
            </h2>
          </div>

          <p className="projects__intro">
            Una selección de trabajos de diseño gráfico,
            branding y desarrollo web.
          </p>

        </div>

        <div className="projects__grid">

          {proyectos.map((proyecto) => (
            <ProjectCard
              key={proyecto.id}
              proyecto={proyecto}
            />
          ))}

        </div>

      </div>

    </section>
  );
}

export default Projects;