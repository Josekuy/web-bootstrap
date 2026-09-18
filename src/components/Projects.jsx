import { proyectos } from "../data/proyectos";
import ProjectCard from "./ProjectCard";

function Projects() {
  return (
    <main className="container my-5" id="proyectos">

      <h2 className="text-center mb-5">
        Proyectos Destacados
      </h2>

      <div className="row g-4">
        {proyectos.map((proyecto) => (
          <ProjectCard
            key={proyecto.id}
            proyecto={proyecto}
          />
        ))}
      </div>

    </main>
  );
}

export default Projects;