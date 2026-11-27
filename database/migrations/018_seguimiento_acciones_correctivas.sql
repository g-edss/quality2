ALTER TABLE acciones_correctivas DROP CONSTRAINT acciones_correctivas_estado_check;
ALTER TABLE acciones_correctivas ADD CONSTRAINT acciones_correctivas_estado_check
  CHECK (estado IN ('propuesta', 'aceptada', 'rechazada', 'en_seguimiento', 'en_revision'));

CREATE TABLE seguimientos_acciones_correctivas (
  id SERIAL PRIMARY KEY,
  accion_id INTEGER NOT NULL REFERENCES acciones_correctivas(id),
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  comentario TEXT NOT NULL CHECK (length(trim(comentario)) BETWEEN 1 AND 10000),
  estado_resultante VARCHAR(20) NOT NULL CHECK (estado_resultante IN ('en_seguimiento', 'en_revision')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX seguimientos_acciones_accion_idx ON seguimientos_acciones_correctivas(accion_id, creado_en);
