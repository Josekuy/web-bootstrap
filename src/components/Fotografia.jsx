import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y, Keyboard } from "swiper/modules";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faArrowRight, faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import { useFotografias } from "../hooks/useFotografias";
import { useMovimientoReducido } from "../hooks/useMovimientoReducido";
import "swiper/css";
import "swiper/css/a11y";
import "../styles/photography.css";

const modulosCarrusel = [A11y, Keyboard];
const opcionesTeclado = { enabled: false, onlyInViewport: false, pageUpDown: false };
const opcionesAccesibilidad = {
  containerRoleDescriptionMessage: "carrusel de fotografías",
  itemRoleDescriptionMessage: "fotografía",
  slideLabelMessage: "{{index}} de {{slidesLength}}",
  // El contador propio anuncia la posición sin duplicar regiones vivas.
  wrapperLiveRegion: false,
};

/** La API es el origen habitual. Una colección explícita permite reutilizar y probar la vista sin red.
 * @param {{fotografias?: import("../data/fotografias").Fotografia[]}} propiedades
 */
function Fotografia({ fotografias }) {
  const consulta = useFotografias({ activa: fotografias === undefined });
  const movimientoReducido = useMovimientoReducido();
  const identificador = useId();
  const identificadorCarrusel = "galeria-fotografias-" + identificador.replace(/:/gu, "");
  const identificadorAyuda = identificadorCarrusel + "-ayuda";
  const referenciaCarrusel = useRef(null);
  const referenciaGaleria = useRef(null);
  const [navegacion, establecerNavegacion] = useState({ indice: 0, inicio: true, fin: true, bloqueado: true });
  const usaApi = fotografias === undefined;
  const coleccion = usaApi ? consulta.fotografias : fotografias;
  // filter crea un nuevo array: el orden de los datos originales no se modifica.
  const fotografiasPublicadas = coleccion
    .filter((fotografia) => fotografia.estado === "publicado")
    .sort((primera, segunda) => primera.orden - segunda.orden || primera.id - segunda.id);
  const cantidad = fotografiasPublicadas.length;
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
    <section className="content-section photography" id="fotografia" aria-labelledby="fotografia-titulo">
      <div className="container">
        <div className="photography__header">
          <div className="photography__heading">
            <p className="content-section__eyebrow">Fotografía</p>
            <h2 className="content-section__title" id="fotografia-titulo">Una mirada personal</h2>
          </div>
          <p className="photography__intro">Una selección de fotografías para recorrer a tu ritmo.</p>
        </div>

        {cantidad > 0 ? (
          <div ref={referenciaGaleria} className="photography__gallery"
            onFocusCapture={habilitarTeclado} onBlurCapture={deshabilitarTeclado}>
            <p className="visually-hidden" id={identificadorAyuda}>
              Usa las flechas izquierda y derecha para recorrer la galería. También puedes deslizar las fotografías.
            </p>
            {/* Sin key por cantidad: añadir otra página conserva la instancia y la posición. */}
            <Swiper className="photography__slider" id={identificadorCarrusel} tabIndex={0} role="group"
              aria-labelledby="fotografia-titulo" aria-describedby={identificadorAyuda}
              aria-busy={usaApi && consulta.cargando}
              modules={modulosCarrusel} a11y={opcionesAccesibilidad} keyboard={opcionesTeclado}
              slidesPerView={Math.min(cantidad, 1.08)} spaceBetween={16} breakpoints={puntosDeCambio}
              speed={movimientoReducido ? 0 : 360} loop={false} watchOverflow grabCursor={cantidad > 1}
              onSwiper={registrarCarrusel} onBeforeDestroy={liberarCarrusel}
              onSlideChange={actualizarNavegacion} onUpdate={actualizarNavegacion}
              onResize={actualizarNavegacion} onBreakpoint={actualizarNavegacion}
              onLock={actualizarNavegacion} onUnlock={actualizarNavegacion}
              onReachBeginning={actualizarNavegacion} onReachEnd={actualizarNavegacion} onFromEdge={actualizarNavegacion}>
              {fotografiasPublicadas.map((fotografia, indice) => (
                <SwiperSlide className="photography__slide" key={fotografia.id}>
                  <figure className="photography__item">
                    <div className="photography__image-frame">
                      <img className="photography__image" src={fotografia.imagen} alt={fotografia.imagenAlt}
                        loading="lazy" decoding="async" width={fotografia.ancho || undefined} height={fotografia.alto || undefined} />
                      <a className="photography__open" href={fotografia.imagen} target="_blank" rel="noopener noreferrer"
                        aria-label={`Ampliar fotografía: ${fotografia.titulo} (se abre en otra pestaña)`}>
                        <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" />
                      </a>
                    </div>
                    <figcaption className="photography__caption">
                      <div className="photography__meta"><span>{String(indice + 1).padStart(2, "0")}</span><span>Fotografía</span></div>
                      <h3 className="photography__title">{fotografia.titulo}</h3>
                      {fotografia.descripcion && <p className="photography__description">{fotografia.descripcion}</p>}
                    </figcaption>
                  </figure>
                </SwiperSlide>
              ))}
            </Swiper>
            <div className="photography__footer">
              <p className="photography__position" aria-live="polite" aria-atomic="true">
                <span className="visually-hidden">Fotografía </span>{String(posicionActual).padStart(2, "0")}
                <span aria-hidden="true"> / </span><span className="visually-hidden"> de </span>{String(cantidad).padStart(2, "0")}
              </p>
              <div className="photography__progress" aria-hidden="true" style={{ "--photography-progress": posicionActual / cantidad }} />
              {cantidad > 1 && !navegacion.bloqueado && (
                <div className="photography__controls">
                  <button className="photography__arrow me-4" type="button" aria-label="Fotografía anterior"
                    aria-controls={identificadorCarrusel} onClick={mostrarAnterior} disabled={navegacion.inicio || navegacion.bloqueado}>
                    <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
                  </button>
                  <button className="photography__arrow ms-4" type="button" aria-label="Fotografía siguiente"
                    aria-controls={identificadorCarrusel} onClick={mostrarSiguiente} disabled={navegacion.fin || navegacion.bloqueado}>
                    <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (!usaApi || (!consulta.cargando && !consulta.error)) && (
          <p className="content-section__text">Todavía no hay fotografías publicadas.</p>
        )}

        {usaApi && consulta.cargando && <p className="content-section__text mt-4" role="status">Cargando fotografías…</p>}
        {usaApi && consulta.error && (
          <div className="mt-4" role="alert">
            <p className="content-section__text">{consulta.error}</p>
            <button className="btn btn-outline-secondary" type="button" onClick={consulta.reintentar}>
              Reintentar
            </button>
          </div>
        )}
        {usaApi && consulta.hayMas && !consulta.error && (
          <div className="photography__more d-flex flex-wrap align-items-center gap-3 mt-4">
            <button className="btn btn-outline-secondary" type="button"
              onClick={consulta.cargarMas} disabled={consulta.cargando}>
              {consulta.cargando ? "Cargando…" : "Cargar más fotografías"}
            </button>
            <p className="photography__loaded">{cantidad} de {consulta.total} fotografías cargadas.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default Fotografia;
