import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { migrarArchivosIlustraciones } from "../src/modules/galerias/almacenamiento.js";

const PRIMERA = "00000000-0000-4000-8000-000000000001.webp";
const SEGUNDA = "00000000-0000-4000-8000-000000000002.webp";
const AJENA = "00000000-0000-4000-8000-000000000003.webp";
const BYTES = Buffer.from([0, 1, 2, 127, 128, 253, 254, 255]);

function crearPool(ilustraciones, fotografias = []) {
  return {
    async execute(consulta) {
      if (consulta === "SELECT nombre_archivo FROM ilustraciones ORDER BY id ASC") {
        return [ilustraciones.map((nombre_archivo) => ({ nombre_archivo }))];
      }
      if (consulta === "SELECT nombre_archivo FROM fotografias") {
        return [fotografias.map((nombre_archivo) => ({ nombre_archivo }))];
      }
      throw new Error("La migración ha intentado una consulta inesperada.");
    },
  };
}

async function prepararCaso(contexto, ilustraciones, fotografias) {
  const directorio = await mkdtemp(path.join(tmpdir(), "portfolio-galerias-"));
  contexto.after(async () => {
    // Solo se limpia la carpeta temporal creada para este caso.
    assert.ok(path.resolve(directorio).startsWith(path.resolve(tmpdir()) + path.sep));
    await rm(directorio, { recursive: true, force: true });
  });
  const directorioOrigen = path.join(directorio, "fotografias");
  const directorioDestino = path.join(directorio, "ilustraciones");
  await mkdir(directorioOrigen);
  await mkdir(directorioDestino);
  return {
    pool: crearPool(ilustraciones, fotografias),
    directorioOrigen,
    directorioDestino,
  };
}

test("traslada solo las ilustraciones referenciadas y conserva sus bytes y nombres", async (contexto) => {
  const opciones = await prepararCaso(contexto, [PRIMERA, SEGUNDA]);
  const otrosBytes = Buffer.from([255, 13, 10, 0, 42]);
  await writeFile(path.join(opciones.directorioOrigen, PRIMERA), BYTES);
  await writeFile(path.join(opciones.directorioOrigen, SEGUNDA), otrosBytes);
  await writeFile(path.join(opciones.directorioOrigen, AJENA), "archivo no referenciado");

  const resultado = await migrarArchivosIlustraciones(opciones);

  assert.equal(resultado.trasladados, 2);
  assert.deepEqual((await readdir(opciones.directorioDestino)).sort(), [PRIMERA, SEGUNDA]);
  assert.deepEqual(await readFile(path.join(opciones.directorioDestino, PRIMERA)), BYTES);
  assert.deepEqual(await readFile(path.join(opciones.directorioDestino, SEGUNDA)), otrosBytes);
  assert.deepEqual(await readdir(opciones.directorioOrigen), [AJENA]);
  assert.equal(await readFile(path.join(opciones.directorioOrigen, AJENA), "utf8"), "archivo no referenciado");
});

test("una segunda ejecución conserva la colección trasladada sin volver a mover archivos", async (contexto) => {
  const opciones = await prepararCaso(contexto, [PRIMERA]);
  await writeFile(path.join(opciones.directorioOrigen, PRIMERA), BYTES);
  await migrarArchivosIlustraciones(opciones);

  const repeticion = await migrarArchivosIlustraciones(opciones);

  assert.deepEqual(repeticion, { trasladados: 0, yaDisponibles: 1, conservados: 0 });
  assert.deepEqual(await readdir(opciones.directorioOrigen), []);
  assert.deepEqual(await readdir(opciones.directorioDestino), [PRIMERA]);
  assert.deepEqual(await readFile(path.join(opciones.directorioDestino, PRIMERA)), BYTES);
});

test("reanuda una copia ya publicada sin sobrescribir el destino ni perder la imagen", async (contexto) => {
  const opciones = await prepararCaso(contexto, [PRIMERA]);
  await writeFile(path.join(opciones.directorioOrigen, PRIMERA), BYTES);
  await writeFile(path.join(opciones.directorioDestino, PRIMERA), BYTES);

  await migrarArchivosIlustraciones(opciones);

  assert.deepEqual(await readdir(opciones.directorioOrigen), []);
  assert.deepEqual(await readdir(opciones.directorioDestino), [PRIMERA]);
  assert.deepEqual(await readFile(path.join(opciones.directorioDestino, PRIMERA)), BYTES);
});

test("un destino diferente detiene la migración y conserva ambos archivos", async (contexto) => {
  const opciones = await prepararCaso(contexto, [PRIMERA]);
  const destinoPrevio = Buffer.from([42, 0, 255]);
  await writeFile(path.join(opciones.directorioOrigen, PRIMERA), BYTES);
  await writeFile(path.join(opciones.directorioDestino, PRIMERA), destinoPrevio);

  await assert.rejects(migrarArchivosIlustraciones(opciones), /destino es diferente/u);

  assert.deepEqual(await readFile(path.join(opciones.directorioOrigen, PRIMERA)), BYTES);
  assert.deepEqual(await readFile(path.join(opciones.directorioDestino, PRIMERA)), destinoPrevio);
  assert.deepEqual(await readdir(opciones.directorioOrigen), [PRIMERA]);
  assert.deepEqual(await readdir(opciones.directorioDestino), [PRIMERA]);
});

test("una imagen ausente en ambas carpetas produce un error verificable", async (contexto) => {
  const opciones = await prepararCaso(contexto, [PRIMERA]);

  await assert.rejects(migrarArchivosIlustraciones(opciones), /Falta una imagen de ilustración/u);

  assert.deepEqual(await readdir(opciones.directorioOrigen), []);
  assert.deepEqual(await readdir(opciones.directorioDestino), []);
});

test("un nombre compartido con fotografías conserva también el archivo original", async (contexto) => {
  const opciones = await prepararCaso(contexto, [PRIMERA], [PRIMERA]);
  await writeFile(path.join(opciones.directorioOrigen, PRIMERA), BYTES);

  const resultado = await migrarArchivosIlustraciones(opciones);
  await migrarArchivosIlustraciones(opciones);

  assert.equal(resultado.trasladados, 0);
  assert.equal(resultado.conservados, 1);
  assert.deepEqual(await readdir(opciones.directorioOrigen), [PRIMERA]);
  assert.deepEqual(await readdir(opciones.directorioDestino), [PRIMERA]);
  assert.deepEqual(await readFile(path.join(opciones.directorioOrigen, PRIMERA)), BYTES);
  assert.deepEqual(await readFile(path.join(opciones.directorioDestino, PRIMERA)), BYTES);
});
