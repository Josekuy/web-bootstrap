
/* ==========================================
          BARRA DE NAVEGACIÓN (Navbar de Bootstrap)
          ========================================== 
          - navbar-expand-lg: Hace que el menú se despliegue en pantallas grandes y se oculte en móviles.
          - navbar-dark bg-dark: Fondo oscuro oficial con letras claras.
          - sticky-top: Mantiene la barra anclada arriba de la pantalla aunque hagamos scroll hacia abajo. */

import ThemeToggle from "./ThemeToggle";

const navItems = [
  { label: "Proyectos", href: "#proyectos" },
  { label: "Sobre mí", href: "#sobre-mi" },  
  { label: "Fotografía", href: "#fotografia" },
  { label: "Contacto", href: "#contacto" },
];

function Navbar() {
  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark sticky-top">
      <div className="container">

        <a className="navbar-brand fw-bold" href="#">
          Portfolio | UI & Dev
        </a>

        {/* Menú principal */}
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto">

            {navItems.map((item) => (
              <li className="nav-item" key={item.href}>
                <a
                  className="nav-link"
                  href={item.href}
                >
                  {item.label}
                </a>
              </li>
            ))}

          </ul>
        </div>

        {/* Cambio de tema: siempre visible */}
        <ThemeToggle className="ms-lg-5" />

        {/* Hamburguesa */}
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Abrir navegación"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

      </div>
    </nav>
  );
}

export default Navbar;