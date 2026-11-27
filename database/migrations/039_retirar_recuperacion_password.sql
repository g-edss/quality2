DROP TABLE IF EXISTS recuperaciones_password;

ALTER TABLE usuarios
DROP COLUMN IF EXISTS sesion_version;
