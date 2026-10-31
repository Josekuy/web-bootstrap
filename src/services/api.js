/**
 * Centraliza cookies, CSRF y errores. FormData deja que el navegador genere su boundary.
 * Nunca se guarda el token de sesión en localStorage.
 */
export async function solicitarApi(ruta, { csrfToken, ...opciones } = {}) {
  const cabeceras = new Headers(opciones.headers);
  cabeceras.set("Accept", "application/json");
  if (csrfToken) cabeceras.set("X-CSRF-Token", csrfToken);

  const cuerpo = opciones.body;
  const esFormulario = cuerpo instanceof FormData;
  const esObjeto = cuerpo !== null && typeof cuerpo === "object" && !esFormulario;
  if (esObjeto) cabeceras.set("Content-Type", "application/json");

  let respuesta;
  try {
    respuesta = await fetch(ruta, {
      ...opciones,
      body: esObjeto ? JSON.stringify(cuerpo) : cuerpo,
      credentials: "same-origin",
      headers: cabeceras,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("No se ha podido conectar con el servidor. Comprueba la conexión y vuelve a intentarlo.", { cause: error });
  }

  let contenido;
  try {
    contenido = await respuesta.json();
  } catch (error) {
    if (error.name === "AbortError") throw error;
    const fallo = new Error("El servidor no ha devuelto una respuesta válida. Vuelve a intentarlo.");
    fallo.estado = respuesta.status;
    throw fallo;
  }

  if (!respuesta.ok) {
    const mensaje = contenido?.error?.mensaje;
    // Este 503 tiene una instrucción segura: repetir un alta podría duplicar un guardado ya aplicado.
    const mensajePermitido = respuesta.status < 500
      || (respuesta.status === 503 && contenido?.error?.codigo === "GUARDADO_NO_CONFIRMADO");
    const fallo = new Error(
      mensajePermitido && typeof mensaje === "string" && mensaje.length > 0 && mensaje.length <= 500
        ? mensaje
        : "No se ha podido completar la operación. Vuelve a intentarlo."
    );
    fallo.estado = respuesta.status;
    fallo.codigo = contenido?.error?.codigo;
    fallo.detalles = contenido?.error?.detalles;
    throw fallo;
  }

  return contenido;
}
