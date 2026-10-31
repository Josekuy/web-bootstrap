import mysql from "mysql2/promise";
import { cargarConfiguracion } from "../src/configuracion.js";
import { aplicarMigraciones } from "./migraciones.js";

const configuracion = cargarConfiguracion();
const nombre = process.argv.includes("--pruebas") ? configuracion.basePruebas : configuracion.baseDatos.database;
const usuarioAplicacion = configuracion.baseDatos.user;
if (!/^[a-zA-Z0-9_]{1,64}$/u.test(nombre) || !/^[a-zA-Z0-9_]{1,32}$/u.test(usuarioAplicacion)) {
  throw new Error("El nombre de la base o del usuario no es válido.");
}
const conexion = await mysql.createConnection({
  host: configuracion.baseDatos.host,
  port: configuracion.baseDatos.port,
  user: process.env.DB_ADMIN_USER || "root",
  password: process.env.DB_ADMIN_PASSWORD || "",
  multipleStatements: false,
});
try {
  // Solo crea la base solicitada; no borra ni modifica las otras bases de XAMPP.
  await conexion.query("CREATE DATABASE IF NOT EXISTS " + mysql.escapeId(nombre)
    + " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
  await conexion.query("USE " + mysql.escapeId(nombre));
  await conexion.query("SET time_zone = '+00:00'");
  await aplicarMigraciones(conexion);
  if (usuarioAplicacion !== (process.env.DB_ADMIN_USER || "root")) {
    await conexion.query("CREATE USER IF NOT EXISTS ?@'localhost' IDENTIFIED BY ?", [
      usuarioAplicacion, configuracion.baseDatos.password,
    ]);
    await conexion.query("GRANT SELECT, INSERT, UPDATE, DELETE ON " + mysql.escapeId(nombre)
      + ".* TO ?@'localhost'", [usuarioAplicacion]);
  }
  console.log("Base preparada: " + nombre + ". La cuenta de la API tiene permisos de lectura y escritura.");
} finally {
  await conexion.end();
}
