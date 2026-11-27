CREATE TABLE proceso_normas (
  proceso_id INTEGER NOT NULL REFERENCES procesos(id) ON DELETE CASCADE,
  norma_id INTEGER NOT NULL REFERENCES normas(id),
  PRIMARY KEY (proceso_id, norma_id)
);

CREATE INDEX idx_proceso_normas_norma
ON proceso_normas(norma_id);