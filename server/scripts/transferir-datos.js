import { createHash, randomUUID } from 'node:crypto'
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { cargarConfiguracion, raizProyecto } from '../src/configuracion.js'
import { crearPool } from '../src/base-datos.js'
import { NOMBRE_IMAGEN } from '../src/modules/imagenes/nombres.js'

const columnasGaleria = ['id', 'titulo', 'descripcion', 'nombre_archivo', 'imagen_alt', 'orden', 'estado',
  'ancho', 'alto', 'tamano', 'fecha_creacion', 'fecha_actualizacion']
// Ningún nombre de tabla o columna procede del paquete ni de argumentos del usuario.
export const TABLAS_TRANSFERIBLES = Object.freeze({
  tecnologias: ['id', 'nombre'],
  proyectos: ['id', 'slug', 'titulo', 'resumen', 'descripcion', 'categoria', 'nombre_archivo', 'imagen_externa',
    'imagen_alt', 'orden', 'estado', 'ancho', 'alto', 'tamano', 'url_proyecto', 'url_repositorio', 'fecha_creacion', 'fecha_actualizacion'],
  proyecto_tecnologia: ['proyecto_id', 'tecnologia_id', 'orden'],
  proyecto_imagenes: ['id', 'proyecto_id', 'nombre_archivo', 'imagen_externa', 'imagen_alt', 'orden', 'ancho', 'alto', 'tamano'],
  ilustraciones: [...columnasGaleria],
  fotografias: [...columnasGaleria],
  importaciones_datos: ['nombre', 'aplicada_en'],
})
for (const columnas of Object.values(TABLAS_TRANSFERIBLES)) Object.freeze(columnas)
const recursos = ['proyectos', 'ilustraciones', 'fotografias']
const huella = (contenido) => createHash('sha256').update(contenido).digest('hex')
const objeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor)

class ErrorTransferencia extends Error {}
function exigir(condicion, mensaje = 'El paquete de transferencia no es válido.') {
  if (!condicion) throw new ErrorTransferencia(mensaje)
}
function clavesExactas(valor, claves) {
  return objeto(valor) && Object.keys(valor).length === claves.length && claves.every((clave) => Object.hasOwn(valor, clave))
}
function entero(valor, positivo = false) {
  return Number.isInteger(valor) && valor >= (positivo ? 1 : 0) && valor <= 4294967295
}
function texto(valor, maximo, obligatorio = false) {
  return typeof valor === 'string' && !valor.includes('\0') && [...valor].length <= maximo && (!obligatorio || valor.trim().length > 0)
}
function fecha(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u.test(valor)) return false
  const instante = new Date(valor.replace(' ', 'T') + 'Z')
  return !Number.isNaN(instante.getTime()) && instante.toISOString().slice(0, 19).replace('T', ' ') === valor
}
function urlValida(valor, soloHttps = true) {
  try {
    const url = new URL(valor)
    return texto(valor, 2048, true) && (soloHttps ? url.protocol === 'https:' : ['http:', 'https:'].includes(url.protocol))
      && !url.username && !url.password
  } catch { return false }
}

