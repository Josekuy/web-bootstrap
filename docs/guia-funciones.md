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
| `src/components/Ilustracion.jsx` | `Ilustracion` | Conservar el carrusel Swiper para las ilustraciones de la API, con controles, estados y más resultados. |
| `src/components/Fotografia.jsx` | `Fotografia` | Mostrar el book de fotografía con imágenes completas según su orientación y visor ampliado. |
| `src/components/Contacto.jsx` | `Contacto` | Mostrar los canales de contacto configurados. |

En `Navbar.jsx`, `navegarASeccion`, `completarNavegacion`, `cerrarTrasApertura` y `cerrarMenuConTeclado` coordinan el desplegable y el salto al destino. En el selector de tema, `leerTemaInicial` y `alternarTema` recuperan y cambian la preferencia. `aplicarTemaInicial`, en `index.html`, aplica el mismo criterio antes de dibujar React.

En `AnimationLab.jsx`, `actualizarCantidad` calcula cuántos cuadrados caben. `actualizarMovimiento` y `detenerAnimaciones` atienden el movimiento reducido y la limpieza. `manejarMovimiento`, `actualizarProximidad`, `manejarSalida` y `cancelarFotograma` coordinan la interacción con el ratón.

`DetalleProyecto` inicializa el modal en un efecto y ejecuta `hide()` y `dispose()` al desmontar. `createPortal` coloca la ficha dentro de `body`. El modal no utiliza la clase `fade`, por lo que su limpieza no necesita esperar una transición. Bootstrap gestiona Escape, el fondo y la devolución del foco.

En `Ilustracion`, `registrarCarrusel` y `liberarCarrusel` guardan y limpian la referencia de Swiper. `actualizarNavegacion` sincroniza índice y extremos con las flechas y el contador. `mostrarAnterior` y `mostrarSiguiente` ejecutan `slidePrev` y `slideNext`. `habilitarTeclado`, `deshabilitarTeclado` y `comprobarFoco` limitan las flechas de teclado al foco de la galería. Añadir otra página conserva la instancia y la posición; no hay reproducción automática. Los módulos `A11y` y `Keyboard`, los componentes `Swiper` y `SwiperSlide` y sus propiedades conservan sus nombres oficiales.

En `Fotografia`, `describirOrientacion` distingue imágenes verticales, cuadradas y horizontales. `abrirFotografia`, `cerrarFotografia`, `mostrarFotografia`, `manejarTeclado` y `cerrarDesdeFondo` controlan el visor nativo `<dialog>`, las flechas y Escape. Al cerrar devuelve el foco al botón de apertura. El book conserva el orden editorial y consulta una colección independiente de las ilustraciones.

`src/hooks/useMovimientoReducido.js` consulta `prefers-reduced-motion` con `useSyncExternalStore`: `leerPreferencia` obtiene el valor y `suscribirPreferencia` escucha sus cambios. El carrusel aplica velocidad cero cuando esa preferencia está activa. Ilustración usa `src/styles/illustration.css` y el book usa `src/styles/photography.css`, ambos con variables de los dos temas.

## Consultas y panel

