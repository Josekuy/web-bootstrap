/*
 * Recorrido del panel en Chrome real: acceso, borrador, edición/publicación y borrado.
 * Requiere API y Vite iniciados. Ejecutar: node scripts/comprobar-admin.cjs [--fotografias] [--capturas]
 * Por defecto comprueba Ilustración; --fotografias selecciona la galería independiente.
 * Lee ADMIN_USUARIO y ADMIN_CONTRASENA de .env sin mostrarlos.
 * Crea una imagen sintética con título único y elimina únicamente esa obra.
 */
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const sharp = require("sharp");
const dotenv = require("dotenv");
const { abrirNavegador } = require("./soporte-cdp.cjs");

dotenv.config({ path: path.resolve(__dirname, "../.env"), quiet: true });
const origen = new URL(process.env.PORTFOLIO_URL || "http://127.0.0.1:5173/").origin;
const ilustracion = { recurso: "ilustraciones", titulo: "Ilustración", singular: "ilustración", prefijo: "ilustracion", seccion: "ilustracion", clase: "illustration" };
const fotografia = { recurso: "fotografias", titulo: "Fotografía", singular: "fotografía", prefijo: "foto", seccion: "fotografia", clase: "photography" };
const galeria = process.argv.includes("--fotografias") ? fotografia : ilustracion;
const otraGaleria = galeria === fotografia ? ilustracion : fotografia;
const rutaAdmin = "/api/admin/" + galeria.recurso;
const selectorGestion = "#gestion-" + galeria.recurso;
const selectorPublico = "#" + galeria.seccion;
const enGestion = (selector) => selectorGestion + " " + selector;
const campo = (nombre) => "#" + galeria.prefijo + "-" + nombre;
const selectorGuardar = enGestion('section[aria-labelledby="editor-' + galeria.seccion + '-titulo"] button[type=submit]');
const titulo = "Prueba automática " + galeria.singular + " " + randomUUID();
const tituloEditado = titulo + " editada";
let navegador;
let directorio;
let carpetaCapturas;
let cookieSesion = "";
let registroPosible = false;
let comprobaciones = 0;
let etapa = "preparación";

async function verificar(expresion, descripcion) {
  assert.equal(await navegador.evaluar(expresion), true, descripcion);
  comprobaciones += 1;
}

async function solicitarApi(ruta, opciones = {}) {
  return fetch(origen + ruta, {
    ...opciones, signal: AbortSignal.timeout(15000),
    headers: { Cookie: cookieSesion, Origin: origen, ...opciones.headers },
  });
}

/** Consulta solo el recurso elegido y el título aleatorio creado por esta prueba. */
async function buscarRegistro() {
  let pagina = 1;
  let total;
  do {
    const respuesta = await solicitarApi(rutaAdmin + `?pagina=${pagina}&limite=50`);
    if (!respuesta.ok) throw new Error("No se pudo comprobar el registro de prueba en la API.");
    const contenido = await respuesta.json();
    const registro = contenido.datos.find((obra) => [titulo, tituloEditado].includes(obra.titulo));
    if (registro) return registro;
    total = contenido.meta.total;
    pagina += 1;
  } while ((pagina - 1) * 50 < total);
  return null;
}

async function activarGaleria(recurso = galeria.recurso) {
  const boton = '[data-seccion="' + recurso + '"]';
  const contenedor = "#gestion-" + recurso;
  await navegador.esperarHasta(() => navegador.evaluar(`!!document.querySelector(${JSON.stringify(boton)}) && !document.querySelector(${JSON.stringify(boton)}).disabled`), "navegación disponible");
  await navegador.pulsar(boton);
  await navegador.esperarHasta(() => navegador.evaluar(`!!document.querySelector(${JSON.stringify(contenedor)}) && !document.querySelector(${JSON.stringify(contenedor)}).hidden && document.querySelector(${JSON.stringify(contenedor + ' .admin__tabla')})?.getAttribute('aria-busy') === 'false'`), "apertura del listado de " + recurso);
}

