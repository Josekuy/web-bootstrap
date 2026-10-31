/*
 * Prueba proyectos desde el panel hasta su tarjeta y modal públicos.
 * Ejecutar con API/Vite activos: node scripts/comprobar-proyectos.cjs [--capturas]
 * Lee ADMIN_* de .env sin imprimirlos. PORTFOLIO_URL y CHROME_PATH son opcionales.
 * Solo crea y borra el proyecto identificado por el UUID de esta ejecución.
 */
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const sharp = require("sharp");
require("dotenv").config({ path: path.resolve(__dirname, "../.env"), quiet: true });
const { abrirNavegador } = require("./soporte-cdp.cjs");

const origen = new URL(process.env.PORTFOLIO_URL || "http://127.0.0.1:5173/").origin;
const slug = "prueba-automatica-" + randomUUID();
const titulo = "Prueba automática de proyecto " + randomUUID();
const editado = titulo + " editado";
let navegador;
let directorio;
let capturas;
let cookie = "";
let proyectoPosible = false;
let etapa = "preparación";
let comprobaciones = 0;

async function api(ruta, opciones = {}) {
  return fetch(origen + ruta, {
    ...opciones, signal: AbortSignal.timeout(15000), headers: { Cookie: cookie, Origin: origen, ...opciones.headers },
  });
}

async function coleccion(ruta) {
  const datos = [];
  let pagina = 1;
  let total;
  do {
    const respuesta = await api(`${ruta}?pagina=${pagina}&limite=50`);
    assert.equal(respuesta.status, 200, "el listado de la API está disponible");
    const contenido = await respuesta.json();
    datos.push(...contenido.datos);
    total = contenido.meta.total;
    pagina += 1;
  } while (datos.length < total);
  return datos;
}

async function verificar(expresion, descripcion) {
  assert.equal(await navegador.evaluar(expresion), true, descripcion);
  comprobaciones += 1;
}

