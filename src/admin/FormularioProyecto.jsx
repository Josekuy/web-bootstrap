import { useEffect, useRef, useState } from "react";
import { obtenerEnlaceWeb } from "../utils/enlaces";

const formatosPermitidos = ["image/jpeg", "image/png", "image/webp"];
const tamanoMaximo = 8 * 1024 * 1024;

function FormularioProyecto({ proyecto, activo, ocupado, guardando, alGuardar, alCancelar, enfocarAlMontar = false }) {
  const [campos, establecerCampos] = useState(() => ({
    titulo: proyecto?.titulo || "",
    slug: proyecto?.slug || "",
    descripcion: proyecto?.descripcion || "",
    categoria: proyecto?.categoria || "",
    tecnologias: proyecto?.tecnologias.join(", ") || "",
    imagenExterna: proyecto?.imagenExterna || "",
    imagenAlt: proyecto?.imagenAlt || "",
    orden: String(proyecto?.orden ?? 0),
    estado: proyecto?.estado || "borrador",
    urlProyecto: proyecto?.urlProyecto || "",
    urlRepositorio: proyecto?.urlRepositorio || "",
  }));
  const [fuenteImagen, establecerFuenteImagen] = useState(proyecto ? "actual" : "archivo");
  const [archivo, establecerArchivo] = useState(null);
  const [errorLocal, establecerErrorLocal] = useState("");
  const referenciaTitulo = useRef(null);
  const referenciaError = useRef(null);
  const referenciaMiniatura = useRef(null);
  const enlaceImagen = obtenerEnlaceWeb(campos.imagenExterna);
  const imagenUrlValida = enlaceImagen?.startsWith("https://") && enlaceImagen.length <= 2048 ? enlaceImagen : null;
  const imagenPrevia = fuenteImagen === "actual" ? proyecto?.imagen : fuenteImagen === "url" ? imagenUrlValida : null;

  useEffect(() => {
    if (activo && enfocarAlMontar) referenciaTitulo.current?.focus();
  }, [activo, enfocarAlMontar]);

  useEffect(() => {
    if (activo && errorLocal) referenciaError.current?.focus();
  }, [activo, errorLocal]);

  useEffect(() => {
    if (fuenteImagen !== "archivo" || !archivo || !referenciaMiniatura.current) return;
    const rutaTemporal = URL.createObjectURL(archivo);
    referenciaMiniatura.current.src = rutaTemporal;
    // Cambiar de archivo, fuente o formulario libera la miniatura anterior.
    return () => URL.revokeObjectURL(rutaTemporal);
  }, [archivo, fuenteImagen]);

  function cambiarCampo(evento) {
    const { name: nombre, value: valor } = evento.target;
    establecerCampos((anteriores) => ({ ...anteriores, [nombre]: valor }));
  }

  function cambiarFuente(evento) {
    establecerFuenteImagen(evento.target.value);
    establecerArchivo(null);
    establecerErrorLocal("");
  }

  function seleccionarArchivo(evento) {
    const seleccionado = evento.target.files?.[0] || null;
    let mensaje = "";
    if (seleccionado && !formatosPermitidos.includes(seleccionado.type)) {
      mensaje = "Selecciona una imagen JPEG, PNG o WebP.";
    } else if (seleccionado && seleccionado.size > tamanoMaximo) {
      mensaje = "La imagen supera el límite de 8 MB. Selecciona un archivo más pequeño.";
    }
    establecerErrorLocal(mensaje);
    establecerArchivo(mensaje ? null : seleccionado);
    if (mensaje) evento.target.value = "";
  }

  async function enviarProyecto(evento) {
    evento.preventDefault();
    if (!activo || ocupado) return;
    const tecnologias = campos.tecnologias.split(",").map((tecnologia) => tecnologia.trim().normalize("NFC")).filter(Boolean);
    const tecnologiasUnicas = new Set(tecnologias.map((tecnologia) => tecnologia.toLocaleLowerCase("es")));
    let mensaje = "";
    if (tecnologias.length > 20 || tecnologias.some((tecnologia) => [...tecnologia].length > 60)) {
      mensaje = "Introduce como máximo 20 tecnologías de hasta 60 caracteres cada una.";
    } else if (tecnologiasUnicas.size !== tecnologias.length) {
      mensaje = "No repitas tecnologías, aunque cambies sus mayúsculas y minúsculas.";
    } else if (!/^\d+$/u.test(campos.orden) || Number(campos.orden) > 4294967295) {
      mensaje = "El orden debe ser un entero entre 0 y 4294967295.";
    } else if ([campos.urlProyecto, campos.urlRepositorio].some((enlace) => {
      const normalizado = obtenerEnlaceWeb(enlace.trim());
      return enlace.trim() && (!normalizado || normalizado.length > 2048);
    })) {
      mensaje = "Los enlaces del proyecto y del repositorio deben usar HTTP o HTTPS y no incluir credenciales.";
    } else if (fuenteImagen === "archivo" && !archivo) {
      mensaje = "Selecciona la imagen del proyecto.";
    } else if (fuenteImagen === "url" && !imagenUrlValida) {
      mensaje = "La imagen externa debe tener una URL HTTPS válida y sin credenciales.";
    }
    establecerErrorLocal(mensaje);
    if (mensaje) return;

    // Todos los metadatos viajan juntos. La imagen actual solo cambia si se elige otra fuente.
    const formulario = new FormData();
    const metadatos = {
      titulo: campos.titulo,
      slug: campos.slug,
      descripcion: campos.descripcion,
      categoria: campos.categoria,
      tecnologias: JSON.stringify(tecnologias),
      imagenAlt: campos.imagenAlt,
      orden: campos.orden,
      estado: campos.estado,
      urlProyecto: campos.urlProyecto.trim(),
      urlRepositorio: campos.urlRepositorio.trim(),
    };
    Object.entries(metadatos).forEach(([nombre, valor]) => formulario.append(nombre, valor));
    if (fuenteImagen === "archivo") formulario.append("imagen", archivo);
    if (fuenteImagen === "url") formulario.append("imagenExterna", campos.imagenExterna.trim());
    await alGuardar(formulario);
  }

  return (
    <section className="admin__bloque" aria-labelledby="editor-proyecto-titulo">
      <h2 id="editor-proyecto-titulo">{proyecto ? "Editar proyecto" : "Nuevo proyecto"}</h2>
      <p className="admin__texto">Los campos marcados con * son obligatorios.</p>
      {errorLocal && <p ref={referenciaError} className="alert alert-danger" role="alert" tabIndex={-1}>{errorLocal}</p>}
      <form onSubmit={enviarProyecto}>
        <fieldset disabled={ocupado || !activo}>
          <legend className="visually-hidden">Contenido del proyecto</legend>
          <div className="mb-3">
            <label className="form-label" htmlFor="proyecto-titulo">Título *</label>
            <input ref={referenciaTitulo} className="form-control" id="proyecto-titulo" name="titulo"
              value={campos.titulo} onChange={cambiarCampo} maxLength={160} required />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="proyecto-slug">Slug *</label>
            <input className="form-control" id="proyecto-slug" name="slug" value={campos.slug} onChange={cambiarCampo}
              maxLength={160} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required aria-describedby="proyecto-slug-ayuda"
              autoCapitalize="none" spellCheck={false} />
            <p className="form-text" id="proyecto-slug-ayuda">Identificador único con minúsculas, números y guiones: por ejemplo, rediseno-campus.</p>
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="proyecto-descripcion">Descripción</label>
            <textarea className="form-control" id="proyecto-descripcion" name="descripcion" rows={4}
              maxLength={5000} value={campos.descripcion} onChange={cambiarCampo} />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="proyecto-categoria">Categoría *</label>
            <input className="form-control" id="proyecto-categoria" name="categoria" value={campos.categoria}
              maxLength={120} onChange={cambiarCampo} required />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="proyecto-tecnologias">Tecnologías</label>
            <input className="form-control" id="proyecto-tecnologias" name="tecnologias" value={campos.tecnologias}
              onChange={cambiarCampo} aria-describedby="proyecto-tecnologias-ayuda" />
            <p className="form-text" id="proyecto-tecnologias-ayuda">Separa los nombres con comas, sin repetirlos. Máximo 20, de hasta 60 caracteres cada uno.</p>
          </div>
          <fieldset className="admin__fuente-imagen mb-3">
            <legend>Imagen del proyecto</legend>
            {proyecto && (
              <div className="form-check">
                <input className="form-check-input" type="radio" name="fuenteImagen" id="proyecto-fuente-actual"
                  value="actual" checked={fuenteImagen === "actual"} onChange={cambiarFuente} />
                <label className="form-check-label" htmlFor="proyecto-fuente-actual">Conservar imagen actual</label>
              </div>
            )}
            <div className="form-check">
              <input className="form-check-input" type="radio" name="fuenteImagen" id="proyecto-fuente-archivo"
                value="archivo" checked={fuenteImagen === "archivo"} onChange={cambiarFuente} />
              <label className="form-check-label" htmlFor="proyecto-fuente-archivo">Subir un archivo (recomendado)</label>
            </div>
            <div className="form-check">
              <input className="form-check-input" type="radio" name="fuenteImagen" id="proyecto-fuente-url"
                value="url" checked={fuenteImagen === "url"} onChange={cambiarFuente} />
              <label className="form-check-label" htmlFor="proyecto-fuente-url">Usar una URL HTTPS</label>
            </div>
          </fieldset>
          {fuenteImagen === "archivo" && (
            <div className="mb-3">
              <label className="form-label" htmlFor="proyecto-imagen">Archivo de imagen *</label>
              <input className="form-control" id="proyecto-imagen" name="imagen" type="file" required
                accept="image/jpeg,image/png,image/webp" onChange={seleccionarArchivo} aria-describedby="proyecto-imagen-ayuda" />
              <p className="form-text" id="proyecto-imagen-ayuda">JPEG, PNG o WebP de hasta 8 MB. El servidor comprobará el contenido de la imagen.</p>
            </div>
          )}
          {fuenteImagen === "url" && (
            <div className="mb-3">
              <label className="form-label" htmlFor="proyecto-imagen-url">URL de la imagen *</label>
              <input className="form-control" id="proyecto-imagen-url" name="imagenExterna" type="url" required
                maxLength={2048} value={campos.imagenExterna} onChange={cambiarCampo} aria-describedby="proyecto-imagen-url-ayuda" />
              <p className="form-text" id="proyecto-imagen-url-ayuda">Debe usar HTTPS y no incluir credenciales. La imagen dependerá del servidor externo; su URL puede seguir siendo pública aunque el proyecto sea un borrador.</p>
            </div>
          )}
          {(archivo || imagenPrevia) && (
            <figure className="admin__vista-previa">
              <img ref={referenciaMiniatura} src={archivo ? undefined : imagenPrevia} alt="Vista previa de la imagen del proyecto" />
              <figcaption>{archivo ? archivo.name : fuenteImagen === "actual" ? "Imagen actual" : "Imagen externa"}</figcaption>
            </figure>
          )}
          <div className="mb-3">
            <label className="form-label" htmlFor="proyecto-imagen-alt">Texto alternativo de la imagen</label>
            <input className="form-control" id="proyecto-imagen-alt" name="imagenAlt" value={campos.imagenAlt}
              maxLength={300} onChange={cambiarCampo} aria-describedby="proyecto-imagen-alt-ayuda" />
            <p className="form-text" id="proyecto-imagen-alt-ayuda">Describe su contenido. Déjalo vacío únicamente si la imagen es decorativa.</p>
          </div>
          <div className="row g-3 mb-3">
            <div className="col-sm-5">
              <label className="form-label" htmlFor="proyecto-orden">Orden *</label>
              <input className="form-control" id="proyecto-orden" name="orden" type="number" required min={0} max={4294967295}
                step={1} value={campos.orden} onChange={cambiarCampo} />
            </div>
            <div className="col-sm-7">
              <label className="form-label" htmlFor="proyecto-estado">Visibilidad</label>
              <select className="form-select" id="proyecto-estado" name="estado" value={campos.estado} onChange={cambiarCampo}>
                <option value="borrador">Borrador: solo en el panel</option>
                <option value="publicado">Publicado: visible en el portfolio</option>
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="proyecto-url">URL del proyecto</label>
            <input className="form-control" id="proyecto-url" name="urlProyecto" type="url" value={campos.urlProyecto}
              maxLength={2048} onChange={cambiarCampo} aria-describedby="proyecto-enlaces-ayuda" />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="proyecto-repositorio">URL del repositorio</label>
            <input className="form-control" id="proyecto-repositorio" name="urlRepositorio" type="url" value={campos.urlRepositorio}
              maxLength={2048} onChange={cambiarCampo} aria-describedby="proyecto-enlaces-ayuda" />
            <p className="form-text" id="proyecto-enlaces-ayuda">Enlaces opcionales HTTP o HTTPS, sin usuario ni contraseña.</p>
          </div>
          <div className="admin__acciones">
            <button type="submit" className="btn btn-primary">{guardando ? "Guardando…" : campos.estado === "publicado" ? "Guardar y publicar" : "Guardar borrador"}</button>
            <button type="button" className="btn btn-outline-secondary" onClick={alCancelar}>{proyecto ? "Cancelar edición" : "Limpiar formulario"}</button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

export default FormularioProyecto;
