import { ErrorAplicacion } from "../../errores.js";

const COLUMNAS = "id, slug, titulo, descripcion, categoria, nombre_archivo, imagen_externa, imagen_alt, orden, estado, ancho, alto, tamano, url_proyecto, url_repositorio, fecha_creacion, fecha_actualizacion";

/** La portada conserva el formato de las tarjetas, sin conocer rutas de disco. */
export function convertirProyecto(fila, tecnologias = []) {
  return {
    id: Number(fila.id),
    slug: fila.slug,
    titulo: fila.titulo,
    descripcion: fila.descripcion,
    categoria: fila.categoria,
    tecnologias,
    imagen: fila.nombre_archivo ? `/api/imagenes/proyectos/${fila.nombre_archivo}` : fila.imagen_externa,
    imagenExterna: fila.imagen_externa ?? null,
    imagenAlt: fila.imagen_alt,
    orden: Number(fila.orden),
    estado: fila.estado,
    ancho: fila.ancho === null || fila.ancho === undefined ? null : Number(fila.ancho),
    alto: fila.alto === null || fila.alto === undefined ? null : Number(fila.alto),
    creadoEn: fila.fecha_creacion instanceof Date ? fila.fecha_creacion.toISOString() : fila.fecha_creacion,
    actualizadoEn: fila.fecha_actualizacion instanceof Date ? fila.fecha_actualizacion.toISOString() : fila.fecha_actualizacion,
    urlProyecto: fila.url_proyecto ?? null,
    urlRepositorio: fila.url_repositorio ?? null,
  };
}

async function cargarTecnologias(conexion, identificadores) {
  const resultado = new Map(identificadores.map((id) => [Number(id), []]));
  if (!identificadores.length) return resultado;
  const marcadores = identificadores.map(() => "?").join(", ");
  // Una consulta por página evita consultar las tecnologías tarjeta a tarjeta.
  const [filas] = await conexion.execute(
    "SELECT pt.proyecto_id, t.nombre FROM proyecto_tecnologia pt INNER JOIN tecnologias t ON t.id = pt.tecnologia_id " +
      `WHERE pt.proyecto_id IN (${marcadores}) ORDER BY pt.proyecto_id ASC, pt.orden ASC, t.id ASC`,
    identificadores,
  );
  for (const fila of filas) resultado.get(Number(fila.proyecto_id))?.push(fila.nombre);
  return resultado;
}

export async function listarProyectos(pool, { pagina, limite, desplazamiento }, { publico = true } = {}) {
  const filtro = publico ? " WHERE estado = ?" : "";
  const parametros = publico ? ["publicado"] : [];
  const [recuento] = await pool.execute(`SELECT COUNT(*) AS total FROM proyectos${filtro}`, parametros);
  const [filas] = await pool.query(
    `SELECT ${COLUMNAS} FROM proyectos${filtro} ORDER BY orden ASC, id ASC LIMIT ? OFFSET ?`,
    [...parametros, limite, desplazamiento],
  );
  const tecnologias = await cargarTecnologias(pool, filas.map((fila) => fila.id));
  return {
    datos: filas.map((fila) => convertirProyecto(fila, tecnologias.get(Number(fila.id)))),
    meta: { pagina, limite, total: Number(recuento[0].total) },
  };
}

async function ejecutarTransaccion(pool, operacion) {
  const conexion = await pool.getConnection();
  let iniciada = false;
  let confirmacionIniciada = false;
  try {
    await conexion.beginTransaction();
    iniciada = true;
    const resultado = await operacion(conexion);
    confirmacionIniciada = true;
    await conexion.commit();
    return resultado;
  } catch (error) {
    let restauracionFallida = false;
    if (iniciada) {
      try {
        await conexion.rollback();
      } catch {
        restauracionFallida = true;
        console.error("No se ha podido confirmar la restauración de una operación de proyecto.");
      }
    }
    if (confirmacionIniciada || restauracionFallida) {
      const errorConfirmacion = new ErrorAplicacion(
        503,
        "GUARDADO_NO_CONFIRMADO",
        "No se ha podido confirmar la operación. Actualiza el listado antes de volver a intentarlo.",
      );
      errorConfirmacion.conservarArchivo = true;
      console.error("Una operación de proyecto requiere comprobar su resultado y posibles archivos huérfanos.");
      throw errorConfirmacion;
    }
    throw error;
  } finally {
    conexion.release();
  }
}

async function leerProyecto(conexion, id, { bloquear = false } = {}) {
  const [filas] = await conexion.execute(
    `SELECT ${COLUMNAS} FROM proyectos WHERE id = ?${bloquear ? " FOR UPDATE" : ""}`,
    [id],
  );
  if (!filas.length) throw new ErrorAplicacion(404, "PROYECTO_NO_ENCONTRADO", "No se ha encontrado el proyecto.");
  return filas[0];
}

async function leerProyectoCompleto(conexion, id) {
  const fila = await leerProyecto(conexion, id);
  const tecnologias = await cargarTecnologias(conexion, [id]);
  return convertirProyecto(fila, tecnologias.get(Number(id)));
}