function validarFila(tabla, fila) {
  exigir(clavesExactas(fila, TABLAS_TRANSFERIBLES[tabla]), 'El paquete contiene columnas no permitidas o incompletas.')
  for (const [columna, valor] of Object.entries(fila)) {
    let valido
    if (['id', 'proyecto_id', 'tecnologia_id'].includes(columna)) valido = entero(valor, true)
    else if (columna === 'orden') valido = entero(valor)
    else if (['ancho', 'alto', 'tamano'].includes(columna)) {
      valido = valor === null && ['proyectos', 'proyecto_imagenes'].includes(tabla) || entero(valor, true)
    } else if (['fecha_creacion', 'fecha_actualizacion', 'aplicada_en'].includes(columna)) valido = fecha(valor)
    else if (columna === 'estado') valido = ['borrador', 'publicado'].includes(valor)
    else if (columna === 'nombre_archivo') valido = valor === null && ['proyectos', 'proyecto_imagenes'].includes(tabla)
      || typeof valor === 'string' && NOMBRE_IMAGEN.test(valor)
    else if (['imagen_externa', 'url_proyecto', 'url_repositorio'].includes(columna)) {
      valido = valor === null || urlValida(valor, columna === 'imagen_externa')
    }
    else if (columna === 'nombre') valido = texto(valor, tabla === 'tecnologias' ? 60 : 160, true)
    else if (columna === 'descripcion') valido = texto(valor, 65535) && Buffer.byteLength(valor, 'utf8') <= 65535
    else if (columna === 'categoria') valido = texto(valor, 120, true)
    else if (['imagen_alt', 'resumen'].includes(columna)) valido = texto(valor, 300)
    else valido = texto(valor, 160, true)
    exigir(valido, 'El paquete contiene un valor de columna no válido.')
  }
  if (['proyectos', 'proyecto_imagenes'].includes(tabla)) {
    exigir((fila.nombre_archivo !== null) !== (fila.imagen_externa !== null), 'Cada imagen necesita una única fuente.')
    if (fila.nombre_archivo !== null) exigir(['ancho', 'alto', 'tamano'].every((columna) => entero(fila[columna], true)))
  }
  if (tabla === 'proyectos') exigir(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(fila.slug), 'Hay un slug de proyecto no válido.')
}

export function validarManifiesto(manifiesto) {
  exigir(clavesExactas(manifiesto, ['version', 'creado_en', 'datos', 'imagenes']))
  exigir(manifiesto.version === 1 && typeof manifiesto.creado_en === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(manifiesto.creado_en)
    && !Number.isNaN(Date.parse(manifiesto.creado_en))
    && new Date(manifiesto.creado_en).toISOString() === manifiesto.creado_en)
  exigir(clavesExactas(manifiesto.datos, Object.keys(TABLAS_TRANSFERIBLES)))
  const identificadores = {}
  for (const tabla of Object.keys(TABLAS_TRANSFERIBLES)) {
    const filas = manifiesto.datos[tabla]
    exigir(Array.isArray(filas))
    const ids = new Set()
    const clavesUnicas = new Set()
    const archivos = new Set()
    for (const fila of filas) {
      validarFila(tabla, fila)
      const id = tabla === 'proyecto_tecnologia' ? fila.proyecto_id + ':' + fila.tecnologia_id
        : tabla === 'importaciones_datos' ? fila.nombre : fila.id
      exigir(!ids.has(id), 'El paquete contiene claves duplicadas.')
      ids.add(id)
      const unica = tabla === 'tecnologias' ? fila.nombre : tabla === 'proyectos' ? fila.slug : null
      if (unica !== null) {
        exigir(!clavesUnicas.has(unica), 'El paquete contiene nombres o slugs duplicados.')
        clavesUnicas.add(unica)
      }
      if (fila.nombre_archivo) {
        exigir(!archivos.has(fila.nombre_archivo), 'Una tabla contiene archivos duplicados.')
        archivos.add(fila.nombre_archivo)
      }
    }
    identificadores[tabla] = ids
  }
  for (const fila of manifiesto.datos.proyecto_tecnologia) {
    exigir(identificadores.proyectos.has(fila.proyecto_id) && identificadores.tecnologias.has(fila.tecnologia_id),
      'El paquete contiene relaciones a registros inexistentes.')
  }
  for (const fila of manifiesto.datos.proyecto_imagenes) exigir(identificadores.proyectos.has(fila.proyecto_id),
    'Una imagen de detalle pertenece a un proyecto inexistente.')

  const referencias = new Map()
  for (const tabla of ['proyectos', 'proyecto_imagenes', 'ilustraciones', 'fotografias']) {
    const recurso = tabla === 'proyecto_imagenes' ? 'proyectos' : tabla
    for (const fila of manifiesto.datos[tabla]) if (fila.nombre_archivo) {
      const clave = recurso + '/' + fila.nombre_archivo
      exigir(!referencias.has(clave) || referencias.get(clave).tamano === fila.tamano,
        'Una imagen compartida tiene tamaños de archivo distintos.')
      referencias.set(clave, { recurso, nombre: fila.nombre_archivo, tamano: fila.tamano })
    }
  }
  exigir(Array.isArray(manifiesto.imagenes) && manifiesto.imagenes.length === referencias.size,
    'La lista de imágenes no coincide con los archivos referenciados.')
  const presentes = new Set()
  for (const imagen of manifiesto.imagenes) {
    exigir(clavesExactas(imagen, ['recurso', 'nombre', 'tamano', 'sha256']))
    exigir(recursos.includes(imagen.recurso) && typeof imagen.nombre === 'string' && NOMBRE_IMAGEN.test(imagen.nombre))
    const clave = imagen.recurso + '/' + imagen.nombre
    exigir(!presentes.has(clave) && referencias.has(clave), 'Hay imágenes duplicadas o no referenciadas.')
    exigir(entero(imagen.tamano, true) && imagen.tamano === referencias.get(clave).tamano
      && typeof imagen.sha256 === 'string' && /^[a-f0-9]{64}$/u.test(imagen.sha256))
    presentes.add(clave)
  }
  return referencias
}

