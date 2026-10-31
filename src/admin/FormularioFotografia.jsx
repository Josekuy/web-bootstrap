import { useEffect, useRef, useState } from "react";

const formatosPermitidos = ["image/jpeg", "image/png", "image/webp"];
const tamanoMaximo = 8 * 1024 * 1024;

function FormularioFotografia({ fotografia, ocupado, guardando, alGuardar, alCancelar, enfocarAlMontar = false }) {
  const [campos, establecerCampos] = useState(() => ({
    titulo: fotografia?.titulo || "",
    descripcion: fotografia?.descripcion || "",
    imagenAlt: fotografia?.imagenAlt || "",
    orden: String(fotografia?.orden ?? 0),
    estado: fotografia?.estado || "borrador",
  }));
  const [archivo, establecerArchivo] = useState(null);
  const [errorArchivo, establecerErrorArchivo] = useState("");
  const referenciaTitulo = useRef(null);
  const referenciaError = useRef(null);
  const referenciaMiniatura = useRef(null);

  useEffect(() => {
    if (enfocarAlMontar) referenciaTitulo.current?.focus();
  }, [enfocarAlMontar]);

  useEffect(() => {
    if (errorArchivo) referenciaError.current?.focus();
  }, [errorArchivo]);

  useEffect(() => {
    if (!archivo || !referenciaMiniatura.current) return;
    const rutaTemporal = URL.createObjectURL(archivo);
    // La URL solo existe en este navegador; nunca se envía como ruta al servidor.
    referenciaMiniatura.current.src = rutaTemporal;
    return () => URL.revokeObjectURL(rutaTemporal);
  }, [archivo]);

  function cambiarCampo(evento) {
    const { name: nombre, value: valor } = evento.target;
    establecerCampos((anteriores) => ({ ...anteriores, [nombre]: valor }));
  }

  function seleccionarArchivo(evento) {
    const seleccionado = evento.target.files?.[0] || null;
    let mensaje = "";
    if (seleccionado && !formatosPermitidos.includes(seleccionado.type)) {
      mensaje = "Selecciona una imagen JPEG, PNG o WebP.";
    } else if (seleccionado && seleccionado.size > tamanoMaximo) {
      mensaje = "La imagen supera el límite de 8 MB. Selecciona un archivo más pequeño.";
    }
    establecerErrorArchivo(mensaje);
    establecerArchivo(mensaje ? null : seleccionado);
    if (mensaje) evento.target.value = "";
  }

  async function enviarFotografia(evento) {
    evento.preventDefault();
    if (ocupado) return;
    if (!fotografia && !archivo) {
      establecerErrorArchivo("Selecciona la imagen de la nueva fotografía.");
      return;
    }

    // Metadatos e imagen viajan juntos; el navegador completa Content-Type y boundary.
    const formulario = new FormData();
    Object.entries(campos).forEach(([nombre, valor]) => formulario.append(nombre, valor));
    if (archivo) formulario.append("imagen", archivo);
    await alGuardar(formulario);
  }

  return (
    <section className="admin__bloque" aria-labelledby="editor-fotografia-titulo">
      <h2 id="editor-fotografia-titulo">{fotografia ? "Editar fotografía" : "Nueva fotografía"}</h2>
      <p className="admin__texto">Los campos marcados con * son obligatorios.</p>
      {errorArchivo && <p ref={referenciaError} className="alert alert-danger" role="alert" tabIndex={-1}>{errorArchivo}</p>}
      <form onSubmit={enviarFotografia}>
        <fieldset disabled={ocupado}>
          <legend className="visually-hidden">Contenido de la fotografía</legend>
          <div className="mb-3">
            <label className="form-label" htmlFor="foto-titulo">Título *</label>
            <input ref={referenciaTitulo} className="form-control" id="foto-titulo" name="titulo"
              value={campos.titulo} onChange={cambiarCampo} maxLength={160} required />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="foto-descripcion">Descripción</label>
            <textarea className="form-control" id="foto-descripcion" name="descripcion" rows={4}
              value={campos.descripcion} onChange={cambiarCampo} maxLength={5000} />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="foto-alternativo">Texto alternativo *</label>
            <input className="form-control" id="foto-alternativo" name="imagenAlt" value={campos.imagenAlt}
              onChange={cambiarCampo} maxLength={300} aria-describedby="foto-alternativo-ayuda" required />
            <p className="form-text" id="foto-alternativo-ayuda">Describe brevemente qué aparece en la imagen para quien no pueda verla.</p>
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="foto-imagen">{fotografia ? "Reemplazar imagen" : "Imagen *"}</label>
            <input className="form-control" id="foto-imagen" name="imagen" type="file"
              accept="image/jpeg,image/png,image/webp" onChange={seleccionarArchivo}
              aria-describedby="foto-imagen-ayuda" aria-invalid={Boolean(errorArchivo)} required={!fotografia} />
            <p className="form-text" id="foto-imagen-ayuda">
              JPEG, PNG o WebP de hasta 8 MB.{fotografia ? " Si no eliges otra imagen, se conserva la actual." : ""}
            </p>
          </div>
          {(archivo || fotografia?.imagen) && (
            <figure className="admin__vista-previa">
              <img ref={referenciaMiniatura} src={archivo ? undefined : fotografia.imagen}
                alt="Vista previa de la fotografía" />
              <figcaption>{archivo ? archivo.name : "Imagen actual"}</figcaption>
            </figure>
          )}
          <div className="row g-3 mb-4">
            <div className="col-sm-5">
              <label className="form-label" htmlFor="foto-orden">Orden *</label>
              <input className="form-control" id="foto-orden" name="orden" type="number" min={0}
                max={2147483647} step={1} value={campos.orden} onChange={cambiarCampo} required />
            </div>
            <div className="col-sm-7">
              <label className="form-label" htmlFor="foto-estado">Visibilidad</label>
              <select className="form-select" id="foto-estado" name="estado" value={campos.estado} onChange={cambiarCampo}>
                <option value="borrador">Borrador: solo en el panel</option>
                <option value="publicado">Publicado: visible en el portfolio</option>
              </select>
            </div>
          </div>
          <div className="admin__acciones">
            <button type="submit" className="btn btn-primary">
              {guardando ? "Guardando…" : campos.estado === "publicado" ? "Guardar y publicar" : "Guardar borrador"}
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={alCancelar}>
              {fotografia ? "Cancelar edición" : "Limpiar formulario"}
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

export default FormularioFotografia;
