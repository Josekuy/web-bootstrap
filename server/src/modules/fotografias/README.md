# Módulo de fotografías

`crearRutasFotografias` se monta directamente en la aplicación. Incluye las rutas `/api/fotografias`, `/api/admin/fotografias` y `/api/imagenes/:nombre`. Recibe el pool MySQL, el directorio privado de imágenes y los middleware de autenticación y CSRF.

El listado público devuelve únicamente fotografías publicadas. El panel obtiene también los borradores. Ambos admiten `pagina` (desde 1, hasta 1000000) y `limite` (de 1 a 50); sus valores predeterminados son 12 elementos en público y 20 en administración. La respuesta contiene `{ datos, meta: { pagina, limite, total } }`.

Para crear se envía `multipart/form-data` con `imagen`, `titulo` e `imagenAlt` obligatorios. `descripcion` admite hasta 5000 caracteres; `orden` es un entero unsigned y comienza en 0; `estado` comienza en `borrador` y solo admite `borrador` o `publicado`. El título admite hasta 160 caracteres y el texto alternativo hasta 300. No se admiten campos adicionales ni repetidos.

`PUT /api/admin/fotografias/:id` permite cambiar los metadatos recibidos y conservar el resto; la nueva imagen es opcional. También admite metadatos JSON si el middleware global de la aplicación los interpreta. Las mutaciones exigen sesión administrativa y el token CSRF en la cabecera antes de procesar archivos. La creación devuelve `201`; la edición y el borrado devuelven `200`.

Las imágenes se procesan y guardan antes de escribir en la base de datos. Si una operación de BD falla de forma conocida, se intenta eliminar el archivo nuevo. La edición y el borrado bloquean la fila con `FOR UPDATE` durante la transacción. El archivo sustituido o borrado se elimina después de confirmar la BD.

El sistema de archivos y MySQL no comparten una transacción. Un cierre del proceso entre ambas operaciones puede dejar archivos huérfanos. Si se pierde la conexión durante la confirmación y el resultado es desconocido, se conserva la imagen nueva para no romper una referencia que pudiera haberse confirmado; se devuelve `503` y se registra la incidencia. Los fallos de limpieza también quedan registrados sin devolver rutas privadas al cliente. Se necesita una comprobación operativa de archivos huérfanos y copias de seguridad coordinadas de BD e imágenes para el despliegue.
