CREATE TABLE IF NOT EXISTS proyecto_imagenes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  proyecto_id INT UNSIGNED NOT NULL,
  nombre_archivo VARCHAR(80) NULL UNIQUE,
  imagen_externa VARCHAR(2048) NULL,
  imagen_alt VARCHAR(300) NOT NULL DEFAULT '',
  orden INT UNSIGNED NOT NULL DEFAULT 0,
  ancho INT UNSIGNED NULL,
  alto INT UNSIGNED NULL,
  tamano INT UNSIGNED NULL,
  INDEX idx_proyecto_imagenes_orden (proyecto_id, orden, id),
  CONSTRAINT fk_proyecto_imagenes_proyecto FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
  CONSTRAINT chk_proyecto_imagenes_fuente CHECK (
    (nombre_archivo IS NOT NULL AND imagen_externa IS NULL)
    OR (nombre_archivo IS NULL AND imagen_externa IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
