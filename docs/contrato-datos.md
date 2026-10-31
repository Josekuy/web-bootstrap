# Contrato de datos del portfolio

Los proyectos y las fotografías utilizan una API con MySQL y validación de servidor. Los textos siguen en `src/data/contenido.js`. JSDoc documenta los tipos para el editor; por sí solo no valida datos en ejecución.

## Fuentes locales

| Archivo | Exportaciones | Uso |
| --- | --- | --- |
| `src/data/contenido.js` | `navegacion`, `presentacion`, `sobreMi`, `contacto` | Textos y enlaces de las secciones. |
| `src/data/proyectos.js` | Tipo JSDoc `Proyecto`; sin datos exportados | Documentación del DTO de la API. |
| `src/data/fotografias.js` | `fotografias` y tipo JSDoc `Fotografia` | Colección vacía para proporcionar datos explícitos a la vista; no es la fuente habitual. |
| `server/semillas/proyectos-iniciales.js` | `proyectosIniciales` | Copia de los cuatro proyectos antiguos, solo para el comando de importación. |

`Proyectos` consulta `/api/proyectos` mediante `useProyectos`, y `Fotografia` consulta `/api/fotografias` mediante `useFotografias`. Recibir una colección explícita desactiva la consulta de cada vista; no hay una copia local que sustituya silenciosamente a la API si falla. Los textos se representan como texto plano, sin `dangerouslySetInnerHTML`.

## Proyectos: contrato de la API

| Campo | Tipo | Regla |
| --- | --- | --- |
| `id` | número | Identificador estable asignado por BD; no determina el orden visual. |
| `slug` | texto | Obligatorio y único, hasta 160 caracteres; minúsculas ASCII, números y guiones entre palabras. No crea una ruta de detalle por sí solo. |
| `titulo`, `categoria` | texto | Obligatorios; hasta 160 y 120 caracteres, respectivamente. |
| `descripcion` | texto | Hasta 5000 caracteres; puede estar vacía. Se utiliza también en la ficha modal. |
| `tecnologias` | lista de textos | Hasta 20 nombres, de 1 a 60 caracteres, sin duplicados ignorando mayúsculas. Conserva su orden. |
| `imagen` | texto | URL de entrega `/api/imagenes/proyectos/<uuid>.webp` o la URL HTTPS externa. |
| `imagenExterna` | texto o `null` | URL HTTPS sin credenciales, hasta 2048 caracteres; `null` si se utiliza un archivo subido. |
| `imagenAlt` | texto | Hasta 300 caracteres; `""` si la imagen es decorativa. |
| `orden` | número | Entero entre 0 y 4294967295; por defecto 0. |
| `estado` | `"publicado"` o `"borrador"` | Por defecto `borrador`; la API pública solo entrega publicados. |
| `ancho`, `alto` | número o `null` | Dimensiones calculadas para archivos subidos; `null` para imágenes externas. |
| `creadoEn`, `actualizadoEn` | texto | Fechas de BD en UTC. |
| `urlProyecto`, `urlRepositorio` | texto o `null` | URL absoluta HTTP(S), sin credenciales y hasta 2048 caracteres; vacío se convierte en `null`. |

`POST /api/admin/proyectos` recibe metadatos y exige una portada: archivo en `imagen` o URL en `imagenExterna`, nunca ambos a la vez. El panel envía `multipart/form-data` y `tecnologias` como un array serializado en JSON. Cuando se envían metadatos JSON, `tecnologias` puede ser un array directamente.

`PUT /api/admin/proyectos/:id` conserva los campos omitidos. Una imagen nueva sustituye la anterior y limpia la URL externa; una URL HTTPS nueva elimina la referencia al archivo anterior. El archivo sustituido se borra después del commit. No puede dejarse un proyecto sin ninguna portada. `imagenExterna: null` solo es válido si queda un archivo local o se envía otro. Un slug ocupado responde `409` con `SLUG_DUPLICADO`; los demás errores de campos responden `400`.

Las tecnologías se almacenan normalizadas en `tecnologias` y `proyecto_tecnologia`; cada página carga sus relaciones en una consulta adicional, sin una consulta por tarjeta. La colación de BD puede considerar equivalentes nombres con tildes: una repetición equivalente dentro del mismo proyecto también se rechaza.

`GET /api/proyectos` entrega publicados; `GET /api/admin/proyectos` incluye borradores y exige administrador. Usan la paginación y el formato de respuesta descritos abajo. La creación responde `201` con `{ "datos": Proyecto }`, la edición `200` con el mismo formato y el borrado `200` con `{ "datos": { "id": 1 } }`.

La copia de los cuatro proyectos originales se importa exclusivamente con `npm run proyectos:importar`. La transacción no sobrescribe slugs existentes y guarda un marcador en `importaciones_datos`: repetirla no recupera ejemplos que se hayan editado o eliminado desde el panel. Sus imágenes externas son ilustrativas, sin atribuirlas como capturas verificadas del trabajo.

## Fotografías: contrato de la API

| Campo de respuesta | Tipo | Regla |
| --- | --- | --- |
| `id` | número | Identificador asignado por la BD; no lo elige el cliente. |
| `titulo` | texto | Obligatorio, de 1 a 160 caracteres. |
| `descripcion` | texto | Hasta 5000 caracteres; puede estar vacía. |
| `imagen` | texto | URL del mismo origen: `/api/imagenes/<uuid>.webp`. |
| `imagenAlt` | texto | Texto alternativo obligatorio, de 1 a 300 caracteres. |
| `orden` | número | Entero entre 0 y 4294967295; por defecto 0. |
| `estado` | texto | `borrador` o `publicado`; por defecto `borrador`. |
| `ancho`, `alto` | número | Dimensiones de la copia procesada, calculadas por el servidor. |
| `creadoEn`, `actualizadoEn` | texto | Fechas de BD en UTC. |

