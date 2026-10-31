import { Router } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { ErrorAplicacion } from "../../errores.js";
import { comprobarContrasena } from "./contrasenas.js";

const generarToken = () => randomBytes(32).toString("hex");

// La cookie identifica la sesión; el token protege las operaciones que cambian datos.
export function crearProteccionAcceso(pool) {
  async function buscarUsuario(solicitud) {
    if (!solicitud.session.adminId) return null;
    const [usuarios] = await pool.execute(
      "SELECT id, usuario FROM usuarios_admin WHERE id = ? AND activo = 1", [solicitud.session.adminId],
    );
    if (!usuarios.length) delete solicitud.session.adminId;
    return usuarios[0] || null;
  }

  async function exigirAdmin(solicitud, respuesta, siguiente) {
    const usuario = await buscarUsuario(solicitud);
    if (!usuario) throw new ErrorAplicacion(401, "ACCESO_REQUERIDO", "Inicia sesión para acceder al panel.");
    solicitud.usuarioAdmin = usuario;
    siguiente();
  }

  function exigirCsrf(solicitud, respuesta, siguiente) {
    const recibido = solicitud.get("X-CSRF-Token") || "";
    const guardado = solicitud.session.csrfToken || "";
    if (!/^[a-f0-9]{64}$/u.test(recibido) || !/^[a-f0-9]{64}$/u.test(guardado)
      || !timingSafeEqual(Buffer.from(recibido), Buffer.from(guardado))) {
      throw new ErrorAplicacion(403, "CSRF_INVALIDO", "La sesión de este formulario ha cambiado. Actualízala e inténtalo de nuevo.");
    }
    siguiente();
  }

  return { buscarUsuario, exigirAdmin, exigirCsrf };
}

export function crearRutasAcceso({ pool, configuracion, proteccion }) {
  const rutas = Router();
  const limitarAcceso = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: (solicitud, respuesta) => respuesta.status(429).json({
      error: { codigo: "ACCESO_LIMITADO", mensaje: "Demasiados intentos. Espera unos minutos antes de volver a entrar." },
    }),
  });

  rutas.get("/api/admin/sesion", async (solicitud, respuesta) => {
    const usuario = await proteccion.buscarUsuario(solicitud);
    solicitud.session.csrfToken ||= generarToken();
    respuesta.json({ datos: { autenticado: Boolean(usuario), usuario, csrfToken: solicitud.session.csrfToken } });
  });

  rutas.post("/api/admin/login", limitarAcceso, proteccion.exigirCsrf, async (solicitud, respuesta) => {
    const { usuario, contrasena } = solicitud.body || {};
    if (typeof usuario !== "string" || !/^[a-zA-Z0-9._-]{3,80}$/u.test(usuario)
      || typeof contrasena !== "string" || contrasena.length < 1 || contrasena.length > 200) {
      throw new ErrorAplicacion(400, "ACCESO_INVALIDO", "Introduce un usuario y una contraseña válidos.");
    }
    const [filas] = await pool.execute(
      "SELECT id, usuario, hash_contrasena, activo FROM usuarios_admin WHERE usuario = ?", [usuario],
    );
    const cuenta = filas[0];
    const valida = await comprobarContrasena(contrasena, cuenta?.hash_contrasena);
    if (!cuenta || !cuenta.activo || !valida) {
      throw new ErrorAplicacion(401, "CREDENCIALES_INVALIDAS", "El usuario o la contraseña no son correctos.");
    }
    // Cambiar el identificador impide reutilizar una sesión anterior al acceso.
    await new Promise((resolver, rechazar) => solicitud.session.regenerate((error) => error ? rechazar(error) : resolver()));
    solicitud.session.adminId = cuenta.id;
    solicitud.session.csrfToken = generarToken();
    await new Promise((resolver, rechazar) => solicitud.session.save((error) => error ? rechazar(error) : resolver()));
    respuesta.json({ datos: {
      autenticado: true,
      usuario: { id: cuenta.id, usuario: cuenta.usuario },
      csrfToken: solicitud.session.csrfToken,
    } });
  });

  rutas.post("/api/admin/logout", proteccion.exigirCsrf, async (solicitud, respuesta) => {
    await new Promise((resolver, rechazar) => solicitud.session.destroy((error) => error ? rechazar(error) : resolver()));
    respuesta.clearCookie(configuracion.nombreCookie, {
      path: "/", httpOnly: true, sameSite: "strict", secure: configuracion.produccion,
    });
    respuesta.json({ datos: { autenticado: false } });
  });

  return rutas;
}
