/*
 * Comprueba el portfolio en Chrome real sin instalar librerías de pruebas.
 * Requiere Node 22 o posterior y un servidor Vite ya iniciado.
 * Ejecutar: node scripts/comprobar-navegador.cjs [--capturas]
 * Opcionales: PORTFOLIO_URL y CHROME_PATH para cambiar servidor y navegador.
 * Chrome se abre sin ventana, con un perfil temporal ajeno al habitual.
 */
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");

const direccion = process.env.PORTFOLIO_URL || "http://127.0.0.1:5173/";
const origen = new URL(direccion).origin;
const pendientes = new Map();
const errores = [];
const recursosLocalesFallidos = [];
let navegador;
let conexion;
let temporal;
let carpetaCapturas;
let numeroComando = 0;
let comprobaciones = 0;

/** Cede tiempo al navegador; todas las esperas tienen un plazo corto. */
const esperar = (milisegundos) => new Promise((resolver) => setTimeout(resolver, milisegundos));

/** Reintenta condiciones que dependen del montaje React, la navegación o CSS. */
async function esperarHasta(consulta, descripcion, plazo = 15000) {
  const limite = Date.now() + plazo;
  while (Date.now() < limite) {
    try {
      const resultado = await consulta();
      if (resultado) return resultado;
    } catch (error) {
      if (!/context|navigat|Cannot find|destroyed/i.test(error.message)) throw error;
    }
    await esperar(50);
  }
  throw new Error(`Tiempo agotado: ${descripcion}`);
}

/** Busca una instalación habitual; CHROME_PATH permite usar otra ubicación. */
async function localizarNavegador() {
  const candidatos = process.env.CHROME_PATH ? [process.env.CHROME_PATH] : [
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, "Google/Chrome/Application/chrome.exe"),
    process.env["ProgramFiles(x86)"] && path.join(process.env["ProgramFiles(x86)"], "Google/Chrome/Application/chrome.exe"),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
    process.env["ProgramFiles(x86)"] && path.join(process.env["ProgramFiles(x86)"], "Microsoft/Edge/Application/msedge.exe"),
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  for (const candidato of candidatos.filter(Boolean)) {
    try { await fs.access(candidato); return candidato; } catch { /* Probamos la siguiente ubicación. */ }
  }
  throw new Error("No se encontró Chrome/Chromium. Indica el ejecutable mediante CHROME_PATH.");
}

/** CDP identifica cada petición para relacionarla con su respuesta asíncrona. */
function enviar(metodo, parametros = {}) {
  const id = ++numeroComando;
  return new Promise((resolver, rechazar) => {
    const temporizador = setTimeout(() => {
      pendientes.delete(id);
      rechazar(new Error(`El navegador no respondió a ${metodo}`));
    }, 15000);
    pendientes.set(id, { resolver, rechazar, temporizador });
    conexion.send(JSON.stringify({ id, method: metodo, params: parametros }));
  });
}

/** Ejecuta JavaScript en la página y devuelve valores serializables a Node. */
async function evaluar(expresion) {
  const respuesta = await enviar("Runtime.evaluate", {
    expression: expresion, awaitPromise: true, returnByValue: true, userGesture: true,
  });
  if (respuesta.exceptionDetails) {
    throw new Error(respuesta.exceptionDetails.exception?.description || respuesta.exceptionDetails.text);
  }
  return respuesta.result.value;
}

async function verificar(expresion, descripcion) {
  assert.equal(await evaluar(expresion), true, descripcion);
  comprobaciones += 1;
}

/** Envía un clic de puntero al navegador, incluidos los eventos que usa Bootstrap. */
async function pulsarCoordenadas(coordenadas) {
  await enviar("Input.dispatchMouseEvent", { type: "mouseMoved", ...coordenadas });
  await enviar("Input.dispatchMouseEvent", { type: "mousePressed", ...coordenadas, button: "left", clickCount: 1 });
  await enviar("Input.dispatchMouseEvent", { type: "mouseReleased", ...coordenadas, button: "left", clickCount: 1 });
}

