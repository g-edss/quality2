ALTER TABLE auditorias
  ADD COLUMN conclusion TEXT,
  ADD COLUMN informe_emitido_en TIMESTAMPTZ,
  ADD COLUMN informe_emitido_por INTEGER REFERENCES usuarios(id);
