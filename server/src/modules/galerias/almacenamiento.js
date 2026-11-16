import { createHash, randomUUID } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import { copyFile, link, lstat, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { NOMBRE_IMAGEN } from "../imagenes/nombres.js";

async function archivoRegular(ruta) {
  let archivo;
  try {
    archivo = await lstat(ruta);
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
  if (!archivo.isFile() || archivo.isSymbolicLink()) {
    throw new Error("La migración de ilustraciones requiere archivos de imagen regulares.");
  }
  return true;
}

async function calcularHuella(ruta) {
  const huella = createHash("sha256");
  for await (const bloque of createReadStream(ruta)) huella.update(bloque);
  return huella.digest("hex");
}

async function copiarSinSobrescribir(origen, destino, huellaOrigen) {
  const temporal = path.join(path.dirname(destino), `.migracion-${randomUUID()}.tmp`);
  try {
    await copyFile(origen, temporal, constants.COPYFILE_EXCL);
    if (await calcularHuella(temporal) !== huellaOrigen) {
      throw new Error("No se ha podido verificar una copia de ilustración. Se conserva el archivo original.");
    }
    try {
      // El enlace publica una copia completa de forma exclusiva y atómica.
      // Un corte durante copyFile solo puede dejar un temporal sin publicar.
      await link(temporal, destino);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  } finally {
    try {
      await unlink(temporal);
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("No se pudo limpiar un temporal de la migración de ilustraciones.");
      }
    }
  }
}

/**
 * Traslada solo los archivos referenciados por la colección ya renombrada.
 * Puede repetirse tras una interrupción y nunca sobrescribe imágenes distintas.
 * No se ejecuta desde crearAplicacion ni desde la preparación de la base de pruebas.
 */
export async function migrarArchivosIlustraciones({ pool, directorioOrigen, directorioDestino }) {
  const origen = path.resolve(directorioOrigen);
  const destino = path.resolve(directorioDestino);
  if (origen === destino) throw new Error("Ilustraciones y fotografías necesitan carpetas diferentes.");

  let ilustraciones;
  let fotografias;
  try {
    [ilustraciones] = await pool.execute("SELECT nombre_archivo FROM ilustraciones ORDER BY id ASC");
    [fotografias] = await pool.execute("SELECT nombre_archivo FROM fotografias");
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      throw new Error("Prepara las galerías antes de iniciar la API: ejecuta npm run db:preparar.", { cause: error });
    }
    throw error;
  }
  const nombres = [...new Set(ilustraciones.map((fila) => fila.nombre_archivo))];
  if (nombres.some((nombre) => typeof nombre !== "string" || !NOMBRE_IMAGEN.test(nombre))) {
    throw new Error("La colección de ilustraciones contiene un nombre de imagen no válido. No se trasladará.");
  }
  const utilizadasPorFotografias = new Set(fotografias.map((fila) => fila.nombre_archivo));
  await mkdir(origen, { recursive: true });
  await mkdir(destino, { recursive: true });
  const resultado = { trasladados: 0, yaDisponibles: 0, conservados: 0 };

  for (const nombre of nombres) {
    const archivoOrigen = path.join(origen, nombre);
    const archivoDestino = path.join(destino, nombre);
    const existeOrigen = await archivoRegular(archivoOrigen);
    const existeDestino = await archivoRegular(archivoDestino);
    if (!existeOrigen && !existeDestino) {
      throw new Error("Falta una imagen de ilustración en ambas carpetas. Restaura el archivo antes de iniciar la API.");
    }
    if (!existeOrigen) {
      resultado.yaDisponibles += 1;
      continue;
    }
    const huellaOrigen = await calcularHuella(archivoOrigen);
    if (!existeDestino) await copiarSinSobrescribir(archivoOrigen, archivoDestino, huellaOrigen);
    // Se comprueba también un destino preexistente tras una ejecución interrumpida.
    await archivoRegular(archivoDestino);
    if (await calcularHuella(archivoDestino) !== huellaOrigen) {
      throw new Error("Una imagen de destino es diferente. Se conservan ambos archivos y se detiene la migración.");
    }
    if (utilizadasPorFotografias.has(nombre)) {
      resultado.conservados += 1;
    } else {
      await unlink(archivoOrigen);
      resultado.trasladados += 1;
    }
  }
  return resultado;
}

export function prepararAlmacenamientoGalerias({ pool, configuracion }) {
  return migrarArchivosIlustraciones({
    pool,
    directorioOrigen: configuracion.directorioImagenesFotografias || configuracion.directorioImagenes,
    directorioDestino: configuracion.directorioImagenesIlustraciones,
  });
}
