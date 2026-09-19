function Hero() {
  return (
    <header className="hero">
      <div className="container">

        <p className="hero__eyebrow">
          Graphic Design · Web Development
        </p>

        <h1 className="hero__title">
          Diseño
          <br />
          <span>+</span> Código
        </h1>

        <div className="hero__bottom">

          <p className="hero__description">
            Creo experiencias digitales donde el diseño gráfico
            se encuentra con el desarrollo web.
          </p>

          <a href="#proyectos" className="hero__button">
            Ver proyectos <span>↗</span>
          </a>

        </div>

      </div>
    </header>
  );
}

export default Hero;