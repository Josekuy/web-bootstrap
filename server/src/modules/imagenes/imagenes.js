import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Router } from "express";
import sharp from "sharp";
import { ErrorAplicacion } from "../../errores.js";

const MAXIMO_BYTES = 8 * 1024 * 1024;
const MAXIMO_PIXELES = 25_000_000;
const MAXIMO_LADO = 2400;
const NOMBRE_IMAGEN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/u;
const FIRMA_PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crearErrorImagenNoValida() {
  return new ErrorAplicacion(
    400,
    "IMAGEN_NO_VALIDA",
    "Selecciona una imagen JPEG, PNG o WebP válida y sin animación.",
  );
}

function obtenerFormato(buffer) {
  if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) {
    return "jpeg";
  }

  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(FIRMA_PNG)) {
    return "png";
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }

  return null;
}

// Algunos lectores solo informan de la primera imagen de un PNG animado.
// Se recorren sus bloques para descartar acTL, sin buscar dentro de los píxeles.
function esPngAnimado(buffer) {
  let posicion = 8;

  while (posicion + 12 <= buffer.length) {
    const longitud = buffer.readUInt32BE(posicion);
    const siguiente = posicion + longitud + 12;

    if (siguiente > buffer.length) throw crearErrorImagenNoValida();

    const tipo = buffer.toString("ascii", posicion + 4, posicion + 8);
    if (tipo === "acTL") return true;
    if (tipo === "IEND") return false;

    posicion = siguiente;
  }

  return false;
}

function registrarFalloArchivo(operacion, error) {
  // Los registros no incluyen nombres, rutas locales ni contenido del archivo.
  console.error(`No se pudo ${operacion} una imagen.`, {
    codigo: typeof error?.code === "string" ? error.code : "DESCONOCIDO",
  });
}

/**
 * Comprueba el contenido real y guarda una copia WebP sin metadatos.
 * El directorio lo proporciona la configuración del servidor; el cliente nunca
 * elige un nombre de archivo ni una ruta de almacenamiento.
 *
 * @param {{buffer: Buffer} | undefined} archivo Archivo recibido por multer.
 * @param {string} directorioImagenes Directorio privado fuera de public/.
 * @returns {Promise<{nombreArchivo: string, ancho: number, alto: number, tamano: number}>}
 */
