/*
 * Comprueba Swiper con fotografías sintéticas interceptadas únicamente en Chrome.
 * No escribe en la API ni en la base de datos. Requiere la web iniciada.
 * Ejecutar: node scripts/comprobar-galeria.cjs [--capturas]
 * Opcionales: PORTFOLIO_URL y CHROME_PATH.
 */
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const sharp = require("sharp");
const { abrirNavegador } = require("./soporte-cdp.cjs");

const origen = new URL(process.env.PORTFOLIO_URL || "http://localhost:5173/").origin;
const selectorSlider = "#fotografia .photography__slider";
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

/** Son ilustraciones de prueba: alternamos proporciones para detectar recortes. */
async function crearFotografias() {
  const colores = [["#eadbc6", "#ef6b43", "#304b63"], ["#cadcdd", "#f3b850", "#466958"], ["#e6d4df", "#ba5a70", "#354369"]];
  return Promise.all(Array.from({ length: 14 }, async (_, indice) => {
    const vertical = indice % 3 === 1;
    const ancho = vertical ? 620 : 1080;
    const alto = vertical ? 880 : 680;
    const [fondo, acento, montaña] = colores[indice % colores.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 1080 880"><rect width="1080" height="880" fill="${fondo}"/><circle cx="800" cy="235" r="125" fill="${acento}"/><path d="M0 650L285 290L650 760L1080 420V880H0Z" fill="${montaña}"/><path d="M0 800L500 530L1080 810V880H0Z" fill="${acento}"/><text x="48" y="80" font-family="sans-serif" font-size="32" fill="${montaña}">PRUEBA DE GALERÍA ${String(indice + 1).padStart(2, "0")}</text></svg>`;
    const imagen = await sharp(Buffer.from(svg)).png().toBuffer();
    return {
      id: 900001 + indice, titulo: `Prueba ${String(indice + 1).padStart(2, "0")} · Horizonte`,
      descripcion: indice === 3 ? "" : "Ilustración sintética para comprobar proporciones, navegación y pies de fotografía.",
      imagen: "data:image/png;base64," + imagen.toString("base64"),
      imagenAlt: `Ilustración de prueba ${indice + 1}: montañas geométricas y un círculo sobre fondo de color`,
      orden: indice, estado: "publicado", ancho, alto,
    };
  }));
}

/** Sustituye solo GET /api/fotografias; el resto de la web sigue usando sus recursos reales. */
async function atenderPeticion(peticion) {
  const url = new URL(peticion.request.url);
  const pagina = Number(url.searchParams.get("pagina") || 1);
  const limite = Number(url.searchParams.get("limite") || 12);
  const falla = escenario.fallarPagina === pagina;
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
    // StrictMode y las recargas pueden cancelar una petición ya interceptada.
    if (!/Invalid InterceptionId|Invalid RequestId|No resource|cerró la conexión/iu.test(error.message)) erroresIntercepcion.push(error.message);
  }
}

async function verificar(expresion, descripcion) {
  assert.equal(await navegador.evaluar(expresion), true, descripcion);
  comprobaciones += 1;
}

async function cargarEscenario(nombre, cantidad, fallarPagina = null) {
  etapa = nombre;
  escenario = { cantidad, fallarPagina };
  await navegador.evaluar("window.__documentoAnterior = true");
  await navegador.enviar("Page.navigate", { url: origen + "/?prueba-galeria=" + encodeURIComponent(nombre) });
  await navegador.esperarHasta(() => navegador.evaluar("!window.__documentoAnterior && !!document.querySelector('#fotografia')"), "montaje de Fotografía");
  if (fallarPagina === 1) {
    await navegador.esperarHasta(() => navegador.evaluar("!!document.querySelector('#fotografia [role=alert]')"), "error inicial de la API");
  } else if (cantidad === 0) {
    await navegador.esperarHasta(() => navegador.evaluar("document.querySelector('#fotografia').textContent.includes('Todavía no hay fotografías publicadas')"), "estado vacío de la galería");
  } else await esperarCantidad(Math.min(cantidad, 12));
}

async function esperarCantidad(cantidad) {
  await navegador.esperarHasta(() => navegador.evaluar(`(() => { const swiper = document.querySelector(${JSON.stringify(selectorSlider)})?.swiper; return swiper && !swiper.destroyed && swiper.slides.length === ${cantidad} && !swiper.animating; })()`), `galería con ${cantidad} fotografías`);
}

