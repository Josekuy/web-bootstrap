import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y, Keyboard } from "swiper/modules";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faArrowRight, faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import { useIlustraciones } from "../hooks/useIlustraciones";
import { useMovimientoReducido } from "../hooks/useMovimientoReducido";
import "swiper/css";
import "swiper/css/a11y";
import "../styles/illustration.css";

const modulosCarrusel = [A11y, Keyboard];
const opcionesTeclado = { enabled: false, onlyInViewport: false, pageUpDown: false };
const opcionesAccesibilidad = {
  containerRoleDescriptionMessage: "carrusel de ilustraciones",
  itemRoleDescriptionMessage: "ilustración",
  slideLabelMessage: "{{index}} de {{slidesLength}}",
  // El contador propio anuncia la posición sin duplicar regiones vivas.
  wrapperLiveRegion: false,
};

/** La API es el origen habitual. Una colección explícita permite reutilizar y probar la vista sin red.
 * @param {{ilustraciones?: import("../data/ilustraciones").Ilustracion[]}} propiedades
 */
function Ilustracion({ ilustraciones }) {
  const consulta = useIlustraciones({ activa: ilustraciones === undefined });
  const movimientoReducido = useMovimientoReducido();
  const identificador = useId();
  const identificadorCarrusel = "galeria-ilustraciones-" + identificador.replace(/:/gu, "");
  const identificadorAyuda = identificadorCarrusel + "-ayuda";
  const referenciaCarrusel = useRef(null);
  const referenciaGaleria = useRef(null);
  const [navegacion, establecerNavegacion] = useState({ indice: 0, inicio: true, fin: true, bloqueado: true });
  const usaApi = ilustraciones === undefined;
  const coleccion = usaApi ? consulta.ilustraciones : ilustraciones;
  // filter crea un nuevo array: el orden de los datos originales no se modifica.
  const ilustracionesPublicadas = coleccion
    .filter((ilustracion) => ilustracion.estado === "publicado")
    .sort((primera, segunda) => primera.orden - segunda.orden || primera.id - segunda.id);
  const cantidad = ilustracionesPublicadas.length;
  const posicionActual = Math.min(navegacion.indice + 1, cantidad);
  const puntosDeCambio = useMemo(() => ({
    768: { slidesPerView: Math.min(Math.max(cantidad, 1), 1.6), spaceBetween: 24 },
    1200: { slidesPerView: Math.min(Math.max(cantidad, 1), 2.15), spaceBetween: 28 },
  }), [cantidad]);

  const actualizarNavegacion = useCallback((instancia) => {
    if (!instancia || instancia.destroyed) return;
    const siguiente = {
      indice: instancia.activeIndex || 0,
      inicio: Boolean(instancia.isBeginning),
      fin: Boolean(instancia.isEnd),
      bloqueado: Boolean(instancia.isLocked),
    };
    // Swiper puede emitir varios eventos por cambio: solo renderizamos si hay diferencias.
    establecerNavegacion((anterior) => (
      anterior.indice === siguiente.indice && anterior.inicio === siguiente.inicio
      && anterior.fin === siguiente.fin && anterior.bloqueado === siguiente.bloqueado
        ? anterior : siguiente
    ));
  }, []);

  useEffect(() => {
    // Un botón que se deshabilita puede perder el foco sin emitir blur en algunos navegadores.
    function comprobarFoco() {
      const instancia = referenciaCarrusel.current;
      if (instancia && !instancia.destroyed && !referenciaGaleria.current?.contains(document.activeElement)) {
        instancia.keyboard.disable();
      }
    }
    document.addEventListener("keydown", comprobarFoco, true);
    return () => document.removeEventListener("keydown", comprobarFoco, true);
  }, []);

  function registrarCarrusel(instancia) {
    referenciaCarrusel.current = instancia;
    actualizarNavegacion(instancia);
    if (referenciaGaleria.current?.contains(document.activeElement)) instancia.keyboard.enable();
  }

  function liberarCarrusel(instancia) {
    if (referenciaCarrusel.current === instancia) referenciaCarrusel.current = null;
  }

  // Las flechas del teclado solo pertenecen a la galería mientras el foco esté dentro.
  function habilitarTeclado() {
    const instancia = referenciaCarrusel.current;
    if (instancia && !instancia.destroyed) instancia.keyboard.enable();
  }

  function deshabilitarTeclado(evento) {
    if (evento.relatedTarget instanceof Node && evento.currentTarget.contains(evento.relatedTarget)) return;
    const instancia = referenciaCarrusel.current;
    if (instancia && !instancia.destroyed) instancia.keyboard.disable();
  }

  function mostrarAnterior() {
    const instancia = referenciaCarrusel.current;
    if (instancia && !instancia.destroyed) instancia.slidePrev();
  }

  function mostrarSiguiente() {
    const instancia = referenciaCarrusel.current;
    if (instancia && !instancia.destroyed) instancia.slideNext();
  }

  return (
    <section className="content-section illustration" id="ilustracion" aria-labelledby="ilustracion-titulo">
      <div className="container">
        <div className="illustration__header">
          <div className="illustration__heading">
            <p className="content-section__eyebrow">Ilustración</p>
            <h2 className="content-section__title" id="ilustracion-titulo">Ideas hechas imagen</h2>
          </div>
          <p className="illustration__intro">Una selección de ilustraciones para recorrer a tu ritmo.</p>
        </div>

        {cantidad > 0 ? (
          <div ref={referenciaGaleria} className="illustration__gallery"
            onFocusCapture={habilitarTeclado} onBlurCapture={deshabilitarTeclado}>
            <p className="visually-hidden" id={identificadorAyuda}>
              Usa las flechas izquierda y derecha para recorrer la galería. También puedes deslizar las ilustraciones.
            </p>
            {/* Sin key por cantidad: añadir otra página conserva la instancia y la posición. */}
            <Swiper className="illustration__slider" id={identificadorCarrusel} tabIndex={0} role="group"
              aria-labelledby="ilustracion-titulo" aria-describedby={identificadorAyuda}
              aria-busy={usaApi && consulta.cargando}
              modules={modulosCarrusel} a11y={opcionesAccesibilidad} keyboard={opcionesTeclado}
              slidesPerView={Math.min(cantidad, 1.08)} spaceBetween={16} breakpoints={puntosDeCambio}
              speed={movimientoReducido ? 0 : 360} loop={false} watchOverflow grabCursor={cantidad > 1}
              onSwiper={registrarCarrusel} onBeforeDestroy={liberarCarrusel}
              onSlideChange={actualizarNavegacion} onUpdate={actualizarNavegacion}
              onResize={actualizarNavegacion} onBreakpoint={actualizarNavegacion}
              onLock={actualizarNavegacion} onUnlock={actualizarNavegacion}
              onReachBeginning={actualizarNavegacion} onReachEnd={actualizarNavegacion} onFromEdge={actualizarNavegacion}>
              {ilustracionesPublicadas.map((ilustracion, indice) => (
                <SwiperSlide className="illustration__slide" key={ilustracion.id}>
                  <figure className="illustration__item">
                    <div className="illustration__image-frame">
                      <img className="illustration__image" src={ilustracion.imagen} alt={ilustracion.imagenAlt}
                        loading="lazy" decoding="async" width={ilustracion.ancho || undefined} height={ilustracion.alto || undefined} />
                      <a className="illustration__open" href={ilustracion.imagen} target="_blank" rel="noopener noreferrer"
                        aria-label={`Ampliar ilustración: ${ilustracion.titulo} (se abre en otra pestaña)`}>
                        <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" />
                      </a>
                    </div>
                    <figcaption className="illustration__caption">
                      <div className="illustration__meta"><span>{String(indice + 1).padStart(2, "0")}</span><span>Ilustración</span></div>
                      <h3 className="illustration__title">{ilustracion.titulo}</h3>
                      {ilustracion.descripcion && <p className="illustration__description">{ilustracion.descripcion}</p>}
                    </figcaption>
                  </figure>
                </SwiperSlide>
              ))}
            </Swiper>
            <div className="illustration__footer">
              <p className="illustration__position" aria-live="polite" aria-atomic="true">
                <span className="visually-hidden">Ilustración </span>{String(posicionActual).padStart(2, "0")}
                <span aria-hidden="true"> / </span><span className="visually-hidden"> de </span>{String(cantidad).padStart(2, "0")}
              </p>
              <div className="illustration__progress" aria-hidden="true" style={{ "--illustration-progress": posicionActual / cantidad }} />
              {cantidad > 1 && !navegacion.bloqueado && (
                <div className="illustration__controls">
                  <button className="illustration__arrow me-4" type="button" aria-label="Ilustración anterior"
                    aria-controls={identificadorCarrusel} onClick={mostrarAnterior} disabled={navegacion.inicio || navegacion.bloqueado}>
                    <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
                  </button>
                  <button className="illustration__arrow ms-4" type="button" aria-label="Ilustración siguiente"
                    aria-controls={identificadorCarrusel} onClick={mostrarSiguiente} disabled={navegacion.fin || navegacion.bloqueado}>
                    <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (!usaApi || (!consulta.cargando && !consulta.error)) && (
          <p className="content-section__text">Todavía no hay ilustraciones publicadas.</p>
        )}

        {usaApi && consulta.cargando && <p className="content-section__text mt-4" role="status">Cargando ilustraciones…</p>}
        {usaApi && consulta.error && (
          <div className="mt-4" role="alert">
            <p className="content-section__text">{consulta.error}</p>
            <button className="btn btn-outline-secondary" type="button" onClick={consulta.reintentar}>
              Reintentar
            </button>
          </div>
        )}
        {usaApi && consulta.hayMas && !consulta.error && (
          <div className="illustration__more d-flex flex-wrap align-items-center gap-3 mt-4">
            <button className="btn btn-outline-secondary" type="button"
              onClick={consulta.cargarMas} disabled={consulta.cargando}>
              {consulta.cargando ? "Cargando…" : "Cargar más ilustraciones"}
            </button>
            <p className="illustration__loaded">{cantidad} de {consulta.total} ilustraciones cargadas.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default Ilustracion;