/** Se acotan las consultas: los otros gestores siguen montados y conservan sus formularios. */
async function esperarFila(nombre) {
  const tabla = JSON.stringify(enGestion(".admin__tabla"));
  const celdas = JSON.stringify(enGestion(".admin__listado tbody th"));
  const siguiente = enGestion(".admin__paginacion button:last-child");
  const paginaActual = JSON.stringify(enGestion(".admin__paginacion span"));
  for (let pagina = 0; pagina < 100; pagina += 1) {
    await navegador.esperarHasta(() => navegador.evaluar(`document.querySelector(${tabla})?.getAttribute('aria-busy') === 'false'`), "fin de carga del listado");
    if (await navegador.evaluar(`[...document.querySelectorAll(${celdas})].some(celda => celda.textContent === ${JSON.stringify(nombre)})`)) return;
    if (await navegador.evaluar(`document.querySelector(${JSON.stringify(siguiente)}).disabled`)) break;
    const paginaAnterior = await navegador.evaluar(`document.querySelector(${paginaActual}).textContent`);
    await navegador.pulsar(siguiente);
    await navegador.esperarHasta(() => navegador.evaluar(`document.querySelector(${paginaActual}).textContent !== ${JSON.stringify(paginaAnterior)}`), "cambio de página del listado");
  }
  throw new Error("La obra guardada no aparece en el listado del panel.");
}