// Espera el cambio de fuente y un rectángulo estable antes de pulsar un control real.
async function pulsar(selector) {
  await navegador.evaluar("document.fonts.ready.then(() => true)");
  await navegador.evaluar(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({ block: 'center', behavior: 'instant' })`);
  let anterior;
  await navegador.esperarHasta(async () => {
    const actual = await navegador.evaluar(`(() => { const limite = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return JSON.stringify([limite.x, limite.y, limite.width, limite.height]); })()`);
    const estable = actual === anterior;
    anterior = actual;
    return estable;
  }, "posición estable del control");
  await navegador.pulsar(selector);
}

// Se espera el contenido React necesario, sin depender de recursos externos de otras secciones.
async function navegar(ruta, condicion) {
  await navegador.evaluar("window.__documentoAnterior = true");
  await navegador.enviar("Page.navigate", { url: origen + ruta });
  await navegador.esperarHasta(() => navegador.evaluar(`!window.__documentoAnterior && (${condicion})`), "carga del contenido");
}

async function abrirGestion() {
  await pulsar('[data-seccion="proyectos"]');
  await navegador.esperarHasta(() => navegador.evaluar("!document.querySelector('#gestion-proyectos').hidden && !document.querySelector('#gestion-proyectos .admin__tabla').getAttribute('aria-busy').includes('true')"), "gestión de proyectos");
}

async function esperarFila(nombre) {
  for (let pagina = 0; pagina < 100; pagina += 1) {
    await navegador.esperarHasta(() => navegador.evaluar("document.querySelector('#gestion-proyectos .admin__tabla')?.getAttribute('aria-busy') === 'false'"), "listado de proyectos");
    if (await navegador.evaluar(`[...document.querySelectorAll('#gestion-proyectos tbody th')].some(elemento => elemento.textContent === ${JSON.stringify(nombre)})`)) return;
    if (await navegador.evaluar("document.querySelector('#gestion-proyectos .admin__paginacion button:last-child').disabled")) break;
    const anterior = await navegador.evaluar("document.querySelector('#gestion-proyectos .admin__paginacion span').textContent");
    await pulsar("#gestion-proyectos .admin__paginacion button:last-child");
    await navegador.esperarHasta(() => navegador.evaluar(`document.querySelector('#gestion-proyectos .admin__paginacion span').textContent !== ${JSON.stringify(anterior)}`), "siguiente página");
  }
  throw new Error("El proyecto de prueba no aparece en el panel.");
}

async function guardar(nombre) {
  await pulsar('#gestion-proyectos section[aria-labelledby="editor-proyecto-titulo"] button[type=submit]');
  await navegador.esperarHasta(() => navegador.evaluar(`document.querySelector('#gestion-proyectos .alert-success')?.textContent.includes(${JSON.stringify(nombre)})`), "guardado del proyecto");
  await esperarFila(nombre);
}

async function capturar(nombre) {
  if (!capturas) return;
  const imagen = await navegador.enviar("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await fs.writeFile(path.join(capturas, nombre + ".png"), Buffer.from(imagen.data, "base64"));
}

async function limpiarProyecto() {
  if (!proyectoPosible || !cookie) return;
  const sesion = (await (await api("/api/admin/sesion")).json()).datos;
  if (!sesion.autenticado) throw new Error("No está disponible la sesión de limpieza.");
  const propio = (await coleccion("/api/admin/proyectos")).find((elemento) => elemento.slug === slug);
  if (propio) {
    const respuesta = await api(`/api/admin/proyectos/${propio.id}`, { method: "DELETE", headers: { "X-CSRF-Token": sesion.csrfToken } });
    assert.equal(respuesta.status, 200);
    await respuesta.json();
  }
  proyectoPosible = false;
}

async function ejecutar() {
  const contrasena = process.env.ADMIN_CONTRASENA;
  if (!contrasena) throw new Error("Configura ADMIN_CONTRASENA en .env.");
  const anteriores = (await coleccion("/api/proyectos")).map(({ id, slug: identificador, titulo: nombre }) => ({ id, slug: identificador, titulo: nombre }));
  directorio = await fs.mkdtemp(path.join(os.tmpdir(), "portfolio-proyectos-ui-"));
  const archivo = path.join(directorio, "imagen-sintetica.png");
  await sharp({ create: { width: 240, height: 140, channels: 3, background: "#ff5b35" } }).png().toFile(archivo);
  if (process.argv.includes("--capturas")) capturas = await fs.mkdtemp(path.join(os.tmpdir(), "portfolio-proyectos-capturas-"));
  navegador = await abrirNavegador();
  await navegador.enviar("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  etapa = "acceso";
  await navegar("/admin", "!!document.querySelector('#admin-usuario')");
  await navegador.rellenar("#admin-usuario", process.env.ADMIN_USUARIO || "admin");
  await navegador.rellenar("#admin-contrasena", contrasena);
  await pulsar(".admin__acceso button[type=submit]");
  await navegador.esperarHasta(() => navegador.evaluar("!!document.querySelector('[data-seccion=proyectos]')"), "inicio de sesión");
  const cookies = await navegador.enviar("Network.getCookies", { urls: [origen] });
  cookie = cookies.cookies.map((elemento) => `${elemento.name}=${elemento.value}`).join("; ");
  await abrirGestion();
  await verificar("document.querySelector('[data-seccion=proyectos]').getAttribute('aria-pressed') === 'true'", "la navegación activa la gestión de proyectos");

  etapa = "creación del borrador";
  for (const [selector, valor] of Object.entries({
    "#proyecto-titulo": titulo, "#proyecto-slug": slug, "#proyecto-descripcion": "Proyecto sintético del recorrido automático.",
    "#proyecto-categoria": "Prueba de interfaz", "#proyecto-tecnologias": "React, Bootstrap", "#proyecto-imagen-alt": "Rectángulo naranja de prueba",
  })) await navegador.rellenar(selector, valor);
  await navegador.adjuntarArchivo("#proyecto-imagen", archivo);
  proyectoPosible = true;
  await guardar(titulo);
  const creado = (await coleccion("/api/admin/proyectos")).find((elemento) => elemento.slug === slug);
  assert.ok(creado?.estado === "borrador");
  assert.equal((await coleccion("/api/proyectos")).some((elemento) => elemento.id === creado.id), false);
  const imagenPrivada = await fetch(origen + creado.imagen);
  assert.equal(imagenPrivada.status, 404);
  await imagenPrivada.arrayBuffer();
  comprobaciones += 2;

  etapa = "edición y publicación";
  await pulsar(`#gestion-proyectos button[aria-label=${JSON.stringify("Editar " + titulo)}]`);
  await navegador.esperarHasta(() => navegador.evaluar(`document.querySelector('#proyecto-titulo').value === ${JSON.stringify(titulo)}`), "editor del proyecto");
  for (const [selector, valor] of Object.entries({
    "#proyecto-titulo": editado, "#proyecto-descripcion": "Descripción editada para comprobar la tarjeta y su modal.",
    "#proyecto-tecnologias": "React, JavaScript", "#proyecto-orden": "0", "#proyecto-estado": "publicado",
    "#proyecto-url": "https://example.com/prueba-portfolio", "#proyecto-repositorio": "https://example.com/codigo-portfolio",
  })) await navegador.rellenar(selector, valor);
  await guardar(editado);
  const publicado = (await coleccion("/api/proyectos")).find((elemento) => elemento.id === creado.id);
  assert.ok(publicado.titulo === editado && publicado.orden === 0);
  assert.deepEqual(publicado.tecnologias, ["React", "JavaScript"]);
  comprobaciones += 1;
  await capturar("panel-proyectos");

  etapa = "tarjeta y modal públicos";
  await navegar("/", `!!document.querySelector('button.project-card__button[aria-label=${JSON.stringify("Ver proyecto: " + editado)}]')`);
  await pulsar(`button.project-card__button[aria-label=${JSON.stringify("Ver proyecto: " + editado)}]`);
  await navegador.esperarHasta(() => navegador.evaluar("!!document.querySelector('.project-detail.show')"), "modal del proyecto publicado");
  await verificar(`document.querySelector('.project-detail.show .project-detail__title').textContent === ${JSON.stringify(editado)} && document.querySelector('.project-detail.show .project-detail__description').textContent.includes('Descripción editada') && [...document.querySelectorAll('.project-detail.show .project-detail__technologies li')].some(elemento => elemento.textContent === 'JavaScript') && !!document.querySelector('.project-detail.show a[href="https://example.com/prueba-portfolio"]')`, "la tarjeta abre una ficha con los metadatos y enlaces guardados");
  await capturar("modal-proyecto");
  await pulsar(".project-detail.show .btn-close");
  await navegador.esperarHasta(() => navegador.evaluar("!document.querySelector('.modal-backdrop') && !document.body.classList.contains('modal-open')"), "cierre del modal");

  etapa = "retirada y borrado";
  await navegar("/admin", "!!document.querySelector('[data-seccion=proyectos]')");
  await abrirGestion();
  await esperarFila(editado);
  await navegador.enviar("Emulation.setDeviceMetricsOverride", { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
  await verificar("document.documentElement.scrollWidth <= innerWidth + 1", "la gestión de proyectos cabe en móvil");
  await capturar("proyectos-movil");
  await navegador.enviar("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await pulsar(`#gestion-proyectos button[aria-label=${JSON.stringify("Editar " + editado)}]`);
  await navegador.esperarHasta(() => navegador.evaluar(`document.querySelector('#proyecto-titulo').value === ${JSON.stringify(editado)}`), "editor para retirar la publicación");
  await navegador.rellenar("#proyecto-estado", "borrador");
  await guardar(editado);
  assert.equal((await coleccion("/api/proyectos")).some((elemento) => elemento.id === creado.id), false);
  comprobaciones += 1;
  await pulsar(`#gestion-proyectos button[aria-label=${JSON.stringify("Eliminar " + editado)}]`);
  await navegador.esperarHasta(() => navegador.evaluar("!!document.querySelector('#gestion-proyectos .admin__confirmacion')"), "confirmación del borrado");
  await pulsar("#gestion-proyectos .admin__confirmacion .btn-danger");
  await navegador.esperarHasta(() => navegador.evaluar("document.querySelector('#gestion-proyectos .alert-success')?.textContent.includes('Se ha eliminado')"), "borrado del proyecto");
  assert.equal((await coleccion("/api/admin/proyectos")).some((elemento) => elemento.slug === slug), false);
  const imagenBorrada = await fetch(origen + publicado.imagen);
  assert.equal(imagenBorrada.status, 404);
  await imagenBorrada.arrayBuffer();
  proyectoPosible = false;
  const posteriores = (await coleccion("/api/proyectos")).map(({ id, slug: identificador, titulo: nombre }) => ({ id, slug: identificador, titulo: nombre }));
  assert.deepEqual(posteriores, anteriores, "se conservan todos los proyectos públicos anteriores");
  comprobaciones += 2;
  await pulsar('[data-seccion="fotografias"]');
  await verificar("document.querySelector('[data-seccion=fotografias]').getAttribute('aria-pressed') === 'true' && !document.querySelector('#gestion-fotografias').hidden", "fotografía sigue accesible desde el panel");
  await pulsar(".admin__cabecera .btn-outline-light");
  await navegador.esperarHasta(() => navegador.evaluar("!!document.querySelector('#admin-usuario')"), "cierre de sesión");
  assert.deepEqual(navegador.errores, [], "sin excepciones JavaScript");
  console.log(`Correcto: ${comprobaciones} comprobaciones de proyectos; borrador, edición, publicación, modal, retirada, móvil y borrado conservando los registros anteriores.`);
  if (capturas) console.log(`Capturas: ${capturas}`);
}

ejecutar().catch(async (error) => {
  console.error(`Fallo en ${etapa}: ${error.message}`);
  if (navegador && capturas && await navegador.evaluar("!document.querySelector('#admin-contrasena')").catch(() => false)) {
    await capturar("fallo").catch(() => {});
    console.error(`Captura del fallo: ${capturas}`);
  }
  process.exitCode = 1;
}).finally(async () => {
  try { await limpiarProyecto(); }
  catch { console.error("Revisa la limpieza únicamente del proyecto temporal con slug " + slug); process.exitCode = 1; }
  await navegador?.cerrar();
  if (directorio && path.dirname(path.resolve(directorio)) === path.resolve(os.tmpdir()) && path.basename(directorio).startsWith("portfolio-proyectos-ui-")) {
    await fs.rm(directorio, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