async function pulsarElemento(selector) {
  // Las tarjetas llegan por API después de cargar el documento. Esperamos también
  // las fuentes y la restauración del scroll antes de calcular el punto del clic.
  await evaluar("document.fonts.ready.then(() => true)");
  await evaluar(`(() => {
    const elemento = document.querySelector(${JSON.stringify(selector)});
    if (!elemento) throw new Error('No existe el elemento que se quiere pulsar');
    elemento.scrollIntoView({ block: 'center', behavior: 'instant' });
  })()`);
  let posicionAnterior = "";
  let lecturasEstables = 0;
  const coordenadas = await esperarHasta(async () => {
    const posicion = await evaluar(`(() => {
      const elemento = document.querySelector(${JSON.stringify(selector)});
      const limites = elemento.getBoundingClientRect();
      const x = limites.left + limites.width / 2;
      const y = limites.top + limites.height / 2;
      return { x, y, desplazamiento: scrollY, recibeClic: elemento.contains(document.elementFromPoint(x, y)) };
    })()`);
    const clave = JSON.stringify(posicion);
    lecturasEstables = clave === posicionAnterior ? lecturasEstables + 1 : 0;
    posicionAnterior = clave;
    return lecturasEstables >= 2 && posicion.recibeClic ? { x: posicion.x, y: posicion.y } : false;
  }, "posición estable del control que recibe el clic");
  await pulsarCoordenadas(coordenadas);
}

/** Tab y Escape llegan como entrada de teclado; no se disparan eventos DOM sintéticos. */
async function pulsarTecla(tecla, modificadores = 0) {
  const parametros = { key: tecla, code: tecla, windowsVirtualKeyCode: tecla === "Tab" ? 9 : 27, modifiers: modificadores };
  await enviar("Input.dispatchKeyEvent", { type: "keyDown", ...parametros });
  await enviar("Input.dispatchKeyEvent", { type: "keyUp", ...parametros });
}

/** Comprueba que cada tarjeta abre su propio contenido y que el foco entra en el modal. */
async function abrirFicha(indice = 0) {
  const proyecto = await evaluar(`(() => {
    const boton = document.querySelectorAll('button.project-card__button')[${indice}];
    window.__botonProyecto = boton;
    return { destino: boton.getAttribute('data-bs-target'), titulo: boton.closest('.project-card').querySelector('.project-card__title').textContent.trim() };
  })()`);
  await pulsarElemento(`button.project-card__button[data-bs-target=${JSON.stringify(proyecto.destino)}]`);
  await esperarHasta(() => evaluar(`(() => {
    const modal = document.querySelector(${JSON.stringify(proyecto.destino)});
    return modal.classList.contains('show') && getComputedStyle(modal).display !== 'none' && modal.contains(document.activeElement);
  })()`), "apertura y foco del modal Bootstrap");
  await verificar(`document.querySelectorAll('.project-detail.show').length === 1 && document.querySelector('.project-detail.show .project-detail__title').textContent.trim() === ${JSON.stringify(proyecto.titulo)}`, `la tarjeta ${indice + 1} abre su proyecto`);
}

/** Espera el cierre completo: foco restaurado y ausencia de fondo o bloqueo de scroll. */
async function cerrarFicha(metodo = "Escape") {
  if (metodo === "Escape") await pulsarTecla("Escape");
  else if (metodo === "boton") await pulsarElemento('.project-detail.show .btn-close');
  else {
    await verificar("document.elementFromPoint(4, 4) === document.querySelector('.project-detail.show')", "el clic de fondo cae fuera del contenido del modal");
    await pulsarCoordenadas({ x: 4, y: 4 });
  }
  await esperarHasta(() => evaluar("!document.querySelector('.project-detail.show') && [...document.querySelectorAll('.project-detail.modal')].every(modal => getComputedStyle(modal).display === 'none') && !document.querySelector('.modal-backdrop') && !document.body.classList.contains('modal-open') && getComputedStyle(document.body).overflowY !== 'hidden' && document.activeElement === window.__botonProyecto"), `cierre por ${metodo}, foco restaurado y scroll liberado`);
  comprobaciones += 1;
}

/** Tab entra en los controles y Mayús+Tab no pasa a los controles del portfolio. */
async function verificarFocoDelModal() {
  for (const modificadores of [0, 8]) {
    await pulsarTecla("Tab", modificadores);
    assert.equal(await evaluar("document.querySelector('.project-detail.show').contains(document.activeElement)"), true,
      "Tab y Mayús+Tab conservan el foco en la ficha en lugar de pasar al portfolio");
  }
  comprobaciones += 1;
}

