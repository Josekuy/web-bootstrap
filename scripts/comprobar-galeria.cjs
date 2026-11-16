/*
 * Comprueba el book de Fotografía con imágenes sintéticas interceptadas solo en Chrome.
 * No escribe en la API ni en MySQL. Requiere Vite ya iniciado.
 * node scripts/comprobar-galeria.cjs [--capturas]
 * PORTFOLIO_URL y CHROME_PATH permiten ajustar el entorno.
 */
/* global document, window, getComputedStyle, innerWidth, innerHeight, scrollX, scrollY, requestAnimationFrame */
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");
const { abrirNavegador } = require("./soporte-cdp.cjs");

const origen = new URL(process.env.PORTFOLIO_URL || "http://127.0.0.1:5173/").origin;
const selectorEntrada = "#fotografia .photography__entry";
const selectorAbrir = "#fotografia .photography__open";
const selectorDialogo = "#fotografia dialog.photography__lightbox";
const selectorCerrar = '#fotografia button[aria-label="Cerrar fotografía"]';
const selectorSiguiente = '#fotografia button[aria-label="Fotografía siguiente"]';
const selectorAnterior = '#fotografia button[aria-label="Fotografía anterior"]';
const erroresIntercepcion = [];
let navegador;
let fotografias;
let escenario = { cantidad: 0, fallarPagina: null };
let desuscribir;
let capturas;
let comprobaciones = 0;
let etapa = "preparación";

/** Serializa funciones de comprobación; sus argumentos son los únicos datos que entran en la página. */
async function evaluar(funcion, ...argumentos) {
  return navegador.evaluar("(" + funcion.toString() + ")(" + argumentos.map((argumento) => JSON.stringify(argumento)).join(",") + ")");
}

async function esperarCondicion(funcion, descripcion, ...argumentos) {
  await navegador.esperarHasta(() => evaluar(funcion, ...argumentos), descripcion);
}

async function verificar(funcion, descripcion, ...argumentos) {
  assert.equal(await evaluar(funcion, ...argumentos), true, descripcion);
  comprobaciones += 1;
}

/** Las proporciones alternan horizontal, vertical y cuadrada. Los marcos permiten ver los bordes. */
async function crearFotografias() {
  const colores = [["#eadbc6", "#ef6b43", "#304b63"], ["#cadcdd", "#e9b44c", "#466958"], ["#e6d4df", "#ba5a70", "#354369"]];
  const formatos = [[1080, 680], [620, 880], [760, 760], [1080, 680], [760, 760], [620, 880]];
  return Promise.all(Array.from({ length: 14 }, async (_, indice) => {
    const [ancho, alto] = formatos[indice % formatos.length];
    const [fondo, acento, tinta] = colores[indice % colores.length];
    const numero = String(indice + 1).padStart(2, "0");
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + ancho + '" height="' + alto + '" viewBox="0 0 ' + ancho + " " + alto + '">'
      + '<rect width="' + ancho + '" height="' + alto + '" fill="' + fondo + '"/>'
      + '<circle cx="' + ancho * 0.73 + '" cy="' + alto * 0.29 + '" r="' + ancho * 0.15 + '" fill="' + acento + '"/>'
      + '<path d="M0 ' + alto * 0.78 + "L" + ancho * 0.31 + " " + alto * 0.33 + "L" + ancho * 0.71 + " " + alto * 0.87 + "L" + ancho + " " + alto * 0.53 + "V" + alto + 'H0Z" fill="' + tinta + '"/>'
      + '<path d="M0 ' + alto * 0.91 + "L" + ancho * 0.5 + " " + alto * 0.66 + "L" + ancho + " " + alto * 0.93 + "V" + alto + 'H0Z" fill="' + acento + '"/>'
      + '<rect x="5" y="5" width="' + (ancho - 10) + '" height="' + (alto - 10) + '" fill="none" stroke="' + tinta + '" stroke-width="10"/>'
      + '<text x="36" y="64" font-family="sans-serif" font-size="27" fill="' + tinta + '">BOOK / PRUEBA ' + numero + "</text></svg>";
    const imagen = await sharp(Buffer.from(svg)).png().toBuffer();
    return {
      id: 900001 + indice,
      titulo: "Encuadre " + numero,
      descripcion: indice === 3 ? "" : "Imagen sintética de comprobación: formato, composición y lectura del book.",
      imagen: "data:image/png;base64," + imagen.toString("base64"),
      imagenAlt: "Prueba " + numero + ": formas geométricas y un círculo sobre fondo de color",
      orden: indice, estado: "publicado", ancho, alto,
    };
  }));
}

