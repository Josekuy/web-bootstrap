# Diseño visual del portfolio

El tema claro combina un fondo perla con luz azul hielo y coral. El oscuro usa un fondo grafito, luz azul y acentos lima. Las fotos y las portadas se muestran con sus propios colores.

| Qué quieres ajustar | Dónde editarlo |
| --- | --- |
| Paleta, texto, tipografía y acento | `src/styles/theme.css`. `:root` define el tema claro y `html.dark-mode` sobrescribe los valores del oscuro. `--color-accent-text` es el acento con contraste para texto y foco. |
| Color e intensidad de la luz de fondo | `--light-cool` y `--light-accent` en `theme.css`. Ajusta la opacidad al final de cada valor `rgb()`. |
| Posición y tamaño de los degradados | `.hero` en `src/styles/custom.css` y `.projects` en `src/styles/projects.css`. Cada sección pinta sus propios degradados con `background-image`. |
| Transparencia, reflejo, borde y sombra de las tarjetas | Variables `--glass-*` en `theme.css`. El radio, el margen interior y el encuadre se controlan en `.project-card` y `.project-card__image-wrapper` de `projects.css`. |
| Marco, encuadre y visor fotográfico | `src/styles/photography.css`. `.photography__open` define el marco, `.photography__zoom` el indicador de ampliación y `.photography__image` la proporción. `.photography__lightbox` contiene los estilos del visor. |

Los degradados se pintan detrás del contenido y terminan con su sección. El `body` solo tiene el color base, así que las demás secciones comparten un fondo continuo. Fotografía delimita el marco de cada imagen y usa un fondo neutro en el visor. Las imágenes se pintan sin filtros CSS.

Las tarjetas usan una superficie sólida como base. Los navegadores con `backdrop-filter` activan el vidrio en el bloque `@supports` de `projects.css`. El desenfoque toma los colores de detrás de la tarjeta. El contenido y la portada se pintan encima y conservan su nitidez. La elevación al pasar el puntero requiere ratón y respeta la preferencia de movimiento reducido.

Para revisar un cambio, abre la portada en ambos temas y comprueba el grid de Proyectos a 1440, 768 y 390 px. Recorre con Tab el botón «Ver proyecto» y una foto. Abre y cierra ambas fichas con Enter y Escape. Consulta las comprobaciones de navegador del [README](../README.md#comprobaciones) para repetir estos recorridos en Chromium.
