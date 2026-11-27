CREATE TABLE seguimientos_hallazgos (
  id SERIAL PRIMARY KEY,
  hallazgo_id INTEGER NOT NULL REFERENCES hallazgos(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  comentario TEXT NOT NULL CHECK (length(trim(comentario)) BETWEEN 1 AND 10000),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX seguimientos_hallazgos_hallazgo_idx
  ON seguimientos_hallazgos(hallazgo_id);