/** El viewport cambia antes que ResizeObserver: esperamos la medida actual de Swiper. */
async function adaptarPantalla(ancho) {
  await navegador.enviar("Emulation.setDeviceMetricsOverride", { width: ancho, height: 1000, deviceScaleFactor: 1, mobile: ancho < 500 });
  await navegador.esperarHasta(() => navegador.evaluar(`(() => {
    const elemento = document.querySelector(${JSON.stringify(selectorSlider)});
    const swiper = elemento.swiper;
    const visibles = swiper.params.slidesPerView;
    const anchoEsperado = (swiper.width - (visibles - 1) * swiper.params.spaceBetween) / visibles;
    return innerWidth === ${ancho} && swiper.width > 0 && !swiper.animating
      && Math.abs(swiper.width - elemento.clientWidth) < 1
      && Math.abs(swiper.slides[0].getBoundingClientRect().width - anchoEsperado) < 1;
  })()`), `adaptación de la galería a ${ancho}px`);
}

async function indiceActual() {
  return navegador.evaluar(`document.querySelector(${JSON.stringify(selectorSlider)}).swiper.activeIndex`);
}

/** El clic se calcula después de estabilizar fuentes y posición del control. */
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

async function pulsarTexto(texto) {
  await navegador.evaluar(`(() => {
    document.querySelectorAll('[data-prueba-galeria]').forEach(elemento => elemento.removeAttribute('data-prueba-galeria'));
    const boton = [...document.querySelectorAll('#fotografia button')].find(elemento => elemento.textContent.includes(${JSON.stringify(texto)}));
    if (!boton) throw new Error('No se encuentra el control de la galería');
    boton.setAttribute('data-prueba-galeria', 'activo');
  })()`);
  await pulsar('[data-prueba-galeria="activo"]');
}

async function pulsarFlecha(tecla) {
  const parametros = { key: tecla, code: tecla, windowsVirtualKeyCode: tecla === "ArrowRight" ? 39 : 37 };
  await navegador.enviar("Input.dispatchKeyEvent", { type: "keyDown", ...parametros });
  await navegador.enviar("Input.dispatchKeyEvent", { type: "keyUp", ...parametros });
}

async function esperarIndice(indice, mayor = true) {
  await navegador.esperarHasta(() => navegador.evaluar(`(() => { const swiper = document.querySelector(${JSON.stringify(selectorSlider)}).swiper; return swiper.activeIndex ${mayor ? ">" : "<"} ${indice} && !swiper.animating; })()`), "navegación entre fotografías");
}

/** Las imágenes lazy deben entrar en pantalla antes de comprobar su carga y capturar. */
async function prepararVista() {
  await navegador.evaluar(`document.querySelector(${JSON.stringify(selectorSlider)}).scrollIntoView({ block: 'center', behavior: 'instant' })`);
  await navegador.esperarHasta(() => navegador.evaluar(`(() => {
    const visibles = [...document.querySelectorAll('#fotografia img')].filter(imagen => {
      const caja = imagen.getBoundingClientRect();
      return caja.right > 0 && caja.left < innerWidth && caja.bottom > 0 && caja.top < innerHeight;
    });
    return visibles.length > 0 && visibles.every(imagen => imagen.complete && imagen.naturalWidth > 0);
  })()`), "carga de las fotografías visibles");
  await navegador.evaluar(`(async () => {
    const seccion = document.querySelector('#fotografia');
    await document.fonts.ready;
    await Promise.all(seccion.getAnimations({ subtree: true })
      .filter(animacion => animacion.effect.getComputedTiming().iterations !== Infinity)
      .map(animacion => animacion.finished.catch(() => {})));
    await new Promise(resolver => requestAnimationFrame(() => requestAnimationFrame(resolver)));
  })()`);
}

