import { Router } from "express";
import multer from "multer";
import { ErrorAplicacion } from "../../errores.js";
import { crearRutasImagenes, eliminarImagen, procesarYGuardarImagen } from "../imagenes/imagenes.js";
import { borrarFotografia, crearFotografia, editarFotografia, listarFotografias } from "./repositorio.js";
import { validarIdFotografia, validarMetadatosFotografia, validarPaginacion } from "./validacion.js";

const recibirArchivo = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 1,
    fields: 5,
    parts: 6,
    fieldNameSize: 100,
    fieldSize: 24 * 1024,
  },
}).single("imagen");

function recibirImagen(peticion, respuesta, siguiente) {
  recibirArchivo(peticion, respuesta, (error) => {
    if (!error) return siguiente();

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return siguiente(new ErrorAplicacion(413, "IMAGEN_DEMASIADO_GRANDE", "La imagen no puede superar 8 MB."));
    }

    return siguiente(new ErrorAplicacion(
      400,
      "SUBIDA_NO_VALIDA",
      "La subida no es válida. Envía una imagen y los campos permitidos.",
    ));
  });
}

async function limpiarImagen(nombreArchivo, directorioImagenes, operacion, fotografiaId) {
  try {
    await eliminarImagen(nombreArchivo, directorioImagenes);
  } catch {
    // La respuesta de la API no revela nombres privados ni errores de disco.
    console.error("No se pudo eliminar una imagen; revisar archivos huérfanos.", { operacion, fotografiaId });
  }
}

/**
 * Crea las rutas públicas, de administración y de entrega de imágenes.
 * La autenticación y CSRF se comprueban antes de interpretar el multipart.
 */
export function crearRutasFotografias({ pool, directorioImagenes, exigirAdmin, exigirCsrf }) {
  const rutas = Router();

  rutas.get("/api/fotografias", async (peticion, respuesta) => {
    const paginacion = validarPaginacion(peticion.query, 12);
    respuesta.set("Cache-Control", "no-store");
    respuesta.json(await listarFotografias(pool, paginacion));
  });

  rutas.get("/api/admin/fotografias", exigirAdmin, async (peticion, respuesta) => {
    const paginacion = validarPaginacion(peticion.query, 20);
    respuesta.set("Cache-Control", "no-store");
    respuesta.json(await listarFotografias(pool, paginacion, { publico: false }));
  });

  rutas.post("/api/admin/fotografias", exigirAdmin, exigirCsrf, recibirImagen, async (peticion, respuesta) => {
    const datos = validarMetadatosFotografia(peticion.body ?? {});
    if (!peticion.file) {
      throw new ErrorAplicacion(400, "IMAGEN_REQUERIDA", "Selecciona una imagen para la fotografía.");
    }

    const imagen = await procesarYGuardarImagen(peticion.file, directorioImagenes);
    let fotografia;
    try {
      fotografia = await crearFotografia(pool, datos, imagen);
    } catch (error) {
      if (!error.conservarArchivo) {
        await limpiarImagen(imagen.nombreArchivo, directorioImagenes, "compensar-creacion");
      }
      throw error;
    }

    respuesta.status(201).json({ datos: fotografia });
  });

  rutas.put("/api/admin/fotografias/:id", exigirAdmin, exigirCsrf, recibirImagen, async (peticion, respuesta) => {
    const id = validarIdFotografia(peticion.params.id);
    const datos = validarMetadatosFotografia(peticion.body ?? {}, { parcial: true });
    if (!peticion.file && Object.keys(datos).length === 0) {
      throw new ErrorAplicacion(400, "CAMBIOS_REQUERIDOS", "Indica los datos que quieres modificar.");
    }

    const imagen = peticion.file
      ? await procesarYGuardarImagen(peticion.file, directorioImagenes)
      : null;
    let resultado;
    try {
      resultado = await editarFotografia(pool, id, datos, imagen);
    } catch (error) {
      if (imagen && !error.conservarArchivo) {
        await limpiarImagen(imagen.nombreArchivo, directorioImagenes, "compensar-edicion", id);
      }
      throw error;
    }

    if (resultado.archivoAnterior) {
      await limpiarImagen(resultado.archivoAnterior, directorioImagenes, "reemplazo", id);
    }
    respuesta.json({ datos: resultado.fotografia });
  });

  rutas.delete("/api/admin/fotografias/:id", exigirAdmin, exigirCsrf, async (peticion, respuesta) => {
    const id = validarIdFotografia(peticion.params.id);
    const resultado = await borrarFotografia(pool, id);
    await limpiarImagen(resultado.archivoAnterior, directorioImagenes, "borrado", id);
    respuesta.json({ datos: { id } });
  });

  rutas.use(crearRutasImagenes({ pool, directorioImagenes }));
  return rutas;
}
