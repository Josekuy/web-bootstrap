import { Router } from "express";
import multer from "multer";
import { ErrorAplicacion } from "../../errores.js";
import { crearRutasImagenes, eliminarImagen, procesarYGuardarImagen } from "../imagenes/imagenes.js";
import { borrarProyecto, crearProyecto, editarProyecto, listarProyectos } from "./repositorio.js";
import {
  validarEleccionImagen, validarIdProyecto, validarMetadatosProyecto, validarPaginacionProyectos,
} from "./validacion.js";

const recibirArchivo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 11, parts: 12, fieldNameSize: 100, fieldSize: 24 * 1024 },
}).single("imagen");

function recibirImagen(peticion, respuesta, siguiente) {
  recibirArchivo(peticion, respuesta, (error) => {
    if (!error) return siguiente();
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return siguiente(new ErrorAplicacion(413, "IMAGEN_DEMASIADO_GRANDE", "La imagen no puede superar 8 MB."));
    }
    return siguiente(new ErrorAplicacion(400, "SUBIDA_NO_VALIDA", "La subida no es válida. Envía una imagen y los campos permitidos."));
  });
}

async function limpiarImagen(nombreArchivo, directorioImagenes, operacion, proyectoId) {
  if (!nombreArchivo) return;
  try {
    await eliminarImagen(nombreArchivo, directorioImagenes);
  } catch {
    console.error("No se pudo eliminar una imagen de proyecto; revisar archivos huérfanos.", { operacion, proyectoId });
  }
}

/** La sesión y CSRF se verifican antes de procesar archivos o escribir en BD. */
export function crearRutasProyectos({ pool, directorioImagenes, exigirAdmin, exigirCsrf }) {
  const rutas = Router();

  rutas.get("/api/proyectos", async (peticion, respuesta) => {
    respuesta.set("Cache-Control", "no-store");
    respuesta.json(await listarProyectos(pool, validarPaginacionProyectos(peticion.query, 12)));
  });

  rutas.get("/api/admin/proyectos", exigirAdmin, async (peticion, respuesta) => {
    respuesta.set("Cache-Control", "no-store");
    respuesta.json(await listarProyectos(pool, validarPaginacionProyectos(peticion.query, 20), { publico: false }));
  });

  rutas.post("/api/admin/proyectos", exigirAdmin, exigirCsrf, recibirImagen, async (peticion, respuesta) => {
    const datos = validarMetadatosProyecto(peticion.body ?? {}, { multipart: Boolean(peticion.is("multipart/form-data")) });
    validarEleccionImagen(datos, peticion.file);
    const imagen = peticion.file ? await procesarYGuardarImagen(peticion.file, directorioImagenes) : null;
    let proyecto;
    try {
      proyecto = await crearProyecto(pool, datos, imagen);
    } catch (error) {
      if (imagen && !error.conservarArchivo) await limpiarImagen(imagen.nombreArchivo, directorioImagenes, "compensar-creacion");
      throw error;
    }
    respuesta.status(201).json({ datos: proyecto });
  });

  rutas.put("/api/admin/proyectos/:id", exigirAdmin, exigirCsrf, recibirImagen, async (peticion, respuesta) => {
    const id = validarIdProyecto(peticion.params.id);
    const datos = validarMetadatosProyecto(peticion.body ?? {}, {
      parcial: true,
      multipart: Boolean(peticion.is("multipart/form-data")),
    });
    validarEleccionImagen(datos, peticion.file, { parcial: true });
    if (!peticion.file && !Object.keys(datos).length) {
      throw new ErrorAplicacion(400, "CAMBIOS_REQUERIDOS", "Indica los datos que quieres modificar.");
    }
    const imagen = peticion.file ? await procesarYGuardarImagen(peticion.file, directorioImagenes) : null;
    let resultado;
    try {
      resultado = await editarProyecto(pool, id, datos, imagen);
    } catch (error) {
      if (imagen && !error.conservarArchivo) await limpiarImagen(imagen.nombreArchivo, directorioImagenes, "compensar-edicion", id);
      throw error;
    }
    await limpiarImagen(resultado.archivoAnterior, directorioImagenes, "reemplazo", id);
    respuesta.json({ datos: resultado.proyecto });
  });

  rutas.delete("/api/admin/proyectos/:id", exigirAdmin, exigirCsrf, async (peticion, respuesta) => {
    const id = validarIdProyecto(peticion.params.id);
    const resultado = await borrarProyecto(pool, id);
    await limpiarImagen(resultado.archivoAnterior, directorioImagenes, "borrado", id);
    respuesta.json({ datos: { id } });
  });

  rutas.use(crearRutasImagenes({ pool, directorioImagenes, recurso: "proyectos" }));
  return rutas;
}