async function verificarBotonDeCierre() {
  await verificar("(() => { const boton = document.querySelector('.project-detail.show .btn-close'); const limites = boton.getBoundingClientRect(); const estilo = getComputedStyle(boton); const oscuro = document.documentElement.classList.contains('dark-mode'); return document.documentElement.dataset.bsTheme === (oscuro ? 'dark' : 'light') && estilo.backgroundImage !== 'none' && Number(estilo.opacity) > 0 && limites.width > 10 && limites.height > 10 && boton.contains(document.elementFromPoint(limites.left + limites.width / 2, limites.top + limites.height / 2)); })()", "el cierre oficial de Bootstrap está visible y recibe clics con el tema actual");
}

/** La marca distingue el documento anterior del que se acaba de recargar. */
async function recargar() {
  await evaluar("window.__documentoAnterior = true");
  await enviar("Page.reload");
  await esperarHasta(() => evaluar("!window.__documentoAnterior && document.readyState === 'complete' && !!document.querySelector('.project-card')"), "recarga de React");
}

/** Las capturas son opcionales y se guardan fuera del repositorio. */
async function capturar(nombre, paginaCompleta = true) {
  if (!carpetaCapturas) return;
  const captura = await enviar("Page.captureScreenshot", { format: "png", captureBeyondViewport: paginaCompleta });
  await fs.writeFile(path.join(carpetaCapturas, nombre + ".png"), Buffer.from(captura.data, "base64"));
}