async function atenderPeticion(peticion) {
  const url = new URL(peticion.request.url);
  const pagina = Number(url.searchParams.get("pagina") || 1);
  const limite = Number(url.searchParams.get("limite") || 12);
  const falla = escenario.fallarPagina === pagina;
  if (peticion.request.method !== "GET") erroresIntercepcion.push("La galería intentó una operación distinta de GET.");
  const respuesta = falla
    ? { error: { codigo: "PRUEBA_ERROR_TEMPORAL", mensaje: "Error temporal simulado por la comprobación." } }
    : { datos: fotografias.slice((pagina - 1) * limite, Math.min(pagina * limite, escenario.cantidad)), meta: { pagina, limite, total: escenario.cantidad } };
  try {
    await navegador.enviar("Fetch.fulfillRequest", {
      requestId: peticion.requestId, responseCode: falla ? 503 : 200,
      responseHeaders: [{ name: "Content-Type", value: "application/json; charset=utf-8" }, { name: "Cache-Control", value: "no-store" }],
      body: Buffer.from(JSON.stringify(respuesta)).toString("base64"),
    });
  } catch (error) {
    // StrictMode y las recargas pueden cancelar una solicitud que ya estaba interceptada.
    if (!/Invalid InterceptionId|Invalid RequestId|No resource|cerró la conexión/iu.test(error.message)) erroresIntercepcion.push(error.message);
  }
}

async function esperarCantidad(cantidad) {
  await esperarCondicion((selector, esperada) => document.querySelectorAll(selector).length === esperada,
    "book con " + cantidad + " fotografías", selectorEntrada, cantidad);
}

async function cargarEscenario(nombre, cantidad, fallarPagina = null) {
  etapa = nombre;
  escenario = { cantidad, fallarPagina };
  await evaluar(() => { window.__documentoAnteriorBook = true; });
  await navegador.enviar("Page.navigate", { url: origen + "/?prueba-book=" + encodeURIComponent(nombre) });
  await esperarCondicion(() => !window.__documentoAnteriorBook && !!document.querySelector("#fotografia"),
    "montaje de Fotografía");
  if (fallarPagina === 1) {
    await esperarCondicion(() => !!document.querySelector("#fotografia [role=alert]"), "error inicial de la API");
  } else if (cantidad === 0) {
    await esperarCondicion(() => document.querySelector("#fotografia").textContent.includes("Todavía no hay fotografías publicadas."),
      "estado vacío de Fotografía");
  } else {
    await esperarCantidad(Math.min(cantidad, 12));
  }
}

async function adaptarPantalla(ancho, alto = 1000) {
  await navegador.enviar("Emulation.setDeviceMetricsOverride", { width: ancho, height: alto, deviceScaleFactor: 1, mobile: ancho < 500 });
  await esperarCondicion((esperado) => innerWidth === esperado, "viewport de " + ancho + "px", ancho);
  await evaluar(() => new Promise((resolver) => requestAnimationFrame(() => requestAnimationFrame(resolver))));
}

