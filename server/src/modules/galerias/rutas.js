import { Router } from "express";
import multer from "multer";
import { ErrorAplicacion } from "../../errores.js";
import { crearRutasImagenes, eliminarImagen, procesarYGuardarImagen } from "../imagenes/imagenes.js";
import { obtenerRecursoGaleria } from "./recursos.js";
import { crearRepositorioGaleria } from "./repositorio.js";
import { validarIdGaleria, validarMetadatosGaleria, validarPaginacion } from "./validacion.js";

const recibirArchivo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 5, parts: 6, fieldNameSize: 100, fieldSize: 24 * 1024 },
}).single("imagen");

function recibirImagen(peticion, respuesta, siguiente) {
  recibirArchivo(peticion, respuesta, (error) => {
    if (!error) return siguiente();
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return siguiente(new ErrorAplicacion(413, "IMAGEN_DEMASIADO_GRANDE", "La imagen no puede superar 8 MB."));
    }
    return siguiente(new ErrorAplicacion(400, "SUBIDA_NO_VALIDA",
      "La subida no es válida. Envía una imagen y los campos permitidos."));
  });
}

async function limpiarImagen(nombreArchivo, directorioImagenes, operacion, registroId) {
  try {
    await eliminarImagen(nombreArchivo, directorioImagenes);
  } catch {
    console.error("No se pudo eliminar una imagen; revisar archivos huérfanos.", { operacion, registroId });
  }
}

/** Autenticación y CSRF se comprueban antes de interpretar cualquier subida. */
export function crearRutasGaleria({ recurso, pool, directorioImagenes, exigirAdmin, exigirCsrf }) {
  const { tabla, singular } = obtenerRecursoGaleria(recurso);
  const repositorio = crearRepositorioGaleria(recurso);
  const rutas = Router();
  const rutaPublica = `/api/${tabla}`;
  const rutaAdmin = `/api/admin/${tabla}`;
  const validarId = (valor) => validarIdGaleria(valor, recurso);
  const validarMetadatos = (cuerpo, opciones) => validarMetadatosGaleria(cuerpo, opciones, recurso);

  rutas.get(rutaPublica, async (peticion, respuesta) => {
    respuesta.set("Cache-Control", "no-store");
    respuesta.json(await repositorio.listar(pool, validarPaginacion(peticion.query, 12)));
  });
  rutas.get(rutaAdmin, exigirAdmin, async (peticion, respuesta) => {
    respuesta.set("Cache-Control", "no-store");
    respuesta.json(await repositorio.listar(pool, validarPaginacion(peticion.query, 20), { publico: false }));
  });
  rutas.post(rutaAdmin, exigirAdmin, exigirCsrf, recibirImagen, async (peticion, respuesta) => {
    const datos = validarMetadatos(peticion.body ?? {});
    if (!peticion.file) {
      throw new ErrorAplicacion(400, "IMAGEN_REQUERIDA", `Selecciona una imagen para la ${singular}.`);
    }
    const imagen = await procesarYGuardarImagen(peticion.file, directorioImagenes);
    let registro;
    try {
      registro = await repositorio.crear(pool, datos, imagen);
    } catch (error) {
      if (!error.conservarArchivo) await limpiarImagen(imagen.nombreArchivo, directorioImagenes, "compensar-creacion");
      throw error;
    }
    respuesta.status(201).json({ datos: registro });
  });
  rutas.put(`${rutaAdmin}/:id`, exigirAdmin, exigirCsrf, recibirImagen, async (peticion, respuesta) => {
    const id = validarId(peticion.params.id);
    const datos = validarMetadatos(peticion.body ?? {}, { parcial: true });
    if (!peticion.file && Object.keys(datos).length === 0) {
      throw new ErrorAplicacion(400, "CAMBIOS_REQUERIDOS", "Indica los datos que quieres modificar.");
    }
    const imagen = peticion.file ? await procesarYGuardarImagen(peticion.file, directorioImagenes) : null;
    let resultado;
    try {
      resultado = await repositorio.editar(pool, id, datos, imagen);
    } catch (error) {
      if (imagen && !error.conservarArchivo) {
        await limpiarImagen(imagen.nombreArchivo, directorioImagenes, "compensar-edicion", id);
      }
      throw error;
    }
    if (resultado.archivoAnterior) await limpiarImagen(resultado.archivoAnterior, directorioImagenes, "reemplazo", id);
    respuesta.json({ datos: resultado.registro });
  });
  rutas.delete(`${rutaAdmin}/:id`, exigirAdmin, exigirCsrf, async (peticion, respuesta) => {
    const id = validarId(peticion.params.id);
    const resultado = await repositorio.borrar(pool, id);
    await limpiarImagen(resultado.archivoAnterior, directorioImagenes, "borrado", id);
    respuesta.json({ datos: { id } });
  });

  rutas.use(crearRutasImagenes({ pool, directorioImagenes, recurso }));
  return rutas;
}
