ALTER TABLE seguimientos_hallazgos
  ADD COLUMN tipo VARCHAR(20) NOT NULL DEFAULT 'avance'
  CHECK (tipo IN ('avance', 'aceptacion', 'correcciones'));