/** Fuentes y desplazamiento estables antes de enviar un clic real de puntero. */
async function pulsar(selector) {
  await evaluar(async (control) => {
    await document.fonts.ready;
    document.querySelector(control).scrollIntoView({ block: "center", behavior: "instant" });
  }, selector);
  let anterior;
  await navegador.esperarHasta(async () => {
    const actual = await evaluar((control) => {
      const caja = document.querySelector(control).getBoundingClientRect();
      return JSON.stringify([caja.x, caja.y, caja.width, caja.height]);
    }, selector);
    const estable = actual === anterior;
    anterior = actual;
    return estable;
  }, "posición estable del control");
  await navegador.pulsar(selector);
}

async function pulsarTexto(texto) {
  await evaluar((contenido) => {
    document.querySelectorAll("[data-prueba-book]").forEach((elemento) => elemento.removeAttribute("data-prueba-book"));
    const boton = [...document.querySelectorAll("#fotografia button")].find((elemento) => elemento.textContent.includes(contenido));
    if (!boton) throw new Error("No se encuentra el control del book");
    boton.setAttribute("data-prueba-book", "activo");
  }, texto);
  await pulsar('[data-prueba-book="activo"]');
}

async function pulsarTecla(tecla, modificadores = 0) {
  const codigos = { Tab: 9, Escape: 27, ArrowLeft: 37, ArrowRight: 39 };
  const parametros = { key: tecla, code: tecla, windowsVirtualKeyCode: codigos[tecla], modifiers: modificadores };
  await navegador.enviar("Input.dispatchKeyEvent", { type: "keyDown", ...parametros });
  await navegador.enviar("Input.dispatchKeyEvent", { type: "keyUp", ...parametros });
}

async function esperarFotoAbierta(indice) {
  await esperarCondicion((dialogo, titulo) => {
    const elemento = document.querySelector(dialogo);
    return elemento.open && elemento.querySelector(".photography__lightbox-title")?.textContent === titulo;
  }, "fotografía ampliada " + (indice + 1), selectorDialogo, fotografias[indice].titulo);
}

async function abrirFotografia(indice) {
  const selector = selectorEntrada + ":nth-child(" + (indice + 1) + ") .photography__open";
  await evaluar((control) => { window.__aperturaFotografiaBook = document.querySelector(control); }, selector);
  await pulsar(selector);
  await esperarFotoAbierta(indice);
  await esperarCondicion((dialogo) => document.querySelector(dialogo).contains(document.activeElement),
    "foco dentro de la fotografía ampliada", selectorDialogo);
}

async function esperarCierre() {
  await esperarCondicion((dialogo) => !document.querySelector(dialogo).open
    && document.body.style.overflow !== "hidden"
    && document.activeElement === window.__aperturaFotografiaBook,
  "cierre y devolución del foco", selectorDialogo);
  comprobaciones += 1;
}

async function prepararImagenes() {
  await evaluar(async () => {
    const imagenes = [...document.querySelectorAll("#fotografia .photography__grid img")];
    imagenes.forEach((imagen) => { imagen.loading = "eager"; });
    await Promise.all(imagenes.map((imagen) => imagen.decode()));
    await document.fonts.ready;
    await new Promise((resolver) => requestAnimationFrame(() => requestAnimationFrame(resolver)));
  });
}

async function cambiarTema(oscuro) {
  if (await evaluar(() => document.documentElement.classList.contains("dark-mode")) !== oscuro) await pulsar(".theme-toggle");
  await esperarCondicion((tema) => document.documentElement.dataset.bsTheme === tema,
    "aplicación del tema", oscuro ? "dark" : "light");
}

