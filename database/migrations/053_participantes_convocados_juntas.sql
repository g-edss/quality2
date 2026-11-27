CREATE TABLE junta_participantes_convocados (
  junta_id INTEGER NOT NULL
    REFERENCES juntas(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL
    REFERENCES usuarios(id) ON DELETE CASCADE,
  agregado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (junta_id, usuario_id)
);