async function capturar(nombre) {
  if (!capturas) return;
  const clip = await navegador.evaluar("(() => { const limite = document.querySelector('#fotografia').getBoundingClientRect(); return { x: Math.max(0, limite.left + scrollX), y: Math.max(0, limite.top + scrollY), width: limite.width, height: limite.height, scale: 1 }; })()");
  const imagen = await navegador.enviar("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip });
  await fs.writeFile(path.join(capturas, nombre + ".png"), Buffer.from(imagen.data, "base64"));
}

async function ejecutar() {
  fotografias = await crearFotografias();
  navegador = await abrirNavegador();
  if (typeof navegador.escucharEvento !== "function") throw new Error("El soporte CDP debe exponer escucharEvento.");
  if (process.argv.includes("--capturas")) capturas = await fs.mkdtemp(path.join(os.tmpdir(), "portfolio-galeria-capturas-"));
  desuscribir = navegador.escucharEvento("Fetch.requestPaused", atenderPeticion);
  await navegador.enviar("Fetch.enable", { patterns: [{ urlPattern: "*/api/fotografias*", requestStage: "Request" }] });
  await navegador.enviar("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });

  await cargarEscenario("sin fotografías", 0);
  await verificar("!document.querySelector('#fotografia .photography__slider') && !document.querySelector('#fotografia .photography__arrow')", "el estado vacío no presenta un slider ni controles inútiles");

  await cargarEscenario("una fotografía", 1);
  await verificar(`(() => { const slider = document.querySelector(${JSON.stringify(selectorSlider)}); const imagen = slider.querySelector('img'); return slider.swiper.slides[0].getBoundingClientRect().width >= slider.getBoundingClientRect().width * 0.95 && getComputedStyle(imagen).objectFit === 'contain'; })()`, "una fotografía ocupa todo el ancho y conserva la imagen completa");
  await verificar("[...document.querySelectorAll('#fotografia .photography__arrow')].every(boton => boton.disabled || !boton.getClientRects().length)", "una sola fotografía no ofrece navegación inservible");

  await cargarEscenario("error inicial y reintento", 1, 1);
  escenario.fallarPagina = null;
  await pulsarTexto("Reintentar");
  await esperarCantidad(1);
  await verificar("!document.querySelector('#fotografia [role=alert]')", "reintentar recupera la galería después de un error inicial");

  await cargarEscenario("paginación y navegación", 14, 2);
  await verificar(`(() => { const swiper = document.querySelector(${JSON.stringify(selectorSlider)}).swiper; return !swiper.params.loop && !swiper.autoplay?.running && (!swiper.params.autoplay || swiper.params.autoplay.enabled === false); })()`, "la galería no inicia autoplay ni un bucle de fotografías");
  await verificar(`JSON.stringify([...document.querySelectorAll('#fotografia .photography__slide img')].map(imagen => imagen.alt)) === ${JSON.stringify(JSON.stringify(fotografias.slice(0, 12).map((foto) => foto.imagenAlt)))}`, "las imágenes conservan los textos alternativos recibidos");
  await navegador.evaluar(`document.querySelector(${JSON.stringify(selectorSlider)}).scrollIntoView({ block: 'center', behavior: 'instant' }); document.querySelector(${JSON.stringify(selectorSlider)}).focus({ preventScroll: true })`);
  const antesTeclado = await indiceActual();
  await pulsarFlecha("ArrowRight");
  await esperarIndice(antesTeclado);
  comprobaciones += 1;
  await navegador.evaluar("document.querySelector('.theme-toggle').focus({ preventScroll: true })");
  const fuera = await indiceActual();
  await pulsarFlecha("ArrowRight");
  await verificar(`document.querySelector(${JSON.stringify(selectorSlider)}).swiper.activeIndex === ${fuera}`, "las flechas fuera de la galería no cambian la fotografía");

  const antesClic = await indiceActual();
  const contadorAntes = await navegador.evaluar("document.querySelector('#fotografia .photography__position').textContent");
  await pulsar(selectorSiguiente);
  await esperarIndice(antesClic);
  await verificar(`document.querySelector('#fotografia .photography__position').textContent !== ${JSON.stringify(contadorAntes)}`, "el contador refleja la fotografía alcanzada mediante las flechas");
  await pulsar(selectorAnterior);
  await esperarIndice(antesClic + 1, false);

  for (let paso = 0; paso < 20; paso += 1) {
    if (await navegador.evaluar(`document.querySelector(${JSON.stringify(selectorSiguiente)}).disabled`)) break;
    const anterior = await indiceActual();
    await pulsar(selectorSiguiente);
    await esperarIndice(anterior);
  }
  await verificar(`document.querySelector(${JSON.stringify(selectorSiguiente)}).disabled`, "la navegación se detiene al final de las fotografías cargadas");
  const ultimoCargado = await indiceActual();
  await pulsarTexto("Cargar más fotografías");
  await navegador.esperarHasta(() => navegador.evaluar("!!document.querySelector('#fotografia [role=alert]')"), "error de la segunda página");
  await verificar(`document.querySelector(${JSON.stringify(selectorSlider)}).swiper.slides.length === 12 && document.querySelector(${JSON.stringify(selectorSlider)}).swiper.activeIndex === ${ultimoCargado}`, "un error al cargar más conserva fotografías y posición");
  escenario.fallarPagina = null;
  await pulsarTexto("Reintentar");
  await esperarCantidad(14);
  await verificar(`document.querySelector(${JSON.stringify(selectorSlider)}).swiper.activeIndex === ${ultimoCargado} && !document.querySelector(${JSON.stringify(selectorSiguiente)}).disabled`, "añadir otra página conserva el índice y habilita la navegación restante");
  await verificar("document.querySelector('#fotografia .photography__position').textContent.includes('14')", "el contador actualiza el total de fotografías cargadas");
  await pulsar(selectorSiguiente);
  await esperarIndice(ultimoCargado);
  comprobaciones += 1;

  for (const ancho of [320, 375, 768, 1280]) {
    await adaptarPantalla(ancho);
    await verificar("document.documentElement.scrollWidth <= innerWidth + 1", `la galería no desborda la página a ${ancho}px`);
  }

  for (const oscuro of [false, true]) {
    if (await navegador.evaluar("document.documentElement.classList.contains('dark-mode')") !== oscuro) await pulsar(".theme-toggle");
    // Chrome muestra :focus-visible al usar el teclado, no tras un clic seguido de focus().
    await navegador.enviar("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await navegador.enviar("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await navegador.evaluar(`document.querySelector(${JSON.stringify(selectorAnterior)}).focus({ preventScroll: true })`);
    await verificar(`(() => { const boton = document.querySelector(${JSON.stringify(selectorAnterior)}); const estilo = getComputedStyle(boton); return document.documentElement.dataset.bsTheme === ${JSON.stringify(oscuro ? "dark" : "light")} && !boton.disabled && ((estilo.outlineStyle !== 'none' && parseFloat(estilo.outlineWidth) > 0) || estilo.boxShadow !== 'none'); })()`, `las flechas mantienen foco visible en tema ${oscuro ? "oscuro" : "claro"}`);
    await prepararVista();
    comprobaciones += 1;
    await capturar(oscuro ? "galeria-oscura" : "galeria-clara");
  }

  etapa = "movimiento reducido";
  const antesReducir = await indiceActual();
  await navegador.enviar("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await navegador.esperarHasta(() => navegador.evaluar(`document.querySelector(${JSON.stringify(selectorSlider)}).swiper.params.speed === 0`), "velocidad adaptada a movimiento reducido");
  await verificar(`document.querySelector(${JSON.stringify(selectorSlider)}).swiper.activeIndex === ${antesReducir}`, "cambiar la preferencia de movimiento no reinicia la galería");
  await pulsar(selectorAnterior);
  await esperarIndice(antesReducir, false);
  await verificar("parseFloat(getComputedStyle(document.querySelector('#fotografia .swiper-wrapper')).transitionDuration) === 0", "movimiento reducido elimina la transición del desplazamiento");
  const antesRestaurar = await indiceActual();
  await navegador.enviar("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
  await navegador.esperarHasta(() => navegador.evaluar(`document.querySelector(${JSON.stringify(selectorSlider)}).swiper.params.speed > 0`), "restauración de la velocidad habitual");
  await verificar(`document.querySelector(${JSON.stringify(selectorSlider)}).swiper.activeIndex === ${antesRestaurar}`, "restaurar el movimiento conserva la posición");
  etapa = "gesto móvil";
  await adaptarPantalla(375);
  await navegador.enviar("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await navegador.evaluar(`document.querySelector(${JSON.stringify(selectorSlider)}).scrollIntoView({ block: 'center', behavior: 'instant' })`);
  const zona = await navegador.evaluar("(() => { const limite = document.querySelector('#fotografia .swiper-slide-active .photography__image-frame').getBoundingClientRect(); return { izquierda: limite.left, ancho: limite.width, y: limite.top + limite.height / 2 }; })()");
  const antesGesto = await indiceActual();
  await navegador.enviar("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: zona.izquierda + zona.ancho * 0.82, y: zona.y }] });
  for (let paso = 1; paso <= 5; paso += 1) {
    await navegador.enviar("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: zona.izquierda + zona.ancho * (0.82 - paso * 0.13), y: zona.y }] });
  }
  await navegador.enviar("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await esperarIndice(antesGesto);
  comprobaciones += 1;
  await prepararVista();
  comprobaciones += 1;
  await capturar("galeria-movil");

  assert.deepEqual(erroresIntercepcion, [], "las respuestas de prueba se interceptan correctamente");
  assert.deepEqual(navegador.errores, [], "sin excepciones JavaScript");
  console.log(`Correcto: ${comprobaciones} comprobaciones de galería; estados vacío/único/error, paginación, navegación, teclado, gesto móvil, temas y movimiento reducido. Sin cambios en la base de datos.`);
  if (capturas) console.log(`Capturas: ${capturas}`);
}

ejecutar().catch(async (error) => {
  console.error(`Fallo en ${etapa}: ${error.message}`);
  if (capturas && navegador) {
    await capturar("fallo").catch(() => {});
    console.error(`Capturas de diagnóstico: ${capturas}`);
  }
  process.exitCode = 1;
}).finally(async () => {
  desuscribir?.();
  await navegador?.cerrar();
});
