CREATE TABLE norma_criterios (
  id SERIAL PRIMARY KEY,
  norma_id INTEGER NOT NULL REFERENCES normas(id),
  codigo VARCHAR(80) NOT NULL,
  descripcion TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (norma_id, codigo),
  CHECK (length(trim(codigo)) > 0),
  CHECK (length(trim(descripcion)) > 0)
);

CREATE INDEX idx_norma_criterios_norma
ON norma_criterios(norma_id);