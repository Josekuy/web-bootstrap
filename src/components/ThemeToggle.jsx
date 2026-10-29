import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSun, faMoon } from "@fortawesome/free-solid-svg-icons";

// Recupera la elección guardada; si no existe, utiliza la preferencia del sistema.
function leerTemaInicial() {
  try {
    const temaGuardado = localStorage.getItem("theme");
    if (temaGuardado === "dark" || temaGuardado === "light") {
      return temaGuardado === "dark";
    }
  } catch {
    // El navegador puede bloquear el almacenamiento; el selector debe seguir funcionando.
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// Sincroniza la elección del usuario con la clase del documento y su almacenamiento.
function SelectorTema({ className = "" }) {
  const [temaOscuro, establecerTemaOscuro] = useState(leerTemaInicial);

  useEffect(() => {
    document.documentElement.classList.toggle("dark-mode", temaOscuro);
    // Bootstrap usa este atributo para adaptar sus componentes, incluido btn-close.
    document.documentElement.dataset.bsTheme = temaOscuro ? "dark" : "light";
    try {
      localStorage.setItem("theme", temaOscuro ? "dark" : "light");
    } catch {
      // Si no se puede guardar, el cambio sigue activo durante esta visita.
    }
  }, [temaOscuro]);

  // La actualización funcional utiliza siempre el estado más reciente de React.
  function alternarTema() {
    establecerTemaOscuro((temaAnterior) => !temaAnterior);
  }

  const etiqueta = temaOscuro ? "Activar modo claro" : "Activar modo oscuro";

  return (
    <button type="button" className={"theme-toggle " + className}
      onClick={alternarTema} aria-label={etiqueta} aria-pressed={temaOscuro} title={etiqueta}>
      <FontAwesomeIcon icon={temaOscuro ? faSun : faMoon} />
    </button>
  );
}

export default SelectorTema;