async function escribirProyecto(conexion, consulta, valores) {
  try {
    return await conexion.execute(consulta, valores);
  } catch (error) {
    // En esta tabla el dato único elegido por el usuario es el slug; los
    // nombres de archivo se generan en el servidor con UUID.
    if (error.code === "ER_DUP_ENTRY") {
      throw new ErrorAplicacion(409, "SLUG_DUPLICADO", "Ya existe un proyecto con ese slug.", { slug: "Elige un slug diferente." });
    }
    throw error;
  }
}

async function sustituirTecnologias(conexion, proyectoId, tecnologias) {
  await conexion.execute("DELETE FROM proyecto_tecnologia WHERE proyecto_id = ?", [proyectoId]);
  const identificadores = new Set();
  for (const [orden, nombre] of tecnologias.entries()) {
    const [resultado] = await conexion.execute(
      "INSERT INTO tecnologias (nombre) VALUES (?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)",
      [nombre],
    );
    const tecnologiaId = Number(resultado.insertId);
    // La colación de MySQL puede considerar equivalentes nombres con tildes.
    // Se informa del campo, en vez de atribuir la colisión al slug del proyecto.
    if (identificadores.has(tecnologiaId)) {
      throw new ErrorAplicacion(400, "DATOS_NO_VALIDOS", "Revisa las tecnologías del proyecto.", {
        tecnologias: "No puede contener nombres equivalentes repetidos.",
      });
    }
    identificadores.add(tecnologiaId);
    await conexion.execute(
      "INSERT INTO proyecto_tecnologia (proyecto_id, tecnologia_id, orden) VALUES (?, ?, ?)",
      [proyectoId, tecnologiaId, orden],
    );
  }
}

export function crearProyecto(pool, datos, imagen) {
  return ejecutarTransaccion(pool, async (conexion) => {
    const [resultado] = await escribirProyecto(
      conexion,
      "INSERT INTO proyectos (slug, titulo, descripcion, categoria, nombre_archivo, imagen_externa, imagen_alt, orden, estado, ancho, alto, tamano, url_proyecto, url_repositorio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        datos.slug, datos.titulo, datos.descripcion, datos.categoria, imagen?.nombreArchivo ?? null,
        imagen ? null : datos.imagenExterna, datos.imagenAlt, datos.orden, datos.estado,
        imagen?.ancho ?? null, imagen?.alto ?? null, imagen?.tamano ?? null, datos.urlProyecto, datos.urlRepositorio,
      ],
    );
    await sustituirTecnologias(conexion, resultado.insertId, datos.tecnologias);
    return leerProyectoCompleto(conexion, resultado.insertId);
  });
}

export function editarProyecto(pool, id, datos, imagen) {
  return ejecutarTransaccion(pool, async (conexion) => {
    const actual = await leerProyecto(conexion, id, { bloquear: true });
    const valores = {
      slug: actual.slug, titulo: actual.titulo, descripcion: actual.descripcion, categoria: actual.categoria,
      imagenAlt: actual.imagen_alt, orden: actual.orden, estado: actual.estado,
      urlProyecto: actual.url_proyecto, urlRepositorio: actual.url_repositorio,
      ...datos,
    };

    let nombreArchivo = actual.nombre_archivo;
    let imagenExterna = actual.imagen_externa;
    let ancho = actual.ancho;
    let alto = actual.alto;
    let tamano = actual.tamano;
    if (imagen) {
      nombreArchivo = imagen.nombreArchivo;
      imagenExterna = null;
      ({ ancho, alto, tamano } = imagen);
    } else if (Object.hasOwn(datos, "imagenExterna")) {
      imagenExterna = datos.imagenExterna;
      if (imagenExterna) {
        nombreArchivo = null;
        ancho = null;
        alto = null;
        tamano = null;
      }
    }

    if (!nombreArchivo && !imagenExterna) {
      throw new ErrorAplicacion(400, "IMAGEN_REQUERIDA", "El proyecto debe conservar una imagen o una URL HTTPS.");
    }

    await escribirProyecto(
      conexion,
      "UPDATE proyectos SET slug = ?, titulo = ?, descripcion = ?, categoria = ?, nombre_archivo = ?, imagen_externa = ?, imagen_alt = ?, orden = ?, estado = ?, ancho = ?, alto = ?, tamano = ?, url_proyecto = ?, url_repositorio = ? WHERE id = ?",
      [
        valores.slug, valores.titulo, valores.descripcion, valores.categoria, nombreArchivo, imagenExterna,
        valores.imagenAlt, valores.orden, valores.estado, ancho, alto, tamano, valores.urlProyecto, valores.urlRepositorio, id,
      ],
    );
    if (Object.hasOwn(datos, "tecnologias")) await sustituirTecnologias(conexion, id, datos.tecnologias);
    return {
      proyecto: await leerProyectoCompleto(conexion, id),
      archivoAnterior: actual.nombre_archivo && actual.nombre_archivo !== nombreArchivo ? actual.nombre_archivo : null,
    };
  });
}

export function borrarProyecto(pool, id) {
  return ejecutarTransaccion(pool, async (conexion) => {
    const actual = await leerProyecto(conexion, id, { bloquear: true });
    await conexion.execute("DELETE FROM proyectos WHERE id = ?", [id]);
    return { id, archivoAnterior: actual.nombre_archivo };
  });
}
