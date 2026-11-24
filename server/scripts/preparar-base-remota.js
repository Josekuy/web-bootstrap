import mysql from "mysql2/promise";
import { cargarConfiguracion } from "../src/configuracion.js";
import { aplicarMigraciones } from "./migraciones.js";

let conexion;
try {
  const { baseDatos } = cargarConfiguracion();
  if (!baseDatos.ssl || baseDatos.ssl.rejectUnauthorized === false) {
    console.error("Configura DB_SSL=1 para preparar una base remota mediante TLS verificado.");
    process.exitCode = 1;
  } else {
    // La base y su cuenta ya deben existir en el proveedor. No se crean usuarios
    // ni se leen, trasladan o comprueban imágenes del almacenamiento local.
    conexion = await mysql.createConnection({
      ...baseDatos,
      connectTimeout: 10_000,
      charset: "utf8mb4",
      timezone: "Z",
      multipleStatements: false,
    });
    await conexion.query("SET time_zone = '+00:00'");

    // TiDB puede omitir CHECK cuando está desactivado. Se activa y comprueba
    // antes de aplicar las migraciones para conservar sus restricciones.
    let [variables] = await conexion.query("SHOW VARIABLES LIKE 'tidb_enable_check_constraint'");
    if (variables.length && !["ON", "1"].includes(String(variables[0].Value).toUpperCase())) {
      try {
        await conexion.query("SET GLOBAL tidb_enable_check_constraint = ON");
        [variables] = await conexion.query("SHOW GLOBAL VARIABLES LIKE 'tidb_enable_check_constraint'");
        if (!variables.length || !["ON", "1"].includes(String(variables[0].Value).toUpperCase())) {
          throw new Error("CHECK no activado");
        }
      } catch {
        throw Object.assign(new Error(), { code: "TIDB_CHECK_DESACTIVADO" });
      }
    }
    await aplicarMigraciones(conexion);
    console.log("Esquema remoto preparado. Los datos e imágenes existentes se migran por separado.");
  }
} catch (error) {
  // Los errores SQL pueden incluir valores de consultas o datos de conexión.
  const codigo = typeof error.code === "string" && /^[A-Z0-9_]{1,80}$/u.test(error.code)
    ? error.code : "REVISA_CONFIGURACION_Y_CONEXION";
  console.error("No se pudo preparar la base remota:", codigo);
  if (codigo === "TIDB_CHECK_DESACTIVADO") {
    console.error("Activa SET GLOBAL tidb_enable_check_constraint = ON desde la consola de TiDB con una cuenta administrativa y repite.");
  }
  process.exitCode = 1;
} finally {
  await conexion?.end();
}
