import { cargarConfiguracion } from "../src/configuracion.js";
import { crearPool } from "../src/base-datos.js";
import { proyectosIniciales } from "../semillas/proyectos-iniciales.js";

// Esta copia de los datos antiguos solo sirve para la importación, no para alimentar la web.
const configuracion = cargarConfiguracion();
const pool = crearPool(configuracion.baseDatos);
const conexion = await pool.getConnection();
try {
  await conexion.beginTransaction();
  const [aplicadas] = await conexion.execute(
    "SELECT nombre FROM importaciones_datos WHERE nombre = ? FOR UPDATE", ["proyectos_iniciales_v1"],
  );
  if (aplicadas.length) {
    await conexion.rollback();
    console.log("La importación ya estaba aplicada. Se conservan las ediciones y los borrados del panel.");
  } else {
    let importados = 0;
    for (const proyecto of proyectosIniciales) {
      const [existentes] = await conexion.execute("SELECT id FROM proyectos WHERE slug = ?", [proyecto.slug]);
      if (existentes.length) continue;
      const [resultado] = await conexion.execute(
        "INSERT INTO proyectos (slug, titulo, descripcion, categoria, imagen_externa, imagen_alt, orden, estado, url_proyecto, url_repositorio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [proyecto.slug, proyecto.titulo, proyecto.descripcion, proyecto.categoria, proyecto.imagen,
          proyecto.imagenAlt, proyecto.orden, proyecto.estado, proyecto.urlProyecto, proyecto.urlRepositorio],
      );
      for (const [orden, nombre] of proyecto.tecnologias.entries()) {
        const [tecnologia] = await conexion.query(
          "INSERT INTO tecnologias (nombre) VALUES (?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)", [nombre],
        );
        await conexion.execute(
          "INSERT INTO proyecto_tecnologia (proyecto_id, tecnologia_id, orden) VALUES (?, ?, ?)",
          [resultado.insertId, tecnologia.insertId, orden],
        );
      }
      importados += 1;
    }
    await conexion.execute("INSERT INTO importaciones_datos (nombre) VALUES (?)", ["proyectos_iniciales_v1"]);
    await conexion.commit();
    console.log("Proyectos importados: " + importados + ". A partir de ahora se gestionan desde MySQL y el panel.");
  }
} catch (error) {
  await conexion.rollback();
  console.error("No se pudo completar la importación:", error.code || error.name);
  process.exitCode = 1;
} finally {
  conexion.release();
  await pool.end();
}
