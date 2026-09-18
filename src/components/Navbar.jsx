
/* ==========================================
          BARRA DE NAVEGACIÓN (Navbar de Bootstrap)
          ========================================== 
          - navbar-expand-lg: Hace que el menú se despliegue en pantallas grandes y se oculte en móviles.
          - navbar-dark bg-dark: Fondo oscuro oficial con letras claras.
          - sticky-top: Mantiene la barra anclada arriba de la pantalla aunque hagamos scroll hacia abajo. */
          
function Navbar() {
    return (
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark sticky-top">
        <div className="container">
          <a className="navbar-brand fw-bold" href="#">Portfolio | UI & Dev</a>
          
          {/* Botón de hamburguesa para dispositivos móviles */}
          <button 
            className="navbar-toggler" 
            type="button" 
            data-bs-toggle="collapse" 
            data-bs-target="#navbarNav"
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          {/* Bloque que se oculta/muestra con el botón de hamburguesa */}
          <div className="collapse navbar-collapse" id="navbarNav">
            {/* ms-auto (Margin Start: auto) empuja todos los enlaces de la lista hacia la extrema derecha */}
            <ul className="navbar-nav ms-auto">
              <li className="nav-item">
                <a className="nav-link active" href="#proyectos">Proyectos</a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="#sobre-mi">Sobre mí</a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="#contacto">Contacto</a>
              </li>
            </ul>
          </div>
        </div>
      </nav>
    );
}
export default Navbar;