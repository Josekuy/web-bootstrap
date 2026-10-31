import { ErrorAplicacion } from "../../errores.js";

const ENTERO_UNSIGNED_MAXIMO = 4_294_967_295;
const CAMPOS_PERMITIDOS = new Set([
  "slug", "titulo", "descripcion", "categoria", "tecnologias", "imagenExterna",
  "imagenAlt", "orden", "estado", "urlProyecto", "urlRepositorio",
]);

function leerEntero(valor, minimo, maximo) {
  if (typeof valor !== "string" && typeof valor !== "number") return null;
  if (typeof valor === "string" && !/^\d+$/u.test(valor)) return null;
  const numero = Number(valor);
  return Number.isSafeInteger(numero) && numero >= minimo && numero <= maximo ? numero : null;
}

function contieneControles(texto, permitirSaltos = false) {
  return [...texto].some((caracter) => {
    const codigo = caracter.codePointAt(0);
    return (codigo < 32 && !(permitirSaltos && [9, 10, 13].includes(codigo))) || codigo === 127;
  });
}

export function validarIdProyecto(valor) {
  const id = leerEntero(valor, 1, ENTERO_UNSIGNED_MAXIMO);
  if (id === null) throw new ErrorAplicacion(400, "ID_NO_VALIDO", "El identificador del proyecto no es válido.");
  return id;
}

export function validarPaginacionProyectos(consulta = {}, limitePredeterminado = 12) {
  const pagina = leerEntero(consulta.pagina ?? "1", 1, 1_000_000);
  const limite = leerEntero(consulta.limite ?? limitePredeterminado, 1, 50);
  if (pagina === null || limite === null) {
    throw new ErrorAplicacion(
      400,
      "PAGINACION_NO_VALIDA",
      "La página debe ser un entero positivo y el límite debe estar entre 1 y 50.",
    );
  }
  return { pagina, limite, desplazamiento: (pagina - 1) * limite };
}

function normalizarUrl(valor, soloHttps) {
  if (valor === null || valor === "") return null;
  if (typeof valor !== "string") throw new TypeError("La URL debe ser texto.");
  const texto = valor.trim();
  if (!texto) return null;
  if (texto.length > 2048 || contieneControles(texto)) throw new TypeError("La URL no es válida.");
  const url = new URL(texto);
  if (
    !(soloHttps ? url.protocol === "https:" : ["http:", "https:"].includes(url.protocol)) ||
    url.username || url.password || url.href.length > 2048
  ) {
    throw new TypeError("La URL no es válida.");
  }
  return url.href;
}

/**
 * Valida únicamente campos editables; los valores ausentes se conservan en PUT.
 * FormData usa JSON para tecnologías; JSON puede enviar el array directamente.
 */
export function validarMetadatosProyecto(cuerpo, { parcial = false, multipart = false } = {}) {
  if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo)) {
    throw new ErrorAplicacion(400, "DATOS_NO_VALIDOS", "Los datos del proyecto no son válidos.");
  }
  const datos = {};
  const errores = {};
  if (Object.keys(cuerpo).some((campo) => !CAMPOS_PERMITIDOS.has(campo))) {
    errores.campos = "La petición contiene campos de proyecto no permitidos.";
  }

  function validarTexto(campo, maximo, obligatorio = false) {
    const presente = Object.hasOwn(cuerpo, campo);
    if (!presente && parcial) return;
    const valor = presente ? cuerpo[campo] : "";
    if (typeof valor !== "string") {
      errores[campo] = "Debe ser un texto y no puede repetirse.";
      return;
    }
    const texto = valor.trim();
    if ((obligatorio && !texto) || [...texto].length > maximo || contieneControles(texto, campo === "descripcion")) {
      errores[campo] = obligatorio
        ? `Debe contener entre 1 y ${maximo} caracteres válidos.`
        : `No puede superar ${maximo} caracteres ni incluir controles no permitidos.`;
      return;
    }
    datos[campo] = texto;
  }

  validarTexto("titulo", 160, true);
  validarTexto("slug", 160, true);
  validarTexto("descripcion", 5_000);
  validarTexto("categoria", 120, true);
  validarTexto("imagenAlt", 300);
  if (Object.hasOwn(datos, "slug") && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(datos.slug)) {
    errores.slug = "Usa minúsculas sin tildes, números y guiones entre palabras.";
  }

  if (!parcial || Object.hasOwn(cuerpo, "tecnologias")) {
    const valor = Object.hasOwn(cuerpo, "tecnologias") ? cuerpo.tecnologias : [];
    try {
      if (multipart && Object.hasOwn(cuerpo, "tecnologias") && typeof valor !== "string") throw new TypeError();
      const tecnologias = typeof valor === "string" ? JSON.parse(valor) : valor;
      if (!Array.isArray(tecnologias) || tecnologias.length > 20) throw new TypeError();
      const nombres = new Set();
      datos.tecnologias = tecnologias.map((tecnologia) => {
        if (typeof tecnologia !== "string") throw new TypeError();
        const nombre = tecnologia.trim().normalize("NFC");
        const clave = nombre.toLocaleLowerCase("es");
        if (!nombre || [...nombre].length > 60 || contieneControles(nombre) || nombres.has(clave)) throw new TypeError();
        nombres.add(clave);
        return nombre;
      });
    } catch {
      errores.tecnologias = "Envía hasta 20 tecnologías de 1 a 60 caracteres, sin nombres repetidos.";
    }
  }

  for (const campo of ["imagenExterna", "urlProyecto", "urlRepositorio"]) {
    if (parcial && !Object.hasOwn(cuerpo, campo)) continue;
    try {
      datos[campo] = normalizarUrl(Object.hasOwn(cuerpo, campo) ? cuerpo[campo] : null, campo === "imagenExterna");
    } catch {
      errores[campo] = campo === "imagenExterna"
        ? "Introduce una URL HTTPS de hasta 2048 caracteres, sin credenciales."
        : "Introduce una URL HTTP o HTTPS de hasta 2048 caracteres, sin credenciales.";
    }
  }

  if (!parcial || Object.hasOwn(cuerpo, "orden")) {
    const orden = leerEntero(Object.hasOwn(cuerpo, "orden") ? cuerpo.orden : "0", 0, ENTERO_UNSIGNED_MAXIMO);
    if (orden === null) errores.orden = "Debe ser un entero entre 0 y 4294967295.";
    else datos.orden = orden;
  }
  if (!parcial || Object.hasOwn(cuerpo, "estado")) {
    const estado = Object.hasOwn(cuerpo, "estado") ? cuerpo.estado : "borrador";
    if (estado !== "borrador" && estado !== "publicado") errores.estado = "Debe ser borrador o publicado.";
    else datos.estado = estado;
  }

  if (Object.keys(errores).length) {
    throw new ErrorAplicacion(400, "DATOS_NO_VALIDOS", "Revisa los datos del proyecto.", errores);
  }
  return datos;
}

/** Comprueba la elección antes de procesar una subida o abrir una transacción. */
export function validarEleccionImagen(datos, archivo, { parcial = false } = {}) {
  if (archivo && datos.imagenExterna) {
    throw new ErrorAplicacion(400, "IMAGEN_AMBIGUA", "Elige una imagen subida o una URL externa, no ambas.");
  }
  if (!parcial && !archivo && !datos.imagenExterna) {
    throw new ErrorAplicacion(400, "IMAGEN_REQUERIDA", "Selecciona una imagen o introduce su URL HTTPS.");
  }
}
