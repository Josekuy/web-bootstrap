import assert from "node:assert/strict";
import test from "node:test";
import { ErrorAplicacion } from "../../errores.js";
import { crearRutasImagenes } from "../imagenes/imagenes.js";
import { convertirProyecto, crearProyecto } from "./repositorio.js";
import {
  validarArchivosDetalle, validarEleccionImagen, validarIdProyecto, validarMetadatosProyecto, validarPaginacionProyectos,
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
  assert.equal(datos.resumen, "");
  assert.equal(datos.urlProyecto, null);
  assert.equal(datos.urlRepositorio, null);
  assert.deepEqual(datos.imagenesDetalle, []);
  assert.deepEqual(validarMetadatosProyecto({ tecnologias: ["CSS"] }, { parcial: true }), { tecnologias: ["CSS"] });
  assert.deepEqual(validarMetadatosProyecto({ urlProyecto: " " }, { parcial: true }), { urlProyecto: null });
});

test("el resumen es opcional, independiente y admite hasta 300 caracteres Unicode", () => {
  const datos = validarMetadatosProyecto(datosIniciales({ resumen: " Resumen de la tarjeta ", descripcion: "Descripción completa\ncon más información." }));
  assert.equal(datos.resumen, "Resumen de la tarjeta");
  assert.equal(datos.descripcion, "Descripción completa\ncon más información.");
  assert.equal(validarMetadatosProyecto(datosIniciales({ resumen: "😀".repeat(300) })).resumen.length, 600);
  assert.equal(validarMetadatosProyecto(datosIniciales({ descripcion: "😀".repeat(5000) })).descripcion.length, 10000);
  assert.deepEqual(validarMetadatosProyecto({ resumen: "" }, { parcial: true }), { resumen: "" });
  assert.deepEqual(validarMetadatosProyecto({ resumen: "  " }, { parcial: true }), { resumen: "" });
  assert.deepEqual(validarMetadatosProyecto({ resumen: " Una línea\ncon\t  más texto " }, { parcial: true }), { resumen: "Una línea con más texto" });
  assert.deepEqual(validarMetadatosProyecto({ descripcion: "Solo descripción" }, { parcial: true }), { descripcion: "Solo descripción" });
  for (const resumen of ["a".repeat(301), "😀".repeat(301), null, 7, [], ["repetido", "duplicado"], {}, "Resumen\u0000oculto", "Resumen\u007foculto"]) {
    assert.throws(() => validarMetadatosProyecto(datosIniciales({ resumen })), esErrorDatos);
  }
});

test("los saltos CRLF de multipart se guardan como LF y cuentan como un carácter", () => {
  const datos = validarMetadatosProyecto(datosIniciales({
    resumen: "Resumen\r\nen una línea",
    descripcion: "Primer párrafo\r\n\r\nSegundo párrafo",
  }), { multipart: true });
  assert.equal(datos.resumen, "Resumen en una línea");
  assert.equal(datos.descripcion, "Primer párrafo\n\nSegundo párrafo");
  const limite = validarMetadatosProyecto({
    resumen: "a".repeat(298) + "\r\nb",
    descripcion: "a".repeat(4998) + "\r\nb",
  }, { parcial: true, multipart: true });
  assert.equal(limite.resumen, "a".repeat(298) + " b");
  assert.equal(limite.descripcion, "a".repeat(4998) + "\nb");
  assert.equal([...limite.descripcion].length, 5000);
});

test("la galería de detalle acepta archivos, URL HTTPS e imágenes existentes solo al editar", () => {
  const entradas = [{ archivo: 0, imagenAlt: " Pantalla principal " }, { imagenExterna: "https://example.com/detalle.webp" }];
  const datos = validarMetadatosProyecto(datosIniciales({ imagenesDetalle: JSON.stringify(entradas) }), { multipart: true });
  assert.deepEqual(datos.imagenesDetalle, [
    { archivo: 0, imagenAlt: "Pantalla principal" }, { imagenExterna: "https://example.com/detalle.webp", imagenAlt: "" },
  ]);
  assert.deepEqual(validarMetadatosProyecto({ imagenesDetalle: [{ id: 4, imagenAlt: "Detalle" }] }, { parcial: true }), {
    imagenesDetalle: [{ id: 4, imagenAlt: "Detalle" }],
  });
  assert.deepEqual(validarMetadatosProyecto({ imagenesDetalle: [] }, { parcial: true }), { imagenesDetalle: [] });
  assert.deepEqual(validarMetadatosProyecto({ titulo: "Solo texto" }, { parcial: true }), { titulo: "Solo texto" });
  assert.throws(() => validarMetadatosProyecto(datosIniciales({ imagenesDetalle: [{ id: 4 }] })), esErrorDatos);
});

