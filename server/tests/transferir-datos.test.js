import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { exportarDatos, importarDatos, TABLAS_TRANSFERIBLES, validarManifiesto, validarPaquete } from '../scripts/transferir-datos.js'

const nombre = '6d8061ba-0b4d-4d87-a4c0-c2ab2ad63510.webp'
const contenido = Buffer.from('imagen de prueba sin datos privados')
const fecha = '2026-11-23 10:20:30'
const vacias = () => Object.fromEntries(Object.keys(TABLAS_TRANSFERIBLES).map((tabla) => [tabla, []]))
const configuracionRemota = {
  almacenamientoImagenes: { proveedor: 'supabase', clave: 'NO_EXPORTAR_CLAVE' },
  baseDatos: { host: 'base.example', ssl: { rejectUnauthorized: true, verifyIdentity: true }, password: 'NO_EXPORTAR_PASSWORD' },
  secretoSesion: 'NO_EXPORTAR_SESION',
}

function datosOrigen() {
  const datos = vacias()
  datos.tecnologias.push({ id: 7, nombre: 'React' })
  datos.proyectos.push({
    id: 42, slug: 'proyecto-original', titulo: 'Título', resumen: 'Resumen', descripcion: 'Descripción\ncon párrafos',
    categoria: 'Diseño', nombre_archivo: nombre, imagen_externa: null, imagen_alt: 'Portada', orden: 3,
    estado: 'publicado', ancho: 320, alto: 200, tamano: contenido.length,
    url_proyecto: 'http://example.test/proyecto', url_repositorio: null,
    fecha_creacion: fecha, fecha_actualizacion: fecha,
  })
  datos.proyecto_tecnologia.push({ proyecto_id: 42, tecnologia_id: 7, orden: 0 })
  datos.proyecto_imagenes.push({ id: 8, proyecto_id: 42, nombre_archivo: null,
    imagen_externa: 'https://example.test/detalle.webp', imagen_alt: 'Detalle', orden: 0,
    ancho: null, alto: null, tamano: null })
  for (const tabla of ['ilustraciones', 'fotografias']) datos[tabla].push({
    id: 1, titulo: tabla, descripcion: 'Texto', nombre_archivo: nombre, imagen_alt: 'Imagen', orden: 0,
    estado: tabla === 'ilustraciones' ? 'borrador' : 'publicado', ancho: 320, alto: 200, tamano: contenido.length,
    fecha_creacion: fecha, fecha_actualizacion: fecha,
  })
  datos.importaciones_datos.push({ nombre: 'proyectos_iniciales_v1', aplicada_en: fecha })
  return datos
}

function crearPoolFalso(datos = vacias()) {
  const estado = { datos: structuredClone(datos), consultas: [], transaccion: null, conexiones: 0,
    commits: 0, rollbacks: 0, liberadas: 0, fallarTabla: null, commitIncierto: false }
  const conexion = {
    async beginTransaction() { estado.transaccion = structuredClone(estado.datos) },
    async query(sql) {
      estado.consultas.push(sql)
      if (sql === 'START TRANSACTION WITH CONSISTENT SNAPSHOT') await this.beginTransaction()
      else assert.equal(sql, 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
      return [[]]
    },
    async execute(sql, valores) {
      estado.consultas.push(sql)
      const lectura = /^SELECT (.+) FROM ([a-z_]+)(?: LIMIT 1 FOR UPDATE)?$/u.exec(sql)
      if (lectura) {
        const [, , tabla] = lectura
        assert.ok(Object.hasOwn(TABLAS_TRANSFERIBLES, tabla), 'solo se leen las tablas de contenido')
        assert.ok(!sql.includes('*'), 'las lecturas enumeran columnas')
        const filas = (estado.transaccion || estado.datos)[tabla]
        if (sql.endsWith('FOR UPDATE')) return [filas.slice(0, 1)]
        return [filas.map((fila) => ({ ...fila, secreto_no_exportable: 'NO_EXPORTAR_CAMPO' }))]
      }
      const insercion = /^INSERT INTO ([a-z_]+) \(([^)]+)\) VALUES \([?, ]+\)$/u.exec(sql)
      assert.ok(insercion, 'solo se permiten inserciones explícitas')
      const [, tabla, columnas] = insercion
      if (estado.fallarTabla === tabla) {
        estado.fallarTabla = null
        throw new Error('fallo simulado de BD')
      }
      assert.ok(estado.transaccion)
      estado.transaccion[tabla].push(Object.fromEntries(columnas.split(', ').map((columna, indice) => [columna, valores[indice]])))
      return [{ affectedRows: 1 }]
    },
    async commit() {
      estado.commits += 1
      estado.datos = estado.transaccion
      estado.transaccion = null
      if (estado.commitIncierto) throw new Error('conexión interrumpida después del commit')
    },
    async rollback() { estado.rollbacks += 1; estado.transaccion = null },
    release() { estado.liberadas += 1 },
  }
  return { estado, async getConnection() { estado.conexiones += 1; return conexion } }
}

