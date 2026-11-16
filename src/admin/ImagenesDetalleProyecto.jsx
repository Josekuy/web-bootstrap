import { useEffect, useRef } from "react";
import { obtenerEnlaceWeb } from "../utils/enlaces";
import "../styles/project-gallery-admin.css";

const maximoImagenes = 8;
const formatosPermitidos = ["image/jpeg", "image/png", "image/webp"];
const tamanoMaximo = 8 * 1024 * 1024;

function MiniaturaDetalle({ imagen }) {
  const referenciaImagen = useRef(null);
  const enlace = obtenerEnlaceWeb(imagen.imagenExterna);
  const urlExterna = enlace?.startsWith("https://") && enlace.length <= 2048 ? enlace : null;
  const ruta = imagen.id ? imagen.imagen : urlExterna;

  useEffect(() => {
    if (!imagen.archivo || !referenciaImagen.current) return;
    const rutaTemporal = URL.createObjectURL(imagen.archivo);
    referenciaImagen.current.src = rutaTemporal;
    return () => URL.revokeObjectURL(rutaTemporal);
  }, [imagen.archivo]);

  return (imagen.archivo || ruta) && (
    <img ref={referenciaImagen} className="project-gallery-admin__preview"
      src={imagen.archivo ? undefined : ruta} alt="Vista previa de la imagen de detalle" />
  );
}