test("la galería rechaza más de ocho imágenes, fuentes ambiguas, duplicados y datos inseguros", () => {
  for (const imagenesDetalle of [
    Array.from({ length: 9 }, () => ({ imagenExterna: "https://example.com/foto.webp" })),
    [{ id: 1 }, { id: "1" }], [{ archivo: 0 }, { archivo: 0 }], [{ archivo: 8 }], [{ archivo: -1 }],
    [{ archivo: 0, imagenExterna: "https://example.com/foto.webp" }], [{ id: 1, archivo: 0 }],
    [{ imagenExterna: "http://example.com/foto.webp" }], [{ imagenExterna: "https://user:pass@example.com/foto.webp" }],
    [{ imagenExterna: "javascript:alert(1)" }], [{ imagenExterna: null }],
    [{ archivo: 0, imagenAlt: "a".repeat(301) }], [{ archivo: 0, imagenAlt: "oculto\u0000" }],
    [{ archivo: 0, nombre_archivo: "ajeno.webp" }], [null], [[]], [{}], "JSON incorrecto", {},
  ]) {
    assert.throws(() => validarMetadatosProyecto({ imagenesDetalle }, { parcial: true }), esErrorDatos);
  }
  assert.throws(() => validarMetadatosProyecto({ imagenesDetalle: ["[]", "[]"] }, { parcial: true, multipart: true }), esErrorDatos);
});

test("cada archivo de detalle debe estar referenciado y los índices pueden cambiar el orden", () => {
  assert.doesNotThrow(() => validarArchivosDetalle({ imagenesDetalle: [{ archivo: 1 }, { archivo: 0 }] }, [{}, {}]));
  assert.doesNotThrow(() => validarArchivosDetalle({}));
  for (const [datos, archivos] of [
    [{}, [{}]], [{ imagenesDetalle: [] }, [{}]], [{ imagenesDetalle: [{ archivo: 0 }] }, []],
    [{ imagenesDetalle: [{ archivo: 1 }] }, [{}]],
  ]) assert.throws(() => validarArchivosDetalle(datos, archivos), esErrorDatos);
});

test("un commit de resultado incierto conserva las subidas para evitar eliminar imágenes referenciadas", async () => {
  const operaciones = [];
  const conexion = {
    beginTransaction: async () => operaciones.push("inicio"),
    execute: async (sql) => {
      if (sql.startsWith("INSERT INTO proyectos")) return [{ insertId: 1 }];
      if (sql.startsWith("SELECT id, slug")) return [[{ id: 1, orden: 0 }]];
      return [[]];
    },
    commit: async () => { operaciones.push("commit"); throw new Error("Conexión perdida al confirmar"); },
    rollback: async () => operaciones.push("rollback"),
    release: () => operaciones.push("liberada"),
  };
  await assert.rejects(
    crearProyecto({ getConnection: async () => conexion }, validarMetadatosProyecto(datosIniciales()), null),
    (error) => error.codigo === "GUARDADO_NO_CONFIRMADO" && error.conservarArchivo === true,
  );
  assert.deepEqual(operaciones, ["inicio", "commit", "rollback", "liberada"]);
});

test("un rollback sin confirmar también conserva todas las subidas y libera la conexión", async () => {
  let liberada = false;
  const conexion = {
    beginTransaction: async () => {},
    execute: async () => { throw new Error("Fallo de escritura"); },
    rollback: async () => { throw new Error("Fallo al restaurar"); },
    release: () => { liberada = true; },
  };
  await assert.rejects(
    crearProyecto({ getConnection: async () => conexion }, validarMetadatosProyecto(datosIniciales()), null),
    (error) => error.codigo === "GUARDADO_NO_CONFIRMADO" && error.conservarArchivo === true,
  );
  assert.equal(liberada, true);
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
  assert.deepEqual(datos.imagenesDetalle, []);
  assert.equal(datos.resumen, "", "el DTO no genera un extracto cuando el resumen está vacío");
});
