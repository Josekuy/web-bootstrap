import { crearRepositorioGaleria } from "../galerias/repositorio.js";

const repositorio = crearRepositorioGaleria("ilustraciones");

export const convertirIlustracion = repositorio.convertir;
export const listarIlustraciones = repositorio.listar;
export const crearIlustracion = repositorio.crear;
export const borrarIlustracion = repositorio.borrar;

export async function editarIlustracion(pool, id, datos, imagen) {
  const { registro, archivoAnterior } = await repositorio.editar(pool, id, datos, imagen);
  return { ilustracion: registro, archivoAnterior };
}
