import BarraNavegacion from "./components/Navbar";
import Presentacion from "./components/Hero";
import Proyectos from "./components/Projects";
import LaboratorioAnimacion from "./components/AnimationLab";
import SobreMi from "./components/SobreMi";
import Fotografia from "./components/Fotografia";
import Contacto from "./components/Contacto";

import "./styles/custom.css";
import "./styles/custom_dark.css";

// Organiza las secciones. Los nombres propios están en español; las clases CSS se conservan.
function Aplicacion() {
  return (
    <>
      <a className="skip-link" href="#contenido">Ir al contenido principal</a>
      <BarraNavegacion />
      <main id="contenido" tabIndex={-1}>
        <Presentacion />
        <LaboratorioAnimacion />
        <Proyectos />
        <SobreMi />
        <Fotografia />
        <Contacto />
      </main>
    </>
  );
}

export default Aplicacion;