async function capturar(nombre) {
  if (!carpetaCapturas) return;
  const captura = await navegador.enviar("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  await fs.writeFile(path.join(carpetaCapturas, galeria.recurso + "-" + nombre + ".png"), Buffer.from(captura.data, "base64"));
}

/** Si falla la interfaz, se limpia por API con la sesión y el recurso de esta prueba. */
async function limpiarRegistro() {
  if (!registroPosible || !cookieSesion) return;
  const respuestaSesion = await solicitarApi("/api/admin/sesion");
  const sesion = (await respuestaSesion.json()).datos;
  if (!sesion.autenticado) throw new Error("No se pudo recuperar la sesión para limpiar la obra temporal.");
  const registro = await buscarRegistro();
  if (registro) {
    const borrado = await solicitarApi(rutaAdmin + "/" + registro.id, {
      method: "DELETE", headers: { "X-CSRF-Token": sesion.csrfToken },
    });
    if (!borrado.ok) throw new Error("No se pudo eliminar la obra temporal de la prueba.");
    await borrado.json();
  }
  registroPosible = false;
}

async function ejecutar() {
  const usuario = process.env.ADMIN_USUARIO || "admin";
  const contrasena = process.env.ADMIN_CONTRASENA;
  if (!contrasena) throw new Error("Configura el acceso de pruebas en .env antes de comprobar el panel.");
  const salud = await fetch(origen + "/api/salud", { signal: AbortSignal.timeout(5000) });
  assert.equal(salud.status, 200, "Vite debe comunicar con la API antes de empezar");
  directorio = await fs.mkdtemp(path.join(os.tmpdir(), "portfolio-admin-prueba-"));
  const archivo = path.join(directorio, "superficie-sintetica.png");
  await sharp({ create: { width: 160, height: 100, channels: 3, background: "#ff5b35" } }).png().toFile(archivo);
  if (process.argv.includes("--capturas")) carpetaCapturas = await fs.mkdtemp(path.join(os.tmpdir(), "portfolio-admin-capturas-"));
  navegador = await abrirNavegador();
  etapa = "apertura del acceso";
  await navegador.enviar("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await navegador.navegar(origen + "/admin", "!!document.querySelector('#admin-usuario')");
  await verificar("!!document.querySelector('#admin-contrasena[type=password]') && !document.querySelector('#foto-titulo') && !document.querySelector('#ilustracion-titulo')", "el panel solicita acceso antes de mostrar la edición");
  await navegador.rellenar("#admin-usuario", usuario);
  await navegador.rellenar("#admin-contrasena", contrasena);
  etapa = "inicio de sesión";
  await navegador.pulsar(".admin__acceso button[type=submit]");
  await navegador.esperarHasta(() => navegador.evaluar("!!document.querySelector('#gestion-ilustraciones') && !document.querySelector('#admin-usuario')"), "acceso al panel");
  await activarGaleria();
  await verificar("['proyectos', 'ilustraciones', 'fotografias'].every(recurso => !!document.querySelector('[data-seccion=\"' + recurso + '\"]'))", "las tres secciones están disponibles");
  await verificar("(() => { const ids = [...document.querySelectorAll('[id]')].map(elemento => elemento.id); return ids.length === new Set(ids).size; })()", "los gestores montados utilizan identificadores diferentes");
  const cookies = await navegador.enviar("Network.getCookies", { urls: [origen] });
  cookieSesion = cookies.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  comprobaciones += 1;

  etapa = "independencia de los formularios";
  await navegador.rellenar(campo("titulo"), titulo);
  await activarGaleria(otraGaleria.recurso);
  const campoOtraGaleria = "#" + otraGaleria.prefijo + "-titulo";
  await verificar(`document.querySelector(${JSON.stringify(campoOtraGaleria)}).value === ''`, "la otra galería tiene un formulario independiente");
  await navegador.rellenar(campoOtraGaleria, "Sin guardar: " + titulo);
  await activarGaleria();
  await verificar(`document.querySelector(${JSON.stringify(campo('titulo'))}).value === ${JSON.stringify(titulo)} && document.querySelector(${JSON.stringify(campoOtraGaleria)}).value === ${JSON.stringify('Sin guardar: ' + titulo)}`, "cambiar de sección conserva los campos sin cruzarlos entre galerías");

  etapa = "creación del borrador";
  await navegador.rellenar(campo("descripcion"), "Imagen sintética creada por una comprobación automática.");
  await navegador.rellenar(campo("alternativo"), "Rectángulo naranja de prueba");
  await navegador.rellenar(campo("orden"), "23");
  await navegador.adjuntarArchivo(campo("imagen"), archivo);
  await navegador.esperarHasta(() => navegador.evaluar(`document.querySelector(${JSON.stringify(enGestion('.admin__vista-previa img'))})?.naturalWidth > 0`), "vista previa de la imagen");
  registroPosible = true;
  await navegador.pulsar(selectorGuardar);
  await navegador.esperarHasta(() => navegador.evaluar(`document.querySelector(${JSON.stringify(enGestion('.alert-success'))})?.textContent.includes(${JSON.stringify(titulo)})`), "guardado del borrador");
  await esperarFila(titulo);
  const creada = await buscarRegistro();
  assert.ok(creada && creada.estado === "borrador" && creada.orden === 23, "el guardado inicial crea un borrador con su orden");
  const privada = await fetch(origen + creada.imagen);
  assert.equal(privada.status, 404, "la imagen del borrador no se publica");
  await privada.arrayBuffer();
  comprobaciones += 2;
  await capturar("panel-borrador");

  etapa = "edición y publicación";
  await navegador.pulsar(enGestion(`button[aria-label=${JSON.stringify('Editar ' + titulo)}]`));
  await navegador.esperarHasta(() => navegador.evaluar(`document.querySelector(${JSON.stringify(campo('titulo'))}).value === ${JSON.stringify(titulo)}`), "carga de la obra en el editor");
  await navegador.rellenar(campo("titulo"), tituloEditado);
  await navegador.rellenar(campo("descripcion"), "Descripción editada desde el panel.");
  await navegador.rellenar(campo("orden"), "7");
  await navegador.rellenar(campo("estado"), "publicado");
  await navegador.pulsar(selectorGuardar);
  await navegador.esperarHasta(() => navegador.evaluar(`document.querySelector(${JSON.stringify(enGestion('.alert-success'))})?.textContent.includes(${JSON.stringify(tituloEditado)}) && document.querySelector(${JSON.stringify(enGestion('.alert-success'))}).textContent.includes('publicada')`), "edición y publicación");
  await esperarFila(tituloEditado);
  const publicada = await buscarRegistro();
  assert.ok(publicada.id === creada.id && publicada.estado === "publicado" && publicada.orden === 7 && publicada.descripcion === "Descripción editada desde el panel.");
  comprobaciones += 1;
  await capturar("panel-publicada");

  // La portada consulta cada colección por separado sin recompilar.
  etapa = "comprobación de la portada";
  await navegador.navegar(origen + "/" + selectorPublico, `!!document.querySelector(${JSON.stringify(selectorPublico)})`);
  const titulosPublicos = JSON.stringify(selectorPublico + " h3");
  const estadosPublicos = JSON.stringify(selectorPublico + " [role=status]");
  const selectorMas = selectorPublico + " ." + galeria.clase + "__more button:not([disabled])";
  for (let pagina = 0; pagina < 100; pagina += 1) {
    await navegador.esperarHasta(() => navegador.evaluar(`![...document.querySelectorAll(${estadosPublicos})].some(elemento => elemento.textContent.includes('Cargando'))`), "carga de la galería pública");
    if (await navegador.evaluar(`[...document.querySelectorAll(${titulosPublicos})].some(elemento => elemento.textContent === ${JSON.stringify(tituloEditado)})`)) break;
    if (!(await navegador.evaluar(`!!document.querySelector(${JSON.stringify(selectorMas)})`))) break;
    await navegador.pulsar(selectorMas);
  }
  await verificar(`[...document.querySelectorAll(${titulosPublicos})].some(elemento => elemento.textContent === ${JSON.stringify(tituloEditado)})`, "la obra publicada aparece en su sección del portfolio");
  const otraSeccion = JSON.stringify("#" + otraGaleria.seccion + " h3");
  await verificar(`![...document.querySelectorAll(${otraSeccion})].some(elemento => elemento.textContent === ${JSON.stringify(tituloEditado)})`, "la obra publicada no aparece en la otra galería");

  await navegador.navegar(origen + "/admin", "!!document.querySelector('#gestion-ilustraciones')");
  await activarGaleria();
  etapa = "borrado desde el panel";
  await esperarFila(tituloEditado);
  await navegador.enviar("Emulation.setDeviceMetricsOverride", { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
  await verificar("document.documentElement.scrollWidth <= innerWidth + 1", "el panel móvil no desborda la página");
  await capturar("panel-movil");
  await navegador.enviar("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

  const selectorEliminar = enGestion(`button[aria-label=${JSON.stringify('Eliminar ' + tituloEditado)}]`);
  const confirmacion = enGestion(".admin__confirmacion");
  await navegador.pulsar(selectorEliminar);
  await navegador.esperarHasta(() => navegador.evaluar(`!!document.querySelector(${JSON.stringify(confirmacion)})`), "confirmación de borrado");
  await navegador.pulsar(confirmacion + " .btn-outline-secondary");
  await verificar(`!document.querySelector(${JSON.stringify(confirmacion)}) && !!document.querySelector(${JSON.stringify(selectorEliminar)})`, "cancelar el borrado conserva la obra");
  await navegador.pulsar(selectorEliminar);
  await navegador.esperarHasta(() => navegador.evaluar(`!!document.querySelector(${JSON.stringify(confirmacion)})`), "segunda confirmación de borrado");
  await navegador.pulsar(confirmacion + " .btn-danger");
  await navegador.esperarHasta(() => navegador.evaluar(`document.querySelector(${JSON.stringify(enGestion('.alert-success'))})?.textContent.includes('Se ha eliminado')`), "eliminación desde el panel");
  assert.equal(await buscarRegistro(), null, "el borrado retira el registro de la API");
  const borrada = await fetch(origen + publicada.imagen);
  assert.equal(borrada.status, 404, "el borrado también retira la imagen");
  await borrada.arrayBuffer();
  registroPosible = false;
  comprobaciones += 1;

  etapa = "cierre de sesión";
  await navegador.pulsar(".admin__cabecera .btn-outline-light");
  await navegador.esperarHasta(() => navegador.evaluar("!!document.querySelector('#admin-usuario')"), "cierre de sesión");
  await verificar("!document.querySelector('#foto-titulo') && !document.querySelector('#ilustracion-titulo')", "cerrar sesión retira los dos editores");
  assert.deepEqual(navegador.errores, [], "sin excepciones JavaScript del panel");
  console.log(`Correcto: ${comprobaciones} comprobaciones de ${galeria.titulo} en Chrome real; acceso, galerías independientes, borrador, edición, orden, publicación, portada, móvil, confirmación, borrado y salida.`);
  if (carpetaCapturas) console.log(`Capturas: ${carpetaCapturas}`);
}

ejecutar().catch((error) => {
  console.error(`Fallo en ${etapa} (${galeria.titulo}): ${error.message}`);
  process.exitCode = 1;
}).finally(async () => {
  try { await limpiarRegistro(); }
  catch { console.error("No se pudo completar la limpieza automática. Revisa únicamente la obra con título " + titulo + " o su variante editada."); process.exitCode = 1; }
  await navegador?.cerrar();
  if (directorio && path.dirname(path.resolve(directorio)) === path.resolve(os.tmpdir()) && path.basename(directorio).startsWith("portfolio-admin-prueba-")) {
    await fs.rm(directorio, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
