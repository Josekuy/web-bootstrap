/*
 * Recorrido del panel en Chrome real: acceso, borrador, edición/publicación y borrado.
 * Requiere API y Vite iniciados. Ejecutar: node scripts/comprobar-admin.cjs [--capturas]
 * Lee ADMIN_USUARIO y ADMIN_CONTRASENA de .env sin mostrarlos.
 * Crea una imagen sintética con título único y elimina únicamente esa fotografía.
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
const titulo = "Prueba automática " + randomUUID();
const tituloEditado = titulo + " editada";
let navegador;
let directorio;
let carpetaCapturas;
let cookieSesion = "";
let fotografiaPosible = false;
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

/** Consulta paginada para localizar solo el título aleatorio generado por esta prueba. */
async function buscarRegistro() {
  let pagina = 1;
  let total;
  do {
    const respuesta = await solicitarApi(`/api/admin/fotografias?pagina=${pagina}&limite=50`);
    if (!respuesta.ok) throw new Error("No se pudo comprobar el registro de prueba en la API.");
    const contenido = await respuesta.json();
    const registro = contenido.datos.find((fotografia) => [titulo, tituloEditado].includes(fotografia.titulo));
    if (registro) return registro;
    total = contenido.meta.total;
    pagina += 1;
  } while ((pagina - 1) * 50 < total);
  return null;
}

/** El listado puede contener datos anteriores: se buscan las filas pasando sus páginas. */
async function esperarFila(nombre) {
  for (let pagina = 0; pagina < 100; pagina += 1) {
    await navegador.esperarHasta(() => navegador.evaluar("document.querySelector('.admin__tabla')?.getAttribute('aria-busy') === 'false'"), "fin de carga del listado");
    if (await navegador.evaluar(`[...document.querySelectorAll('.admin__listado tbody th')].some(celda => celda.textContent === ${JSON.stringify(nombre)})`)) return;
    if (await navegador.evaluar("document.querySelector('.admin__paginacion button:last-child').disabled")) break;
    const paginaAnterior = await navegador.evaluar("document.querySelector('.admin__paginacion span').textContent");
    await navegador.pulsar(".admin__paginacion button:last-child");
    await navegador.esperarHasta(() => navegador.evaluar(`document.querySelector('.admin__paginacion span').textContent !== ${JSON.stringify(paginaAnterior)}`), "cambio de página del listado");
  }
  throw new Error("La fotografía guardada no aparece en el listado del panel.");
}

