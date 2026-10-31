# Guía de funciones y componentes

Los nombres propios están en español. Los archivos existentes conservan sus nombres para que la estructura siga siendo reconocible, y las clases BEM mantienen sus estilos. Los identificadores exigidos por React, Bootstrap, Express y otras bibliotecas conservan su sintaxis oficial.

## Portfolio público

| Archivo | Función principal | Responsabilidad |
| --- | --- | --- |
| `src/App.jsx` | `Aplicacion` | Ordenar las secciones y cargar el panel de forma diferida al visitar `/admin`. |
| `src/components/Navbar.jsx` | `BarraNavegacion` | Mostrar la navegación y cerrar el menú móvil antes de saltar a una sección. |
| `src/components/Hero.jsx` | `Presentacion` | Mostrar el título, la introducción y el acceso a proyectos. |
| `src/components/Projects.jsx` | `Proyectos` | Consultar proyectos publicados, mostrar estados y generar tarjetas y acceso a más resultados. |
| `src/components/ProjectCard.jsx` | `TarjetaProyecto` | Mostrar el resumen y abrir la ficha correspondiente. |
| `src/components/ProjectDetail.jsx` | `DetalleProyecto` | Mostrar la ficha en un modal de Bootstrap, con enlaces reales cuando estén configurados. |
| `src/components/ThemeToggle.jsx` | `SelectorTema` | Aplicar y guardar el tema claro u oscuro. |
| `src/components/AnimationLab.jsx` | `LaboratorioAnimacion` | Ajustar y animar la fila de cuadrados. |
| `src/components/SobreMi.jsx` | `SobreMi` | Mostrar la biografía configurada. |
| `src/components/Fotografia.jsx` | `Fotografia` | Mostrar la galería Swiper con fotografías de la API, controles, carga, errores y acceso a más resultados. |
| `src/components/Contacto.jsx` | `Contacto` | Mostrar los canales de contacto configurados. |

En `Navbar.jsx`, `navegarASeccion`, `completarNavegacion`, `cerrarTrasApertura` y `cerrarMenuConTeclado` coordinan el desplegable y el salto al destino. En el selector de tema, `leerTemaInicial` y `alternarTema` recuperan y cambian la preferencia. `aplicarTemaInicial`, en `index.html`, aplica el mismo criterio antes de dibujar React.

En `AnimationLab.jsx`, `actualizarCantidad` calcula cuántos cuadrados caben. `actualizarMovimiento` y `detenerAnimaciones` atienden el movimiento reducido y la limpieza. `manejarMovimiento`, `actualizarProximidad`, `manejarSalida` y `cancelarFotograma` coordinan la interacción con el ratón.

`DetalleProyecto` inicializa el modal en un efecto y ejecuta `hide()` y `dispose()` al desmontar. `createPortal` coloca la ficha dentro de `body`. El modal no utiliza la clase `fade`, por lo que su limpieza no necesita esperar una transición. Bootstrap gestiona Escape, el fondo y la devolución del foco.

En `Fotografia`, `registrarCarrusel` y `liberarCarrusel` guardan y limpian la referencia de Swiper. `actualizarNavegacion` sincroniza índice y extremos con las flechas y el contador. `mostrarAnterior` y `mostrarSiguiente` ejecutan los métodos oficiales `slidePrev` y `slideNext`. `habilitarTeclado`, `deshabilitarTeclado` y `comprobarFoco` limitan las flechas de teclado al foco de la galería. Añadir otra página conserva la instancia y la posición; no hay reproducción automática. Los módulos `A11y` y `Keyboard`, los componentes `Swiper` y `SwiperSlide` y sus propiedades conservan sus nombres oficiales.

`src/hooks/useMovimientoReducido.js` consulta `prefers-reduced-motion` con `useSyncExternalStore`: `leerPreferencia` obtiene el valor y `suscribirPreferencia` escucha sus cambios. La galería aplica velocidad cero cuando esa preferencia está activa. Sus estilos se encuentran en `src/styles/photography.css` y utilizan las variables de ambos temas.

## Consultas y panel

