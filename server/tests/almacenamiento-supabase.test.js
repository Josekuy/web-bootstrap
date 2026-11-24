import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import sharp from "sharp";
import { crearAlmacenesSupabase } from "../src/modules/imagenes/almacenamiento-supabase.js";
import { crearRutasImagenes, eliminarImagen, procesarYGuardarImagen } from "../src/modules/imagenes/imagenes.js";

const CONFIGURACION = { url: "https://portfolio.supabase.co", clave: "sb_secret_solo_prueba", bucket: "portfolio" };
const NOMBRE = "00000000-0000-4000-8000-000000000001.webp";

function crearJwtPrueba(rol) {
  return Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url") + "."
    + Buffer.from(JSON.stringify({ role: rol })).toString("base64url") + ".firma-solo-prueba";
}

function crearServicio({ publico = false, responder } = {}) {
  const llamadas = [];
  const archivos = new Map();
  const solicitar = async (direccion, opciones) => {
    const ruta = new URL(direccion).pathname.replace("/storage/v1", "");
    const metodo = opciones.method || "GET";
    llamadas.push({ ruta, metodo, opciones });
    if (ruta === "/bucket/portfolio") return Response.json({ id: "portfolio", public: publico });
    if (responder) return responder(ruta, opciones);
    if (metodo === "POST") {
      assert.equal(opciones.headers["x-upsert"], "false");
      const nombre = ruta.replace("/object/portfolio/", "");
      if (archivos.has(nombre)) return Response.json({ code: "Duplicate" }, { status: 409 });
      archivos.set(nombre, Buffer.from(opciones.body));
      return Response.json({ Key: nombre });
    }
    if (metodo === "DELETE") {
      for (const nombre of JSON.parse(opciones.body).prefixes) archivos.delete(nombre);
      return Response.json([]);
    }
    const nombre = ruta.replace("/object/authenticated/portfolio/", "");
    if (!archivos.has(nombre)) return Response.json({ statusCode: "404" }, { status: 400 });
    return new Response(archivos.get(nombre), { headers: { "Content-Type": "image/webp" } });
  };
  return { solicitar, llamadas, archivos };
}

function comprobarError(codigo, estado) {
  return (error) => error.codigo === codigo && error.estado === estado;
}

test("comparte los bytes en un bucket privado y separa las tres colecciones", async () => {
  const servicio = crearServicio();
  const almacenes = await crearAlmacenesSupabase(CONFIGURACION, servicio);
  for (const [indice, recurso] of ["fotografias", "ilustraciones", "proyectos"].entries()) {
    await almacenes[recurso].guardar(NOMBRE, Buffer.from([indice, 127, 255]));
  }
  assert.equal(servicio.llamadas.filter(({ ruta }) => ruta.startsWith("/bucket/")).length, 1);
  assert.equal(servicio.archivos.size, 3);
  assert.deepEqual(await almacenes.ilustraciones.leer(NOMBRE), Buffer.from([1, 127, 255]));
  await eliminarImagen(NOMBRE, almacenes.ilustraciones);
  await eliminarImagen(NOMBRE, almacenes.ilustraciones);
  assert.equal(servicio.archivos.has("ilustraciones/" + NOMBRE), false);
  assert.deepEqual(await almacenes.fotografias.leer(NOMBRE), Buffer.from([0, 127, 255]));
  for (const { opciones } of servicio.llamadas) {
    assert.equal(opciones.headers.apikey, CONFIGURACION.clave);
    assert.equal(Object.hasOwn(opciones.headers, "Authorization"), false);
    assert.equal(opciones.redirect, "error");
    assert.ok(opciones.signal instanceof AbortSignal);
  }
});

