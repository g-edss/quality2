CREATE TABLE junta_acciones_correctivas (
  junta_id INTEGER NOT NULL
    REFERENCES juntas(id) ON DELETE CASCADE,
  accion_id INTEGER NOT NULL
    REFERENCES acciones_correctivas(id) ON DELETE CASCADE,
  vinculada_por INTEGER NOT NULL
    REFERENCES usuarios(id),
  vinculada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (junta_id, accion_id)
);