function crearAlmacenesFalsos() {
  const objetos = new Map()
  const llamadas = { leer: 0, guardar: 0, eliminar: 0 }
  const almacenes = Object.fromEntries(['proyectos', 'ilustraciones', 'fotografias'].map((recurso) => [recurso, {
    async leer(archivo) {
      llamadas.leer += 1
      const datos = objetos.get(recurso + '/' + archivo)
      if (datos === undefined) throw Object.assign(new Error('ausente'), { estado: 404 })
      return datos
    },
    async guardar(archivo, datos) {
      llamadas.guardar += 1
      const clave = recurso + '/' + archivo
      assert.ok(!objetos.has(clave), 'no se sobrescriben objetos remotos')
      objetos.set(clave, Buffer.from(datos))
    },
    async eliminar() { llamadas.eliminar += 1; assert.fail('la migración nunca elimina objetos') },
  }]))
  return { almacenes, objetos, llamadas }
}

async function crearEscenario(contexto) {
  const temporal = await mkdtemp(path.join(os.tmpdir(), 'portfolio-transferencia-'))
  contexto.after(async () => {
    const raiz = path.resolve(temporal)
    assert.ok(raiz.startsWith(path.resolve(os.tmpdir()) + path.sep))
    assert.ok(path.basename(raiz).startsWith('portfolio-transferencia-'))
    await rm(raiz, { recursive: true, force: true })
  })
  const configuracion = { almacenamientoImagenes: { proveedor: 'local' }, secretoSesion: 'NO_EXPORTAR_SESION' }
  for (const recurso of ['proyectos', 'ilustraciones', 'fotografias']) {
    const directorio = path.join(temporal, 'originales', recurso)
    await mkdir(directorio, { recursive: true })
    await writeFile(path.join(directorio, nombre), contenido)
    // Este archivo ajeno no debe copiarse al paquete.
    await writeFile(path.join(directorio, 'archivo-ajeno.txt'), 'NO_EXPORTAR_ARCHIVO')
    configuracion['directorioImagenes' + recurso[0].toUpperCase() + recurso.slice(1)] = directorio
  }
  const poolOrigen = crearPoolFalso(datosOrigen())
  const directorio = path.join(temporal, 'exportacion')
  const resultado = await exportarDatos({ pool: poolOrigen, configuracion, directorio })
  return { temporal, directorio, configuracion, poolOrigen, resultado }
}

test('exporta una instantánea de contenido y solo imágenes referenciadas, sin cuentas ni secretos', async (contexto) => {
  const escenario = await crearEscenario(contexto)
  const { manifiesto } = await validarPaquete(escenario.directorio)
  assert.deepEqual(manifiesto.datos, datosOrigen())
  assert.equal(escenario.resultado.registros, 7)
  assert.equal(manifiesto.imagenes.length, 3)
  assert.deepEqual(escenario.poolOrigen.estado.consultas.slice(0, 2), [
    'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ', 'START TRANSACTION WITH CONSISTENT SNAPSHOT',
  ])
  const serializado = await readFile(path.join(escenario.directorio, 'manifest.json'), 'utf8')
  assert.doesNotMatch(serializado, /NO_EXPORTAR|usuarios_admin|sesiones|password|secretoSesion/u)
  assert.equal(escenario.poolOrigen.estado.commits, 1)
  for (const recurso of ['proyectos', 'ilustraciones', 'fotografias']) {
    const origen = escenario.configuracion['directorioImagenes' + recurso[0].toUpperCase() + recurso.slice(1)]
    assert.deepEqual(await readFile(path.join(origen, nombre)), contenido)
    await assert.rejects(readFile(path.join(escenario.directorio, 'imagenes', recurso, 'archivo-ajeno.txt')), { code: 'ENOENT' })
  }
  await assert.rejects(exportarDatos({ pool: escenario.poolOrigen, configuracion: escenario.configuracion,
    directorio: escenario.directorio }), { code: 'EEXIST' })
})

