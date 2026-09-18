function Hero() {
    return (
        /* ==========================================
          SECCIÓN HERO (Presentación Principal)
          ========================================== 
          - py-5: Aplica un relleno (padding) vertical grande arriba y abajo.
          - text-center: Centra todo el contenido de texto.
          - border-bottom: Añade una línea sutil de separación inferior. */
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

    );
}
export default Hero;