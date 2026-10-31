CREATE TABLE IF NOT EXISTS proyectos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(160) NOT NULL,
  titulo VARCHAR(160) NOT NULL,
  descripcion TEXT NOT NULL,
  categoria VARCHAR(120) NOT NULL,
  nombre_archivo VARCHAR(80) NULL UNIQUE,
  imagen_externa VARCHAR(2048) NULL,
  imagen_alt VARCHAR(300) NOT NULL DEFAULT '',
  orden INT UNSIGNED NOT NULL DEFAULT 0,
  estado ENUM('borrador', 'publicado') NOT NULL DEFAULT 'borrador',
  ancho INT UNSIGNED NULL,
  alto INT UNSIGNED NULL,
  tamano INT UNSIGNED NULL,
  url_proyecto VARCHAR(2048) NULL,
  url_repositorio VARCHAR(2048) NULL,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_proyectos_slug (slug),
  INDEX idx_proyectos_publicacion (estado, orden, id),
  INDEX idx_proyectos_orden (orden, id),
  CONSTRAINT chk_proyectos_imagen CHECK (
    (nombre_archivo IS NOT NULL AND imagen_externa IS NULL)
    OR (nombre_archivo IS NULL AND imagen_externa IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tecnologias (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS proyecto_tecnologia (
  proyecto_id INT UNSIGNED NOT NULL,
  tecnologia_id INT UNSIGNED NOT NULL,
  orden INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (proyecto_id, tecnologia_id),
  CONSTRAINT fk_pt_proyecto FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
  CONSTRAINT fk_pt_tecnologia FOREIGN KEY (tecnologia_id) REFERENCES tecnologias(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS importaciones_datos (
  nombre VARCHAR(160) NOT NULL PRIMARY KEY,
  aplicada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
