import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const raizProyecto = fileURLToPath(new URL("../../", import.meta.url));
dotenv.config({ path: path.join(raizProyecto, ".env"), quiet: true });

// Los secretos se leen en Node: nunca se exponen como variables VITE_*.
export function cargarConfiguracion(cambios = {}) {
  const produccion = process.env.NODE_ENV === "production" || process.env.SERVER_ENV === "production";
  const secretoSesion = process.env.SESSION_SECRET || "";
  if (secretoSesion.length < 32) {
    throw new Error("Configura SESSION_SECRET: ejecuta primero npm run configurar:local.");
  }
  const baseDatos = process.env.DB_NAME || "portfolio_react";
  const basePruebas = process.env.DB_TEST_NAME || baseDatos + "_pruebas";
  if (![baseDatos, basePruebas].every((nombre) => /^[a-zA-Z0-9_]{1,64}$/u.test(nombre))
    || baseDatos === basePruebas) throw new Error("Los nombres de las bases de datos no son válidos.");
  const origenes = (process.env.APP_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",").map((origen) => new URL(origen.trim()).origin);
  if (produccion && origenes.some((origen) => !origen.startsWith("https://"))) {
    throw new Error("En producción APP_ORIGINS debe contener únicamente orígenes HTTPS.");
  }
  const raizAlmacenamiento = process.env.STORAGE_ROOT
    ? path.resolve(raizProyecto, process.env.STORAGE_ROOT) : path.join(raizProyecto, "server/storage");
  const proveedorImagenes = process.env.IMAGE_STORAGE || "local";
  if (!["local", "supabase"].includes(proveedorImagenes)) {
    throw new Error("IMAGE_STORAGE debe ser local o supabase.");
  }
  if (![undefined, "", "0", "1"].includes(process.env.DB_SSL)) {
    throw new Error("DB_SSL debe ser 0 o 1.");
  }
  const ssl = process.env.DB_SSL === "1" ? {
    rejectUnauthorized: true,
    verifyIdentity: true,
    minVersion: "TLSv1.2",
    ...(process.env.DB_SSL_CA_FILE ? {
      ca: readFileSync(path.resolve(raizProyecto, process.env.DB_SSL_CA_FILE), "utf8"),
    } : {}),
  } : undefined;
  const directorioImagenesFotografias = cambios.directorioImagenesFotografias
    || cambios.directorioImagenes || path.join(raizAlmacenamiento, "fotografias");
  const directorioImagenesIlustraciones = cambios.directorioImagenesIlustraciones
    || (cambios.directorioImagenes || cambios.directorioImagenesFotografias
      ? path.join(directorioImagenesFotografias, "ilustraciones")
      : path.join(raizAlmacenamiento, "ilustraciones"));
  return {
    produccion,
    puerto: Number(process.env.PORT || 3001),
    host: process.env.HOST || "127.0.0.1",
    secretoSesion,
    origenes,
    confiarProxy: process.env.TRUST_PROXY === "1" ? 1 : false,
    nombreCookie: "portfolio.sid",
    duracionSesion: 8 * 60 * 60 * 1000,
    directorioImagenesProyectos: path.join(raizAlmacenamiento, "proyectos"),
    almacenamientoImagenes: {
      proveedor: proveedorImagenes,
      url: process.env.SUPABASE_URL || "",
      clave: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      bucket: process.env.SUPABASE_STORAGE_BUCKET || "portfolio",
    },
    basePruebas,
    baseDatos: {
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "portfolio_react_app",
      password: process.env.DB_PASSWORD || "",
      database: baseDatos,
      ...(ssl ? { ssl } : {}),
    },
    ...cambios,
    // directorioImagenes conserva el nombre anterior para los consumidores existentes.
    directorioImagenes: directorioImagenesFotografias,
    directorioImagenesFotografias,
    directorioImagenesIlustraciones,
  };
}
