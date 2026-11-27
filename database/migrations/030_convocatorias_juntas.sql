ALTER TABLE juntas
  ADD COLUMN tipo VARCHAR(30) NOT NULL DEFAULT 'Ordinaria',
  ADD COLUMN modalidad VARCHAR(30) NOT NULL DEFAULT 'Presencial',
  ADD COLUMN participantes TEXT NOT NULL DEFAULT '',
  ADD COLUMN agenda TEXT NOT NULL DEFAULT '',
  ADD COLUMN notas TEXT NOT NULL DEFAULT '';

CREATE INDEX juntas_fecha_idx ON juntas(fecha);
