import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const derivarClave = promisify(scrypt);
const opciones = { N: 65536, r: 8, p: 2, maxmem: 128 * 1024 * 1024 };
const hashFicticio = "scrypt:" + "00".repeat(32) + ":" + "00".repeat(64);

// Solo se almacena la clave derivada con una sal aleatoria, nunca la contraseña original.
export async function crearHashContrasena(contrasena) {
  if (typeof contrasena !== "string" || contrasena.length < 12 || contrasena.length > 200) {
    throw new Error("La contraseña debe tener entre 12 y 200 caracteres.");
  }
  const sal = randomBytes(32).toString("hex");
  const clave = await derivarClave(contrasena, sal, 64, opciones);
  return "scrypt:" + sal + ":" + clave.toString("hex");
}

// También calcula una clave para usuarios inexistentes, evitando una respuesta inmediata distinta.
export async function comprobarContrasena(contrasena, hashGuardado = hashFicticio) {
  if (!/^scrypt:[a-f0-9]{64}:[a-f0-9]{128}$/u.test(hashGuardado)) return false;
  const [, sal, claveGuardada] = hashGuardado.split(":");
  const clave = await derivarClave(contrasena, sal, 64, opciones);
  return timingSafeEqual(clave, Buffer.from(claveGuardada, "hex"));
}
