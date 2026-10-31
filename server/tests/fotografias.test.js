import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import express from "express";
import sharp from "sharp";
import { ErrorAplicacion } from "../src/errores.js";
import { crearRutasFotografias } from "../src/modules/fotografias/rutas.js";
import { eliminarImagen, procesarYGuardarImagen } from "../src/modules/imagenes/imagenes.js";
import { validarIdFotografia, validarMetadatosFotografia, validarPaginacion } from "../src/modules/fotografias/validacion.js";

async function prepararDirectorio(contexto) {
  const directorio = await mkdtemp(join(tmpdir(), "portfolio-fotografias-"));
  contexto.after(() => rm(directorio, { recursive: true, force: true }));
  return directorio;
}

function comprobarError(codigo, estado) {
  return (error) => error instanceof ErrorAplicacion && error.codigo === codigo && error.estado === estado;
}

function crearFormulario(imagen, campos = {}) {
  const formulario = new FormData();
  const valores = { titulo: "Prueba de fotografía", imagenAlt: "Superficie naranja", ...campos };
  for (const [campo, valor] of Object.entries(valores)) formulario.append(campo, valor);
  if (imagen) formulario.append("imagen", new Blob([imagen], { type: "image/png" }), "prueba.png");
  return formulario;
}

async function iniciarServidor(contexto, directorioImagenes, pool = {}) {
  const aplicacion = express();
  aplicacion.use(express.json());
  // Estas cabeceras solo simulan identidad en la prueba aislada del router.
  // La autenticación real de la aplicación tiene sus propias comprobaciones.
  aplicacion.use((peticion, respuesta, siguiente) => {
    peticion.session = peticion.get("X-Administrador-Prueba") === "si" ? { adminId: 1 } : {};
    siguiente();
  });
  const exigirAdmin = (peticion, respuesta, siguiente) => {
    if (!peticion.session.adminId) return siguiente(new ErrorAplicacion(401, "NO_AUTORIZADO", "Identifícate."));
    siguiente();
  };
  const exigirCsrf = (peticion, respuesta, siguiente) => {
    if (peticion.get("X-CSRF-Token") !== "token-prueba") {
      return siguiente(new ErrorAplicacion(403, "CSRF_NO_VALIDO", "Token no válido."));
    }
    siguiente();
  };

  aplicacion.use(crearRutasFotografias({ pool, directorioImagenes, exigirAdmin, exigirCsrf }));
  aplicacion.use((error, peticion, respuesta, siguiente) => {
    if (respuesta.headersSent) return siguiente(error);
    respuesta.status(error.estado ?? 500).json({
      error: {
        codigo: error.codigo ?? "ERROR_INTERNO",
        mensaje: error instanceof ErrorAplicacion ? error.message : "Se ha producido un error interno.",
      },
    });
  });

  const servidor = aplicacion.listen(0, "127.0.0.1");
  await once(servidor, "listening");
  contexto.after(() => new Promise((resolver, rechazar) => {
    servidor.close((error) => error ? rechazar(error) : resolver());
  }));
  return `http://127.0.0.1:${servidor.address().port}`;
}

test("los metadatos rechazan asignación de campos privados, duplicados y estados no admitidos", () => {
  const datos = { titulo: "Foto", imagenAlt: "Una superficie" };
  for (const cambios of [
    { nombre_archivo: "elegido-por-cliente.webp" },
    { id: 1 },
    { titulo: ["Uno", "Dos"] },
    { imagenAlt: " " },
    { titulo: "x".repeat(161) },
    { imagenAlt: "x".repeat(301) },
    { descripcion: "x".repeat(5_001) },
    { orden: "1.5" },
    { orden: "-1" },
    { orden: "4294967296" },
    { orden: null },
    { estado: "privado" },
    { estado: null },
    { titulo: "Texto\u0000oculto" },
  ]) {
    assert.throws(() => validarMetadatosFotografia({ ...datos, ...cambios }), comprobarError("DATOS_NO_VALIDOS", 400));
  }

  const validos = validarMetadatosFotografia({ ...datos, descripcion: "Línea 1\nLínea 2", orden: "0" });
  assert.equal(validos.estado, "borrador");
  assert.equal(validos.orden, 0);
  assert.equal(validos.descripcion, "Línea 1\nLínea 2");
  assert.deepEqual(validarMetadatosFotografia({ estado: "publicado" }, { parcial: true }), { estado: "publicado" });
});

