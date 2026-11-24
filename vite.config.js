import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

const raizProyecto = fileURLToPath(new URL('.', import.meta.url))

function resolverDestino(valor) {
  let destino
  try {
    destino = new URL(valor?.trim() || 'http://127.0.0.1:3001')
  } catch {
    throw new Error('API_PROXY_TARGET debe ser una URL raíz HTTP o HTTPS válida.')
  }
  if (!['http:', 'https:'].includes(destino.protocol)
    || destino.username || destino.password || destino.pathname !== '/'
    || destino.href.includes('?') || destino.href.includes('#')) {
    throw new Error('API_PROXY_TARGET debe indicar solo el origen, sin credenciales, ruta, consulta ni fragmento.')
  }
  const local = destino.hostname === 'localhost' || destino.hostname === '[::1]'
    || /^127(?:\.\d{1,3}){3}$/u.test(destino.hostname)
  if (!local && destino.protocol !== 'https:') {
    throw new Error('API_PROXY_TARGET requiere HTTPS para un servidor compartido.')
  }
  return { origen: destino.origin, local }
}

function crearRedireccionAdmin(origen) {
  function configurar(servidor) {
    servidor.middlewares.use((solicitud, respuesta, siguiente) => {
      const ruta = solicitud.url?.split('?')[0]
      if (solicitud.method !== 'GET' || !['/admin', '/admin/'].includes(ruta)) {
        siguiente()
        return
      }
      // El acceso ocurre en HTTPS en el alojamiento, con sus cookies y origen reales.
      respuesta.writeHead(302, { Location: origen + '/admin', 'Cache-Control': 'no-store' })
      respuesta.end()
    })
  }
  return {
    name: 'portfolio-admin-compartido',
    configureServer: configurar,
    configurePreviewServer: configurar,
  }
}

export default defineConfig(({ mode }) => {
  // Esta opción solo configura el proxy de Node; no se publica como VITE_* en React.
  const { API_PROXY_TARGET } = loadEnv(mode, raizProyecto, 'API_PROXY_TARGET')
  const { origen, local } = resolverDestino(API_PROXY_TARGET)
  return {
    plugins: [react(), !local && crearRedireccionAdmin(origen)],
    server: {
      // La misma dirección local que utilizan la documentación y los comprobadores.
      host: '127.0.0.1',
      proxy: {
        '/api': { target: origen, changeOrigin: !local },
      },
    },
  }
})
