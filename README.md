# Portfolio de José — React, Express y MySQL

Portfolio de diseño gráfico y desarrollo web con React, Vite, Bootstrap 5, CSS propio y Anime.js. Los proyectos, las ilustraciones y las fotografías se gestionan desde un panel con API Express y base MySQL/MariaDB. Los textos de la portada siguen en un archivo local.

Para trabajar desde sobremesa y portátil con el mismo contenido, consulta [Datos compartidos y despliegue gratuito](docs/datos-compartidos.md). Git transporta el código; la base, las imágenes subidas y los secretos se gestionan por separado. El proyecto permite una API compartida, MySQL con TLS y un bucket privado de Supabase sin cambiar el flujo local descrito a continuación.

## Preparación local

Requiere Node 22.12 o posterior y MySQL/MariaDB. En este entorno se utiliza XAMPP en el puerto 3306, con MariaDB 10.4.

```sh
npm install
npm run configurar:local
```

El segundo comando crea `.env` a partir de `.env.example`, genera secretos aleatorios y no los imprime ni sobrescribe un archivo existente. Inicia MySQL desde XAMPP y revisa en `.env` la conexión; ajusta `DB_ADMIN_USER` y `DB_ADMIN_PASSWORD` si tu instalación los requiere. Después:

```sh
npm run db:preparar
npm run admin:crear
```

La preparación crea la base, aplica migraciones y concede a la cuenta de la API permisos de lectura y escritura. La cuenta administrativa de BD solo se usa en esa preparación. `admin:crear` usa `ADMIN_USUARIO` y `ADMIN_CONTRASENA` del archivo local; si el usuario ya existe, conserva su contraseña.

Para migrar los cuatro proyectos originales a una instalación nueva, después de preparar la base:

```sh
npm run proyectos:importar
```

La importación no sobrescribe proyectos con un slug existente. Registra su aplicación para que repetir el comando conserve las ediciones y los borrados del panel, sin reintroducir los ejemplos. No es necesaria para crear tus propios proyectos desde cero.

Con MySQL activo en XAMPP, arranca la API y Vite juntos en una terminal:

```sh
npm run dev
```

Los mensajes llevan los prefijos `API` y `WEB`; `Ctrl+C` detiene ambos procesos. Si prefieres terminales separadas, usa `npm run api` y `npm run dev:web`. Detén las instancias anteriores antes de cambiar de modalidad para evitar ocupar dos veces los mismos puertos. Vite usa estrictamente el puerto 5173: si está ocupado avisa y termina, sin cambiar a otro origen que el panel no tenga permitido.

Abre `http://127.0.0.1:5173/` para la portada y `http://127.0.0.1:5173/admin` para el panel. Vite envía `/api` a Express en el puerto 3001. Consulta las credenciales iniciales en tu `.env`; no las copies en documentación ni en el código. `.env` y `server/storage/` están excluidos de Git.

Si aparece `ECONNREFUSED 127.0.0.1:3001`, el proxy de Vite no encuentra Express: revisa los mensajes `API`. Un fallo de conexión a `3306` corresponde a MySQL; comprueba que esté iniciado y que la conexión de `.env` sea correcta.

### Actualización de las galerías

Al actualizar una instalación anterior, ejecuta `npm run db:preparar` antes de arrancar la aplicación. La migración `003` convierte la antigua colección de fotografías en **Ilustración**, conservando identificadores, textos, orden y estado. La nueva **Fotografía** comienza vacía y se administra por separado. Los archivos existentes se trasladan a `server/storage/ilustraciones/` comprobando su contenido antes de retirar la copia de origen. Repetir la preparación conserva las dos colecciones.

La portada muestra Ilustración y, a continuación, Fotografía. En `/admin` hay tres pestañas: Proyectos, Ilustración y Fotografía. Para añadir contenido al book, selecciona Fotografía, sube una imagen, completa sus textos y guarda su estado como publicado.

## Contenido e interfaz

| Ubicación | Qué se mantiene ahí |
| --- | --- |
| `src/data/contenido.js` | Navegación, presentación, biografía y contacto. |
| Panel `/admin`, sección Proyectos | Proyectos con resumen para la tarjeta y descripción detallada, tecnologías, portada, galería independiente de hasta 8 imágenes de detalle y enlaces opcionales. |
| Panel `/admin`, sección Ilustración | Obras del carrusel y sus metadatos. |
| Panel `/admin`, sección Fotografía | Imágenes del book fotográfico y sus metadatos. Las tres secciones permiten ordenar, guardar borradores y publicar. |
| `src/data/proyectos.js` | Solo el contrato JSDoc; no contiene proyectos ni alimenta la portada. |
| `server/semillas/proyectos-iniciales.js` | Copia antigua consumida únicamente por `proyectos:importar`. |
| `src/data/fotografias.js` | Tipo JSDoc y colección vacía para usos explícitos de la vista; no alimenta la galería habitual. |
| `src/data/ilustraciones.js` | Tipo JSDoc de ilustración; el contenido habitual procede de su API. |

Los textos pendientes usan Lorem ipsum. Los correos y enlaces sin configurar se representan con `null` o listas vacías. Proyectos, ilustración y fotografía muestran carga, errores con reintento, paginación y estado vacío. Los cambios publicados desde el panel aparecen mediante la API sin recompilar la web.

