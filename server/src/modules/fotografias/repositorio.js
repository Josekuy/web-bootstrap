import { ErrorAplicacion } from "../../errores.js";

const COLUMNAS = "id, titulo, descripcion, nombre_archivo, imagen_alt, orden, estado, ancho, alto, tamano, fecha_creacion, fecha_actualizacion";

/** El DTO no incluye rutas privadas ni el nombre original del archivo. */
export function convertirFotografia(fila) {
  return {
    id: Number(fila.id),
    titulo: fila.titulo,
    descripcion: fila.descripcion,
    imagen: `/api/imagenes/${fila.nombre_archivo}`,
    imagenAlt: fila.imagen_alt,
    orden: Number(fila.orden),
    estado: fila.estado,
    ancho: Number(fila.ancho),
    alto: Number(fila.alto),
    creadoEn: fila.fecha_creacion instanceof Date ? fila.fecha_creacion.toISOString() : fila.fecha_creacion,
    actualizadoEn: fila.fecha_actualizacion instanceof Date ? fila.fecha_actualizacion.toISOString() : fila.fecha_actualizacion,
  };
}

export async function listarFotografias(pool, { pagina, limite, desplazamiento }, { publico = true } = {}) {
  const filtro = publico ? " WHERE estado = ?" : "";
  const parametros = publico ? ["publicado"] : [];
  const [recuento] = await pool.execute(`SELECT COUNT(*) AS total FROM fotografias${filtro}`, parametros);

  // query mantiene los valores parametrizados y escapa LIMIT/OFFSET como enteros.
  const [filas] = await pool.query(
    `SELECT ${COLUMNAS} FROM fotografias${filtro} ORDER BY orden ASC, id ASC LIMIT ? OFFSET ?`,
    [...parametros, limite, desplazamiento],
  );

  return {
    datos: filas.map(convertirFotografia),
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
        console.error("No se ha podido confirmar la restauración de una operación de fotografía.");
      }
    }

    if (confirmacionIniciada || restauracionFallida) {
      // Un corte al confirmar puede dejar la transacción aplicada. Se conserva
      // la nueva imagen para evitar borrar un archivo que la BD ya referencia.
      const errorConfirmacion = new ErrorAplicacion(
        503,
        "GUARDADO_NO_CONFIRMADO",
        "No se ha podido confirmar la operación. Actualiza el listado antes de volver a intentarlo.",
      );
      errorConfirmacion.conservarArchivo = true;
      console.error("Una operación de fotografía requiere comprobar su resultado y posibles archivos huérfanos.");
      throw errorConfirmacion;
    }

    throw error;
  } finally {
    conexion.release();
  }
}

async function leerFotografia(conexion, id, { bloquear = false } = {}) {
  const [filas] = await conexion.execute(
    `SELECT ${COLUMNAS} FROM fotografias WHERE id = ?${bloquear ? " FOR UPDATE" : ""}`,
    [id],
  );
  if (filas.length === 0) {
    throw new ErrorAplicacion(404, "FOTOGRAFIA_NO_ENCONTRADA", "No se ha encontrado la fotografía.");
  }
  return filas[0];
}

export function crearFotografia(pool, datos, imagen) {
  return ejecutarTransaccion(pool, async (conexion) => {
    const [resultado] = await conexion.execute(
      "INSERT INTO fotografias (titulo, descripcion, nombre_archivo, imagen_alt, orden, estado, ancho, alto, tamano) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [datos.titulo, datos.descripcion, imagen.nombreArchivo, datos.imagenAlt, datos.orden, datos.estado, imagen.ancho, imagen.alto, imagen.tamano],
    );
    const fila = await leerFotografia(conexion, resultado.insertId);
    return convertirFotografia(fila);
  });
}

export function editarFotografia(pool, id, datos, imagen) {
  return ejecutarTransaccion(pool, async (conexion) => {
    const actual = await leerFotografia(conexion, id, { bloquear: true });
    const valores = {
      titulo: actual.titulo,
      descripcion: actual.descripcion,
      imagenAlt: actual.imagen_alt,
      orden: actual.orden,
      estado: actual.estado,
      ...datos,
    };

    await conexion.execute(
      "UPDATE fotografias SET titulo = ?, descripcion = ?, nombre_archivo = ?, imagen_alt = ?, orden = ?, estado = ?, ancho = ?, alto = ?, tamano = ? WHERE id = ?",
      [
        valores.titulo,
        valores.descripcion,
        imagen?.nombreArchivo ?? actual.nombre_archivo,
        valores.imagenAlt,
        valores.orden,
        valores.estado,
        imagen?.ancho ?? actual.ancho,
        imagen?.alto ?? actual.alto,
        imagen?.tamano ?? actual.tamano,
        id,
      ],
    );

    return {
      fotografia: convertirFotografia(await leerFotografia(conexion, id)),
      archivoAnterior: imagen ? actual.nombre_archivo : null,
    };
  });
}

export function borrarFotografia(pool, id) {
  return ejecutarTransaccion(pool, async (conexion) => {
    const actual = await leerFotografia(conexion, id, { bloquear: true });
    await conexion.execute("DELETE FROM fotografias WHERE id = ?", [id]);
    return { id, archivoAnterior: actual.nombre_archivo };
  });
}
