ALTER TABLE hallazgos
  ADD COLUMN criterio TEXT,
  ADD COLUMN evidencia_observada TEXT;

ALTER TABLE hallazgos
  ADD CONSTRAINT hallazgos_criterio_no_vacio
    CHECK (criterio IS NULL OR length(trim(criterio)) BETWEEN 1 AND 10000),
  ADD CONSTRAINT hallazgos_evidencia_no_vacia
    CHECK (evidencia_observada IS NULL OR length(trim(evidencia_observada)) BETWEEN 1 AND 10000);
