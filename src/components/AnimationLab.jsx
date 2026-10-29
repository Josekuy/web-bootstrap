import { useEffect, useRef, useState } from "react";
import { createAnimatable, createTimeline } from "animejs";

// Ajusta una fila decorativa al espacio disponible y coordina su animación e interacción.
function LaboratorioAnimacion() {
  const raiz = useRef(null);
  const rejilla = useRef(null);
  const [cantidadCuadrados, establecerCantidadCuadrados] = useState(0);

  useEffect(() => {
    const elementoRejilla = rejilla.current;

    if (!elementoRejilla) return;

    const actualizarCantidad = () => {
      const anchoDisponible = elementoRejilla.getBoundingClientRect().width;
      const separacionCalculada = Number.parseFloat(
        getComputedStyle(elementoRejilla).columnGap
      );
      const separacion = Number.isFinite(separacionCalculada)
        ? separacionCalculada
        : 8;

      // N cuadrados ocupan N * 24 + (N - 1) huecos. Medimos el grid sin el padding del container.
      const cantidad = Math.floor(
        (anchoDisponible + separacion) / (24 + separacion)
      );

      establecerCantidadCuadrados(Math.max(0, Math.min(cantidad, 40)));
    };

    actualizarCantidad();

    const observador = new ResizeObserver(actualizarCantidad);
    observador.observe(elementoRejilla);

    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    const elementoRaiz = raiz.current;
    const elementoRejilla = rejilla.current;

    if (!elementoRaiz || !elementoRejilla || cantidadCuadrados === 0) return;

    const cuadrados = Array.from(
      elementoRejilla.querySelectorAll(".animation-lab__square")
    );
    const preferenciaMovimiento = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );
    let detenerAnimaciones = () => {};

    const actualizarMovimiento = () => {
      // También limpiamos al cambiar esta preferencia con la página ya abierta.
      detenerAnimaciones();
      detenerAnimaciones = () => {};

      if (preferenciaMovimiento.matches) return;

      // Una sola secuencia mantiene los pulsos sincronizados: avanzan y se apagan detrás.
      const secuencia = createTimeline({
        autoplay: false,
        loop: true,
        defaults: { ease: "linear" },
      });

      cuadrados.forEach((cuadrado, indice) => {
        secuencia.add(
          cuadrado,
          {
            opacity: [
              { from: 0.18, to: 1, duration: 180 },
              { to: 0.18, duration: 620 },
            ],
          },
          indice * 100
        );
      });

      secuencia.play();

      // Reutilizamos estas animaciones; mover el ratón no crea nuevas instancias.
      const movimientos = cuadrados.map((cuadrado) =>
        createAnimatable(cuadrado, {
          y: 250,
          scale: 250,
          ease: "out(3)",
        })
      );
      let posicionPuntero = 0;
      let fotogramaPendiente = null;

      const actualizarProximidad = () => {
        fotogramaPendiente = null;

        // Primero leemos las posiciones y después actualizamos las animaciones.
        const centros = cuadrados.map((cuadrado) => {
          const limites = cuadrado.getBoundingClientRect();
          return limites.left + limites.width / 2;
        });

        movimientos.forEach((movimiento, indice) => {
          const distancia = Math.abs(posicionPuntero - centros[indice]);
          const influencia = Math.max(0, 1 - distancia / 180);

          movimiento.y(-12 * influencia);
          movimiento.scale(1 + 0.35 * influencia);
        });
      };

      const manejarMovimiento = (evento) => {
        posicionPuntero = evento.clientX;

        // Agrupamos los eventos en una sola actualización por fotograma.
        if (fotogramaPendiente === null) {
          fotogramaPendiente = requestAnimationFrame(actualizarProximidad);
        }
      };

      const cancelarFotograma = () => {
        if (fotogramaPendiente !== null) {
          cancelAnimationFrame(fotogramaPendiente);
          fotogramaPendiente = null;
        }
      };

      const manejarSalida = () => {
        cancelarFotograma();
        movimientos.forEach((movimiento) => {
          movimiento.y(0, 500);
          movimiento.scale(1, 500);
        });
      };

      elementoRaiz.addEventListener("mousemove", manejarMovimiento);
      elementoRaiz.addEventListener("mouseleave", manejarSalida);

      detenerAnimaciones = () => {
        cancelarFotograma();
        elementoRaiz.removeEventListener("mousemove", manejarMovimiento);
        elementoRaiz.removeEventListener("mouseleave", manejarSalida);

        // revert() detiene las instancias y restaura los estilos, también en StrictMode.
        movimientos.forEach((movimiento) => movimiento.revert());
        secuencia.revert();
      };
    };

    actualizarMovimiento();
    preferenciaMovimiento.addEventListener("change", actualizarMovimiento);

    return () => {
      preferenciaMovimiento.removeEventListener("change", actualizarMovimiento);
      detenerAnimaciones();
    };
  }, [cantidadCuadrados]);

  return (
    <section className="animation-lab" ref={raiz} aria-hidden="true">
      <div className="container">
        <div
          className="animation-lab__grid"
          ref={rejilla}
          style={{ minHeight: "24px" }}
        >
          {Array.from({ length: cantidadCuadrados }, (cuadrado, indice) => (
            <div key={indice} className="animation-lab__square" />
          ))}
        </div>
      </div>
    </section>
  );
}

export default LaboratorioAnimacion;
