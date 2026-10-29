import { useEffect, useRef } from "react";
import Collapse from "bootstrap/js/dist/collapse";
import SelectorTema from "./ThemeToggle";
import { navegacion } from "../data/contenido";

// Mantiene el menú de Bootstrap y cierra el desplegable al elegir una sección en móvil.
function BarraNavegacion() {
  const referenciaMenu = useRef(null);
  const referenciaBoton = useRef(null);
  const destinoPendiente = useRef(null);

  useEffect(() => {
    const elementoMenu = referenciaMenu.current;
    const menu = Collapse.getOrCreateInstance(elementoMenu, { toggle: false });

    // El destino se calcula cuando el desplegable ya no ocupa espacio en la página.
    function completarNavegacion() {
      const destino = destinoPendiente.current;
      destinoPendiente.current = null;
      if (!destino) return;

      if (window.location.hash === destino) {
        document.getElementById(destino.slice(1))?.scrollIntoView();
      } else {
        window.location.hash = destino;
      }
    }

    // Una selección durante la apertura espera a que Bootstrap termine su transición.
    function cerrarTrasApertura() {
      if (destinoPendiente.current) menu.hide();
    }

    elementoMenu.addEventListener("hidden.bs.collapse", completarNavegacion);
    elementoMenu.addEventListener("shown.bs.collapse", cerrarTrasApertura);
    // StrictMode repite los efectos en desarrollo: también liberamos esta instancia.
    return () => {
      elementoMenu.removeEventListener("hidden.bs.collapse", completarNavegacion);
      elementoMenu.removeEventListener("shown.bs.collapse", cerrarTrasApertura);
      menu.dispose();
    };
  }, []);

  // Conserva los enlaces nativos; en móvil retrasa el salto hasta terminar el cierre.
  function navegarASeccion(evento) {
    const menu = referenciaMenu.current;
    if (!window.matchMedia("(max-width: 991.98px)").matches
      || !menu.matches(".show, .collapsing")) return;

    evento.preventDefault();
    destinoPendiente.current = evento.currentTarget.hash;
    Collapse.getInstance(menu)?.hide();
  }

  // Escape ofrece una salida por teclado y devuelve el foco al botón del menú.
  function cerrarMenuConTeclado(evento) {
    if (evento.key === "Escape" && window.matchMedia("(max-width: 991.98px)").matches) {
      destinoPendiente.current = null;
      Collapse.getInstance(referenciaMenu.current)?.hide();
      referenciaBoton.current?.focus();
    }
  }

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark sticky-top"
      aria-label="Navegación principal" onKeyDown={cerrarMenuConTeclado}>
      <div className="container">
        <a className="navbar-brand fw-bold" href="#inicio" onClick={navegarASeccion}>
          Portfolio | UI & Dev
        </a>

        {/* El selector queda visible también cuando el menú está cerrado. */}
        <SelectorTema className="ms-lg-4 order-lg-3" />

        <button ref={referenciaBoton} className="navbar-toggler" type="button"
          data-bs-toggle="collapse" data-bs-target="#navbarNav"
          aria-controls="navbarNav" aria-expanded="false"
          aria-label="Mostrar u ocultar navegación">
          <span className="navbar-toggler-icon" />
        </button>

        {/* La navegación y sus destinos se definen juntos en data/contenido.js. */}
        <div ref={referenciaMenu} className="collapse navbar-collapse order-lg-2" id="navbarNav">
          <ul className="navbar-nav ms-auto">
            {navegacion.map((elemento) => (
              <li className="nav-item" key={elemento.href}>
                <a className="nav-link" href={elemento.href} onClick={navegarASeccion}>
                  {elemento.etiqueta}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default BarraNavegacion;