async function capturar(nombre) {
  if (!capturas) return;
  await prepararImagenes();
  const clip = await evaluar(() => {
    const caja = document.querySelector("#fotografia").getBoundingClientRect();
    return { x: Math.max(0, caja.left + scrollX), y: Math.max(0, caja.top + scrollY), width: caja.width, height: caja.height, scale: 1 };
  });
  const captura = await navegador.enviar("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip });
  await fs.writeFile(path.join(capturas, nombre + ".png"), Buffer.from(captura.data, "base64"));
}

async function ejecutar() {
  fotografias = await crearFotografias();
  navegador = await abrirNavegador();
  if (process.argv.includes("--capturas")) {
    capturas = path.resolve(__dirname, "../.tmp/galerias");
    await fs.mkdir(capturas, { recursive: true });
  }
  desuscribir = navegador.escucharEvento("Fetch.requestPaused", atenderPeticion);
  await navegador.enviar("Fetch.enable", { patterns: [{ urlPattern: "*/api/fotografias*", requestStage: "Request" }] });
  await adaptarPantalla(1440);

  await cargarEscenario("sin fotografías", 0);
  await verificar(() => !document.querySelector("#fotografia .photography__grid")
    && !document.querySelector("#fotografia .photography__open")
    && !document.querySelector("#fotografia dialog").open,
  "el estado vacío no presenta imágenes ni un diálogo abierto");

  await cargarEscenario("error inicial y reintento", 1, 1);
  await verificar(() => !document.querySelector("#fotografia .photography__grid"), "un error inicial muestra el aviso sin una galería vacía engañosa");
  escenario.fallarPagina = null;
  await pulsarTexto("Reintentar");
  await esperarCantidad(1);
  await verificar(() => !document.querySelector("#fotografia [role=alert]"), "reintentar recupera la fotografía tras un error inicial");

  await cargarEscenario("una fotografía", 1);
  await prepararImagenes();
  await verificar(() => {
    const imagen = document.querySelector("#fotografia .photography__image");
    return imagen.alt.length > 0 && getComputedStyle(imagen).objectFit === "contain";
  }, "una fotografía conserva su texto alternativo y encuadre");
  await abrirFotografia(0);
  await verificar((anterior, siguiente, cerrar) => !document.querySelector(anterior) && !document.querySelector(siguiente)
    && document.activeElement === document.querySelector(cerrar) && document.body.style.overflow === "hidden",
  "una sola fotografía abre el diálogo y enfoca el cierre sin navegación inútil", selectorAnterior, selectorSiguiente, selectorCerrar);
  for (let paso = 0; paso < 5; paso++) {
    await pulsarTecla("Tab", paso % 2 === 0 ? 0 : 8);
    await verificar((dialogo) => document.querySelector(dialogo).contains(document.activeElement),
      "Tab y Mayús+Tab permanecen dentro del diálogo", selectorDialogo);
  }
  await pulsarTecla("Escape");
  await esperarCierre();

  await cargarEscenario("paginación con error", 14, 2);
  await prepararImagenes();
  await verificar((esperadas) => JSON.stringify([...document.querySelectorAll("#fotografia .photography__grid img")].map((imagen) => imagen.alt)) === JSON.stringify(esperadas),
    "el orden DOM y los textos alternativos coinciden con el orden editorial", fotografias.slice(0, 12).map((foto) => foto.imagenAlt));
  await evaluar(() => { window.__primerasEntradasBook = [...document.querySelectorAll("#fotografia .photography__entry")]; });
  await pulsarTexto("Cargar más fotografías");
  await esperarCondicion(() => !!document.querySelector("#fotografia [role=alert]"), "error de la segunda página");
  await verificar(() => document.querySelectorAll("#fotografia .photography__entry").length === 12
    && window.__primerasEntradasBook.every((elemento, indice) => elemento === document.querySelectorAll("#fotografia .photography__entry")[indice]),
  "un fallo al cargar más conserva las doce fotografías y sus elementos DOM");
  escenario.fallarPagina = null;
  await pulsarTexto("Reintentar");
  await esperarCantidad(14);
  await prepararImagenes();
  await verificar(() => {
    const alternativas = [...document.querySelectorAll("#fotografia .photography__grid img")].map((imagen) => imagen.alt);
    return new Set(alternativas).size === 14 && !document.querySelector("#fotografia [role=alert]")
      && ![...document.querySelectorAll("#fotografia button")].some((boton) => boton.textContent.includes("Cargar más fotografías"))
      && window.__primerasEntradasBook.every((elemento, indice) => elemento === document.querySelectorAll("#fotografia .photography__entry")[indice]);
  }, "el reintento añade la segunda página sin duplicar ni reemplazar las imágenes anteriores");
  await verificar((esperadas) => JSON.stringify([...document.querySelectorAll("#fotografia .photography__title")].map((titulo) => titulo.textContent)) === JSON.stringify(esperadas),
    "las catorce fotografías conservan el orden del panel", fotografias.map((foto) => foto.titulo));

  etapa = "proporciones y diseño adaptable";
  for (const ancho of [320, 375, 768, 1440]) {
    await adaptarPantalla(ancho);
    await prepararImagenes();
    await verificar(() => document.documentElement.scrollWidth <= innerWidth + 1
      && [...document.querySelectorAll("#fotografia .photography__entry")].every((entrada) => {
        const caja = entrada.getBoundingClientRect();
        return caja.width > 0 && caja.left >= -1 && caja.right <= innerWidth + 1;
      }), "el book no desborda a " + ancho + "px");
    await verificar(() => [...document.querySelectorAll("#fotografia .photography__grid img")].every((imagen) => {
      const caja = imagen.getBoundingClientRect();
      return imagen.complete && imagen.naturalWidth > 0 && getComputedStyle(imagen).objectFit === "contain"
        && Math.abs(caja.width / caja.height - imagen.naturalWidth / imagen.naturalHeight) < 0.015;
    }), "los encuadres horizontales, verticales y cuadrados no se recortan a " + ancho + "px");
    const columnas = ancho < 768 ? 1 : ancho < 992 ? 2 : 12;
    await verificar((esperadas) => getComputedStyle(document.querySelector("#fotografia .photography__grid")).gridTemplateColumns.split(/\s+/u).length === esperadas,
      "la composición utiliza " + columnas + " columnas a " + ancho + "px", columnas);
  }
  await verificar(() => {
    const entradas = [...document.querySelectorAll("#fotografia .photography__entry")];
    const primera = entradas[0].getBoundingClientRect();
    const segunda = entradas[1].getBoundingClientRect();
    return primera.width > segunda.width * 1.3 && segunda.top > primera.top + 30;
  }, "el escritorio combina anchuras distintas y desplazamientos de un book irregular");

  etapa = "diálogo y navegación";
  await abrirFotografia(2);
  await verificar((imagen, alt) => {
    const dialogo = document.querySelector("#fotografia dialog");
    const ampliada = dialogo.querySelector(".photography__lightbox-image");
    return dialogo.hasAttribute("aria-labelledby") && ampliada.src === imagen && ampliada.alt === alt
      && getComputedStyle(ampliada).objectFit === "contain";
  }, "la ampliación muestra la fotografía correcta con nombre accesible y encuadre completo", fotografias[2].imagen, fotografias[2].imagenAlt);
  await pulsarTecla("ArrowRight");
  await esperarFotoAbierta(3);
  comprobaciones += 1;
  await pulsarTecla("ArrowLeft");
  await esperarFotoAbierta(2);
  comprobaciones += 1;
  await pulsar(selectorSiguiente);
  await esperarFotoAbierta(3);
  await pulsar(selectorAnterior);
  await esperarFotoAbierta(2);
  comprobaciones += 1;
  for (let paso = 0; paso < 8; paso++) {
    await pulsarTecla("Tab", paso < 4 ? 0 : 8);
    await verificar((dialogo) => document.querySelector(dialogo).contains(document.activeElement),
      "el foco permanece dentro al recorrer todos los controles de la ampliación", selectorDialogo);
  }
  await pulsarTecla("Escape");
  await esperarCierre();

  await abrirFotografia(0);
  await verificar((anterior) => document.querySelector(anterior).disabled, "la primera fotografía deshabilita la navegación anterior", selectorAnterior);
  await pulsarTecla("ArrowLeft");
  await esperarFotoAbierta(0);
  comprobaciones += 1;
  await pulsar(selectorCerrar);
  await esperarCierre();
  await abrirFotografia(13);
  await verificar((siguiente) => document.querySelector(siguiente).disabled, "la última fotografía deshabilita la navegación siguiente", selectorSiguiente);
  await pulsarTecla("ArrowRight");
  await esperarFotoAbierta(13);
  await navegador.enviar("Input.dispatchMouseEvent", { type: "mousePressed", x: 1, y: 1, button: "left", clickCount: 1 });
  await navegador.enviar("Input.dispatchMouseEvent", { type: "mouseReleased", x: 1, y: 1, button: "left", clickCount: 1 });
  await esperarCierre();

  etapa = "temas y movimiento reducido";
  for (const oscuro of [false, true]) {
    await cambiarTema(oscuro);
    await pulsarTecla("Tab");
    await evaluar((control) => document.querySelector(control).focus({ preventScroll: true }), selectorAbrir);
    await verificar((control) => {
      const estilo = getComputedStyle(document.querySelector(control));
      const seccion = getComputedStyle(document.querySelector("#fotografia"));
      return estilo.outlineStyle !== "none" && parseFloat(estilo.outlineWidth) > 0
        && seccion.color !== seccion.backgroundColor;
    }, "el book mantiene foco visible y contraste de superficies en tema " + (oscuro ? "oscuro" : "claro"), selectorAbrir);
    await capturar(oscuro ? "fotografia-oscura" : "fotografia-clara");
  }
  await abrirFotografia(0);
  await navegador.enviar("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await verificar(() => parseFloat(getComputedStyle(document.querySelector("#fotografia .photography__zoom")).transitionDuration) === 0,
    "movimiento reducido elimina las transiciones decorativas");
  await esperarFotoAbierta(0);
  await pulsarTecla("ArrowRight");
  await esperarFotoAbierta(1);
  comprobaciones += 1;
  await pulsarTecla("Escape");
  await esperarCierre();
  await navegador.enviar("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });

  etapa = "ampliación móvil";
  await adaptarPantalla(375, 620);
  await abrirFotografia(1);
  await verificar(() => {
    const dialogo = document.querySelector("#fotografia dialog").getBoundingClientRect();
    const cerrar = document.querySelector('#fotografia button[aria-label="Cerrar fotografía"]').getBoundingClientRect();
    const imagen = document.querySelector("#fotografia .photography__lightbox-image").getBoundingClientRect();
    return dialogo.top >= 0 && dialogo.bottom <= innerHeight + 1 && dialogo.left >= 0 && dialogo.right <= innerWidth + 1
      && cerrar.top >= 0 && cerrar.bottom <= innerHeight && imagen.height > 0;
  }, "la fotografía vertical ampliada y el cierre caben en una pantalla móvil");
  await pulsarTecla("Escape");
  await esperarCierre();
  await capturar("fotografia-movil");

  assert.deepEqual(erroresIntercepcion, [], "las respuestas sintéticas se interceptan correctamente");
  assert.deepEqual(navegador.errores, [], "el book no genera excepciones JavaScript");
  console.log("Correcto: " + comprobaciones + " comprobaciones del book; vacío, errores y reintento, paginación, grid irregular, encuadres completos, diálogo, foco, teclado, temas y móvil. Sin cambios en la base de datos.");
  if (capturas) console.log("Capturas: " + capturas);
}

ejecutar().catch(async (error) => {
  console.error("Fallo en " + etapa + ": " + error.message);
  if (capturas && navegador) await capturar("fotografia-fallo").catch(() => {});
  process.exitCode = 1;
}).finally(async () => {
  desuscribir?.();
  await navegador?.cerrar();
});