test("la clave secreta nueva solo viaja en apikey y la antigua service_role conserva Bearer", async () => {
  for (const clave of [CONFIGURACION.clave, crearJwtPrueba("service_role")]) {
    const servicio = crearServicio();
    const almacenes = await crearAlmacenesSupabase({ ...CONFIGURACION, clave }, servicio);
    await almacenes.proyectos.guardar(NOMBRE, Buffer.from("imagen"));
    await almacenes.proyectos.leer(NOMBRE);
    await almacenes.proyectos.eliminar(NOMBRE);
    for (const { opciones } of servicio.llamadas) {
      assert.equal(opciones.headers.apikey, clave);
      if (clave.startsWith("sb_secret_")) assert.equal(Object.hasOwn(opciones.headers, "Authorization"), false);
      else assert.equal(opciones.headers.Authorization, "Bearer " + clave);
    }
  }
});

test("rechaza claves públicas, JWT anon y JWT malformados sin enviarlos al proveedor", async () => {
  const servicio = crearServicio();
  for (const clave of ["sb_publishable_solo_prueba", crearJwtPrueba("anon"), "eyJ.jwt.invalido", "secreto-invalido"]) {
    await assert.rejects(crearAlmacenesSupabase({ ...CONFIGURACION, clave }, servicio), (error) => {
      assert.match(error.message, /clave privada/u);
      assert.ok(!error.message.includes(clave));
      return true;
    });
  }
  assert.equal(servicio.llamadas.length, 0);
});

test("rechaza un bucket público antes de guardar o leer imágenes", async () => {
  const servicio = crearServicio({ publico: true });
  await assert.rejects(crearAlmacenesSupabase(CONFIGURACION, servicio), /debe ser privado/u);
  assert.equal(servicio.llamadas.length, 1);
});

test("rechaza URL insegura, credenciales en URL y buckets con rutas antes de conectar", async () => {
  const servicio = crearServicio();
  for (const cambio of [
    { url: "http://portfolio.supabase.co" },
    { url: "https://usuario:secreto@portfolio.supabase.co" },
    { url: "https://portfolio.supabase.co/otra-ruta" },
    { url: "https://portfolio.supabase.co/?clave=privada" },
    { bucket: "../otro" },
    { clave: "" },
  ]) await assert.rejects(crearAlmacenesSupabase({ ...CONFIGURACION, ...cambio }, servicio));
  assert.equal(servicio.llamadas.length, 0);
});

test("un nombre de cliente no puede elegir la ruta de un objeto remoto", async () => {
  const servicio = crearServicio();
  const almacenes = await crearAlmacenesSupabase(CONFIGURACION, servicio);
  for (const nombre of ["../secreto.webp", "otra/" + NOMBRE, "no-es-uuid.webp", undefined]) {
    await assert.rejects(almacenes.proyectos.leer(nombre), comprobarError("NOMBRE_IMAGEN_NO_VALIDO", 500));
    await assert.rejects(almacenes.proyectos.guardar(nombre, Buffer.from("imagen")), comprobarError("NOMBRE_IMAGEN_NO_VALIDO", 500));
    await assert.rejects(almacenes.proyectos.eliminar(nombre), comprobarError("NOMBRE_IMAGEN_NO_VALIDO", 500));
  }
  assert.equal(servicio.llamadas.length, 1);
});

test("una subida de Sharp guarda WebP sin metadatos en el almacén remoto", async () => {
  const servicio = crearServicio();
  const almacenes = await crearAlmacenesSupabase(CONFIGURACION, servicio);
  const original = await sharp({ create: { width: 40, height: 20, channels: 3, background: "orange" } })
    .withMetadata().png().toBuffer();
  const imagen = await procesarYGuardarImagen({ buffer: original }, almacenes.proyectos);
  const guardada = await almacenes.proyectos.leer(imagen.nombreArchivo);
  const metadatos = await sharp(guardada).metadata();
  assert.equal(metadatos.format, "webp");
  assert.equal(metadatos.exif, undefined);
  assert.equal(imagen.ancho, 40);
  assert.equal(imagen.alto, 20);
  assert.equal(imagen.tamano, guardada.length);
  await assert.rejects(almacenes.fotografias.leer(imagen.nombreArchivo), comprobarError("IMAGEN_NO_ENCONTRADA", 404));
});

