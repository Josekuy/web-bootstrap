# Módulo de fotografías

`crearRutasFotografias` adapta el módulo compartido `../galerias/` para la colección independiente `fotografias`. Se monta directamente en la aplicación e incluye `/api/fotografias`, `/api/admin/fotografias` y `/api/imagenes/fotografias/:nombre`. Recibe el pool MySQL, su directorio privado de imágenes y los middleware de autenticación y CSRF. Las firmas de repositorio y validación específicas de fotografía se conservan.

Ilustración usa los adaptadores de `../ilustraciones/`, la tabla `ilustraciones` y las rutas equivalentes `/api/ilustraciones`, `/api/admin/ilustraciones` y `/api/imagenes/ilustraciones/:nombre`. El alias anterior `/api/imagenes/:nombre` sirve exclusivamente ilustraciones, con el mismo control de publicación y administrador activo. Proyectos mantiene su módulo y `/api/imagenes/proyectos/:nombre`.

La migración `003_separar_ilustraciones_fotografias.sql` conserva el contenido anterior en `ilustraciones` y crea `fotografias` vacía. Los archivos referenciados se trasladan con verificación SHA256 antes de iniciar la API; el proceso puede repetirse, no sobrescribe destinos distintos y no retira una fuente utilizada también por fotografías. `db:pruebas` no traslada archivos reales. Las carpetas privadas son `server/storage/ilustraciones/`, `fotografias/` y `proyectos/`.

En la portada, `Ilustracion.jsx` conserva el carrusel Swiper. `Fotografia.jsx` muestra un book y un visor ampliado. Los hooks específicos usan `useGaleriaPublica`; el panel comparte `GestionGaleria`, `FormularioObra` y `ListadoObras` con estado separado por colección.

El listado público devuelve únicamente fotografías publicadas. El panel obtiene también los borradores. Ambos admiten `pagina` (desde 1, hasta 1000000) y `limite` (de 1 a 50); sus valores predeterminados son 12 elementos en público y 20 en administración. La respuesta contiene `{ datos, meta: { pagina, limite, total } }`.

Para crear se envía `multipart/form-data` con `imagen`, `titulo` e `imagenAlt` obligatorios. `descripcion` admite hasta 5000 caracteres; `orden` es un entero unsigned y comienza en 0; `estado` comienza en `borrador` y solo admite `borrador` o `publicado`. El título admite hasta 160 caracteres y el texto alternativo hasta 300. No se admiten campos adicionales ni repetidos.

`PUT /api/admin/fotografias/:id` permite cambiar los metadatos recibidos y conservar el resto; la nueva imagen es opcional. También admite metadatos JSON si el middleware global de la aplicación los interpreta. Las mutaciones exigen sesión administrativa y el token CSRF en la cabecera antes de procesar archivos. La creación devuelve `201`; la edición y el borrado devuelven `200`.

Las imágenes se procesan y guardan antes de escribir en la base de datos. Si una operación de BD falla de forma conocida, se intenta eliminar el archivo nuevo. La edición y el borrado bloquean la fila con `FOR UPDATE` durante la transacción. El archivo sustituido o borrado se elimina después de confirmar la BD.

El sistema de archivos y MySQL no comparten una transacción. Un cierre del proceso entre ambas operaciones puede dejar archivos huérfanos. Si se pierde la conexión durante la confirmación y el resultado es desconocido, se conserva la imagen nueva para no romper una referencia que pudiera haberse confirmado; se devuelve `503` y se registra la incidencia. Los fallos de limpieza también quedan registrados sin devolver rutas privadas al cliente. Se necesita una comprobación operativa de archivos huérfanos y copias de seguridad coordinadas de BD e imágenes para el despliegue.
