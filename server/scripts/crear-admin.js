import { cargarConfiguracion } from "../src/configuracion.js";
import { crearPool } from "../src/base-datos.js";
import { crearHashContrasena } from "../src/modules/auth/contrasenas.js";

const configuracion = cargarConfiguracion();
const usuario = process.env.ADMIN_USUARIO || "admin";
const contrasena = process.env.ADMIN_CONTRASENA || "";
if (!/^[a-zA-Z0-9._-]{3,80}$/u.test(usuario)) throw new Error("ADMIN_USUARIO debe tener entre 3 y 80 caracteres válidos.");
const pool = crearPool(configuracion.baseDatos);
try {
  const [existentes] = await pool.execute("SELECT id FROM usuarios_admin WHERE usuario = ?", [usuario]);
  if (existentes.length) {
    console.log("El usuario ya existe. Su contraseña se conserva.");
  } else {
    const hash = await crearHashContrasena(contrasena);
    await pool.execute("INSERT INTO usuarios_admin (usuario, hash_contrasena) VALUES (?, ?)", [usuario, hash]);
    console.log("Administrador creado. Consulta usuario y contraseña inicial en el archivo .env local.");
  }
} finally {
  await pool.end();
}