«Ver proyecto» abre una ficha en un modal de Bootstrap 5, con cierre mediante su X, Escape o clic en el fondo y devolución del foco a la tarjeta. La portada puede ser un mockup y la ficha mostrar una o varias imágenes distintas del diseño completo, sin recortarlo. El panel permite añadir hasta 8 imágenes de detalle, ordenar, quitar y describir cada una. Si no se añade ninguna, la ficha utiliza la portada. `ProjectDetail.jsx` representa el modal mediante un portal y `ProjectCard.jsx` lo abre con los atributos oficiales de Bootstrap. Los enlaces opcionales solo aparecen cuando existen destinos válidos.

Para actualizar una instalación existente, ejecuta `npm run db:preparar`: la migración `004` añade la galería de proyectos sin cambiar sus portadas ni sus datos actuales.

La migración `005`, aplicada con el mismo comando, añade el resumen de la tarjeta sin modificar las descripciones anteriores. En el panel se edita un resumen breve de hasta 300 caracteres y una descripción detallada de hasta 5000 para la ficha. Si el resumen está vacío, la tarjeta muestra un extracto automático de hasta 180 caracteres. La descripción de la ficha conserva sus párrafos y saltos de línea.

`src/App.jsx` organiza las secciones y carga el panel al visitar `/admin`. `src/styles/custom.css` y `custom_dark.css` definen ambos temas; `admin.css` contiene los estilos del panel. Se mantiene el grid personalizado de tres, dos y una columnas.

Ilustración conserva la galería horizontal Swiper, ahora en `Ilustracion.jsx` y `src/styles/illustration.css`: deslizamiento táctil, flechas, contador y teclado mientras el foco está dentro. Conserva los encuadres y la posición al cargar más resultados, sin avance automático.

Fotografía utiliza un grid editorial irregular en `Fotografia.jsx` y `src/styles/photography.css`, con distintos tamaños y proporciones completas. En móvil se convierte en una columna. Al seleccionar una imagen se abre un visor modal con anterior/siguiente, teclado, Escape y devolución del foco. Ambas galerías respetan los temas claro y oscuro y el movimiento reducido.

Las funciones propias están en español. Se conservan los nombres de los archivos existentes, las clases CSS y las APIs externas. El tema usa `theme` en localStorage, `dark-mode` y `data-bs-theme` en `html`; respeta la preferencia del sistema cuando no hay elección guardada y se aplica antes de montar React. Las fuentes se cargan desde Google Fonts y las imágenes ilustrativas de proyectos desde Unsplash.

Los borradores de los tres recursos se protegen en la API y en la entrega de archivos subidos. Ilustración y Fotografía utilizan tablas y directorios independientes, con las mismas reglas de subida y acceso. Las portadas externas de proyectos solo admiten HTTPS; su disponibilidad y privacidad dependen del proveedor. El backend valida esas URL y no las descarga.

## Comprobaciones

Con MySQL activo, prepara una base distinta de la del portfolio para las pruebas de integración:

```sh
npm run db:pruebas
npm run test:api
npm run lint
npm run build
```

`test:api` usa el ejecutor nativo de Node. La integración utiliza `DB_TEST_NAME`, crea sus propios registros y archivos temporales y limpia esos datos al terminar. No requiere tener arrancados Vite ni la API habitual.

Con **API y Vite** activos en otras terminales:

```sh
npm run comprobar:navegador
npm run comprobar:admin
npm run comprobar:admin:fotografia
npm run comprobar:proyectos
npm run comprobar:ilustracion
npm run comprobar:galeria
```

Los comprobadores utilizan Chrome/Chromium instalado y un perfil temporal sin ventana; `CHROME_PATH` permite indicar su ejecutable y `PORTFOLIO_URL` cambiar la URL de Vite. Cubren la portada, el panel de fotografía y la gestión de proyectos. Los recorridos administrativos usan las credenciales locales sin imprimirlas y crean sus propios datos de prueba. La opción `--capturas` guarda capturas opcionales en una carpeta temporal al ejecutar los scripts con `node`.

`comprobar:admin` recorre Ilustración y `comprobar:admin:fotografia` la nueva Fotografía. `comprobar:ilustracion` verifica el carrusel y `comprobar:galeria` el book y su visor. Estos dos últimos interceptan los listados en Chrome con imágenes sintéticas y no modifican los datos de MySQL.

`npm run preview` permite previsualizar el resultado de Vite y utiliza el proxy `/api` configurado, pero no inicia Express. `API_PROXY_TARGET` selecciona una API compartida HTTPS; sin configurar utiliza la API local. Con destino remoto, `/admin` abre el panel alojado. Para servir interfaz y API juntas se utiliza `npm start` con `NODE_ENV=production`, después de compilar y preparar la configuración HTTPS descrita en la guía del backend.

- [Backend de proyectos y fotografía: configuración y despliegue](docs/backend-fotografia.md)
- [Contrato de datos actual](docs/contrato-datos.md)
- [Guía de funciones y equivalencias](docs/guia-funciones.md)
- [Diagnóstico inicial y evolución](docs/informe-estado-portfolio.md)
