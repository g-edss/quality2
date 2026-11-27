ALTER TABLE hallazgos
  ADD COLUMN creado_por INTEGER REFERENCES usuarios(id);

CREATE INDEX hallazgos_auditoria_idx ON hallazgos(auditoria_id);