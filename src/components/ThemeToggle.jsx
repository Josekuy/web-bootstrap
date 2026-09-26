import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSun, faMoon } from "@fortawesome/free-solid-svg-icons";

function ThemeToggle({ className = "" }) {
    const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });

  useEffect(() => {
    document.documentElement.classList.toggle(
      "dark-mode",
      darkMode
    );

    localStorage.setItem(
      "theme",
      darkMode ? "dark" : "light"
    );
  }, [darkMode]);

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={() => setDarkMode(!darkMode)}
      aria-label={
        darkMode
          ? "Activar modo claro"
          : "Activar modo oscuro"
      }
      title={
        darkMode
          ? "Activar modo claro"
          : "Activar modo oscuro"
      }
    >
      <FontAwesomeIcon
        icon={darkMode ? faSun : faMoon}
      />
    </button>
  );
}

export default ThemeToggle;