export async function procesarYGuardarImagen(archivo, directorioImagenes) {
  if (!Buffer.isBuffer(archivo?.buffer) || archivo.buffer.length === 0) {
    throw new ErrorAplicacion(400, "IMAGEN_REQUERIDA", "Selecciona una imagen.");
  }

  if (archivo.buffer.length > MAXIMO_BYTES) {
    throw new ErrorAplicacion(413, "IMAGEN_DEMASIADO_GRANDE", "La imagen no puede superar 8 MB.");
  }

  const formato = obtenerFormato(archivo.buffer);
  if (!formato || (formato === "png" && esPngAnimado(archivo.buffer))) {
    throw crearErrorImagenNoValida();
  }

  let resultado;

  try {
    // metadata no descodifica los píxeles. El límite se aplica de nuevo al
    // transformar, después de comprobar las dimensiones declaradas.
    const metadatos = await sharp(archivo.buffer, {
      failOn: "warning",
      limitInputPixels: false,
    }).metadata();

    if (
      metadatos.format !== formato ||
      !Number.isSafeInteger(metadatos.width) ||
      !Number.isSafeInteger(metadatos.height) ||
      metadatos.width < 1 ||
      metadatos.height < 1 ||
      (metadatos.pages ?? 1) !== 1 ||
      (metadatos.delay?.length ?? 0) > 1 ||
      metadatos.loop !== undefined
    ) {
      throw crearErrorImagenNoValida();
    }

    if (metadatos.width * metadatos.height > MAXIMO_PIXELES) {
      throw new ErrorAplicacion(
        413,
        "IMAGEN_DEMASIADO_GRANDE",
        "La imagen no puede superar 25 millones de píxeles.",
      );
    }

    // Sharp elimina los metadatos por defecto. rotate aplica la orientación
    // EXIF antes de obtener las dimensiones finales.
    resultado = await sharp(archivo.buffer, {
      failOn: "warning",
      limitInputPixels: MAXIMO_PIXELES,
    })
      .rotate()
      .resize({
        width: MAXIMO_LADO,
        height: MAXIMO_LADO,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
  } catch (error) {
    if (error instanceof ErrorAplicacion) throw error;
    throw crearErrorImagenNoValida();
  }

  const nombreArchivo = `${randomUUID()}.webp`;
  const ruta = join(resolve(directorioImagenes), nombreArchivo);

  try {
    await mkdir(resolve(directorioImagenes), { recursive: true });
    await writeFile(ruta, resultado.data, { flag: "wx", mode: 0o600 });
  } catch (error) {
    // Una escritura interrumpida puede dejar un archivo parcial. EEXIST no
    // pertenece a esta operación y nunca debe provocar que se borre otro archivo.
    if (error.code !== "EEXIST") {
      try {
        await unlink(ruta);
      } catch (errorLimpieza) {
        if (errorLimpieza.code !== "ENOENT") registrarFalloArchivo("limpiar", errorLimpieza);
      }
    }

    registrarFalloArchivo("guardar", error);
    throw new ErrorAplicacion(500, "IMAGEN_NO_GUARDADA", "No se ha podido guardar la imagen.");
  }

  return {
    nombreArchivo,
    ancho: resultado.info.width,
    alto: resultado.info.height,
    tamano: resultado.data.length,
  };
}

/** Borra únicamente archivos generados por este módulo; un archivo ausente ya está eliminado. */
export async function eliminarImagen(nombreArchivo, directorioImagenes) {
  if (!NOMBRE_IMAGEN.test(nombreArchivo)) {
    throw new ErrorAplicacion(500, "NOMBRE_IMAGEN_NO_VALIDO", "No se ha podido eliminar la imagen.");
  }

  try {
    await unlink(join(resolve(directorioImagenes), nombreArchivo));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function crearErrorImagenNoEncontrada() {
  return new ErrorAplicacion(404, "IMAGEN_NO_ENCONTRADA", "La imagen no está disponible.");
}

/** Entrega imágenes publicadas y permite al administrador consultar sus borradores. */
export function crearRutasImagenes({ pool, directorioImagenes, recurso = "fotografias" }) {
  // La tabla y la ruta se eligen entre constantes del servidor. Ningún dato de
  // la petición puede convertirse en un nombre de tabla o un directorio.
  if (recurso !== "fotografias" && recurso !== "proyectos") {
    throw new TypeError("El recurso de imágenes no está permitido.");
  }
  const ruta = recurso === "proyectos" ? "/api/imagenes/proyectos/:nombre" : "/api/imagenes/:nombre";
  const consulta = recurso === "proyectos"
    ? "SELECT estado FROM proyectos WHERE nombre_archivo = ? LIMIT 1"
    : "SELECT estado FROM fotografias WHERE nombre_archivo = ? LIMIT 1";
  const rutas = Router();

  rutas.get(ruta, async (solicitud, respuesta) => {
    // También las respuestas de acceso denegado deben comprobarse de nuevo.
    respuesta.set("Cache-Control", "no-store");
    const nombre = solicitud.params.nombre;
    if (!NOMBRE_IMAGEN.test(nombre)) throw crearErrorImagenNoEncontrada();

    const [filas] = await pool.execute(
      consulta,
      [nombre],
    );
    const registro = filas[0];

    if (!registro || (registro.estado !== "publicado" && !solicitud.session?.adminId)) {
      throw crearErrorImagenNoEncontrada();
    }

    respuesta.type("image/webp");

    try {
      await new Promise((resolver, rechazar) => {
        respuesta.sendFile(
          nombre,
          {
            root: resolve(directorioImagenes),
            dotfiles: "deny",
            cacheControl: false,
            lastModified: false,
            acceptRanges: false,
          },
          (error) => (error ? rechazar(error) : resolver()),
        );
      });
    } catch (error) {
      if (!respuesta.headersSent) respuesta.removeHeader("Content-Type");
      if (error.code === "ENOENT" || error.status === 404) throw crearErrorImagenNoEncontrada();
      throw error;
    }
  });

  return rutas;
}
