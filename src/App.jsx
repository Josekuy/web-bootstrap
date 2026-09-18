// ==========================================
// COMPONENTE PRINCIPAL: App.jsx
// ==========================================
// Este es el componente raíz de nuestra aplicación de React.
// Todo lo que escribas aquí (dentro del return) es lo que se inyecta y dibuja en el navegador.

import { proyectos } from "./data/proyectos"; // Importamos el array de proyectos desde un archivo externo para mantener el código limpio y organizado.

function App() {

  // ==========================================
  // 2. RENDERIZADO VISUAL (Estructura JSX)
  // ==========================================
  return (
    /* 
      EL FRAGMENT (<> ... </>):
      En React, una función de componente solo puede devolver UN ÚNICO elemento principal.
      Si queremos poner un <nav>, un <header> y un <main> hermanos, obligatoriamente 
      debemos envolverlos dentro de estas etiquetas vacías (Fragments).
    */
    <>
      {/* ==========================================
          BARRA DE NAVEGACIÓN (Navbar de Bootstrap)
          ========================================== 
          - navbar-expand-lg: Hace que el menú se despliegue en pantallas grandes y se oculte en móviles.
          - navbar-dark bg-dark: Fondo oscuro oficial con letras claras.
          - sticky-top: Mantiene la barra anclada arriba de la pantalla aunque hagamos scroll hacia abajo. */}
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

      {/* ==========================================
          SECCIÓN HERO (Presentación Principal)
          ========================================== 
          - py-5: Aplica un relleno (padding) vertical grande arriba y abajo.
          - text-center: Centra todo el contenido de texto.
          - border-bottom: Añade una línea sutil de separación inferior. */}
      <header className="bg-light py-5 text-center border-bottom">
        <div className="container py-4">
          {/* display-4 agranda la tipografía de forma destacada y moderna */}
          <h1 className="display-4 fw-bold">Front-End Developer & UI/UX Designer</h1>
          
          {/* text-muted suaviza el color del texto a un gris elegante. 
              Fíjate en el style={{}}: aquí usamos un objeto de JS para limitar el ancho del párrafo y que sea legible. */}
          <p className="lead text-muted mx-auto" style={{ maxWidth: "650px" }}>
            Fusionando la sensibilidad del diseño gráfico y editorial con la ingeniería web moderna para construir productos digitales limpios y funcionales.
          </p>
          
          <a href="#proyectos" className="btn btn-dark btn-lg mt-3">Ver Proyectos</a>
        </div>
      </header>

      {/* ==========================================
          SECCIÓN DE PROYECTOS (Dinámica con .map())
          ========================================== */}
      <main className="container my-5" id="proyectos">
        <h2 className="text-center mb-5">Proyectos Destacados</h2>
        
        {/* Sistema de Rejilla (Grid System de Bootstrap):
            - row: Fila contenedora flexible.
            - g-4: Gap (espacio uniforme de separación horizontal y vertical) entre las tarjetas. */}
        <div className="row g-4">
          
          {/* 
            BUCLE .map() PRINCIPAL:
            Recorre el array 'proyectos' uno a uno. Por cada objeto que encuentra, 
            ejecuta este bloque de código generando una columna y una tarjeta idénticas en estructura, 
            pero con los datos particulares de cada proyecto.
          */}
          {proyectos.map((proyecto) => (
            // col-md-4 significa: en pantallas medianas (md) y grandes, ocupa 4 de las 12 columnas (es decir, 3 tarjetas por fila).
            <div className="col-md-4" key={proyecto.id}>
              
              {/* Tarjeta (Card) de Bootstrap:
                  - h-100: Fuerza a que todas las tarjetas midan exactamente la misma altura aunque el texto varíe.
                  - shadow-sm: Aplica una sombra suave y moderna.
                  - border-0: Elimina el borde predeterminado para dejar un diseño minimalista. */}
              <div className="card h-100 shadow-sm border-0">

                {/* LA IMAGEN DE CADA PROYECTO:
                - card-img-top: Clase de Bootstrap para ajustar la imagen arriba de la tarjeta.
                - src={proyecto.imagen}: Viene directo de los datos (dinámico).
                - alt={proyecto.titulo}: OBLIGATORIO para accesibilidad (lectores de pantalla) y SEO.
                - loading="lazy": SÚPER IMPORTANTE. Le dice al navegador que no cargue 
                  la imagen hasta que el usuario haga scroll y esté a punto de verla, 
                  ahorrando datos y acelerando la web. */}

                <img 
                src={proyecto.imagen} 
                alt={proyecto.titulo} 
                className="card-img-top" 
                style={{ height: "200px", objectFit: "cover" }}
                loading="lazy"
                />
                
                {/* d-flex flex-column permite distribuir los elementos internos de arriba a abajo de manera ordenada */}
                <div className="card-body d-flex flex-column">
                  
                  {/* Etiqueta (Badge) para resaltar la categoría del trabajo */}
                  <span className="badge bg-success mb-3 align-self-start">{proyecto.categoria}</span>
                  
                  {/* h5 reduce ligeramente el tamaño para encajar como título secundario de tarjeta */}
                  <h3 className="card-title h5 fw-bold">{proyecto.titulo}</h3>
                  <p className="card-text text-muted">{proyecto.descripcion}</p>
                  
                  {/* ==========================================
                      SUB-BUCLE PARA LAS TECNOLOGÍAS
                      ========================================== 
                      Accede al array interno 'tecnologias' de cada proyecto 
                      para pintar pequeñas insignias secundarias de forma automatizada. 
                      - mt-auto: Empuja este bloque siempre hacia la parte inferior de la tarjeta. */}
                  <div className="mt-auto pt-3">
                    {proyecto.tecnologias.map((tech, index) => (
                      <span key={index} className="badge bg-light text-dark mt-1 me-1 border">{tech}</span>
                    ))}
                  </div>
                  
                  <button className="btn btn-outline-dark mt-3 w-100">Ver Detalles</button>
                </div>
              </div>

            </div>
          ))}

        </div>
      </main>
    </>
  )
}

export default App