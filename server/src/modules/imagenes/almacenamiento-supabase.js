import { ErrorAplicacion } from "../../errores.js";
import { NOMBRE_IMAGEN } from "./nombres.js";

const RECURSOS = ["fotografias", "ilustraciones", "proyectos"];

function errorAlmacenamiento() {
  return new ErrorAplicacion(503, "ALMACENAMIENTO_NO_DISPONIBLE", "No se ha podido acceder al almacenamiento de imágenes. Inténtalo de nuevo.");
}

function errorAusente() {
  return new ErrorAplicacion(404, "IMAGEN_NO_ENCONTRADA", "La imagen no está disponible.");
}

function comprobarNombre(nombre) {
  if (typeof nombre !== "string" || !NOMBRE_IMAGEN.test(nombre)) {
    throw new ErrorAplicacion(500, "NOMBRE_IMAGEN_NO_VALIDO", "El nombre de imagen no es válido.");
  }
}

function crearCabeceras(clave) {
  // Storage utiliza la clave privada como credencial de servicio. Las claves
  // nuevas no son JWT, pero su API admite el mismo valor como Bearer.
  if (/^sb_secret_[a-zA-Z0-9_-]+$/u.test(clave)) {
    return { apikey: clave, Authorization: "Bearer " + clave };
  }
  let servicio = false;
  try {
    const partes = clave.split(".");
    servicio = partes.length === 3
      && JSON.parse(Buffer.from(partes[1], "base64url").toString("utf8")).role === "service_role";
  } catch { /* Se rechazan también JWT incompletos o que no contienen JSON. */ }
  if (!servicio) {
    throw new Error("Configura una clave privada sb_secret_ de Supabase; no uses una clave pública.");
  }
  // Compatibilidad con la clave JWT antigua. Supabase verifica su firma.
  return { apikey: clave, Authorization: "Bearer " + clave };
}

/** El bucket es privado: solo la API puede descargar tras comprobar el estado en BD. */
export async function crearAlmacenesSupabase({ url, clave, bucket }, { solicitar = fetch } = {}) {
  let origen;
  try {
    origen = new URL(url);
  } catch {
    throw new Error("Configura SUPABASE_URL con la dirección HTTPS de tu proyecto.");
  }
  if (origen.protocol !== "https:" || origen.username || origen.password
    || origen.pathname !== "/" || origen.search || origen.hash
    || typeof clave !== "string" || !clave.trim()
    || typeof bucket !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/u.test(bucket)) {
    throw new Error("Revisa la URL, la clave privada y el bucket de Supabase Storage.");
  }

  const base = origen.origin + "/storage/v1";
  const cabeceras = crearCabeceras(clave);
  async function peticion(ruta, opciones = {}, { permiteAusente = false } = {}) {
    let respuesta;
    try {
      respuesta = await solicitar(base + ruta, {
        ...opciones,
        headers: { ...cabeceras, ...opciones.headers },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      // No se propagan el error de red, la URL ni las cabeceras privadas.
      const error = errorAlmacenamiento();
      error.code = "SUPABASE_RED_NO_DISPONIBLE";
      throw error;
    }
    if (!respuesta.ok) {
      let detalle;
      try { detalle = await respuesta.json(); } catch { /* La respuesta puede no ser JSON. */ }
      const ausente = respuesta.status === 404 || Number(detalle?.statusCode) === 404
        || detalle?.code === "NoSuchKey";
      if (permiteAusente && ausente) throw errorAusente();
      const error = errorAlmacenamiento();
      error.code = respuesta.status === 409 || detalle?.code === "Duplicate"
        ? "EEXIST" : `SUPABASE_HTTP_${respuesta.status}`;
      throw error;
    }
    return respuesta;
  }

  let informacion;
  try {
    informacion = await (await peticion("/bucket/" + bucket)).json();
  } catch (error) {
    if (error instanceof ErrorAplicacion) throw error;
    throw errorAlmacenamiento();
  }
  if (informacion?.public !== false) {
    throw new Error("El bucket de imágenes debe ser privado para proteger los borradores.");
  }

  return Object.fromEntries(RECURSOS.map((recurso) => [recurso, {
    async guardar(nombre, contenido) {
      comprobarNombre(nombre);
      if (!Buffer.isBuffer(contenido) || contenido.length === 0) throw new Error("La imagen no contiene datos válidos.");
      const respuesta = await peticion(`/object/${bucket}/${recurso}/${nombre}`, {
        method: "POST",
        headers: { "Content-Type": "image/webp", "Cache-Control": "max-age=0", "x-upsert": "false" },
        body: contenido,
      });
      // Una subida nunca sobrescribe otra. Ante un fallo de red no se intenta
      // borrar: el servidor podría haber guardado el objeto antes del corte.
      await respuesta.body?.cancel().catch(() => {});
    },
    async leer(nombre) {
      comprobarNombre(nombre);
      const respuesta = await peticion(`/object/authenticated/${bucket}/${recurso}/${nombre}`, {}, { permiteAusente: true });
      try {
        return Buffer.from(await respuesta.arrayBuffer());
      } catch {
        throw errorAlmacenamiento();
      }
    },
    async eliminar(nombre) {
      comprobarNombre(nombre);
      try {
        const respuesta = await peticion(`/object/${bucket}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prefixes: [`${recurso}/${nombre}`] }),
        }, { permiteAusente: true });
        await respuesta.body?.cancel().catch(() => {});
      } catch (error) {
        if (error.codigo !== "IMAGEN_NO_ENCONTRADA") throw error;
      }
    },
  }]));
}
