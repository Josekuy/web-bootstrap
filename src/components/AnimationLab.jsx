import { useEffect, useRef, useState } from "react";
import { animate, stagger } from "animejs";

function AnimationLab() {
  const root = useRef(null);

  const getSquareCount = (width) => {
    const squareSize = 24;
    const gap = 8;

    const count = Math.floor(
      width / (squareSize + gap)
    );

    return Math.max(8, Math.min(count, 40));
  };

  const [squareCount, setSquareCount] = useState(32);

  const squares = Array.from({ length: squareCount });

  // Observamos el tamaño del contenedor
  useEffect(() => {
    const element = root.current;

    if (!element) return;

    const container = element.querySelector(".container");

    if (!container) return;

    const updateSquares = () => {
      setSquareCount(
        getSquareCount(container.clientWidth)
      );
    };

    updateSquares();

    const observer = new ResizeObserver(updateSquares);

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Animaciones
  useEffect(() => {
    const element = root.current;

    if (!element) return;

    const squareElements = element.querySelectorAll(
      ".animation-lab__square"
    );

    // Loader retro
    squareElements.forEach((square, index) => {
      animate(square, {
        opacity: [0.18, 1, 0.18],
        duration: 1200,
        delay: index * 100,
        ease: "linear",
        loop: true,
      });
    });

    // Reacción al ratón
    const handleMouseMove = (event) => {
      squareElements.forEach((square) => {
        const rect = square.getBoundingClientRect();

        const center = rect.left + rect.width / 2;
        const distance = Math.abs(
          event.clientX - center
        );

        const maxDistance = 180;

        const influence = Math.max(
          0,
          1 - distance / maxDistance
        );

        animate(square, {
          y: -12 * influence,
          scale: 1 + 0.35 * influence,
          duration: 250,
          ease: "out(3)",
        });
      });
    };

    const handleMouseLeave = () => {
      animate(squareElements, {
        y: 0,
        scale: 1,
        duration: 500,
        ease: "out(3)",
      });
    };

    element.addEventListener(
      "mousemove",
      handleMouseMove
    );

    element.addEventListener(
      "mouseleave",
      handleMouseLeave
    );

    return () => {
      element.removeEventListener(
        "mousemove",
        handleMouseMove
      );

      element.removeEventListener(
        "mouseleave",
        handleMouseLeave
      );
    };
  }, [squareCount]);

  return (
    <section className="animation-lab" ref={root}>
      <div className="container">
        <div className="animation-lab__grid">
          {squares.map((_, index) => (
            <div
              key={index}
              className="animation-lab__square"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default AnimationLab;