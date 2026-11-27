ALTER TABLE minutas
  ADD COLUMN registrada_por INTEGER REFERENCES usuarios(id),
  ADD COLUMN actualizada_en TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE compromisos
  ADD COLUMN fecha_compromiso DATE,
  ADD COLUMN cerrado_en TIMESTAMPTZ,
  ADD COLUMN cerrado_por INTEGER REFERENCES usuarios(id);

ALTER TABLE compromiso_avances
  ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id);

CREATE INDEX compromisos_fecha_compromiso_idx ON compromisos(fecha_compromiso);
