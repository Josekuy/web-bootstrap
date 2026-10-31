import assert from "node:assert/strict";
import test from "node:test";
import { ErrorAplicacion } from "../../errores.js";
import { crearRutasImagenes } from "../imagenes/imagenes.js";
import { convertirProyecto } from "./repositorio.js";
import {
  validarEleccionImagen, validarIdProyecto, validarMetadatosProyecto, validarPaginacionProyectos,
} from "./validacion.js";

function datosIniciales(cambios = {}) {
  return {
    slug: "proyecto-de-prueba", titulo: "Proyecto", categoria: "Desarrollo web",
    imagenExterna: "https://example.com/portada.webp", ...cambios,
  };
}

function esErrorDatos(error) {
  return error instanceof ErrorAplicacion && error.estado === 400 && error.codigo === "DATOS_NO_VALIDOS";
}

test("los datos de creación admiten portada externa y tecnologías de un multipart", () => {
  const datos = validarMetadatosProyecto(datosIniciales({ tecnologias: '["React", "  JavaScript  "]' }), { multipart: true });
  assert.deepEqual(datos.tecnologias, ["React", "JavaScript"]);
  assert.equal(datos.estado, "borrador");
  assert.equal(datos.orden, 0);
  assert.equal(datos.imagenAlt, "");
  assert.equal(datos.urlProyecto, null);
  assert.equal(datos.urlRepositorio, null);
  assert.deepEqual(validarMetadatosProyecto({ tecnologias: ["CSS"] }, { parcial: true }), { tecnologias: ["CSS"] });
  assert.deepEqual(validarMetadatosProyecto({ urlProyecto: " " }, { parcial: true }), { urlProyecto: null });
});

test("slug, estados, campos privados y límites de texto se validan antes de escribir", () => {
  for (const cambios of [
    { slug: "Con Mayúsculas" }, { slug: "--inicio" }, { slug: "fin-" }, { slug: "dos--guiones" },
    { slug: "a".repeat(161) }, { titulo: "a".repeat(161) }, { categoria: "a".repeat(121) },
    { descripcion: "a".repeat(5_001) }, { imagenAlt: "a".repeat(301) },
    { nombre_archivo: "archivo-ajeno.webp" }, { ancho: 100 }, { estado: null }, { estado: "oculto" },
    { orden: null }, { orden: "-1" }, { orden: "1.5" }, { orden: "4294967296" },
    { titulo: ["repetido", "duplicado"] }, { titulo: "Texto\u0000oculto" },
  ]) {
    assert.throws(() => validarMetadatosProyecto(datosIniciales(cambios)), esErrorDatos);
  }
  assert.equal(validarMetadatosProyecto(datosIniciales({ titulo: "😀".repeat(160) })).titulo.length, 320);
});

test("las tecnologías rechazan tipos falsos, duplicados y campos multipart repetidos", () => {
  for (const tecnologias of [
    ["React", "react"], ["React", "  React  "], [""], [null], [{ nombre: "React" }],
    Array.from({ length: 21 }, (_, indice) => `Herramienta ${indice}`), ["x".repeat(61)],
    "[JSON incompleto", '{"React":true}',
  ]) {
    assert.throws(() => validarMetadatosProyecto(datosIniciales({ tecnologias })), esErrorDatos);
  }
  assert.throws(
    () => validarMetadatosProyecto(datosIniciales({ tecnologias: ['["React"]', '["CSS"]'] }), { multipart: true }),
    esErrorDatos,
  );
});

test("las URL no admiten protocolos ejecutables, credenciales ni imágenes HTTP", () => {
  for (const cambios of [
    { imagenExterna: "http://example.com/foto.jpg" },
    { imagenExterna: "data:image/svg+xml,<svg/>" },
    { imagenExterna: "https://usuario:secreto@example.com/foto.jpg" },
    { imagenExterna: ["https://example.com/uno", "https://example.com/dos"] },
    { urlProyecto: "javascript:alert(1)" },
    { urlRepositorio: "https://usuario@example.com/repo" },
    { urlProyecto: "/ruta-relativa" },
    { urlRepositorio: "https://example.com/" + "a".repeat(2048) },
    { urlProyecto: "https://example.com/\ncontenido" },
  ]) {
    assert.throws(() => validarMetadatosProyecto(datosIniciales(cambios)), esErrorDatos);
  }
  const datos = validarMetadatosProyecto(datosIniciales({ urlProyecto: " HTTP://EXAMPLE.COM ", urlRepositorio: "" }));
  assert.equal(datos.urlProyecto, "http://example.com/");
  assert.equal(datos.urlRepositorio, null);
});

test("una subida y una URL no pueden elegir simultáneamente dos portadas", () => {
  assert.throws(
    () => validarEleccionImagen({ imagenExterna: "https://example.com/foto" }, { buffer: Buffer.from("archivo") }),
    (error) => error.estado === 400 && error.codigo === "IMAGEN_AMBIGUA",
  );
  assert.throws(
    () => validarEleccionImagen({ imagenExterna: null }, undefined),
    (error) => error.estado === 400 && error.codigo === "IMAGEN_REQUERIDA",
  );
  assert.doesNotThrow(() => validarEleccionImagen({}, undefined, { parcial: true }));
  assert.doesNotThrow(() => validarEleccionImagen({ imagenExterna: null }, { buffer: Buffer.from("archivo") }));
});

test("identificadores, paginación y recursos de imágenes no aceptan entradas arbitrarias", () => {
  for (const id of ["0", "1 OR 1=1", "1.5", "4294967296", ["1", "2"]]) {
    assert.throws(() => validarIdProyecto(id), (error) => error.estado === 400);
  }
  for (const consulta of [{ pagina: "0" }, { limite: "51" }, { pagina: ["1", "2"] }]) {
    assert.throws(() => validarPaginacionProyectos(consulta), (error) => error.estado === 400);
  }
  assert.deepEqual(validarPaginacionProyectos({ pagina: "2", limite: "20" }), { pagina: 2, limite: 20, desplazamiento: 20 });
  for (const recurso of ["__proto__", "usuarios_admin", "proyectos; DROP TABLE proyectos", "fotografias/../proyectos"]) {
    assert.throws(() => crearRutasImagenes({ recurso }), TypeError);
  }
});

test("el DTO de portada externa no convierte dimensiones desconocidas en cero ni expone rutas privadas", () => {
  const datos = convertirProyecto({
    id: 1, slug: "proyecto", titulo: "Proyecto", descripcion: "Descripción", categoria: "Web",
    nombre_archivo: null, imagen_externa: "https://example.com/foto.webp", imagen_alt: "",
    orden: 0, estado: "publicado", ancho: null, alto: null,
    fecha_creacion: "2026-10-31 12:00:00", fecha_actualizacion: "2026-10-31 12:00:00",
    url_proyecto: null, url_repositorio: null,
  }, ["React"]);
  assert.equal(datos.imagen, "https://example.com/foto.webp");
  assert.equal(datos.imagenExterna, datos.imagen);
  assert.equal(datos.ancho, null);
  assert.equal(datos.alto, null);
  assert.equal(Object.hasOwn(datos, "nombre_archivo"), false);
  assert.deepEqual(datos.tecnologias, ["React"]);
});
