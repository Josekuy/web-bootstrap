function ProjectCard({ proyecto }) {
  return (
    // col-md-4 significa: en pantallas medianas (md) y grandes, ocupa 4 de las 12 columnas (es decir, 3 tarjetas por fila).
    <div className="col-md-4">
       {/* Tarjeta (Card) de Bootstrap:
                - h-100: Fuerza a que todas las tarjetas midan exactamente la misma altura aunque el texto varíe.
                - shadow-sm: Aplica una sombra suave y moderna.
                - border-0: Elimina el borde predeterminado para dejar un diseño minimalista. */}
      <div className="card h-100 shadow-sm border-0">

        {/* LA IMAGEN DE CADA PROYECTO:
                - card-img-top: Clase de Bootstrap para ajustar la imagen arriba de la tarjeta.
                - src={proyecto.imagen}: Viene directo de los datos (dinámico).
                - alt={proyecto.titulo}: OBLIGATORIO para accesibilidad (lectores de pantalla) y SEO.
                - loading="lazy": SÚPER IMPORTANTE. Le dice al navegador que no cargue 
                  la imagen hasta que el usuario haga scroll y esté a punto de verla, 
                  ahorrando datos y acelerando la web. */}
        <img
          src={proyecto.imagen}
          alt={proyecto.titulo}
          className="card-img-top"
          style={{
            height: "200px",
            objectFit: "cover"
          }}
          loading="lazy"
        />

        {/* d-flex flex-column permite distribuir los elementos internos de arriba a abajo de manera ordenada */}
        <div className="card-body d-flex flex-column">

          {/* Etiqueta (Badge) para resaltar la categoría del trabajo */}
          <span className="badge bg-success mb-3 align-self-start">
            {proyecto.categoria}
          </span>

          {/* h5 reduce ligeramente el tamaño para encajar como título secundario de tarjeta */}
          <h3 className="card-title h5 fw-bold">
            {proyecto.titulo}
          </h3>

          <p className="card-text text-muted">
            {proyecto.descripcion}
          </p>

          {/* ==========================================
                      SUB-BUCLE PARA LAS TECNOLOGÍAS
                      ========================================== 
                      Accede al array interno 'tecnologias' de cada proyecto 
                      para pintar pequeñas insignias secundarias de forma automatizada. 
                      - mt-auto: Empuja este bloque siempre hacia la parte inferior de la tarjeta. */}
                      
          <div className="mt-auto pt-3">
            {proyecto.tecnologias.map((tech, index) => (
              <span
                key={index}
                className="badge bg-light text-dark mt-1 me-1 border"
              >
                {tech}
              </span>
            ))}
          </div>

          <button className="btn btn-outline-dark mt-3 w-100">
            Ver Detalles
          </button>

        </div>
      </div>
    </div>
  );
}

export default ProjectCard;