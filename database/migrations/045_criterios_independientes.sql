CREATE TABLE criterios_norma (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(80) NOT NULL,
  descripcion TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (length(trim(codigo)) > 0),
  CHECK (length(trim(descripcion)) > 0)
);

INSERT INTO criterios_norma (id, codigo, descripcion, activo, creado_en)
SELECT id, codigo, descripcion, activo, creado_en
FROM norma_criterios
ORDER BY id;

SELECT setval(
  pg_get_serial_sequence('criterios_norma', 'id'),
  COALESCE((SELECT MAX(id) FROM criterios_norma), 1),
  EXISTS (SELECT 1 FROM criterios_norma)
);

ALTER TABLE proceso_criterio_evaluaciones
  DROP CONSTRAINT IF EXISTS proceso_criterio_evaluaciones_criterio_id_fkey;

ALTER TABLE proceso_criterio_evaluaciones
  ADD CONSTRAINT proceso_criterio_evaluaciones_criterio_id_fkey
  FOREIGN KEY (criterio_id) REFERENCES criterios_norma(id);

ALTER TABLE norma_criterios RENAME TO norma_criterios_legacy;

CREATE TABLE norma_criterios (
  norma_id INTEGER NOT NULL REFERENCES normas(id),
  criterio_id INTEGER NOT NULL REFERENCES criterios_norma(id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (norma_id, criterio_id)
);

INSERT INTO norma_criterios (norma_id, criterio_id, creado_en)
SELECT norma_id, id, creado_en
FROM norma_criterios_legacy;