test("identificadores y paginación rechazan valores ambiguos y entradas repetidas", () => {
  for (const id of ["0", "-1", "1.5", "1 OR 1=1", "4294967296", ["1", "2"]]) {
    assert.throws(() => validarIdFotografia(id), comprobarError("ID_NO_VALIDO", 400));
  }
  for (const consulta of [{ pagina: "0" }, { limite: "51" }, { pagina: ["1", "2"] }, { limite: "1e1" }]) {
    assert.throws(() => validarPaginacion(consulta), comprobarError("PAGINACION_NO_VALIDA", 400));
  }
  assert.deepEqual(validarPaginacion({ pagina: "2", limite: "12" }), { pagina: 2, limite: 12, desplazamiento: 12 });
});

test("una imagen real se orienta, se convierte a WebP y pierde sus metadatos", async (contexto) => {
  const directorio = await prepararDirectorio(contexto);
  const original = await sharp({ create: { width: 80, height: 40, channels: 3, background: "#ff5b35" } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();

  const imagen = await procesarYGuardarImagen({ buffer: original }, directorio);
  assert.match(imagen.nombreArchivo, /^[0-9a-f-]{36}\.webp$/u);
  assert.equal(imagen.ancho, 40);
  assert.equal(imagen.alto, 80);
  const guardada = await readFile(join(directorio, imagen.nombreArchivo));
  const metadatos = await sharp(guardada).metadata();
  assert.equal(metadatos.format, "webp");
  assert.equal(metadatos.exif, undefined);
  assert.equal(metadatos.orientation, undefined);
  assert.equal(imagen.tamano, guardada.length);
});

test("las subidas con contenido falso, animación o tamaño excesivo no escriben archivos", async (contexto) => {
  const directorio = await prepararDirectorio(contexto);
  const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: "red" } }).png().toBuffer();
  // Un bloque de control APNG debe descartarse antes de descodificar su contenido.
  const bloqueAnimacion = Buffer.alloc(20);
  bloqueAnimacion.writeUInt32BE(8, 0);
  bloqueAnimacion.write("acTL", 4, "ascii");
  bloqueAnimacion.writeUInt32BE(2, 8);
  const pngAnimado = Buffer.concat([png.subarray(0, 8), bloqueAnimacion, png.subarray(8)]);

  for (const buffer of [Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), Buffer.from("GIF89a"), pngAnimado]) {
    await assert.rejects(
      procesarYGuardarImagen({ buffer, mimetype: "image/png" }, directorio),
      comprobarError("IMAGEN_NO_VALIDA", 400),
    );
  }

  await assert.rejects(
    procesarYGuardarImagen({ buffer: Buffer.alloc(8 * 1024 * 1024 + 1) }, directorio),
    comprobarError("IMAGEN_DEMASIADO_GRANDE", 413),
  );

  // El límite de píxeles debe comprobarse antes de intentar descodificar una
  // cabecera que declara una imagen enorme, sin reservar esos píxeles en la prueba.
  const jpeg = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).jpeg().toBuffer();
  const posicionCabecera = jpeg.indexOf(Buffer.from([255, 192]));
  assert.ok(posicionCabecera >= 0);
  jpeg.writeUInt16BE(5_001, posicionCabecera + 5);
  jpeg.writeUInt16BE(5_000, posicionCabecera + 7);
  await assert.rejects(
    procesarYGuardarImagen({ buffer: jpeg }, directorio),
    comprobarError("IMAGEN_DEMASIADO_GRANDE", 413),
  );
  assert.deepEqual(await readdir(directorio), []);
});

test("las imágenes grandes se reducen conservando la proporción", async (contexto) => {
  const directorio = await prepararDirectorio(contexto);
  const original = await sharp({ create: { width: 3_000, height: 1_000, channels: 3, background: "orange" } }).png().toBuffer();
  const imagen = await procesarYGuardarImagen({ buffer: original }, directorio);
  assert.equal(imagen.ancho, 2_400);
  assert.equal(imagen.alto, 800);
});

