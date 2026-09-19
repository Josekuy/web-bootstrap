import { useEffect, useState } from "react";

function ThemeToggle() {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });

  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);

    localStorage.setItem(
      "theme",
      darkMode ? "dark" : "light"
    );
  }, [darkMode]);

  return (
    <button
      type="button"
      className="theme-toggle"
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
      {darkMode ? "☀" : "☾"}
    </button>
  );
}

export default ThemeToggle;