| Archivo | Funciones que localizar | Responsabilidad |
| --- | --- | --- |
| `src/hooks/useFotografias.js` | `useFotografias`, `cargarPagina`, `cargarMas`, `reintentar` | Consultar páginas públicas, acumular resultados sin duplicar identificadores y cancelar peticiones al desmontar o cambiar de página. |
| `src/hooks/useProyectos.js` | `useProyectos`, `cargarPagina`, `cargarMas`, `reintentar` | Aplicar el mismo recorrido a proyectos publicados, sin recurrir a datos locales si la API falla. |
| `src/services/api.js` | `solicitarApi` | Centralizar cookies, cabecera CSRF, cuerpos JSON o `FormData` y errores comprensibles. |
| `src/admin/PanelAdmin.jsx` | `PanelAdmin`, `cambiarSeccion` | Coordinar la sesión, la sección de fotografía y el cambio a proyectos. |
| `src/admin/AccesoAdmin.jsx` | `AccesoAdmin`, `enviarAcceso` | Recoger las credenciales y enviar el acceso. |
| `src/admin/FormularioFotografia.jsx` | `FormularioFotografia`, `seleccionarArchivo`, `enviarFotografia` | Editar metadatos, comprobar formato y tamaño iniciales y enviar la imagen con sus datos. |
| `src/admin/ListadoFotografias.jsx` | `ListadoFotografias`, `solicitarEliminacion`, `cancelarEliminacion`, `confirmarEliminacion`, `cambiarPagina` | Mostrar fotografías y acciones, paginar y pedir confirmación antes del borrado. |
| `src/admin/GestionProyectos.jsx` | `GestionProyectos`, `guardarProyecto`, `editarProyecto`, `eliminarProyecto`, `informarResultadoIncierto` | Coordinar listado y formulario y conservar cambios ante una renovación de token o una confirmación incierta. |
| `src/admin/FormularioProyecto.jsx` | `FormularioProyecto`, `cambiarFuente`, `seleccionarArchivo`, `enviarProyecto` | Editar datos y tecnologías, conservar portada o elegir archivo o URL HTTPS y enviar multipart. |
| `src/admin/ListadoProyectos.jsx` | `ListadoProyectos`, `solicitarEliminacion`, `cancelarEliminacion`, `confirmarEliminacion`, `cambiarPagina` | Listado paginado de proyectos con edición y borrado confirmado. |

`useFotografias` y `useProyectos` conservan el prefijo `use` exigido para reconocer un hook. Ambas vistas consultan la API por defecto; las propiedades explícitas `fotografias` y `listaProyectos`, respectivamente, permiten reutilizarlas sin red. `src/data/fotografias.js` conserva un tipo JSDoc y una lista vacía de referencia; `src/data/proyectos.js` contiene solo el tipo, sin datos exportados. Ninguno alimenta normalmente los listados.

En `PanelAdmin`, `renovarSesion` obtiene la identidad y el token CSRF. `acceder` sustituye los datos al recibir la sesión regenerada; `salir` cierra esa sesión. `recuperarAcceso` diferencia un acceso caducado de un token antiguo: si la identidad sigue siendo válida, permite reenviar sin borrar la edición. `comenzarOperacion` y `terminarOperacion` impiden envíos simultáneos. `guardarFotografia`, `editarFotografia`, `eliminarFotografia` y `limpiarFormulario` conectan el formulario con el listado.

`FormularioFotografia` crea una URL temporal para la miniatura y la libera con `URL.revokeObjectURL`. Sus comprobaciones ayudan al usuario; la validación definitiva ocurre en el servidor. Al enviar `FormData`, `solicitarApi` deja que el navegador genere `Content-Type` y su delimitador. La sesión viaja en una cookie; no se guarda un token de sesión en `localStorage`.

`GestionProyectos` conserva el formulario al cambiar de sección y cancela las lecturas de una sección inactiva. `comenzarOperacion` y `terminarOperacion` coordinan el bloqueo durante las escrituras. Si el servidor no puede confirmar un commit, `informarResultadoIncierto` actualiza el listado sin repetir automáticamente la operación. `FormularioProyecto` convierte las tecnologías separadas por comas en un array JSON y solo envía otra portada si se cambia su fuente; también libera las miniaturas temporales.

