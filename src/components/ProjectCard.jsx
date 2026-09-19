function ProjectCard({ proyecto }) {
  return (
    <article className="project-card">

      <div className="project-card__image-wrapper">

        <img
          src={proyecto.imagen}
          alt={proyecto.titulo}
          className="project-card__image"
          loading="lazy"
        />

      </div>

      <div className="project-card__body">

        <div className="project-card__meta">
          <span>{proyecto.categoria}</span>
          <span>#{String(proyecto.id).padStart(2, "0")}</span>
        </div>

        <h3 className="project-card__title">
          {proyecto.titulo}
        </h3>

        <p className="project-card__description">
          {proyecto.descripcion}
        </p>

        <div className="project-card__technologies">

          {proyecto.tecnologias.map((tech, index) => (
            <span key={index}>
              {tech}
            </span>
          ))}

        </div>

        <button
          type="button"
          className="project-card__button"
        >
          Ver proyecto <span>↗</span>
        </button>

      </div>

    </article>
  );
}

export default ProjectCard;