test("la eliminación no acepta rutas elegidas por el cliente", async (contexto) => {
  const directorio = await prepararDirectorio(contexto);
  const imagenes = join(directorio, "imagenes");
  await mkdir(imagenes);
  await writeFile(join(directorio, "conservar.txt"), "conservar");
  await assert.rejects(eliminarImagen("../conservar.txt", imagenes), comprobarError("NOMBRE_IMAGEN_NO_VALIDO", 500));
  assert.equal(await readFile(join(directorio, "conservar.txt"), "utf8"), "conservar");
});

test("la autorización y CSRF se comprueban antes de interpretar un multipart malformado", async (contexto) => {
  const directorio = await prepararDirectorio(contexto);
  const origen = await iniciarServidor(contexto, directorio);
  for (const [cabeceras, estadoEsperado, codigoEsperado] of [
    [{}, 401, "NO_AUTORIZADO"],
    [{ "X-Administrador-Prueba": "si" }, 403, "CSRF_NO_VALIDO"],
  ]) {
    const respuesta = await fetch(`${origen}/api/admin/fotografias`, {
      method: "POST",
      headers: { "Content-Type": "multipart/form-data; boundary=incompleto", ...cabeceras },
      body: "contenido sin cierre multipart",
    });
    assert.equal(respuesta.status, estadoEsperado);
    assert.equal((await respuesta.json()).error.codigo, codigoEsperado);
  }
  assert.deepEqual(await readdir(directorio), []);
});

test("un fallo al insertar en BD revierte la transacción y compensa el archivo nuevo", async (contexto) => {
  const directorio = await prepararDirectorio(contexto);
  const operaciones = [];
  const pool = {
    getConnection: async () => ({
      beginTransaction: async () => operaciones.push("inicio"),
      execute: async () => { throw new Error("Fallo de base de datos con datos privados"); },
      rollback: async () => operaciones.push("restauracion"),
      release: () => operaciones.push("liberacion"),
    }),
  };
  const origen = await iniciarServidor(contexto, directorio, pool);
  const imagen = await sharp({ create: { width: 12, height: 8, channels: 3, background: "orange" } }).png().toBuffer();
  const respuesta = await fetch(`${origen}/api/admin/fotografias`, {
    method: "POST",
    headers: { "X-Administrador-Prueba": "si", "X-CSRF-Token": "token-prueba" },
    body: crearFormulario(imagen),
  });

  assert.equal(respuesta.status, 500);
  assert.equal((await respuesta.json()).error.mensaje, "Se ha producido un error interno.");
  assert.ok(operaciones.includes("restauracion"));
  assert.ok(operaciones.includes("liberacion"));
  assert.deepEqual(await readdir(directorio), []);
});

test("un borrador no es accesible por su URL y una retirada vuelve a impedir la lectura pública", async (contexto) => {
  const directorio = await prepararDirectorio(contexto);
  const imagen = await procesarYGuardarImagen({
    buffer: await sharp({ create: { width: 12, height: 8, channels: 3, background: "orange" } }).png().toBuffer(),
  }, directorio);
  let estado = "borrador";
  const pool = {
    execute: async (consulta, parametros) => [parametros[0] === imagen.nombreArchivo ? [{ estado }] : []],
  };
  const origen = await iniciarServidor(contexto, directorio, pool);
  const ruta = `${origen}/api/imagenes/${imagen.nombreArchivo}`;

  let respuesta = await fetch(ruta);
  assert.equal(respuesta.status, 404);
  await respuesta.arrayBuffer();

  respuesta = await fetch(ruta, { headers: { "X-Administrador-Prueba": "si" } });
  assert.equal(respuesta.status, 200);
  assert.equal(respuesta.headers.get("content-type"), "image/webp");
  assert.equal(respuesta.headers.get("cache-control"), "no-store");
  await respuesta.arrayBuffer();

  estado = "publicado";
  respuesta = await fetch(ruta);
  assert.equal(respuesta.status, 200);
  await respuesta.arrayBuffer();

  estado = "borrador";
  respuesta = await fetch(ruta);
  assert.equal(respuesta.status, 404);
  await respuesta.arrayBuffer();
});