test("un error de red o del proveedor no revela claves ni provoca borrados inciertos", async () => {
  for (const responder of [
    async () => { throw new Error("red caída, clave: " + CONFIGURACION.clave); },
    async () => Response.json({ error: CONFIGURACION.clave }, { status: 500 }),
    async () => { throw new DOMException("petición cancelada", "TimeoutError"); },
  ]) {
    const servicio = crearServicio({ responder });
    const almacenes = await crearAlmacenesSupabase(CONFIGURACION, servicio);
    await assert.rejects(almacenes.fotografias.guardar(NOMBRE, Buffer.from("imagen")), (error) => {
      assert.equal(error.estado, 503);
      assert.equal(error.codigo, "ALMACENAMIENTO_NO_DISPONIBLE");
      assert.ok(!JSON.stringify(error).includes(CONFIGURACION.clave));
      assert.ok(!error.message.includes(CONFIGURACION.clave));
      assert.equal(error.cause, undefined);
      return true;
    });
    assert.equal(servicio.llamadas.some(({ metodo }) => metodo === "DELETE"), false);
  }
});

test("no sobrescribe imágenes con el mismo nombre ni borra una copia preexistente", async () => {
  const servicio = crearServicio();
  const almacenes = await crearAlmacenesSupabase(CONFIGURACION, servicio);
  await almacenes.fotografias.guardar(NOMBRE, Buffer.from("original"));
  await assert.rejects(almacenes.fotografias.guardar(NOMBRE, Buffer.from("distinta")), { code: "EEXIST" });
  assert.equal((await almacenes.fotografias.leer(NOMBRE)).toString(), "original");
  assert.equal(servicio.llamadas.some(({ metodo }) => metodo === "DELETE"), false);
});

test("comprueba BD antes de descargar un borrador y vuelve a bloquearlo tras retirarlo", async (contexto) => {
  const servicio = crearServicio();
  const almacenes = await crearAlmacenesSupabase(CONFIGURACION, servicio);
  await almacenes.fotografias.guardar(NOMBRE, Buffer.from("bytes-webp"));
  let estado = "borrador";
  const app = express();
  app.use((peticion, respuesta, siguiente) => {
    peticion.session = peticion.get("X-Administrador-Prueba") === "si" ? { adminId: 1 } : {};
    siguiente();
  });
  app.use(crearRutasImagenes({
    recurso: "fotografias", directorioImagenes: almacenes.fotografias,
    pool: { execute: async () => [[{ estado }]] },
  }));
  app.use((error, peticion, respuesta, _siguiente) => respuesta.status(error.estado || 500).json({ codigo: error.codigo }));
  const servidor = app.listen(0, "127.0.0.1");
  await once(servidor, "listening");
  contexto.after(() => new Promise((resolver, rechazar) => servidor.close((error) => error ? rechazar(error) : resolver())));
  const url = `http://127.0.0.1:${servidor.address().port}/api/imagenes/fotografias/${NOMBRE}`;
  const contarLecturas = () => servicio.llamadas.filter(({ ruta }) => ruta.includes("/object/authenticated/")).length;
  assert.equal((await fetch(url)).status, 404);
  assert.equal(contarLecturas(), 0);
  let respuesta = await fetch(url, { headers: { "X-Administrador-Prueba": "si" } });
  assert.equal(respuesta.status, 200);
  assert.equal(respuesta.headers.get("cache-control"), "no-store");
  assert.equal(respuesta.headers.get("content-type"), "image/webp");
  assert.equal(await respuesta.text(), "bytes-webp");
  estado = "publicado";
  respuesta = await fetch(url);
  assert.equal(respuesta.status, 200);
  assert.equal(await respuesta.text(), "bytes-webp");
  assert.equal(contarLecturas(), 2);
  estado = "borrador";
  assert.equal((await fetch(url)).status, 404);
  assert.equal(contarLecturas(), 2);
});
