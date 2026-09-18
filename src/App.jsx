

import Navbar from "./components/Navbar"; // Importamos el componente Navbar desde su archivo correspondiente.  
import Hero from "./components/Hero"; // Importamos el componente Hero desde su archivo correspondiente.
import Projects from "./components/Projects"; // Importamos el componente Projects desde su archivo correspondiente.

function App() {

// ==========================================
// COMPONENTE PRINCIPAL: App.jsx
// ==========================================
// Este es el componente raíz de nuestra aplicación de React.
// Todo lo que escribas aquí (dentro del return) es lo que se inyecta y dibuja en el navegador.

  return (
    <>
      <Navbar />
      <Hero />
      <Projects />      
    </>
  )
}

export default App