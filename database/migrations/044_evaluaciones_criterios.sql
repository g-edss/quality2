CREATE TABLE proceso_criterio_evaluaciones (
  id BIGSERIAL PRIMARY KEY,
  proceso_id INTEGER NOT NULL REFERENCES procesos(id),
  criterio_id INTEGER NOT NULL REFERENCES norma_criterios(id),
  cumple BOOLEAN NOT NULL,
  observacion TEXT,
  evaluado_por INTEGER NOT NULL REFERENCES usuarios(id),
  evaluado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    observacion IS NULL
    OR length(trim(observacion)) BETWEEN 1 AND 2000
  )
);

CREATE INDEX idx_proceso_criterio_evaluaciones_actual
ON proceso_criterio_evaluaciones (
  proceso_id,
  criterio_id,
  evaluado_en DESC,
  id DESC
);