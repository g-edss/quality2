ALTER TABLE auditorias
  ADD COLUMN iniciada_en TIMESTAMPTZ,
  ADD COLUMN iniciada_por INTEGER REFERENCES usuarios(id);