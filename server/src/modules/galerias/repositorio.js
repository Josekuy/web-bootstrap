import { ErrorAplicacion } from "../../errores.js";
import { obtenerRecursoGaleria } from "./recursos.js";

const COLUMNAS = "id, titulo, descripcion, nombre_archivo, imagen_alt, orden, estado, ancho, alto, tamano, fecha_creacion, fecha_actualizacion";

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
        console.error("No se ha podido confirmar la restauración de una operación de galería.");
      }
    }
    if (confirmacionIniciada || restauracionFallida) {
      // Un commit interrumpido puede haberse aplicado. No se borra la imagen nueva.
      const errorConfirmacion = new ErrorAplicacion(
        503, "GUARDADO_NO_CONFIRMADO",
        "No se ha podido confirmar la operación. Actualiza el listado antes de volver a intentarlo.",
      );
      errorConfirmacion.conservarArchivo = true;
      console.error("Una operación de galería requiere comprobar su resultado y posibles archivos huérfanos.");
      throw errorConfirmacion;
    }
    throw error;
  } finally {
    conexion.release();
  }
}

/** Cada repositorio se construye con una de las dos constantes de la whitelist. */
export function crearRepositorioGaleria(recurso) {
  const { tabla, singular, codigoNoEncontrada } = obtenerRecursoGaleria(recurso);

  function convertir(fila) {
    return {
      id: Number(fila.id),
      titulo: fila.titulo,
      descripcion: fila.descripcion,
      imagen: `/api/imagenes/${tabla}/${fila.nombre_archivo}`,
      imagenAlt: fila.imagen_alt,
      orden: Number(fila.orden),
      estado: fila.estado,
      ancho: Number(fila.ancho),
      alto: Number(fila.alto),
      creadoEn: fila.fecha_creacion instanceof Date ? fila.fecha_creacion.toISOString() : fila.fecha_creacion,
      actualizadoEn: fila.fecha_actualizacion instanceof Date ? fila.fecha_actualizacion.toISOString() : fila.fecha_actualizacion,
    };
  }

  async function listar(pool, { pagina, limite, desplazamiento }, { publico = true } = {}) {
    const filtro = publico ? " WHERE estado = ?" : "";
    const parametros = publico ? ["publicado"] : [];
    const [recuento] = await pool.execute(`SELECT COUNT(*) AS total FROM ${tabla}${filtro}`, parametros);
    // query escapa LIMIT/OFFSET como enteros después de validar la paginación.
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS} FROM ${tabla}${filtro} ORDER BY orden ASC, id ASC LIMIT ? OFFSET ?`,
      [...parametros, limite, desplazamiento],
    );
    return {
      datos: filas.map(convertir),
      meta: { pagina, limite, total: Number(recuento[0].total) },
    };
  }

  async function leer(conexion, id, { bloquear = false } = {}) {
    const [filas] = await conexion.execute(
      `SELECT ${COLUMNAS} FROM ${tabla} WHERE id = ?${bloquear ? " FOR UPDATE" : ""}`, [id],
    );
    if (!filas.length) {
      throw new ErrorAplicacion(404, codigoNoEncontrada, `No se ha encontrado la ${singular}.`);
    }
    return filas[0];
  }

  function crear(pool, datos, imagen) {
    return ejecutarTransaccion(pool, async (conexion) => {
      const [resultado] = await conexion.execute(
        `INSERT INTO ${tabla} (titulo, descripcion, nombre_archivo, imagen_alt, orden, estado, ancho, alto, tamano) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [datos.titulo, datos.descripcion, imagen.nombreArchivo, datos.imagenAlt, datos.orden, datos.estado, imagen.ancho, imagen.alto, imagen.tamano],
      );
      return convertir(await leer(conexion, resultado.insertId));
    });
  }

  function editar(pool, id, datos, imagen) {
    return ejecutarTransaccion(pool, async (conexion) => {
      const actual = await leer(conexion, id, { bloquear: true });
      const valores = {
        titulo: actual.titulo, descripcion: actual.descripcion, imagenAlt: actual.imagen_alt,
        orden: actual.orden, estado: actual.estado, ...datos,
      };
      await conexion.execute(
        `UPDATE ${tabla} SET titulo = ?, descripcion = ?, nombre_archivo = ?, imagen_alt = ?, orden = ?, estado = ?, ancho = ?, alto = ?, tamano = ? WHERE id = ?`,
        [
          valores.titulo, valores.descripcion, imagen?.nombreArchivo ?? actual.nombre_archivo,
          valores.imagenAlt, valores.orden, valores.estado,
          imagen?.ancho ?? actual.ancho, imagen?.alto ?? actual.alto, imagen?.tamano ?? actual.tamano, id,
        ],
      );
      return {
        registro: convertir(await leer(conexion, id)),
        archivoAnterior: imagen ? actual.nombre_archivo : null,
      };
    });
  }

  function borrar(pool, id) {
    return ejecutarTransaccion(pool, async (conexion) => {
      const actual = await leer(conexion, id, { bloquear: true });
      await conexion.execute(`DELETE FROM ${tabla} WHERE id = ?`, [id]);
      return { id, archivoAnterior: actual.nombre_archivo };
    });
  }

  return { convertir, listar, crear, editar, borrar };
}
