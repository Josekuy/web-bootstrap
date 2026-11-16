import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { cargarConfiguracion } from "../src/configuracion.js";
import { crearPool } from "../src/base-datos.js";
import { crearAplicacion } from "../src/app.js";
import { crearHashContrasena } from "../src/modules/auth/contrasenas.js";

function crearCliente(origen, origenPermitido, sesiones) {
  let cookie = "";
  return async (ruta, opciones = {}) => {
    const respuesta = await fetch(origen + ruta, {
      ...opciones, signal: AbortSignal.timeout(15000),
      headers: { Origin: origenPermitido, Cookie: cookie, ...opciones.headers },
    });
    for (const cabecera of respuesta.headers.getSetCookie()) {
      cookie = cabecera.split(";")[0];
      const valor = decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1));
      const coincidencia = /^s:([^.]+)\./u.exec(valor);
      if (coincidencia) sesiones.add(coincidencia[1]);
    }
    return respuesta;
  };
}

function formulario(campos, imagen, detalles = []) {
  const datos = new FormData();
  for (const [nombre, valor] of Object.entries(campos)) {
    datos.append(nombre, Array.isArray(valor) ? JSON.stringify(valor) : String(valor));
  }
  if (imagen) datos.append("imagen", new Blob([imagen], { type: "image/png" }), "sintetica.png");
  for (const detalle of detalles) datos.append("imagenesDetalleArchivos", new Blob([detalle], { type: "image/png" }), "detalle.png");
  return datos;
}

async function comprobarError(respuesta, estado, codigo) {
  assert.equal(respuesta.status, estado);
  const contenido = await respuesta.json();
  assert.equal(contenido.error.codigo, codigo);
}

async function listar(solicitar, ruta) {
  const datos = [];
  let pagina = 1;
  let total;
  do {
    const respuesta = await solicitar(`${ruta}?pagina=${pagina}&limite=50`);
    assert.equal(respuesta.status, 200);
    const contenido = await respuesta.json();
    datos.push(...contenido.datos);
    total = contenido.meta.total;
    pagina += 1;
  } while (datos.length < total);
  return datos;
}

