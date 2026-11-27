ALTER TABLE indicadores
  ADD COLUMN responsable_id INTEGER REFERENCES usuarios(id);

UPDATE indicadores i
SET responsable_id = p.responsable_id
FROM procesos p
WHERE p.id = i.proceso_id
  AND i.responsable_id IS NULL;

ALTER TABLE indicadores
  ALTER COLUMN responsable_id SET NOT NULL;

CREATE INDEX idx_indicadores_responsable
  ON indicadores(responsable_id);