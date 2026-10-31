# Portfolio de José — React, Express y MySQL

Portfolio de diseño gráfico y desarrollo web con React, Vite, Bootstrap 5, CSS propio y Anime.js. Los proyectos y las fotografías se gestionan desde un panel con API Express y base MySQL/MariaDB. Los textos de la portada siguen en un archivo local.

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

Arranca los dos servidores, cada uno en una terminal:

```sh
npm run api
```

```sh
npm run dev
```

Abre `http://127.0.0.1:5173/` para la portada y `http://127.0.0.1:5173/admin` para el panel. Vite envía `/api` a Express en el puerto 3001. Consulta las credenciales iniciales en tu `.env`; no las copies en documentación ni en el código. `.env` y `server/storage/` están excluidos de Git.

## Contenido e interfaz

| Ubicación | Qué se mantiene ahí |
| --- | --- |
| `src/data/contenido.js` | Navegación, presentación, biografía y contacto. |
| Panel `/admin`, sección Proyectos | Proyectos, tecnologías, portadas subidas o externas y enlaces opcionales. |
| Panel `/admin`, sección Fotografía | Fotografías y sus metadatos. Ambas secciones permiten ordenar, guardar borradores y publicar. |
| `src/data/proyectos.js` | Solo el contrato JSDoc; no contiene proyectos ni alimenta la portada. |
| `server/semillas/proyectos-iniciales.js` | Copia antigua consumida únicamente por `proyectos:importar`. |
| `src/data/fotografias.js` | Tipo JSDoc y colección vacía para usos explícitos de la vista; no alimenta la galería habitual. |

Los textos pendientes usan Lorem ipsum. Los correos y enlaces sin configurar se representan con `null` o listas vacías. Proyectos y fotografía muestran carga, errores con reintento, paginación y estado vacío. Los cambios publicados desde el panel aparecen mediante la API sin recompilar la web.

«Ver proyecto» abre una ficha en un modal de Bootstrap 5, con cierre mediante su X, Escape o clic en el fondo y devolución del foco a la tarjeta. `ProjectDetail.jsx` representa el modal mediante un portal y `ProjectCard.jsx` lo abre con los atributos oficiales de Bootstrap. Los enlaces opcionales solo aparecen cuando existen destinos válidos.

`src/App.jsx` organiza las secciones y carga el panel al visitar `/admin`. `src/styles/custom.css` y `custom_dark.css` definen ambos temas; `admin.css` contiene los estilos del panel. Se mantiene el grid personalizado de tres, dos y una columnas.

Las funciones propias están en español. Se conservan los nombres de los archivos existentes, las clases CSS y las APIs externas. El tema usa `theme` en localStorage, `dark-mode` y `data-bs-theme` en `html`; respeta la preferencia del sistema cuando no hay elección guardada y se aplica antes de montar React. Las fuentes se cargan desde Google Fonts y las imágenes ilustrativas de proyectos desde Unsplash.

Los borradores de ambos recursos se protegen en la API y en la entrega de archivos subidos. Las portadas externas de proyectos solo admiten HTTPS; su disponibilidad y privacidad dependen del proveedor. El backend valida esas URL y no las descarga.

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
npm run comprobar:proyectos
```

Los comprobadores utilizan Chrome/Chromium instalado y un perfil temporal sin ventana; `CHROME_PATH` permite indicar su ejecutable y `PORTFOLIO_URL` cambiar la URL de Vite. Cubren la portada, el panel de fotografía y la gestión de proyectos. Los recorridos administrativos usan las credenciales locales sin imprimirlas y crean sus propios datos de prueba. La opción `--capturas` guarda capturas opcionales en una carpeta temporal al ejecutar los scripts con `node`.

`npm run preview` permite previsualizar el resultado de Vite, pero no inicia Express ni configura su proxy de desarrollo. Para servir interfaz y API juntas se utiliza `npm start` con `NODE_ENV=production`, después de compilar y preparar la configuración HTTPS descrita en la guía del backend.

- [Backend de proyectos y fotografía: configuración y despliegue](docs/backend-fotografia.md)
- [Contrato de datos actual](docs/contrato-datos.md)
- [Guía de funciones y equivalencias](docs/guia-funciones.md)
- [Diagnóstico inicial y evolución](docs/informe-estado-portfolio.md)
