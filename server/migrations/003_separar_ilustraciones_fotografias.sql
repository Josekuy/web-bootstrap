-- La colección anterior se conserva íntegra al cambiar su nombre.
-- Si se interrumpe el ejecutor antes de registrar la huella, repetir es seguro.
SET @ilustraciones_existe = (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'ilustraciones'
);

SET @galeria_sql = IF(@ilustraciones_existe = 0,
  'CREATE TABLE IF NOT EXISTS fotografias_nueva LIKE fotografias',
  'SELECT 1'
);
PREPARE galeria_sentencia FROM @galeria_sql;
EXECUTE galeria_sentencia;
DEALLOCATE PREPARE galeria_sentencia;

SET @galeria_sql = IF(@ilustraciones_existe = 0,
  'RENAME TABLE fotografias TO ilustraciones, fotografias_nueva TO fotografias',
  'SELECT 1'
);
PREPARE galeria_sentencia FROM @galeria_sql;
EXECUTE galeria_sentencia;
DEALLOCATE PREPARE galeria_sentencia;

-- MariaDB anterior a 10.6 no garantiza RENAME a prueba de cortes de servidor.
-- Si ya existe Ilustración, nunca se vuelve a trasladar su contenido.
SET @fotografias_existe = (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'fotografias'
);
SET @fotografias_nueva_existe = (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'fotografias_nueva'
);
SET @galeria_sql = IF(@fotografias_existe = 0,
  IF(@fotografias_nueva_existe > 0,
    'RENAME TABLE fotografias_nueva TO fotografias',
    'CREATE TABLE fotografias LIKE ilustraciones'
  ),
  'SELECT 1'
);
PREPARE galeria_sentencia FROM @galeria_sql;
EXECUTE galeria_sentencia;
DEALLOCATE PREPARE galeria_sentencia;