function ImagenesDetalleProyecto({ imagenes, alCambiar, alError }) {
  const referenciaFocoPendiente = useRef(null);

  useEffect(() => {
    const destino = referenciaFocoPendiente.current;
    referenciaFocoPendiente.current = null;
    if (destino) document.getElementById(destino)?.focus();
  }, [imagenes]);

  function anadirArchivos(evento) {
    const archivos = Array.from(evento.target.files || []);
    evento.target.value = "";
    if (!archivos.length) return;
    let mensaje = "";
    if (imagenes.length + archivos.length > maximoImagenes) {
      mensaje = "Puedes añadir como máximo 8 imágenes de detalle por proyecto.";
    } else if (archivos.some((archivo) => !formatosPermitidos.includes(archivo.type))) {
      mensaje = "Las imágenes de detalle deben ser JPEG, PNG o WebP.";
    } else if (archivos.some((archivo) => archivo.size > tamanoMaximo)) {
      mensaje = "Cada imagen de detalle debe ocupar como máximo 8 MB.";
    }
    alError(mensaje);
    if (mensaje) return;
    const nuevas = archivos.map((archivo) => ({
      clave: crypto.randomUUID(), archivo, imagenAlt: "",
    }));
    referenciaFocoPendiente.current = `detalle-alt-${nuevas[0].clave}`;
    alCambiar([...imagenes, ...nuevas]);
  }

  function anadirUrl() {
    if (imagenes.length >= maximoImagenes) return;
    const nueva = { clave: crypto.randomUUID(), imagenExterna: "", imagenAlt: "" };
    referenciaFocoPendiente.current = `detalle-url-${nueva.clave}`;
    alCambiar([...imagenes, nueva]);
  }

  function cambiarImagen(clave, campo, valor) {
    alCambiar(imagenes.map((imagen) => imagen.clave === clave ? { ...imagen, [campo]: valor } : imagen));
  }

  function moverImagen(posicion, desplazamiento) {
    const destino = posicion + desplazamiento;
    if (destino < 0 || destino >= imagenes.length) return;
    const ordenadas = [...imagenes];
    [ordenadas[posicion], ordenadas[destino]] = [ordenadas[destino], ordenadas[posicion]];
    // Al alcanzar un extremo, el control usado queda desactivado; se enfoca su opuesto.
    const accion = desplazamiento < 0 ? (destino === 0 ? "bajar" : "subir")
      : (destino === imagenes.length - 1 ? "subir" : "bajar");
    referenciaFocoPendiente.current = `detalle-${accion}-${imagenes[posicion].clave}`;
    alCambiar(ordenadas);
  }

  function quitarImagen(posicion) {
    const siguiente = imagenes[posicion + 1] || imagenes[posicion - 1];
    referenciaFocoPendiente.current = siguiente ? `detalle-quitar-${siguiente.clave}` : "proyecto-detalle-archivos";
    alCambiar(imagenes.filter((_imagen, indice) => indice !== posicion));
  }

  return (
    <fieldset className="project-gallery-admin mb-4" aria-describedby="proyecto-detalle-ayuda">
      <legend>Imágenes del detalle</legend>
      <p className="form-text" id="proyecto-detalle-ayuda">
        Añade los diseños planos u otras vistas que se mostrarán al pulsar el ojo.
        Se mostrarán completos y en este orden. La portada de la tarjeta se gestiona por separado.
      </p>
      <p className="form-text" role="status">
        {imagenes.length ? `${imagenes.length} de ${maximoImagenes} imágenes de detalle.` : "Sin imágenes de detalle: la ficha mostrará la portada."}
      </p>
      <div className="mb-3">
        <label className="form-label" htmlFor="proyecto-detalle-archivos">Añadir imágenes de detalle</label>
        <input className="form-control" type="file" id="proyecto-detalle-archivos" multiple
          accept="image/jpeg,image/png,image/webp" onChange={anadirArchivos}
          disabled={imagenes.length >= maximoImagenes} aria-describedby="proyecto-detalle-archivos-ayuda" />
        <p className="form-text" id="proyecto-detalle-archivos-ayuda">
          Puedes seleccionar varios archivos. JPEG, PNG o WebP, hasta 8 MB por imagen; máximo 8 imágenes.
        </p>
        <button className="btn btn-outline-secondary btn-sm" type="button" onClick={anadirUrl}
          disabled={imagenes.length >= maximoImagenes}>Añadir mediante URL HTTPS</button>
      </div>
      <ol className="project-gallery-admin__list">
        {imagenes.map((imagen, posicion) => (
          <li className="project-gallery-admin__item" key={imagen.clave}>
            <p className="mb-2"><strong>Imagen {posicion + 1}</strong>{imagen.archivo ? ` · ${imagen.archivo.name}` : ""}</p>
            {!imagen.id && !imagen.archivo && (
              <div className="mb-3">
                <label className="form-label" htmlFor={`detalle-url-${imagen.clave}`}>URL HTTPS de la imagen {posicion + 1} *</label>
                <input className="form-control" type="url" id={`detalle-url-${imagen.clave}`} required maxLength={2048}
                  value={imagen.imagenExterna} onChange={(evento) => cambiarImagen(imagen.clave, "imagenExterna", evento.target.value)}
                  aria-describedby="proyecto-detalle-url-ayuda" />
              </div>
            )}
            <MiniaturaDetalle imagen={imagen} />
            <div className="mb-3">
              <label className="form-label" htmlFor={`detalle-alt-${imagen.clave}`}>Texto alternativo de la imagen {posicion + 1}</label>
              <input className="form-control" id={`detalle-alt-${imagen.clave}`} maxLength={300} value={imagen.imagenAlt}
                onChange={(evento) => cambiarImagen(imagen.clave, "imagenAlt", evento.target.value)}
                aria-describedby="proyecto-detalle-alt-ayuda" />
            </div>
            <div className="project-gallery-admin__actions">
              <button type="button" id={`detalle-subir-${imagen.clave}`} className="btn btn-outline-secondary btn-sm" disabled={posicion === 0}
                onClick={() => moverImagen(posicion, -1)} aria-label={`Subir imagen ${posicion + 1} en el orden`}>Subir</button>
              <button type="button" id={`detalle-bajar-${imagen.clave}`} className="btn btn-outline-secondary btn-sm" disabled={posicion === imagenes.length - 1}
                onClick={() => moverImagen(posicion, 1)} aria-label={`Bajar imagen ${posicion + 1} en el orden`}>Bajar</button>
              <button type="button" id={`detalle-quitar-${imagen.clave}`} className="btn btn-outline-danger btn-sm"
                onClick={() => quitarImagen(posicion)}
                aria-label={`Quitar imagen ${posicion + 1} del detalle`}>Quitar</button>
            </div>
          </li>
        ))}
      </ol>
      {imagenes.length > 0 && (
        <p className="form-text" id="proyecto-detalle-alt-ayuda">Describe cada vista; deja el texto vacío solo si la imagen es decorativa.</p>
      )}
      {imagenes.some((imagen) => !imagen.id && !imagen.archivo) && (
        <p className="form-text" id="proyecto-detalle-url-ayuda">
          Las URL deben usar HTTPS y no incluir credenciales. Una imagen externa depende de su servidor y su URL puede seguir siendo pública aunque el proyecto sea un borrador.
        </p>
      )}
    </fieldset>
  );
}

export default ImagenesDetalleProyecto;