## Backend

| Archivo | Funciones o clase | Responsabilidad |
| --- | --- | --- |
| `server/src/app.js` | `crearAplicacion` | Componer middleware, sesiones y rutas con configuración y pool inyectados. |
| `server/src/configuracion.js` y `base-datos.js` | `cargarConfiguracion`, `crearPool` | Leer configuración privada y reutilizar conexiones MySQL. |
| `server/src/modules/auth/rutas.js` | `crearProteccionAcceso`, `buscarUsuario`, `exigirAdmin`, `exigirCsrf`, `crearRutasAcceso` | Comprobar una cuenta activa, proteger mutaciones y gestionar acceso y salida. |
| `server/src/modules/auth/contrasenas.js` | `crearHashContrasena`, `comprobarContrasena` | Derivar y comparar contraseñas con sal aleatoria y scrypt. |
| `server/src/modules/auth/almacen-sesiones.js` | `AlmacenSesionesMysql` | Persistir sesiones y caducidades en MySQL. |
| `server/src/modules/fotografias/rutas.js` y `validacion.js` | `crearRutasFotografias`, `validarMetadatosFotografia`, `validarPaginacion`, `validarIdFotografia` | Recibir peticiones, comprobar los datos y coordinar archivos y consultas. |
| `server/src/modules/fotografias/repositorio.js` | `listarFotografias`, `crearFotografia`, `editarFotografia`, `borrarFotografia`, `convertirFotografia` | Consultar o modificar datos y construir la respuesta pública sin rutas privadas. |
| `server/src/modules/proyectos/rutas.js` y `validacion.js` | `crearRutasProyectos`, `validarMetadatosProyecto`, `validarEleccionImagen`, `validarPaginacionProyectos`, `validarIdProyecto` | Proteger y validar datos, tecnologías y elección de portada de los proyectos. |
| `server/src/modules/proyectos/repositorio.js` | `listarProyectos`, `crearProyecto`, `editarProyecto`, `borrarProyecto`, `convertirProyecto` | CRUD transaccional, slug único y tecnologías ordenadas, cargadas por página. |
| `server/src/modules/imagenes/imagenes.js` | `procesarYGuardarImagen`, `eliminarImagen`, `crearRutasImagenes` | Verificar contenido real, generar WebP y entregar archivos del recurso permitido según su visibilidad. |
| `server/scripts/migraciones.js` | `aplicarMigraciones` | Ejecutar las migraciones pendientes y registrar las aplicadas. |
| `server/scripts/importar-proyectos.js` | Script `proyectos:importar` | Importar la copia antigua una vez, conservando slugs existentes y registrando el marcador de aplicación. |

Las funciones de escritura del repositorio utilizan transacciones. La edición y el borrado bloquean la fila durante el cambio; los archivos anteriores se eliminan después de confirmar la base de datos. La arquitectura, las rutas y los límites operativos se explican en [backend-fotografia.md](backend-fotografia.md).

Los métodos `get`, `set`, `destroy` y `touch` de `AlmacenSesionesMysql` mantienen esos nombres porque los requiere `express-session`. Lo mismo sucede con `useState`, `useRef`, `useEffect`, `lazy` y `Suspense` de React; `Collapse` y `Modal` de Bootstrap; `createTimeline` y `createAnimatable` de Anime.js; y `Router`, `execute`, `commit` o `rollback` en el backend. Las propiedades JSX como `className`, `onClick` y `aria-label` conservan también su sintaxis oficial.

Para cambiar contenido: los textos siguen en `src/data/contenido.js`; proyectos y fotografías se gestionan desde sus secciones de `/admin` y se guardan en MySQL mediante la API. La copia de `server/semillas/proyectos-iniciales.js` solo sirve para importar los datos antiguos, no para alimentar la portada ni actualizar registros existentes. Consulta [contrato-datos.md](contrato-datos.md) para sus campos.
