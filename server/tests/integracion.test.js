import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { access, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { cargarConfiguracion } from "../src/configuracion.js";
import { crearPool } from "../src/base-datos.js";
import { crearAplicacion } from "../src/app.js";
import { crearHashContrasena } from "../src/modules/auth/contrasenas.js";

/** Mantiene las cookies como un navegador y registra solo sus propias sesiones para limpiarlas. */
function crearCliente(origen, origenPermitido, nombreCookie, sesionesPropias, cookieInicial) {
  const cookies = new Map(cookieInicial ? [[nombreCookie, cookieInicial]] : []);

  async function solicitar(ruta, opciones = {}) {
    const cabeceras = new Headers(opciones.headers);
    if (!cabeceras.has("Origin")) cabeceras.set("Origin", origenPermitido);
    if (cookies.size) cabeceras.set("Cookie", [...cookies].map(([nombre, valor]) => `${nombre}=${valor}`).join("; "));
    const respuesta = await fetch(origen + ruta, {
      ...opciones, headers: cabeceras, redirect: "manual", signal: AbortSignal.timeout(15000),
    });
    for (const cabecera of respuesta.headers.getSetCookie()) {
      const [pareja] = cabecera.split(";");
      const separador = pareja.indexOf("=");
      const nombre = pareja.slice(0, separador);
      const valor = pareja.slice(separador + 1);
      if (!valor || /Max-Age=0|Expires=Thu, 01 Jan 1970/iu.test(cabecera)) cookies.delete(nombre);
      else cookies.set(nombre, valor);
      if (nombre === nombreCookie && valor) {
        const coincidencia = /^s:([^.]+)\./u.exec(decodeURIComponent(valor));
        if (coincidencia) sesionesPropias.add(coincidencia[1]);
      }
    }
    return respuesta;
  }

  return { solicitar, obtenerCookie: () => cookies.get(nombreCookie) };
}

function crearFormulario(imagen, campos = {}, tipo = "image/png", nombre = "superficie.png") {
  const formulario = new FormData();
  for (const [campo, valor] of Object.entries(campos)) formulario.append(campo, String(valor));
  if (imagen) formulario.append("imagen", new Blob([imagen], { type: tipo }), nombre);
  return formulario;
}

async function comprobarError(respuesta, estado, codigo) {
  assert.equal(respuesta.status, estado);
  const cuerpo = await respuesta.json();
  assert.equal(cuerpo.error?.codigo, codigo);
  assert.equal(typeof cuerpo.error.mensaje, "string");
  return cuerpo;
}

/** Busca por páginas para no suponer que la base de pruebas está vacía. */
async function buscarFotografia(cliente, ruta, id) {
  let pagina = 1;
  let total;
  do {
    const respuesta = await cliente.solicitar(`${ruta}?pagina=${pagina}&limite=50`);
    assert.equal(respuesta.status, 200);
    const listado = await respuesta.json();
    assert.ok(Array.isArray(listado.datos));
    assert.equal(listado.meta.pagina, pagina);
    total = listado.meta.total;
    const fotografia = listado.datos.find((elemento) => elemento.id === id);
    if (fotografia) return fotografia;
    pagina += 1;
  } while ((pagina - 1) * 50 < total);
  return null;
}

test("la API real con MySQL protege el acceso y completa el ciclo de publicación de una fotografía", { timeout: 120000 }, async (contexto) => {
  const original = cargarConfiguracion();
  assert.ok(original.basePruebas !== original.baseDatos.database, "la integración exige una base distinta de la del portfolio");
  const directorio = await mkdtemp(path.join(tmpdir(), "portfolio-api-pruebas-"));
  const configuracion = {
    ...original,
    produccion: false,
    directorioImagenes: directorio,
    baseDatos: { ...original.baseDatos, database: original.basePruebas },
  };
  const pool = crearPool(configuracion.baseDatos);
  const identificador = randomUUID();
  const usuario = "prueba_" + identificador.replaceAll("-", "");
  const contrasena = "Prueba-aislada-" + randomUUID();
  const tituloInicial = "Prueba API " + identificador;
  const tituloEditado = tituloInicial + " editada";
  const sesionesPropias = new Set();
  let servidor;
  let almacenSesiones;
  let idUsuario;

  // Solo borra nuestras filas y el directorio temporal creado por esta ejecución.
  contexto.after(async () => {
    if (servidor) {
      await new Promise((resolver, rechazar) => {
        servidor.close((error) => error ? rechazar(error) : resolver());
        servidor.closeAllConnections();
      });
    }
    almacenSesiones?.cerrar();
    try {
      await pool.execute("DELETE FROM fotografias WHERE titulo IN (?, ?)", [tituloInicial, tituloEditado]);
      if (idUsuario) await pool.execute("DELETE FROM usuarios_admin WHERE id = ? AND usuario = ?", [idUsuario, usuario]);
      for (const sesion of sesionesPropias) await pool.execute("DELETE FROM sesiones WHERE id = ?", [sesion]);
    } finally {
      await pool.end();
      if (path.dirname(path.resolve(directorio)) === path.resolve(tmpdir()) && path.basename(directorio).startsWith("portfolio-api-pruebas-")) {
        await rm(directorio, { recursive: true, force: true });
      }
    }
  });

  const [conexionActual] = await pool.execute("SELECT DATABASE() AS nombre");
  assert.equal(conexionActual[0].nombre, original.basePruebas);
  const hash = await crearHashContrasena(contrasena);
  const [cuenta] = await pool.execute("INSERT INTO usuarios_admin (usuario, hash_contrasena) VALUES (?, ?)", [usuario, hash]);
  idUsuario = cuenta.insertId;
  const aplicacion = await crearAplicacion({ configuracion, pool });
  almacenSesiones = aplicacion.almacenSesiones;
  servidor = aplicacion.app.listen(0, "127.0.0.1");
  await once(servidor, "listening");
  const origen = `http://127.0.0.1:${servidor.address().port}`;
  const crearNavegador = (cookie) => crearCliente(origen, configuracion.origenes[0], configuracion.nombreCookie, sesionesPropias, cookie);
  const administrador = crearNavegador();
  const anonimo = crearNavegador();

  await comprobarError(await anonimo.solicitar("/api/admin/fotografias"), 401, "ACCESO_REQUERIDO");
  const sesionAnonima = await administrador.solicitar("/api/admin/sesion");
  assert.equal(sesionAnonima.status, 200);
  const accesoInicial = (await sesionAnonima.json()).datos;
  assert.equal(accesoInicial.autenticado, false);
  assert.equal(accesoInicial.usuario, null);
  assert.ok(/^[a-f0-9]{64}$/u.test(accesoInicial.csrfToken));
  const cookieAnonima = administrador.obtenerCookie();
  assert.ok(cookieAnonima);
  assert.ok(sesionAnonima.headers.getSetCookie().some((cabecera) => /HttpOnly/iu.test(cabecera) && /SameSite=Strict/iu.test(cabecera)));
  const credenciales = JSON.stringify({ usuario, contrasena });
  const cabecerasAcceso = { "Content-Type": "application/json", "X-CSRF-Token": accesoInicial.csrfToken };

  await comprobarError(await administrador.solicitar("/api/admin/login", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: credenciales,
  }), 403, "CSRF_INVALIDO");
  await comprobarError(await administrador.solicitar("/api/admin/login", {
    method: "POST", headers: { ...cabecerasAcceso, Origin: "https://origen-ajeno.invalid" }, body: credenciales,
  }), 403, "ORIGEN_NO_PERMITIDO");
  await comprobarError(await administrador.solicitar("/api/admin/login", {
    method: "POST", headers: cabecerasAcceso, body: JSON.stringify({ usuario, contrasena: "Clave-incorrecta-de-prueba" }),
  }), 401, "CREDENCIALES_INVALIDAS");

  const respuestaAcceso = await administrador.solicitar("/api/admin/login", {
    method: "POST", headers: cabecerasAcceso, body: credenciales,
  });
  assert.equal(respuestaAcceso.status, 200);
  const sesion = (await respuestaAcceso.json()).datos;
  assert.equal(sesion.autenticado, true);
  assert.equal(sesion.usuario.id, idUsuario);
  assert.equal(sesion.usuario.usuario, usuario);
  assert.ok(sesion.csrfToken !== accesoInicial.csrfToken, "el acceso debe rotar el token CSRF");
  assert.ok(administrador.obtenerCookie() !== cookieAnonima, "el acceso debe regenerar la sesión");
  await comprobarError(await crearNavegador(cookieAnonima).solicitar("/api/admin/fotografias"), 401, "ACCESO_REQUERIDO");
  const cabecerasCambio = { "X-CSRF-Token": sesion.csrfToken };

  // El token previo al acceso tampoco puede utilizarse con la nueva sesión.
  await comprobarError(await administrador.solicitar("/api/admin/fotografias", {
    method: "POST", headers: { "X-CSRF-Token": accesoInicial.csrfToken }, body: crearFormulario(null, { titulo: tituloInicial }),
  }), 403, "CSRF_INVALIDO");

  const metadatos = {
    titulo: tituloInicial, descripcion: "Imagen sintética de integración.",
    imagenAlt: "Rectángulo de color naranja", orden: "0", estado: "borrador",
  };
  for (const [contenido, tipo, nombre] of [
    [Buffer.from("Este archivo no contiene una imagen"), "image/png", "falsa.png"],
    [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'), "image/svg+xml", "vector.svg"],
  ]) {
    await comprobarError(await administrador.solicitar("/api/admin/fotografias", {
      method: "POST", headers: cabecerasCambio, body: crearFormulario(contenido, metadatos, tipo, nombre),
    }), 400, "IMAGEN_NO_VALIDA");
  }
  await comprobarError(await administrador.solicitar("/api/admin/fotografias", {
    method: "POST", headers: cabecerasCambio,
    body: crearFormulario(Buffer.alloc(8 * 1024 * 1024 + 1), metadatos),
  }), 413, "IMAGEN_DEMASIADO_GRANDE");
  assert.deepEqual(await readdir(directorio), [], "las subidas rechazadas no dejan archivos");

  const imagenOriginal = await sharp({ create: { width: 96, height: 64, channels: 3, background: "#ff5b35" } }).png().toBuffer();
  const respuestaCreacion = await administrador.solicitar("/api/admin/fotografias", {
    method: "POST", headers: cabecerasCambio, body: crearFormulario(imagenOriginal, metadatos),
  });
  assert.equal(respuestaCreacion.status, 201);
  const fotografia = (await respuestaCreacion.json()).datos;
  assert.ok(Number.isSafeInteger(fotografia.id));
  assert.equal(fotografia.estado, "borrador");
  assert.equal(fotografia.ancho, 96);
  assert.equal(fotografia.alto, 64);
  assert.match(fotografia.imagen, /^\/api\/imagenes\/[a-f0-9-]{36}\.webp$/u);
  assert.equal((await buscarFotografia(administrador, "/api/admin/fotografias", fotografia.id)).titulo, tituloInicial);
  assert.equal(await buscarFotografia(anonimo, "/api/fotografias", fotografia.id), null);
  await comprobarError(await anonimo.solicitar(fotografia.imagen), 404, "IMAGEN_NO_ENCONTRADA");
  const vistaPrivada = await administrador.solicitar(fotografia.imagen);
  assert.equal(vistaPrivada.status, 200);
  assert.equal(vistaPrivada.headers.get("content-type"), "image/webp");
  assert.equal(vistaPrivada.headers.get("cache-control"), "no-store");
  assert.equal((await sharp(Buffer.from(await vistaPrivada.arrayBuffer())).metadata()).format, "webp");

  const rutaFotografia = `/api/admin/fotografias/${fotografia.id}`;
  const publicada = await administrador.solicitar(rutaFotografia, {
    method: "PUT", headers: cabecerasCambio, body: crearFormulario(null, { estado: "publicado" }),
  });
  assert.equal(publicada.status, 200);
  assert.equal((await publicada.json()).datos.estado, "publicado");
  assert.equal((await buscarFotografia(anonimo, "/api/fotografias", fotografia.id)).estado, "publicado");
  const imagenPublica = await anonimo.solicitar(fotografia.imagen);
  assert.equal(imagenPublica.status, 200);
  await imagenPublica.arrayBuffer();

  const respuestaEdicion = await administrador.solicitar(rutaFotografia, {
    method: "PUT", headers: cabecerasCambio,
    body: crearFormulario(null, { titulo: tituloEditado, descripcion: "Descripción actualizada", imagenAlt: "Superficie naranja editada", orden: "2" }),
  });
  assert.equal(respuestaEdicion.status, 200);
  const editada = (await respuestaEdicion.json()).datos;
  assert.equal(editada.titulo, tituloEditado);
  assert.equal(editada.imagenAlt, "Superficie naranja editada");
  assert.equal(editada.orden, 2);
  assert.equal(editada.imagen, fotografia.imagen, "editar texto conserva el archivo anterior");
  assert.equal(editada.estado, "publicado");

  const nuevaImagen = await sharp({ create: { width: 48, height: 96, channels: 3, background: "#2979ff" } }).png().toBuffer();
  const respuestaReemplazo = await administrador.solicitar(rutaFotografia, {
    method: "PUT", headers: cabecerasCambio,
    body: crearFormulario(nuevaImagen, { imagenAlt: "Rectángulo azul vertical" }),
  });
  assert.equal(respuestaReemplazo.status, 200);
  const reemplazada = (await respuestaReemplazo.json()).datos;
  assert.ok(reemplazada.imagen !== fotografia.imagen);
  assert.equal(reemplazada.ancho, 48);
  assert.equal(reemplazada.alto, 96);
  await comprobarError(await anonimo.solicitar(fotografia.imagen), 404, "IMAGEN_NO_ENCONTRADA");
  await assert.rejects(access(path.join(directorio, path.basename(fotografia.imagen))), { code: "ENOENT" });
  const archivoNuevo = await anonimo.solicitar(reemplazada.imagen);
  assert.equal(archivoNuevo.status, 200);
  await archivoNuevo.arrayBuffer();
  assert.deepEqual(await readdir(directorio), [path.basename(reemplazada.imagen)]);

  // Retirar una publicación vuelve a bloquear tanto el listado como su URL conocida.
  const retirada = await administrador.solicitar(rutaFotografia, {
    method: "PUT", headers: cabecerasCambio, body: crearFormulario(null, { estado: "borrador" }),
  });
  assert.equal(retirada.status, 200);
  await retirada.json();
  assert.equal(await buscarFotografia(anonimo, "/api/fotografias", fotografia.id), null);
  await comprobarError(await anonimo.solicitar(reemplazada.imagen), 404, "IMAGEN_NO_ENCONTRADA");
  const respuestaBorrado = await administrador.solicitar(rutaFotografia, { method: "DELETE", headers: cabecerasCambio });
  assert.equal(respuestaBorrado.status, 200);
  assert.equal((await respuestaBorrado.json()).datos.id, fotografia.id);
  const [filas] = await pool.execute("SELECT id FROM fotografias WHERE id = ?", [fotografia.id]);
  assert.equal(filas.length, 0);
  assert.deepEqual(await readdir(directorio), []);
  await comprobarError(await administrador.solicitar(reemplazada.imagen), 404, "IMAGEN_NO_ENCONTRADA");

  const cookieAutenticada = administrador.obtenerCookie();
  const salida = await administrador.solicitar("/api/admin/logout", { method: "POST", headers: cabecerasCambio });
  assert.equal(salida.status, 200);
  assert.equal((await salida.json()).datos.autenticado, false);
  await comprobarError(await administrador.solicitar("/api/admin/fotografias"), 401, "ACCESO_REQUERIDO");
  await comprobarError(await crearNavegador(cookieAutenticada).solicitar("/api/admin/fotografias"), 401, "ACCESO_REQUERIDO");
});
