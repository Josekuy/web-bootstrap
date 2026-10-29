Guía de funciones y componentes

Las funciones propias y sus variables se han traducido al español. Los archivos existentes conservan sus nombres para que los enlaces del proyecto y su estructura sigan siendo reconocibles. Las clases BEM también se conservan para mantener los estilos.

| Archivo | Nombre anterior | Nombre actual | Responsabilidad |
| --- | --- | --- | --- |
| `src/App.jsx` | `App` | `Aplicacion` | Ordenar las secciones y definir el contenido principal. |
| `src/components/Navbar.jsx` | `Navbar` | `BarraNavegacion` | Mostrar la navegación y cerrar el menú móvil al seleccionar una sección. |
| `src/components/Hero.jsx` | `Hero` | `Presentacion` | Mostrar el título, la introducción y el acceso a proyectos. |
| `src/components/Projects.jsx` | `Projects` | `Proyectos` | Seleccionar proyectos publicados, ordenarlos y generar tarjetas. |
| `src/components/ProjectCard.jsx` | `ProjectCard` | `TarjetaProyecto` | Mostrar el resumen y enlazar el botón con el modal correspondiente. |
| `src/components/ThemeToggle.jsx` | `ThemeToggle` | `SelectorTema` | Aplicar y guardar el tema claro u oscuro. |
| `src/components/AnimationLab.jsx` | `AnimationLab` | `LaboratorioAnimacion` | Ajustar y animar la fila de cuadrados. |
| `src/components/ProjectDetail.jsx` | Nuevo | `DetalleProyecto` | Crear el modal de Bootstrap y mostrar la ficha y sus enlaces. |
| `src/components/SobreMi.jsx` | Nuevo | `SobreMi` | Mostrar la biografía. |
| `src/components/Fotografia.jsx` | Nuevo | `Fotografia` | Mostrar la galería o su estado vacío. |
| `src/components/Contacto.jsx` | Nuevo | `Contacto` | Mostrar los canales de contacto configurados. |

Funciones que conviene localizar en el editor:

- `navegarASeccion`, `completarNavegacion`, `cerrarTrasApertura` y `cerrarMenuConTeclado`, en `Navbar.jsx`: coordinan el cierre del desplegable y el salto al destino.
- `leerTemaInicial` y `alternarTema`, en `ThemeToggle.jsx`: recuperan la preferencia y cambian el estado.
- `TarjetaProyecto`, en `ProjectCard.jsx`: asigna un identificador a cada ficha y utiliza `data-bs-toggle="modal"` y `data-bs-target` para abrirla.
- `DetalleProyecto`, en `ProjectDetail.jsx`: inicializa el modal de Bootstrap en un efecto y lo cierra y libera al desmontar. La X utiliza `btn-close` y `data-bs-dismiss="modal"`; Bootstrap gestiona Escape, el fondo y el retorno del foco.
- `actualizarCantidad`, en `AnimationLab.jsx`: calcula cuántos cuadrados caben sin desbordar.
- `actualizarMovimiento` y `detenerAnimaciones`, en ese mismo archivo: respetan el movimiento reducido y limpian las instancias.
- `manejarMovimiento`, `actualizarProximidad`, `manejarSalida` y `cancelarFotograma`: coordinan el ratón sin crear animaciones en cada evento.
- `obtenerEnlaceWeb`, en `src/utils/enlaces.js`: acepta URL absolutas HTTP(S) sin credenciales y devuelve `null` para los valores pendientes o inválidos.
- `aplicarTemaInicial`, en `index.html`: aplica el tema antes de que se dibuje React. Debe seguir el mismo criterio que `leerTemaInicial`.

Los nombres de las APIs externas siguen en su idioma original. `useState` guarda estado; `useRef` conserva referencias; `useEffect` sincroniza efectos y devuelve su limpieza. `createTimeline` y `createAnimatable` pertenecen a Anime.js; `Collapse` y `Modal` a Bootstrap. `getOrCreateInstance`, `hide` y `dispose` son métodos oficiales de Bootstrap. Las propiedades JSX como `className`, `onClick` y `aria-label` mantienen también su sintaxis oficial.

`createPortal`, de React DOM, coloca la ficha dentro de `body` para que el grid de tarjetas no limite su posición. El modal se mantiene sin la clase `fade`: apertura y cierre terminan de forma síncrona y el efecto puede ejecutar `hide()` antes de `dispose()` sin dejar una transición pendiente. Si se añadieran transiciones de Bootstrap, habría que adaptar esa limpieza para esperar sus eventos.

Para cambiar el contenido, consulta [contrato-datos.md](contrato-datos.md). Los textos provisionales están en `src/data/contenido.js`; los proyectos en `src/data/proyectos.js`; la colección de fotografías en `src/data/fotografias.js`.