async function capturar(nombre) {
  if (!carpetaCapturas) return;
  const captura = await navegador.enviar("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  await fs.writeFile(path.join(carpetaCapturas, nombre + ".png"), Buffer.from(captura.data, "base64"));
}

/** Si falla la interfaz, se limpia por API con la sesión de esta misma prueba. */
async function limpiarFotografia() {
  if (!fotografiaPosible || !cookieSesion) return;
  const respuestaSesion = await solicitarApi("/api/admin/sesion");
  const sesion = (await respuestaSesion.json()).datos;
  if (!sesion.autenticado) throw new Error("No se pudo recuperar la sesión para limpiar la fotografía temporal.");
  const registro = await buscarRegistro();
  if (registro) {
    const borrado = await solicitarApi(`/api/admin/fotografias/${registro.id}`, {
      method: "DELETE", headers: { "X-CSRF-Token": sesion.csrfToken },
    });
    if (!borrado.ok) throw new Error("No se pudo eliminar la fotografía temporal de la prueba.");
    await borrado.json();
  }
  fotografiaPosible = false;
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
  await verificar("!!document.querySelector('#admin-contrasena[type=password]') && !document.querySelector('#foto-titulo')", "el panel solicita acceso antes de mostrar la edición");
  await navegador.rellenar("#admin-usuario", usuario);
  await navegador.rellenar("#admin-contrasena", contrasena);
  etapa = "inicio de sesión";
  await navegador.pulsar(".admin__acceso button[type=submit]");
  await navegador.esperarHasta(() => navegador.evaluar("!!document.querySelector('#foto-titulo') && !document.querySelector('#admin-usuario')"), "acceso al panel");
  const cookies = await navegador.enviar("Network.getCookies", { urls: [origen] });
  cookieSesion = cookies.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  comprobaciones += 1;

  etapa = "creación del borrador";
  await navegador.rellenar("#foto-titulo", titulo);
  await navegador.rellenar("#foto-descripcion", "Imagen sintética creada por una comprobación automática.");
  await navegador.rellenar("#foto-alternativo", "Rectángulo naranja de prueba");
  await navegador.adjuntarArchivo("#foto-imagen", archivo);
  await navegador.esperarHasta(() => navegador.evaluar("document.querySelector('.admin__vista-previa img')?.naturalWidth > 0"), "vista previa de la imagen");
  fotografiaPosible = true;
  await navegador.pulsar('section[aria-labelledby="editor-fotografia-titulo"] button[type=submit]');
  await navegador.esperarHasta(() => navegador.evaluar(`document.querySelector('.alert-success')?.textContent.includes(${JSON.stringify(titulo)})`), "guardado del borrador");
  await esperarFila(titulo);
  const creada = await buscarRegistro();
  assert.ok(creada && creada.estado === "borrador", "el guardado inicial crea un borrador");
  const privada = await fetch(origen + creada.imagen);
  assert.equal(privada.status, 404, "la imagen del borrador no se publica");
  await privada.arrayBuffer();
  comprobaciones += 2;
  await capturar("panel-borrador");

  etapa = "edición y publicación";
  await navegador.pulsar(`button[aria-label=${JSON.stringify("Editar " + titulo)}]`);
  await navegador.esperarHasta(() => navegador.evaluar(`document.querySelector('#foto-titulo').value === ${JSON.stringify(titulo)}`), "carga de la fotografía en el editor");
  await navegador.rellenar("#foto-titulo", tituloEditado);
  await navegador.rellenar("#foto-descripcion", "Descripción editada desde el panel.");
  await navegador.rellenar("#foto-estado", "publicado");
  await navegador.pulsar('section[aria-labelledby="editor-fotografia-titulo"] button[type=submit]');
  await navegador.esperarHasta(() => navegador.evaluar(`document.querySelector('.alert-success')?.textContent.includes(${JSON.stringify(tituloEditado)}) && document.querySelector('.alert-success').textContent.includes('publicada')`), "edición y publicación");
  await esperarFila(tituloEditado);
  const publicada = await buscarRegistro();
  assert.ok(publicada.id === creada.id && publicada.estado === "publicado" && publicada.descripcion === "Descripción editada desde el panel.");
  comprobaciones += 1;
  await capturar("panel-publicada");

  // La portada vuelve a consultar la API: el contenido publicado aparece sin compilar.
  etapa = "comprobación de la portada";
  await navegador.navegar(origen + "/#fotografia", "!!document.querySelector('#fotografia')");
  for (let pagina = 0; pagina < 100; pagina += 1) {
    await navegador.esperarHasta(() => navegador.evaluar("![...document.querySelectorAll('#fotografia [role=status]')].some(elemento => elemento.textContent.includes('Cargando'))"), "carga de la galería pública");
    if (await navegador.evaluar(`[...document.querySelectorAll('#fotografia h3')].some(elemento => elemento.textContent === ${JSON.stringify(tituloEditado)})`)) break;
    const mas = await navegador.evaluar("!!document.querySelector('#fotografia button:not([disabled])')");
    if (!mas) break;
    await navegador.pulsar("#fotografia button:not([disabled])");
  }
  await verificar(`[...document.querySelectorAll('#fotografia h3')].some(elemento => elemento.textContent === ${JSON.stringify(tituloEditado)})`, "la fotografía publicada aparece en el portfolio");

  await navegador.navegar(origen + "/admin", "!!document.querySelector('#foto-titulo')");
  etapa = "borrado desde el panel";
  await esperarFila(tituloEditado);
  await navegador.enviar("Emulation.setDeviceMetricsOverride", { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
  await verificar("document.documentElement.scrollWidth <= innerWidth + 1", "el panel móvil no desborda la página");
  await capturar("panel-movil");
  await navegador.enviar("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

  await navegador.pulsar(`button[aria-label=${JSON.stringify("Eliminar " + tituloEditado)}]`);
  await navegador.esperarHasta(() => navegador.evaluar("!!document.querySelector('.admin__confirmacion')"), "confirmación de borrado");
  await navegador.pulsar(".admin__confirmacion .btn-outline-secondary");
  await verificar(`!document.querySelector('.admin__confirmacion') && !!document.querySelector('button[aria-label=${JSON.stringify("Eliminar " + tituloEditado)}]')`, "cancelar el borrado conserva la fotografía");
  await navegador.pulsar(`button[aria-label=${JSON.stringify("Eliminar " + tituloEditado)}]`);
  await navegador.esperarHasta(() => navegador.evaluar("!!document.querySelector('.admin__confirmacion')"), "segunda confirmación de borrado");
  await navegador.pulsar(".admin__confirmacion .btn-danger");
  await navegador.esperarHasta(() => navegador.evaluar("document.querySelector('.alert-success')?.textContent.includes('Se ha eliminado')"), "eliminación desde el panel");
  assert.equal(await buscarRegistro(), null, "el borrado retira el registro de la API");
  const borrada = await fetch(origen + publicada.imagen);
  assert.equal(borrada.status, 404, "el borrado también retira la imagen");
  await borrada.arrayBuffer();
  fotografiaPosible = false;
  comprobaciones += 1;

  etapa = "cierre de sesión";
  await navegador.pulsar(".admin__cabecera .btn-outline-light");
  await navegador.esperarHasta(() => navegador.evaluar("!!document.querySelector('#admin-usuario')"), "cierre de sesión");
  await verificar("!document.querySelector('#foto-titulo')", "cerrar sesión retira el editor");
  assert.deepEqual(navegador.errores, [], "sin excepciones JavaScript del panel");
  console.log(`Correcto: ${comprobaciones} comprobaciones del panel en Chrome real; acceso, borrador, edición, publicación, portada, móvil, confirmación, borrado y salida.`);
  if (carpetaCapturas) console.log(`Capturas: ${carpetaCapturas}`);
}

ejecutar().catch((error) => {
  console.error(`Fallo en ${etapa}: ${error.message}`);
  process.exitCode = 1;
}).finally(async () => {
  try { await limpiarFotografia(); }
  catch { console.error("No se pudo completar la limpieza automática. Revisa únicamente la fotografía con título " + titulo + " o su variante editada."); process.exitCode = 1; }
  await navegador?.cerrar();
  if (directorio && path.dirname(path.resolve(directorio)) === path.resolve(os.tmpdir()) && path.basename(directorio).startsWith("portfolio-admin-prueba-")) {
    await fs.rm(directorio, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
