# Contrato de datos del portfolio

Este documento describe los datos locales actuales y el formato que conviene conservar al introducir una API. Los tipos están documentados con JSDoc para facilitar su consulta desde el editor. JSDoc documenta el contrato; no valida los datos en ejecución.

## Fuentes locales

| Archivo | Exportaciones | Uso |
| --- | --- | --- |
| `src/data/contenido.js` | `navegacion`, `presentacion`, `sobreMi`, `contacto` | Textos y enlaces de las secciones. |
| `src/data/proyectos.js` | `proyectos` | Proyectos existentes y sus metadatos. |
| `src/data/fotografias.js` | `fotografias` | Galería, inicialmente vacía. |

Los componentes reciben datos mediante propiedades y usan estas fuentes por defecto. Los textos se representan como texto plano: no incluyen HTML ni requieren `dangerouslySetInnerHTML`.

## Proyectos

| Campo | Tipo | Regla |
| --- | --- | --- |
| `id` | número | Identificador estable y único; no determina el orden visual. |
| `slug` | texto | Identificador legible y único, sin espacios, para una futura ficha. Todavía no crea una ruta. |
| `titulo`, `descripcion`, `categoria` | texto | Contenido visible del proyecto. |
| `tecnologias` | lista de textos | Nombres de tecnologías o herramientas. |
| `imagen` | texto | Ruta pública o URL de una imagen. |
| `imagenAlt` | texto | Descripción accesible; `""` cuando la imagen es decorativa. |
| `orden` | número | Posición ascendente de presentación. |
| `estado` | `"publicado"` o `"borrador"` | Solo los publicados deben mostrarse en la web pública. |
| `urlProyecto`, `urlRepositorio` | texto o `null` | URL absoluta HTTP(S) confirmada, o ausencia de enlace. |

Se conservan los cuatro proyectos existentes. Sus imágenes externas son ilustrativas; no se presentan como capturas verificadas del trabajo. Su texto alternativo está vacío por ese motivo. Los enlaces permanecen en `null` hasta disponer de destinos reales. El resumen `descripcion` también puede utilizarse en una ficha local; no se inventa un caso de estudio adicional.

## Fotografías

Cada fotografía utiliza `id`, `titulo`, `descripcion`, `imagen`, `imagenAlt`, `orden` y `estado`, con los mismos significados que en los proyectos. `descripcion` puede estar vacía; `imagenAlt` debe describir el contenido cuando la fotografía sea informativa. Solo se incorporan fotografías propias autorizadas.

`Fotografia` admite la propiedad `fotografias`, filtra los elementos publicados y los ordena sin modificar la lista original. Si la lista está vacía, muestra un mensaje. No se necesitan imágenes ajenas ni un carrusel vacío para completar la sección.

## Presentación, navegación y contacto

- `navegacion`: lista de `{ etiqueta, href }`; cada `href` es el ancla de una sección existente.
- `presentacion`: `{ especialidad, titulo, descripcion, accion }`. `titulo` contiene dos textos y `accion` contiene `{ etiqueta, href }`. Conserva la presentación del Hero y traduce al español su especialidad.
- `sobreMi`: `{ etiqueta, titulo, descripcion }`. Su descripción utiliza Lorem ipsum hasta disponer de una biografía confirmada.
- `contacto`: `{ etiqueta, titulo, descripcion, correo, enlaces }`. La descripción es Lorem ipsum, el correo comienza en `null` y los enlaces en `[]`.
- Cada enlace de contacto tiene `{ id, etiqueta, url }`; `id` es estable y `url` es absoluta HTTP(S), sin usuario ni contraseña incorporados.

`SobreMi` y `Contacto` admiten una propiedad `datos` para reemplazar su contenido. `Contacto` solo representa un `mailto:` si hay un correo configurado con un formato básico válido, y descarta enlaces que no sean HTTP(S) absolutos. Sin vías válidas, informa de que todavía no están publicadas. No existe un formulario de envío ni un servidor de correo en esta fase.

## Evolución prevista hacia una API pública

Una primera API podría responder con estos contratos:

| Ruta propuesta | Respuesta JSON |
| --- | --- |
| `GET /api/proyectos` | `{ "datos": Proyecto[] }` con proyectos publicados, ordenados por `orden`. |
| `GET /api/fotografias` | `{ "datos": Fotografia[] }` con fotografías publicadas, ordenadas por `orden`. |
| `GET /api/contenido` | `{ "datos": { "navegacion": [...], "presentacion": {...}, "sobreMi": {...}, "contacto": {...} } }`. |

Las listas vacías devolverían `200` con `datos: []`; los errores podrían seguir `{ "error": { "codigo": "...", "mensaje": "..." } }`. Cuando el volumen lo justifique, se documentarán límites, paginación y sus metadatos antes de cambiar el cliente.

Estas rutas son una propuesta, no están implementadas. El frontend actual no tiene API, autenticación, base de datos ni validación de servidor. Un futuro backend deberá validar tipos, longitudes, estados, unicidad y URL, entregar únicamente contenido publicado y proteger las operaciones de administración. Filtrar borradores en el frontend organiza la presentación, pero no oculta datos que ya se han incluido en sus archivos descargables.

La futura base de datos puede separar proyectos, tecnologías, fotografías y medios sin cambiar inmediatamente este formato público. Las imágenes se almacenarían como archivos y la API expondría su referencia pública, nunca credenciales ni rutas privadas del servidor.