test('rechaza traversal, datos ajenos, referencias incompletas y bytes alterados antes de tocar el destino', async (contexto) => {
  const { directorio } = await crearEscenario(contexto)
  const manifiesto = JSON.parse(await readFile(path.join(directorio, 'manifest.json'), 'utf8'))
  for (const modificar of [
    (copia) => { copia.imagenes[0].nombre = '../../fuera.webp' },
    (copia) => { copia.datos.proyectos[0].nombre_archivo = '../fuera.webp' },
    (copia) => { copia.datos.usuarios_admin = [] },
    (copia) => { copia.datos.proyectos[0].password = 'secreto' },
    (copia) => { copia.imagenes.pop() },
    (copia) => { copia.imagenes[1] = copia.imagenes[0] },
    (copia) => { copia.datos.proyecto_tecnologia[0].tecnologia_id = 999 },
    (copia) => { copia.datos.proyectos[0].fecha_creacion = '2026-02-30 00:00:00' },
  ]) {
    const copia = structuredClone(manifiesto)
    modificar(copia)
    assert.throws(() => validarManifiesto(copia))
  }
  await writeFile(path.join(directorio, 'imagenes', 'proyectos', nombre), Buffer.alloc(contenido.length, 1))
  const pool = crearPoolFalso()
  const remoto = crearAlmacenesFalsos()
  await assert.rejects(importarDatos({ pool, configuracion: configuracionRemota, directorio, almacenes: remoto.almacenes }), /SHA256/u)
  assert.equal(pool.estado.conexiones, 0)
  assert.deepEqual(remoto.llamadas, { leer: 0, guardar: 0, eliminar: 0 })
})

test('exige base remota con TLS, almacén Supabase y siete tablas vacías', async (contexto) => {
  const { directorio } = await crearEscenario(contexto)
  for (const configuracion of [
    { ...configuracionRemota, almacenamientoImagenes: { proveedor: 'local' } },
    { ...configuracionRemota, baseDatos: { host: 'base.example' } },
    { ...configuracionRemota, baseDatos: { host: 'base.example', ssl: { rejectUnauthorized: false } } },
    { ...configuracionRemota, baseDatos: { host: 'base.example', ssl: { rejectUnauthorized: true } } },
    { ...configuracionRemota, baseDatos: { host: 'localhost', ssl: { rejectUnauthorized: true, verifyIdentity: true } } },
  ]) {
    const pool = crearPoolFalso()
    await assert.rejects(importarDatos({ pool, configuracion, directorio, almacenes: {} }))
    assert.equal(pool.estado.conexiones, 0)
  }
  for (const tabla of Object.keys(TABLAS_TRANSFERIBLES)) {
    const datos = vacias()
    datos[tabla].push({ existente: true })
    const pool = crearPoolFalso(datos)
    const remoto = crearAlmacenesFalsos()
    await assert.rejects(importarDatos({ pool, configuracion: configuracionRemota, directorio, almacenes: remoto.almacenes }), /ya contiene datos/u)
    assert.deepEqual(pool.estado.datos, datos)
    assert.equal(remoto.llamadas.guardar, 0)
  }
})

test('reutiliza imágenes idénticas de un intento anterior y conserva IDs, relaciones, borradores y fechas', async (contexto) => {
  const { directorio } = await crearEscenario(contexto)
  const pool = crearPoolFalso()
  const remoto = crearAlmacenesFalsos()
  remoto.objetos.set('proyectos/' + nombre, Buffer.from(contenido))
  const resultado = await importarDatos({ pool, configuracion: configuracionRemota, directorio, almacenes: remoto.almacenes })
  assert.deepEqual(pool.estado.datos, datosOrigen())
  assert.deepEqual(resultado, { registros: 7, imagenes: 3 })
  assert.equal(remoto.llamadas.guardar, 2)
  assert.equal(remoto.llamadas.eliminar, 0)
  assert.equal(pool.estado.commits, 1)
  assert.equal(pool.estado.liberadas, 1)
  await assert.rejects(importarDatos({ pool, configuracion: configuracionRemota, directorio, almacenes: remoto.almacenes }), /ya contiene datos/u)
  assert.equal(remoto.llamadas.guardar, 2)
})