async function ejecutar() {
  const ejecutable = await localizarNavegador();
  await fetch(direccion, { signal: AbortSignal.timeout(5000) }).catch(() => {
    throw new Error(`No responde ${direccion}. Inicia antes npm run dev -- --host 127.0.0.1.`);
  });
  temporal = await fs.mkdtemp(path.join(os.tmpdir(), "portfolio-chrome-"));
  if (process.argv.includes("--capturas")) {
    carpetaCapturas = await fs.mkdtemp(path.join(os.tmpdir(), "portfolio-capturas-"));
  }
  let errorInicio;
  navegador = spawn(ejecutable, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--remote-debugging-port=0", `--user-data-dir=${temporal}`, "about:blank",
  ], { windowsHide: true, stdio: "ignore" });
  navegador.on("error", (error) => { errorInicio = error; });
  const puerto = await esperarHasta(async () => {
    if (errorInicio) throw errorInicio;
    try { return (await fs.readFile(path.join(temporal, "DevToolsActivePort"), "utf8")).split(/\r?\n/)[0]; }
    catch { return false; }
  }, "inicio del navegador");
  const paginas = await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json();
  conexion = new WebSocket(paginas.find((pagina) => pagina.type === "page").webSocketDebuggerUrl);
  await new Promise((resolver, rechazar) => {
    conexion.addEventListener("open", resolver, { once: true });
    conexion.addEventListener("error", rechazar, { once: true });
  });
  conexion.addEventListener("message", (evento) => {
    const mensaje = JSON.parse(evento.data);
    const pendiente = pendientes.get(mensaje.id);
    if (pendiente) {
      clearTimeout(pendiente.temporizador);
      pendientes.delete(mensaje.id);
      if (mensaje.error) pendiente.rechazar(new Error(mensaje.error.message));
      else pendiente.resolver(mensaje.result);
    }
    if (mensaje.method === "Runtime.exceptionThrown") {
      errores.push(mensaje.params.exceptionDetails.exception?.description || mensaje.params.exceptionDetails.text);
    }
    if (mensaje.method === "Network.responseReceived") {
      const respuesta = mensaje.params.response;
      if (respuesta.status >= 400 && respuesta.url.startsWith(origen + "/")) {
        recursosLocalesFallidos.push(`${respuesta.status}: ${respuesta.url}`);
      }
    }
  });
  conexion.addEventListener("close", () => {
    for (const pendiente of pendientes.values()) {
      clearTimeout(pendiente.temporizador);
      pendiente.rechazar(new Error("El navegador cerró la conexión."));
    }
    pendientes.clear();
  });
  await enviar("Page.enable");
  await enviar("Runtime.enable");
  await enviar("Network.enable");
  await enviar("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await enviar("Page.navigate", { url: direccion });
  await esperarHasta(() => evaluar("document.readyState === 'complete' && !!document.querySelector('.project-card')"), "montaje del portfolio");

  await verificar("document.documentElement.lang === 'es' && !!document.querySelector('main') && document.querySelectorAll('h1').length === 1", "idioma y estructura principal accesibles");
  await verificar("[...document.querySelectorAll('.navbar a[href^=\"#\"]')].every(enlace => enlace.hash.length < 2 || !!document.getElementById(enlace.hash.slice(1))) && !document.querySelector('.navbar').textContent.includes('/*')", "todos los destinos del menú existen y no se muestran comentarios de código");

  await abrirFicha();
  await verificarFocoDelModal();
  await verificarBotonDeCierre();
  await capturar("ficha-tema-inicial", false);
  await cerrarFicha();

  // Cambiar de tarjeta y alternar las vías de cierre detecta instancias o fondos residuales.
  const cantidadTarjetas = await evaluar("Math.min(4, document.querySelectorAll('button.project-card__button').length)");
  for (let indice = 1; indice < cantidadTarjetas; indice += 1) {
    await abrirFicha(indice);
    await cerrarFicha(indice === 1 ? "boton" : indice === 2 ? "fondo" : "Escape");
  }

  const temaInicial = await evaluar("document.documentElement.classList.contains('dark-mode')");
  await capturar("escritorio-tema-inicial");
  await evaluar("document.querySelector('.theme-toggle').click()");
  await esperarHasta(() => evaluar(`document.documentElement.classList.contains('dark-mode') !== ${temaInicial}`), "cambio de tema");
  const temaGuardado = await evaluar("localStorage.getItem('theme')");
  assert.equal(temaGuardado, temaInicial ? "light" : "dark", "el selector guarda el tema elegido");
  await recargar();
  await verificar(`document.documentElement.classList.contains('dark-mode') === ${!temaInicial}`, "el tema persiste al recargar");
  await capturar("escritorio-tema-alternativo");
  await abrirFicha();
  await verificarBotonDeCierre();
  await capturar("ficha-tema-alternativo", false);
  await cerrarFicha("boton");

  for (const ancho of [320, 375, 768, 1280]) {
    await enviar("Emulation.setDeviceMetricsOverride", { width: ancho, height: 900, deviceScaleFactor: 1, mobile: ancho < 500 });
    await esperar(150);
    await verificar("document.documentElement.scrollWidth <= innerWidth + 1 && document.querySelector('.animation-lab__grid').scrollWidth <= document.querySelector('.animation-lab__grid').clientWidth + 1", `la página y la fila animada caben a ${ancho}px`);
    const columnas = ancho < 768 ? 1 : ancho < 992 ? 2 : 3;
    await verificar(`getComputedStyle(document.querySelector('.projects__grid')).gridTemplateColumns.split(/\\s+/).length === ${columnas}`, `los proyectos muestran ${columnas} columnas a ${ancho}px`);
    if (ancho === 375) {
      await evaluar("document.querySelector('.navbar-toggler').click()");
      await esperarHasta(() => evaluar("document.querySelector('#navbarNav').classList.contains('show')"), "apertura de menú móvil");
      await evaluar("document.querySelector('.navbar a[href=\"#sobre-mi\"]').click()");
      await esperarHasta(() => evaluar("location.hash === '#sobre-mi' && !document.querySelector('#navbarNav').classList.contains('show') && !document.querySelector('#navbarNav').classList.contains('collapsing')"), "navegación y cierre del menú móvil");
      comprobaciones += 1;
      // El scroll debe terminar con el título visible, sin depender de su duración.
      let desplazamientoAnterior = -1;
      let medicionesEstables = 0;
      await esperarHasta(async () => {
        const destino = await evaluar("(() => { const titulo = document.querySelector('#sobre-mi h2').getBoundingClientRect(); const barra = document.querySelector('.navbar').getBoundingClientRect(); return { titulo: titulo.top, barra: barra.bottom, alto: innerHeight, desplazamiento: scrollY }; })()");
        medicionesEstables = Math.abs(destino.desplazamiento - desplazamientoAnterior) < 1 ? medicionesEstables + 1 : 0;
        desplazamientoAnterior = destino.desplazamiento;
        return medicionesEstables >= 3 && destino.titulo >= destino.barra && destino.titulo < destino.alto / 2;
      }, "el título de Sobre mí visible tras el scroll y el cierre del menú móvil", 4000);
      comprobaciones += 1;
      await capturar("movil");

      // Un alto reducido obliga a desplazar el cuerpo de la ficha y mantiene accesible la X.
      await enviar("Emulation.setDeviceMetricsOverride", { width: ancho, height: 420, deviceScaleFactor: 1, mobile: true });
      await abrirFicha();
      await verificar("(() => { const ficha = document.querySelector('.project-detail.show .modal-content').getBoundingClientRect(); const cuerpo = document.querySelector('.project-detail.show .modal-body'); return ficha.top >= 0 && ficha.bottom <= innerHeight + 1 && ficha.left >= 0 && ficha.right <= innerWidth + 1 && cuerpo.scrollHeight > cuerpo.clientHeight && getComputedStyle(cuerpo).overflowY === 'auto'; })()", "la ficha móvil cabe en pantalla y permite desplazar su contenido");
      const desplazamientoPagina = await evaluar("scrollY");
      const centroCuerpo = await evaluar("(() => { const cuerpo = document.querySelector('.project-detail.show .modal-body').getBoundingClientRect(); return { x: cuerpo.left + cuerpo.width / 2, y: cuerpo.top + cuerpo.height / 2 }; })()");
      await enviar("Input.dispatchMouseEvent", { type: "mouseWheel", ...centroCuerpo, deltaX: 0, deltaY: 600 });
      await esperarHasta(() => evaluar("document.querySelector('.project-detail.show .modal-body').scrollTop > 0"), "desplazamiento interno del modal con la rueda");
      await verificar(`scrollY === ${desplazamientoPagina} && (() => { const cierre = document.querySelector('.project-detail.show .btn-close').getBoundingClientRect(); return cierre.top >= 0 && cierre.bottom <= innerHeight; })()`, "el contenido se desplaza sin mover la página ni ocultar el cierre");
      await capturar("ficha-movil", false);
      await cerrarFicha("boton");
      await enviar("Emulation.setDeviceMetricsOverride", { width: ancho, height: 900, deviceScaleFactor: 1, mobile: true });
    }
  }

  // Cambiar la preferencia con la página abierta comprueba también la limpieza.
  await enviar("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await esperar(150);
  const leerCuadrados = "[...document.querySelectorAll('.animation-lab__square')].map(cuadrado => { const estilo = getComputedStyle(cuadrado); return [estilo.opacity, estilo.transform]; })";
  const estatico = await evaluar(leerCuadrados);
  assert.ok(estatico.length > 0, "existen cuadrados decorativos");
  await evaluar("document.querySelector('.animation-lab').dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: document.querySelector('.animation-lab__square').getBoundingClientRect().left }))");
  await esperar(300);
  assert.deepEqual(await evaluar(leerCuadrados), estatico, "movimiento reducido mantiene la fila estática");
  comprobaciones += 1;
  await enviar("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
  await esperar(150);
  const animado = await evaluar(leerCuadrados);
  await esperar(300);
  assert.notDeepEqual(await evaluar(leerCuadrados), animado, "la animación vuelve al desactivar movimiento reducido");
  comprobaciones += 1;

  assert.deepEqual(errores, [], "no hay excepciones JavaScript en el navegador");
  assert.deepEqual(recursosLocalesFallidos, [], "los recursos locales cargan correctamente");
  console.log(`Correcto: ${comprobaciones} comprobaciones en Chrome real; modales Bootstrap, teclado, foco, fondo, temas, scroll móvil, navegación y movimiento reducido.`);
  if (carpetaCapturas) console.log(`Capturas: ${carpetaCapturas}`);
}

ejecutar().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (conexion?.readyState === WebSocket.OPEN) {
    try { await enviar("Browser.close"); } catch { /* Chrome puede cerrar antes de responder. */ }
    conexion.close();
  }
  if (navegador && navegador.exitCode === null) {
    navegador.kill();
    await Promise.race([new Promise((resolver) => navegador.once("exit", resolver)), esperar(3000)]);
  }
  for (const pendiente of pendientes.values()) clearTimeout(pendiente.temporizador);
  // Solo se elimina el perfil absoluto creado por esta ejecución en el temporal.
  if (temporal && path.dirname(path.resolve(temporal)) === path.resolve(os.tmpdir()) && path.basename(temporal).startsWith("portfolio-chrome-")) {
    await fs.rm(temporal, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
