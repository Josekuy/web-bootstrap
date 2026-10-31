import { ErrorAplicacion } from "../../errores.js";

const ENTERO_UNSIGNED_MAXIMO = 4_294_967_295;
const CAMPOS_PERMITIDOS = new Set(["titulo", "descripcion", "imagenAlt", "orden", "estado"]);

function leerEntero(valor, minimo, maximo) {
  if (typeof valor !== "string" && typeof valor !== "number") return null;
  if (typeof valor === "string" && !/^\d+$/u.test(valor)) return null;

  const numero = Number(valor);
  return Number.isSafeInteger(numero) && numero >= minimo && numero <= maximo
    ? numero
    : null;
}

/** Lee un identificador positivo sin aceptar decimales ni fragmentos SQL. */
export function validarIdFotografia(valor) {
  const id = leerEntero(valor, 1, ENTERO_UNSIGNED_MAXIMO);
  if (id === null) {
    throw new ErrorAplicacion(400, "ID_NO_VALIDO", "El identificador de la fotografía no es válido.");
  }
  return id;
}

/** La paginación se valida antes de consultar la base de datos. */
export function validarPaginacion(consulta = {}, limitePredeterminado = 12) {
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

/**
 * Valida los campos que puede escribir el administrador.
 * En edición solo devuelve los campos recibidos; los restantes se conservan.
 * @param {object} cuerpo Campos multipart o JSON ya interpretados.
 * @param {{parcial?: boolean}} opciones
 */
export function validarMetadatosFotografia(cuerpo, { parcial = false } = {}) {
  if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo)) {
    throw new ErrorAplicacion(400, "DATOS_NO_VALIDOS", "Los datos de la fotografía no son válidos.");
  }

  const datos = {};
  const errores = {};
  const camposDesconocidos = Object.keys(cuerpo).filter((campo) => !CAMPOS_PERMITIDOS.has(campo));
  if (camposDesconocidos.length > 0) {
    errores.campos = "Solo se admiten título, descripción, texto alternativo, orden y estado.";
  }

  function validarTexto(campo, maximo, obligatorio) {
    const presente = Object.hasOwn(cuerpo, campo);
    if (!presente && parcial) return;

    const valor = presente ? cuerpo[campo] : "";
    if (typeof valor !== "string") {
      errores[campo] = "Debe ser un texto y no puede repetirse.";
      return;
    }

    const texto = valor.trim();
    const contieneControles = [...texto].some((caracter) => {
      const codigo = caracter.codePointAt(0);
      const esSaltoPermitido = campo === "descripcion" && [9, 10, 13].includes(codigo);
      return (codigo < 32 && !esSaltoPermitido) || codigo === 127;
    });

    if ((obligatorio && texto.length === 0) || [...texto].length > maximo || contieneControles) {
      errores[campo] = obligatorio
        ? `Debe contener entre 1 y ${maximo} caracteres válidos.`
        : `No puede superar ${maximo} caracteres ni incluir controles no permitidos.`;
      return;
    }

    datos[campo] = texto;
  }

  validarTexto("titulo", 160, true);
  validarTexto("descripcion", 5_000, false);
  validarTexto("imagenAlt", 300, true);

  if (!parcial || Object.hasOwn(cuerpo, "orden")) {
    const orden = leerEntero(Object.hasOwn(cuerpo, "orden") ? cuerpo.orden : "0", 0, ENTERO_UNSIGNED_MAXIMO);
    if (orden === null) errores.orden = "Debe ser un entero entre 0 y 4294967295.";
    else datos.orden = orden;
  }

  if (!parcial || Object.hasOwn(cuerpo, "estado")) {
    const estado = Object.hasOwn(cuerpo, "estado") ? cuerpo.estado : "borrador";
    if (estado !== "borrador" && estado !== "publicado") {
      errores.estado = "Debe ser borrador o publicado.";
    } else {
      datos.estado = estado;
    }
  }

  if (Object.keys(errores).length > 0) {
    throw new ErrorAplicacion(400, "DATOS_NO_VALIDOS", "Revisa los datos de la fotografía.", errores);
  }

  return datos;
}
