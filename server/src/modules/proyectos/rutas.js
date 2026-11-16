import { Router } from "express";
import multer from "multer";
import { ErrorAplicacion } from "../../errores.js";
import { crearRutasImagenes, eliminarImagen, procesarYGuardarImagen } from "../imagenes/imagenes.js";
import { borrarProyecto, crearProyecto, editarProyecto, listarProyectos } from "./repositorio.js";
import {
  validarArchivosDetalle, validarEleccionImagen, validarIdProyecto, validarMetadatosProyecto, validarPaginacionProyectos,
} from "./validacion.js";

const recibirArchivo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 9, fields: 13, parts: 22, fieldNameSize: 100, fieldSize: 32 * 1024 },
}).fields([{ name: "imagen", maxCount: 1 }, { name: "imagenesDetalleArchivos", maxCount: 8 }]);

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

async function limpiarImagenes(nombres, directorioImagenes, operacion, proyectoId) {
  for (const nombre of nombres) await limpiarImagen(nombre, directorioImagenes, operacion, proyectoId);
}

async function procesarImagenes(peticion, directorioImagenes) {
  const guardadas = [];
  try {
    const portada = peticion.files?.imagen?.[0];
    const imagen = portada ? await procesarYGuardarImagen(portada, directorioImagenes) : null;
    if (imagen) guardadas.push(imagen.nombreArchivo);
    const detalles = [];
    for (const archivo of peticion.files?.imagenesDetalleArchivos ?? []) {
      const detalle = await procesarYGuardarImagen(archivo, directorioImagenes);
      guardadas.push(detalle.nombreArchivo);
      detalles.push(detalle);
    }
    return { imagen, detalles, guardadas };
  } catch (error) {
    await limpiarImagenes(guardadas, directorioImagenes, "compensar-procesado");
    throw error;
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
    validarEleccionImagen(datos, peticion.files?.imagen?.[0]);
    validarArchivosDetalle(datos, peticion.files?.imagenesDetalleArchivos);
    const { imagen, detalles, guardadas } = await procesarImagenes(peticion, directorioImagenes);
    let proyecto;
    try {
      proyecto = await crearProyecto(pool, datos, imagen, detalles);
    } catch (error) {
      if (!error.conservarArchivo) await limpiarImagenes(guardadas, directorioImagenes, "compensar-creacion");
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
    validarEleccionImagen(datos, peticion.files?.imagen?.[0], { parcial: true });
    validarArchivosDetalle(datos, peticion.files?.imagenesDetalleArchivos);
    if (!peticion.files?.imagen?.length && !Object.keys(datos).length) {
      throw new ErrorAplicacion(400, "CAMBIOS_REQUERIDOS", "Indica los datos que quieres modificar.");
    }
    const { imagen, detalles, guardadas } = await procesarImagenes(peticion, directorioImagenes);
    let resultado;
    try {
      resultado = await editarProyecto(pool, id, datos, imagen, detalles);
    } catch (error) {
      if (!error.conservarArchivo) await limpiarImagenes(guardadas, directorioImagenes, "compensar-edicion", id);
      throw error;
    }
    await limpiarImagenes(resultado.archivosAnteriores, directorioImagenes, "reemplazo", id);
    respuesta.json({ datos: resultado.proyecto });
  });

  rutas.delete("/api/admin/proyectos/:id", exigirAdmin, exigirCsrf, async (peticion, respuesta) => {
    const id = validarIdProyecto(peticion.params.id);
    const resultado = await borrarProyecto(pool, id);
    await limpiarImagenes(resultado.archivosAnteriores, directorioImagenes, "borrado", id);
    respuesta.json({ datos: { id } });
  });

  rutas.use(crearRutasImagenes({ pool, directorioImagenes, recurso: "proyectos" }));
  return rutas;
}
