import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";

// Cada fichero se aplica una vez. Su huella evita modificar a escondidas una migración aplicada.
export async function aplicarMigraciones(conexion) {
  await conexion.query(`CREATE TABLE IF NOT EXISTS migraciones (
    nombre VARCHAR(160) NOT NULL PRIMARY KEY,
    huella VARCHAR(64) NOT NULL,
    aplicada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const directorio = new URL("../migrations/", import.meta.url);
  const nombres = (await readdir(directorio)).filter((nombre) => nombre.endsWith(".sql")).sort();
  for (const nombre of nombres) {
    const sql = (await readFile(new URL(nombre, directorio), "utf8")).replace(/\r\n/gu, "\n");
    const huella = createHash("sha256").update(sql).digest("hex");
    const [aplicadas] = await conexion.execute("SELECT huella FROM migraciones WHERE nombre = ?", [nombre]);
    if (aplicadas.length) {
      if (aplicadas[0].huella !== huella) throw new Error("Se ha modificado una migración aplicada: " + nombre);
      continue;
    }
    // El DDL de MySQL confirma implícitamente; las sentencias CREATE son idempotentes.
    for (const sentencia of sql.split(";").map((texto) => texto.trim()).filter(Boolean)) {
      await conexion.query(sentencia);
    }
    await conexion.execute("INSERT INTO migraciones (nombre, huella) VALUES (?, ?)", [nombre, huella]);
    console.log("Migración aplicada: " + nombre);
  }
}
