import { useProyectos } from "../hooks/useProyectos";
import TarjetaProyecto from "./ProjectCard";

// Una colección explícita permite probar la vista sin red; por defecto se consulta la API.
function Proyectos({ listaProyectos }) {
  const usaApi = listaProyectos === undefined;
  const consulta = useProyectos({ activa: usaApi });
  const coleccion = usaApi ? consulta.proyectos : listaProyectos;
  const proyectosPublicados = coleccion
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
          <div className="projects__grid" aria-busy={usaApi && consulta.cargando}>
            {proyectosPublicados.map((proyecto, indice) => (
              <TarjetaProyecto key={proyecto.id} proyecto={proyecto} numero={indice + 1} />
            ))}
          </div>
        ) : (!usaApi || (!consulta.cargando && !consulta.error)) && (
          <p className="content-section__text">Los proyectos estarán disponibles próximamente.</p>
        )}
        {usaApi && consulta.cargando && <p className="content-section__text mt-4" role="status">Cargando proyectos…</p>}
        {usaApi && consulta.error && (
          <div className="mt-4" role="alert">
            <p className="content-section__text">{consulta.error}</p>
            <button type="button" className="btn btn-outline-secondary" onClick={consulta.reintentar}>Reintentar proyectos</button>
          </div>
        )}
        {usaApi && consulta.hayMas && !consulta.error && (
          <button type="button" className="btn btn-outline-secondary mt-4" disabled={consulta.cargando}
            onClick={consulta.cargarMas}>
            {consulta.cargando ? "Cargando…" : "Cargar más proyectos"}
          </button>
        )}
      </div>
    </section>
  );
}

export default Proyectos;
