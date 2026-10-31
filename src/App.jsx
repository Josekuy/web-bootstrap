import { lazy, Suspense } from "react";
import BarraNavegacion from "./components/Navbar";
import Presentacion from "./components/Hero";
import Proyectos from "./components/Projects";
import LaboratorioAnimacion from "./components/AnimationLab";
import SobreMi from "./components/SobreMi";
import Fotografia from "./components/Fotografia";
import Contacto from "./components/Contacto";

import "./styles/custom.css";
import "./styles/custom_dark.css";

// El código del panel se descarga solo al visitar /admin.
const PanelAdmin = lazy(() => import("./admin/PanelAdmin"));

// Organiza las secciones. Los nombres propios están en español; las clases CSS se conservan.
function Aplicacion() {
  if (window.location.pathname === "/admin" || window.location.pathname === "/admin/") {
    return (
      <Suspense fallback={<p className="container py-5" role="status">Cargando panel…</p>}>
        <PanelAdmin />
      </Suspense>
    );
  }
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
