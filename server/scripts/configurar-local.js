import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const raiz = new URL("../../", import.meta.url);
const plantilla = await readFile(new URL(".env.example", raiz), "utf8");
const contenido = plantilla
  .replace(/^SESSION_SECRET=$/mu, "SESSION_SECRET=" + randomBytes(48).toString("hex"))
  .replace(/^DB_PASSWORD=$/mu, "DB_PASSWORD=" + randomBytes(24).toString("hex"))
  .replace(/^ADMIN_CONTRASENA=$/mu, "ADMIN_CONTRASENA=" + randomBytes(24).toString("base64url"));

try {
  // wx impide sobrescribir credenciales si ya existía una configuración del usuario.
  await writeFile(new URL(".env", raiz), contenido, { flag: "wx", mode: 0o600 });
  console.log("Configuración local creada en " + fileURLToPath(new URL(".env", raiz)));
  console.log("Los secretos se guardan en ese archivo y no se imprimen en la terminal.");
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log("Ya existe .env. Se conserva su contenido.");
}
