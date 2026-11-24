import assert from 'node:assert/strict'
import { createServer as crearServidorHttp } from 'node:http'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer as crearServidorVite, preview } from 'vite'
import configurarVite from '../vite.config.js'

const raizProyecto = fileURLToPath(new URL('../', import.meta.url))

function obtenerConfiguracion(destino = '') {
  const anterior = process.env.API_PROXY_TARGET
  process.env.API_PROXY_TARGET = destino
  try {
    return configurarVite({ mode: 'test' })
  } finally {
    if (anterior === undefined) delete process.env.API_PROXY_TARGET
    else process.env.API_PROXY_TARGET = anterior
  }
}

async function iniciarVite(contexto, destino = '') {
  const configuracion = obtenerConfiguracion(destino)
  const servidor = await crearServidorVite({
    ...configuracion,
    configFile: false,
    root: raizProyecto,
    cacheDir: path.join(raizProyecto, '.tmp/proxy-compartido'),
    logLevel: 'silent',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { ...configuracion.server, port: 0, strictPort: true, hmr: false, watch: null },
  })
  contexto.after(() => servidor.close())
  await servidor.listen()
  return 'http://127.0.0.1:' + servidor.httpServer.address().port
}

test('el proxy conserva listados, rutas de imagen, bytes y cabeceras de acceso', async (contexto) => {
  const imagen = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0xff, 0x80, 0x0a])
  const servidorApi = crearServidorHttp((solicitud, respuesta) => {
    if (solicitud.url === '/api/fotografias?pagina=2') {
      respuesta.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      respuesta.end(JSON.stringify({ datos: [{ id: 42, ruta_imagen: '/api/imagenes/fotografias/obra.webp' }] }))
    } else if (solicitud.url === '/api/imagenes/fotografias/obra.webp') {
      respuesta.writeHead(200, { 'Content-Type': 'image/webp', 'Cache-Control': 'no-store' })
      respuesta.end(imagen)
    } else if (solicitud.url === '/api/admin/sesion') {
      respuesta.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': 'portfolio.sid=prueba; Path=/; HttpOnly; SameSite=Strict' })
      respuesta.end(JSON.stringify({ datos: { autenticado: false, csrfToken: 'token-prueba' } }))
    } else if (solicitud.url === '/api/admin/login' && solicitud.method === 'POST') {
      respuesta.writeHead(200, { 'Content-Type': 'application/json' })
      respuesta.end(JSON.stringify({ datos: {
        origen: solicitud.headers.origin,
        cookie: solicitud.headers.cookie,
        csrf: solicitud.headers['x-csrf-token'],
      } }))
    } else {
      respuesta.writeHead(404)
      respuesta.end()
    }
  })
  contexto.after(() => new Promise((resolver, rechazar) => {
    servidorApi.close((error) => error ? rechazar(error) : resolver())
    servidorApi.closeAllConnections()
  }))
  await new Promise((resolver) => servidorApi.listen(0, '127.0.0.1', resolver))
  const origen = await iniciarVite(contexto, 'http://127.0.0.1:' + servidorApi.address().port)

  const listado = await fetch(origen + '/api/fotografias?pagina=2')
  assert.equal(listado.status, 200)
  assert.equal(listado.headers.get('cache-control'), 'no-store')
  const { datos } = await listado.json()
  assert.equal(datos[0].id, 42)
  const archivo = await fetch(new URL(datos[0].ruta_imagen, origen))
  assert.equal(archivo.headers.get('content-type'), 'image/webp')
  assert.deepEqual(Buffer.from(await archivo.arrayBuffer()), imagen)

  const sesion = await fetch(origen + '/api/admin/sesion')
  assert.equal(sesion.headers.get('set-cookie'), 'portfolio.sid=prueba; Path=/; HttpOnly; SameSite=Strict')
  const acceso = await fetch(origen + '/api/admin/login', {
    method: 'POST',
    headers: { Origin: origen, Cookie: 'portfolio.sid=prueba', 'X-CSRF-Token': 'token-prueba' },
  })
  assert.deepEqual(await acceso.json(), { datos: { origen, cookie: 'portfolio.sid=prueba', csrf: 'token-prueba' } })

  const panel = await fetch(origen + '/admin', { redirect: 'manual' })
  assert.equal(panel.status, 200)
  assert.match(panel.headers.get('content-type'), /text\/html/u)
  assert.match(await panel.text(), /<div id="root"><\/div>/u)
})

test('el panel compartido se abre en su alojamiento y la portada sigue sirviéndose localmente', async (contexto) => {
  const origen = await iniciarVite(contexto, 'https://portfolio.example')
  for (const ruta of ['/admin', '/admin/', '/admin?seccion=fotografia']) {
    const respuesta = await fetch(origen + ruta, { redirect: 'manual' })
    assert.equal(respuesta.status, 302)
    assert.equal(respuesta.headers.get('location'), 'https://portfolio.example/admin')
    assert.equal(respuesta.headers.get('cache-control'), 'no-store')
  }
  const portada = await fetch(origen + '/')
  assert.equal(portada.status, 200)
  assert.match(portada.headers.get('content-type'), /text\/html/u)
  const otraRuta = await fetch(origen + '/administracion', { redirect: 'manual' })
  assert.notEqual(otraRuta.status, 302)
})

test('preview mantiene la redirección del panel compartido sin preparar una compilación de prueba', async (contexto) => {
  const configuracion = obtenerConfiguracion('https://portfolio.example')
  const servidor = await preview({
    ...configuracion,
    configFile: false,
    root: raizProyecto,
    logLevel: 'silent',
    preview: { host: '127.0.0.1', port: 0, strictPort: true },
  })
  contexto.after(() => new Promise((resolver, rechazar) => {
    servidor.httpServer.close((error) => error ? rechazar(error) : resolver())
    servidor.httpServer.closeAllConnections()
  }))
  const respuesta = await fetch('http://127.0.0.1:' + servidor.httpServer.address().port + '/admin', { redirect: 'manual' })
  assert.equal(respuesta.status, 302)
  assert.equal(respuesta.headers.get('location'), 'https://portfolio.example/admin')
})

test('el destino conserva el modo local y rechaza conexiones compartidas inseguras o URLs ajenas al contrato', () => {
  assert.equal(obtenerConfiguracion().server.proxy['/api'].target, 'http://127.0.0.1:3001')
  for (const destino of ['http://localhost:3001', 'http://127.0.0.2:3001', 'http://[::1]:3001']) {
    const configuracion = obtenerConfiguracion(destino)
    assert.equal(configuracion.server.proxy['/api'].changeOrigin, false)
    assert.equal(configuracion.plugins.filter(Boolean).some((plugin) => plugin.name === 'portfolio-admin-compartido'), false)
  }
  for (const destino of [
    'http://portfolio.example', 'http://192.168.1.10:3001', 'ftp://portfolio.example',
    'https://usuario:secreto@portfolio.example', 'https://portfolio.example/api',
    'https://portfolio.example/?consulta=1', 'https://portfolio.example/#fragmento',
    'https://portfolio.example/?', 'https://portfolio.example/#', 'no-es-una-url',
  ]) assert.throws(() => obtenerConfiguracion(destino), /API_PROXY_TARGET/u)
  const compartida = obtenerConfiguracion('https://portfolio.example/')
  assert.equal(compartida.server.proxy['/api'].target, 'https://portfolio.example')
  assert.equal(compartida.server.proxy['/api'].changeOrigin, true)
  assert.notEqual(compartida.server.proxy['/api'].secure, false)
})
