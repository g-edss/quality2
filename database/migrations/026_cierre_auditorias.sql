ALTER TABLE auditorias
  ADD COLUMN cerrada_en TIMESTAMPTZ,
  ADD COLUMN cerrada_por INTEGER REFERENCES usuarios(id);