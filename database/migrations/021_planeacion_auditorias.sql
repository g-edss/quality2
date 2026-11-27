ALTER TABLE auditorias
  ADD COLUMN proceso_id INTEGER REFERENCES procesos(id),
  ADD COLUMN auditor_catalogo_id INTEGER REFERENCES auditores(id),
  ADD COLUMN fecha_programada DATE,
  ADD COLUMN alcance TEXT NOT NULL DEFAULT '',
  ADD COLUMN comentarios TEXT NOT NULL DEFAULT '';

CREATE INDEX auditorias_proceso_idx ON auditorias(proceso_id);
