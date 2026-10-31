"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");

const esperar = (milisegundos) => new Promise((resolver) => setTimeout(resolver, milisegundos));

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

async function localizarChrome() {
  const candidatos = process.env.CHROME_PATH ? [process.env.CHROME_PATH] : [
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, "Google/Chrome/Application/chrome.exe"),
    process.env["ProgramFiles(x86)"] && path.join(process.env["ProgramFiles(x86)"], "Microsoft/Edge/Application/msedge.exe"),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  for (const candidato of candidatos.filter(Boolean)) {
    try { await fs.access(candidato); return candidato; } catch { /* Probamos la siguiente instalación. */ }
  }
  throw new Error("Configura CHROME_PATH con la ubicación de Chrome o Chromium.");
}

/** Cliente CDP mínimo para comprobaciones funcionales; no usa el perfil personal. */
async function abrirNavegador() {
  let conexion;
  let proceso;
  let temporal;
  let siguienteId = 0;
  const pendientes = new Map();
  const errores = [];

  function enviar(metodo, parametros = {}) {
    const id = ++siguienteId;
    return new Promise((resolver, rechazar) => {
      const temporizador = setTimeout(() => {
        pendientes.delete(id);
        rechazar(new Error(`El navegador no respondió a ${metodo}`));
      }, 15000);
      pendientes.set(id, { resolver, rechazar, temporizador });
      conexion.send(JSON.stringify({ id, method: metodo, params: parametros }));
    });
  }

  async function evaluar(expresion) {
    const resultado = await enviar("Runtime.evaluate", {
      expression: expresion, awaitPromise: true, returnByValue: true, userGesture: true,
    });
    // No se incluye la expresión: puede contener campos de acceso de la prueba.
    if (resultado.exceptionDetails) throw new Error("No se pudo completar una comprobación en la página.");
    return resultado.result.value;
  }

  async function pulsar(selector) {
    const posicion = await evaluar(`(() => {
      const elemento = document.querySelector(${JSON.stringify(selector)});
      if (!elemento || elemento.disabled) throw new Error('Control no disponible');
      elemento.scrollIntoView({ block: 'center', behavior: 'instant' });
      const limites = elemento.getBoundingClientRect();
      const x = limites.left + limites.width / 2;
      const y = limites.top + limites.height / 2;
      if (!elemento.contains(document.elementFromPoint(x, y))) throw new Error('Control cubierto');
      return { x, y };
    })()`);
    await enviar("Input.dispatchMouseEvent", { type: "mouseMoved", ...posicion });
    await enviar("Input.dispatchMouseEvent", { type: "mousePressed", ...posicion, button: "left", clickCount: 1 });
    await enviar("Input.dispatchMouseEvent", { type: "mouseReleased", ...posicion, button: "left", clickCount: 1 });
  }

  /** El setter nativo permite que React detecte el cambio en un campo controlado. */
  async function rellenar(selector, valor) {
    await evaluar(`(() => {
      const elemento = document.querySelector(${JSON.stringify(selector)});
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(elemento), 'value');
      descriptor.set.call(elemento, ${JSON.stringify(valor)});
      elemento.dispatchEvent(new Event('input', { bubbles: true }));
      elemento.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
  }

  async function adjuntarArchivo(selector, archivo) {
    const documento = await enviar("DOM.getDocument");
    const elemento = await enviar("DOM.querySelector", { nodeId: documento.root.nodeId, selector });
    await enviar("DOM.setFileInputFiles", { nodeId: elemento.nodeId, files: [archivo] });
  }

  async function navegar(direccion, condicion) {
    await evaluar("window.__documentoAnterior = true");
    await enviar("Page.navigate", { url: direccion });
    await esperarHasta(() => evaluar(`!window.__documentoAnterior && document.readyState === 'complete' && (${condicion})`), "carga de la página");
  }

  async function cerrar() {
    if (conexion?.readyState === WebSocket.OPEN) {
      try { await enviar("Browser.close"); } catch { /* El cierre puede preceder a la respuesta. */ }
      conexion.close();
    }
    if (proceso && proceso.exitCode === null) {
      proceso.kill();
      await Promise.race([new Promise((resolver) => proceso.once("exit", resolver)), esperar(3000)]);
    }
    for (const pendiente of pendientes.values()) clearTimeout(pendiente.temporizador);
    if (temporal && path.dirname(path.resolve(temporal)) === path.resolve(os.tmpdir()) && path.basename(temporal).startsWith("portfolio-admin-chrome-")) {
      await fs.rm(temporal, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
  }

  try {
    const ejecutable = await localizarChrome();
    temporal = await fs.mkdtemp(path.join(os.tmpdir(), "portfolio-admin-chrome-"));
    let falloInicio;
    proceso = spawn(ejecutable, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${temporal}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
    proceso.on("error", (error) => { falloInicio = error; });
    const puerto = await esperarHasta(async () => {
      if (falloInicio) throw falloInicio;
      try { return (await fs.readFile(path.join(temporal, "DevToolsActivePort"), "utf8")).split(/\r?\n/u)[0]; }
      catch { return false; }
    }, "inicio de Chrome");
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
      if (mensaje.method === "Runtime.exceptionThrown") errores.push(mensaje.params.exceptionDetails.text);
    });
    conexion.addEventListener("close", () => {
      for (const pendiente of pendientes.values()) {
        clearTimeout(pendiente.temporizador);
        pendiente.rechazar(new Error("Se cerró la conexión con Chrome."));
      }
      pendientes.clear();
    });
    await enviar("Page.enable");
    await enviar("Runtime.enable");
    await enviar("Network.enable");
    return { enviar, evaluar, pulsar, rellenar, adjuntarArchivo, navegar, esperarHasta, cerrar, errores };
  } catch (error) {
    await cerrar();
    throw error;
  }
}

module.exports = { abrirNavegador };
