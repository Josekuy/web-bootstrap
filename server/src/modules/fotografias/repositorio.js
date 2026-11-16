import { crearRepositorioGaleria } from "../galerias/repositorio.js";

const repositorio = crearRepositorioGaleria("fotografias");

// Se mantienen las firmas públicas para los consumidores y pruebas existentes.
export const convertirFotografia = repositorio.convertir;
export const listarFotografias = repositorio.listar;
export const crearFotografia = repositorio.crear;
export const borrarFotografia = repositorio.borrar;

export async function editarFotografia(pool, id, datos, imagen) {
  const { registro, archivoAnterior } = await repositorio.editar(pool, id, datos, imagen);
  return { fotografia: registro, archivoAnterior };
}