test('una imagen remota distinta detiene la importación sin sobrescribirla', async (contexto) => {
  const { directorio } = await crearEscenario(contexto)
  const pool = crearPoolFalso()
  const remoto = crearAlmacenesFalsos()
  remoto.objetos.set('proyectos/' + nombre, Buffer.from('otra imagen'))
  await assert.rejects(importarDatos({ pool, configuracion: configuracionRemota, directorio, almacenes: remoto.almacenes }), /contenido diferente/u)
  assert.deepEqual(pool.estado.datos, vacias())
  assert.equal(remoto.objetos.get('proyectos/' + nombre).toString(), 'otra imagen')
  assert.equal(remoto.llamadas.guardar, 0)
  assert.equal(remoto.llamadas.eliminar, 0)
})

test('un fallo SQL revierte registros y conserva imágenes para reintentar sin duplicarlas', async (contexto) => {
  const { directorio } = await crearEscenario(contexto)
  const pool = crearPoolFalso()
  pool.estado.fallarTabla = 'proyecto_tecnologia'
  const remoto = crearAlmacenesFalsos()
  await assert.rejects(importarDatos({ pool, configuracion: configuracionRemota, directorio, almacenes: remoto.almacenes }), /fallo simulado/u)
  assert.deepEqual(pool.estado.datos, vacias())
  assert.equal(remoto.objetos.size, 3)
  assert.ok(pool.estado.rollbacks >= 2)
  await importarDatos({ pool, configuracion: configuracionRemota, directorio, almacenes: remoto.almacenes })
  assert.deepEqual(pool.estado.datos, datosOrigen())
  assert.equal(remoto.llamadas.guardar, 3)
  assert.equal(remoto.llamadas.eliminar, 0)
})

test('un commit de resultado desconocido conserva objetos y exige comprobar la base antes de repetir', async (contexto) => {
  const { directorio } = await crearEscenario(contexto)
  const pool = crearPoolFalso()
  pool.estado.commitIncierto = true
  const remoto = crearAlmacenesFalsos()
  await assert.rejects(importarDatos({ pool, configuracion: configuracionRemota, directorio, almacenes: remoto.almacenes }), /confirmar el commit/u)
  assert.deepEqual(pool.estado.datos, datosOrigen())
  assert.equal(remoto.objetos.size, 3)
  assert.equal(remoto.llamadas.eliminar, 0)
  await assert.rejects(importarDatos({ pool, configuracion: configuracionRemota, directorio, almacenes: remoto.almacenes }), /ya contiene datos/u)
})

test('comprueba los bytes descargados después de subir y no inserta datos si el contenido remoto difiere', async (contexto) => {
  const { directorio } = await crearEscenario(contexto)
  const pool = crearPoolFalso()
  const remoto = crearAlmacenesFalsos()
  remoto.almacenes.proyectos.guardar = async (archivo) => {
    remoto.llamadas.guardar += 1
    remoto.objetos.set('proyectos/' + archivo, Buffer.from('subida corrupta'))
  }
  await assert.rejects(importarDatos({ pool, configuracion: configuracionRemota, directorio, almacenes: remoto.almacenes }), /verificar el contenido/u)
  assert.deepEqual(pool.estado.datos, vacias())
  assert.equal(remoto.objetos.size, 1)
  assert.equal(remoto.llamadas.eliminar, 0)
})

test('vuelve a comprobar el destino después de copiar archivos y conserva altas concurrentes', async (contexto) => {
  const { directorio } = await crearEscenario(contexto)
  const pool = crearPoolFalso()
  const remoto = crearAlmacenesFalsos()
  const guardar = remoto.almacenes.proyectos.guardar
  remoto.almacenes.proyectos.guardar = async (...argumentos) => {
    await guardar(...argumentos)
    pool.estado.datos.tecnologias.push({ id: 999, nombre: 'Alta concurrente' })
  }
  await assert.rejects(importarDatos({ pool, configuracion: configuracionRemota, directorio, almacenes: remoto.almacenes }), /ya contiene datos/u)
  assert.deepEqual(pool.estado.datos.tecnologias, [{ id: 999, nombre: 'Alta concurrente' }])
  assert.equal(pool.estado.datos.proyectos.length, 0)
  assert.equal(remoto.objetos.size, 3)
  assert.equal(remoto.llamadas.eliminar, 0)
})
