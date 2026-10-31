import mysql from "mysql2/promise";

// El pool reutiliza conexiones; las consultas de los módulos reciben los valores como parámetros.
export function crearPool(configuracion) {
  const pool = mysql.createPool({
    ...configuracion,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 50,
    connectTimeout: 5000,
    charset: "utf8mb4",
    timezone: "Z",
    dateStrings: true,
    multipleStatements: false,
  });
  pool.pool.on("connection", (conexion) => {
    conexion.query("SET time_zone = '+00:00'");
  });
  return pool;
}