| Archivo | Funciones que localizar | Responsabilidad |
| --- | --- | --- |
| `src/hooks/useGaleriaPublica.js` | `useGaleriaPublica`, `cargarPagina`, `cargarMas`, `reintentar` | Compartir la paginación, validación de respuestas, deduplicación, cancelación y reintento de las dos galerías. |
| `src/hooks/useFotografias.js`, `src/hooks/useIlustraciones.js` | `useFotografias`, `useIlustraciones` | Seleccionar la ruta y el nombre de la colección para el hook común. |
| `src/hooks/useProyectos.js` | `useProyectos`, `cargarPagina`, `cargarMas`, `reintentar` | Aplicar el mismo recorrido a proyectos publicados, sin recurrir a datos locales si la API falla. |
| `src/services/api.js` | `solicitarApi` | Centralizar cookies, cabecera CSRF, cuerpos JSON o `FormData` y errores comprensibles. |
| `src/admin/PanelAdmin.jsx` | `PanelAdmin`, `cambiarSeccion` | Coordinar la sesión y las secciones de proyectos, ilustración y fotografía. |
| `src/admin/AccesoAdmin.jsx` | `AccesoAdmin`, `enviarAcceso` | Recoger las credenciales y enviar el acceso. |
| `src/admin/galerias.js` | `galerias` | Definir nombres, recursos e identificadores de cada galería. |
| `src/admin/GestionGaleria.jsx` | `GestionGaleria`, `guardarObra`, `editarObra`, `eliminarObra`, `limpiarFormulario`, `informarResultadoIncierto` | Mantener listado y formulario independientes por colección y coordinar sus operaciones. |
| `src/admin/FormularioObra.jsx` | `FormularioObra`, `seleccionarArchivo`, `enviarObra` | Editar metadatos, comprobar formato y tamaño iniciales y enviar la imagen con sus datos. |
| `src/admin/ListadoObras.jsx` | `ListadoObras`, `solicitarEliminacion`, `cancelarEliminacion`, `confirmarEliminacion`, `cambiarPagina` | Mostrar obras y acciones, paginar y pedir confirmación antes del borrado. |
| `src/admin/GestionProyectos.jsx` | `GestionProyectos`, `guardarProyecto`, `editarProyecto`, `eliminarProyecto`, `informarResultadoIncierto` | Coordinar listado y formulario y conservar cambios ante una renovación de token o una confirmación incierta. |
| `src/admin/FormularioProyecto.jsx` | `FormularioProyecto`, `cambiarFuente`, `seleccionarArchivo`, `enviarProyecto` | Editar datos y tecnologías, conservar portada o elegir archivo o URL HTTPS y enviar multipart. |
| `src/admin/ListadoProyectos.jsx` | `ListadoProyectos`, `solicitarEliminacion`, `cancelarEliminacion`, `confirmarEliminacion`, `cambiarPagina` | Listado paginado de proyectos con edición y borrado confirmado. |

Los hooks conservan el prefijo `use` exigido por React. Las tres vistas consultan la API por defecto; las propiedades explícitas `fotografias`, `ilustraciones` y `listaProyectos` permiten reutilizarlas sin red. `src/data/fotografias.js`, `src/data/ilustraciones.js` y `src/data/proyectos.js` documentan los tipos y no alimentan normalmente los listados.

En `PanelAdmin`, `renovarSesion` obtiene la identidad y el token CSRF. `acceder` sustituye los datos al recibir la sesión regenerada; `salir` cierra esa sesión. `recuperarAcceso` diferencia un acceso caducado de un token antiguo: si la identidad sigue siendo válida, permite reenviar sin borrar la edición. `GestionGaleria` mantiene una instancia para cada galería, conserva su formulario al cambiar de sección y cancela las lecturas de la sección inactiva. `comenzarOperacion` y `terminarOperacion` coordinan las escrituras con el bloqueo del panel.

`FormularioObra` crea una URL temporal para la miniatura y la libera con `URL.revokeObjectURL`. Sus comprobaciones ayudan al usuario; la validación definitiva ocurre en el servidor. Al enviar `FormData`, `solicitarApi` deja que el navegador genere `Content-Type` y su delimitador. La sesión viaja en una cookie; no se guarda un token de sesión en `localStorage`.

`GestionProyectos` conserva el formulario al cambiar de sección y cancela las lecturas de una sección inactiva. `comenzarOperacion` y `terminarOperacion` coordinan el bloqueo durante las escrituras. Si el servidor no puede confirmar un commit, `informarResultadoIncierto` actualiza el listado sin repetir automáticamente la operación. `FormularioProyecto` convierte las tecnologías separadas por comas en un array JSON y solo envía otra portada si se cambia su fuente; también libera las miniaturas temporales.

## Backend