test("proyectos: permisos, validación, publicación, tecnologías y sustitución de imágenes con MySQL real", { timeout: 120000 }, async (contexto) => {
  const original = cargarConfiguracion();
  assert.ok(original.basePruebas !== original.baseDatos.database, "se exige una base exclusiva de pruebas");
  const directorio = await mkdtemp(path.join(tmpdir(), "portfolio-proyectos-api-"));
  const imagenes = path.join(directorio, "proyectos");
  await mkdir(imagenes);
  const configuracion = {
    ...original, produccion: false,
    baseDatos: { ...original.baseDatos, database: original.basePruebas },
    directorioImagenes: path.join(directorio, "fotografias"),
    directorioImagenesFotografias: path.join(directorio, "fotografias"),
    directorioImagenesIlustraciones: path.join(directorio, "ilustraciones"),
    directorioImagenesProyectos: imagenes,
  };
  const pool = crearPool(configuracion.baseDatos);
  const sufijo = randomUUID().replaceAll("-", "");
  const slugs = ["qa-" + sufijo, "qa-compartido-" + sufijo];
  const tecnologias = ["QA-" + sufijo, "QA-extra-" + sufijo];
  const usuario = "qa_" + sufijo;
  const contrasena = "Prueba-" + randomUUID();
  const sesiones = new Set();
  let servidor;
  let almacenSesiones;
  let usuarioId;

  contexto.after(async () => {
    if (servidor) await new Promise((resolver, rechazar) => {
      servidor.close((error) => error ? rechazar(error) : resolver());
      servidor.closeAllConnections();
    });
    almacenSesiones?.cerrar();
    try {
      await pool.execute("DELETE FROM proyectos WHERE slug IN (?, ?)", slugs);
      await pool.execute("DELETE FROM tecnologias WHERE nombre IN (?, ?) AND NOT EXISTS (SELECT 1 FROM proyecto_tecnologia WHERE tecnologia_id = tecnologias.id)", tecnologias);
      if (usuarioId) await pool.execute("DELETE FROM usuarios_admin WHERE id = ? AND usuario = ?", [usuarioId, usuario]);
      for (const sesion of sesiones) await pool.execute("DELETE FROM sesiones WHERE id = ?", [sesion]);
    } finally {
      await pool.end();
      if (path.dirname(path.resolve(directorio)) === path.resolve(tmpdir()) && path.basename(directorio).startsWith("portfolio-proyectos-api-")) {
        await rm(directorio, { recursive: true, force: true });
      }
    }
  });

  const [base] = await pool.execute("SELECT DATABASE() AS nombre");
  assert.equal(base[0].nombre, original.basePruebas);
  const [anteriores] = await pool.execute("SELECT id, slug, titulo FROM proyectos ORDER BY id");
  const [cuenta] = await pool.execute("INSERT INTO usuarios_admin (usuario, hash_contrasena) VALUES (?, ?)", [usuario, await crearHashContrasena(contrasena)]);
  usuarioId = cuenta.insertId;
  const aplicacion = await crearAplicacion({ configuracion, pool });
  almacenSesiones = aplicacion.almacenSesiones;
  servidor = aplicacion.app.listen(0, "127.0.0.1");
  await once(servidor, "listening");
  const origen = `http://127.0.0.1:${servidor.address().port}`;
  const admin = crearCliente(origen, configuracion.origenes[0], sesiones);
  const anonimo = crearCliente(origen, configuracion.origenes[0], sesiones);
  await comprobarError(await anonimo("/api/admin/proyectos"), 401, "ACCESO_REQUERIDO");
  const acceso = (await (await admin("/api/admin/sesion")).json()).datos;
  const login = await admin("/api/admin/login", {
    method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": acceso.csrfToken },
    body: JSON.stringify({ usuario, contrasena }),
  });
  assert.equal(login.status, 200);
  const token = (await login.json()).datos.csrfToken;
  const cabeceras = { "X-CSRF-Token": token };
  const campos = { slug: slugs[0], titulo: "Prueba API " + sufijo, categoria: "Prueba", resumen: "Resumen inicial de tarjeta", descripcion: "Contenido inicial", tecnologias: [tecnologias[0]], imagenAlt: "Rectángulo naranja", estado: "borrador", orden: "0" };
  const png = await sharp({ create: { width: 80, height: 50, channels: 3, background: "#ff5b35" } }).png().toBuffer();
  await comprobarError(await admin("/api/admin/proyectos", { method: "POST", body: formulario(campos, png) }), 403, "CSRF_INVALIDO");

  for (const cambios of [
    { tecnologias: ["React", "react"] }, { tecnologias: "no-json" }, { tecnologias: [5] },
    { urlProyecto: "javascript:alert(1)" }, { urlRepositorio: "https://usuario:clave@example.invalid/" },
    { imagenExterna: "http://example.invalid/foto.png" },
    { resumen: "a".repeat(301) },
  ]) {
    await comprobarError(await admin("/api/admin/proyectos", {
      method: "POST", headers: cabeceras, body: formulario({ ...campos, ...cambios }, png),
    }), 400, "DATOS_NO_VALIDOS");
  }
  await comprobarError(await admin("/api/admin/proyectos", {
    method: "POST", headers: cabeceras, body: formulario({ ...campos, imagenExterna: "https://example.invalid/foto.png" }, png),
  }), 400, "IMAGEN_AMBIGUA");
  for (const archivo of [Buffer.from("no es una imagen"), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')]) {
    await comprobarError(await admin("/api/admin/proyectos", { method: "POST", headers: cabeceras, body: formulario(campos, archivo) }), 400, "IMAGEN_NO_VALIDA");
  }
  await comprobarError(await admin("/api/admin/proyectos", {
    method: "POST", headers: cabeceras, body: formulario(campos, Buffer.alloc(8 * 1024 * 1024 + 1)),
  }), 413, "IMAGEN_DEMASIADO_GRANDE");
  assert.deepEqual(await readdir(imagenes), []);

  const creacion = await admin("/api/admin/proyectos", { method: "POST", headers: cabeceras, body: formulario(campos, png) });
  assert.equal(creacion.status, 201);
  const proyecto = (await creacion.json()).datos;
  assert.equal(proyecto.resumen, campos.resumen);
  assert.equal(proyecto.descripcion, campos.descripcion);
  assert.equal(proyecto.estado, "borrador");
  assert.deepEqual(proyecto.tecnologias, [tecnologias[0]]);
  assert.match(proyecto.imagen, /^\/api\/imagenes\/proyectos\/[a-f0-9-]{36}\.webp$/u);
  assert.equal((await listar(anonimo, "/api/proyectos")).some((elemento) => elemento.id === proyecto.id), false);
  await comprobarError(await anonimo(proyecto.imagen), 404, "IMAGEN_NO_ENCONTRADA");
  const imagenPrivada = await admin(proyecto.imagen);
  assert.equal(imagenPrivada.status, 200);
  await imagenPrivada.arrayBuffer();
  await comprobarError(await admin("/api/admin/proyectos", { method: "POST", headers: cabeceras, body: formulario(campos, png) }), 409, "SLUG_DUPLICADO");
  assert.deepEqual(await readdir(imagenes), [path.basename(proyecto.imagen)], "el slug duplicado compensa su archivo sin tocar el original");

  const camposSinResumen = { ...campos };
  delete camposSinResumen.resumen;
  const compartido = await admin("/api/admin/proyectos", {
    method: "POST", headers: cabeceras,
    body: formulario({ ...camposSinResumen, slug: slugs[1], titulo: "Otro proyecto de prueba", imagenExterna: "https://example.invalid/sin-descarga.png", estado: "publicado",
      imagenesDetalle: [{ imagenExterna: "https://example.invalid/detalle-creado.png", imagenAlt: "Detalle externo creado" }],
    }),
  });
  assert.equal(compartido.status, 201);
  const otroProyecto = (await compartido.json()).datos;
  assert.equal(otroProyecto.resumen, "");
  assert.equal(otroProyecto.ancho, null);
  assert.equal(otroProyecto.imagenesDetalle.length, 1);
  assert.equal(otroProyecto.imagenesDetalle[0].imagen, "https://example.invalid/detalle-creado.png");
  const ruta = `/api/admin/proyectos/${proyecto.id}`;
  for (const resumen of [null, 7, ["repetido", "duplicado"], "Texto\u0000oculto", "😀".repeat(301)]) {
    await comprobarError(await admin(ruta, {
      method: "PUT", headers: { ...cabeceras, "Content-Type": "application/json" }, body: JSON.stringify({ resumen }),
    }), 400, "DATOS_NO_VALIDOS");
  }
  const resumenUnicode = await admin(ruta, {
    method: "PUT", headers: cabeceras, body: formulario({ resumen: "😀".repeat(300) }),
  });
  assert.equal(resumenUnicode.status, 200);
  const conResumenUnicode = (await resumenUnicode.json()).datos;
  assert.equal(conResumenUnicode.resumen, "😀".repeat(300));
  assert.equal(conResumenUnicode.descripcion, campos.descripcion, "editar el resumen conserva la descripción extensa");
  const vaciarResumen = await admin(ruta, {
    method: "PUT", headers: { ...cabeceras, "Content-Type": "application/json" }, body: JSON.stringify({ resumen: "" }),
  });
  assert.equal(vaciarResumen.status, 200);
  const sinResumen = (await vaciarResumen.json()).datos;
  assert.equal(sinResumen.resumen, "", "vaciar el resumen no almacena un extracto generado");
  assert.equal(sinResumen.descripcion, campos.descripcion);
  const resumenActualizado = await admin(ruta, {
    method: "PUT", headers: cabeceras, body: formulario({ resumen: " Resumen\nde la tarjeta\tactualizado " }),
  });
  assert.equal(resumenActualizado.status, 200);
  assert.equal((await resumenActualizado.json()).datos.resumen, "Resumen de la tarjeta actualizado");
  assert.deepEqual(proyecto.imagenesDetalle, []);
  const archivosOriginales = await readdir(imagenes);
  await comprobarError(await admin(ruta, {
    method: "PUT", headers: cabeceras, body: formulario({}, null, [png]),
  }), 400, "DATOS_NO_VALIDOS");
  await comprobarError(await admin(ruta, {
    method: "PUT", headers: cabeceras,
    body: formulario({ imagenesDetalle: [{ archivo: 0 }, { archivo: 1 }] }, png, [png, Buffer.from("falsa")]),
  }), 400, "IMAGEN_NO_VALIDA");
  assert.deepEqual(await readdir(imagenes), archivosOriginales, "un fallo al procesar el segundo detalle retira todas las subidas nuevas");
  const galeriaCreada = await admin(ruta, {
    method: "PUT", headers: cabeceras,
    body: formulario({ imagenesDetalle: [
      { archivo: 1, imagenAlt: "Segunda captura" }, { imagenExterna: "https://example.invalid/detalle.png", imagenAlt: "Externa" },
      { archivo: 0, imagenAlt: "Primera captura" },
    ] }, null, [png, png]),
  });
  assert.equal(galeriaCreada.status, 200);
  const conGaleria = (await galeriaCreada.json()).datos;
  assert.equal(conGaleria.resumen, "Resumen de la tarjeta actualizado", "omitir el resumen lo conserva");
  assert.equal(conGaleria.descripcion, campos.descripcion, "omitir la descripción la conserva");
  assert.equal(conGaleria.imagen, proyecto.imagen, "la galería conserva la portada");
  assert.equal(conGaleria.imagenesDetalle.length, 3);
  assert.deepEqual(conGaleria.imagenesDetalle.map((entrada) => entrada.imagenAlt), ["Segunda captura", "Externa", "Primera captura"]);
  const detalleLocal = conGaleria.imagenesDetalle[0];
  assert.equal(detalleLocal.ancho, 80);
  assert.equal(conGaleria.imagenesDetalle[1].ancho, null);
  await comprobarError(await anonimo(detalleLocal.imagen), 404, "IMAGEN_NO_ENCONTRADA");
  const detallePrivado = await admin(detalleLocal.imagen);
  assert.equal(detallePrivado.status, 200);
  await detallePrivado.arrayBuffer();
  const archivosAntesDeIdAjeno = (await readdir(imagenes)).sort();
  await comprobarError(await admin(`/api/admin/proyectos/${otroProyecto.id}`, {
    method: "PUT", headers: cabeceras,
    body: formulario({ titulo: "No debe persistir", imagenesDetalle: [{ archivo: 0 }, { id: detalleLocal.id, imagenAlt: "Ajena" }] }, null, [png]),
  }), 400, "DATOS_NO_VALIDOS");
  assert.deepEqual((await readdir(imagenes)).sort(), archivosAntesDeIdAjeno, "un id ajeno compensa las subidas nuevas");
  const otroTrasError = (await listar(admin, "/api/admin/proyectos")).find((entrada) => entrada.id === otroProyecto.id);
  assert.equal(otroTrasError.titulo, otroProyecto.titulo);
  assert.deepEqual(otroTrasError.imagenesDetalle, otroProyecto.imagenesDetalle, "el rollback conserva la galería anterior");
  const antesFallo = (await readdir(imagenes)).sort();
  await comprobarError(await admin(ruta, {
    method: "PUT", headers: cabeceras,
    body: formulario({ slug: slugs[1], imagenesDetalle: [{ archivo: 0 }] }, png, [png]),
  }), 409, "SLUG_DUPLICADO");
  assert.deepEqual((await readdir(imagenes)).sort(), antesFallo, "un rollback compensa portada y galería nuevas");
  await pool.execute("UPDATE proyectos SET fecha_actualizacion = '2000-01-01 00:00:00' WHERE id = ?", [proyecto.id]);
  const ordenDetalle = [...conGaleria.imagenesDetalle].reverse().map(({ id }, indice) => ({ id, imagenAlt: `Detalle ${indice}` }));
  const reordenacion = await admin(ruta, {
    method: "PUT", headers: { ...cabeceras, "Content-Type": "application/json" },
    body: JSON.stringify({ imagenesDetalle: ordenDetalle }),
  });
  assert.equal(reordenacion.status, 200);
  const reordenado = (await reordenacion.json()).datos;
  assert.deepEqual(reordenado.imagenesDetalle.map(({ id }) => id), ordenDetalle.map(({ id }) => id));
  assert.deepEqual(reordenado.imagenesDetalle.map(({ imagenAlt }) => imagenAlt), ["Detalle 0", "Detalle 1", "Detalle 2"]);
  assert.ok(Date.parse(reordenado.actualizadoEn) > Date.parse("2000-01-01T00:00:00Z"), "editar solo la galería actualiza la fecha del proyecto");
  const edicion = await admin(ruta, {
    method: "PUT", headers: { ...cabeceras, "Content-Type": "application/json" },
    body: JSON.stringify({ estado: "publicado", descripcion: "Datos publicados para la tarjeta y su ficha", tecnologias, urlProyecto: "https://example.invalid/demo", urlRepositorio: "https://example.invalid/codigo", orden: 2 }),
  });
  assert.equal(edicion.status, 200);
  const editado = (await edicion.json()).datos;
  assert.equal(editado.resumen, "Resumen de la tarjeta actualizado", "editar la descripción extensa conserva el resumen");
  assert.deepEqual(editado.tecnologias, tecnologias);
  assert.equal(editado.imagen, proyecto.imagen);
  assert.deepEqual(editado.imagenesDetalle, reordenado.imagenesDetalle, "omitir la galería conserva las imágenes y su orden");
  const publico = (await listar(anonimo, "/api/proyectos")).find((elemento) => elemento.id === proyecto.id);
  assert.equal(publico.descripcion, "Datos publicados para la tarjeta y su ficha");
  assert.equal(publico.resumen, "Resumen de la tarjeta actualizado");
  assert.equal(publico.urlProyecto, "https://example.invalid/demo");
  assert.deepEqual(publico.tecnologias, tecnologias);
  assert.deepEqual(publico.imagenesDetalle, reordenado.imagenesDetalle);
  const detallePublico = await anonimo(detalleLocal.imagen);
  assert.equal(detallePublico.status, 200);
  await detallePublico.arrayBuffer();
  const imagenPublica = await anonimo(proyecto.imagen);
  assert.equal(imagenPublica.status, 200);
  await imagenPublica.arrayBuffer();
  await comprobarError(await admin(ruta, {
    method: "PUT", headers: { ...cabeceras, "Content-Type": "application/json" }, body: JSON.stringify({ slug: slugs[1] }),
  }), 409, "SLUG_DUPLICADO");

  const reemplazo = await admin(ruta, { method: "PUT", headers: cabeceras, body: formulario({ imagenExterna: "https://example.invalid/reemplazo.png" }) });
  assert.equal(reemplazo.status, 200);
  const externo = (await reemplazo.json()).datos;
  assert.equal(externo.imagen, "https://example.invalid/reemplazo.png");
  assert.equal(externo.imagenExterna, externo.imagen);
  assert.equal(externo.ancho, null);
  assert.equal((await readdir(imagenes)).length, 2, "cambiar la portada conserva los archivos de detalle");
  assert.deepEqual(externo.imagenesDetalle, reordenado.imagenesDetalle);
  await comprobarError(await anonimo(proyecto.imagen), 404, "IMAGEN_NO_ENCONTRADA");
  const quitarGaleria = await admin(ruta, {
    method: "PUT", headers: { ...cabeceras, "Content-Type": "application/json" }, body: JSON.stringify({ imagenesDetalle: [] }),
  });
  assert.equal(quitarGaleria.status, 200);
  assert.deepEqual((await quitarGaleria.json()).datos.imagenesDetalle, []);
  assert.deepEqual(await readdir(imagenes), [], "vaciar la galería elimina sus archivos locales");
  await comprobarError(await anonimo(detalleLocal.imagen), 404, "IMAGEN_NO_ENCONTRADA");
  const vueltaLocal = await admin(ruta, { method: "PUT", headers: cabeceras, body: formulario({}, png) });
  assert.equal(vueltaLocal.status, 200);
  const local = (await vueltaLocal.json()).datos;
  assert.equal(local.imagenExterna, null);
  assert.equal(local.ancho, 80);
  const galeriaAntesDeBorrar = await admin(ruta, {
    method: "PUT", headers: cabeceras, body: formulario({ imagenesDetalle: [{ archivo: 0 }] }, null, [png]),
  });
  assert.equal(galeriaAntesDeBorrar.status, 200);
  const ultimoDetalle = (await galeriaAntesDeBorrar.json()).datos.imagenesDetalle[0];
  const retirada = await admin(ruta, { method: "PUT", headers: cabeceras, body: formulario({ estado: "borrador" }) });
  assert.equal(retirada.status, 200);
  await retirada.json();
  await comprobarError(await anonimo(local.imagen), 404, "IMAGEN_NO_ENCONTRADA");
  await comprobarError(await anonimo(ultimoDetalle.imagen), 404, "IMAGEN_NO_ENCONTRADA");
  const borrado = await admin(ruta, { method: "DELETE", headers: cabeceras });
  assert.equal(borrado.status, 200);
  await borrado.json();
  assert.deepEqual(await readdir(imagenes), []);
  const [relacionesBorradas] = await pool.execute("SELECT proyecto_id FROM proyecto_tecnologia WHERE proyecto_id = ?", [proyecto.id]);
  assert.equal(relacionesBorradas.length, 0);
  const [detallesBorrados] = await pool.execute("SELECT id FROM proyecto_imagenes WHERE proyecto_id = ?", [proyecto.id]);
  assert.equal(detallesBorrados.length, 0);
  const otroPublico = (await listar(anonimo, "/api/proyectos")).find((elemento) => elemento.id === otroProyecto.id);
  assert.deepEqual(otroPublico.tecnologias, [tecnologias[0]], "borrar un proyecto no elimina tecnologías usadas por otro");
  const galeriaMaxima = Array.from({ length: 8 }, (_valor, indice) => ({
    imagenExterna: `https://example.invalid/${indice}/` + "a".repeat(2000), imagenAlt: "🎨".repeat(300),
  }));
  assert.ok(Buffer.byteLength(JSON.stringify(galeriaMaxima)) > 24 * 1024, "el límite multipart debe admitir ocho URL y textos Unicode completos");
  const extremos = await admin(`/api/admin/proyectos/${otroProyecto.id}`, {
    method: "PUT", headers: cabeceras, body: formulario({ imagenesDetalle: galeriaMaxima }),
  });
  assert.equal(extremos.status, 200);
  assert.deepEqual((await extremos.json()).datos.imagenesDetalle.map(({ imagenExterna, imagenAlt }) => ({ imagenExterna, imagenAlt })), galeriaMaxima);
  await admin(`/api/admin/proyectos/${otroProyecto.id}`, { method: "DELETE", headers: cabeceras });
  const [posteriores] = await pool.execute("SELECT id, slug, titulo FROM proyectos ORDER BY id");
  assert.deepEqual(posteriores, anteriores, "todos los proyectos anteriores a la prueba se conservan");
});
