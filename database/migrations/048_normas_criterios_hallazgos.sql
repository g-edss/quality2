ALTER TABLE hallazgos
  ADD COLUMN norma_id INTEGER,
  ADD COLUMN criterio_id INTEGER,
  ADD CONSTRAINT hallazgos_norma_criterio_completo
    CHECK ((norma_id IS NULL) = (criterio_id IS NULL)),
  ADD CONSTRAINT hallazgos_norma_criterio_fk
    FOREIGN KEY (norma_id, criterio_id)
    REFERENCES norma_criterios (norma_id, criterio_id);

CREATE INDEX idx_hallazgos_norma_criterio
  ON hallazgos (norma_id, criterio_id);