El servidor recorta espacios exteriores, rechaza campos desconocidos y campos multipart repetidos, y valida longitudes, enteros, estados y caracteres de control. El cliente no puede asignar rutas de disco, nombres de archivo ni dimensiones. Solo deben subirse fotografías cuya publicación esté autorizada.

`POST /api/admin/fotografias` recibe `multipart/form-data` con un único archivo en `imagen` y los metadatos `titulo`, `descripcion`, `imagenAlt`, `orden` y `estado`. La imagen, el título y el texto alternativo son obligatorios al crear. `PUT /api/admin/fotografias/:id` conserva los campos omitidos y admite sustituir la imagen; sin cambios devuelve un error. También acepta metadatos JSON cuando no se envía archivo.

Las subidas admiten JPEG, PNG y WebP estáticos de hasta 8 MiB y 25 millones de píxeles. El servidor comprueba el contenido real, corrige orientación, reduce hasta 2400 × 2400 sin ampliar y genera WebP sin metadatos. No acepta SVG, GIF ni animaciones. Los archivos se guardan fuera de `public/` y `dist/`.

### Listados y privacidad

Los listados de fotografías y proyectos se ordenan por `orden` e `id` ascendentes. Los públicos solo entregan publicados; los administrativos exigen sesión e incluyen borradores. Admiten:

| Parámetro | Regla |
| --- | --- |
| `pagina` | Entero de 1 a 1000000; por defecto 1. |
| `limite` | Entero de 1 a 50; por defecto 12 en público y 20 en administración. |

```json
{
  "datos": [],
  "meta": { "pagina": 1, "limite": 12, "total": 0 }
}
```

Una lista vacía responde `200`. La creación responde `201` con `{ "datos": Fotografia }`; la edición responde `200` con el mismo formato y el borrado responde `200` con `{ "datos": { "id": 1 } }`.

`GET /api/imagenes/:nombre` para fotografías y `GET /api/imagenes/proyectos/:nombre` consultan el estado en BD antes de entregar archivos subidos. Un borrador solo es accesible con una sesión administrativa activa, aunque se conozca su URL; un visitante recibe `404`. La API y estos archivos usan `Cache-Control: no-store`, de modo que una retirada se comprueba también al volver a solicitar la imagen.

Las URL externas solo se validan: el backend no las descarga ni las utiliza para consultar servidores remotos. El proveedor externo controla su disponibilidad y privacidad; guardar el proyecto como borrador no vuelve privado un archivo alojado allí. La política de contenido de la web admite imágenes HTTPS.

La galería Swiper incorpora estados de carga, vacío, error y reintento, y carga más páginas bajo demanda sin reiniciar su posición. Utiliza `ancho` y `alto` para reservar proporciones y presenta la imagen completa dentro del marco. Recibir la propiedad `fotografias` desactiva su consulta a la API y permite reutilizar la vista con una colección explícita; el filtrado de esa colección solo afecta a su presentación. El carrusel no cambia el contrato ni requiere campos nuevos en MySQL.

## Presentación, navegación y contacto

- `navegacion`: lista de `{ etiqueta, href }`; cada `href` es el ancla de una sección existente.
- `presentacion`: `{ especialidad, titulo, descripcion, accion }`. `titulo` contiene dos textos y `accion` contiene `{ etiqueta, href }`. Conserva la presentación del Hero y traduce al español su especialidad.
- `sobreMi`: `{ etiqueta, titulo, descripcion }`. Su descripción utiliza Lorem ipsum hasta disponer de una biografía confirmada.
- `contacto`: `{ etiqueta, titulo, descripcion, correo, enlaces }`. La descripción es Lorem ipsum, el correo comienza en `null` y los enlaces en `[]`.
- Cada enlace de contacto tiene `{ id, etiqueta, url }`; `id` es estable y `url` es absoluta HTTP(S), sin usuario ni contraseña incorporados.

`SobreMi` y `Contacto` admiten una propiedad `datos` para reemplazar su contenido. `Contacto` solo representa un `mailto:` si hay un correo configurado con un formato básico válido, y descarta enlaces que no sean HTTP(S) absolutos. Sin vías válidas, informa de que todavía no están publicadas. No existe un formulario de envío ni un servidor de correo en esta fase.

## Sesión, mutaciones y errores

`GET /api/admin/sesion` entrega `datos.autenticado` (booleano), `datos.usuario` (identificador y nombre, o `null`) y `datos.csrfToken` (texto). El navegador conserva la cookie de sesión y envía `X-CSRF-Token` en login, logout y escrituras. El acceso correcto renueva el identificador de sesión y el token; la contraseña y el identificador de sesión no se guardan en localStorage.

Los errores siguen `{ "error": { "codigo": "...", "mensaje": "...", "detalles": {} } }`, con `detalles` opcional para la validación de campos. Se utilizan, entre otros, `400` para datos inválidos, `401` para acceso requerido, `403` para origen o CSRF rechazado, `404` para recursos no disponibles, `413` para exceso de tamaño y `429` para límites de peticiones. Los errores inesperados no devuelven SQL, secretos ni rutas privadas. Una confirmación de BD de resultado desconocido puede responder `503`; debe actualizarse el listado antes de repetir la escritura.

## Alcance pendiente

El panel administra fotografía y proyectos, incluidos tecnologías y enlaces de proyecto. No existe todavía `/api/contenido`: presentación, biografía, navegación y contacto siguen en el archivo local. La copia de importación está en el servidor y no se utiliza como fuente del frontend.

El arranque, las rutas de acceso y los límites operativos se describen en [Backend de proyectos y fotografía](backend-fotografia.md).
