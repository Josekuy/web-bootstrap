import { cargarConfiguracion } from "./configuracion.js";
import { crearPool } from "./base-datos.js";
import { crearAplicacion } from "./app.js";

const configuracion = cargarConfiguracion();
const pool = crearPool(configuracion.baseDatos);
let servidor;
let almacenSesiones;
try {
  await pool.execute("SELECT 1");
  const aplicacion = await crearAplicacion({ configuracion, pool });
  almacenSesiones = aplicacion.almacenSesiones;
  servidor = await new Promise((resolver, rechazar) => {
    const escucha = aplicacion.app.listen(configuracion.puerto, configuracion.host, () => resolver(escucha));
    escucha.once("error", rechazar);
  });
  console.log("API del portfolio disponible en http://" + configuracion.host + ":" + configuracion.puerto);
} catch (error) {
  almacenSesiones?.cerrar();
  await pool.end();
  console.error("No se pudo iniciar la API:", error.code || error.message);
  process.exitCode = 1;
}

// Al detener el proceso se dejan de aceptar peticiones y se liberan conexiones y temporizadores.
function cerrarServidor() {
  if (!servidor) return;
  servidor.close(async () => {
    almacenSesiones?.cerrar();
    await pool.end();
  });
}
process.once("SIGINT", cerrarServidor);
process.once("SIGTERM", cerrarServidor);