async function leerRegular(ruta) {
  const estado = await lstat(ruta)
  exigir(estado.isFile() && !estado.isSymbolicLink(), 'La transferencia requiere archivos regulares, sin enlaces simbólicos.')
  return readFile(ruta)
}
async function exigirDirectorio(ruta) {
  const estado = await lstat(ruta)
  exigir(estado.isDirectory() && !estado.isSymbolicLink(), 'El paquete no admite directorios simbólicos.')
}

export async function validarPaquete(directorio) {
  const raiz = path.resolve(directorio)
  await exigirDirectorio(raiz)
  const manifiesto = JSON.parse(await leerRegular(path.join(raiz, 'manifest.json')))
  validarManifiesto(manifiesto)
  const archivos = new Map()
  const directorioImagenes = path.join(raiz, 'imagenes')
  if (manifiesto.imagenes.length) {
    await exigirDirectorio(directorioImagenes)
    const recursosPresentes = new Set(manifiesto.imagenes.map((imagen) => imagen.recurso))
    const subdirectorios = await readdir(directorioImagenes)
    exigir(subdirectorios.length === recursosPresentes.size && subdirectorios.every((recurso) => recursosPresentes.has(recurso)),
      'La carpeta de imágenes contiene recursos no referenciados.')
    for (const recurso of recursosPresentes) {
      await exigirDirectorio(path.join(directorioImagenes, recurso))
      const nombres = new Set(manifiesto.imagenes.filter((imagen) => imagen.recurso === recurso).map((imagen) => imagen.nombre))
      const presentes = await readdir(path.join(directorioImagenes, recurso))
      exigir(presentes.length === nombres.size && presentes.every((nombre) => nombres.has(nombre)),
        'La carpeta contiene imágenes no referenciadas o incompletas.')
    }
  } else {
    try {
      await exigirDirectorio(directorioImagenes)
      exigir((await readdir(directorioImagenes)).length === 0, 'Hay imágenes que no están referenciadas por el manifiesto.')
    } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  for (const imagen of manifiesto.imagenes) {
    await exigirDirectorio(path.join(raiz, 'imagenes', imagen.recurso))
    const contenido = await leerRegular(path.join(raiz, 'imagenes', imagen.recurso, imagen.nombre))
    exigir(contenido.length === imagen.tamano && huella(contenido) === imagen.sha256,
      'Una imagen está incompleta o su huella SHA256 no coincide.')
    archivos.set(imagen.recurso + '/' + imagen.nombre, contenido)
  }
  return { manifiesto, archivos }
}

export async function exportarDatos({ pool, configuracion, directorio = path.join(raizProyecto, '.tmp', 'transferencia-' + randomUUID()) }) {
  exigir((configuracion.almacenamientoImagenes?.proveedor || 'local') === 'local', 'La exportación requiere el almacenamiento local de origen.')
  const destino = path.resolve(directorio)
  await mkdir(path.dirname(destino), { recursive: true })
  await mkdir(destino) // No se reutiliza ni sobrescribe una exportación anterior.
  const conexion = await pool.getConnection()
  try {
    await conexion.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
    await conexion.query('START TRANSACTION WITH CONSISTENT SNAPSHOT')
    const manifiesto = { version: 1, creado_en: new Date().toISOString(), datos: {}, imagenes: [] }
    for (const [tabla, columnas] of Object.entries(TABLAS_TRANSFERIBLES)) {
      const [filas] = await conexion.execute('SELECT ' + columnas.join(', ') + ' FROM ' + tabla)
      // Proyección explícita: también elimina propiedades adicionales de adaptadores de BD.
      manifiesto.datos[tabla] = filas.map((fila) => Object.fromEntries(columnas.map((columna) => [columna, fila[columna]])))
    }
    const referencias = new Map()
    for (const tabla of ['proyectos', 'proyecto_imagenes', 'ilustraciones', 'fotografias']) {
      for (const fila of manifiesto.datos[tabla]) if (fila.nombre_archivo) {
        validarFila(tabla, fila)
        const recurso = tabla === 'proyecto_imagenes' ? 'proyectos' : tabla
        referencias.set(recurso + '/' + fila.nombre_archivo, { recurso, nombre: fila.nombre_archivo, tamano: fila.tamano })
      }
    }
    const directorios = {
      proyectos: configuracion.directorioImagenesProyectos,
      ilustraciones: configuracion.directorioImagenesIlustraciones,
      fotografias: configuracion.directorioImagenesFotografias || configuracion.directorioImagenes,
    }
    for (const imagen of referencias.values()) {
      const contenido = await leerRegular(path.join(directorios[imagen.recurso], imagen.nombre))
      exigir(contenido.length === imagen.tamano, 'El tamaño de una imagen de origen no coincide con su registro.')
      await mkdir(path.join(destino, 'imagenes', imagen.recurso), { recursive: true })
      await writeFile(path.join(destino, 'imagenes', imagen.recurso, imagen.nombre), contenido, { flag: 'wx', mode: 0o600 })
      manifiesto.imagenes.push({ ...imagen, sha256: huella(contenido) })
    }
    validarManifiesto(manifiesto)
    await conexion.commit()
    await writeFile(path.join(destino, 'manifest.json'), JSON.stringify(manifiesto, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
    return { directorio: destino, registros: Object.values(manifiesto.datos).reduce((total, filas) => total + filas.length, 0), imagenes: manifiesto.imagenes.length }
  } catch (error) {
    await conexion.rollback().catch(() => {})
    throw error
  } finally { conexion.release() }
}

function validarDestino(configuracion) {
  const bd = configuracion.baseDatos
  exigir(configuracion.almacenamientoImagenes?.proveedor === 'supabase', 'La importación requiere IMAGE_STORAGE=supabase.')
  exigir(bd?.ssl && bd.ssl.rejectUnauthorized === true && bd.ssl.verifyIdentity === true,
    'La importación requiere DB_SSL=1 con verificación TLS e identidad del servidor.')
  const host = bd?.host?.trim().toLowerCase().replace(/\.$/u, '')
  exigir(typeof host === 'string' && host.length > 0 && !['localhost', '::1', '[::1]', '0.0.0.0'].includes(host)
    && !host.endsWith('.localhost') && !/^127(?:\.\d{1,3}){3}$/u.test(host),
  'La importación requiere una base remota; no se permite sobrescribir el origen local.')
}
async function exigirTablasVacias(conexion) {
  for (const [tabla, columnas] of Object.entries(TABLAS_TRANSFERIBLES)) {
    const [filas] = await conexion.execute('SELECT ' + columnas[0] + ' FROM ' + tabla + ' LIMIT 1 FOR UPDATE')
    exigir(filas.length === 0, 'La base de destino ya contiene datos. La importación no borra ni sobrescribe registros.')
  }
}

export async function importarDatos({ pool, configuracion, directorio, almacenes }) {
  validarDestino(configuracion)
  // Todos los datos y bytes se validan antes de acceder al destino; se conservan en memoria.
  const { manifiesto, archivos } = await validarPaquete(directorio)
  const conexion = await pool.getConnection()
  let confirmando = false
  try {
    await conexion.beginTransaction()
    await exigirTablasVacias(conexion)
    await conexion.rollback()
    for (const imagen of manifiesto.imagenes) {
      const almacen = almacenes[imagen.recurso]
      let existente
      try { existente = await almacen.leer(imagen.nombre) }
      catch (error) { if (error.estado !== 404) throw error }
      if (existente !== undefined) {
        exigir(Buffer.isBuffer(existente) && huella(existente) === imagen.sha256,
          'Una imagen remota ya existe con contenido diferente. Se conserva sin sobrescribir.')
      } else {
        await almacen.guardar(imagen.nombre, archivos.get(imagen.recurso + '/' + imagen.nombre))
        const guardado = await almacen.leer(imagen.nombre)
        exigir(Buffer.isBuffer(guardado) && huella(guardado) === imagen.sha256,
          'No se pudo verificar el contenido de una imagen subida. Se conserva para su revisión.')
      }
    }
    await conexion.beginTransaction()
    await exigirTablasVacias(conexion)
    for (const [tabla, columnas] of Object.entries(TABLAS_TRANSFERIBLES)) {
      const sentencia = 'INSERT INTO ' + tabla + ' (' + columnas.join(', ') + ') VALUES (' + columnas.map(() => '?').join(', ') + ')'
      for (const fila of manifiesto.datos[tabla]) await conexion.execute(sentencia, columnas.map((columna) => fila[columna]))
    }
    confirmando = true
    await conexion.commit()
    return { registros: Object.values(manifiesto.datos).reduce((total, filas) => total + filas.length, 0), imagenes: manifiesto.imagenes.length }
  } catch (error) {
    await conexion.rollback().catch(() => {})
    if (confirmando) throw new ErrorTransferencia('No se pudo confirmar el commit. Se conservan las imágenes remotas; comprueba la base antes de reintentar.')
    throw error
  } finally { conexion.release() }
}

async function ejecutarCli() {
  const [accion, directorio, ...sobrantes] = process.argv.slice(2)
  exigir(['exportar', 'importar'].includes(accion) && !sobrantes.length && (accion !== 'importar' || directorio),
    'Uso: node server/scripts/transferir-datos.js exportar [directorio] | importar <directorio>')
  const configuracion = cargarConfiguracion()
  if (accion === 'importar') validarDestino(configuracion)
  const pool = crearPool(configuracion.baseDatos)
  try {
    if (accion === 'exportar') {
      const resultado = await exportarDatos({ pool, configuracion, directorio })
      console.log('Copia creada: ' + resultado.directorio + '. Registros: ' + resultado.registros + '. Imágenes: ' + resultado.imagenes + '.')
    } else {
      const { crearAlmacenesSupabase } = await import('../src/modules/imagenes/almacenamiento-supabase.js')
      const almacenes = await crearAlmacenesSupabase(configuracion.almacenamientoImagenes)
      const resultado = await importarDatos({ pool, configuracion, directorio, almacenes })
      console.log('Importación completada. Registros: ' + resultado.registros + '. Imágenes: ' + resultado.imagenes + '. Los originales se conservan.')
    }
  } finally { await pool.end() }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { await ejecutarCli() }
  catch (error) {
    console.error(error instanceof ErrorTransferencia ? error.message : 'No se pudo completar la transferencia. Comprueba la conexión, el esquema y los archivos; no se han borrado los originales.')
    process.exitCode = 1
  }
}
