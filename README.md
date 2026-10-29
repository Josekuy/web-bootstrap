Portfolio de José — React y Vite

Portfolio de diseño gráfico y desarrollo web con React, Bootstrap 5, CSS propio y Anime.js. El contenido se mantiene en archivos locales con un contrato preparado para incorporar una API.

**Preparación y ejecución.** Utiliza Node 22.12 o posterior.

```sh
npm install
npm run dev
```

Para comprobar la compilación de producción:

```sh
npm run build
npm run preview
```

**Comprobaciones.**

```sh
npm run lint
npm run build
```

Con Vite iniciado en otra terminal en `http://127.0.0.1:5173/`:

```sh
npm run comprobar:navegador
```

El comprobador abre Chrome/Chromium sin ventana y utiliza un perfil temporal. Revisa navegación móvil, destinos de enlaces, fichas, foco, persistencia del tema, varios anchos y movimiento reducido. Requiere un navegador instalado: `CHROME_PATH` permite indicar su ejecutable y `PORTFOLIO_URL` cambiar el servidor. No instala librerías. `node scripts/comprobar-navegador.cjs --capturas` guarda capturas opcionales en la carpeta temporal.

**Dónde editar el contenido.**

| Archivo | Contenido |
| --- | --- |
| `src/data/contenido.js` | Navegación, presentación, biografía y contacto. |
| `src/data/proyectos.js` | Proyectos, tecnologías, imágenes y enlaces opcionales. |
| `src/data/fotografias.js` | Fotografías; la colección empieza vacía. |

Los textos pendientes usan Lorem ipsum. Los correos y enlaces no configurados se representan con `null` o listas vacías. Para publicar una fotografía, añadir un registro con los campos documentados y `estado: "publicado"`.

«Ver proyecto» abre un modal de Bootstrap 5 con su X `btn-close`, cierre mediante Escape y clic en el fondo. Bootstrap devuelve el foco a la tarjeta al cerrar. Al configurar `urlProyecto` o `urlRepositorio`, aparecen sus enlaces dentro de la ficha. `orden` controla la posición; `id` conserva la identidad del registro.

`ProjectDetail.jsx` contiene el modal y lo coloca en `body` mediante un portal de React. `ProjectCard.jsx` lo abre con los atributos oficiales `data-bs-toggle` y `data-bs-target`. Se importa únicamente el módulo Modal de Bootstrap y el efecto libera su instancia al desmontar.

Los borradores se filtran en la presentación, pero siguen siendo descargables si se incluyen en estos archivos. Los contenidos privados deberán quedarse en el futuro servidor.

**Estructura y nombres.** `src/App.jsx` organiza las secciones; `src/components/` contiene la interfaz; `src/styles/custom.css` define el tema claro y `custom_dark.css` el oscuro. Se mantiene el grid personalizado de tres, dos y una columnas.

Las funciones propias están en español, con comentarios junto a la lógica principal. Se conservan los nombres de los archivos existentes, las clases CSS y las APIs de React, Bootstrap, Anime.js y el navegador.

- [Guía de funciones y equivalencias](docs/guia-funciones.md)
- [Contrato de datos y propuesta de API](docs/contrato-datos.md)
- [Diagnóstico inicial y evolución](docs/informe-estado-portfolio.md)

El tema utiliza la clave `theme` de localStorage, la clase `dark-mode` para los estilos propios y `data-bs-theme` en `html` para los componentes de Bootstrap. Sin elección guardada utiliza la preferencia del sistema. El script de `index.html` aplica el mismo criterio antes de montar React.

Las fuentes se cargan desde Google Fonts y las imágenes ilustrativas existentes desde Unsplash. Si esos servicios no están disponibles, se utilizan fuentes del sistema y los textos siguen accesibles.

**Siguiente fase.** Incorporar Express y MySQL para gestionar fotografía desde un panel protegido. La API y la autenticación todavía no forman parte del proyecto.
