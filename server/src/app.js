import express from "express";
import helmet from "helmet";
import session from "express-session";
import { rateLimit } from "express-rate-limit";
import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { raizProyecto } from "./configuracion.js";
import { ErrorAplicacion } from "./errores.js";
import { AlmacenSesionesMysql } from "./modules/auth/almacen-sesiones.js";
import { crearProteccionAcceso, crearRutasAcceso } from "./modules/auth/rutas.js";
import { crearRutasFotografias } from "./modules/fotografias/rutas.js";
import { crearRutasProyectos } from "./modules/proyectos/rutas.js";

// Inyectar configuración y pool permite probar la API con una base separada.
export async function crearAplicacion({ configuracion, pool }) {
  await mkdir(configuracion.directorioImagenes, { recursive: true });
  await mkdir(configuracion.directorioImagenesProyectos, { recursive: true });
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", configuracion.confiarProxy);

  const directorioDist = path.join(raizProyecto, "dist");
  const huellasScripts = [];
  if (configuracion.produccion) {
    const html = await readFile(path.join(directorioDist, "index.html"), "utf8");
    for (const coincidencia of html.matchAll(/<script>([\s\S]*?)<\/script>/gu)) {
      huellasScripts.push("'sha256-" + createHash("sha256").update(coincidencia[1]).digest("base64") + "'");
    }
  }
  app.use(helmet({
    strictTransportSecurity: configuracion.produccion ? undefined : false,
    contentSecurityPolicy: { directives: {
      scriptSrc: ["'self'", ...huellasScripts],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'"],
      upgradeInsecureRequests: configuracion.produccion ? [] : null,
    } },
  }));

  app.use("/api", (solicitud, respuesta, siguiente) => {
    respuesta.set("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(solicitud.method)) {
      const origen = solicitud.get("Origin");
      if ((origen && !configuracion.origenes.includes(origen)) || solicitud.get("Sec-Fetch-Site") === "cross-site") {
        throw new ErrorAplicacion(403, "ORIGEN_NO_PERMITIDO", "La petición no procede de este sitio.");
      }
    }
    siguiente();
  });
  app.use("/api", rateLimit({
    windowMs: 60 * 1000, limit: 240, standardHeaders: "draft-7", legacyHeaders: false,
    handler: (solicitud, respuesta) => respuesta.status(429).json({
      error: { codigo: "PETICIONES_LIMITADAS", mensaje: "Hay demasiadas peticiones. Espera un momento e inténtalo de nuevo." },
    }),
  }));
  // Admite los textos Unicode del contrato sin permitir cuerpos JSON sin límite.
  app.use(express.json({ limit: "64kb" }));

  const almacenSesiones = new AlmacenSesionesMysql(pool, configuracion.duracionSesion);
  app.use(session({
    name: configuracion.nombreCookie,
    secret: configuracion.secretoSesion,
    store: almacenSesiones,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: configuracion.produccion,
      sameSite: "strict",
      maxAge: configuracion.duracionSesion,
      path: "/",
    },
  }));

  app.get("/api/salud", async (solicitud, respuesta) => {
    await pool.execute("SELECT 1");
    respuesta.json({ datos: { estado: "disponible" } });
  });
  const proteccion = crearProteccionAcceso(pool);
  app.use(crearRutasAcceso({ pool, configuracion, proteccion }));
  app.use("/api/imagenes", async (solicitud, respuesta, siguiente) => {
    // Una cuenta desactivada tampoco conserva acceso a las imágenes de borrador.
    await proteccion.buscarUsuario(solicitud);
    siguiente();
  });
  app.use(crearRutasFotografias({
    pool,
    directorioImagenes: configuracion.directorioImagenes,
    exigirAdmin: proteccion.exigirAdmin,
    exigirCsrf: proteccion.exigirCsrf,
  }));
  app.use(crearRutasProyectos({
    pool,
    directorioImagenes: configuracion.directorioImagenesProyectos,
    exigirAdmin: proteccion.exigirAdmin,
    exigirCsrf: proteccion.exigirCsrf,
  }));
  app.use("/api", (solicitud, respuesta) => respuesta.status(404).json({
    error: { codigo: "RUTA_NO_ENCONTRADA", mensaje: "La ruta solicitada no existe." },
  }));

  if (configuracion.produccion) {
    app.use(express.static(directorioDist, { index: false }));
    app.get(["/", "/admin", "/admin/"], (solicitud, respuesta) => respuesta.sendFile(path.join(directorioDist, "index.html")));
  }

  // Un error inesperado se registra en el servidor; el cliente recibe un mensaje general.
  app.use((error, solicitud, respuesta, siguiente) => {
    if (respuesta.headersSent) return siguiente(error);
    if (error instanceof ErrorAplicacion) {
      return respuesta.status(error.estado).json({
        error: { codigo: error.codigo, mensaje: error.message, ...(error.detalles ? { detalles: error.detalles } : {}) },
      });
    }
    if (error.type === "entity.parse.failed") {
      return respuesta.status(400).json({ error: { codigo: "JSON_INVALIDO", mensaje: "El contenido de la petición no es válido." } });
    }
    if (error.type === "entity.too.large") {
      return respuesta.status(413).json({ error: { codigo: "PETICION_GRANDE", mensaje: "La petición supera el tamaño permitido." } });
    }
    console.error("Error de API:", error.code || error.name);
    return respuesta.status(500).json({ error: { codigo: "ERROR_INTERNO", mensaje: "No se pudo completar la operación. Inténtalo de nuevo." } });
  });
  return { app, almacenSesiones };
}