| Archivo | Funciones o clase | Responsabilidad |
| --- | --- | --- |
| `server/src/app.js` | `crearAplicacion` | Componer middleware, sesiones y rutas con configuración y pool inyectados. |
| `server/src/inicio.js` | Inicio de la API | Preparar las imágenes antes de escuchar peticiones y cerrar los recursos al detenerse. |
| `server/src/configuracion.js` y `base-datos.js` | `cargarConfiguracion`, `crearPool` | Leer configuración privada y reutilizar conexiones MySQL. |
| `server/src/modules/auth/rutas.js` | `crearProteccionAcceso`, `buscarUsuario`, `exigirAdmin`, `exigirCsrf`, `crearRutasAcceso` | Comprobar una cuenta activa, proteger mutaciones y gestionar acceso y salida. |
| `server/src/modules/auth/contrasenas.js` | `crearHashContrasena`, `comprobarContrasena` | Derivar y comparar contraseñas con sal aleatoria y scrypt. |
| `server/src/modules/auth/almacen-sesiones.js` | `AlmacenSesionesMysql` | Persistir sesiones y caducidades en MySQL. |
| `server/src/modules/galerias/recursos.js` | `obtenerRecursoGaleria` | Limitar tablas y rutas a las dos galerías permitidas. |
| `server/src/modules/galerias/rutas.js` y `validacion.js` | `crearRutasGaleria`, `validarMetadatosGaleria`, `validarPaginacion`, `validarIdGaleria` | Compartir autenticación, CSRF, multipart y validación sin mezclar colecciones. |
| `server/src/modules/galerias/repositorio.js` | `crearRepositorioGaleria` | Crear el CRUD transaccional y la conversión al DTO para una tabla permitida. |
| `server/src/modules/fotografias/`, `server/src/modules/ilustraciones/` | `crearRutasFotografias`, `crearRutasIlustraciones` y sus adaptadores de repositorio y validación | Exponer cada colección y conservar las firmas específicas usadas por los consumidores. |
| `server/src/modules/galerias/almacenamiento.js` | `migrarArchivosIlustraciones`, `prepararAlmacenamientoGalerias` | Trasladar los archivos históricos con verificación SHA256, sin sobrescribir y permitiendo reanudar. |
| `server/src/modules/proyectos/rutas.js` y `validacion.js` | `crearRutasProyectos`, `validarMetadatosProyecto`, `validarEleccionImagen`, `validarPaginacionProyectos`, `validarIdProyecto` | Proteger y validar datos, tecnologías y elección de portada de los proyectos. |
| `server/src/modules/proyectos/repositorio.js` | `listarProyectos`, `crearProyecto`, `editarProyecto`, `borrarProyecto`, `convertirProyecto` | CRUD transaccional, slug único y tecnologías ordenadas, cargadas por página. |
| `server/src/modules/imagenes/imagenes.js` | `procesarYGuardarImagen`, `eliminarImagen`, `crearRutasImagenes` | Verificar contenido real, generar WebP y entregar archivos del recurso permitido según su visibilidad. |
| `server/scripts/migraciones.js` | `aplicarMigraciones` | Ejecutar las migraciones pendientes y registrar las aplicadas. |
| `server/migrations/003_separar_ilustraciones_fotografias.sql` | Migración de esquema | Conservar la colección anterior como ilustraciones y crear fotografías vacía sin modificar las migraciones previas. |
| `server/scripts/importar-proyectos.js` | Script `proyectos:importar` | Importar la copia antigua una vez, conservando slugs existentes y registrando el marcador de aplicación. |

Las funciones de escritura del repositorio utilizan transacciones. La edición y el borrado bloquean la fila durante el cambio; los archivos anteriores se eliminan después de confirmar la base de datos. La arquitectura, las rutas y los límites operativos se explican en [backend-fotografia.md](backend-fotografia.md).

Cada recurso tiene su carpeta privada: `server/storage/ilustraciones/`, `fotografias/` y `proyectos/`. Sus imágenes se entregan por `/api/imagenes/ilustraciones/:nombre`, `/api/imagenes/fotografias/:nombre` y `/api/imagenes/proyectos/:nombre`. El alias antiguo `/api/imagenes/:nombre` pertenece a ilustraciones y conserva la protección de borradores. El traslado de archivos se ejecuta en `db:preparar` y al arrancar la API, antes de servir peticiones; no se ejecuta desde `crearAplicacion` ni desde `db:pruebas`.

Los métodos `get`, `set`, `destroy` y `touch` de `AlmacenSesionesMysql` mantienen esos nombres porque los requiere `express-session`. Lo mismo sucede con `useState`, `useRef`, `useEffect`, `lazy` y `Suspense` de React; `Collapse` y `Modal` de Bootstrap; `createTimeline` y `createAnimatable` de Anime.js; y `Router`, `execute`, `commit` o `rollback` en el backend. Las propiedades JSX como `className`, `onClick` y `aria-label` conservan también su sintaxis oficial.

Para cambiar contenido: los textos siguen en `src/data/contenido.js`; proyectos, ilustraciones y fotografías se gestionan desde sus secciones de `/admin` y se guardan en MySQL mediante la API. La copia de `server/semillas/proyectos-iniciales.js` solo sirve para importar los datos antiguos, no para alimentar la portada ni actualizar registros existentes. Consulta [contrato-datos.md](contrato-datos.md) para sus campos.
